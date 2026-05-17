// Weekly 10-credit cap, Monday-00:00-NL reset, cookie+IP scope.
// Spec: docs/superpowers/specs/2026-05-10-daily-credit-cap-design.md
// Note: bucket = ISO week ("YYYY-Wnn"), cap-keys live for ~9 days TTL.

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { Redis } from "@upstash/redis";

// Strip a single pair of surrounding double or single quotes. Hostinger's
// env-var UI stores quotes literally when operators paste a `KEY="value"`
// snippet from an Upstash/Stripe dashboard. Without this strip the Redis
// client constructs an invalid URL and all calls silently fail-open.
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

let _redis: Redis | null | undefined;
function getRedis(): Redis | null {
  if (_redis !== undefined) return _redis;
  const rawUrl = process.env.UPSTASH_REDIS_REST_URL;
  const rawToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!rawUrl || !rawToken) return (_redis = null);
  try {
    const stripped = stripSurroundingQuotes(rawUrl);
    const m = /^(https?):\/\/(.+)$/i.exec(stripped);
    const url = m ? `${m[1].toLowerCase()}://${m[2].toLowerCase()}` : stripped;
    _redis = new Redis({ url, token: stripSurroundingQuotes(rawToken) });
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
const KEY_TTL_SECONDS = 60 * 60 * 24 * 9; // 9 dagen, dekt week + DST-buffer

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

// Bucket-key voor weekly cap. ISO 8601-week — maandag = eerste dag, donderdag
// bepaalt het jaar. Format: "YYYY-Wnn" (bv. "2026-W20").
export function weekNL(now: Date = new Date()): string {
  const [y, mo, da] = dateNL(now).split("-").map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, da));
  const dayNum = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - dayNum + 3);
  const isoYear = dt.getUTCFullYear();
  const firstThu = new Date(Date.UTC(isoYear, 0, 4));
  const firstThuOffset = (firstThu.getUTCDay() + 6) % 7;
  firstThu.setUTCDate(firstThu.getUTCDate() - firstThuOffset + 3);
  const weekNum =
    1 + Math.round((dt.getTime() - firstThu.getTime()) / (7 * 86400000));
  return `${isoYear}-W${String(weekNum).padStart(2, "0")}`;
}

function amsterdamOffsetMs(at: Date): number {
  const offsetFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Amsterdam",
    timeZoneName: "shortOffset",
  });
  const parts = offsetFmt.formatToParts(at);
  const tz = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+1";
  const m = tz.match(/GMT([+-])(\d+)(?::(\d+))?/);
  const sign = m?.[1] === "-" ? -1 : 1;
  const hours = m ? Number(m[2]) : 1;
  const mins = m?.[3] ? Number(m[3]) : 0;
  return sign * (hours * 60 + mins) * 60 * 1000;
}

export function nextResetISO(now: Date = new Date()): string {
  // Volgende maandag 00:00 in Europe/Amsterdam → UTC ISO.
  const [y, mo, da] = dateNL(now).split("-").map(Number);
  const todayUtc = new Date(Date.UTC(y, mo - 1, da));
  const day = todayUtc.getUTCDay(); // 0=Sun..6=Sat
  const daysUntilMonday = day === 1 ? 7 : (8 - day) % 7 || 7;
  const nextMonUtc = new Date(
    Date.UTC(y, mo - 1, da + daysUntilMonday, 0, 0, 0),
  );
  return new Date(nextMonUtc.getTime() - amsterdamOffsetMs(nextMonUtc)).toISOString();
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
  const date = weekNL();
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
  const date = weekNL();
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
