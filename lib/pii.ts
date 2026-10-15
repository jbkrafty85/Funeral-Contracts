// Catches the personal details a rep is most likely to type into advice by habit
// ("Mrs. Smith, your casket…"). It can't know the family's actual names, which is why
// the rep must also tick "No family names or personal details in this advice."

export type PiiFinding = { kind: string; match: string };

const PATTERNS: [string, RegExp][] = [
  ["email address", /[^\s@]+@[^\s@]+\.[a-z]{2,}/gi],
  ["phone number", /(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g],
  ["Social Security number", /\b\d{3}-\d{2}-\d{4}\b/g],
  ["date (possible birth or death date)", /\b(?:0?[1-9]|1[0-2])[/-](?:0?[1-9]|[12]\d|3[01])[/-](?:19|20)?\d{2}\b/g],
  [
    "date (possible birth or death date)",
    /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.? \d{1,2}(?:st|nd|rd|th)?,? (?:19|20)\d{2}\b/g,
  ],
  ["birth/death wording", /\b(?:born|passed away|date of (?:birth|death)|DOB|DOD)\b/gi],
  ["policy or account number", /\b(?:policy|account|acct|certificate|member|contract|case)\s*(?:no\.?|number|#)\s*:?\s*[A-Z0-9-]{4,}/gi],
  ["long number", /\b\d{7,}\b/g],
  ["name with title", /\b(?:Mr|Mrs|Ms|Miss|Dr|Rev)\.?\s+[A-Z][a-z]+/g],
  ["greeting with a name", /\b(?:Dear|Hi|Hello)\s+[A-Z][a-z]+/g],
  [
    "street address",
    /\b\d{1,6}\s+(?:[A-Z][a-z]+\s){1,3}(?:Street|St|Avenue|Ave|Road|Rd|Lane|Ln|Drive|Dr|Court|Ct|Boulevard|Blvd|Way|Place|Pl|Circle|Cir|Pike|Highway|Hwy)\b\.?/g,
  ],
];

export function scanPii(text: string): PiiFinding[] {
  const seen = new Set<string>();
  const out: PiiFinding[] = [];
  for (const [kind, re] of PATTERNS) {
    for (const m of text.matchAll(re)) {
      const key = kind + m[0];
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ kind, match: m[0] });
    }
  }
  return out;
}
