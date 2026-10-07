// Runs Ruko against the hand-labelled test set and writes a report.
//
//   npm run eval                       -> calls the local AI check (start `netlify dev` first)
//   npm run eval -- --rules-only       -> rules only, no AI, no network (fast, free)
//   npm run eval -- --endpoint https://your-site.netlify.app/api/check
//   npm run eval -- --compare private/eval/runs/<earlier-run>.json   -> flags anything that got worse
//
// Test set: private/eval/messages.csv (columns: id,text,label,scam_type,language,source,notes)
// Cost estimate: set RUKO_PRICE_IN_PER_M and RUKO_PRICE_OUT_PER_M (USD per million tokens) to the CURRENT
// published price of the model. They are not hard-coded because prices change.

import fs from "node:fs";
import path from "node:path";
import { checkRules } from "../site/engine/rules.js";
import { redact } from "../site/engine/redact.js";
import { combine } from "../site/engine/verdict.js";
import { parseCsv, score, scoreBy, percentile, regressions } from "./lib/metrics.mjs";

const args = process.argv.slice(2);
const arg = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const rulesOnly = args.includes("--rules-only");
const endpoint = arg("--endpoint") || "http://localhost:8888/api/check";
const file = arg("--file") || "private/eval/messages.csv";
const reportFile = arg("--report") || "private/eval/report.md";
const tag = arg("--tag") || "";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!fs.existsSync(file)) { console.error(`No test set at ${file}. Copy private/eval/messages-template.csv to messages.csv and fill it in.`); process.exit(1); }
const rows = parseCsv(fs.readFileSync(file, "utf8")).filter((r) => r.text && ["scam", "genuine"].includes(r.label));
if (!rows.length) { console.error("The test set has no labelled rows yet."); process.exit(1); }

const problems = rows.filter((r) => r.label === "scam" && !r.scam_type).length;
if (problems) console.warn(`Note: ${problems} scam rows have no scam_type, so type accuracy ignores them.`);

const results = [];
for (const [i, row] of rows.entries()) {
  let out;
  if (rulesOnly) {
    const t0 = performance.now();
    const text = redact(row.text).text;
    out = { ...combine(checkRules(text), null, text), meta: { ms: Math.round(performance.now() - t0), aiUsed: false } };
  } else {
    for (let attempt = 0; attempt < 4; attempt++) {
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: redact(row.text).text }) }).catch(() => null);
      out = res ? await res.json().catch(() => null) : null;
      if (out?.meta?.reason === "rate_limited" || res?.status === 429) { console.log("  Free AI limit reached, waiting 60 seconds…"); await sleep(60000); continue; }
      break;
    }
    if (out?.meta && !out.meta.aiUsed) console.warn(`  Row ${row.id}: AI not used (${out.meta.reason}). Counting the rules-only answer.`);
    await sleep(Number(arg("--delay")) || 4500); // stay inside free-tier limits
  }
  results.push({ ...row, level: out?.level ?? "error", scamType: out?.scamType ?? "", evidence: out?.evidence ?? [], aiUsed: !!out?.meta?.aiUsed, ms: out?.meta?.ms ?? null, tokensIn: out?.meta?.tokensIn ?? null, tokensOut: out?.meta?.tokensOut ?? null });
  process.stdout.write(`\r${i + 1}/${rows.length} checked`);
}
console.log("");

const overall = score(results);
const byLanguage = scoreBy(results, "language");
const byType = scoreBy(results.filter((r) => r.label === "scam"), "scam_type");
const ms = results.map((r) => r.ms);
const tin = results.map((r) => r.tokensIn).filter(Number.isFinite), tout = results.map((r) => r.tokensOut).filter(Number.isFinite);
const avg = (a) => (a.length ? Math.round(a.reduce((s, x) => s + x, 0) / a.length) : null);
const pin = Number(process.env.RUKO_PRICE_IN_PER_M), pout = Number(process.env.RUKO_PRICE_OUT_PER_M);
const costPerCheck = Number.isFinite(pin) && Number.isFinite(pout) && tin.length ? (avg(tin) * pin + avg(tout) * pout) / 1e6 : null;

const run = { at: new Date().toISOString(), mode: rulesOnly ? "rules-only" : "ai", endpoint: rulesOnly ? null : endpoint, file, overall, byLanguage, byType,
  latency: { medianMs: percentile(ms, 50), p95Ms: percentile(ms, 95) }, tokens: { avgIn: avg(tin), avgOut: avg(tout) }, costPerCheckUsd: costPerCheck, results };

const dir = "private/eval/runs";
fs.mkdirSync(dir, { recursive: true });
const runFile = path.join(dir, `${run.at.replace(/[:.]/g, "-")}-${run.mode}${tag ? "-" + tag : ""}.json`);
fs.writeFileSync(runFile, JSON.stringify(run, null, 2));

const line = (name, s) => `| ${name} | ${s.scams} | ${s.catchRate ?? "–"}% | ${s.strictCatchRate ?? "–"}% | ${s.genuine} | ${s.falseAlarmRate ?? "–"}% | ${s.genuineUnsureRate ?? "–"}% |`;
const small = (s) => (s.scams && s.scams < 10) || (s.genuine && s.genuine < 10);
const synthetic = /synthetic/i.test(file);
let md = `# Ruko evaluation report${synthetic ? " (SYNTHETIC test set: AI-generated messages, not real)" : ""}\n\nRun: ${run.at} · Mode: **${run.mode}** · Rows: ${overall.n} (${overall.scams} scam, ${overall.genuine} genuine)\n\n`;
md += `"Caught" means Ruko said high or medium risk. "False alarm" means it said high or medium on a genuine message.\n\n`;
md += `| Group | Scams | Caught | Caught as high | Genuine | False alarms | "Can't tell" on genuine |\n|---|---|---|---|---|---|---|\n`;
md += line("**Overall**", overall) + "\n";
for (const [k, s] of Object.entries(byLanguage)) md += line(`Language: ${k}${small(s) ? " ⚠️ small group" : ""}`, s) + "\n";
md += `\nScam type named correctly (of scams caught): ${overall.typeAccuracy ?? "–"}%\n\n### By scam type\n\n| Type | Scams | Caught |\n|---|---|---|\n`;
for (const [k, s] of Object.entries(byType)) md += `| ${k} | ${s.scams} | ${s.catchRate ?? "–"}% |\n`;
md += `\n### Speed and cost\n\n- Median time per check: ${run.latency.medianMs ?? "–"} ms (95th percentile ${run.latency.p95Ms ?? "–"} ms)\n- Average tokens per check: ${run.tokens.avgIn ?? "–"} in, ${run.tokens.avgOut ?? "–"} out\n`;
md += `- Estimated cost per check at paid rates: ${costPerCheck === null ? "not calculated (set RUKO_PRICE_IN_PER_M and RUKO_PRICE_OUT_PER_M to current prices)" : `$${costPerCheck.toFixed(6)}`}\n- Cost on the free tier: ₹0\n`;
const misses = results.filter((r) => r.label === "scam" && !["high", "medium"].includes(r.level));
const alarms = results.filter((r) => r.label === "genuine" && ["high", "medium"].includes(r.level));
md += `\n### Every miss (${misses.length})\n\n` + (misses.map((r) => `- [${r.id}] (${r.language}, ${r.scam_type}) said **${r.level}**: ${r.text}`).join("\n") || "None") + "\n";
md += `\n### Every false alarm (${alarms.length})\n\n` + (alarms.map((r) => `- [${r.id}] (${r.language}) said **${r.level}** (${r.scamType}): ${r.text}`).join("\n") || "None") + "\n";

const compare = arg("--compare");
if (compare && fs.existsSync(compare)) {
  const before = JSON.parse(fs.readFileSync(compare, "utf8"));
  const regs = regressions(before, run);
  md += `\n### Compared with ${path.basename(compare)}\n\n- Scams caught: ${before.overall.catchRate}% → ${overall.catchRate}%\n- False alarms: ${before.overall.falseAlarmRate}% → ${overall.falseAlarmRate}%\n\n`;
  md += regs.length ? `**Do not keep this change.** It made things worse:\n${regs.map((r) => `- ${r}`).join("\n")}\n` : "**No group got worse.** This change can be kept.\n";
}
fs.writeFileSync(reportFile, md);
console.log(`Overall: caught ${overall.catchRate}% of scams, ${overall.falseAlarmRate}% false alarms. Report: ${reportFile}, run saved: ${runFile}`);
