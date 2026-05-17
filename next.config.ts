import type { NextConfig } from "next";

// CSP for Renisual. connect-src includes Gemini (generativelanguage),
// OpenAI (api.openai.com), the Supabase host pattern (REST + Realtime
// websocket) and ipapi.co for /api/detect-locale. Tighten the Supabase
// rule once a fixed project subdomain is known: replace https://*.supabase.co
// with https://<project-ref>.supabase.co to shrink the allow-list.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://plausible.io",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  // 'blob:' for canvas/fabric exports and offerte-renderer previews;
  // 'data:' for inline SVG and base64 images returned by /api/render.
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://generativelanguage.googleapis.com https://api.openai.com https://*.supabase.co wss://*.supabase.co https://ipapi.co https://plausible.io",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Content-Security-Policy", value: csp },
];

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Force the browser to revalidate sw.js on every visit. Without
      // this, Hostinger's default Cache-Control on static files keeps
      // the old service-worker bytes around — the browser never sees
      // the new sw.js, updatefound never fires, and the PWA stays
      // frozen on stale bundles after a deploy.
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
