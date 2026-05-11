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
