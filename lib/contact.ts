// Shared by the browser form and the server, so both accept exactly the same input.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(raw: string): string | null {
  const v = raw.trim().toLowerCase();
  return v.length <= 254 && EMAIL.test(v) ? v : null;
}

// US mobile numbers only for now; returns E.164 (+1XXXXXXXXXX).
export function normalizeUsPhone(raw: string): string | null {
  let d = raw.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  if (d.length !== 10 || /^[01]/.test(d)) return null;
  return "+1" + d;
}
