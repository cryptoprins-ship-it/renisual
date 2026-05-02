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

// Vercel issues a unique preview URL for every commit (e.g.
// renisual-abc123-cryptoprins-ship-its-projects.vercel.app). They are
// our deploys, but the hostname is unpredictable, so we accept any
// origin under the .vercel.app suffix rather than maintaining a list.
function isVercelPreviewOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return url.protocol === "https:" && url.hostname.endsWith(".vercel.app");
  } catch {
    return false;
  }
}

export function verifyOrigin(req: Request): Response | null {
  const origin = req.headers.get("origin");
  if (!origin) {
    if (req.method === "GET" || req.method === "HEAD") return null;
    return jsonForbidden("missing_origin");
  }
  const allowed = process.env.NODE_ENV === "production"
    ? PROD_ALLOWED
    : [...PROD_ALLOWED, ...DEV_ALLOWED];
  if (allowed.includes(origin) || isVercelPreviewOrigin(origin)) {
    return null;
  }
  return jsonForbidden("origin_not_allowed");
}

// Return JSON instead of plain text so frontend `await res.json()`
// callers don't crash on the body. Frontend code should still check
// res.ok first; this is defence in depth.
function jsonForbidden(reason: string): Response {
  return new Response(JSON.stringify({ error: "Forbidden", reason }), {
    status: 403,
    headers: { "content-type": "application/json" },
  });
}
