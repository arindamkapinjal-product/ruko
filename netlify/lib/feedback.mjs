// Cleans feedback before it is stored. Only known fields, no personal details.

import { redact } from "../../site/engine/redact.js";
import { SCAM_TYPE_IDS } from "../../site/engine/scam-types.js";

const pick = (v, list) => (list.includes(v) ? v : null);

export function cleanFeedback(b) {
  const channel = pick(b?.channel, ["message", "call", "quiz"]);
  const userSays = pick(b?.userSays, ["scam", "genuine", "unsure"]);
  if (!channel || !userSays) return null;
  const out = {
    at: new Date().toISOString(),
    channel,
    userSays,
    rukoLevel: pick(b.rukoLevel, ["high", "medium", "low", "unsure", "none", "watch", "warn", "alert", "stop"]),
    rukoType: pick(b.rukoType, SCAM_TYPE_IDS),
    aiUsed: b.aiUsed === true,
  };
  if (channel === "call" && b.signals && typeof b.signals === "object") {
    const s = b.signals;
    out.signals = { unknownCaller: !!s.unknownCaller, video: !!s.video, officialPicture: !!s.officialPicture, international: !!s.international, paymentAppOpened: !!s.paymentAppOpened, minutes: Math.min(600, Math.max(0, Math.round(Number(s.minutes) || 0))) };
  }
  if (b.shareText === true && typeof b.text === "string") out.text = redact(b.text.slice(0, 2000)).text;
  return out;
}
