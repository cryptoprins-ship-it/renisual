// Daily 10-credit cap, midnight-NL reset, cookie+IP scope.
// Spec: docs/superpowers/specs/2026-05-10-daily-credit-cap-design.md

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { Redis } from "@upstash/redis";

let _redis: Redis | null | undefined;
function getRedis(): Redis | null {
  if (_redis !== undefined) return _redis;
  const rawUrl = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!rawUrl || !token) return (_redis = null);
  try {
    // Same URL normalization as lib/ratelimit.ts — operators sometimes
    // upper-case the protocol on paste.
    const trimmed = rawUrl.trim();
    const m = /^(https?):\/\/(.+)$/i.exec(trimmed);
    const url = m ? `${m[1].toLowerCase()}://${m[2]}` : trimmed;
    _redis = new Redis({ url, token: token.trim() });
  } catch {
    _redis = null;
  }
  return _redis;
}

function cookieKey(date: string, cookie: string): string {
  return `credit:cookie:${date}:${cookie}`;
}
function ipKey(date: string, ip: string): string {
  return `credit:ip:${date}:${ip}`;
}

export const COOKIE_NAME = "__rs_uid";
export const COOKIE_CAP = 10;
export const IP_CAP = 30;
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year
const KEY_TTL_SECONDS = 60 * 60 * 36; // 36h, dekt 25h DST-dag

export type UserKey = {
  cookie: string | null;
  ip: string;
};

export type CreditCheck = {
  used: number;
  remaining: number;
  resetAt: string;
};

export type CreditConsumeResult =
  | { ok: true; remaining: number; resetAt: string }
  | { ok: false; reason: "cookie_cap" | "ip_cap"; remaining: 0; resetAt: string };

export type SetCookieDirective = {
  name: string;
  value: string;
  maxAgeSeconds: number;
};

// === Implementations come in Tasks 3 + 4. ===
export function dateNL(now: Date = new Date()): string {
  // Intl.DateTimeFormat in Europe/Amsterdam respecteert DST automatisch.
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(now); // "YYYY-MM-DD" — en-CA gebruikt ISO-orde
}

export function nextResetISO(now: Date = new Date()): string {
  // Volgende 00:00 in Europe/Amsterdam, terug-vertaald naar UTC ISO.
  const today = dateNL(now);
  // Parse "YYYY-MM-DD" → next day. Date math in UTC, dan offset corrigeren.
  const [y, m, d] = today.split("-").map(Number);
  // Construeer een UTC-tijdstempel voor middernacht Amsterdam-tijd morgen.
  // Approach: probeer 00:00 UTC volgende dag, dan corrigeer met de offset
  // van Amsterdam ten opzichte van UTC op die datum.
  const nextDayUtc = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0));
  // Bepaal Amsterdam-offset op dat moment (in minuten, positief = ten oosten)
  const offsetFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Amsterdam",
    timeZoneName: "shortOffset",
  });
  const parts = offsetFmt.formatToParts(nextDayUtc);
  const tz = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+1";
  // tz format is e.g. "GMT+2" or "GMT+1"
  const match = /GMT([+-])(\d+)(?::(\d+))?/.exec(tz);
  const sign = match?.[1] === "-" ? -1 : 1;
  const hours = match ? Number(match[2]) : 1;
  const mins = match?.[3] ? Number(match[3]) : 0;
  const offsetMs = sign * (hours * 60 + mins) * 60 * 1000;
  // 00:00 Amsterdam = 00:00 UTC - offset
  return new Date(nextDayUtc.getTime() - offsetMs).toISOString();
}

function getCookieSecret(): string | null {
  // Read at call time so tests + dev-without-secret can flip behaviour
  // without rebuilding. Renisual env vars are mixed-case (memory: env_var_casing).
  const v =
    process.env.CREDIT_COOKIE_SECRET ??
    process.env.Credit_Cookie_Secret ??
    process.env.credit_cookie_secret;
  return v && v.length >= 32 ? v : null;
}

function signCookieValue(uid: string, secret: string): string {
  const mac = createHmac("sha256", secret).update(uid).digest("hex").slice(0, 16);
  return `${uid}.${mac}`;
}

function verifyCookieValue(value: string, secret: string): string | null {
  const dot = value.lastIndexOf(".");
  if (dot < 1) return null;
  const uid = value.slice(0, dot);
  const mac = value.slice(dot + 1);
  if (!/^[0-9a-f]{16,}$/i.test(uid) || !/^[0-9a-f]{16}$/i.test(mac)) return null;
  const expected = createHmac("sha256", secret).update(uid).digest("hex").slice(0, 16);
  try {
    const a = Buffer.from(mac, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return null;
    return timingSafeEqual(a, b) ? uid : null;
  } catch {
    return null;
  }
}

function generateUid(): string {
  return randomBytes(16).toString("hex");
}

function readCookieHeader(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${name}=`)) {
      return trimmed.slice(name.length + 1);
    }
  }
  return null;
}

function clientIpFromRequest(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "anon";
}

export function getUserKey(req: Request): { userKey: UserKey; setCookie: SetCookieDirective | null } {
  const ip = clientIpFromRequest(req);
  const secret = getCookieSecret();
  if (!secret) {
    // No secret configured: operate in degraded mode — only IP cap applies.
    return { userKey: { cookie: null, ip }, setCookie: null };
  }
  const raw = readCookieHeader(req, COOKIE_NAME);
  if (raw) {
    const uid = verifyCookieValue(raw, secret);
    if (uid) {
      return { userKey: { cookie: uid, ip }, setCookie: null };
    }
  }
  // Mint a fresh cookie.
  const uid = generateUid();
  const value = signCookieValue(uid, secret);
  return {
    userKey: { cookie: uid, ip },
    setCookie: { name: COOKIE_NAME, value, maxAgeSeconds: COOKIE_MAX_AGE_SECONDS },
  };
}
export async function checkCredits(userKey: UserKey): Promise<CreditCheck> {
  const redis = getRedis();
  const resetAt = nextResetISO();
  if (!redis) {
    // Fail-open: Upstash unavailable, signal "unknown" to the UI.
    return { used: 0, remaining: -1, resetAt };
  }
  const date = dateNL();
  try {
    const pipe = redis.pipeline();
    pipe.get<number>(ipKey(date, userKey.ip));
    if (userKey.cookie) {
      pipe.get<number>(cookieKey(date, userKey.cookie));
    }
    const results = (await pipe.exec()) as unknown[];
    const ipUsed = typeof results[0] === "number" ? results[0] : 0;
    const cookieUsed = userKey.cookie ? (typeof results[1] === "number" ? results[1] : 0) : null;
    if (cookieUsed === null) {
      // Cookies disabled — frontend hides counter via remaining: -1.
      return { used: ipUsed, remaining: -1, resetAt };
    }
    const remaining = Math.max(0, COOKIE_CAP - cookieUsed);
    return { used: cookieUsed, remaining, resetAt };
  } catch (err) {
    console.warn("[credits] checkCredits upstash err — fail-open:", err);
    return { used: 0, remaining: -1, resetAt };
  }
}
export async function consumeCredit(userKey: UserKey): Promise<CreditConsumeResult> {
  const redis = getRedis();
  const resetAt = nextResetISO();
  if (!redis) {
    // Upstash unavailable: fail-open. Spec: liever eens een gratis dag dan 500's.
    return { ok: true, remaining: -1, resetAt };
  }
  const date = dateNL();
  try {
    const ipK = ipKey(date, userKey.ip);
    if (userKey.cookie) {
      const cookieK = cookieKey(date, userKey.cookie);
      // Pipeline: 4 commands atomic-as-batch.
      const pipe = redis.pipeline();
      pipe.incr(cookieK);
      pipe.expire(cookieK, KEY_TTL_SECONDS);
      pipe.incr(ipK);
      pipe.expire(ipK, KEY_TTL_SECONDS);
      const res = (await pipe.exec()) as unknown[];
      const cookieCount = typeof res[0] === "number" ? res[0] : null;
      const ipCount = typeof res[2] === "number" ? res[2] : null;
      if (cookieCount === null || ipCount === null) {
        // Upstash pipeline returned non-number INCR — fail-open per spec.
        console.warn("[credits] pipeline unexpected shape:", res);
        return { ok: true, remaining: -1, resetAt };
      }
      if (cookieCount > COOKIE_CAP) {
        return { ok: false, reason: "cookie_cap", remaining: 0, resetAt };
      }
      if (ipCount > IP_CAP) {
        return { ok: false, reason: "ip_cap", remaining: 0, resetAt };
      }
      return { ok: true, remaining: Math.max(0, COOKIE_CAP - cookieCount), resetAt };
    } else {
      // No cookie: only IP cap.
      const pipe = redis.pipeline();
      pipe.incr(ipK);
      pipe.expire(ipK, KEY_TTL_SECONDS);
      const res = (await pipe.exec()) as unknown[];
      const ipCount = typeof res[0] === "number" ? res[0] : null;
      if (ipCount === null) {
        console.warn("[credits] pipeline unexpected shape:", res);
        return { ok: true, remaining: -1, resetAt };
      }
      if (ipCount > IP_CAP) {
        return { ok: false, reason: "ip_cap", remaining: 0, resetAt };
      }
      return { ok: true, remaining: -1, resetAt };
    }
  } catch (err) {
    console.warn("[credits] consumeCredit upstash err — fail-open:", err);
    return { ok: true, remaining: -1, resetAt };
  }
}
export function formatSetCookie(directive: SetCookieDirective, isProd: boolean): string {
  const parts = [
    `${directive.name}=${directive.value}`,
    "HttpOnly",
    "Path=/",
    `Max-Age=${directive.maxAgeSeconds}`,
    "SameSite=Lax",
  ];
  if (isProd) parts.push("Secure");
  return parts.join("; ");
}
