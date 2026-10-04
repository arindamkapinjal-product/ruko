# Ruko: check before you pay

Ruko (Hindi for "wait") spots the signs of a phone or WhatsApp scam in seconds and stops you before you pay. Built for India: English, Hindi and Hinglish.

**Try it:** link coming soon.

## What it does

- **Check a message.** Paste it, say it out loud, or add a screenshot. Ruko tells you the risk, the type of scam, the exact lines that gave it away, and what to do.
- **I'm on a call.** Four yes/no questions while you're still on the line. Instant answer, no AI needed.
- **Call protection (Android, in development).** Watches for the signs of a scam call, never the audio: a stranger, a police-style profile picture, a long call, a payment app opened. It shows a STOP screen at the money moment and alerts a trusted family member.

## How it works

1. **Rules on your phone** catch known red flags instantly ("digital arrest", "don't tell anyone", "pay within 1 hour", OTP requests), in English, Hindi and Hinglish.
2. **An AI check** (Gemini) classifies the message into one of 13 known Indian scam types. It must quote the exact lines it relied on, and any quote that isn't really in the message is thrown away.
3. **Caution wins.** The AI can raise the risk but can't clear a strong red flag. Ruko never says a message is "safe".
4. **It learns safely.** Users can say whether Ruko was right. That feedback is reviewed by a person, turned into test cases, and every change must pass the full test set without getting worse for any language.

## Privacy

- Ruko never listens to calls.
- Names, phone numbers, UPI IDs, Aadhaar, PAN, card and account numbers are removed **on your phone** before a message is checked.
- Screenshots are only sent if you agree, and are not stored.
- Nothing you check is stored unless you choose to share it.

## Built with

Plain HTML and JavaScript, Netlify Functions and Blobs (free tier), Google Gemini API (free tier), Node's built-in test runner.

## Getting help

If you have lost money to a scam in India, call **1930** or report at [cybercrime.gov.in](https://cybercrime.gov.in).

Ruko gives a warning, not a guarantee.
