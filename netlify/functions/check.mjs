// Ruko's AI check. Receives text that the phone has ALREADY stripped of personal details,
// or a screenshot the user chose to send. Never stores what it receives.
// The Gemini key lives only in Netlify's environment variables (GEMINI_API_KEY).
// If the AI is unavailable, Ruko still answers using the rules, so the user is never left without help.

import { checkRules } from "../../site/engine/rules.js";
import { redact } from "../../site/engine/redact.js";
import { combine } from "../../site/engine/verdict.js";
import { buildPrompt, parseAi, MAX_TEXT, MAX_IMAGE_B64 } from "../lib/ai.mjs";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export default async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const started = Date.now();
  let body;
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }

  const isImage = typeof body.imageBase64 === "string";
  let text = "";
  if (isImage) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(body.mime) || body.imageBase64.length > MAX_IMAGE_B64 || !/^[A-Za-z0-9+/=]+$/.test(body.imageBase64)) return json({ error: "bad_request" }, 400);
    if (body.consent !== true) return json({ error: "consent_required" }, 400);
  } else {
    text = redact(String(body.text || "").slice(0, MAX_TEXT)).text; // redact again, in case the phone missed something
    if (text.trim().length < 3) return json({ error: "bad_request" }, 400);
  }

  const rulesOnly = (reason) => {
    const r = checkRules(text);
    return json({ ...combine(r, null, text), meta: { ms: Date.now() - started, aiUsed: false, reason } });
  };

  const key = process.env.GEMINI_API_KEY;
  if (!key) return isImage ? json({ error: "not_configured" }, 503) : rulesOnly("not_configured");

  const parts = [{ text: buildPrompt({ text, isImage }) }];
  if (isImage) parts.push({ inline_data: { mime_type: body.mime, data: body.imageBase64 } });
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";

  let res;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { temperature: 0, maxOutputTokens: 500, responseMimeType: "application/json" } }),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    return isImage ? json({ error: "upstream_unreachable" }, 502) : rulesOnly("upstream_unreachable");
  }
  if (!res.ok) {
    const reason = res.status === 429 ? "rate_limited" : "upstream_error";
    return isImage ? json({ error: reason }, res.status === 429 ? 429 : 502) : rulesOnly(reason);
  }
  const data = await res.json().catch(() => null);
  const ai = parseAi(data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "");
  if (!ai) return isImage ? json({ error: "empty_response" }, 502) : rulesOnly("empty_response");

  // For screenshots, the rules and the evidence check run on the text the AI read from the image
  const source = isImage ? redact(ai.transcript).text : text;
  const verdict = combine(checkRules(source), ai, source);
  const usage = data?.usageMetadata || {};
  const meta = { ms: Date.now() - started, aiUsed: true, model, tokensIn: usage.promptTokenCount ?? null, tokensOut: usage.candidatesTokenCount ?? null };
  console.log(JSON.stringify({ event: "check", kind: isImage ? "image" : "text", level: verdict.level, ...meta })); // observability, no content
  return json({ ...verdict, meta });
};

export const config = { path: "/api/check" };
