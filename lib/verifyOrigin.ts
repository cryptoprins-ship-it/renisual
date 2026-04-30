// Origin check for state-changing requests. Browsers always set Origin on
// cross-site fetches and same-origin POSTs, so a strict allow-list blocks
// CSRF from arbitrary attacker-hosted pages. Same-site cookies + this
// header check is the cheapest CSRF defence that actually works.
//
// Returns null when the origin is allowed, or a 403 Response when not —
// callers should `return forbidden ?? ...` so the rejection short-circuits
// the route.

const PROD_ALLOWED = [
  "https://renisual.com",
  "https://www.renisual.com",
];

const DEV_ALLOWED = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
];

export function verifyOrigin(req: Request): Response | null {
  const origin = req.headers.get("origin");
  if (!origin) {
    if (req.method === "GET" || req.method === "HEAD") return null;
    return new Response("Forbidden", { status: 403 });
  }
  const allowed = process.env.NODE_ENV === "production"
    ? PROD_ALLOWED
    : [...PROD_ALLOWED, ...DEV_ALLOWED];
  if (!allowed.includes(origin)) {
    return new Response("Forbidden", { status: 403 });
  }
  return null;
}
