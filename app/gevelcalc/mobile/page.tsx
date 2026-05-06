// /gevelcalc/mobile is dead — the responsive /gevelcalc page now serves
// both viewports and the modus is a state-toggle, not a separate route.
// This page does a permanent (301) redirect that preserves any inbound
// query params (e.g. ?modus=snel) so old links keep working.

import { permanentRedirect } from "next/navigation";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function MobileGevelcalcRedirect({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "string") {
      qs.set(k, v);
    } else if (Array.isArray(v) && typeof v[0] === "string") {
      qs.set(k, v[0]);
    }
  }
  const query = qs.toString();
  permanentRedirect(`/gevelcalc${query ? `?${query}` : ""}`);
}
