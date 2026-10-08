// The self-improving loop, step 2: turn user feedback into things a human reviews.
//
//   npm run review-feedback -- --cli          (logged in to Netlify, folder linked to the site)
//   FEEDBACK_ADMIN_TOKEN=... npm run review-feedback -- --site https://your-site.netlify.app
//
// Writes:
//   private/feedback/review.md      -> where Ruko and users disagreed (misses and false alarms)
//   private/eval/candidates.csv     -> shared messages to label by hand and add to the test set
//
// Nothing is learned automatically. A person checks every candidate before it enters the test set,
// and every rule or prompt change must pass `npm run eval -- --compare` before it is kept.

import fs from "node:fs";
import { toCsv } from "./lib/metrics.mjs";

const args = process.argv.slice(2);
const site = (args[args.indexOf("--site") + 1] || "http://localhost:8888").replace(/\/$/, "");
// Two ways to read feedback:
//   --cli : read the Netlify Blobs store with the owner's Netlify CLI login (folder linked with `netlify link`). No password needed.
//   default: call /api/feedback with FEEDBACK_ADMIN_TOKEN set in this terminal.
async function readFeedback() {
  if (args.includes("--cli")) {
    const { execSync } = await import("node:child_process");
    const run = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 90000, stdio: ["ignore", "pipe", "ignore"] });
    const { blobs } = JSON.parse(run("netlify blobs:list feedback --json"));
    const out = [];
    for (const b of blobs) {
      if (!/^[A-Za-z0-9_-]+$/.test(b.key)) continue; // keys are timestamp-random; skip anything unexpected
      try { out.push(JSON.parse(run(`netlify blobs:get feedback ${b.key}`))); } catch { /* skip unreadable item */ }
    }
    return out;
  }
  const token = process.env.FEEDBACK_ADMIN_TOKEN;
  if (!token) { console.error("Use --cli (after netlify login + netlify link), or set FEEDBACK_ADMIN_TOKEN in this terminal."); process.exit(1); }
  const res = await fetch(`${site}/api/feedback`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) { console.error(`Could not read feedback (HTTP ${res.status}).`); process.exit(1); }
  return (await res.json()).items;
}
const items = await readFeedback();

const flagged = (l) => ["high", "medium", "alert", "stop"].includes(l);
const misses = items.filter((i) => i.userSays === "scam" && !flagged(i.rukoLevel));
const falseAlarms = items.filter((i) => i.userSays === "genuine" && flagged(i.rukoLevel));
const agree = items.filter((i) => (i.userSays === "scam" && flagged(i.rukoLevel)) || (i.userSays === "genuine" && !flagged(i.rukoLevel)));
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : "–");
const answered = items.filter((i) => i.userSays !== "unsure").length;

let md = `# Feedback review\n\nGenerated ${new Date().toISOString()} from ${items.length} feedback items.\n\n`;
md += `- Users agreed with Ruko: ${agree.length} of ${answered} (${pct(agree.length, answered)})\n- Misses (user said scam, Ruko did not flag): ${misses.length}\n- False alarms (user said genuine, Ruko flagged): ${falseAlarms.length}\n\n`;
md += `Feedback is self-reported and not verified. Treat it as leads to investigate, not as accuracy.\n\n`;
for (const ch of ["message", "call", "quiz"]) md += `- ${ch}: ${items.filter((i) => i.channel === ch).length} items\n`;

const calls = items.filter((i) => i.channel === "call" && i.signals);
if (calls.length) {
  md += `\n## Call alerts: does the timing need tuning?\n\n| Minutes into call | Ruko level | User says | Video | Official picture | Payment app |\n|---|---|---|---|---|---|\n`;
  for (const c of calls) md += `| ${c.signals.minutes} | ${c.rukoLevel} | ${c.userSays} | ${c.signals.video ? "yes" : ""} | ${c.signals.officialPicture ? "yes" : ""} | ${c.signals.paymentAppOpened ? "yes" : ""} |\n`;
  md += `\nLook for: genuine calls that alerted early (raise that tier's minutes) and scam calls that alerted late (lower them).\n`;
}
md += `\n## Misses with shared text\n\n` + (misses.filter((i) => i.text).map((i) => `- (${i.rukoLevel}) ${i.text}`).join("\n") || "None") + "\n";
md += `\n## False alarms with shared text\n\n` + (falseAlarms.filter((i) => i.text).map((i) => `- (${i.rukoLevel}, ${i.rukoType}) ${i.text}`).join("\n") || "None") + "\n";

fs.mkdirSync("private/feedback", { recursive: true });
fs.writeFileSync("private/feedback/review.md", md);

const candidates = items.filter((i) => i.text).map((i, n) => ({ id: `fb-${Date.now()}-${n}`, text: i.text, label: "", scam_type: "", language: "", source: "user feedback (unverified)", notes: `user said ${i.userSays}; Ruko said ${i.rukoLevel}` }));
if (candidates.length) {
  const file = "private/eval/candidates.csv";
  const keys = ["id", "text", "label", "scam_type", "language", "source", "notes"];
  fs.writeFileSync(file, toCsv(candidates, keys));
  console.log(`${candidates.length} shared messages written to ${file}. Label them by hand before adding to messages.csv.`);
}
console.log(`Review written to private/feedback/review.md (${misses.length} misses, ${falseAlarms.length} false alarms).`);
