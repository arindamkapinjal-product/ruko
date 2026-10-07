// Fast red-flag rules. Run on the phone, instantly, with no AI and no network.
// They cover English, Hindi (Devanagari) and Hinglish (Hindi written in English letters).
// Each match returns the exact text that triggered it, so the "why" is always real.

const R = (id, weight, type, re, test) => ({ id, weight, type, re, test });

export const RULES = [
  R("digital_arrest_phrase", 4, "digital_arrest", /digital(?:ly)?\s*arrest|डिजिटल\s*अरेस्ट/i),
  R("police_or_agency", 2, "digital_arrest", /\b(?:cbi|ncb|crime branch|cyber ?cell|cyber crime (?:department|police)|narcotics|ed officer|enforcement directorate|police station|arrest warrant|warrant)\b|पुलिस|गिरफ्तार|वारंट/i),
  R("arrest_threat", 2, "digital_arrest", /\b(?:you will be arrested|arrest (?:you|kar)|giraftar|jail (?:jaoge|bhej)|case (?:has been )?(?:filed|registered) against you)\b|गिरफ्तार (?:कर|हो)/i),
  R("aadhaar_misuse", 3, "digital_arrest", /(?:aadhaar|aadhar|आधार|pan card)[^.\n]{0,60}(?:misuse|linked|illegal|crime|money laundering|drugs|गलत)/i),
  R("money_laundering", 2, "digital_arrest", /money laundering|hawala|मनी लॉन्ड्रिंग/i),
  R("stay_on_call", 3, "digital_arrest", /stay on (?:the )?(?:video )?call|keep (?:your )?camera on|(?:don'?t|do not) (?:cut|disconnect|end) (?:the )?call|call (?:mat|na) kaat|कॉल (?:मत|न) काट/i),
  R("secrecy", 3, null, /(?:don'?t|do not) tell (?:anyone|anybody|your family)|kisi ko (?:mat|na|nahi) bata|किसी को (?:मत|न|नहीं) बता|keep (?:this|it) (?:secret|confidential)|confidential (?:investigation|matter)/i),
  R("urgency", 2, null, /within \d+\s*(?:min(?:ute)?s?|hours?|hrs?)|\b(?:immediately|urgent(?:ly)?|turant|abhi ke abhi|last chance|today itself)\b|तुरंत|फ़ौरन|फौरन/i),
  R("payment_request", 2, null, /\b(?:pay|transfer|send money|deposit|security deposit|verification (?:amount|fee|charge)|processing fee|refundable amount|paise bhej|paise jama)\b|पैसे (?:भेज|जमा|ट्रांसफर)/i),
  R("parcel_seized", 3, "courier_parcel", /(?:parcel|courier|package|fedex|dhl|customs|पार्सल|कूरियर)[^.\n]{0,80}(?:drugs|illegal|seized|mdma|passports?|contraband|पकड़|ड्रग)/i),
  R("sim_block", 3, "telecom_disconnect", /(?:sim|mobile number|your number|phone number|trai)[^.\n]{0,50}(?:block|blocked|suspend|deactivat|disconnect|band ho)/i),
  R("account_block", 3, "kyc_block", /(?:account|kyc|pan|debit card|credit card|खाता)[^.\n]{0,50}(?<!un)(?:block|blocked|suspend|freeze|frozen|band ho|बंद)/i),
  R("otp_request", 3, "kyc_block", /\b(?:otp|one[- ]time password|upi pin|atm pin|cvv)\b/i, (text, m) => {
    // A bank's own OTP SMS says "do not share". Only flag when someone ASKS for it.
    const around = text.slice(Math.max(0, m.index - 60), m.index + 60).toLowerCase();
    if (/(?:do not|don'?t|never|kabhi na|mat)\s+(?:share|disclose|bata)/.test(around)) return false;
    return /(?:share|tell|send|give|bata|batao|bhejo|bhej do|provide|enter|confirm)/.test(around);
  }),
  R("relative_trouble", 3, "relative_in_trouble", /(?:your|aapka|aapki|tumhara|tumhari)\s+(?:son|daughter|husband|wife|beta|beti|bhai|pati)[^.\n]{0,80}(?:arrest|accident|hospital|police|jail|custody|pakda|पकड़)|आपका (?:बेटा|बेटी)[^.\n]{0,60}(?:पकड़|हादसा|अस्पताल|पुलिस)/i),
  R("job_task", 3, "job_task", /part[- ]time (?:job|work)|work from home[^.\n]{0,40}(?:earn|₹|rs)|ghar baithe[^.\n]{0,30}kama|like (?:youtube )?videos? (?:and|to) earn|(?:earn|kamao|kamaye)[^.\n]{0,20}(?:₹|rs\.?)\s?\d+[^.\n]{0,15}(?:per day|daily|roz|daily)/i),
  R("investment", 3, "investment", /guaranteed (?:returns?|profit)|double (?:your )?money|paisa double|stock tips|ipo allotment|trading group|\d+%\s*(?:daily|weekly|monthly) (?:returns?|profit)/i),
  R("electricity_cut", 3, "electricity", /(?:electricity|bijli|बिजली|power)[^.\n]{0,60}(?:disconnect|cut|kat|kaat|कट|काट|band|बंद)/i),
  R("upi_collect", 3, "upi_collect", /collect request|(?:scan|enter (?:your )?(?:upi )?pin)[^.\n]{0,40}(?:receive|get|refund|cashback)|to receive (?:the )?(?:money|payment|refund)[^.\n]{0,30}(?:scan|pin)/i),
  R("lottery_prize", 3, "lottery", /\b(?:lottery|lucky draw|kbc|kaun banega crorepati|you have won|prize money)\b|इनाम|लॉटरी/i),
  R("remote_app", 3, "remote_access", /\b(?:anydesk|teamviewer|quick ?support|rustdesk|airdroid)\b/i),
  R("sextortion", 3, "sextortion", /(?:video|photo|pics?)[^.\n]{0,40}(?:viral|leak|send to your (?:family|contacts))|(?:nude|obscene) (?:video|photo)/i),
  R("suspicious_link", 1, null, /https?:\/\/\S+|\bbit\.ly\/|\btinyurl\.com\/|\b\S+\.apk\b/i),
  R("apk_file", 3, "kyc_block", /\.apk\b/i),
];

// Score thresholds for the overall level
export const LEVELS = { high: 5, medium: 2 };

export function checkRules(text) {
  const input = String(text || "");
  const hits = [];
  for (const rule of RULES) {
    const re = new RegExp(rule.re.source, rule.re.flags.includes("g") ? rule.re.flags : rule.re.flags + "g");
    let m;
    while ((m = re.exec(input))) {
      if (!rule.test || rule.test(input, m)) { hits.push({ rule: rule.id, weight: rule.weight, type: rule.type, quote: m[0].trim() }); break; }
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  }
  const score = hits.reduce((s, h) => s + h.weight, 0);
  const byType = {};
  for (const h of hits) if (h.type) byType[h.type] = (byType[h.type] || 0) + h.weight;
  const scamType = Object.entries(byType).sort((a, b) => b[1] - a[1])[0]?.[0] || "unknown";
  const level = score >= LEVELS.high ? "high" : score >= LEVELS.medium ? "medium" : "low";
  const strongestFirst = [...hits].sort((a, b) => b.weight - a.weight);
  return { level, score, scamType, evidence: [...new Set(strongestFirst.map((h) => h.quote))].slice(0, 4), hits };
}
