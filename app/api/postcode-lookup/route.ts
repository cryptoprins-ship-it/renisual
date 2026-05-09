// GET /api/postcode-lookup?postcode=2181CB&huisnummer=75
//
// Server-side proxy for PDOK locatieserver. PDOK does ship CORS headers,
// so a direct browser fetch *should* work — but in practice we see it
// fail behind ad-blockers (uBlock false-positives on .nl gov endpoints),
// corporate proxies, and mobile-carrier DNS that filters foreign-TLD
// API hosts. Routing through our own origin sidesteps all of those.
//
// Output shape is flat: {straat, huisnummer, postcode, woonplaats}.

import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

const POSTCODE_RE = /^[1-9][0-9]{3}[A-Z]{2}$/;
const HUISNUMMER_RE = /^[0-9]{1,5}[a-zA-Z]?(-[a-zA-Z0-9]{1,5})?$/;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const postcode = (url.searchParams.get("postcode") ?? "")
    .replace(/\s+/g, "")
    .toUpperCase();
  const huisnummer = (url.searchParams.get("huisnummer") ?? "").trim();

  if (!POSTCODE_RE.test(postcode)) {
    return NextResponse.json({ error: "invalid_postcode" }, { status: 400 });
  }
  if (!HUISNUMMER_RE.test(huisnummer)) {
    return NextResponse.json({ error: "invalid_huisnummer" }, { status: 400 });
  }

  const q = encodeURIComponent(`postcode:${postcode} and huisnummer:${huisnummer}`);
  const upstreamUrl = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${q}&rows=1&fl=straatnaam,woonplaatsnaam,huisnummer,postcode`;

  let res: Response;
  try {
    res = await fetch(upstreamUrl, {
      // BAG postcode data is updated a few times a year. 24h revalidate
      // keeps upstream load tiny and lookups instant after the first hit.
      next: { revalidate: 86400 },
      headers: { "user-agent": "renisual-postcode-lookup/1.0" },
    });
  } catch (err) {
    logger.error({ err, postcode, huisnummer }, "postcode_lookup_network_failed");
    return NextResponse.json({ error: "upstream_unreachable" }, { status: 502 });
  }

  if (!res.ok) {
    logger.warn({ status: res.status, postcode, huisnummer }, "postcode_lookup_upstream_error");
    return NextResponse.json({ error: "lookup_failed" }, { status: 502 });
  }

  type PdokResponse = {
    response?: {
      docs?: Array<{
        straatnaam?: string;
        woonplaatsnaam?: string;
        huisnummer?: number | string;
        postcode?: string;
      }>;
    };
  };
  let data: PdokResponse;
  try {
    data = (await res.json()) as PdokResponse;
  } catch (err) {
    logger.warn({ err, postcode, huisnummer }, "postcode_lookup_bad_payload");
    return NextResponse.json({ error: "bad_payload" }, { status: 502 });
  }

  const doc = data?.response?.docs?.[0];
  if (!doc?.straatnaam || !doc?.woonplaatsnaam) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    straat: doc.straatnaam,
    huisnummer: String(doc.huisnummer ?? huisnummer),
    postcode: doc.postcode ?? postcode,
    woonplaats: doc.woonplaatsnaam,
  });
}
