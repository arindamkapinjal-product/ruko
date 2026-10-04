// Combines the instant rules with the AI's answer into what the user sees.
// Guarantees: evidence is never made up, and Ruko never says a message is "safe".

import { SCAM_TYPES } from "./scam-types.js";

const RANK = { low: 0, unsure: 1, medium: 2, high: 3 };
const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();

// Keep only quotes that really appear in the text the user gave us.
export function verifiedQuotes(quotes, sourceText) {
  const src = norm(sourceText);
  return [...new Set((Array.isArray(quotes) ? quotes : []).map((q) => String(q).trim()).filter((q) => q.length >= 3 && src.includes(norm(q))))].slice(0, 4);
}

export function combine(rules, ai, sourceText) {
  let level = rules.level;
  let scamType = rules.scamType;
  let explanation = "";
  let aiUsed = false;
  let evidence = [...rules.evidence];

  if (ai) {
    aiUsed = true;
    const aiLevel = RANK[ai.level] !== undefined ? ai.level : "unsure";
    // Caution wins: the AI can raise the level, but cannot lower a strong rules match below "medium".
    if (RANK[aiLevel] > RANK[level]) level = aiLevel;
    else if (rules.level === "high" && RANK[aiLevel] < RANK.medium) level = "medium";
    else if (rules.level === "low" && aiLevel === "unsure") level = "unsure";
    if (ai.scamType && SCAM_TYPES[ai.scamType] && ai.scamType !== "unknown") scamType = ai.scamType;
    evidence = [...new Set([...verifiedQuotes(ai.evidence, sourceText), ...evidence])].slice(0, 4);
    explanation = typeof ai.explanation === "string" ? ai.explanation.slice(0, 400) : "";
  }
  if (level === "low") scamType = "unknown";

  return { level, scamType, evidence, explanation, aiUsed, ...present(level, scamType) };
}

export function present(level, scamType) {
  const t = SCAM_TYPES[scamType] || SCAM_TYPES.unknown;
  const headline = {
    high: "STOP. This looks like a scam.",
    medium: "Careful. This has warning signs.",
    unsure: "Ruko can't tell. Check with someone first.",
    low: "No scam signs found.",
  }[level];
  const advice = level === "low"
    ? "That does not mean it is safe. If anyone asks for money or details, check with family first."
    : t.advice;
  return { headline, typeLabel: level === "low" ? "" : t.label, advice };
}
