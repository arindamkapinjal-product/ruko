import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv, toCsv, score, scoreBy, percentile, regressions } from "../scripts/lib/metrics.mjs";

test("CSV parsing handles quotes, commas, new lines and Hindi", () => {
  const rows = parseCsv('id,text,label\r\n1,"Pay now, or else","scam"\n2,"He said ""hi""",genuine\n3,"line one\nline two",scam\n4,आपका खाता बंद,scam\n');
  assert.equal(rows.length, 4);
  assert.equal(rows[0].text, "Pay now, or else");
  assert.equal(rows[1].text, 'He said "hi"');
  assert.equal(rows[2].text, "line one\nline two");
  assert.equal(rows[3].text, "आपका खाता बंद");
  assert.deepEqual(parseCsv(toCsv([{ a: 'x,"y"', b: "z" }], ["a", "b"])), [{ a: 'x,"y"', b: "z" }]);
});

test("scoring counts catches, false alarms and 'can't tell' separately", () => {
  const r = [
    { label: "scam", level: "high", scam_type: "kyc_block", scamType: "kyc_block" },
    { label: "scam", level: "medium", scam_type: "lottery", scamType: "kyc_block" },
    { label: "scam", level: "unsure", scam_type: "job_task" },
    { label: "scam", level: "low", scam_type: "job_task" },
    { label: "genuine", level: "low" },
    { label: "genuine", level: "unsure" },
    { label: "genuine", level: "medium" },
    { label: "genuine", level: "low" },
  ];
  const s = score(r);
  assert.equal(s.catchRate, 50);
  assert.equal(s.strictCatchRate, 25);
  assert.equal(s.scamUnsureRate, 25);
  assert.equal(s.falseAlarmRate, 25);
  assert.equal(s.genuineUnsureRate, 25);
  assert.equal(s.typeAccuracy, 50);
  assert.equal(score([]).catchRate, null);
  const by = scoreBy([{ label: "scam", level: "high", language: "hi" }, { label: "scam", level: "low", language: "en" }], "language");
  assert.equal(by.hi.catchRate, 100);
  assert.equal(by.en.catchRate, 0);
});

test("percentile", () => {
  assert.equal(percentile([5, 1, 3, 2, 4], 50), 3);
  assert.equal(percentile([1, 2, 3, 4, 100], 95), 100);
  assert.equal(percentile([null, NaN], 50), null);
});

test("a change is rejected if any language gets worse", () => {
  const before = { overall: { catchRate: 80, falseAlarmRate: 5 }, byLanguage: { hi: { catchRate: 70, falseAlarmRate: 5 }, en: { catchRate: 90, falseAlarmRate: 5 } } };
  const better = { overall: { catchRate: 85, falseAlarmRate: 5 }, byLanguage: { hi: { catchRate: 75, falseAlarmRate: 5 }, en: { catchRate: 90, falseAlarmRate: 4 } } };
  const hindiWorse = { overall: { catchRate: 85, falseAlarmRate: 5 }, byLanguage: { hi: { catchRate: 60, falseAlarmRate: 5 }, en: { catchRate: 99, falseAlarmRate: 5 } } };
  assert.deepEqual(regressions(before, better), []);
  assert.equal(regressions(before, hindiWorse).length, 1);
  assert.match(regressions(before, hindiWorse)[0], /Language hi/);
});
