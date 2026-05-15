# Gevel-verf paint-mode — Design

> Status: design.
> Source brainstorm: 2026-05-13.
> Builds on: `/render` (huidig AI-bekleden, FLUX), `lib/credits.ts` (daily credit-cap), `lib/ralColors.ts` (huidige beperkte RAL-set).

## Goal

Voeg een tweede renovatie-methode toe aan `/render`: **gevel-verven** — deterministische recolor van de geselecteerde gevelregio op de gebruikersfoto, naar een gekozen RAL-kleur. Geen AI-render, geen hallucinatie. Eén pagina, twee branches: *Bekleden* (huidig FLUX) of *Verven* (nieuw, polygon-mask + Lab-space recolor).

Doel:
- Tweede renovatie-methode dekken (verven = grotere markt dan bekleden)
- Zero-hallucinatie pad voor gebruikers die "hun eigen huis met frisse kleur" willen zien
- Building-blocks voor toekomstige kozijn/deur-recolor extraheren
- Watermark-laag toevoegen op beide engines voor organische verspreiding

## Non-goals (uit scope, v2 of later)

- Kozijn-recolor en deur-recolor (zelfde engine, andere target — komt nadat verf-engine bewezen werkt)
- Brand-direct paletten (Sikkens / Wijzonol / Histor als primair palet). v1 toont alleen brand-match suggestie naast RAL-keuze
- Auto-mask detectie (SAM, edge-detection). v1 = handmatige polygoon van de gebruiker
- Verf-prijsberekening op `/gevelcalc` (separate scope)
- AI-augmented painting (FLUX inpainting voor textuur-veranderingen)
- Save/share van renders als account-feature

## User-visible behaviour

1. **Land op `/render`** — bestaande URL, geen redirect-breuk.
2. **Header krijgt eerste keuze** (na foto-upload of meteen): twee tiles — `Bekleden met panelen` | `Verven met RAL-kleur`.
3. **Bekleden-flow**: ongewijzigd t.o.v. huidige `/render`. Leverancier-keuze (Spanl/Keralit) → product → kleur → render.
4. **Verven-flow**:
   - Stap 1: upload foto (hergebruikt `PhotoUploader`)
   - Stap 2: teken polygoon om gevel-regio (canvas-overlay, click-to-add-point, dubbelklik om af te sluiten, slepen om punt te verplaatsen)
   - Stap 3: kies RAL-kleur uit volle Classic palet (~213 kleuren); brand-match toont onder selected kleur: `≈ Sikkens Rumba ST7-08-30 · Wijzonol Old Holland · Histor Klassiek-Wit`
   - Stap 4: klik "Render" → server doet Lab-shift + watermark → resultaat verschijnt naast origineel
   - Download-knop + share-naar-offerte-CTA
5. **Credit-counter** (`CreditCounter`) is zichtbaar op beide branches en telt voor beide. `CreditWallNotice` toont bij `remaining = 0` ongeacht welke branch.
6. **Watermark** op output van beide engines:
   - Bekleden → `Rendered by Renisual AI` + logo + `renisual.com`
   - Verven → `Gemaakt met Renisual` + logo + `renisual.com`
   - Subtiel bottom-right, ~6% van afbeeldingshoogte, opacity 0.6

## Architecture

```
/render  (page, refactor)
├─ <RenderShell>            ← shared layout, photo store, credit counter, footer
│  ├─ <PhotoUploader>       ← hergebruikt
│  ├─ <MethodSwitcher>      ← NIEUW — [Bekleden] | [Verven]
│  ├─ <BekledenSection>     ← REFACTOR — alle huidige FLUX-flow naar deze component
│  │   └─ POST /api/render
│  └─ <VervenSection>       ← NIEUW
│      ├─ <PolygonMaskOverlay>
│      ├─ <RalPicker>       ← NIEUW (RAL Classic + brand-match)
│      └─ POST /api/render/paint  ← NIEUW endpoint
│
└─ <CreditCounter>          ← shared, telt voor beide engines
```

**API split:**
- `POST /api/render` — bestaand, FLUX, ongewijzigd (behalve watermark-composite toevoegen)
- `POST /api/render/paint` — nieuw, deterministisch, geen GPU-cost

## Data-flow per branch

### Verven-branch
```
[Browser]
  1. user trekt polygoon op canvas → array van {x, y} in foto-coordinaten
  2. user kiest ralCode (string, e.g. "7016")
  3. POST /api/render/paint multipart-form:
     - photo (File)
     - polygon (JSON: [{x,y}, ...])
     - ralCode (string)

[Server: /api/render/paint]
  1. verifyOrigin()
  2. clientKeyFromRequest() → IP + cookie
  3. consumeCredit({ cookie, ip, dateNL })   ← shared with /api/render
     - on fail: 402 met credit-state
  4. read photo bytes, validate (>800px width, JPEG/PNG/WebP)
  5. parse polygon, validate (≥3 points, all inside image bounds)
  6. rasterize polygon → uint8 mask buffer (sharp.create + composite)
  7. read RAL hex from lib/ralColors.ts (uitgebreid)
  8. apply Lab-space recolor on mask:
     - convert source to Lab
     - target = ralHex converted to Lab
     - blend: for pixels where mask=1, shift a/b/L toward target with preservation of relative luminance
     - convert back to RGB
  9. composite watermark (bottom-right, "Gemaakt met Renisual + url + logo")
  10. return JPEG bytes + Set-Cookie (credits) + headers
```

### Bekleden-branch (ongewijzigd behalve watermark)
```
[Server: /api/render]
  ... bestaande FLUX pipeline ...
  → na succesvolle render:
  + composite watermark ("Rendered by Renisual AI + url + logo")
  → return JPEG
```

## Nieuwe componenten

### `<MethodSwitcher>`
- Locatie: `app/render/components/MethodSwitcher.tsx` (of `components/render/`)
- Twee tiles: Bekleden | Verven, met korte beschrijving en visueel verschil
- Active state via lokale React-state in v1 (URL-param `?method=verven` overweegbaar in v2 zodra analytics deep-linking nodig heeft)

### `<PolygonMaskOverlay>`
- Locatie: `components/render/PolygonMaskOverlay.tsx`
- Canvas-overlay op foto-preview
- Interactions:
  - Click op leeg punt → voeg vertex toe
  - Click op laatste vertex → sluit polygoon
  - Drag vertex → verplaats
  - Click op edge → splits edge (voegt vertex toe op klikpunt)
  - Klik op vertex met shift → verwijder vertex
  - Knop "wis polygoon" → reset
- Visual: semi-transparante fill in polygoon-regio, lijnen + vertex-handles
- Output: array `[{x: number, y: number}]` in **originele foto-coordinaten** (niet display-coords)
- Validatie client-side: ≥3 vertices, niet-zelfsnijdend (best-effort), genoeg oppervlak (~5% van foto)

### `<RalPicker>`
- Locatie: `components/render/RalPicker.tsx`
- Grid-layout van swatch-tiles, gegroepeerd op familie (grijzen / wit-tinten / aarde / kleur-accenten)
- Zoekveld: filter op RAL-code, naam (NL), of brand-match
- Selected state: highlighted tile + side-panel met:
  - RAL-code + NL-naam
  - Hex-waarde
  - Brand-match: `≈ Sikkens Rumba ST7-08-30 · Wijzonol Old Holland · Histor Klassiek-Wit`
- Mobile: bottom-sheet i.p.v. grid
- Output: `ralCode` string (e.g. "7016")

### Bestaande componenten — wijzigingen
- `app/render/page.tsx` — refactor: splitsen in `<RenderShell>` + `<BekledenSection>` + `<VervenSection>`
- `lib/ralColors.ts` — uitbreiden naar volle RAL Classic (~213 codes, names NL, hex)
- `lib/credits.ts` — geen wijziging (al engine-agnostisch)

## Nieuwe data-bestanden

- `lib/ralColors.ts` — uitbreiding van huidige ~10 codes naar volle Classic palette. Bron: openbare RAL-K7 tabel.
- `lib/paintBrandMatch.ts` — NIEUW. JSON-lookup table `{ ralCode: { sikkens?: string; wijzonol?: string; histor?: string } }`. Eerste versie: handmatige seed met 20-30 meest gevraagde RAL-codes. Uitbreiden incrementeel.

## Watermark-laag

Locatie: nieuwe helper `lib/watermark.ts`.

```ts
export async function applyWatermark(
  imageBytes: Buffer,
  text: string,         // e.g. "Rendered by Renisual AI"
): Promise<Buffer>
```

Implementation:
- Sharp composite van pre-rendered watermark-PNG (logo + tekst, transparante achtergrond)
- Positie: bottom-right met margin = 3% van breedte
- Schaal: hoogte = 6% van foto-hoogte (min 40px, max 120px)
- Opacity: 0.6 via `.composite({ ..., blend: 'over' })` met pre-baked alpha

Watermark-PNG's (pre-gerenderd, opgeslagen in `public/watermarks/`):
- `renisual-ai.png` — voor /api/render output
- `renisual-paint.png` — voor /api/render/paint output

## Color-shift algoritme

Pseudocode voor Lab-recolor:

```
For each pixel p in source image:
  if mask[p] == 0: keep original
  if mask[p] == 1:
    (L_src, a_src, b_src) = rgb_to_lab(p)
    (L_tgt, a_tgt, b_tgt) = rgb_to_lab(ralHex)
    # Preserve relative luminance variation within mask
    L_mean_in_mask = mean(L_src over mask pixels)
    L_new = L_tgt + (L_src - L_mean_in_mask) * preservationFactor
    a_new = a_tgt
    b_new = b_tgt
    p_new = lab_to_rgb(L_new, a_new, b_new)
```

`preservationFactor` = 0.85 (behoudt 85% van textuur-variatie, voegt 15% richting target). Tweakable; golden tests definiëren ondergrens.

## Credit-flow integratie

Beide endpoints (`/api/render`, `/api/render/paint`) roepen `consumeCredit()` uit `lib/credits.ts`. Cap = 10/dag/cookie + 30/dag/IP. Eén counter, gedeeld over beide engines. Bij `remaining = 0`: 402 response → UI toont `CreditWallNotice` met offerte-CTA.

Geen wijziging in `lib/credits.ts` zelf — al engine-agnostisch.

## Error-handling

| Fout | UI-respons |
|---|---|
| Foto < 800px breed | Inline blok: "Foto te klein, upload minimum 800px breed" |
| Polygon < 3 vertices | "Teken minstens 3 punten" |
| Polygon zelfsnijdend (best-effort detect) | Warning, sta toe (Lab-shift werkt nog) |
| Polygon < 5% van foto-oppervlak | Warning: "Wel zeker dat dit je gevel is?" (niet blokkerend) |
| RAL-code onbekend | Defensieve fallback naar dichtstbijzijnde hex |
| Server-side recolor faalt | 500 met error-message; UI biedt retry |
| Credit-cap bereikt | 402 + `CreditWallNotice` zoals huidig |

## Testing

### Unit tests
- `lib/watermark.test.ts` — composite output dimensions + position correct
- `lib/recolor.test.ts` — Lab-shift op test-pixel-array → golden snapshot
- `lib/ralColors.test.ts` — alle entries hebben valid hex (regex `^#[0-9A-F]{6}$`) en niet-lege namen
- `lib/paintBrandMatch.test.ts` — alle brand-match entries verwijzen naar bestaande RAL-codes

### Integration tests
- `app/api/render/paint/route.test.ts` — happy path (foto + polygon + RAL → JPEG terug)
- Credit-cap shared: 10 paint-renders → 11e returnt 402
- Credit-cap mixed: 5 FLUX-renders + 5 paint-renders → 11e van beide returnt 402

### Visual / E2E (Playwright)
- Upload sample huis-foto → kies "Verven" → teken polygoon → kies RAL 7016 → download
- Verify: download is JPEG, contains watermark in bottom-right
- 5 sample foto's × 5 RAL-kleuren → handmatig goedkeuren van eerste lichting renders

## Open questions

1. **PolygonMaskOverlay op mobile** — touch-events vs mouse-events. Voorstel: zelfde paradigma (tap = vertex, tap-and-hold = drag). Test in development.
2. **Brand-match-tabel seeding** — wie levert de eerste 20-30 mappings? Voorstel: handmatig, op basis van publiek beschikbare cross-references (RAL-bookjes van schilderbedrijven).
3. **Watermark op mobiele renders** — 40px minimum schaal bij kleine foto's klopt? Test in browser-harness met diverse aspect-ratio's.

## Implementation order (high-level)

Volgorde van werk (detail komt in implementation plan):

1. Watermark-helper + apply op `/api/render` (bestaande FLUX-flow) — bewijst infra, zichtbaar effect, no breaking change
2. Uitbreiden `lib/ralColors.ts` naar volle Classic palette
3. `lib/paintBrandMatch.ts` seed-tabel
4. `lib/recolor.ts` helper + unit-tests met golden snapshots
5. `POST /api/render/paint` endpoint (mock client-side polygon eerst)
6. Refactor `app/render/page.tsx` in `RenderShell` + `BekledenSection` (geen functionele wijziging)
7. `<MethodSwitcher>` component + URL/state wiring
8. `<RalPicker>` component
9. `<PolygonMaskOverlay>` component (desktop-first, mobile-touch in iteratie 2)
10. `<VervenSection>` koppelt alles
11. E2E + visual tests
12. Deploy + monitor
