# Daily 10-Credit Cap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land een daily 10-render cap op `/api/render` met midnight-NL reset, counter UI en wall notice op `/render`. Spec B (Stripe credit-packs) is deferred.

**Architecture:** Pure Upstash-Redis cap met date-suffixed keys (`credit:cookie:YYYY-MM-DD:...` cap 10, `credit:ip:YYYY-MM-DD:...` cap 30). Cookie `__rs_uid` HMAC-signed. Server checkt + decrement bij elke render-call; frontend pre-flight check voor batch-fairness. Geen DB, geen Stripe, geen email — alleen Upstash + cookie + UI.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Tailwind 4, Upstash Redis (al gewired). Geen nieuwe dependencies.

**Verification approach:** Geen JS test-framework in dit project. Per task: (a) `npx tsc --noEmit`, (b) `npm run lint`, (c) handmatige curl/browser-check met concrete checklist. Twee test-agent smoke-tests voor de credits-endpoint en counter UI.

**Source spec:** `docs/superpowers/specs/2026-05-10-daily-credit-cap-design.md` — lees dit voordat je begint.

**Rollout order:** Tasks 1 → 10 sequentieel. Elke task eindigt met een werkende app + clean commit. Niet pushen tot Task 10.

---

## File Structure

| File | Status | Verantwoordelijkheid |
|---|---|---|
| `lib/credits.ts` | new | Upstash credit-logic + cookie HMAC + date-NL helpers |
| `app/api/credits/route.ts` | new | GET `/api/credits` → `{used, remaining, resetAt}` |
| `app/api/render/route.ts` | modify | Insert `consumeCredit` voor de bestaande `renderLimit` check |
| `components/render/CreditCounter.tsx` | new | Toont `X/10 over vandaag` badge |
| `components/render/CreditWallNotice.tsx` | new | Toont wall + offerte-CTA als `remaining < 5` |
| `app/render/page.tsx` | modify | State, mount-fetch, post-batch refetch, pre-flight, mount counter+wall |
| `scripts/test-agent/suites/render.ts` | modify | Twee tests toevoegen |
| `.env.local` (lokaal) | modify | `CREDIT_COOKIE_SECRET=<random>` |

---

## Task 1: Add `CREDIT_COOKIE_SECRET` env var

**Files:**
- Modify: `C:\projects\renisual\.env.local`

- [ ] **Step 1: Generate a 32-byte hex secret**

Run in PowerShell:
```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Expected: 64-char hex string. Copy it.

- [ ] **Step 2: Add to `.env.local`**

Open `C:\projects\renisual\.env.local`. Append (replace `<paste-secret-here>` with the value from Step 1):

```
CREDIT_COOKIE_SECRET=<paste-secret-here>
```

- [ ] **Step 3: Verify it loads**

Run:
```powershell
node -e "require('dotenv').config({path:'.env.local'}); console.log(process.env.CREDIT_COOKIE_SECRET?.length)"
```
Expected: `64`. (If `dotenv` isn't installed, skip — Next.js auto-loads `.env.local`. Verify in Task 4 instead.)

- [ ] **Step 4: No commit**

`.env.local` is gitignored — niets te committen.

> **Note voor deploy:** dezelfde secret moet later in Vercel + Hostinger env-vars (Task 10).

---

## Task 2: Skeleton `lib/credits.ts` with types and exports

**Files:**
- Create: `C:\projects\renisual\lib\credits.ts`

- [ ] **Step 1: Create the file**

```ts
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
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no new errors. (Unused-args warnings on the stub functions are acceptable for one commit — we fill them in next.)

- [ ] **Step 4: Commit**

```powershell
git add lib/credits.ts
git commit -F - <<'EOF'
feat(credits): scaffold lib/credits.ts with types and exports

Skeleton voor de daily 10-credit cap. Implementaties komen in volgende
commits. Cookie HMAC + Upstash pipeline + date-NL helpers volgen.
EOF
```

---

## Task 3: Implement `dateNL`, `nextResetISO`, cookie sign/verify, `getUserKey`

**Files:**
- Modify: `C:\projects\renisual\lib\credits.ts`

- [ ] **Step 1: Implement `dateNL` and `nextResetISO`**

In `lib/credits.ts`, replace the `dateNL` and `nextResetISO` stubs with:

```ts
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
```

- [ ] **Step 2: Implement cookie sign + verify (private helpers)**

Add inside `lib/credits.ts`, above the `getUserKey` export:

```ts
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
```

- [ ] **Step 3: Implement `getUserKey`**

Replace the `getUserKey` stub with:

```ts
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
```

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no new errors. The unused-args warnings from Task 2 disappear here.

- [ ] **Step 5: Sanity-test `dateNL` and `nextResetISO`**

Run:
```powershell
node --experimental-strip-types -e "import('./lib/credits.ts').then(m => { console.log('dateNL:', m.dateNL()); console.log('nextResetISO:', m.nextResetISO()); })"
```

Expected output (date will differ, but format is critical):
```
dateNL: 2026-05-10
nextResetISO: 2026-05-10T22:00:00.000Z   (in summer; in winter 23:00)
```

If `--experimental-strip-types` is unsupported on your Node version, skip — we'll verify via the route handler in Task 5.

- [ ] **Step 6: Commit**

```powershell
git add lib/credits.ts
git commit -F - <<'EOF'
feat(credits): add date-NL helpers + HMAC-signed cookie identity

dateNL via Intl.DateTimeFormat (DST-correct), nextResetISO terug-vertaald
naar UTC. Cookie __rs_uid is uid.mac met sha256 HMAC, timingSafeEqual op
verify. Env var case-insensitive gelezen.
EOF
```

---

## Task 4: Implement `checkCredits` and `consumeCredit`

**Files:**
- Modify: `C:\projects\renisual\lib\credits.ts`

- [ ] **Step 1: Add Upstash client (lazy init, mirror of `lib/ratelimit.ts`)**

Add near the top of `lib/credits.ts`, just below the imports:

```ts
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
```

- [ ] **Step 2: Implement `checkCredits`**

Replace the `checkCredits` stub with:

```ts
export async function checkCredits(userKey: UserKey): Promise<CreditCheck> {
  const redis = getRedis();
  const resetAt = nextResetISO();
  if (!redis) {
    // Fail-open: Upstash unavailable, signal "unknown" to the UI.
    return { used: 0, remaining: -1, resetAt };
  }
  const date = dateNL();
  try {
    const reads: Promise<unknown>[] = [redis.get<number>(ipKey(date, userKey.ip))];
    if (userKey.cookie) {
      reads.push(redis.get<number>(cookieKey(date, userKey.cookie)));
    }
    const results = await Promise.all(reads);
    const ipUsed = Number(results[0] ?? 0);
    const cookieUsed = userKey.cookie ? Number(results[1] ?? 0) : null;
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
```

- [ ] **Step 3: Implement `consumeCredit`**

Replace the `consumeCredit` stub with:

```ts
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
      const res = (await pipe.exec()) as [number, unknown, number, unknown];
      const cookieCount = Number(res[0] ?? 0);
      const ipCount = Number(res[2] ?? 0);
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
      const res = (await pipe.exec()) as [number, unknown];
      const ipCount = Number(res[0] ?? 0);
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
```

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 5: Commit**

```powershell
git add lib/credits.ts
git commit -F - <<'EOF'
feat(credits): implement checkCredits + consumeCredit via Upstash

Pipeline INCR + EXPIRE op cookie- en IP-key. Fail-open bij Upstash err
(remaining: -1, signal "unknown" voor UI). Cap-overshoot levert 11/31
op de teller — geen DECR-rollback, volgende dag reset het toch.
EOF
```

---

## Task 5: Add GET `/api/credits/route.ts`

**Files:**
- Create: `C:\projects\renisual\app\api\credits\route.ts`

- [ ] **Step 1: Create the file**

```ts
import { NextResponse } from "next/server";
import {
  checkCredits,
  formatSetCookie,
  getUserKey,
} from "@/lib/credits";
import { apiLimit, clientKeyFromRequest, rateLimitResponse } from "@/lib/ratelimit";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const ip = clientKeyFromRequest(request);
  try {
    const { success, reset } = await apiLimit.limit(ip);
    if (!success) return rateLimitResponse(reset);
  } catch {
    // fail-open op de rate-limit zelf, conform lib/ratelimit pattern
  }

  const { userKey, setCookie } = getUserKey(request);
  const result = await checkCredits(userKey);
  const res = NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
  if (setCookie) {
    res.headers.append(
      "Set-Cookie",
      formatSetCookie(setCookie, process.env.NODE_ENV === "production"),
    );
  }
  return res;
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 3: Manual curl check**

Start dev: `npm run dev` (in a separate terminal).

In another terminal:
```powershell
curl -i -c cookies.txt http://localhost:3000/api/credits
```

Expected:
- HTTP 200
- `Set-Cookie: __rs_uid=...` header
- JSON body: `{"used":0,"remaining":10,"resetAt":"<ISO>"}`

Second call with cookie:
```powershell
curl -i -b cookies.txt http://localhost:3000/api/credits
```

Expected:
- HTTP 200
- No `Set-Cookie` (cookie is reused)
- Same JSON body (geen credit verbruikt — checkCredits is read-only)

If `remaining: -1` returns: Upstash isn't reachable from your local env. That's OK for now — the route works correctly in fail-open mode. We'll verify with real Upstash on preview deploy in Task 10.

- [ ] **Step 4: Commit**

```powershell
git add app/api/credits/route.ts
git commit -F - <<'EOF'
feat(credits): GET /api/credits endpoint

Read-only counter endpoint voor de UI. Set __rs_uid cookie bij eerste
hit. apiLimit (60/min) toegepast tegen counter-spam.
EOF
```

---

## Task 6: Wire `consumeCredit` into POST `/api/render/route.ts`

**Files:**
- Modify: `C:\projects\renisual\app\api\render\route.ts`

- [ ] **Step 1: Add imports**

At the top of `app/api/render/route.ts`, find the existing line:
```ts
import { renderLimit, clientKeyFromRequest, rateLimitResponse } from "@/lib/ratelimit";
```

Add directly below:
```ts
import { consumeCredit, formatSetCookie, getUserKey } from "@/lib/credits";
```

- [ ] **Step 2: Insert credit-check before the existing rate-limit**

Find the existing block (around line 880-894):

```ts
  const ip = clientKeyFromRequest(request);
  // Rate-limiting is best-effort. If the limiter itself throws (e.g.
  // Upstash WRONGPASS, network glitch) we fail-open and serve the render
  // — losing rate-limit enforcement is far less bad than 500'ing every
  // request. The shared lib also catches Upstash throws and falls back
  // to in-memory; this is belt-and-suspenders.
  try {
    const { success, reset } = await renderLimit.limit(ip);
    if (!success) {
      logger.warn({ ip }, "render_rate_limited");
      return rateLimitResponse(reset);
    }
  } catch (err) {
    logger.warn({ err }, "render_ratelimit_failopen");
  }
```

Replace it with (the credit-check goes BEFORE the burst-limit, so a 402 returns even if the burst-bucket is empty):

```ts
  const ip = clientKeyFromRequest(request);

  // Credit cap (10 cookie / 30 IP per dag, midnight-NL reset).
  // Spec: docs/superpowers/specs/2026-05-10-daily-credit-cap-design.md
  const { userKey, setCookie } = getUserKey(request);
  const credit = await consumeCredit(userKey);
  if (!credit.ok) {
    logger.warn({ ip, reason: credit.reason }, "render_credit_cap");
    const body = JSON.stringify({
      error: "credit_cap",
      reason: credit.reason,
      remaining: 0,
      resetAt: credit.resetAt,
    });
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (setCookie) {
      headers["Set-Cookie"] = formatSetCookie(
        setCookie,
        process.env.NODE_ENV === "production",
      );
    }
    return new Response(body, { status: 402, headers });
  }

  // Bestaande burst rate-limit. Best-effort, fail-open.
  try {
    const { success, reset } = await renderLimit.limit(ip);
    if (!success) {
      logger.warn({ ip }, "render_rate_limited");
      return rateLimitResponse(reset);
    }
  } catch (err) {
    logger.warn({ err }, "render_ratelimit_failopen");
  }
```

- [ ] **Step 3: Append `Set-Cookie` to the eventual success response**

Find the line in `app/api/render/route.ts` where the route returns the successful render JSON. Search for `Response.json` returns near the end of the POST handler — there will be one or more "happy-path" returns.

For EACH happy-path `return Response.json(...)` in the POST handler, change from:
```ts
return Response.json({ ... });
```

To:
```ts
const __response = Response.json({ ... });
if (setCookie) {
  __response.headers.append(
    "Set-Cookie",
    formatSetCookie(setCookie, process.env.NODE_ENV === "production"),
  );
}
return __response;
```

> **Hoe te vinden**: `grep -n "return Response.json" app/api/render/route.ts` toont alle plekken. Sla 4xx/5xx error-returns over (alleen happy-path). Als `setCookie` is `null` (gebruikelijk geval), is de extra append een no-op — code blijft veilig.

> Alternative shortcut: als er meerdere happy-path returns zijn en de wijziging te invasief, kun je in plaats daarvan in Step 2 het cookie meteen flushen via een dummy fetch GET `/api/credits` op de client. Maar dat is een extra round-trip. Doe de bovenstaande aanpak.

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 5: Manual cap-trigger test**

Start `npm run dev`. With curl simulate 11 render-attempts (use a small test photo and an existing valid `/api/render` payload — easiest to copy from DevTools Network on a real browser render).

Or simpler: write to Upstash directly. Open `https://console.upstash.com` → your DB → set key `credit:cookie:<today-date>:<some-uid>` to value `10`. Then send a request with cookie `__rs_uid=<some-uid>.<correct-mac>`.

Easiest: just rely on the test-agent + frontend wall-test in Task 9 + 10.

Verify minimum: ONE successful render call still works. Open `/render` in browser, do one render, confirm it succeeds.

- [ ] **Step 6: Commit**

```powershell
git add app/api/render/route.ts
git commit -F - <<'EOF'
feat(render): enforce daily 10-credit cap on /api/render

consumeCredit voor de bestaande burst rate-limit. Bij cap-hit 402 met
{error, reason, resetAt}. Set-Cookie wordt op alle responses meegestuurd
zodat eerste render-call meteen een persistente uid afgeeft.
EOF
```

---

## Task 7: Create `CreditCounter` component

**Files:**
- Create: `C:\projects\renisual\components\render\CreditCounter.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";

type Props = {
  remaining: number | null;  // null = nog niet geladen
  total?: number;
};

export default function CreditCounter({ remaining, total = 10 }: Props) {
  if (remaining === null || remaining < 0) return null;
  const low = remaining < 5;
  return (
    <span
      className={`font-mono text-[10px] uppercase tracking-[0.15em] ${
        low ? "text-red-900" : "text-stone-600"
      }`}
      aria-live="polite"
    >
      {remaining}/{total} over vandaag
    </span>
  );
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 3: Smoke check**

Component is unused at this point — the lint/typecheck verify the file is valid.

- [ ] **Step 4: Commit**

```powershell
git add components/render/CreditCounter.tsx
git commit -F - <<'EOF'
feat(credits): add CreditCounter badge component

Toont X/10 over vandaag in mono-uppercase. Verbergt zich bij remaining
null/-1 (nog niet geladen of cookies disabled). Rood bij < 5.
EOF
```

---

## Task 8: Create `CreditWallNotice` component

**Files:**
- Create: `C:\projects\renisual\components\render\CreditWallNotice.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";

import Link from "next/link";

type Props = {
  remaining: number;
  resetAt: string;
};

function formatResetTime(iso: string): string {
  // "Morgen om middernacht" leest beter dan een datumstring.
  // We nemen aan dat resetAt altijd <= 24h in de toekomst is (per spec).
  return "morgen om middernacht";
}

export default function CreditWallNotice({ remaining, resetAt }: Props) {
  return (
    <div
      className="mt-3 rounded-xl border border-ink bg-stone-50 p-4 text-sm text-ink"
      role="status"
      aria-live="polite"
    >
      <p>
        Je <strong>10 gratis renders</strong> voor vandaag zijn op (
        {remaining}/10 over). {formatResetTime(resetAt).charAt(0).toUpperCase() + formatResetTime(resetAt).slice(1)} weer 10.
      </p>
      <p className="mt-2 text-xs text-stone-600">
        <Link
          href="/offerte"
          className="underline underline-offset-2 hover:text-ink"
        >
          Vraag offerte aan →
        </Link>
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 3: Smoke check**

Component is unused at this point. Lint + typecheck verify validity.

- [ ] **Step 4: Commit**

```powershell
git add components/render/CreditWallNotice.tsx
git commit -F - <<'EOF'
feat(credits): add CreditWallNotice with offerte CTA

Inline blok onder Render-knop bij remaining < 5. Geen modal — past bij
ad-revenue/leads model en is minder pushy. Linkt door naar /offerte.
EOF
```

---

## Task 9: Wire counter + wall + pre-flight into `app/render/page.tsx`

**Files:**
- Modify: `C:\projects\renisual\app\render\page.tsx`

- [ ] **Step 1: Add imports**

Near the existing import block at the top of `app/render/page.tsx`, add:

```tsx
import CreditCounter from "@/components/render/CreditCounter";
import CreditWallNotice from "@/components/render/CreditWallNotice";
```

- [ ] **Step 2: Add state hook**

Inside the page component, near the other `useState` hooks (search for `useState<` to find the existing block), add:

```tsx
const [credits, setCredits] = useState<{
  used: number;
  remaining: number;
  resetAt: string;
} | null>(null);
```

- [ ] **Step 3: Add a `refetchCredits` helper + mount-effect**

Add inside the component, before `runRenderBatch`:

```tsx
const refetchCredits = useCallback(async () => {
  try {
    const res = await fetch("/api/credits", { credentials: "same-origin" });
    if (!res.ok) return;
    const data = (await res.json()) as { used: number; remaining: number; resetAt: string };
    setCredits(data);
  } catch {
    // fail-silent — UI verbergt counter bij credits === null
  }
}, []);

useEffect(() => {
  void refetchCredits();
}, [refetchCredits]);
```

If `useCallback` and `useEffect` aren't already imported, change the React import line:
```tsx
import { useState } from "react";
```
to:
```tsx
import { useCallback, useEffect, useState } from "react";
```

(Or whatever the existing import looks like — add `useCallback` and `useEffect` if missing.)

- [ ] **Step 4: Add pre-flight check in `runRenderBatch`**

Find `runRenderBatch` (search for `async function runRenderBatch` or `const runRenderBatch =`). At the very top of the function body, BEFORE any `setIsGenerating(true)` or other state mutation, insert:

```tsx
const TONE_BATCH_SIZE = 5; // batch fires 5 parallel tone-renders
if (credits && credits.remaining >= 0 && credits.remaining < TONE_BATCH_SIZE) {
  // Wall component takes over; abort silently.
  return;
}
```

> If `TONE_BATCH` already exists as a const in this file (per the previous mobile-UX plan), use `TONE_BATCH.length` instead of the literal `5`.

- [ ] **Step 5: Refetch credits after batch settles**

Find the `finally` block in `runRenderBatch` (the one that does `setIsGenerating(false)`). Append:

```tsx
} finally {
  setIsGenerating(false);
  // ... existing lines (setBatchAbort(null) etc.)
  void refetchCredits();
}
```

- [ ] **Step 6: Handle 402 in fetch error path**

Inside `runOne` (or wherever the `/api/render` fetch result is checked), find the existing non-OK handling. Add a 402 short-circuit. Search for `if (!res.ok)` or similar:

```tsx
if (res.status === 402) {
  // Credit cap — refetch to update UI; this batch is dead.
  void refetchCredits();
  return { ok: false, errorKey: "render.error.credit_cap" };
}
```

Place this BEFORE the generic `!res.ok` handler.

- [ ] **Step 7: Mount `CreditCounter` near the Render button**

Search in `app/render/page.tsx` for the JSX that renders the primary "Render" / "Visualiseer" trigger button. (Look for the button that calls `runRenderBatch` on click — typically a `<button onClick={...}>` or `<button onClick={() => runRenderBatch(...)}>`.)

Directly above or beside that button, add:

```tsx
<div className="mt-2">
  <CreditCounter remaining={credits?.remaining ?? null} />
</div>
```

(Adjust `mt-2` margin to match neighbouring spacing — the goal is "subtle, near the button".)

- [ ] **Step 8: Mount `CreditWallNotice` and disable the button**

In the same JSX block as Step 7:

a. Wrap the Render-button's `disabled` prop:
```tsx
<button
  disabled={
    isGenerating ||
    /* ...existing disabled conditions... */ ||
    (credits !== null && credits.remaining >= 0 && credits.remaining < 5)
  }
  ...
>
```

b. Directly below the button (or wherever inline help-text already sits), add:

```tsx
{credits !== null && credits.remaining >= 0 && credits.remaining < 5 && (
  <CreditWallNotice remaining={credits.remaining} resetAt={credits.resetAt} />
)}
```

- [ ] **Step 9: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 10: Manual verify the full flow**

Start `npm run dev`. Open `http://localhost:3000/render`.

**Fresh-incognito-window checklist:**
1. Counter near Render-button toont `10/10 over vandaag` (of niets als Upstash niet bereikbaar — dat is OK lokaal).
2. DevTools → Application → Cookies → `__rs_uid` aanwezig met HttpOnly flag.
3. Doe 1 batch (klik Render). Na batch-settle: counter daalt naar `5/10 over vandaag`.
4. Doe nog 1 batch. Counter `0/10 over vandaag` (rood). Render-knop disabled. Wall verschijnt onder de knop met "Je 10 gratis renders voor vandaag zijn op."
5. Klik Render-knop → niets gebeurt.
6. DevTools console: `await fetch('/api/render', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }).then(r => r.status)` → expect `402`.
7. Wis `__rs_uid` cookie via DevTools → refresh `/render` → counter weer `10/10`. Doe 2+ batches. Daarna nog een keer cookie wissen + 2 batches. Op de 4e poging: server geeft 402 op IP-cap (30/30).
8. **DST/midnight test (skippable lokaal)**: pas systeemklok aan naar morgen 00:01 → refresh → counter weer 10/10.

> Als counter `10/10` *niet* verschijnt en console toont een Upstash-error: lokaal Upstash-vars ontbreken of zijn ongeldig. Acceptabel — verifieer op preview deploy in Task 10.

- [ ] **Step 11: Commit**

```powershell
git add app/render/page.tsx
git commit -F - <<'EOF'
feat(render): mount credit counter + wall + pre-flight check

Counter bij Render-knop, wall notice bij remaining < 5, knop disabled in
dat geval. Pre-flight blokkeert batch zodat user geen halve set krijgt
als ze rond de grens zitten. 402 in runOne triggert refetch.
EOF
```

---

## Task 10: Test-agent smoke tests + production check + deploy

**Files:**
- Modify: `C:\projects\renisual\scripts\test-agent\suites\render.ts`
- Set env vars on Vercel + Hostinger

- [ ] **Step 1: Append two test-agent smoke tests**

Inside the existing `tests: [...]` array in `scripts/test-agent/suites/render.ts`, append:

```ts
{
  name: "GET /api/credits returns counter shape",
  run: async (page) => {
    const res = await page.request.get(`${config.baseUrl}/api/credits`);
    if (res.status() !== 200) {
      throw new Error(`expected 200, got ${res.status()}`);
    }
    const data = await res.json();
    if (typeof data.used !== "number") throw new Error("missing used");
    if (typeof data.remaining !== "number") throw new Error("missing remaining");
    if (typeof data.resetAt !== "string") throw new Error("missing resetAt");
  },
},
{
  name: "Counter visible on /render",
  run: async (page) => {
    await page.goto(`${config.baseUrl}/render`);
    // Wait for the counter (or its absence in fail-open mode) to settle.
    await page.waitForLoadState("networkidle", { timeout: 10000 });
    // Counter is hidden when Upstash unavailable — accept either:
    //  (a) text "over vandaag" visible, or
    //  (b) /api/credits returned remaining: -1
    const credits = await page.evaluate(() =>
      fetch("/api/credits").then((r) => r.json()),
    );
    if (credits.remaining < 0) {
      // Fail-open mode — counter hidden by design. Pass.
      return;
    }
    const counterText = page.locator('text=/over vandaag/');
    if ((await counterText.count()) === 0) {
      throw new Error("counter not visible despite remaining >= 0");
    }
  },
},
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 3: Run the suite locally**

With `npm run dev` running:
```powershell
npm test -- --suite render
```

Expected: all render-suite tests pass, including the two new ones.

- [ ] **Step 4: Production build sanity-check**

Run: `npm run build`
Expected: build succeeds, no type errors, no failed page generation.

- [ ] **Step 5: Set env var on Vercel**

Open Vercel dashboard → Renisual project → Settings → Environment Variables.

Add:
- Name: `CREDIT_COOKIE_SECRET`
- Value: same 64-char hex from Task 1
- Environments: Production, Preview, Development (all three)

> **Belangrijk**: gebruik DEZELFDE secret in alle drie environments, anders verlopen gebruikerscookies bij elke deploy.

- [ ] **Step 6: Set env var on Hostinger**

Open Hostinger panel → renisual.com → Environment Variables (or `.env` file via SSH).

Add the same `CREDIT_COOKIE_SECRET` value.

- [ ] **Step 7: Commit + push**

```powershell
git add scripts/test-agent/suites/render.ts
git commit -F - <<'EOF'
test(credits): smoke-test /api/credits shape + counter visibility

Twee test-agent tests die ofwel de happy-path checken (counter zichtbaar
bij valide Upstash) of het fail-open pad (geen counter wanneer Upstash
unreachable). Geen 402-trigger test — vereist 11 echte Gemini-calls.
EOF

git push
```

> Per memory: deploy-window 1-2 min op Hostinger waarin alle paden 503 returnen. Wacht 2 min voor je oordeelt of de build is geslaagd.

- [ ] **Step 8: Production verify**

Open `https://renisual.com/render` in een fresh incognito window.

Run through the checklist from Task 9 Step 10 — but on production:
1. Counter `10/10 over vandaag` zichtbaar? Of `null` (Upstash issue)?
2. Cookie `__rs_uid` aanwezig + HttpOnly + Secure?
3. Doe 1 echte render (kost €€ — slechts 1 batch nodig). Counter daalt naar `5/10`?
4. Direct `fetch('/api/render', { method: 'POST', body: '{}' })` van DevTools → status `402` of `400`? (`400` = invalid_input, ook OK; `402` is alleen na 10 valide calls.)

Als alles klopt: klaar.

---

## Closing checks

- [ ] Run de **volledige** test-suite: `npm test`. Expected: all suites pass.
- [ ] `git log --oneline main..HEAD` toont ~9 commits (één per task die code wijzigt). Task 1 en Task 5/6 hadden geen commit (env-only / config).
- [ ] Production smoke check (Task 10 Step 8) is groen.
- [ ] Spec is gerefereerd in elke nieuwe file (zie comment-regels in `lib/credits.ts` en `app/api/render/route.ts`).

## Self-review notes

**Spec coverage:**
- §"User-visible behaviour" 1 → Task 5 (cookie set on first GET) + Task 9 (counter mount)
- §"User-visible behaviour" 2 → Task 6 (server consume) + Task 9 (post-batch refetch)
- §"User-visible behaviour" 3 → Task 8 (wall component) + Task 9 (mount + disable button)
- §"User-visible behaviour" 4 → automatic via date-suffix in keys (Task 4)
- §"Architecture" → Tasks 2/3/4 (lib), Task 5 (GET endpoint), Task 6 (POST integration)
- §"Components — lib/credits.ts" → Tasks 2-4
- §"Components — /api/credits" → Task 5
- §"Components — /api/render" → Task 6
- §"Components — render/page.tsx" → Task 9
- §"Env vars" → Task 1 (lokaal), Task 10 (Vercel + Hostinger)
- §"Edge cases" — Upstash down → Task 4 fail-open. Cookies disabled → Task 3 + Task 4 IP-only path. Cookie wissen → IP-cap pakt het (Task 4). Pre-flight → Task 9 Step 4. Race → Upstash atomic INCR (Task 4). DST → Intl.DateTimeFormat (Task 3). 23:00→00:00 misbruik → bewust geaccepteerd, geen task.
- §"Verificatie" → tsc/lint per task, manual checklist in Task 9, test-agent in Task 10.

**Placeholder scan:** geen TBD's, geen "implement later", geen "similar to Task N". Eén soft punt: Task 6 Step 3 zegt "search for `return Response.json` in de POST handler" — dit is een grep-anchor, geen placeholder, en er staat een fallback-strategie bij.

**Type consistency:**
- `UserKey` (Tasks 2/3/4/5/6) — uniform.
- `CreditCheck { used, remaining, resetAt }` (Tasks 2/4/5/9) — uniform.
- `CreditConsumeResult` discriminated union (Tasks 2/4/6) — uniform.
- `setCookie: SetCookieDirective | null` (Tasks 2/3/5/6) — uniform.
- Cookie name constant `COOKIE_NAME = "__rs_uid"` exported uit lib en gerefereerd in spec — geen string-duplicate.
- `COOKIE_CAP = 10`, `IP_CAP = 30`, `KEY_TTL_SECONDS = 60*60*36` — gedefinieerd in Task 2, hergebruikt in Task 4.
- `TONE_BATCH_SIZE = 5` (Task 9) — als bestaande `TONE_BATCH` array bestaat, gebruik `.length` voor consistentie met de mobile-UX plan.

**Verification deviation from strict TDD**: dit project heeft geen JS unit-test framework. We vervangen "write failing test → implement → green" door `tsc --noEmit` + `npm run lint` + handmatige browser/curl-check + Playwright test-agent waar zinvol. Documented in plan-header.
