# Daily 10-credit cap — Design

> Status: design (Spec A). Spec B (Stripe credit packs) is deferred.
> Source brainstorm: 2026-05-10.

## Goal

Stop een gebruiker na 10 Gemini-renders per dag. Reset om 00:00 Europe/Amsterdam. Geen accounts, geen betalingen — pure freemium-cap die past op de bestaande Upstash-infrastructuur. Doel: Gemini-kosten begrenzen + repeat-traffic forceren (ad-revenue + leads).

## Non-goals (deferred to Spec B)

- Betaalde credit-packs (€5/200, €10/500).
- Stripe-integratie, webhook, refund-flow.
- Wallet-koppeling via email/magic-link voor portability tussen apparaten.
- Persistent ledger in Supabase.
- BTW / KOR / OSS afhandeling.

## User-visible behaviour

1. **Eerste bezoek aan `/render`**: counter zichtbaar onder de Render-knop: `10/10 over vandaag` (of de huidige stand). Cookie `__rs_uid` wordt gezet bij eerste GET `/api/credits`.
2. **Klik op Render** terwijl `remaining ≥ 5`: batch van 5 tone-renders gaat normaal door, counter daalt met 5, UI updatet na de batch.
3. **Klik op Render** terwijl `remaining < 5`: knop is disabled. Inline blok onder de knop: *"Je 10 gratis renders voor vandaag zijn op. Morgen om middernacht weer 10."* Met één link: `Vraag offerte aan →` (`/offerte`).
4. **00:00 NL volgende dag**: bij volgende request krijg je vanzelf weer 10 (date-key wisselt).

## Architecture

```
[Browser]  --POST /api/render-->  [Next route]
                                       |
                                       1. read cookie __rs_uid (verify HMAC, generate+sign if absent)
                                       2. read IP via clientKeyFromRequest
                                       3. dateNL = Intl.DateTimeFormat("Europe/Amsterdam") → "YYYY-MM-DD"
                                       4. consumeCredit({ cookie, ip, dateNL })
                                          - Upstash pipeline: INCR credit:cookie:{dateNL}:{cookie}
                                                              INCR credit:ip:{dateNL}:{ip}
                                                              EXPIRE both 36h
                                          - if cookie>10 → return { ok: false, reason: "cookie_cap" }
                                          - if ip>30     → return { ok: false, reason: "ip_cap" }
                                       5. on fail → 402 { error: "credit_cap", reason, remaining: 0, resetAt }
                                       6. on success → existing renderLimit + Gemini call
                                       7. set Set-Cookie header if cookie was newly minted

[Browser]  --GET /api/credits-->  [Next route]
                                       1. read cookie + IP same as above
                                       2. checkCredits → GET (niet INCR) beide keys
                                       3. return { used, remaining, resetAt, cookieIssued: true|false }
                                       4. set Set-Cookie if needed
```

**Storage**: Upstash Redis. Twee keys per user per dag.

| Key | Cap | Doel |
|---|---|---|
| `credit:cookie:{YYYY-MM-DD}:{cookie}` | 10 | Primaire teller per device |
| `credit:ip:{YYYY-MM-DD}:{ip}` | 30 | Spread-block: voorkomt cookie-wissen-en-doorgaan binnen één huishouden |

TTL: 36 uur (dekt 25h DST-dag + marge). Date-suffix verandert om 00:00 NL → automatisch verse teller, geen cron nodig.

**Identity**:
- Cookie `__rs_uid` is `{16-byte hex}.{HMAC-SHA256-hex truncated to 16 chars}`, ondertekend met `CREDIT_COOKIE_SECRET`. HMAC voorkomt forgery — verzonnen cookies worden afgewezen en behandeld als "geen cookie".
- HttpOnly, Secure (alleen prod), SameSite=Lax, Path=/, Max-Age=1 jaar.
- Als cookie afwezig of ongeldig: `consumeCredit` valt terug op alleen IP-cap. Bij volgende write-pad (POST /api/render of GET /api/credits) wordt een verse cookie gezet.

**Reset behavior**: niet expliciet — de date-suffix in de key verandert om middernacht NL, dus de oude key wordt simpelweg niet meer gelezen. TTL ruimt hem op.

## Components

### Nieuw: `lib/credits.ts`

```ts
// Geen volledige implementatie hier — alleen de exports en hun contract.

export type UserKey = {
  cookie: string | null;   // null als cookie afwezig of HMAC-fail
  ip: string;
};

export type CreditCheck = {
  used: number;
  remaining: number;
  resetAt: string;         // ISO 8601, "2026-05-11T00:00:00+02:00"
};

export type CreditConsumeResult =
  | { ok: true; remaining: number; resetAt: string }
  | { ok: false; reason: "cookie_cap" | "ip_cap"; remaining: 0; resetAt: string };

export const COOKIE_NAME = "__rs_uid";
export const COOKIE_CAP = 10;
export const IP_CAP = 30;

export function getUserKey(req: Request): UserKey;
export function nextRotationCookie(): { name: string; value: string; options: CookieSerializeOptions };
export function dateNL(now?: Date): string;       // "YYYY-MM-DD" in Europe/Amsterdam
export function nextResetISO(now?: Date): string; // ISO of next 00:00 Europe/Amsterdam
export async function checkCredits(userKey: UserKey): Promise<CreditCheck>;
export async function consumeCredit(userKey: UserKey): Promise<CreditConsumeResult>;
```

**Implementatie-noten**:
- Upstash client komt uit `@upstash/redis` (al gewired in `lib/ratelimit.ts`). Hergebruik dezelfde lazy-init pattern (geen module-load network).
- `consumeCredit` doet één Upstash pipeline: `INCR cookie-key`, `INCR ip-key`, `EXPIRE cookie-key 129600`, `EXPIRE ip-key 129600`. Als cookie null is: alleen IP-key. EXPIRE is idempotent en goedkoop.
- Bij fail-pad: rollback van INCR is niet nodig — counter staat dan op 11 (cookie) of 31 (IP), wat geen kwaad kan; volgende dag reset hem. Cleaner dan een DECR die ook kan falen.
- **Fail-open** bij Upstash error: log warning, return `{ ok: true, remaining: -1, resetAt }`. Past bij hoe `lib/ratelimit.ts` al werkt. `remaining: -1` signalleert UI "onbekend" (toon dan geen counter).

### Nieuw: `app/api/credits/route.ts`

GET-only endpoint, geen body. Returns:

```ts
type CreditsResponse = {
  used: number;
  remaining: number;
  resetAt: string;
};
```

Past `apiLimit` (60/min) toe op IP. Set Set-Cookie als cookie ontbrak. `Cache-Control: no-store` (counter mag nooit gecached).

### Modify: `app/api/render/route.ts`

Voor de bestaande `renderLimit.limit(ip)` block (regel ~887): roep `consumeCredit(getUserKey(request))` aan. Bij `ok: false` return 402 met:

```ts
{ error: "credit_cap", reason: "cookie_cap" | "ip_cap", remaining: 0, resetAt: "ISO" }
```

Set Set-Cookie header als de cookie nieuw is. Bestaande burst-rate-limit en Gemini-call ongewijzigd erna.

**Volgorde rationale**: credit-check eerst, dan burst-check. Logisch: een 402 (op-credit) is informatiever dan een 429 (te snel) — als je sowieso geen credits meer hebt, hoef je geen burst-check te doen.

### Modify: `app/render/page.tsx`

**State toevoegen**:
```ts
const [credits, setCredits] = useState<{ used: number; remaining: number; resetAt: string } | null>(null);
```

**Mount effect**: `fetch("/api/credits")` → setCredits. Bij failure: laat null staan (UI toont geen counter).

**Na elke batch**: opnieuw fetchen — server is source of truth.

**Counter UI** (nieuwe component `components/render/CreditCounter.tsx`):
- Toont `{remaining}/10 over vandaag` in mono-uppercase, klein, naast de Render-knop.
- Bij `remaining < 5`: tekst wordt accent-rood-ish (gebruik bestaande `text-red-900` uit `VariantSlot`).
- Bij `credits === null`: render niets.

**Wall UI** (nieuwe component `components/render/CreditWallNotice.tsx`):
- Mount conditie: `credits && credits.remaining < 5`.
- Tekst: *"Je 10 gratis renders voor vandaag zijn op. Morgen om middernacht weer 10."*
- Eén subtiele link onder de tekst: `Vraag offerte aan →` (`/offerte`).
- Render-knop binnen `<button disabled={credits.remaining < 5}>` zodat klikken onmogelijk is.

**402-handler in `runRenderBatch`**: catch al bestaat (per memory: render-iteration-freeze niet aan tunen). Voor 402-status met `error === "credit_cap"`: set `failedTones` = alle tones, en force-fetch `/api/credits` om de wall te triggeren. De individuele tone-slots tonen dan "Mislukt" — maar dat is een acceptabele edge-case; pre-flight check vangt het normaal af.

### Pre-flight check (kostenbeperking)

Voor de fetches uitgaan, in `runRenderBatch`:
```ts
if (credits && credits.remaining < TONE_BATCH.length) {
  // Trigger wall UI, abort batch
  return;
}
```
Voorkomt dat user 3 succesvolle + 2 gefaalde tones krijgt als ze rond de grens zitten. Defense in depth: server checkt elke individuele call sowieso.

## Env vars

| Naam | Waar | Waarde |
|---|---|---|
| `CREDIT_COOKIE_SECRET` | `.env.local`, Vercel, Hostinger | random 32-byte hex (run `openssl rand -hex 32` of `crypto.randomBytes(32).toString("hex")`) |
| `UPSTASH_REDIS_REST_URL` | bestaand | hergebruikt |
| `UPSTASH_REDIS_REST_TOKEN` | bestaand | hergebruikt |

Als `CREDIT_COOKIE_SECRET` ontbreekt op startup: log error en draai in fail-open mode (alle renders gratis, geen counter UI). Dit voorkomt dat een dev-omgeving zonder secret kapotgaat.

## Edge cases

| Scenario | Gedrag |
|---|---|
| Upstash unreachable | Fail-open, log warning, render gaat door, UI toont geen counter |
| Cookies disabled in browser | Server checkt alleen IP-cap (30/dag). Frontend ontvangt `remaining: -1` van `/api/credits`; counter UI verbergt zich, wall UI toont alleen bij echte 402 vanaf de server. |
| Cookie wissen + opnieuw renderen | Nieuwe cookie, IP-key onveranderd → IP-cap pakt het op de 11e poging |
| User op 7/10, klikt Render (batch=5) | Pre-flight blokkeert, wall UI verschijnt zonder fetch te firen |
| User op 5/10, klikt Render | Batch gaat door, counter naar 0/10, na batch toont wall |
| 5 fetches racen, INCR pipeline atomic | Upstash garandeert atomic INCR; geen overshoot |
| DST-overgang oktober/maart | `Intl.DateTimeFormat("Europe/Amsterdam")` corrigeert; TTL 36h dekt 25h-dag |
| Reset om 00:00 NL terwijl batch draait | Tone-slots die al aan het renderen zijn voltooien op de oude key (counter staat al op 10); volgende klik zit op nieuwe key — gebruiker kan binnen een uur effectief 20 doen. Bewust geaccepteerd. |
| Server-side 500 in `consumeCredit` | Try/catch in render-route, fail-open, log warning |
| Browser-clock drift vs server | Irrelevant; alle berekeningen server-side. UI vertelt server alleen "ik wil renderen" |
| Crawler / bot doet GET /api/credits | Hit `apiLimit` 60/min, daarna 429. Geen credits verbruikt. |

## Verificatie

Geen unit-tests (project heeft geen framework). Per implementation-task gate op:
1. `npx tsc --noEmit`
2. `npm run lint`
3. Handmatige browser-check met concrete checklist
4. Test-agent suite waar zinvol

**Manual checklist** (voor de wall UI task):
- Open `/render` in fresh incognito → counter toont `10/10 over vandaag`.
- Open DevTools Application → Cookies → `__rs_uid` aanwezig, HttpOnly.
- Doe 1 batch (5 tones) → counter `5/10 over vandaag`.
- Doe nog een batch → counter `0/10`, wall verschijnt, Render-knop disabled.
- Klik Render-knop → niets gebeurt (disabled), wall blijft.
- Direct fetch `POST /api/render` via DevTools console → 402 met `{ error: "credit_cap" }`.
- Wis `__rs_uid` cookie, refresh → counter weer `10/10`. Maar: na 4 batches (20 renders via wisseltrucs) hit IP-cap → 402 ongeacht cookie.
- DevTools → set system clock op 00:00 NL volgende dag → refresh → counter weer `10/10` (nieuwe date-key).

**Test-agent**: append twee tests aan `scripts/test-agent/suites/render.ts`:
1. `GET /api/credits returns counter shape`: GET, assert response heeft `used`, `remaining`, `resetAt`.
2. `Counter UI visible on /render`: page.goto `/render`, assert text `over vandaag` zichtbaar.

(Positieve-pad cap-trigger via test-agent vereist 10+ render fetches met echte foto — deferred, te duur in CI.)

**Deploy-volgorde**:
1. Lokaal `npm run dev` → manual checklist.
2. Push naar branch (niet main) → Vercel preview deploy.
3. Manual check op preview URL met een wegwerp-Upstash key (of tijdelijk een dev-namespace).
4. Set env vars op Hostinger via dashboard.
5. Merge naar main → Hostinger 1-2 min deploy window (per memory).

## Self-review notes

**Placeholder scan**: geen TBD's. Wall UI heeft één concrete link (`/offerte`).

**Internal consistency**: cookie cap 10 + IP cap 30 + batch=5 ⇒ 2 batches per cookie/dag, 6 batches per IP/dag. Klopt.

**Scope check**: één spec, één plan. Geen Stripe, geen DB, geen email-magic-link, geen mailing-list. Past in ½ dag werk.

**Ambiguity**: geen open vragen meer.
