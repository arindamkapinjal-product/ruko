// Call risk without listening to the call. Ruko never hears the audio.
// It only uses signals the phone can see: is the caller a stranger, how long the call is,
// is it a video call, does the caller's profile picture look "official", was a payment app opened.
//
// Tiered timing: the more warning signs, the sooner Ruko alerts. Families can change the minutes.

export const DEFAULT_TIMING = {
  officialPictureMinutes: 1, // stranger with a police/official-looking profile picture
  videoMinutes: 5,           // stranger on a video call
  internationalMinutes: 5,   // stranger calling from an international number
  voiceMinutes: 10,          // stranger on a normal voice call, nothing else odd
};

// Minute at which the family should be alerted, or null if never (for example, a saved contact).
export function familyAlertMinute(s, timing = DEFAULT_TIMING) {
  if (!s.unknownCaller) return null;
  if (s.paymentAppOpened) return 0;
  const t = [timing.voiceMinutes];
  if (s.officialPicture) t.push(timing.officialPictureMinutes);
  if (s.video) t.push(timing.videoMinutes);
  if (s.international) t.push(timing.internationalMinutes);
  return Math.min(...t);
}

// What Ruko does right now, at s.minutes into the call.
// level: "none" | "watch" | "warn" | "alert" | "stop"
export function evaluateCall(s, timing = DEFAULT_TIMING) {
  const reasons = [];
  if (!s.unknownCaller) return { level: "none", alertFamily: false, fullScreen: false, reasons: ["The caller is in your contacts."] };

  reasons.push("The caller is not in your contacts.");
  if (s.officialPicture) reasons.push("Their profile picture looks like police or an official. Real officials do not investigate over WhatsApp.");
  if (s.video) reasons.push("It is a video call from a stranger.");
  if (s.international) reasons.push("It is an international number.");

  if (s.paymentAppOpened) {
    reasons.push("A payment app was opened during the call.");
    return { level: "stop", alertFamily: true, fullScreen: true, reasons };
  }
  const at = familyAlertMinute(s, timing);
  const minutes = Math.max(0, Number(s.minutes) || 0);
  if (minutes >= at) {
    reasons.push(`The call has lasted ${Math.floor(minutes)} minute${Math.floor(minutes) === 1 ? "" : "s"}.`);
    return { level: "alert", alertFamily: true, fullScreen: false, reasons, alertAtMinute: at };
  }
  const warn = s.officialPicture || s.video || s.international;
  return { level: warn ? "warn" : "watch", alertFamily: false, fullScreen: false, reasons, alertAtMinute: at };
}

// The 4-question check for when someone is on a suspicious call. No AI: instant and can't make things up.
export function quizRisk({ money, authority, secrecy, relative }) {
  const yes = [money, authority, secrecy, relative].filter(Boolean).length;
  if ((money && (authority || secrecy || relative)) || (authority && secrecy)) return "high";
  if (yes >= 1) return "medium";
  return "low";
}
