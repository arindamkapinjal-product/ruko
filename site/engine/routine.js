// Spots a routine bank notice: an OTP message that says "do not share", or a debit/credit alert.
// These only inform. They contain no link, no phone number to call and no request to do anything.
// Used by verdict.js to stop one weak word like "transfer" from turning a real OTP into a warning.

const ASKS = /\b(?:click|tap|call|dial|reply|update|verify|download|install|kyc|block(?:ed)?|suspend(?:ed)?|expire[sd]?|refund|claim|confirm|share|send|give|enter|login|log in|link|apk)\b|क्लिक|कॉल|अपडेट|वेरिफाई/i;
const PAY_ASK = /bpay(?:ment)?s+(?:now|rs|₹|inr|immediately|to|within)b/i;
const LINK = /https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|in|co|me|net|org|xyz|link|ly|app)\b\/?|\.apk\b/i;
const PHONE = /(?:\+?91[\s-]?)?\b\d{10}\b|\b1800[\s-]?\d{6,7}\b/;

export function isRoutineNotice(text) {
  const t = String(text || "");
  if (t.length > 400 || LINK.test(t) || PHONE.test(t)) return false;
  const warnsDoNotShare = /(?:do not|don'?t|never)\s+share/i.test(t);
  const isOtp = /\b(?:otp|one[- ]time password|verification code)\b/i.test(t) && warnsDoNotShare;
  const isBalanceAlert = /\b(?:debited|credited)\b/i.test(t) && /\b(?:a\/c|acct?|account)\b/i.test(t) && /\b(?:avl\.? ?bal|avlbal|available bal|total bal|bal)\b/i.test(t);
  if (!isOtp && !isBalanceAlert) return false;
  // Ignore the harmless "do not share" phrase itself, then require no request for action.
  const rest = t.replace(/(?:do not|don'?t|never)\s+share(?:\s+(?:this|it|the otp|otp|your otp))?(?:\s+with\s+anyone)?/gi, "");
  return !ASKS.test(rest) && !PAY_ASK.test(rest);
}
