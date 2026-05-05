import { GoogleGenAI, Modality } from "@google/genai";
import sharp from "sharp";

// Vercel serverless functions reuse warm instances; sharp's libvips cache
// accumulates buffers across invocations and pushes the second/third call
// over the memory ceiling. Disable cache, SIMD, and force single-thread
// concurrency for predictable per-request memory use.
sharp.cache(false);
sharp.simd(false);
sharp.concurrency(1);
import { z } from "zod";
import { renderLimit, clientKeyFromRequest, rateLimitResponse } from "@/lib/ratelimit";
import { verifyOrigin } from "@/lib/verifyOrigin";
import { logger } from "@/lib/logger";
import { createClient } from "@/utils/supabase/server";
import { buildProtectedWallRender } from "@/lib/wallProtect";
import { generateGrooveSvg } from "@/lib/groovePattern";

export const runtime = "nodejs";
export const maxDuration = 60;

type InlinePart = { inlineData: { mimeType: string; data: string } };

type ProductForPrompt = {
  sku: string | null;
  name: string;
  description: string | null;
  ral_code: string | null;
  color_name: string | null;
  color_hex: string | null;
  // Compensated hex used only by the Mono Flat prompt to counteract
  // Gemini's ~15-20% lightening bias. Falls back to color_hex when null.
  color_hex_render?: string | null;
  image_url: string | null;
  // Panel geometry — used by the Mono Flat prompt block to anchor the
  // panel size and joint-spacing language. Optional so legacy / Keralit
  // free-text products without DB rows continue to work.
  panel_length_mm?: number | null;
  panel_work_size_mm?: number | null;
};

type ProductLine = "mono_flat" | "mono_groove" | "mono_textured" | "other";

// Decide which prompt branch applies. Mono Flat is the base treatment;
// Mono Groove and Mono Textured layer their pattern instructions on
// top of that base. Everything else (Strip, Brick, Spanish Tile, Wood,
// Keralit free-text) keeps the legacy buildPrompt until those lines
// get their own targeted prompts.
// Infer product details from a Spanl SKU when Supabase is unavailable.
// Spanl SKU convention: <prefix><RAL code><suffix>:
//   PB     = Mono Flat (smooth, smalle naad)
//   SG     = Mono Groove (3 grooves per panel face)
//   YMPB / YPMB = Mono Flat + Structure (linen wood-grain texture)
//   YMSG   = Mono Groove + Structure (3 grooves + linen texture)
//   TS     = Strip / Mono Textured
// E.g. "PB7038A" → Mono Flat in RAL 7038, "YMSG9005A" → Groove+Structure in RAL 9005.
const RAL_HEX: Record<string, { hex: string; name: string }> = {
  "7038": { hex: "#B5B8B1", name: "agaatgrijs" },
  "7021": { hex: "#23282B", name: "zwartgrijs" },
  "7016": { hex: "#293133", name: "antracietgrijs" },
  "7012": { hex: "#4D5645", name: "bazaltgrijs" },
  // RAL 9003 = signal white, cool/pure. RAL 9010 = pure white, slightly
  // warm. We use a cool pure-white hex for 9003 — the warmer 9010 hex
  // makes klein-9b render beige/cream.
  "9003": { hex: "#F4F4F4", name: "pure cool white" },
  "9010": { hex: "#F1ECE0", name: "wit" },
  "9005": { hex: "#0A0A0A", name: "diepzwart" },
  "9006": { hex: "#A5A8A8", name: "zilver" },
};
function inferProductFromSku(sku: string): ProductForPrompt | null {
  const m = /^(YMSG|YMPB|YPMB|SG|PB|TS)[\s-]?(\d{4})([A-Z0-9-]*)$/i.exec(sku);
  if (!m) return null;
  const prefix = m[1].toUpperCase();
  const ralCode = m[2];
  const ral = RAL_HEX[ralCode] ?? { hex: null, name: null };

  let name = "";
  let description = "";
  if (prefix === "PB") {
    name = `Mono Flat RAL ${ralCode}`;
    description = "Spanl Mono Flat smooth metal cladding panels with smalle naad (narrow same-color hairline seam between panels).";
  } else if (prefix === "SG") {
    name = `Mono Groove RAL ${ralCode}`;
    description = "Spanl Mono Groove metal cladding panels with three decorative grooves cut into each panel face plus a smalle naad between adjacent panels.";
  } else if (prefix === "YMPB" || prefix === "YPMB") {
    name = `Mono Flat + Structure RAL ${ralCode}`;
    description = "Spanl Mono Flat metal cladding panels with embossed linen wood-grain surface texture, smalle naad between panels.";
  } else if (prefix === "YMSG") {
    name = `Mono Groove + Structure RAL ${ralCode}`;
    description = "Spanl Mono Groove metal cladding with three decorative grooves per panel face plus embossed linen wood-grain surface texture.";
  } else if (prefix === "TS") {
    name = `Mono Textured strip RAL ${ralCode}`;
    description = "Spanl strip-style cladding with textured surface.";
  } else {
    return null;
  }

  return {
    sku,
    name,
    description,
    ral_code: ralCode,
    color_name: ral.name,
    color_hex: ral.hex,
    color_hex_render: null,
    image_url: null,
  };
}

function detectLine(product: ProductForPrompt): ProductLine {
  const haystack = `${product.name} ${product.description ?? ""}`.toLowerCase();
  // Check more specific keywords first — "mono groove" must beat "mono flat"
  // for products like "Mono Groove + Structure" where both names could match.
  if (haystack.includes("mono groove")) return "mono_groove";
  if (haystack.includes("mono flat")) return "mono_flat";
  if (haystack.includes("mono textured")) return "mono_textured";
  return "other";
}

// Structure (linen wood-grain embossing) is an ADDITIVE finish that can
// sit on top of either Mono Flat (YMPB / YPMB) or Mono Groove (YMSG).
function detectStructure(product: ProductForPrompt): boolean {
  const haystack = `${product.name} ${product.description ?? ""}`.toLowerCase();
  if (haystack.includes("structure") || haystack.includes("structuur") || haystack.includes("linen")) return true;
  const sku = (product.sku ?? "").toUpperCase();
  return sku.startsWith("YMPB") || sku.startsWith("YPMB") || sku.startsWith("YMSG");
}

// Darken a #RRGGBB hex by `amount` (0..1). Used to pre-compensate the
// BFL prompt for klein-9b's lightening bias on dark/mid colors. White
// targets are skipped entirely — the model has no upper-lightening
// headroom on white, and darkening white turns it into grey/cream.
function darkenHex(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r0 = (n >> 16) & 0xff;
  const g0 = (n >> 8) & 0xff;
  const b0 = n & 0xff;
  // Relative luminance (0..1). Skip compensation entirely on near-white
  // (>0.82) — those don't suffer from the lightening bias and darkening
  // makes them visibly off-white.
  const lum = (0.2126 * r0 + 0.7152 * g0 + 0.0722 * b0) / 255;
  if (lum > 0.82) return hex;
  // Taper compensation on light colors so we don't over-darken pastels.
  const effective = lum > 0.65 ? amount * 0.5 : amount;
  const r = Math.max(0, Math.round(r0 * (1 - effective)));
  const g = Math.max(0, Math.round(g0 * (1 - effective)));
  const b = Math.max(0, Math.round(b0 * (1 - effective)));
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

// Compensation for BFL FLUX.2 klein-9b's midtone darkening bias.
// Playground tests on 2026-05-05 (4-image batches per RAL):
//   RAL 7038 #B5B8B1 → output ~#707378 (~25 RGB too dark, ΔE≈22)
//   RAL 7038 #D0D3CC → output ~#A0A3A0 (close to target)
//   RAL 7021 #2A2D2F → on target without compensation
//   RAL 9005 #0E0E10 → on target without compensation
// So bias is midtone-specific, not universal. Whites untested but
// expected to have a yellow-shift bias (different axis), handled
// separately if/when we add cool-shift. Skips both extremes here.
function lightenHexForBfl(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r0 = (n >> 16) & 0xff;
  const g0 = (n >> 8) & 0xff;
  const b0 = n & 0xff;
  const lum = (0.2126 * r0 + 0.7152 * g0 + 0.0722 * b0) / 255;
  if (lum < 0.20 || lum > 0.85) return hex;
  const effective = lum > 0.75 ? amount * 0.5 : amount;
  const r = Math.min(255, Math.round(r0 + (255 - r0) * effective));
  const g = Math.min(255, Math.round(g0 + (255 - g0) * effective));
  const b = Math.min(255, Math.round(b0 + (255 - b0) * effective));
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

function structureBlock(): string {
  return `STRUCTURE / LINEN TEXTURE (ADDITIVE — overrides "no texture, no wood grain"):
On top of every panel face, render a fine linen wood-grain texture — subtle 3D relief running parallel to the panel direction (top-to-bottom for vertical panels, left-to-right for horizontal). Like brushed wood-grain. The texture is surface detail only — panels remain flat overall, no deep grooves from the texture. The texture catches light differently across each panel, giving a tactile woven appearance. Texture follows each panel face individually — does NOT bleed across panel boundaries or coupling joints.`;
}

// Simpler prompt template for BFL FLUX.2 klein-9b — derived from
// /lab/flux experimentation that produced clean, color-accurate
// output. The elaborate buildMonoFlatPrompt was tuned for Gemini's
// quirks (panel rhythm enforcement, color compensation, etc) and
// confuses klein-9b which is more prompt-faithful by default.
function buildBflPromptText(opts: PromptOptions): string {
  const { product, orientation, facadeWidthMeters, facadeHeightMeters, includeFascia } = opts;
  const widthCm = facadeWidthMeters ? Math.round(facadeWidthMeters * 100) : null;
  const heightCm = facadeHeightMeters ? Math.round(facadeHeightMeters * 100) : null;

  const ralPart = product.ral_code ? `RAL ${product.ral_code}` : "";
  const colorName = product.color_name ?? "matt grey";
  // BFL klein-9b has a midtone darkening bias (~15%, measured in /lab/flux
  // playground on 2026-05-05). Pre-lighten the prompt-hex so klein-9b's
  // own bias lands the output near the actual RAL target. Darks and whites
  // pass through unchanged — see lightenHexForBfl for the band logic.
  const baseHex = product.color_hex ?? "";
  const promptHex = baseHex ? lightenHexForBfl(baseHex, 0.15) : "";
  const colorPhrase = `matt ${colorName}${ralPart ? ` ${ralPart}` : ""}${promptHex ? ` (hex ${promptHex})` : ""}`;

  const dimsLine = widthCm && heightCm
    ? `The facade is ${widthCm}cm wide and ${heightCm}cm tall.\n\n`
    : "";

  const line = detectLine(product);
  const hasStructure = detectStructure(product);

  const isGroove = line === "mono_groove";
  // Rhythm spacing per spec:
  //   Mono Flat: hairline naad every 37cm
  //   Mono Groove: visible groove every ~13cm (3× Mono Flat density)
  // NOTE: avoid "rabat" (Dutch term that biases the model toward wood
  // planking) and avoid "wood-grain" anywhere in the prompt — both
  // pull klein-9b toward rendering pale wood instead of metal in the
  // requested RAL color.
  const orientWord = orientation === "vertical" ? "vertical" : "horizontal";
  const surface = isGroove
    ? `painted matt metal cladding with crisp ${orientWord} grooves every ~13cm across the facade. Each groove is a 5mm shadow line recessed into the metal surface — clearly visible. The base material is a flat metal sheet painted in the color below; grooves are pressed into the metal, NOT carved wood.`
    : `painted matt metal cladding with very faint hairline ${orientWord} seams every 37cm. Seams are same-color hairlines (slightly darker shade of the panel color, never white, never contrasting). Otherwise smooth and uniform metal sheet.`;

  const orientLine = isGroove
    ? orientation === "vertical"
      ? `Grooves run top-to-bottom across the facade.`
      : `Grooves run left-to-right across the facade.`
    : orientation === "vertical"
    ? `Hairline seams run top-to-bottom across the facade.`
    : `Hairline seams run left-to-right across the facade.`;

  const isDark = product.ral_code === "9005" || product.ral_code === "7021" || product.ral_code === "7016" || product.ral_code === "7012";
  const isWhite = product.ral_code === "9003" || product.ral_code === "9010";
  const colorWarn = isWhite
    ? "  IMPORTANT: render as PURE COOL WHITE. NOT cream, NOT beige, NOT off-white, NOT yellow-tinted, NOT warm-tinted."
    : isDark
    ? `  IMPORTANT: render as TRUE COOL ${product.ral_code === "9005" ? "BLACK" : "DARK GREY"}. NOT brown, NOT dark brown, NOT warm-tinted, NOT yellow-shifted.`
    : "";
  const colorTone = isDark
    ? `Pure ${product.ral_code === "9005" ? "deep black" : "dark grey"} powder-coated matt finish.`
    : isWhite
    ? `Pure cool white powder-coated matt finish.`
    : `Powder-coated matt metal finish. No weathering, no patina.`;

  const structureLine = hasStructure
    ? `\n\nSURFACE TEXTURE: subtle linen-weave embossing on the painted metal surface, running parallel to the panel direction. Fine fabric-like 3D relief — NOT wood, NOT wood grain, NOT planks. The base material is still a painted metal sheet; the texture is a faint pressed pattern on the metal. Color must remain the matt RAL color specified above, NOT a wood color.`
    : "";

  const fasciaLine = includeFascia
    ? "Apply cladding to ALL wall surfaces INCLUDING the fascia board (boeideel)."
    : "PRESERVE the fascia board (boeideel) — keep its original color, do NOT recolor.";

  // Minimal prompt modelled on what works in BFL Flux playground:
  // a few clear sentences, no shouted caps, no exhaustive don'ts.
  // klein-9b is prompt-faithful — less micromanagement is more.
  return `Recolour the wall surfaces of this building in ${colorPhrase}. ${surface} ${orientLine}${structureLine}

${dimsLine}Keep the roof, gutters, chimneys, windows, glass, window frames, doors, sky, water, vegetation, neighbouring buildings, fences and any foreground objects exactly as in the source photo — same colour, same materials, same shape. Do not invent new windows or features. Match the source framing exactly.

${fasciaLine}${colorWarn ? `\n${colorWarn.trim()}` : ""}`;
}

type PromptOptions = {
  product: ProductForPrompt;
  brandPrefix: string;
  orientation: "horizontal" | "vertical" | undefined;
  facadeWidthMeters: number | undefined;
  facadeHeightMeters: number | undefined;
  includeFascia: boolean;
};

// Top-level dispatcher. Mono Flat is the base; Mono Groove appends a
// groove-pattern block on top of the SAME buildMonoFlatPrompt so it
// inherits panel-count enforcement, color compensation, joint
// MANDATORY language, fascia toggle, and preserve-elements. Only the
// surface description changes. Mono Textured stays on the legacy
// buildBasePrompt for now — gets its own enforcement pass once
// textured products exist in the catalog.
function buildRenderPrompt(opts: PromptOptions): string {
  const line = detectLine(opts.product);
  const hasStructure = detectStructure(opts.product);
  const structureAppendix = hasStructure ? `\n\n${structureBlock()}` : "";

  if (line === "mono_flat") {
    return `${buildMonoFlatPrompt(opts)}${structureAppendix}`;
  }
  if (line === "mono_groove") {
    return `${buildMonoFlatPrompt(opts)}\n\n${groovePatternBlock(opts)}${structureAppendix}`;
  }
  if (line === "mono_textured") {
    const tex = texturePatternBlock(opts);
    return tex ? `${buildBasePrompt(opts)}\n\n${tex}${structureAppendix}` : buildBasePrompt(opts);
  }
  return legacyPromptBlock(opts);
}

// Visible panels across the facade in the rhythm direction. Vertical
// orientation → panels run side-by-side across the WIDTH; horizontal
// orientation → panels stack across the HEIGHT. Returns undefined when
// the relevant facade dimension is unknown so the caller can omit the
// EXACTLY-N instruction rather than invent a count.
function visiblePanelCount(opts: {
  orientation: "horizontal" | "vertical" | undefined;
  facadeWidthMeters: number | undefined;
  facadeHeightMeters: number | undefined;
  panelWorkSizeMm: number;
}): number | undefined {
  const acrossM =
    opts.orientation === "vertical" ? opts.facadeWidthMeters : opts.facadeHeightMeters;
  if (!acrossM || acrossM <= 0 || !opts.panelWorkSizeMm || opts.panelWorkSizeMm <= 0) {
    return undefined;
  }
  return Math.max(1, Math.ceil((acrossM * 1000) / opts.panelWorkSizeMm));
}

// Mono Groove = Mono Flat + 3 internal grooves per panel face.
// Appended AFTER buildMonoFlatPrompt() so the panel rhythm,
// inter-panel seam style, color, joints, fascia toggle, and
// preserve-elements all inherit unchanged. This block extends —
// it does not replace.
//
// Validated against real Spänl SG-series installation photos
// (SG9010A in particular): each panel face shows multiple parallel
// grooves creating a layered plank effect — traditional Dutch
// rabat karakter. Total visible line count is ~3x the inter-panel
// seam count.
//
// Phrasing notes:
// - "subtle light grey shadow lines, NOT dark, NOT black" — image
//   models default to high-contrast dark recess grooves, which
//   reads as harsh black stripes instead of rabat rhythm
// - "do not interpret 'grooves' as deep dark gaps between panels"
//   — without this, Gemini conflates the new internal grooves with
//   the inter-panel seams and amplifies BOTH, breaking the rhythm
function groovePatternBlock(opts: PromptOptions): string {
  const visibleWidthMm = opts.product.panel_work_size_mm ?? 370;
  const stripWidthMm = Math.round(visibleWidthMm / 4);
  const directionLine =
    opts.orientation === "vertical"
      ? "Panels are vertical, so the 3 internal grooves run vertically within each panel."
      : "Panels are horizontal, so the 3 internal grooves run horizontally within each panel.";

  return `ADDITIONAL DETAIL — INTERNAL GROOVES WITHIN EACH PANEL:

Each panel face contains 3 grooves running parallel across it, dividing each panel's visible surface into 4 equal strips. These grooves are recessed channels carved into the panel face itself.

Visual properties of the internal grooves — match the existing seam style:
- Same color tone as the inter-panel seams: subtle light grey shadow lines, NOT dark, NOT black
- Same line thickness as the inter-panel seams
- Slightly more visible than inter-panel seams because they are deeper recesses, but still in the same neutral grey family — no harsh dark contrast

Spacing: 3 grooves evenly spaced within each panel's ${visibleWidthMm}mm visible width, dividing it into 4 strips of approximately ${stripWidthMm}mm each.

Direction: grooves run parallel to the panel orientation. ${directionLine}

Result: the total visible line count is approximately 3x the inter-panel seam count. The visual rhythm is dense and regular, characteristic of traditional Dutch rabat plank cladding.

VISUAL REFERENCE: this matches the Spänl SG-series products such as SG9010A — fris plank model met traditioneel rabat karakter, where every panel face shows multiple parallel grooves creating a layered plank effect.

CRITICAL: do not interpret "grooves" as deep dark gaps between panels. The inter-panel seams stay subtle as defined in the base prompt. The grooves WITHIN each panel are slightly more pronounced but still grey-toned, never black. Total visual: dense grey-on-grey rhythm, not high-contrast stripes.`;
}

// Mono Textured pattern layer — placeholder. No textured products
// exist in the catalog yet; once seed data + visual references land
// we'll fill this in. Returning an empty string means a textured
// product (if one is ever inserted prematurely) renders as Mono
// Flat — no crash, no broken prompt, just the base treatment.
function texturePatternBlock(opts: PromptOptions): string {
  // eslint-disable-next-line no-console
  console.warn(
    `[render] Mono Textured prompt not yet implemented for ${opts.product.sku ?? opts.product.name}`
  );
  return "";
}

// Joint counter — perpendicular shadow lines where consecutive panels
// meet end-to-end. Horizontal mounting consumes the facade WIDTH;
// vertical mounting consumes the facade HEIGHT. Falls back to "no
// joints" copy when the relevant dimension is unknown so we don't
// invent a phantom seam count.
function jointBlock(opts: {
  orientation: "horizontal" | "vertical" | undefined;
  facadeWidthMeters: number | undefined;
  facadeHeightMeters: number | undefined;
  panelLengthMm: number;
}): string {
  const lengthMeters = opts.panelLengthMm / 1000;
  const relevant =
    opts.orientation === "vertical" ? opts.facadeHeightMeters : opts.facadeWidthMeters;
  if (!relevant || relevant <= 0 || lengthMeters <= 0) {
    return "Surface continuous, NO joint lines, NO horizontal interruptions, NO perpendicular seams.";
  }
  const panelsInSeries = Math.max(1, Math.ceil(relevant / lengthMeters));
  const joints = Math.max(0, panelsInSeries - 1);
  if (joints === 0) {
    return "Surface continuous, NO joint lines, NO horizontal interruptions, NO perpendicular seams.";
  }
  // Even distribution at 1/N, 2/N, ..., (N-1)/N of the facade. Soft
  // "spaced evenly" wording was being ignored — Gemini omitted the
  // outermost joint (typically the right one). Explicit percentage
  // positions + MANDATORY language mirror the panel-rhythm fix.
  const positions = Array.from({ length: joints }, (_, i) =>
    Math.round(((i + 1) * 100) / panelsInSeries)
  );
  const positionList = positions.map((p) => `${p}%`).join(", ");
  if (joints === 1) {
    return `JOINTS ARE MANDATORY: render EXACTLY 1 thin perpendicular shadow line at ${positionList} of the facade ${
      opts.orientation === "vertical" ? "height" : "width"
    } where two panels meet end-to-end.`;
  }
  return `JOINTS ARE MANDATORY: render EXACTLY ${joints} thin perpendicular shadow lines at the following positions across the facade ${
    opts.orientation === "vertical" ? "height (top to bottom)" : "width (left to right)"
  }: ${positionList}. Each joint marks where two panels meet end-to-end. ALL ${joints} joints must be visible — do not omit the outermost joint.`;
}

// Mono Flat prompt with panel-count enforcement and color
// compensation. Also serves as the base for Mono Groove (which
// appends groovePatternBlock on top of this output). Diverges from
// buildBasePrompt because Gemini ignores soft "approximately"
// wording on panel rhythm and renders RAL colors 15-20% lighter than
// ground-truth swatches. buildBasePrompt stays unchanged so Mono
// Textured can be measured and tuned independently.
//
// Panel rhythm: the EXACTLY-N wording is repeated at the start AND end
// of the prompt — image models respond to repeated key facts. Falls
// back to the soft SEAMS-only language when facade dimensions are
// unknown so we never invent a count.
//
// Color: prefers product.color_hex_render (compensated darker) over
// product.color_hex (the official RAL match). The new "Render the
// panels in this exact color: ..." + "not lighter, not washed out"
// phrasing is the second half of the compensation — strong language
// matters as much as the hex itself.
function buildMonoFlatPrompt(opts: PromptOptions): string {
  const { product, brandPrefix, orientation, includeFascia } = opts;
  const panelLengthMm = product.panel_length_mm ?? 4200;
  const visibleWidthMm = product.panel_work_size_mm ?? 370;

  const orientationLine =
    orientation === "vertical"
      ? "vertical — panels mounted top-to-bottom. Visible rhythm runs vertically across the facade."
      : "horizontal — panels mounted side-to-side. Visible rhythm runs horizontally across the facade.";

  const colorName = product.color_name ?? "as shown in product reference";
  const ralPart = product.ral_code ? `RAL ${product.ral_code}` : "no RAL code";
  const promptHex = product.color_hex_render ?? product.color_hex ?? null;
  const hexClause = promptHex
    ? `Render the panels in this exact color: ${promptHex}. `
    : "";

  const productCode = product.sku ?? "";
  const fasciaLine = includeFascia
    ? "Replace ALL vertical wall surfaces INCLUDING the fascia board (boeideel — the trim plank along the top edge above the wall) with the new cladding."
    : "Replace ALL vertical wall surfaces but EXCLUDE the fascia board (boeideel — the trim plank along the top edge). Leave the fascia board exactly as it appears in the original image.";

  const count = visiblePanelCount({
    orientation,
    facadeWidthMeters: opts.facadeWidthMeters,
    facadeHeightMeters: opts.facadeHeightMeters,
    panelWorkSizeMm: visibleWidthMm,
  });
  const rhythmDirection = orientation === "vertical" ? "horizontal" : "vertical";
  const rhythmSection = count
    ? `PANEL RHYTHM IS MANDATORY: Render EXACTLY ${count} uniformly-sized panels across the facade in the ${rhythmDirection} direction. Each panel is identical in width — ${visibleWidthMm}mm visible. The panel rhythm runs continuously and uniformly. Do NOT vary panel width to accommodate windows, doors, or other facade features — panels run behind/around them at constant width. Count: ${count} panels visible.\n\n`
    : "";
  const finalCheck = count
    ? `\n\nFINAL CHECK: ${count} panels visible across the facade. Uniform width. Constant rhythm.`
    : "";

  return `Transform this facade by completely replacing all wall surfaces with new modern fiber-cement cladding panels.

REMOVE: all existing wall cladding, all wood grain texture, all horizontal or vertical plank lines from existing wood siding, all peeling paint, all weathering, all surface imperfections. Treat the current wall covering as if it does not exist.

ADD: ${brandPrefix}${productCode} ${product.name} panels — manufactured rectangular cladding panels with completely flat, smooth, matte surfaces. Each panel is ${visibleWidthMm}mm wide and up to ${panelLengthMm}mm long.

REFERENCE IMAGE INTERPRETATION: the product reference photo shows the panel SURFACE, SHAPE, and SEAM RHYTHM only. The COLOR in the reference photo is UNRELIABLE — it was shot under bright studio lighting on a white background, which makes the panels appear significantly lighter and more washed-out than the real product. DO NOT match the reference photo's color. Use ONLY the hex value below for color.

ORIENTATION: ${orientationLine}

${rhythmSection}SEAMS (smalle naad): hairline shadow lines between adjacent panels every ${visibleWidthMm}mm. The seam color is a slightly darker shade of the panel color itself (same hue, ~10-15% darker) — never white, never light grey, never contrasting. On dark cladding the seams must remain dark; do NOT add bright white or light shadow lines on dark colors. These are subtle same-color hairlines, not contrasting grooves.

JOINTS: ${jointBlock({
    orientation,
    facadeWidthMeters: opts.facadeWidthMeters,
    facadeHeightMeters: opts.facadeHeightMeters,
    panelLengthMm,
  })}

COLOR (AUTHORITATIVE — overrides reference photo): ${colorName} (${ralPart}). ${hexClause}This hex value is the ground truth. Render the panels at exactly this darkness and saturation. The reference photo looks lighter than this — that is wrong, ignore it. Uniform across all panels. No color variation, no weathering, no patina. The result must clearly read as ${colorName} — not lighter, not washed out, not cream, not white.

SURFACE: completely flat, no texture, no wood grain, no embossed pattern, no ribs, no fluting. Matte finish with even diffuse light reflection. NO glossy reflections, NO sheen.

PRESERVE EXACTLY AS-IS:
- All windows and their glazing
- All window frames in their current color
- All doors and door frames
- The roof and roof tiles/material
- Gutters and downpipes
- The sky, trees, and background
- Any waterline, reflections, fences, or foreground elements

${fasciaLine}${finalCheck}`;
}

// Mono Flat base block — also used as the foundation for Mono Groove
// and (eventually) Mono Textured prompts via buildRenderPrompt.
//
// The phrasing in REMOVE / "Treat the current wall covering as if it
// does not exist" / "Transform this facade by completely replacing"
// is intentionally kept verbatim — it has been chosen because Gemini
// responds to the imperative + negative descriptors more strongly
// than to softer alternatives. Do not paraphrase without re-testing
// on the woonboot wood-siding photo.
function buildBasePrompt(opts: PromptOptions): string {
  const { product, brandPrefix, orientation, includeFascia } = opts;
  const panelLengthMm = product.panel_length_mm ?? 4200;
  const visibleWidthMm = product.panel_work_size_mm ?? 370;

  const orientationLine =
    orientation === "vertical"
      ? "vertical — panels mounted top-to-bottom. Visible rhythm runs vertically across the facade."
      : "horizontal — panels mounted side-to-side. Visible rhythm runs horizontally across the facade.";

  const colorName = product.color_name ?? "as shown in product reference";
  const ralPart = product.ral_code ? `RAL ${product.ral_code}` : "no RAL code";
  const hexPart = product.color_hex
    ? `approximately ${product.color_hex}`
    : "approximately as in product reference";

  const productCode = product.sku ?? "";
  const fasciaLine = includeFascia
    ? "Replace ALL vertical wall surfaces INCLUDING the fascia board (boeideel — the trim plank along the top edge above the wall) with the new cladding."
    : "Replace ALL vertical wall surfaces but EXCLUDE the fascia board (boeideel — the trim plank along the top edge). Leave the fascia board exactly as it appears in the original image.";

  return `Transform this facade by completely replacing all wall surfaces with new modern fiber-cement cladding panels.

REMOVE: all existing wall cladding, all wood grain texture, all horizontal or vertical plank lines from existing wood siding, all peeling paint, all weathering, all surface imperfections. Treat the current wall covering as if it does not exist.

ADD: ${brandPrefix}${productCode} ${product.name} panels — manufactured rectangular cladding panels with completely flat, smooth, matte surfaces. Each panel is ${visibleWidthMm}mm wide and up to ${panelLengthMm}mm long.

ORIENTATION: ${orientationLine}

SEAMS: subtle thin shadow lines between adjacent panels (every ${visibleWidthMm}mm in the direction perpendicular to panel length). These are narrow shadow gaps, NOT deep grooves. Visible but understated.

JOINTS: ${jointBlock({
    orientation,
    facadeWidthMeters: opts.facadeWidthMeters,
    facadeHeightMeters: opts.facadeHeightMeters,
    panelLengthMm,
  })}

COLOR: ${colorName} (${ralPart}, ${hexPart}). Uniform across all panels. No color variation, no weathering, no patina, no fade.

SURFACE: completely flat, no texture, no wood grain, no embossed pattern, no ribs, no fluting. Matte finish with even diffuse light reflection. NO glossy reflections, NO sheen.

PRESERVE EXACTLY AS-IS:
- All windows and their glazing
- All window frames in their current color
- All doors and door frames
- The roof and roof tiles/material
- Gutters and downpipes
- The sky, trees, and background
- Any waterline, reflections, fences, or foreground elements

${fasciaLine}`;
}

// Legacy block — used unchanged for Mono Groove, Strip, Brick, Wood,
// Spanish Tile, and Keralit free-text. This is the previous prompt
// shape; it stays in place until each line gets its own targeted
// rewrite. Signature differs from PromptOptions only in that it
// repackages the same fields, so callers go through buildRenderPrompt.
function legacyPromptBlock(opts: PromptOptions): string {
  return buildPrompt(
    opts.product,
    opts.brandPrefix,
    opts.orientation,
    opts.facadeWidthMeters,
    opts.includeFascia,
  );
}

function buildPrompt(
  product: ProductForPrompt,
  brandPrefix: string,
  orientation: "horizontal" | "vertical" | undefined,
  facadeWidthMeters: number | undefined,
  includeBoeideel: boolean
): string {
  const colorLine =
    product.ral_code && product.color_hex
      ? `Color: ${product.color_name} (RAL ${product.ral_code}, hex ${product.color_hex}). Apply uniformly.`
      : `Color: ${product.color_name ?? "as shown in product reference"}${
          product.color_hex ? ` (hex ${product.color_hex})` : ""
        }. Apply uniformly.`;

  let orientationRule: string;
  if (orientation === "vertical") {
    orientationRule =
      "Orientation: vertical — motif runs top to bottom. Surface continuous, no horizontal seams or joints.";
  } else {
    const numJoints = facadeWidthMeters
      ? Math.max(0, Math.ceil(facadeWidthMeters / 4.2) - 1)
      : 0;
    orientationRule =
      numJoints > 0
        ? `Orientation: horizontal — motif runs left to right. Surface continuous with NO horizontal seams. Include ${numJoints} vertical joint profile${
            numJoints > 1 ? "s" : ""
          } where panels meet end-to-end (panels are ~4.2m max length). Place joints near window/door verticals where possible, not mid-wall.`
        : "Orientation: horizontal — motif runs left to right. Surface continuous, no seams.";
  }

  const boeideelLine = includeBoeideel
    ? "Replace ALL vertical wall surfaces including the fascia board (boeideel — the horizontal trim plank along the roof edge above the wall) with the new cladding."
    : "Keep the fascia board (boeideel — the horizontal trim plank along the roof edge above the wall) UNCHANGED in its current appearance. Only replace the main wall cladding below the fascia.";

  return `Replace the cladding on this facade with: ${brandPrefix}${product.name}.
${colorLine}
Surface profile: ${product.description ?? "as shown in product reference"}.
${orientationRule}
Keep these unchanged: windows, doors, window frames, door frames, glazing, gutters, downpipes, roof tiles, and the sky.
${boeideelLine}`;
}

// Hard cap on inbound image bytes to keep one bad caller from blowing the
// 4MB Vercel body limit AND stop someone funneling huge files into Gemini.
// 8 MB base64 ≈ 6 MB raw — enough for a phone photo, modest for an SLR.
const MAX_DATA_URL_LEN = 8 * 1024 * 1024;
// Same cap applied after fetching a Supabase signed URL.
const MAX_FETCHED_BYTES = 6 * 1024 * 1024;

const dataUrl = z
  .string()
  .max(MAX_DATA_URL_LEN, "image_too_large")
  .regex(/^data:image\/(png|jpe?g|webp);base64,/, "not_image_data_url");

// TODO(renamefield): photoDataUrl now also accepts a Supabase signed URL.
// Rename to `photo` or `photoSource` once both this route and every caller
// are updated in the same PR — don't do it piecemeal.
const photoSource = z
  .string()
  .max(MAX_DATA_URL_LEN, "image_too_large")
  .refine(
    (v) =>
      /^data:image\/(png|jpe?g|webp);base64,/.test(v) ||
      (v.startsWith("https://") && v.includes(".supabase.co/")),
    { message: "not_image_data_url_or_supabase_url" }
  );

const renderSchema = z.object({
  photoDataUrl: photoSource,
  referenceDataUrl: dataUrl.optional(),
  referenceDataUrls: z.array(dataUrl).max(5).optional(),
  // Spanl path: SKU resolves to row in `products` (ral_code/color_hex/etc).
  productSku: z.string().max(64).optional(),
  // Legacy path: free-text label/description (Keralit until it's seeded).
  productLabel: z.string().max(200).optional(),
  productDescription: z.string().max(2000).optional(),
  orientation: z.enum(["horizontal", "vertical"]).optional(),
  panelLength: z.number().finite().positive().max(10000).optional(),
  panelVisibleHeight: z.number().finite().positive().max(10000).optional(),
  panelWidthCm: z.number().finite().positive().max(10000).optional(),
  facadeWidthCm: z.number().finite().positive().max(100000).optional(),
  facadeHeightCm: z.number().finite().positive().max(100000).optional(),
  windowFrame: z.object({ material: z.string().max(200).optional() }).optional(),
  door: z
    .object({
      material: z.string().max(200).optional(),
      colour: z.string().max(100).optional(),
    })
    .optional(),
  // Whether the fascia board (boeideel) should be replaced with the new
  // cladding (true, default) or kept unchanged (false).
  includeBoeideel: z.boolean().default(true),
  locale: z.string().max(10).optional(),
});

type RenderBody = z.infer<typeof renderSchema>;

function dataUrlToInlinePart(dataUrl: string): InlinePart | null {
  const m = /^data:([^;,]+);base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  return { inlineData: { mimeType: m[1], data: m[2] } };
}

function expectedSupabaseHost(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return null;
  try {
    return new URL(raw).host;
  } catch {
    return null;
  }
}

// Resolve a photo input to an InlinePart Gemini can consume. Accepts either
// a data: URL (legacy) or a Supabase Storage signed HTTPS URL. The HTTPS
// path is host-pinned to the configured Supabase project to prevent SSRF.
// Returns raw bytes alongside the part so the caller can compute the
// source aspect ratio for output cropping.
async function resolvePhotoPart(input: string): Promise<
  | { ok: true; part: InlinePart; bytes: Buffer }
  | { ok: false; status: number; error: string }
> {
  if (input.startsWith("data:")) {
    const part = dataUrlToInlinePart(input);
    if (!part) return { ok: false, status: 400, error: "invalid_input" };
    const bytes = Buffer.from(part.inlineData.data, "base64");
    return { ok: true, part, bytes };
  }

  const supabaseHost = expectedSupabaseHost();
  if (!supabaseHost) {
    logger.error("render_supabase_host_unconfigured");
    return { ok: false, status: 500, error: "internal_error" };
  }
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return { ok: false, status: 400, error: "invalid_input" };
  }
  if (parsed.protocol !== "https:" || parsed.host !== supabaseHost) {
    return { ok: false, status: 400, error: "invalid_photo_source" };
  }

  let res: Response;
  try {
    res = await fetch(input);
  } catch (err) {
    logger.error({ err }, "render_photo_fetch_threw");
    return { ok: false, status: 502, error: "photo_fetch_failed" };
  }
  if (!res.ok) {
    logger.warn({ status: res.status }, "render_photo_fetch_failed");
    return { ok: false, status: 502, error: "photo_fetch_failed" };
  }

  const contentLength = Number(res.headers.get("content-length") ?? "0");
  if (contentLength > MAX_FETCHED_BYTES) {
    return { ok: false, status: 400, error: "image_too_large" };
  }

  const arrayBuffer = await res.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_FETCHED_BYTES) {
    return { ok: false, status: 400, error: "image_too_large" };
  }

  const bytes = Buffer.from(arrayBuffer);
  const mimeType = res.headers.get("content-type") ?? "image/jpeg";
  const base64 = bytes.toString("base64");
  return { ok: true, part: { inlineData: { mimeType, data: base64 } }, bytes };
}

// `products.image_url` is stored as a site-relative path (e.g.
// "/samples/spanl/panels/.../main.jpg"). Convert to absolute so the server
// can fetch it. NEXT_PUBLIC_SITE_URL is set in prod to the deployed origin.
function normalizeImageUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return `${baseUrl}${url}`;
}

async function fetchImageAsInlinePart(url: string): Promise<InlinePart | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_FETCHED_BYTES) return null;
    const bytes = Buffer.from(arrayBuffer);
    const mimeType = res.headers.get("content-type") ?? "image/jpeg";
    return { inlineData: { mimeType, data: bytes.toString("base64") } };
  } catch {
    return null;
  }
}

function readEnvCaseInsensitive(name: string): string | undefined {
  const target = name.toLowerCase();
  for (const k of Object.keys(process.env)) {
    if (k.toLowerCase() === target) {
      const v = process.env[k];
      if (typeof v === "string" && v.trim().length > 0) return v;
    }
  }
  return undefined;
}

// Map an arbitrary input width/height to the closest Gemini Flash Image
// supported aspect ratio. Used to pin output framing via
// imageConfig.aspectRatio so the model stops drifting into 1:1 / 16:9
// recompositions when the source is a different shape. Supported set is
// from @google/genai's ImageConfig: 1:1, 2:3, 3:2, 3:4, 4:3, 9:16, 16:9, 21:9.
function pickGeminiAspectRatio(width: number, height: number): string {
  const aspect = width / height;
  const candidates: Array<[string, number]> = [
    ["1:1", 1],
    ["2:3", 2 / 3],
    ["3:4", 3 / 4],
    ["3:2", 3 / 2],
    ["4:3", 4 / 3],
    ["9:16", 9 / 16],
    ["16:9", 16 / 9],
    ["21:9", 21 / 9],
  ];
  let best = candidates[0];
  let bestDiff = Math.abs(aspect - best[1]);
  for (const c of candidates) {
    const d = Math.abs(aspect - c[1]);
    if (d < bestDiff) {
      best = c;
      bestDiff = d;
    }
  }
  return best[0];
}

function resolveGeminiKey(): string | undefined {
  const candidates = [
    "GEMINI_API_KEY",
    "Gemini_API_Key",
    "Gemini_Api_Key",
    "gemini_api_key",
    "GOOGLE_API_KEY",
    "Google_API_Key",
  ];
  for (const name of candidates) {
    const raw = process.env[name];
    if (typeof raw === "string" && raw.trim().length > 0) return raw.trim();
  }
  return readEnvCaseInsensitive("GEMINI_API_KEY")?.trim();
}

// Strip everything that isn't a printable-ASCII char fit for an HTTP
// header. Catches the bullet "•" (U+2022) and other rich-text leftovers
// that sneak in via copy-paste from masked env-var UIs and would
// otherwise blow up `fetch` with a ByteString conversion error and
// silently route every request to the Gemini fallback.
function sanitizeApiKey(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 33 && c <= 126) out += s[i];
  }
  return out;
}

// BFL FLUX.2 klein-9b key. Mixed-case names per user convention; we read
// case-insensitively so Vercel/Hostinger casing differences don't matter.
function resolveBflKey(): string | undefined {
  let raw: string | undefined;
  for (const name of ["renisual_bfl_key", "BFL_API_KEY", "Flux_API_Key", "FLUX_API_KEY"]) {
    const v = process.env[name];
    if (typeof v === "string" && v.trim().length > 0) {
      raw = v.trim();
      break;
    }
  }
  if (!raw) {
    raw = readEnvCaseInsensitive("renisual_bfl_key")?.trim()
      ?? readEnvCaseInsensitive("BFL_API_KEY")?.trim();
  }
  if (!raw) return undefined;
  const cleaned = sanitizeApiKey(raw);
  if (cleaned.length !== raw.length) {
    logger.warn(
      { stripped: raw.length - cleaned.length, sample: raw.charCodeAt(0) },
      "render_bfl_key_sanitised",
    );
  }
  return cleaned.length > 0 ? cleaned : undefined;
}

// Round to a multiple of 32 with a 64-pixel floor — BFL accepts any
// integer >= 64 but their internal pipeline rounds anyway, so matching
// the rounding here keeps the response dimensions predictable.
function bflTargetDims(srcW: number, srcH: number): { width: number; height: number } {
  const aspect = srcW / srcH;
  const h = Math.sqrt(1_000_000 / aspect);
  const w = h * aspect;
  const round32 = (n: number) => Math.max(64, Math.round(n / 32) * 32);
  return { width: round32(w), height: round32(h) };
}

// Try the EU primary engine (BFL FLUX.2 klein-9b). Throws on any failure
// so the caller can fall back to Gemini. Source photo is downscaled to
// ~1MP before send — klein-9b is billed per render not per input MP, but
// keeping the request body under a few MB avoids occasional 413s and
// trims latency on slow connections.
async function renderViaBfl(args: {
  apiKey: string;
  prompt: string;
  sourceBytes: Buffer;
  referenceParts: InlinePart[];
}): Promise<{ bytes: Buffer; mime: string }> {
  const meta = await sharp(args.sourceBytes).metadata();
  const srcW = meta.width ?? 1024;
  const srcH = meta.height ?? 1024;
  const dims = bflTargetDims(srcW, srcH);

  // Earlier attempt at .normalise({1,99}) for white-balance neutralisation
  // turned out too aggressive (RAL 9003 white blew out, RAL 9005 black
  // shifted lighter). Removed — instead we lean on image_prompt_strength
  // below to reduce how heavily klein-9b weighs the source photo's
  // lighting/wb when recoloring.
  const baseDownscaled = await sharp(args.sourceBytes)
    .rotate()
    .resize(dims.width, dims.height, { fit: "fill" })
    .toBuffer();

  const body: Record<string, unknown> = {
    prompt: args.prompt,
    input_image: baseDownscaled.toString("base64"),
    width: dims.width,
    height: dims.height,
    output_format: "jpeg",
    safety_tolerance: 2,
  };
  // BFL supports up to 8 reference images; product photos go after the base.
  args.referenceParts.slice(0, 7).forEach((p, i) => {
    body[`input_image_${i + 2}`] = p.inlineData.data;
  });

  const submitRes = await fetch("https://api.bfl.ai/v1/flux-2-klein-9b", {
    method: "POST",
    headers: {
      "x-key": args.apiKey,
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const submitJson = await submitRes.json().catch(() => ({} as Record<string, unknown>));
  if (!submitRes.ok) {
    const detail = (submitJson as { detail?: string }).detail ?? `status ${submitRes.status}`;
    throw new Error(`bfl_submit_${submitRes.status}_${detail}`);
  }
  const id = (submitJson as { id?: string }).id;
  const pollingUrl = (submitJson as { polling_url?: string }).polling_url;
  if (!pollingUrl) throw new Error("bfl_no_polling_url");

  // Cap polling well below the 60s function maxDuration so we have time
  // to download and post-process before the route times out.
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500));
    const pollRes = await fetch(pollingUrl, {
      headers: { "x-key": args.apiKey, accept: "application/json" },
    });
    const pollJson = (await pollRes.json().catch(() => ({}))) as {
      status?: string;
      result?: { sample?: string };
    };
    if (pollJson.status === "Ready") {
      const sample = pollJson.result?.sample;
      if (!sample) throw new Error("bfl_no_sample");
      const dlRes = await fetch(sample);
      if (!dlRes.ok) throw new Error(`bfl_download_${dlRes.status}`);
      const buf = Buffer.from(await dlRes.arrayBuffer());
      return { bytes: buf, mime: "image/jpeg" };
    }
    if (
      pollJson.status === "Error" ||
      pollJson.status === "Failed" ||
      pollJson.status === "Content Moderated"
    ) {
      throw new Error(`bfl_${pollJson.status}`);
    }
  }
  throw new Error(`bfl_timeout_${id ?? "unknown"}`);
}

export async function POST(request: Request) {
  const forbidden = verifyOrigin(request);
  if (forbidden) return forbidden;

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

  const apiKey = resolveGeminiKey();
  if (!apiKey) {
    // Don't echo env-var diagnostics back to the caller — that information
    // is operationally useful but leaks our infra to attackers. Server log
    // captures the detail for an operator looking at the dashboard.
    logger.error("render_missing_gemini_key");
    return Response.json({ error: "internal_error" }, { status: 500 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = renderSchema.safeParse(raw);
  if (!parsed.success) {
    // Log the field errors so dev-server output shows exactly which field
    // tripped validation. We never log the user's photo bytes.
    logger.warn(
      { issues: parsed.error.flatten() },
      "render_invalid_input"
    );
    return Response.json(
      { error: "invalid_input", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const body: RenderBody = parsed.data;

  const photoResult = await resolvePhotoPart(body.photoDataUrl);
  if (!photoResult.ok) {
    return Response.json({ error: photoResult.error }, { status: photoResult.status });
  }
  const photoPart = photoResult.part;
  // Cap source dimensions before sharp ops touch it. Phone photos can be
  // 4032×3024; decoding to raw RGB plus the multiple sharp pipelines in the
  // post-pass would otherwise spike memory and trigger VipsJpeg ENOMEM on
  // Vercel's serverless runtime. 1600px is enough to look sharp at typical
  // viewing sizes and stays well under BFL's own ~1200px output.
  // Quality 92 to avoid layering JPEG compression artefacts onto an
  // already-compressed client upload.
  let sourceBytes = photoResult.bytes;
  try {
    const meta = await sharp(sourceBytes).metadata();
    if ((meta.width ?? 0) > 1600 || (meta.height ?? 0) > 1600) {
      sourceBytes = await sharp(sourceBytes)
        .rotate()
        .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 92 })
        .toBuffer();
    }
  } catch (err) {
    logger.warn({ err }, "render_source_downscale_failed");
  }

  // Resolve the product. Preferred path: productSku → DB row carrying
  // ral_code/color_name/color_hex/description/image_url. Fallback path:
  // free-text label/description (Keralit until it's seeded into Supabase).
  let product: ProductForPrompt;
  let brandPrefix = "";
  if (body.productSku) {
    let dbProduct: ProductForPrompt | null = null;
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("products")
        .select("sku, name, description, ral_code, color_name, color_hex, color_hex_render, image_url, panel_length_mm, panel_work_size_mm")
        .eq("sku", body.productSku)
        .eq("active", true)
        .single();
      if (error) throw error;
      dbProduct = data as ProductForPrompt;
    } catch (err) {
      // Supabase unavailable / auth error / product missing — log and
      // fall through to a minimal stub built from the request body so
      // the render pipeline still attempts BFL/Gemini instead of 404'ing.
      logger.warn({ err, sku: body.productSku }, "render_product_lookup_failed_using_fallback");
    }

    if (dbProduct) {
      product = dbProduct;
      brandPrefix = "Spanl ";
    } else {
      // No DB row available — try to infer product line + RAL from the
      // SKU prefix so the prompt still gets correct mono-flat vs
      // mono-groove + correct color hex. Fall back to plain stub if
      // the SKU shape doesn't match a known Spanl prefix.
      const inferred = inferProductFromSku(body.productSku);
      product = inferred ?? {
        sku: body.productSku,
        name: body.productLabel ?? body.productSku,
        description: body.productDescription ?? null,
        ral_code: null,
        color_name: null,
        color_hex: null,
        color_hex_render: null,
        image_url: null,
      };
      brandPrefix = "Spanl ";
    }
  } else if (body.productLabel) {
    product = {
      sku: null,
      name: body.productLabel,
      description: body.productDescription ?? null,
      ral_code: null,
      color_name: null,
      color_hex: null,
      color_hex_render: null,
      image_url: null,
    };
  } else {
    return Response.json({ error: "no_product" }, { status: 400 });
  }

  // Reference image strategy:
  //  - Spanl (DB-backed): fetch product.image_url server-side. DB is the
  //    single source of truth — frontend doesn't need to ship the image.
  //  - Keralit (legacy): use referenceDataUrls/referenceDataUrl from the
  //    frontend until Keralit is seeded.
  const referenceParts: InlinePart[] = [];
  if (product.image_url) {
    const part = await fetchImageAsInlinePart(normalizeImageUrl(product.image_url));
    if (part) referenceParts.push(part);
    else logger.warn({ url: product.image_url }, "render_product_image_fetch_failed");
  } else {
    const legacyUrls = body.referenceDataUrls?.length
      ? body.referenceDataUrls
      : body.referenceDataUrl
      ? [body.referenceDataUrl]
      : [];
    legacyUrls.forEach((url) => {
      const p = dataUrlToInlinePart(url);
      if (p) referenceParts.push(p);
    });
  }

  const facadeWidthMeters =
    body.facadeWidthCm && body.facadeWidthCm > 0
      ? body.facadeWidthCm / 100
      : undefined;
  const facadeHeightMeters =
    body.facadeHeightCm && body.facadeHeightCm > 0
      ? body.facadeHeightCm / 100
      : undefined;

  const promptText = buildRenderPrompt({
    product,
    brandPrefix,
    orientation: body.orientation,
    facadeWidthMeters,
    facadeHeightMeters,
    includeFascia: body.includeBoeideel,
  });

  // Detect source aspect so we can pin Gemini's output to the closest
  // supported ratio. Without this the model defaults to its own framing
  // bias (often a tighter 1:1 / 16:9 crop), causing the side-by-side
  // zoom drift that prompt-text alone cannot fix. Sharp metadata is
  // cheap and we already have sourceBytes in memory.
  let sourceAspectRatio: string | undefined;
  try {
    const meta = await sharp(sourceBytes).metadata();
    if (meta.width && meta.height) {
      sourceAspectRatio = pickGeminiAspectRatio(meta.width, meta.height);
    }
  } catch (err) {
    logger.warn({ err }, "render_aspect_detect_failed");
  }

  console.log("[render] prompt:", promptText);
  console.log("[render] product:", product.sku, product.color_name, product.ral_code);
  console.log("[render] image_url:", product.image_url, "→ refs:", referenceParts.length);
  console.log("[render] includeBoeideel:", body.includeBoeideel);
  console.log("[render] aspectRatio:", sourceAspectRatio ?? "(not detected)");

  // Image-to-image framing strategy:
  //  - The base photo is labelled as the EDIT TARGET — its frame and
  //    dimensions are authoritative for the output.
  //  - Reference photos are labelled as TEXTURE/COLOR-only — explicitly
  //    not to be copied into the output framing. Without this Gemini
  //    sometimes adopts the product photo's tight crop or studio
  //    backdrop into the rendered facade.
  //  - imageConfig.aspectRatio (set on the Gemini config below) hard-
  //    pins the output ratio to match the base photo, which prompt
  //    text alone could not enforce.
  const parts: Array<{ text: string } | InlinePart> = [
    {
      text: "BASE PHOTO — edit this image. The output must match this image's camera angle, frame edges, and aspect ratio exactly. Modify only the wall cladding surface; everything else (frame, sky, surroundings, windows, doors, roof) stays in place.",
    },
    photoPart,
  ];
  referenceParts.forEach((p) => {
    parts.push({
      text: "TEXTURE AND COLOR REFERENCE ONLY — use this image to understand the product's surface texture and color. Do NOT copy its framing, composition, background, or crop into the output.",
    });
    parts.push(p);
  });
  parts.push({ text: promptText });

  logger.info(
    { promptLen: promptText.length, refs: referenceParts.length, aspectRatio: sourceAspectRatio },
    "render_prompt"
  );

  // Primary engine: BFL FLUX.2 klein-9b (EU/GDPR via api.bfl.ai). Tried
  // first when the BFL key is configured. On any failure we silently
  // fall back to Gemini so a single-engine outage does not break renders.
  // BFL uses a simpler prompt than Gemini — klein-9b is more prompt-
  // faithful than Gemini and the elaborate compensation language hurts
  // its color accuracy.
  let bflFailReason: string | undefined;
  const bflKey = resolveBflKey();
  if (!bflKey) {
    bflFailReason = "no_bfl_key_configured";
    logger.warn("render_bfl_no_key_configured");
  }
  if (bflKey) {
    try {
      logger.info({}, "render_bfl_attempt");
      const bflPrompt = buildBflPromptText({
        product,
        brandPrefix,
        orientation: body.orientation,
        facadeWidthMeters,
        facadeHeightMeters,
        includeFascia: body.includeBoeideel,
      });
      const { bytes: outBytes, mime: outMime } = await renderViaBfl({
        apiKey: bflKey,
        prompt: bflPrompt,
        sourceBytes,
        referenceParts,
      });
      const matched = await matchSourceAspect(outBytes, outMime, sourceBytes);
      logger.info({ outBytes: matched.bytes.length }, "render_bfl_ok");

      // SAM-mask post-pass: protect boeideel/kozijnen/sky/water from BFL
      // recolor and pull wall pixels toward target_hex (closes ΔE on dark
      // RAL where prompt-side darkenHex can't compensate). Best-effort —
      // any failure here falls back to the raw BFL render rather than
      // bubbling out to the Gemini fallback (BFL itself succeeded).
      let engineTag = "bfl-raw";
      try {
        const productLine = detectLine(product);
        const isMonoFlat = productLine === "mono_flat";
        const isMonoGroove = productLine === "mono_groove";
        const hasStructure = detectStructure(product);
        // Don't solid-fill — SAM masks the whole boat outline including
        // windows, so flatten over-paints kozijnen/ramen which BFL had
        // rendered correctly. ΔE-shift on BFL keeps every detail BFL drew
        // (windows, frames, boeideel) and only nudges the wall hue toward
        // target. Mono Groove still gets the procedural groove overlay on
        // top via the existing branch below.
        const useFlatten = false;
        const seamOrientation = body.orientation === "vertical" ? "vertical" : "horizontal";
        const facadeAlongSeams = seamOrientation === "horizontal"
          ? Number(facadeHeightMeters) * 100
          : Number(facadeWidthMeters) * 100;
        const panelPitchCm = 37;
        const seamCount = isMonoFlat && facadeAlongSeams > 0
          ? Math.max(2, Math.round(facadeAlongSeams / panelPitchCm))
          : isMonoGroove ? 0 : undefined;
        const wp = await buildProtectedWallRender({
          sourceBytes,
          aiRenderBytes: matched.bytes,
          targetHex: product.color_hex ?? undefined,
          flatten: useFlatten,
          flatSeamOrientation: seamOrientation,
          flatSeamCount: seamCount,
        });
        if (wp) {
          let finalBytes: Buffer = wp.bytes;
          // Mono Groove: composite a uniform procedural overlay on top of the
          // protected layer. The mask multiplies into the SVG's own alpha so
          // grooves only appear on wall pixels.
          if (isMonoGroove && facadeWidthMeters && facadeHeightMeters) {
            const grooveSvg = generateGrooveSvg({
              width: wp.width,
              height: wp.height,
              facadeWidthCm: facadeWidthMeters * 100,
              facadeHeightCm: facadeHeightMeters * 100,
              variant: hasStructure ? "groove-structure" : "groove",
              orientation: body.orientation === "vertical" ? "vertical" : "horizontal",
            });
            const grooveRaw = await sharp(Buffer.from(grooveSvg))
              .ensureAlpha()
              .resize(wp.width, wp.height, { fit: "fill" })
              .raw()
              .toBuffer({ resolveWithObject: true });
            const grooveData = Buffer.from(grooveRaw.data);
            for (let i = 0; i < wp.maskRaw.length; i++) {
              grooveData[i * 4 + 3] = Math.round((grooveData[i * 4 + 3] * wp.maskRaw[i]) / 255);
            }
            const maskedGroove = await sharp(grooveData, {
              raw: { width: wp.width, height: wp.height, channels: 4 },
            }).png().toBuffer();
            finalBytes = await sharp(wp.bytes)
              .composite([{ input: maskedGroove, blend: "over" }])
              .toBuffer();
          }
          const finalJpeg = await sharp(finalBytes).jpeg({ quality: 92 }).toBuffer();
          logger.info(
            {
              segMethod: wp.segMethod,
              colorDelta: wp.colorDelta,
              wallMean: wp.wallMean,
              line: productLine,
              structure: hasStructure,
            },
            "render_bfl_wall_protected",
          );
          engineTag = "bfl-protected";
          return Response.json({
            renderDataUrl: `data:image/jpeg;base64,${finalJpeg.toString("base64")}`,
            engine: engineTag,
            segMethod: wp.segMethod,
            colorDelta: wp.colorDelta,
            wallMean: wp.wallMean,
            flattenFillRatio: wp.flattenFillRatio,
            flattenSkipped: wp.flattenSkipped,
            line: productLine,
          });
        }
        logger.warn("render_bfl_wall_protect_unavailable");
      } catch (wpErr) {
        logger.warn({ err: wpErr }, "render_bfl_wall_protect_threw");
      }
      return Response.json({
        renderDataUrl: `data:${matched.mime};base64,${matched.bytes.toString("base64")}`,
        engine: engineTag,
      });
    } catch (err) {
      bflFailReason = err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200);
      logger.warn({ err }, "render_bfl_failed_fallback_to_gemini");
      // intentional fall-through
    }
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: parts,
      config: {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
        // Lowish temperature keeps the model close to the input photos
        // instead of drifting into stylised renders.
        temperature: 0.3,
        // Pin output aspect ratio to match the source photo. Falls back
        // to model default when sharp couldn't read the source meta.
        ...(sourceAspectRatio ? { imageConfig: { aspectRatio: sourceAspectRatio } } : {}),
      },
    });

    const imagePart = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
    if (!imagePart?.inlineData?.data) {
      logger.warn("render_no_image_returned");
      return Response.json({ error: "upstream_no_image" }, { status: 502 });
    }

    const renderedBytes = Buffer.from(imagePart.inlineData.data, "base64");
    const renderedMime = imagePart.inlineData.mimeType ?? "image/png";
    const { bytes: outBytes, mime: outMime } = await matchSourceAspect(
      renderedBytes,
      renderedMime,
      sourceBytes
    );
    return Response.json({
      renderDataUrl: `data:${outMime};base64,${outBytes.toString("base64")}`,
      engine: "gemini",
      bflFailReason,
    });
  } catch (err) {
    logger.error({ err }, "render_gemini_failed");
    return Response.json({ error: "upstream_error" }, { status: 502 });
  }
}

// Gemini's image output sometimes comes back at a different aspect ratio
// than the source photo, leaving a grey/white strip on one edge of the
// rendered facade. Center-crop the result to match the source aspect so
// downloaded files are clean and the frontend doesn't need to compensate.
async function matchSourceAspect(
  rendered: Buffer,
  renderedMime: string,
  source: Buffer
): Promise<{ bytes: Buffer; mime: string }> {
  try {
    const [srcMeta, outMeta] = await Promise.all([
      sharp(source).metadata(),
      sharp(rendered).metadata(),
    ]);
    if (!srcMeta.width || !srcMeta.height || !outMeta.width || !outMeta.height) {
      return { bytes: rendered, mime: renderedMime };
    }
    const srcAspect = srcMeta.width / srcMeta.height;
    const outAspect = outMeta.width / outMeta.height;
    if (Math.abs(srcAspect - outAspect) <= 0.05) {
      return { bytes: rendered, mime: renderedMime };
    }

    let targetW: number;
    let targetH: number;
    if (outAspect > srcAspect) {
      // rendered is wider than source — crop horizontally
      targetH = outMeta.height;
      targetW = Math.round(targetH * srcAspect);
    } else {
      // rendered is taller than source — crop vertically
      targetW = outMeta.width;
      targetH = Math.round(targetW / srcAspect);
    }
    const left = Math.max(0, Math.round((outMeta.width - targetW) / 2));
    const top = Math.max(0, Math.round((outMeta.height - targetH) / 2));

    const cropped = await sharp(rendered)
      .extract({ left, top, width: targetW, height: targetH })
      .jpeg({ quality: 92 })
      .toBuffer();
    return { bytes: cropped, mime: "image/jpeg" };
  } catch (err) {
    // Sharp failure is not fatal — return the original Gemini output rather
    // than failing the whole render. Worst case: user sees the edge strip.
    logger.warn({ err }, "render_aspect_crop_failed");
    return { bytes: rendered, mime: renderedMime };
  }
}
