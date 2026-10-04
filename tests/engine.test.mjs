// Tests for Ruko's brain. The example messages here are SYNTHETIC, written for testing the rules.
// They are not evaluation data and must never be reported as results. Real evaluation uses private/eval/.

import { test } from "node:test";
import assert from "node:assert/strict";
import { checkRules } from "../site/engine/rules.js";
import { evaluateCall, familyAlertMinute, quizRisk, DEFAULT_TIMING } from "../site/engine/call-risk.js";
import { redact } from "../site/engine/redact.js";
import { combine, verifiedQuotes, present } from "../site/engine/verdict.js";
import { SCAM_TYPES, SCAM_TYPE_IDS } from "../site/engine/scam-types.js";

const SCAMS = [
  ["This is Mumbai Cyber Crime. Your Aadhaar is linked to money laundering. You are under digital arrest. Do not tell anyone. Pay 50000 within 1 hour.", "digital_arrest", "en"],
  ["FedEx: your parcel to Taiwan was seized by customs, it contains drugs and 5 passports. Press 1 to talk to police.", "courier_parcel", "en"],
  ["Dear customer your SBI account will be blocked today. Update KYC immediately: http://sbi-kyc-update.in", "kyc_block", "en"],
  ["Mummy aapka beta police ne pakda hai, turant 20000 bhej do, kisi ko mat batana", "relative_in_trouble", "hinglish"],
  ["आपका बिजली कनेक्शन आज रात 9 बजे काट दिया जाएगा। तुरंत इस नंबर पर कॉल करें।", "electricity", "hi"],
  ["Part time job! Like YouTube videos and earn ₹5000 per day. Pay ₹999 registration fee to start", "job_task", "en"],
  ["Join our trading group for guaranteed returns, 10% daily profit, double your money in a month", "investment", "en"],
  ["Congratulations you have won KBC lottery prize money 25 lakh. Pay processing fee to claim", "lottery", "en"],
  ["Sir please install AnyDesk so I can help you get your refund", "remote_access", "en"],
  ["Your mobile number will be blocked in 2 hours by TRAI due to illegal activity", "telecom_disconnect", "en"],
];
const GENUINE = [
  "Your OTP for login is 482913. Do not share it with anyone. -HDFC Bank",
  "Hi beta, khana kha liya? Call me when free",
  "Your Amazon order has been delivered. Rate your experience.",
  "Rs 500 debited from a/c XX1234 on 12-Mar. If not you, call 1800-xxx",
  "PTM tomorrow at 10am, please bring the report card",
  "Meeting moved to 4pm, link in calendar",
];

test("every synthetic scam is flagged high with the right type", () => {
  for (const [msg, type] of SCAMS) {
    const r = checkRules(msg);
    assert.notEqual(r.level, "low", msg);
    assert.equal(r.scamType, type, msg);
    assert.ok(r.evidence.length > 0);
    for (const q of r.evidence) assert.ok(msg.toLowerCase().includes(q.toLowerCase()), `quote not in text: ${q}`);
  }
  assert.equal(checkRules(SCAMS[0][0]).level, "high");
});

test("ordinary messages, including a bank OTP SMS, are not flagged", () => {
  for (const msg of GENUINE) assert.equal(checkRules(msg).level, "low", msg);
});

test("OTP is flagged only when someone asks for it", () => {
  assert.notEqual(checkRules("Please share the OTP you received to verify your account").level, "low");
  assert.equal(checkRules("OTP is 1234. Never share your OTP.").level, "low");
});

test("call risk uses tiered timing", () => {
  const base = { unknownCaller: true, minutes: 0 };
  assert.equal(familyAlertMinute({ ...base }), DEFAULT_TIMING.voiceMinutes);
  assert.equal(familyAlertMinute({ ...base, video: true }), DEFAULT_TIMING.videoMinutes);
  assert.equal(familyAlertMinute({ ...base, video: true, officialPicture: true }), DEFAULT_TIMING.officialPictureMinutes);
  assert.equal(familyAlertMinute({ ...base, paymentAppOpened: true }), 0);
  assert.equal(familyAlertMinute({ unknownCaller: false, minutes: 60 }), null);

  assert.equal(evaluateCall({ ...base, minutes: 3 }).level, "watch");
  assert.equal(evaluateCall({ ...base, minutes: 10 }).level, "alert");
  assert.equal(evaluateCall({ ...base, video: true, minutes: 2 }).level, "warn");
  assert.equal(evaluateCall({ ...base, officialPicture: true, minutes: 1 }).alertFamily, true);
  const stop = evaluateCall({ ...base, minutes: 1, paymentAppOpened: true });
  assert.equal(stop.level, "stop");
  assert.ok(stop.fullScreen && stop.alertFamily);
  assert.equal(evaluateCall({ unknownCaller: false, minutes: 30, paymentAppOpened: true }).level, "none");
  assert.equal(familyAlertMinute({ ...base }, { ...DEFAULT_TIMING, voiceMinutes: 5 }), 5); // families can change it
});

test("4-question check", () => {
  assert.equal(quizRisk({ money: true, authority: true }), "high");
  assert.equal(quizRisk({ authority: true, secrecy: true }), "high");
  assert.equal(quizRisk({ relative: true }), "medium");
  assert.equal(quizRisk({}), "low");
});

test("personal details are removed but amounts and wording stay", () => {
  const { text, found } = redact("Call me on +91 98765 43210 or 9876543210, UPI rahul.k@okaxis, mail a@b.com, Aadhaar 1234 5678 9012, card 4111 1111 1111 1111, PAN ABCDE1234F, a/c 123456789012345. Pay ₹50,000 now");
  for (const leak of ["98765", "9876543210", "rahul.k@okaxis", "a@b.com", "1234 5678 9012", "4111", "ABCDE1234F", "123456789012345"]) assert.ok(!text.includes(leak), leak);
  assert.ok(text.includes("₹50,000") && text.includes("Pay"));
  assert.ok(found["[phone]"] >= 2 && found["[upi-id]"] === 1 && found["[card]"] === 1 && found["[aadhaar]"] === 1);
  assert.ok(text.includes("1930") || !text.includes("1930")); // helpline-length numbers are untouched
  assert.equal(redact("Call 1930 now").text, "Call 1930 now");
});

test("AI evidence that is not in the message is thrown away", () => {
  const src = "Pay 5000 now or you will be arrested";
  assert.deepEqual(verifiedQuotes(["you will be ARRESTED", "send your OTP", "x"], src), ["you will be ARRESTED"]);
});

test("combining rules and AI: caution wins and Ruko never says safe", () => {
  const strong = checkRules(SCAMS[0][0]);
  const ai = { level: "low", scamType: "unknown", evidence: [], explanation: "Looks fine" };
  assert.equal(combine(strong, ai, SCAMS[0][0]).level, "medium"); // AI cannot clear a strong rules match
  const weak = checkRules("hello");
  assert.equal(combine(weak, { level: "high", scamType: "kyc_block", evidence: ["hello"] }, "hello").level, "high");
  assert.equal(combine(weak, { level: "unsure" }, "hello").level, "unsure");
  assert.equal(combine(weak, { level: "made-up" }, "hello").level, "unsure");
  for (const lvl of ["high", "medium", "unsure", "low"]) assert.doesNotMatch(present(lvl, "kyc_block").headline, /safe/i);
  assert.match(present("low", "unknown").advice, /does not mean it is safe/);
});

test("every scam type has a label and advice, and advice never blames the user", () => {
  for (const id of SCAM_TYPE_IDS) {
    assert.ok(SCAM_TYPES[id].label && SCAM_TYPES[id].advice);
    assert.doesNotMatch(SCAM_TYPES[id].advice, /stupid|foolish|should have known|(?<!not )your fault/i);
  }
});
