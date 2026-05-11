// Sliding-window rate limiting backed by Upstash Redis. The library
// gracefully degrades to a permissive in-process limiter when the Upstash
// env vars are absent (local dev / preview without secrets) so routes
// don't have to special-case missing infra.
//
// Production env vars (set in Vercel/Hostinger):
//   UPSTASH_REDIS_REST_URL
//   UPSTASH_REDIS_REST_TOKEN
//
// Limits — Renisual is the high-stakes side because each /api/render
// burns Gemini quota. Tight bucket on render, looser on read APIs.
//   renderLimit — 5 req / 60s / IP   (Gemini & OpenAI image edits cost €€)
//   apiLimit    — 60 req / 60s / IP  (general read endpoints)
//   formLimit   — 3 req / 1h  / IP   (offerte + waitlist; spam-sensitive)

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type Limiter = {
  limit: (key: string) => Promise<{ success: boolean; reset: number; remaining: number }>;
};

// Strip a single pair of surrounding double or single quotes. Hostinger's
// env-var UI stores quotes literally when operators paste a `KEY="value"`
// snippet from a dashboard.
function stripSurroundingQuotes(s: string): string {
  const t = s.trim();
  if (t.length >= 2) {
    const f = t[0];
    const l = t[t.length - 1];
    if ((f === '"' && l === '"') || (f === "'" && l === "'")) {
      return t.slice(1, -1);
    }
  }
  return t;
}

// Upstash REST URLs must be lowercase `https://...`; some hosting panels
// upper-case env-var values on paste, which crashes the client at construct
// time. Normalize defensively rather than asking the operator to remember.
function normalizeUpstashUrl(raw: string): string {
  const stripped = stripSurroundingQuotes(raw);
  const m = /^(https?):\/\/(.+)$/i.exec(stripped);
  if (!m) return stripped;
  return `${m[1].toLowerCase()}://${m[2].toLowerCase()}`;
}

let _redis: Redis | null | undefined;
function getRedis(): Redis | null {
  if (_redis !== undefined) return _redis;
  const rawUrl = process.env.UPSTASH_REDIS_REST_URL;
  const rawToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!rawUrl || !rawToken) return (_redis = null);
  try {
    _redis = new Redis({
      url: normalizeUpstashUrl(rawUrl),
      token: stripSurroundingQuotes(rawToken),
    });
  } catch {
    _redis = null;
  }
  return _redis;
}

function inMemoryLimiter(maxRequests: number, windowMs: number): Limiter {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return {
    async limit(key: string) {
      const now = Date.now();
      const cur = buckets.get(key);
      if (!cur || cur.resetAt <= now) {
        const resetAt = now + windowMs;
        buckets.set(key, { count: 1, resetAt });
        return { success: true, reset: resetAt, remaining: maxRequests - 1 };
      }
      if (cur.count >= maxRequests) {
        return { success: false, reset: cur.resetAt, remaining: 0 };
      }
      cur.count++;
      return { success: true, reset: cur.resetAt, remaining: maxRequests - cur.count };
    },
  };
}

function build(name: string, maxReq: number, window: `${number} ${"s" | "m" | "h"}`): Limiter {
  const ms =
    window.endsWith("s")
      ? Number(window.split(" ")[0]) * 1000
      : window.endsWith("m")
      ? Number(window.split(" ")[0]) * 60_000
      : Number(window.split(" ")[0]) * 3_600_000;
  const memory = inMemoryLimiter(maxReq, ms);

  // Lazily resolve Upstash on first call. This keeps module load free of
  // network/URL validation so Next's static-page-data pass can import the
  // route handlers even if env vars are absent or malformed.
  let upstash: Limiter | null = null;
  let resolved = false;
  let warned = false;
  return {
    async limit(key: string) {
      if (!resolved) {
        const redis = getRedis();
        if (redis) {
          upstash = new Ratelimit({
            redis,
            limiter: Ratelimit.slidingWindow(maxReq, window),
            analytics: false,
            prefix: `ratelimit:renisual:${name}`,
          });
        }
        resolved = true;
      }
      if (upstash) {
        try {
          return await upstash.limit(key);
        } catch (err) {
          // Upstash credentials present but invalid (WRONGPASS) or the
          // service is unreachable. Fail-open to in-memory limiting for
          // the rest of this process so we don't drop traffic. Log once
          // so the operator notices but the log isn't spammed.
          if (!warned) {
            warned = true;
            console.warn(
              `[ratelimit:${name}] upstash unavailable, falling back to in-memory:`,
              err
            );
          }
          upstash = null;
        }
      }
      return memory.limit(key);
    },
  };
}

export const renderLimit = build("render", 5, "1 m");
export const apiLimit = build("api", 60, "1 m");
export const formLimit = build("form", 3, "1 h");

export function clientKeyFromRequest(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "anon";
}

export function rateLimitResponse(reset: number) {
  const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
  return new Response(
    JSON.stringify({ error: "rate_limited", retryAfter }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
      },
    }
  );
}
