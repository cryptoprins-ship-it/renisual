// Daily 10-credit cap, midnight-NL reset, cookie+IP scope.
// Spec: docs/superpowers/specs/2026-05-10-daily-credit-cap-design.md

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { Redis } from "@upstash/redis";

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
export function dateNL(_now?: Date): string {
  throw new Error("not_implemented");
}
export function nextResetISO(_now?: Date): string {
  throw new Error("not_implemented");
}
export function getUserKey(_req: Request): { userKey: UserKey; setCookie: SetCookieDirective | null } {
  throw new Error("not_implemented");
}
export async function checkCredits(_userKey: UserKey): Promise<CreditCheck> {
  throw new Error("not_implemented");
}
export async function consumeCredit(_userKey: UserKey): Promise<CreditConsumeResult> {
  throw new Error("not_implemented");
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
