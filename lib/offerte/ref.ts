// Generate Renisual offerte ref numbers: REN-YYYY-NNNNN.
//
// The 5-character suffix uses a 31-char alphabet that drops every
// visually ambiguous character (0/O, 1/I/L). That gives ~28.6M unique
// suffixes per year, which is plenty: collisions are caught by a UNIQUE
// constraint at insert time and retried by the API route.

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateRef(year: number = new Date().getFullYear()): string {
  let suffix = "";
  for (let i = 0; i < 5; i++) {
    suffix += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `REN-${year}-${suffix}`;
}

// Fallback validator for paths that take a ref from the URL — keeps
// page params honest before the DB lookup so we don't hit Postgres on
// obviously malformed inputs.
const REF_RE = /^REN-\d{4}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$/;

export function isValidRef(ref: string): boolean {
  return REF_RE.test(ref);
}
