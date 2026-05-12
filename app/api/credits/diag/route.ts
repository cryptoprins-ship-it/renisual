// Temporary diag — verifies which Upstash env vars the Hostinger runtime
// is actually reading. Returns only lengths + 4-char head/tail so the
// caller can verify "is this the value I just put in hPanel?" without
// leaking the secret. Delete this file once the cap is confirmed working.

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function shape(raw: string | undefined): { len: number; head: string; tail: string; trimmedLen: number } {
  if (!raw) return { len: 0, head: "", tail: "", trimmedLen: 0 };
  const t = raw.trim();
  return {
    len: raw.length,
    trimmedLen: t.length,
    head: t.length >= 4 ? t.slice(0, 4) : t,
    tail: t.length >= 4 ? t.slice(-4) : "",
  };
}

export async function GET() {
  return NextResponse.json(
    {
      url: shape(process.env.UPSTASH_REDIS_REST_URL),
      token: shape(process.env.UPSTASH_REDIS_REST_TOKEN),
      cookieSecretSet: !!process.env.CREDIT_COOKIE_SECRET,
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      nodeEnv: process.env.NODE_ENV,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
