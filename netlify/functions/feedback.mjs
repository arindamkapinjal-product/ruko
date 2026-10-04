// The self-improving loop starts here. After each check, the user can say whether Ruko was right.
// Stored: Ruko's verdict, the user's answer, and (only if they tick the box) the message with personal details removed.
// Never stored: photos, phone numbers, names, or anything the user did not choose to share.
// Reading the feedback back requires FEEDBACK_ADMIN_TOKEN (set in Netlify, never in code).

import { getStore } from "@netlify/blobs";
import { cleanFeedback } from "../lib/feedback.mjs";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
export default async (req) => {
  const store = getStore("feedback");
  if (req.method === "GET") {
    const token = process.env.FEEDBACK_ADMIN_TOKEN;
    if (!token || req.headers.get("authorization") !== `Bearer ${token}`) return json({ error: "unauthorised" }, 401);
    const { blobs } = await store.list();
    const items = [];
    for (const b of blobs.slice(-2000)) { const v = await store.get(b.key, { type: "json" }); if (v) items.push(v); }
    return json({ items });
  }
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  const item = cleanFeedback(body);
  if (!item) return json({ error: "bad_request" }, 400);
  await store.setJSON(`${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, item);
  return json({ ok: true });
};

export const config = { path: "/api/feedback" };
