# Ruko Guard (Android): design

**Status: designed, not built yet.** This is the plan for the phone app that protects people during calls.
The web app's "Call protection" tab simulates exactly this logic using `site/engine/call-risk.js`.

## Why an Android app

Scams in India mostly happen on **voice calls**. "Digital arrest" scams often start as a voice call (fake courier, TRAI or bank) and then move to a **WhatsApp video call** with a fake police officer. A website can't see calls. An Android app, with the user's permission, can see the *signs* of a scam call without ever hearing it.

iPhone does not allow this. iPhone users get the web app and the WhatsApp check.

## What it watches (never the audio)

| Signal | How Android provides it | Permission |
|---|---|---|
| Caller not in contacts | Call state and contacts lookup | READ_PHONE_STATE, READ_CALL_LOG (or CallScreeningService), READ_CONTACTS |
| Call length | Call state timing | as above |
| WhatsApp voice/video call and who it's with | WhatsApp's "ongoing call" notification | Notification access (NotificationListenerService) |
| Police-style profile picture | Sender picture inside WhatsApp notifications | Notification access; image check on the phone |
| Payment app opened during or right after the call | Which app is in front | Usage access (PACKAGE_USAGE_STATS) |
| Show the STOP screen | Draw over other apps | SYSTEM_ALERT_WINDOW |
| Alert family | Push notification to the paired family phone | Internet |

To verify early on real phones: whether WhatsApp's ongoing-call notification reliably shows the contact and lets us time the call, and whether the sender picture is available in notifications on common Android versions.

## Alert timing (tiered, family-editable)

Same rules as `site/engine/call-risk.js`:

| Situation | Family alerted |
|---|---|
| Any stranger call + payment app opened | Instantly, with full-screen STOP |
| Stranger + police-style profile picture | After 1 minute |
| Stranger + video call | After 5 minutes |
| Stranger + international number | After 5 minutes |
| Stranger, ordinary voice call | After 10 minutes |
| Saved contact | Never |

These are starting points, tuned from pilot feedback (see the self-improving loop in the plan).

## Privacy rules

- Never record or listen to calls. Never read message content except to check it on the phone.
- Normal activity never leaves the phone. Only alerts (and the minimum signals) go to the paired family member.
- Profile-picture check runs on the phone. Only flagged pictures may be sent for a closer AI check, and only with consent.
- Detect uniforms, badges and logos, never faces or identity.

## Constraints

- Google Play restricts call-log and some other permissions. The family pilot installs the app directly (free). Publishing on Play costs a one-time US$25 and may need a permissions review. Decide later.
- Building it needs Android Studio (free).
