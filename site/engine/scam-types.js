// The fixed list of scam types Ruko knows about. Used by the rules, the AI prompt, and the result screen.
// Advice must stay factual and calm. Never blame the user.

export const SCAM_TYPES = {
  digital_arrest: {
    label: "Fake police or 'digital arrest' scam",
    advice: "Real police never arrest anyone or collect money over a phone or video call. Hang up. Do not pay.",
  },
  courier_parcel: {
    label: "Fake courier or customs parcel scam",
    advice: "Courier companies and customs do not threaten arrest on calls. Hang up and do not share any details.",
  },
  telecom_disconnect: {
    label: "Fake SIM or mobile-number block scam",
    advice: "Telecom companies do not threaten to block your number over a call and then pass you to 'police'. Hang up.",
  },
  kyc_block: {
    label: "Fake bank or KYC account-block scam",
    advice: "Banks never ask for your OTP, PIN or password. Do not click links. Call the number on the back of your card.",
  },
  relative_in_trouble: {
    label: "'Your relative is in trouble' scam",
    advice: "Call your relative back on their saved number before doing anything. Scammers can copy voices.",
  },
  job_task: {
    label: "Fake part-time job or 'task' scam",
    advice: "Real jobs never ask you to pay to earn. Stop and do not send any money.",
  },
  investment: {
    label: "Fake investment or stock-tips scam",
    advice: "Guaranteed returns are a warning sign. Do not transfer money to anyone from a chat group.",
  },
  electricity: {
    label: "Fake electricity disconnection scam",
    advice: "Electricity boards do not cut power after a WhatsApp message. Check on the official app or website.",
  },
  upi_collect: {
    label: "UPI 'collect request' or QR scam",
    advice: "You never need to enter your UPI PIN or scan a QR code to receive money. Decline the request.",
  },
  lottery: {
    label: "Fake lottery, prize or KBC scam",
    advice: "You cannot win a prize you never entered. Do not pay any 'tax' or 'fee'.",
  },
  remote_access: {
    label: "Remote screen-sharing app scam",
    advice: "Never install AnyDesk, TeamViewer or similar apps because a caller asked. Uninstall it if you did.",
  },
  sextortion: {
    label: "Blackmail or sextortion scam",
    advice: "Do not pay. Stop replying, keep the evidence, and report it. You are not alone and it is not your fault.",
  },
  unknown: {
    label: "Unclear",
    advice: "If anyone asks for money or details under pressure, stop and check with someone you trust first.",
  },
};

export const SCAM_TYPE_IDS = Object.keys(SCAM_TYPES);

// Where to get help (India)
export const HELP = {
  helpline: "1930",
  portal: "https://cybercrime.gov.in",
};
