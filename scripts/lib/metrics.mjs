// Scoring for Ruko's evaluation. Pure functions, tested in tests/metrics.test.mjs.

export function parseCsv(src) {
  const rows = []; let row = [], cell = "", q = false;
  const s = String(src).replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"' && s[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && s[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((c) => c.trim() !== ""));
  if (!head) return [];
  const keys = head.map((h) => h.trim());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}

export const toCsv = (rows, keys) => [keys.join(","), ...rows.map((r) => keys.map((k) => `"${String(r[k] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n") + "\n";

const pct = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : null);
const flagged = (lvl) => lvl === "high" || lvl === "medium";

// results: [{ label: "scam"|"genuine", scam_type, language, level, scamType, ms, tokensIn, tokensOut }]
export function score(results) {
  const scams = results.filter((r) => r.label === "scam");
  const genuine = results.filter((r) => r.label === "genuine");
  const caught = scams.filter((r) => flagged(r.level));
  const typed = caught.filter((r) => r.scam_type);
  return {
    n: results.length, scams: scams.length, genuine: genuine.length,
    catchRate: pct(caught.length, scams.length),
    strictCatchRate: pct(scams.filter((r) => r.level === "high").length, scams.length),
    scamUnsureRate: pct(scams.filter((r) => r.level === "unsure").length, scams.length),
    falseAlarmRate: pct(genuine.filter((r) => flagged(r.level)).length, genuine.length),
    genuineUnsureRate: pct(genuine.filter((r) => r.level === "unsure").length, genuine.length),
    typeAccuracy: pct(typed.filter((r) => r.scamType === r.scam_type).length, typed.length),
  };
}

export function scoreBy(results, key) {
  const groups = {};
  for (const r of results) (groups[r[key] || "(blank)"] ||= []).push(r);
  return Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, score(v)]));
}

export function percentile(values, p) {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  return v[Math.min(v.length - 1, Math.ceil((p / 100) * v.length) - 1)];
}

// Compares two runs. A change is only kept if nothing important gets worse, overall or for any language.
export function regressions(before, after, tolerance = 0) {
  const out = [];
  const check = (name, b, a) => {
    if (!b || !a) return;
    if (a.catchRate !== null && b.catchRate !== null && a.catchRate < b.catchRate - tolerance) out.push(`${name}: scams caught fell ${b.catchRate}% → ${a.catchRate}%`);
    if (a.falseAlarmRate !== null && b.falseAlarmRate !== null && a.falseAlarmRate > b.falseAlarmRate + tolerance) out.push(`${name}: false alarms rose ${b.falseAlarmRate}% → ${a.falseAlarmRate}%`);
  };
  check("Overall", before.overall, after.overall);
  for (const lang of Object.keys(after.byLanguage || {})) check(`Language ${lang}`, before.byLanguage?.[lang], after.byLanguage[lang]);
  return out;
}
