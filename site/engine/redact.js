// Removes personal details before any text leaves the phone.
// Keeps amounts and wording, because those are what reveal a scam.

const PATTERNS = [
  ["[email]", /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g],
  ["[upi-id]", /\b[\w.-]{2,}@(?:ok\w+|ybl|ibl|axl|upi|paytm|apl|yapl|ptyes|ptsbi|ptaxis|pthdfc|icici|sbi|hdfcbank|axisbank|kotak|freecharge|airtel|jio|[a-z]{2,12})\b/gi],
  ["[card]", /\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/g],
  ["[aadhaar]", /\b\d{4}[ -]?\d{4}[ -]?\d{4}\b/g],
  ["[pan]", /\b[A-Z]{5}\d{4}[A-Z]\b/g],
  ["[phone]", /(?:\+?91[ -]?)?\b[6-9]\d{4}[ -]?\d{5}\b/g],
  ["[account]", /\b\d{9,18}\b/g],
];

export function redact(text) {
  let out = String(text || "");
  const found = {};
  for (const [label, re] of PATTERNS) {
    out = out.replace(re, () => { found[label] = (found[label] || 0) + 1; return label; });
  }
  return { text: out, found };
}
