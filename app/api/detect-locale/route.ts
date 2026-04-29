import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Locale = "nl" | "en" | "de" | "fr" | "es";

function pickClientIp(req: NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const xri = req.headers.get("x-real-ip");
  if (xri) return xri.trim();
  return null;
}

function isPrivateOrLoopback(ip: string): boolean {
  if (!ip) return true;
  if (ip === "::1" || ip === "127.0.0.1") return true;
  if (ip.startsWith("10.") || ip.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  if (ip.toLowerCase().startsWith("fc") || ip.toLowerCase().startsWith("fd")) return true;
  return false;
}

// BE is officially split between Dutch and French; we default to NL because
// renisual.com targets the Dutch-speaking construction market. CH is the
// largest German-speaking economy on the list, so it maps to DE.
function countryToLocale(country: string | null | undefined): Locale {
  switch ((country ?? "").toUpperCase()) {
    case "NL":
    case "BE":
      return "nl";
    case "DE":
    case "AT":
    case "CH":
      return "de";
    case "FR":
    case "LU":
      return "fr";
    case "ES":
    case "MX":
    case "AR":
    case "CO":
      return "es";
    default:
      return "en";
  }
}

export async function GET(req: NextRequest) {
  const ip = pickClientIp(req);
  let country: string | null = null;
  let lookupError: string | null = null;

  if (ip && !isPrivateOrLoopback(ip)) {
    try {
      const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
        headers: { "User-Agent": "renisual-locale/1.0" },
        signal: AbortSignal.timeout(2500),
      });
      if (res.ok) {
        const data = (await res.json()) as { country_code?: string; country?: string };
        country = data.country_code ?? data.country ?? null;
      } else {
        lookupError = `ipapi ${res.status}`;
      }
    } catch (e) {
      lookupError = e instanceof Error ? e.message : "lookup failed";
    }
  }

  const locale = countryToLocale(country);

  return NextResponse.json(
    { locale, country, ip, ...(lookupError ? { error: lookupError } : {}) },
    {
      headers: {
        // Per-visitor cache: each browser caches its own result for a day.
        // `private` keeps shared CDNs from serving one visitor's lookup to another.
        "Cache-Control": "private, max-age=86400",
      },
    }
  );
}
