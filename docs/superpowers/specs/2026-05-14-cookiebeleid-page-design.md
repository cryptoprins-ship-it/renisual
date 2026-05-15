# Apart cookiebeleid — Design

> Status: design. Source brainstorm: 2026-05-14.

## Goal

Een losse, indexeerbare `/cookiebeleid`-pagina zodat advertentie-/reviewdiensten (AdSense e.d.) een
herkenbare cookie-policy-URL vinden, en zodat het cookie-verhaal niet meer verstopt zit als sub-sectie
van de privacyverklaring. De pagina beschrijft de **huidige, cookieloos-correcte** situatie en benoemt
alvast wat er verandert zodra er wél tracking/ads bijkomen.

## Non-goals

- **Geen consent-banner / CMP.** Alle cookies die Renisual nu zet zijn strikt noodzakelijk of
  functioneel — toestemming is wettelijk niet vereist. Een CMP wordt pas relevant als AdSense (of een
  andere advertentie-/trackingdienst) concreet wordt; dat is een apart traject.
- Geen cookie-instellingen-UI of opt-out-toggle.
- Geen wijziging aan het cookie-gedrag zelf (`__rs_uid`, Supabase-sessie, localStorage blijven zoals ze zijn).

## Achtergrond: wat Renisual nu daadwerkelijk opslaat

Geverifieerd in de codebase op 2026-05-14:

| Wat | Type | Details | Categorie |
|-----|------|---------|-----------|
| `__rs_uid` | First-party cookie | HttpOnly, Path=/, SameSite=Lax, Secure (prod), Max-Age 1 jaar. HMAC-ondertekende anonieme identifier voor de dagelijkse gratis-render-cap (10/dag). Bevat geen PII. Bron: `lib/credits.ts:47`, `app/api/credits/route.ts`. | Strikt noodzakelijk |
| Supabase-sessiecookies (`sb-*`) | First-party cookie | Gezet door `@supabase/ssr` via `proxy.ts` → `utils/supabase/proxy.ts`. Sessie/beveiliging voor de beveiligde API-routes (render, credits, offertes). | Strikt noodzakelijk |
| `localStorage` | Functionele opslag | Taalkeuze en laatst-opgeslagen project. Geen cookie, blijft lokaal in de browser. | Functioneel |
| Plausible Analytics | — | Cookieloos. Zet geen cookies, anonimiseert IP's. Bron: `app/layout.tsx:108`. | n.v.t. |

**Niet aanwezig:** tracking-cookies, advertentiecookies, third-party marketing-pixels.

Gevolg: de bestaande "Cookies"-sectie in `app/privacy/page.tsx` ("alleen functionele opslag
(localStorage)") is onvolledig — `__rs_uid` en de Supabase-cookies worden niet genoemd. Dat wordt
rechtgezet door die sectie te vervangen door een korte verwijzing naar de nieuwe pagina.

## Wijzigingen (4 stuks)

### 1. Nieuwe pagina `app/cookiebeleid/page.tsx`

Server component, identiek template aan `app/privacy/page.tsx` / `app/terms/page.tsx`:
sticky nav met `<Logo variant="horizontal" />`, `<article>` met `max-w-2xl`, gedeelde footer.

- **Metadata**: `title: "Cookiebeleid — Renisual"`, beschrijving, `alternates.canonical:
  "https://renisual.com/cookiebeleid"`, `robots: { index: true, follow: true }`.
- **Constanten**: `LAST_UPDATED = "14 mei 2026"`, `CONTACT_EMAIL = "cryptoprins@gmail.com"`.
- **Secties** (Marcels eerlijke, persoonlijke NL-toon):
  1. **In het kort** — Renisual zet geen tracking- of advertentiecookies. De cookies die er zijn,
     zijn nodig om de site te laten werken.
  2. **Welke cookies we gebruiken** — lijst:
     - `__rs_uid` — onthoudt anoniem hoeveel gratis renders je vandaag gebruikt hebt (cap 10/dag).
       Geen naam, geen e-mail, geen profiel. Vervalt na 1 jaar.
     - Supabase-sessiecookies — houden een veilige sessie in stand zodat renders, credits en
       offertes werken.
  3. **Wat we lokaal in je browser bewaren** — `localStorage` voor taalkeuze en je laatst-opgeslagen
     project. Verlaat je apparaat niet.
  4. **Wat we niet gebruiken** — geen tracking-cookies, geen advertentiecookies, geen marketing-pixels
     van derden. Bezoekstatistieken lopen via Plausible, dat volledig cookieloos werkt.
  5. **Waarom je geen cookie-banner ziet** — alle bovenstaande cookies zijn strikt noodzakelijk of
     functioneel; daarvoor is onder de AVG/ePrivacy geen toestemming vereist.
  6. **Hoe je het beheert** — cookies en localStorage wis je via je browserinstellingen; de site
     blijft werken, je verliest alleen je voorkeuren en je gratis-render-teller reset.
  7. **Als dit verandert** — voegen we ooit advertenties of tracking toe (bijvoorbeeld Google
     AdSense), dan krijg je éérst een toestemmingskeuze te zien en wordt dit beleid bijgewerkt. De
     datum bovenaan verandert dan mee.
  8. **Contact** — e-mail + verwijzing.
- **Cross-link** naar `/privacy` ("Zie ook onze privacyverklaring").

### 2. `app/privacy/page.tsx` — Cookies-sectie inkorten

De bestaande "Cookies"-sectie (regels 131-137) wordt vervangen door één korte alinea die naar
`/cookiebeleid` linkt, zodat de twee pagina's niet uit elkaar lopen en `__rs_uid` op één centrale
plek correct beschreven staat.

### 3. Footer — "Cookies"-link toevoegen

In alle 5 footers die nu Privacy + Voorwaarden bevatten, een `<Link href="/cookiebeleid">Cookies</Link>`
toevoegen naast de bestaande links:
`app/HomeClient.tsx`, `app/about/AboutClient.tsx`, `app/subsidie/SubsidieClient.tsx`,
`app/terms/page.tsx`, `app/privacy/page.tsx`.

### 4. `app/sitemap.ts` — route toevoegen

`{ path: "/cookiebeleid", priority: 0.4 }` toevoegen aan de `routes`-array, naast `/privacy` en
`/terms`.

## Verificatie

- `npx tsc --noEmit` (of de project-build) slaagt.
- `/cookiebeleid` rendert lokaal met dezelfde nav/footer als `/privacy`.
- Footer op home, about, subsidie, terms, privacy toont de nieuwe Cookies-link.
- `/sitemap.xml` bevat de nieuwe URL na build.
- Daarna commit + push (Hostinger-deploy, ~2 min wachten voor oordeel).
