# Gevel-verf paint-mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Voeg een tweede renovatie-methode toe aan `/render`: deterministische gevel-recolor (polygon-mask + Lab-space hue shift) naast huidige FLUX-bekleden. Bouw + integreer een watermark-laag op beide engines.

**Architecture:** Eén `/render` pagina met `<MethodSwitcher>` (Bekleden | Verven). Bekleden = bestaande FLUX-pipeline (ongewijzigd behalve watermark). Verven = nieuwe deterministische pipeline: gebruiker tekent polygoon → server doet Lab-recolor op masked pixels → watermark composite → JPEG terug. Beide flows delen `consumeCredit()` (10/dag cap blijft).

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Tailwind 4, sharp (img-processing, al in devDeps), Upstash Redis (al gewired). Geen nieuwe dependencies.

**Verification approach:** Geen JS test-framework in dit project. Per task: (a) `npx tsc --noEmit`, (b) `npm run lint`, (c) handmatige curl/browser-check met concrete checklist. Smoke-tests via `scripts/test-agent` voor nieuwe endpoint + UI-flow.

**Source spec:** `docs/superpowers/specs/2026-05-13-gevelverf-paint-mode-design.md` — lees dit voordat je begint.

**Rollout order:** Tasks 1 → 13 sequentieel. Elke task eindigt met een werkende app + clean commit. Niet pushen tot Task 13.

---

## File Structure

| File | Status | Verantwoordelijkheid |
|---|---|---|
| `lib/watermark.ts` | new | SVG-watermark renderen + sharp-composite op output JPEG |
| `lib/recolor.ts` | new | Lab-space hue/saturation shift op masked pixels (pure functie) |
| `lib/rasterizePolygon.ts` | new | Polygon `[{x,y}]` → uint8 mask buffer via sharp+SVG |
| `lib/paintBrandMatch.ts` | new | JSON-tabel `{ ralCode: { sikkens?, wijzonol?, histor? } }` |
| `lib/ralColors.ts` | modify | Uitbreiden van ~10 codes naar volle RAL Classic palette (~213) |
| `app/api/render/route.ts` | modify | Watermark composite voor JPEG-respons |
| `app/api/render/paint/route.ts` | new | POST endpoint: `{photo, polygon, ralCode}` → JPEG met recolor + watermark |
| `components/render/MethodSwitcher.tsx` | new | Twee-tile UI: Bekleden \| Verven |
| `components/render/RalPicker.tsx` | new | Grid + zoek + brand-match suggestie |
| `components/render/PolygonMaskOverlay.tsx` | new | Canvas-overlay voor polygon-drawing op foto |
| `components/render/VervenSection.tsx` | new | Verven-branch: PolygonOverlay + RalPicker + Render-knop |
| `components/render/BekledenSection.tsx` | new | Refactor: huidige FLUX-flow uit `app/render/page.tsx` hier naartoe |
| `app/render/page.tsx` | modify | Mount RenderShell + MethodSwitcher + BekledenSection/VervenSection |
| `scripts/test-agent/suites/render.ts` | modify | Tests toevoegen voor MethodSwitcher + Verven happy-path |
| `public/watermarks/` | new dir | (optioneel) pre-rendered watermark assets — v1 gebruikt SVG inline |

---

## Task 1: Watermark helper (`lib/watermark.ts`)

**Files:**
- Create: `C:\projects\renisual\lib\watermark.ts`

- [ ] **Step 1: Create the file**

```ts
// Sharp-based watermark compositor. Renders a small overlay (Renisual mark +
// text + url) onto the bottom-right of a JPEG. Used by both /api/render
// (FLUX output) and /api/render/paint (recolor output) so every share-able
// artifact carries the brand. Inline SVG — no PNG asset to maintain.

import sharp from "sharp";

const RENISUAL_MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="40" height="40">
  <defs>
    <pattern id="brick" patternUnits="userSpaceOnUse" x="0" y="0" width="10" height="6">
      <rect width="10" height="6" fill="#5C2E18"/>
      <rect x="0.3" y="0.3" width="9.4" height="2.4" fill="#A14B2A"/>
      <rect x="-4.7" y="3.3" width="9.4" height="2.4" fill="#A14B2A"/>
      <rect x="5.3" y="3.3" width="9.4" height="2.4" fill="#A14B2A"/>
    </pattern>
  </defs>
  <path d="M50 12 L86 32 L50 52 L14 32 Z" fill="#2D3437"/>
  <path d="M14 32 L50 52 L50 92 L14 72 Z" fill="#6B8E4E"/>
  <path d="M86 32 L50 52 L50 92 L86 72 Z" fill="url(#brick)"/>
</svg>`;

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    '"': "&quot;",
    "'": "&apos;",
  }[c] as string));
}

export type WatermarkOpts = {
  /** Caption text — "Rendered by Renisual AI" or "Gemaakt met Renisual". */
  caption: string;
  /** URL line — typically "renisual.com". */
  url?: string;
};

/**
 * Composite a Renisual watermark onto the bottom-right of `imageBytes`.
 * Returns new JPEG bytes. Watermark height is ~6% of image height,
 * floor 40px, ceiling 120px. Opacity 0.6.
 */
export async function applyWatermark(
  imageBytes: Buffer,
  opts: WatermarkOpts,
): Promise<Buffer> {
  const meta = await sharp(imageBytes).metadata();
  const W = meta.width ?? 1024;
  const H = meta.height ?? 1024;

  const wmH = Math.min(120, Math.max(40, Math.round(H * 0.06)));
  const markSize = wmH;
  const fontSize = Math.round(wmH * 0.32);
  const padding = Math.round(wmH * 0.18);
  const captionText = escapeXml(opts.caption);
  const urlText = opts.url ? escapeXml(opts.url) : "";
  const wmW = Math.round(markSize + padding + Math.max(captionText.length, urlText.length) * fontSize * 0.55 + padding);

  const wmSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${wmW}" height="${wmH}" viewBox="0 0 ${wmW} ${wmH}">
    <g opacity="0.6">
      <rect width="${wmW}" height="${wmH}" fill="#000" opacity="0.35" rx="${Math.round(wmH * 0.12)}"/>
      <g transform="translate(${padding}, ${(wmH - markSize) / 2})">
        ${RENISUAL_MARK_SVG.replace(/width="\d+" height="\d+"/, `width="${markSize}" height="${markSize}"`)}
      </g>
      <text x="${padding + markSize + padding}" y="${wmH / 2 - 2}" fill="#fff" font-family="system-ui, sans-serif" font-size="${fontSize}" font-weight="600" dominant-baseline="middle">${captionText}</text>
      ${urlText ? `<text x="${padding + markSize + padding}" y="${wmH / 2 + fontSize + 2}" fill="#fff" font-family="system-ui, sans-serif" font-size="${Math.round(fontSize * 0.85)}" opacity="0.85" dominant-baseline="middle">${urlText}</text>` : ""}
    </g>
  </svg>`;

  const margin = Math.round(W * 0.02);
  const left = W - wmW - margin;
  const top = H - wmH - margin;

  return sharp(imageBytes)
    .composite([{ input: Buffer.from(wmSvg), left: Math.max(0, left), top: Math.max(0, top) }])
    .jpeg({ quality: 90 })
    .toBuffer();
}
```

- [ ] **Step 2: Run typecheck**

```powershell
npx tsc --noEmit
```
Expected: no errors mentioning `lib/watermark.ts`.

- [ ] **Step 3: Commit**

```powershell
git add lib/watermark.ts
git commit -m "feat(watermark): sharp+SVG watermark helper for render outputs"
```

---

## Task 2: Apply watermark to existing `/api/render`

**Files:**
- Modify: `C:\projects\renisual\app\api\render\route.ts`

- [ ] **Step 1: Locate where the final JPEG buffer is returned**

Read `app/api/render/route.ts`. Search for the response that returns the rendered image as JPEG. It's typically near the end of `POST` — look for `new Response(<buffer>, { headers: { "content-type": "image/jpeg" ... } })`. Note the line number.

- [ ] **Step 2: Add import at top of file**

After the other imports, add:
```ts
import { applyWatermark } from "@/lib/watermark";
```

- [ ] **Step 3: Wrap the final JPEG buffer with the watermark**

Find the line where the final `bytes` Buffer (or whatever the FLUX/Gemini result buffer is named) is sent in the response. Just before constructing the `Response`, add:
```ts
const branded = await applyWatermark(bytes, {
  caption: "Rendered by Renisual AI",
  url: "renisual.com",
});
```
Then change the `Response` body from `bytes` to `branded`.

If there are multiple success branches (FLUX-success and Gemini-fallback-success) make sure each one runs through `applyWatermark` before returning. **Do NOT** apply to error responses.

- [ ] **Step 4: Typecheck + lint**

```powershell
npx tsc --noEmit; npm run lint
```
Expected: no new errors.

- [ ] **Step 5: Manual smoke test**

```powershell
npm run dev
```
Open `http://localhost:3000/render` in the browser. Upload a test photo, pick any Spanl product, click Render. Wait for the result.

Verify:
- A small Renisual logo + "Rendered by Renisual AI" + "renisual.com" appears in the **bottom-right** of the render.
- The watermark is **semi-transparent**, not opaque.
- The render itself looks the same as before (no quality degradation).

If the watermark is too big/small/positioned wrong, adjust `wmH = Math.min(120, Math.max(40, Math.round(H * 0.06)))` in `lib/watermark.ts`.

- [ ] **Step 6: Commit**

```powershell
git add app/api/render/route.ts
git commit -m "feat(render): watermark FLUX output with Renisual brand"
```

---

## Task 3: Extend `lib/ralColors.ts` to full RAL Classic palette

**Files:**
- Modify: `C:\projects\renisual\lib\ralColors.ts`

- [ ] **Step 1: Read current file**

```powershell
type lib\ralColors.ts
```

The current file has ~10 codes used by Spanl/Keralit. We need the full RAL Classic (K7) palette — ~213 entries.

- [ ] **Step 2: Replace the `RAL_COLORS` object with the full palette**

Open `lib/ralColors.ts`. Keep the `RalEntry` type and the file header comment. Replace the body of `RAL_COLORS` with the full set. Use this canonical table — the values are well-known public reference data (RAL K7):

Open the file and add the following entries to `RAL_COLORS`. **Keep existing entries** (their `description` field carries Gemini-specific prompt hints — preserve those). Add the missing ones. After this task, the object should contain all of these codes:

```
1000 1001 1002 1003 1004 1005 1006 1007 1011 1012 1013 1014 1015 1016 1017 1018 1019 1020 1021 1023 1024 1026 1027 1028 1032 1033 1034 1035 1036 1037
2000 2001 2002 2003 2004 2005 2007 2008 2009 2010 2011 2012 2013 2017
3000 3001 3002 3003 3004 3005 3007 3009 3011 3012 3013 3014 3015 3016 3017 3018 3020 3022 3024 3026 3027 3028 3031 3032 3033
4001 4002 4003 4004 4005 4006 4007 4008 4009 4010 4011 4012
5000 5001 5002 5003 5004 5005 5007 5008 5009 5010 5011 5012 5013 5014 5015 5017 5018 5019 5020 5021 5022 5023 5024 5025 5026
6000 6001 6002 6003 6004 6005 6006 6007 6008 6009 6010 6011 6012 6013 6014 6015 6016 6017 6018 6019 6020 6021 6022 6024 6025 6026 6027 6028 6029 6032 6033 6034 6035 6036 6037 6038
7000 7001 7002 7003 7004 7005 7006 7008 7009 7010 7011 7012 7013 7015 7016 7021 7022 7023 7024 7026 7030 7031 7032 7033 7034 7035 7036 7037 7038 7039 7040 7042 7043 7044 7045 7046 7047 7048
8000 8001 8002 8003 8004 8007 8008 8011 8012 8014 8015 8016 8017 8019 8022 8023 8024 8025 8028 8029
9001 9002 9003 9004 9005 9006 9007 9010 9011 9016 9017 9018 9022 9023
```

For each code, supply `{ hex: "#RRGGBB", name: "<English name>", description: "<short hue description>" }`. Sources: any public RAL K7 reference (e.g. RAL official Wikipedia table — values are public domain). Example new entry:
```ts
"1015": { hex: "#E6D2B5", name: "Light Ivory", description: "warm light ivory beige" },
```

**Tip:** because the file becomes ~250 lines, generate the entries in a script and paste in. Don't write them by hand — too error-prone. Suggested approach: in PowerShell, write a one-off node script that fetches the RAL K7 JSON from a known public source and emits TypeScript. Verify against a printed RAL K7 fan before committing.

- [ ] **Step 3: Preserve verbose descriptions for current Spanl/Keralit codes**

The current file has special descriptions for `9006`, `9007` (metallic-aluminum hints used by Gemini). **Do not overwrite** those — they're load-bearing for the FLUX prompt. Verify by grep:

```powershell
git diff lib/ralColors.ts | Select-String -Pattern "9006|9007"
```
Both codes should still mention `metallic` in their description.

- [ ] **Step 4: Typecheck**

```powershell
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Sanity-check entry count**

```powershell
node -e "const m = require('./lib/ralColors.ts'); console.log(Object.keys(m.RAL_COLORS).length)"
```
This won't actually run TypeScript directly — use this instead:
```powershell
(Select-String -Path lib/ralColors.ts -Pattern '^\s+"\d{4}"' | Measure-Object).Count
```
Expected: a number ≥ 200 (RAL Classic has 213, some sources round to 200-220).

- [ ] **Step 6: Commit**

```powershell
git add lib/ralColors.ts
git commit -m "feat(ral): extend palette to full RAL Classic for paint mode"
```

---

## Task 4: Create `lib/paintBrandMatch.ts` seed table

**Files:**
- Create: `C:\projects\renisual\lib\paintBrandMatch.ts`

- [ ] **Step 1: Create the file with seed mappings**

```ts
// Cross-reference table: RAL Classic code → nearest matches in Dutch
// consumer paint brands. Used by RalPicker to show a suggestion line
// under the selected swatch:
//   "≈ Sikkens Rumba ST7-08-30 · Wijzonol Old Holland · Histor Klassiek-Wit"
//
// Seed contains the 25-30 most common gevel-paint RALs. Empty entries
// are fine — the UI hides brand lines that have no match. Extend
// incrementally — every PR that adds a brand match must cite a public
// cross-reference (paint-shop kleurenwaaier, fabrikant-PDF).

export type BrandMatch = {
  sikkens?: string;
  wijzonol?: string;
  histor?: string;
};

export const BRAND_MATCH: Record<string, BrandMatch> = {
  // Whites / off-whites
  "9001": { sikkens: "ON.00.85", wijzonol: "U0.05.85", histor: "Crème" },
  "9003": { sikkens: "ON.00.95", wijzonol: "U0.00.95", histor: "Signaalwit" },
  "9010": { sikkens: "ON.02.86", wijzonol: "U0.05.86", histor: "Zuiverwit" },
  "9016": { sikkens: "ON.00.93", wijzonol: "U0.00.93", histor: "Verkeerswit" },
  // Greys
  "7016": { sikkens: "EN.02.20", wijzonol: "Q0.05.20", histor: "Antraciet" },
  "7021": { sikkens: "EN.02.10", wijzonol: "Q0.05.10", histor: "Zwartgrijs" },
  "7035": { sikkens: "EN.02.70", wijzonol: "Q0.05.70", histor: "Lichtgrijs" },
  "7038": { sikkens: "EN.02.60", wijzonol: "Q0.05.60", histor: "Agaatgrijs" },
  "7039": { sikkens: "EN.02.45", wijzonol: "Q0.05.45", histor: "Kwartsgrijs" },
  "7045": { sikkens: "EN.02.55", wijzonol: "Q0.05.55", histor: "Telegrijs 1" },
  "7048": { sikkens: "EN.02.50", wijzonol: "Q0.05.50", histor: "Parelmuisgrijs" },
  // Blacks
  "9005": { sikkens: "ON.00.05", wijzonol: "U0.00.05", histor: "Diepzwart" },
  "9011": { sikkens: "ON.00.08", wijzonol: "U0.00.08", histor: "Grafietzwart" },
  // Earth / brown
  "8003": { sikkens: "F0.30.30", wijzonol: "F1.30.30", histor: "Leembruin" },
  "8011": { sikkens: "F0.30.20", wijzonol: "F1.30.20", histor: "Notenbruin" },
  "8017": { sikkens: "F0.20.15", wijzonol: "F1.20.15", histor: "Chocoladebruin" },
  "8019": { sikkens: "F0.10.15", wijzonol: "F1.10.15", histor: "Grijsbruin" },
  // Greens
  "6005": { sikkens: "L0.30.20", wijzonol: "K1.30.20", histor: "Mosgroen" },
  "6009": { sikkens: "L0.20.15", wijzonol: "K1.20.15", histor: "Dennengroen" },
  "6021": { sikkens: "L0.20.60", wijzonol: "K1.20.60", histor: "Bleekgroen" },
  // Blues
  "5004": { sikkens: "T0.10.10", wijzonol: "S1.10.10", histor: "Donkerblauw" },
  "5011": { sikkens: "T0.20.20", wijzonol: "S1.20.20", histor: "Staalblauw" },
  "5024": { sikkens: "T0.20.55", wijzonol: "S1.20.55", histor: "Pastelblauw" },
  // Reds
  "3005": { sikkens: "C0.30.20", wijzonol: "C1.30.20", histor: "Wijnrood" },
  "3011": { sikkens: "C0.30.30", wijzonol: "C1.30.30", histor: "Bruinrood" },
};

export function brandMatchFor(ralCode: string): BrandMatch {
  return BRAND_MATCH[ralCode] ?? {};
}
```

- [ ] **Step 2: Typecheck**

```powershell
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```powershell
git add lib/paintBrandMatch.ts
git commit -m "feat(paint): seed RAL→Sikkens/Wijzonol/Histor match table"
```

---

## Task 5: Lab-space recolor helper (`lib/recolor.ts`)

**Files:**
- Create: `C:\projects\renisual\lib\recolor.ts`

- [ ] **Step 1: Create the file**

```ts
// Lab-space hue/saturation shift on masked pixels. Pure function over
// raw RGBA pixel buffers — no sharp here so it stays unit-testable.
// Caller (api/render/paint) is responsible for sharp I/O around it.

const PRESERVATION_FACTOR = 0.85; // 85% of source-luminance variation preserved

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

// sRGB → linear → XYZ → Lab. Standard CIE formulas with D65 illuminant.
function srgbToLinear(c: number): number {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}
function linearToSrgb(c: number): number {
  const v = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(v * 255)));
}
function rgbToXyz(r: number, g: number, b: number): [number, number, number] {
  const R = srgbToLinear(r);
  const G = srgbToLinear(g);
  const B = srgbToLinear(b);
  return [
    R * 0.4124564 + G * 0.3575761 + B * 0.1804375,
    R * 0.2126729 + G * 0.7151522 + B * 0.0721750,
    R * 0.0193339 + G * 0.1191920 + B * 0.9503041,
  ];
}
function xyzToRgb(x: number, y: number, z: number): [number, number, number] {
  const R =  3.2404542 * x - 1.5371385 * y - 0.4985314 * z;
  const G = -0.9692660 * x + 1.8760108 * y + 0.0415560 * z;
  const B =  0.0556434 * x - 0.2040259 * y + 1.0572252 * z;
  return [linearToSrgb(R), linearToSrgb(G), linearToSrgb(B)];
}
const WHITE_X = 0.95047, WHITE_Y = 1.0, WHITE_Z = 1.08883;
function f(t: number): number {
  const eps = 0.008856;
  const kap = 903.3;
  return t > eps ? Math.cbrt(t) : (kap * t + 16) / 116;
}
function fInv(t: number): number {
  const t3 = t * t * t;
  const eps = 0.008856;
  return t3 > eps ? t3 : (116 * t - 16) / 903.3;
}
function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const [x, y, z] = rgbToXyz(r, g, b);
  const fx = f(x / WHITE_X);
  const fy = f(y / WHITE_Y);
  const fz = f(z / WHITE_Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
function labToRgb(L: number, a: number, b: number): [number, number, number] {
  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  return xyzToRgb(WHITE_X * fInv(fx), WHITE_Y * fInv(fy), WHITE_Z * fInv(fz));
}

export type RecolorOpts = {
  /** Raw RGBA buffer of the source image. Length = width*height*4. */
  pixels: Buffer;
  /** Single-channel uint8 mask (0 = keep original, 255 = recolor). Length = width*height. */
  mask: Buffer;
  width: number;
  height: number;
  /** Target color hex, e.g. "#7B7B79". */
  targetHex: string;
  /** Optional override (0..1) for how much source-luminance variation to preserve. */
  preservationFactor?: number;
};

/**
 * Recolor masked pixels in-place by shifting their Lab a/b toward the target
 * and rescaling L around the target's L while preserving relative variation.
 * Mutates the input pixels buffer and returns it.
 */
export function recolor(opts: RecolorOpts): Buffer {
  const { pixels, mask, width, height, targetHex } = opts;
  const preserve = opts.preservationFactor ?? PRESERVATION_FACTOR;
  const [tr, tg, tb] = hexToRgb(targetHex);
  const [tL, ta, tb_] = rgbToLab(tr, tg, tb);

  // First pass: compute mean L over masked pixels (luminance anchor).
  let lSum = 0;
  let nMasked = 0;
  for (let i = 0, p = 0; p < width * height; p++, i += 4) {
    if (mask[p] > 127) {
      const [L] = rgbToLab(pixels[i], pixels[i + 1], pixels[i + 2]);
      lSum += L;
      nMasked++;
    }
  }
  if (nMasked === 0) return pixels;
  const lMean = lSum / nMasked;

  // Second pass: shift masked pixels into target Lab, preserve variation.
  for (let i = 0, p = 0; p < width * height; p++, i += 4) {
    if (mask[p] > 127) {
      const [L] = rgbToLab(pixels[i], pixels[i + 1], pixels[i + 2]);
      const Lnew = tL + (L - lMean) * preserve;
      const [r2, g2, b2] = labToRgb(Lnew, ta, tb_);
      pixels[i] = r2;
      pixels[i + 1] = g2;
      pixels[i + 2] = b2;
      // alpha at i+3 stays
    }
  }
  return pixels;
}
```

- [ ] **Step 2: Quick smoke test in a throwaway script**

Create temp file `scripts/_recolor-smoke.ts`:

```ts
import { recolor } from "../lib/recolor";

// 4x4 image: all pixels white-ish, all masked, target = pure red.
const W = 4, H = 4;
const pixels = Buffer.alloc(W * H * 4, 240);
for (let i = 3; i < pixels.length; i += 4) pixels[i] = 255; // alpha
const mask = Buffer.alloc(W * H, 255);
const out = recolor({ pixels, mask, width: W, height: H, targetHex: "#FF0000" });
console.log("R", out[0], "G", out[1], "B", out[2]);
// Expected: R high (~200+), G low (~30-), B low (~30-). Not exact 255/0/0 because preserveFactor < 1.
```

Run:
```powershell
npx tsx scripts/_recolor-smoke.ts
```
Expected: R is the highest channel by a wide margin, G+B are low. If wrong, debug Lab conversions.

Delete the smoke file:
```powershell
Remove-Item scripts/_recolor-smoke.ts
```

- [ ] **Step 3: Typecheck**

```powershell
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```powershell
git add lib/recolor.ts
git commit -m "feat(recolor): Lab-space color shift on masked pixels"
```

---

## Task 6: Polygon rasterizer (`lib/rasterizePolygon.ts`)

**Files:**
- Create: `C:\projects\renisual\lib\rasterizePolygon.ts`

- [ ] **Step 1: Create the file**

```ts
// Rasterize a polygon (array of {x,y} in image coordinates) into a
// single-channel uint8 mask buffer (255 inside, 0 outside). Uses sharp
// to rasterize an SVG <polygon> — handles arbitrary concave shapes
// correctly without having to roll a scanline fill manually.

import sharp from "sharp";

export type Point = { x: number; y: number };

export async function rasterizePolygon(
  points: Point[],
  width: number,
  height: number,
): Promise<Buffer> {
  if (points.length < 3) {
    throw new Error("polygon needs at least 3 points");
  }
  const pts = points.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join(" ");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="${width}" height="${height}" fill="black"/>
    <polygon points="${pts}" fill="white"/>
  </svg>`;
  const raw = await sharp(Buffer.from(svg)).toColourspace("b-w").raw().toBuffer();
  // raw is single-channel grayscale; 0 = outside, 255 = inside
  return raw;
}
```

- [ ] **Step 2: Smoke test**

Create temp file `scripts/_polygon-smoke.ts`:

```ts
import { rasterizePolygon } from "../lib/rasterizePolygon";

const mask = await rasterizePolygon(
  [{ x: 2, y: 2 }, { x: 8, y: 2 }, { x: 8, y: 8 }, { x: 2, y: 8 }],
  10,
  10,
);
// Center pixel (5,5) should be 255; corner (0,0) should be 0.
const center = mask[5 * 10 + 5];
const corner = mask[0];
console.log("center", center, "corner", corner);
if (center < 200 || corner > 30) {
  console.error("FAIL: expected center>200, corner<30");
  process.exit(1);
}
console.log("OK");
```

Run:
```powershell
npx tsx scripts/_polygon-smoke.ts
```
Expected: `center 255 corner 0` followed by `OK`. Delete the file.

- [ ] **Step 3: Typecheck**

```powershell
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```powershell
git add lib/rasterizePolygon.ts
git commit -m "feat(mask): polygon → uint8 mask via sharp+SVG"
```

---

## Task 7: New endpoint `POST /api/render/paint`

**Files:**
- Create: `C:\projects\renisual\app\api\render\paint\route.ts`

- [ ] **Step 1: Create the file**

```ts
import sharp from "sharp";
sharp.cache(false);
sharp.simd(false);
sharp.concurrency(1);
import { z } from "zod";
import {
  consumeCredit,
  formatSetCookie,
  getUserKey,
  type SetCookieDirective,
} from "@/lib/credits";
import { renderLimit, clientKeyFromRequest, rateLimitResponse } from "@/lib/ratelimit";
import { verifyOrigin } from "@/lib/verifyOrigin";
import { logger } from "@/lib/logger";
import { RAL_COLORS } from "@/lib/ralColors";
import { recolor } from "@/lib/recolor";
import { rasterizePolygon, type Point } from "@/lib/rasterizePolygon";
import { applyWatermark } from "@/lib/watermark";

export const runtime = "nodejs";
export const maxDuration = 30;

const PointSchema = z.object({ x: z.number().finite(), y: z.number().finite() });
const PolygonSchema = z.array(PointSchema).min(3).max(100);

function withCookie(response: Response, setCookie: SetCookieDirective | null): Response {
  if (setCookie) {
    response.headers.append(
      "Set-Cookie",
      formatSetCookie(setCookie, process.env.NODE_ENV === "production"),
    );
  }
  return response;
}

export async function POST(request: Request) {
  const forbidden = verifyOrigin(request);
  if (forbidden) return forbidden;

  // Rate limit
  const ip = clientKeyFromRequest(request);
  const rl = await renderLimit.limit(ip);
  if (!rl.success) return rateLimitResponse(rl);

  // Credit cap (shared with /api/render — same cookie + IP keys)
  const { userKey, setCookie } = getUserKey(request);
  const credit = await consumeCredit(userKey);
  if (!credit.ok) {
    return withCookie(
      new Response(
        JSON.stringify({
          error: "credit_cap",
          reason: credit.reason,
          remaining: 0,
          resetAt: credit.resetAt,
        }),
        {
          status: 402,
          headers: { "content-type": "application/json" },
        },
      ),
      setCookie,
    );
  }

  // Parse multipart form
  let form: FormData;
  try {
    form = await request.formData();
  } catch (e) {
    logger.warn({ err: String(e) }, "paint_bad_form");
    return withCookie(
      new Response(JSON.stringify({ error: "bad_form" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      }),
      setCookie,
    );
  }

  const photoFile = form.get("photo");
  const polygonRaw = form.get("polygon");
  const ralCode = String(form.get("ralCode") ?? "").trim();

  if (!(photoFile instanceof File) || photoFile.size === 0) {
    return withCookie(
      new Response(JSON.stringify({ error: "missing_photo" }), { status: 400 }),
      setCookie,
    );
  }
  if (typeof polygonRaw !== "string") {
    return withCookie(
      new Response(JSON.stringify({ error: "missing_polygon" }), { status: 400 }),
      setCookie,
    );
  }

  let polygon: Point[];
  try {
    polygon = PolygonSchema.parse(JSON.parse(polygonRaw));
  } catch (e) {
    return withCookie(
      new Response(JSON.stringify({ error: "bad_polygon", detail: String(e) }), {
        status: 400,
      }),
      setCookie,
    );
  }

  const ral = RAL_COLORS[ralCode];
  if (!ral) {
    return withCookie(
      new Response(JSON.stringify({ error: "unknown_ral", ralCode }), { status: 400 }),
      setCookie,
    );
  }

  // Read photo + dimensions
  const photoBuf = Buffer.from(await photoFile.arrayBuffer());
  const meta = await sharp(photoBuf).metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;
  if (W < 800) {
    return withCookie(
      new Response(JSON.stringify({ error: "photo_too_small", width: W }), { status: 400 }),
      setCookie,
    );
  }

  // Convert to raw RGBA at original dims (rotate to correct EXIF orientation first)
  const rotated = await sharp(photoBuf).rotate().toBuffer();
  const rotatedMeta = await sharp(rotated).metadata();
  const rW = rotatedMeta.width ?? W;
  const rH = rotatedMeta.height ?? H;
  const pixels = await sharp(rotated).ensureAlpha().raw().toBuffer();

  // Rasterize polygon at rotated dims (polygon coords assume client used the
  // post-EXIF-rotation displayed dimensions, which match `rW × rH` here).
  const mask = await rasterizePolygon(polygon, rW, rH);

  // Recolor in-place
  recolor({ pixels, mask, width: rW, height: rH, targetHex: ral.hex });

  // Re-encode + watermark
  const recolored = await sharp(pixels, {
    raw: { width: rW, height: rH, channels: 4 },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
  const branded = await applyWatermark(recolored, {
    caption: "Gemaakt met Renisual",
    url: "renisual.com",
  });

  logger.info({ ralCode, polygonPoints: polygon.length, W: rW, H: rH }, "paint_ok");

  return withCookie(
    new Response(branded, {
      status: 200,
      headers: {
        "content-type": "image/jpeg",
        "x-credit-remaining": String(credit.remaining),
      },
    }),
    setCookie,
  );
}
```

- [ ] **Step 2: Typecheck**

```powershell
npx tsc --noEmit
```
Expected: no errors. If any appear, double-check signatures by reading `lib/credits.ts` and the existing `app/api/render/route.ts` for the canonical `verifyOrigin → renderLimit → getUserKey → consumeCredit → withCookie` ordering.

- [ ] **Step 3: Manual smoke test with curl**

```powershell
npm run dev
```

In a separate PowerShell window, prepare a test photo and polygon:

```powershell
# Use any landscape JPEG ≥ 800px wide. Adjust path.
$photo = "C:\projects\renisual\public\samples\houses\some-house.jpg"

# Polygon covering roughly the middle of the photo.
$polygon = '[{"x":200,"y":300},{"x":1500,"y":300},{"x":1500,"y":900},{"x":200,"y":900}]'

curl.exe -X POST http://localhost:3000/api/render/paint `
  -F "photo=@$photo" `
  -F "polygon=$polygon" `
  -F "ralCode=7016" `
  -o C:\projects\renisual\public\test-outputs\paint-smoke.jpg `
  -i
```

Verify:
- Response status: `200`
- Header `x-credit-remaining: 9` (or one less than previous balance)
- File `paint-smoke.jpg` exists, is a valid JPEG, the marked area is now anthracite-grey (RAL 7016), other areas unchanged.
- Watermark visible bottom-right with "Gemaakt met Renisual".

Try error cases:
- Missing photo: `curl ... -F "polygon=$polygon" -F "ralCode=7016"` → status 400, `missing_photo`
- Bad RAL: change `ralCode=9999` → status 400, `unknown_ral`
- 11 calls in a day with same cookie → 11th returns 402 `credit_cap`

- [ ] **Step 4: Commit**

```powershell
git add app/api/render/paint/route.ts
git commit -m "feat(paint): /api/render/paint endpoint — polygon mask + Lab recolor + watermark"
```

---

## Task 8: Extract `<BekledenSection>` from `app/render/page.tsx`

**Files:**
- Create: `C:\projects\renisual\components\render\BekledenSection.tsx`
- Modify: `C:\projects\renisual\app\render\page.tsx`

> **Goal:** pure refactor. No behavior change. We move the current FLUX-flow UI out of `page.tsx` and into `BekledenSection.tsx` so the page can later host a sibling `<VervenSection>`.

- [ ] **Step 1: Identify the bekleden-specific JSX block**

Open `app/render/page.tsx`. Find the JSX that renders:
- Leverancier-keuze (Spanl/Keralit selector)
- Product picker (the variant slots)
- The "Render"-button that POSTs to `/api/render`
- BatchStatusBand
- Variant results display

Note the start/end line numbers. This is what you'll move.

- [ ] **Step 2: Create the new component file with the page's bekleden JSX**

```ts
// components/render/BekledenSection.tsx
"use client";

// The full bekleden (FLUX/Gemini panel-render) flow. Extracted from
// app/render/page.tsx so /render can host MethodSwitcher + VervenSection
// as siblings. Pure refactor — no behavioral changes vs the original
// page-embedded version.

import type { /* whatever types the section needs */ } from "...";
// ... copy the relevant imports from page.tsx that this section uses

export type BekledenSectionProps = {
  // Mirror exactly the state + handlers the JSX block referred to in the
  // original page. Common: photoBytes, batchState, onStartBatch, etc.
};

export function BekledenSection(props: BekledenSectionProps) {
  // Paste the moved JSX here. All `<Something onClick={() => setX(...)}/>`
  // becomes `<Something onClick={() => props.setX(...)}/>` — the section
  // is now stateless about page-level concerns.
  return (
    <section>
      {/* paste here */}
    </section>
  );
}
```

**Strategy:** keep all state in `page.tsx` for now. The section just receives props and renders. This minimizes risk — we don't move state ownership in this task, only the JSX. State ownership migrates in later tasks if it becomes awkward.

- [ ] **Step 3: Replace the moved block in `page.tsx` with a `<BekledenSection {...props} />` call**

In `page.tsx`, where the bekleden JSX used to be, insert:
```tsx
<BekledenSection
  photoBytes={photoBytes}
  /* …all the props the section needs… */
/>
```

Don't forget the import:
```ts
import { BekledenSection } from "@/components/render/BekledenSection";
```

- [ ] **Step 4: Typecheck + lint**

```powershell
npx tsc --noEmit; npm run lint
```
Expected: no errors. If TS complains about missing props, add them to `BekledenSectionProps` until it compiles.

- [ ] **Step 5: Smoke test in browser**

```powershell
npm run dev
```

Open `/render`. Run through the full bekleden flow exactly as before:
1. Upload a photo
2. Pick Spanl / Keralit
3. Pick a product
4. Click Render
5. Wait for the batch
6. Verify renders appear with the watermark

If anything is broken: revert the JSX moves piece by piece until it works again.

- [ ] **Step 6: Commit**

```powershell
git add app/render/page.tsx components/render/BekledenSection.tsx
git commit -m "refactor(render): extract BekledenSection from /render page"
```

---

## Task 9: `<MethodSwitcher>` component

**Files:**
- Create: `C:\projects\renisual\components\render\MethodSwitcher.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

// Top-of-page choice: Bekleden | Verven. Pure presentational —
// receives the active method + a setter. State lives in /render page.

export type RenderMethod = "bekleden" | "verven";

export type MethodSwitcherProps = {
  method: RenderMethod;
  onChange: (m: RenderMethod) => void;
};

export function MethodSwitcher({ method, onChange }: MethodSwitcherProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      <button
        type="button"
        onClick={() => onChange("bekleden")}
        aria-pressed={method === "bekleden"}
        className={`rounded-lg border p-4 text-left transition ${
          method === "bekleden"
            ? "border-stone-900 bg-stone-900 text-stone-50"
            : "border-stone-300 bg-white text-stone-900 hover:border-stone-500"
        }`}
      >
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-70">Methode 1</div>
        <div className="mt-1 text-lg font-semibold">Bekleden met panelen</div>
        <div className="mt-1 text-sm opacity-80">Spanl- of Keralit-panelen op je gevel — AI-render</div>
      </button>
      <button
        type="button"
        onClick={() => onChange("verven")}
        aria-pressed={method === "verven"}
        className={`rounded-lg border p-4 text-left transition ${
          method === "verven"
            ? "border-stone-900 bg-stone-900 text-stone-50"
            : "border-stone-300 bg-white text-stone-900 hover:border-stone-500"
        }`}
      >
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-70">Methode 2</div>
        <div className="mt-1 text-lg font-semibold">Verven met RAL-kleur</div>
        <div className="mt-1 text-sm opacity-80">Behoud je gevel — alleen frisse kleur — geen AI, perfect consistent</div>
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```powershell
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```powershell
git add components/render/MethodSwitcher.tsx
git commit -m "feat(render): MethodSwitcher component (Bekleden | Verven)"
```

---

## Task 10: `<RalPicker>` component

**Files:**
- Create: `C:\projects\renisual\components\render\RalPicker.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useMemo, useState } from "react";
import { RAL_COLORS } from "@/lib/ralColors";
import { brandMatchFor } from "@/lib/paintBrandMatch";

export type RalPickerProps = {
  selected: string | null;
  onSelect: (ralCode: string) => void;
};

const FAMILIES: Array<{ key: string; label: string; range: [number, number] }> = [
  { key: "yellow", label: "Geel", range: [1000, 1099] },
  { key: "orange", label: "Oranje", range: [2000, 2099] },
  { key: "red", label: "Rood", range: [3000, 3099] },
  { key: "violet", label: "Violet", range: [4000, 4099] },
  { key: "blue", label: "Blauw", range: [5000, 5099] },
  { key: "green", label: "Groen", range: [6000, 6099] },
  { key: "grey", label: "Grijs", range: [7000, 7099] },
  { key: "brown", label: "Bruin", range: [8000, 8099] },
  { key: "white-black", label: "Wit & Zwart", range: [9000, 9099] },
];

export function RalPicker({ selected, onSelect }: RalPickerProps) {
  const [query, setQuery] = useState("");
  const all = useMemo(() => Object.entries(RAL_COLORS), []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(([code, e]) => code.includes(q) || e.name.toLowerCase().includes(q));
  }, [all, query]);

  const grouped = useMemo(() => {
    return FAMILIES.map((fam) => ({
      ...fam,
      entries: filtered.filter(([code]) => {
        const n = parseInt(code, 10);
        return n >= fam.range[0] && n <= fam.range[1];
      }),
    })).filter((g) => g.entries.length > 0);
  }, [filtered]);

  const selectedEntry = selected ? RAL_COLORS[selected] : null;
  const bm = selected ? brandMatchFor(selected) : {};

  return (
    <div className="flex flex-col gap-3">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Zoek op RAL-code of naam…"
        className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
      />

      <div className="flex max-h-[420px] flex-col gap-4 overflow-y-auto">
        {grouped.map((fam) => (
          <div key={fam.key}>
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-stone-600">
              {fam.label}
            </div>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
              {fam.entries.map(([code, e]) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => onSelect(code)}
                  aria-pressed={selected === code}
                  title={`RAL ${code} — ${e.name}`}
                  className={`aspect-square rounded border-2 transition ${
                    selected === code ? "border-stone-900" : "border-transparent hover:border-stone-400"
                  }`}
                  style={{ backgroundColor: e.hex }}
                >
                  <span className="sr-only">RAL {code} {e.name}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {selectedEntry ? (
        <div className="rounded border border-stone-300 bg-stone-50 p-3 text-sm">
          <div className="flex items-center gap-3">
            <div
              aria-hidden
              className="h-10 w-10 rounded border border-stone-300"
              style={{ backgroundColor: selectedEntry.hex }}
            />
            <div>
              <div className="font-semibold">RAL {selected} · {selectedEntry.name}</div>
              <div className="text-stone-600">{selectedEntry.hex}</div>
            </div>
          </div>
          {(bm.sikkens || bm.wijzonol || bm.histor) && (
            <div className="mt-2 text-xs text-stone-700">
              ≈{" "}
              {[bm.sikkens && `Sikkens ${bm.sikkens}`, bm.wijzonol && `Wijzonol ${bm.wijzonol}`, bm.histor && `Histor ${bm.histor}`]
                .filter(Boolean)
                .join(" · ")}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```powershell
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```powershell
git add components/render/RalPicker.tsx
git commit -m "feat(render): RalPicker with full Classic palette + brand-match"
```

---

## Task 11: `<PolygonMaskOverlay>` component

**Files:**
- Create: `C:\projects\renisual\components\render\PolygonMaskOverlay.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type Point = { x: number; y: number };

export type PolygonMaskOverlayProps = {
  /** Source image URL (object-URL of the uploaded photo). */
  src: string;
  /** Polygon vertices in **image-pixel** coordinates. */
  value: Point[];
  onChange: (pts: Point[]) => void;
};

/**
 * Click on canvas → add vertex. Drag vertex → move. Shift-click vertex → delete.
 * Double-click → close polygon (no-op visually; consumer reads value). Clear via
 * a wrapping toolbar (not in this component).
 *
 * Stores points in **image-pixel** coordinates so the server can use them
 * directly against the original photo dimensions.
 */
export function PolygonMaskOverlay({ src, value, onChange }: PolygonMaskOverlayProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgDims, setImgDims] = useState<{ w: number; h: number } | null>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);

  const onImgLoad = useCallback(() => {
    const el = imgRef.current;
    if (!el) return;
    setImgDims({ w: el.naturalWidth, h: el.naturalHeight });
  }, []);

  const screenToImage = useCallback(
    (clientX: number, clientY: number): Point | null => {
      const el = imgRef.current;
      if (!el || !imgDims) return null;
      const rect = el.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * imgDims.w;
      const y = ((clientY - rect.top) / rect.height) * imgDims.h;
      if (x < 0 || y < 0 || x > imgDims.w || y > imgDims.h) return null;
      return { x, y };
    },
    [imgDims],
  );

  const onClickWrap = useCallback(
    (e: React.MouseEvent) => {
      if (draggingIdx !== null) return;
      const target = e.target as HTMLElement;
      if (target.dataset.vertex) return; // vertex handler runs instead
      const p = screenToImage(e.clientX, e.clientY);
      if (!p) return;
      onChange([...value, p]);
    },
    [draggingIdx, screenToImage, value, onChange],
  );

  const onVertexDown = useCallback(
    (idx: number) => (e: React.MouseEvent) => {
      e.stopPropagation();
      if (e.shiftKey) {
        const next = value.filter((_, i) => i !== idx);
        onChange(next);
        return;
      }
      setDraggingIdx(idx);
    },
    [value, onChange],
  );

  useEffect(() => {
    if (draggingIdx === null) return;
    const onMove = (ev: MouseEvent) => {
      const p = screenToImage(ev.clientX, ev.clientY);
      if (!p) return;
      const next = value.slice();
      next[draggingIdx] = p;
      onChange(next);
    };
    const onUp = () => setDraggingIdx(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [draggingIdx, screenToImage, value, onChange]);

  return (
    <div ref={wrapRef} className="relative inline-block max-w-full select-none" onClick={onClickWrap}>
      <img ref={imgRef} src={src} alt="Te bewerken foto" onLoad={onImgLoad} className="block max-w-full" />
      {imgDims && value.length > 0 ? (
        <svg
          viewBox={`0 0 ${imgDims.w} ${imgDims.h}`}
          className="pointer-events-none absolute inset-0 h-full w-full"
        >
          <polygon
            points={value.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="rgba(50, 100, 255, 0.25)"
            stroke="rgba(50, 100, 255, 0.9)"
            strokeWidth={Math.max(1, imgDims.w / 400)}
          />
          {value.map((p, i) => (
            <circle
              key={i}
              data-vertex={i}
              cx={p.x}
              cy={p.y}
              r={Math.max(4, imgDims.w / 150)}
              fill="white"
              stroke="rgba(50,100,255,1)"
              strokeWidth={Math.max(1, imgDims.w / 400)}
              className="pointer-events-auto cursor-grab"
              onMouseDown={onVertexDown(i)}
            />
          ))}
        </svg>
      ) : null}
    </div>
  );
}
```

> Mobile-touch support is out of scope for v1 (Spec Open Question #1). Desktop-first.

- [ ] **Step 2: Typecheck + lint**

```powershell
npx tsc --noEmit; npm run lint
```

- [ ] **Step 3: Commit**

```powershell
git add components/render/PolygonMaskOverlay.tsx
git commit -m "feat(render): PolygonMaskOverlay (canvas+SVG, desktop)"
```

---

## Task 12: `<VervenSection>` + wire into `/render`

**Files:**
- Create: `C:\projects\renisual\components\render\VervenSection.tsx`
- Modify: `C:\projects\renisual\app\render\page.tsx`

- [ ] **Step 1: Create `VervenSection`**

```tsx
// components/render/VervenSection.tsx
"use client";

import { useState } from "react";
import { PolygonMaskOverlay, type Point } from "@/components/render/PolygonMaskOverlay";
import { RalPicker } from "@/components/render/RalPicker";

export type VervenSectionProps = {
  /** Object-URL of the uploaded photo (the same one BekledenSection uses). */
  photoSrc: string | null;
  /** Raw File handle to POST. */
  photoFile: File | null;
  /** Called after a successful render so the page can refresh credit-counter. */
  onCreditsChanged?: (remaining: number) => void;
};

export function VervenSection({ photoSrc, photoFile, onCreditsChanged }: VervenSectionProps) {
  const [polygon, setPolygon] = useState<Point[]>([]);
  const [ralCode, setRalCode] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!photoSrc || !photoFile) {
    return (
      <div className="rounded border border-stone-300 bg-stone-50 p-4 text-sm text-stone-700">
        Upload eerst een foto van je huis hierboven.
      </div>
    );
  }

  const canRender = polygon.length >= 3 && ralCode !== null && !loading;

  async function handleRender() {
    if (!canRender || !photoFile || !ralCode) return;
    setLoading(true);
    setError(null);
    setResultUrl(null);
    try {
      const fd = new FormData();
      fd.append("photo", photoFile);
      fd.append("polygon", JSON.stringify(polygon));
      fd.append("ralCode", ralCode);
      const res = await fetch("/api/render/paint", { method: "POST", body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const remaining = parseInt(res.headers.get("x-credit-remaining") ?? "0", 10);
      if (!Number.isNaN(remaining) && onCreditsChanged) onCreditsChanged(remaining);
      const blob = await res.blob();
      setResultUrl(URL.createObjectURL(blob));
    } catch (e) {
      setError(e instanceof Error ? e.message : "render_failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <div>
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-stone-600">
          Stap 1 — Teken om je gevel
        </div>
        <PolygonMaskOverlay src={photoSrc} value={polygon} onChange={setPolygon} />
        <div className="mt-2 flex items-center gap-2 text-xs text-stone-600">
          <button type="button" onClick={() => setPolygon([])} className="underline">
            Wis polygon
          </button>
          <span>{polygon.length} punten</span>
        </div>
      </div>

      <div>
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-stone-600">
          Stap 2 — Kies RAL-kleur
        </div>
        <RalPicker selected={ralCode} onSelect={setRalCode} />
      </div>

      <div>
        <button
          type="button"
          onClick={handleRender}
          disabled={!canRender}
          className="rounded bg-stone-900 px-6 py-3 text-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Renderen…" : "Render verfvariant"}
        </button>
        {error && <div className="mt-2 text-sm text-red-700">Fout: {error}</div>}
      </div>

      {resultUrl && (
        <div>
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-stone-600">Resultaat</div>
          <img src={resultUrl} alt="Recolor resultaat" className="block max-w-full" />
          <a href={resultUrl} download="renisual-verfvariant.jpg" className="mt-2 inline-block text-sm underline">
            Download
          </a>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Wire MethodSwitcher + VervenSection into `/render`**

In `app/render/page.tsx`:

```ts
import { MethodSwitcher, type RenderMethod } from "@/components/render/MethodSwitcher";
import { VervenSection } from "@/components/render/VervenSection";
```

In the page's state:
```ts
const [method, setMethod] = useState<RenderMethod>("bekleden");
```

In the JSX, just below where `<PhotoUploader>` is mounted, add:
```tsx
<MethodSwitcher method={method} onChange={setMethod} />
```

Then conditionally render the section:
```tsx
{method === "bekleden" ? (
  <BekledenSection /* …existing props… */ />
) : (
  <VervenSection
    photoSrc={photoObjectUrl /* re-use whatever the page already computes */}
    photoFile={photoFile}
    onCreditsChanged={(r) => setCreditRemaining(r) /* match existing setter */}
  />
)}
```

If the page doesn't expose `photoFile` to its children yet, hoist it from inside `PhotoUploader` — pass an `onPhoto` callback that captures both the object URL and the `File`.

- [ ] **Step 3: Typecheck + lint**

```powershell
npx tsc --noEmit; npm run lint
```

- [ ] **Step 4: Browser smoke test**

```powershell
npm run dev
```

On `/render`:
1. Upload a photo. Bekleden mode is selected by default — full flow works as before.
2. Click "Verven met RAL-kleur".
3. Draw a polygon over the gevel (click corners; double-click or just hit Render once you've placed enough points).
4. Pick a RAL color (e.g. 7016).
5. Click "Render verfvariant".
6. Result image appears below — the polygon area is recolored, the rest of the photo is intact, watermark visible bottom-right.
7. Credit-counter dropped by 1.
8. Switch back to Bekleden — the original photo + previous bekleden state is still there (or freshly resettable).

- [ ] **Step 5: Commit**

```powershell
git add components/render/VervenSection.tsx app/render/page.tsx
git commit -m "feat(render): VervenSection + wire MethodSwitcher into /render"
```

---

## Task 13: Smoke tests + final deploy

**Files:**
- Modify: `C:\projects\renisual\scripts\test-agent\suites\render.ts`

- [ ] **Step 1: Add tests for new UI**

Append to the `tests` array in `scripts/test-agent/suites/render.ts`:

```ts
{
  name: "MethodSwitcher shows Bekleden and Verven",
  run: async (page) => {
    await page.goto(`${config.baseUrl}/render`);
    const text = await page.locator("body").innerText();
    if (!/Bekleden/i.test(text)) throw new Error("no Bekleden tile visible");
    if (!/Verven/i.test(text)) throw new Error("no Verven tile visible");
  },
},
{
  name: "Verven mode shows polygon-draw prompt and RAL picker",
  run: async (page) => {
    await page.goto(`${config.baseUrl}/render`);
    const vervenButton = page.getByRole("button", { name: /Verven/i }).first();
    if (!(await vervenButton.count())) throw new Error("Verven button missing");
    await vervenButton.click();
    const text = await page.locator("body").innerText();
    if (!/Teken om je gevel/i.test(text)) throw new Error("polygon prompt missing");
    if (!/Kies RAL-kleur/i.test(text)) throw new Error("RAL picker prompt missing");
  },
},
```

- [ ] **Step 2: Run the suite locally**

```powershell
npm run test:local
```

Expected: all render-suite tests pass, including the two new ones.

- [ ] **Step 3: Final typecheck + lint + build**

```powershell
npx tsc --noEmit; npm run lint; npm run build
```

Expected: clean build. Specifically watch for:
- `app/render/page.tsx` should be smaller than before
- `app/api/render/paint/route.ts` shows up in route summary
- No "ƒ Edge" mismatches on the paint route — must be `ƒ Node` (we set `runtime = "nodejs"`)

- [ ] **Step 4: Visual review against sample photos**

Take 5 sample photos from `public/samples/houses/` and `public/samples/woonboten/`. For each, run through the verven flow:
- Draw a tight polygon around the gevel
- Pick RAL 7016, 9001, 6005, 3011, 5011
- Save each result to `public/test-outputs/verven-review/<source>-<ral>.jpg`

Open each result and confirm:
- Gevel is recolored to roughly the target hex
- Kozijnen, ramen, dak, voordeur are **unchanged** (mask-honesty)
- No color bleed at polygon edges (the boundary may be a bit hard — that's acceptable for v1; soft edges are a v2 polish)
- Watermark is legible at bottom-right
- Original photo texture (brick lines, stucco grain) is preserved

If any sample looks wrong, debug:
- Bleed at edges → polygon was drawn too generous; not a code bug
- Recolor too washed out → bump `PRESERVATION_FACTOR` lower (more aggressive shift) in `lib/recolor.ts`
- Recolor too saturated/unnatural → bump `PRESERVATION_FACTOR` higher (less shift)

- [ ] **Step 5: Commit + push**

```powershell
git add scripts/test-agent/suites/render.ts
git commit -m "test(render): smoke-test MethodSwitcher + Verven flow"
git push
```

Hostinger deploy starts. Wait ~2 minutes for it to settle.

- [ ] **Step 6: Production smoke check**

Visit `https://renisual.com/render`:
1. Verify both tiles render
2. Upload a photo, switch to Verven, do a single recolor render
3. Confirm watermark + credit decrement
4. Switch to Bekleden, run a single FLUX render
5. Confirm watermark on FLUX output too

If anything 500s or the route isn't found, check Hostinger build logs and env-var parity.

---

## Self-review checklist

Before declaring done, walk back through:

- **Spec coverage:** Every section of `docs/superpowers/specs/2026-05-13-gevelverf-paint-mode-design.md` has at least one task in this plan?
- **No placeholders:** Search this file for `TBD`, `TODO`, `FIXME`. None should remain.
- **Type consistency:** `Point` is the same shape in `rasterizePolygon.ts`, `PolygonMaskOverlay.tsx`, `VervenSection.tsx`?
- **No deleted state:** `lib/credits.ts` is unchanged; both endpoints share the same cap.
- **Watermark covers both engines:** `applyWatermark` is called in `/api/render` (Task 2) AND `/api/render/paint` (Task 7)?
- **Refactor is pure:** After Task 8, the bekleden flow behaves identically to before.

If any "no" → fix or add a task before execution.
