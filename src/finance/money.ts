/**
 * Integer-paise money helpers. No floats ever cross this boundary.
 */

const HINDI_DIGITS: Record<string, string> = {
  "०": "0",
  "१": "1",
  "२": "2",
  "३": "3",
  "४": "4",
  "५": "5",
  "६": "6",
  "७": "7",
  "८": "8",
  "९": "9",
};

export function normalizeDigits(s: string): string {
  return s.replace(/[०-९]/g, (d) => HINDI_DIGITS[d] ?? d);
}

/**
 * Parse a rupee amount string to integer paise.
 * Accepts: "₹10,000", "Rs. 10,000.50", "10000", "INR 1,00,000",
 * Hindi digits "१०,०००", and Indian digit grouping.
 * Returns null when unparseable. Rounds exact-half paise away from zero.
 */
export function parseRupeesToPaise(input: string): number | null {
  if (typeof input !== "string") return null;
  let s = normalizeDigits(input).trim();
  if (s.length === 0 || s.length > 64) return null;
  // strip currency markers and whitespace
  s = s
    .replace(/(inr|rs\.?|₹|rupees)/gi, "")
    .replace(/[\s,]/g, "")
    .replace(/[–—-]$/g, "")
    .trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [intPart, decPart = ""] = s.split(".");
  if (intPart.length > 15) return null; // guard absurd magnitudes
  const rupees = BigInt(intPart);
  const dec = (decPart + "00").slice(0, 2); // pad/truncate to 2 digits
  const paise = rupees * 100n + BigInt(dec);
  if (paise > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(paise);
}

/** Format integer paise as a rupee string for display, e.g. 1050000 -> "₹10,500.00". */
export function formatPaise(paise: number): string {
  if (!Number.isSafeInteger(paise)) return "—";
  const sign = paise < 0 ? "-" : "";
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const rem = String(abs % 100).padStart(2, "0");
  return `${sign}₹${groupIndian(rupees)}.${rem}`;
}

/** Indian digit grouping: 100000 -> "1,00,000". */
export function groupIndian(n: number): string {
  const s = String(n);
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3;
}

/** Difference in whole days between two ISO dates (end - start). */
export function daysBetween(startIso: string, endIso: string): number | null {
  const a = Date.parse(startIso + "T00:00:00Z");
  const b = Date.parse(endIso + "T00:00:00Z");
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86_400_000);
}
