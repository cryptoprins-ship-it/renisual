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

function buildRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const redis = buildRedis();

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
  if (!redis) {
    const ms =
      window.endsWith("s")
        ? Number(window.split(" ")[0]) * 1000
        : window.endsWith("m")
        ? Number(window.split(" ")[0]) * 60_000
        : Number(window.split(" ")[0]) * 3_600_000;
    return inMemoryLimiter(maxReq, ms);
  }
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(maxReq, window),
    analytics: false,
    prefix: `ratelimit:renisual:${name}`,
  });
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
