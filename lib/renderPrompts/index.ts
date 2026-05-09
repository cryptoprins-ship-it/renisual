// BFL klein-9b prompt resolver. Templates derived from playground-validated
// prompts (2026-05-06 session) — known-good baseline, no auto-compensation
// or conditional block stacking. Family + shape + orientation pick the
// template; placeholders get filled from product/UI state.
//
// Family discrimination:
//   - "ral":   product has ral_code/color_hex (Spanl Mono Flat/Groove,
//              Keralit colour variants). Colour token interpolates.
//   - "style": product is decorated/printed (Spanl b10 brick, czs70 stone,
//              Keralit wood-look). The panel reference image carries the
//              exact look; prompt only describes pattern direction.
//
// Adding a new RAL product: insert a DB row with shape + ral_code +
// color_name + color_hex. No code change.
// Adding a new style product: insert a DB row with style_shape + ref_image
// pointing at the panel photo in /public/samples/.

export type Orientation = "horizontal" | "vertical";
export type ProductFamily = "ral" | "style";
export type RalShape = "mono_flat" | "mono_groove" | "mono_textured" | "strip";
export type StyleShape = "brick" | "wood" | "spanish_tile" | "keralit_wood";
export type ToneNudge = -2 | -1 | 0 | 1 | 2;

export type ResolvePromptOpts = {
  family: ProductFamily;
  shape: RalShape | StyleShape;
  orientation: Orientation;
  // RAL family only
  ralCode?: string | null;
  colorName?: string | null;
  colorHex?: string | null;
  // Geometry
  facadeWidthMeters?: number;
  facadeHeightMeters?: number;
  // Window-frame / door / fascia recolour toggles were removed for v1.
  // Fields kept on the type as optional so any leftover server callers
  // do not break compilation; the prompt body always emits "preserve"
  // language regardless of what is passed in.
  includeFascia?: boolean;
  windowFrame?: { material: string };
  door?: { material: string; colour: string };
  // YMPB / YMSG / YPMB SKUs ship with an embossed linen wood-grain
  // surface texture pressed into the paint. Appends a sentence to the
  // RAL wall description so klein-9b actually renders the texture
  // instead of a smooth panel identical to the non-Y SKU.
  linenTexture?: boolean;
  // Keralit Classic met houtnerf — printed wood-grain on PVC. Appends
  // a Keralit-specific texture sentence to the RAL wall block so RAL-
  // routed Keralit colours render with their characteristic wood-grain
  // instead of the smooth Spanl Mono Flat finish. Different wording
  // from linenTexture (which is Spanl-specific weave language).
  keralitWoodGrain?: boolean;
  // User-driven nudge from variant picker. 0 = exact RAL.
  toneNudge?: ToneNudge;
};

// Fixed preserve-language for windows / doors / fascia. v1 strips the
// recolour controls (kozijnen + boeideel) so klein-9b gets a single,
// consistent instruction every render. Restoring the conditional
// recolour lines is a separate "advanced render" mode follow-up.
const PRESERVE_WINDOWS_LINE =
  "Keep the windows, glass and window frames exactly as in the source photo — same colour, same material.";
const PRESERVE_DOORS_LINE =
  "Keep the doors and door frames exactly as in the source photo — same colour, same material.";
const PRESERVE_FASCIA_LINE =
  "PRESERVE the fascia board (boeideel) — keep its original colour, do NOT recolour.";

// Tone-nudge phrasing. Verbal anchors widely spaced because klein-9b
// flattens narrow percentage hints — +1 and +2 collapse onto the same
// shift unless the language itself is dramatically different. The two
// extremes (-2, +2) instruct against shadow/highlight bias on top of
// the lightness shift so they don't just look exposure-clipped.
const TONE_PHRASES: Record<ToneNudge, string> = {
  [-2]: " IMPORTANT: render the wall MUCH DARKER than the exact RAL — clearly a darker shade, roughly 25% darker overall, deeper and richer. NOT just shadowed, the panel pigment itself is darker.",
  [-1]: " Render the wall a touch darker than the exact RAL — about 10% darker overall.",
  [0]: "",
  [1]: " Render the wall a touch lighter than the exact RAL — about 10% lighter overall.",
  [2]: " IMPORTANT: render the wall MUCH LIGHTER than the exact RAL — clearly a lighter shade, roughly 25% lighter overall, brighter and softer. NOT just highlighted, the panel pigment itself is lighter.",
};

// Colour token order matches the playground prompts the user validated:
// "RAL <code> <name> (hex <hex>)". Do NOT reorder — the naked tests
// validated this exact wording.
function colorPhraseFor(opts: ResolvePromptOpts): string {
  const ralPart = opts.ralCode ? `RAL ${opts.ralCode}` : "";
  const name = opts.colorName ?? "matt grey";
  const hexPart = opts.colorHex ? ` (hex ${opts.colorHex})` : "";
  if (ralPart) return `${ralPart} ${name}${hexPart}`;
  return `${name}${hexPart}`;
}

// Hybrid prompt: WALL DESCRIPTION from the BFL playground naked-prompt
// templates (the part that nails the colour and material) + PRESERVE
// BLOCK from scripts/test-bfl-2x2.mjs (the part that anchors klein-9b
// to the source photo in img2img mode).
//
// Why this split: the playground naked prompts work in text-to-image
// mode where there's no source to preserve. Used unchanged in img2img,
// klein-9b takes the scene context ("moored at a canal", "trees in the
// background") as gospel and overwrites the source — verified 2026-05-06
// when an uploaded houseboat photo was replaced by a generic prompt-
// generated woonboot. The 2x2 preserve block ("Keep the roof... Do NOT
// shift the global exposure... sky stays exactly as in source") is what
// keeps klein-9b honest to the user's actual photo.
function buildRalPrompt(opts: ResolvePromptOpts): string {
  const seamAxis = opts.orientation === "vertical" ? "vertical" : "horizontal";

  let wallDesc: string;
  if (opts.shape === "mono_groove") {
    wallDesc = `matt painted metal panels in ${colorPhraseFor(opts)} with PROMINENT recessed ${seamAxis} grooves running across the wall. Each panel is ~37cm wide with one internal mid-groove plus panel-edge grooves, producing clearly visible deep parallel grooves every ~18cm. Each groove is a crisp ~10mm-wide shadow line distinctly recessed into the metal — same metal colour, just negative space casting a sharp shadow. The grooves MUST be visible as a regular cadence of parallel recessed lines. NOT mono flat, NOT planks, NOT wood — one continuous matt metal wall surface marked by deep parallel grooves at ~18cm intervals.`;
  } else if (opts.shape === "strip") {
    wallDesc = `matt painted metal wall panels in ${colorPhraseFor(opts)} with a TEXTURED RELIEF surface — short ${opts.orientation === "vertical" ? "vertical" : "horizontal"} raised rectangular blocks (each block roughly 25cm long and 6cm wide) arranged in an offset running-bond pattern across the panel, like a stylised stone relief but all in one uniform matt metal colour. The blocks rise slightly from the panel face and cast subtle shadows; all blocks are exactly the same matt metal colour with NO colour variation and NO mortar lines. NOT separate planks running across the wall, NOT real brick, NOT grooves cutting through the metal — one continuous textured matt metal wall finish.`;
  } else {
    wallDesc = `smooth painted matt metal panels in ${colorPhraseFor(opts)}, with very faint same-coloured hairline ${seamAxis} seams every ~37cm.`;
  }

  // Embossed linen wood-grain surface texture (YMPB / YMSG / YPMB SKUs).
  // Appended to the wall description so the linen variant reads
  // visibly different from the smooth non-Y panel of the same RAL.
  if (opts.linenTexture) {
    wallDesc = wallDesc.replace(
      /\.$/,
      ", with a fine embossed linen wood-grain texture pressed into the paint — subtle horizontal weave-like fabric pattern catching the light, visibly textured surface (NOT smooth, NOT glossy).",
    );
  }

  // Keralit Classic met houtnerf — printed wood-grain on PVC panels.
  // Different wording from linenTexture (linen weave) because Keralit
  // ships a printed planken-with-wood-grain surface, not a Spanl-style
  // weave. Mutually exclusive with linenTexture in practice (Spanl
  // products never set keralitWoodGrain and vice versa).
  if (opts.keralitWoodGrain) {
    wallDesc = wallDesc.replace(
      /\.$/,
      ", with a printed wood-grain surface texture — fine parallel grain lines running along the panel length plus subtle wood-fibre detail catching the light, visibly textured panel face (NOT smooth, NOT glossy). The wood-grain is a printed pattern on the panel surface; the colour stays exactly as specified by the RAL hex above.",
    );
  }

  const tone = TONE_PHRASES[opts.toneNudge ?? 0] ?? "";

  return `Recolour the wall surfaces of this building as ${wallDesc}

Keep the roof, gutters, chimneys, sky, water, vegetation, neighbouring buildings, fences and any foreground objects exactly as in the source photo — same colour, same materials, same shape, same brightness and same overall lighting. Do NOT shift the global exposure of the scene to match the wall colour: the sky stays exactly as bright as in the source photo, the water stays exactly as in the source photo, the trees stay exactly as in the source photo, regardless of the new wall colour. Do not invent new windows or features. Match the source framing exactly.
${PRESERVE_WINDOWS_LINE}
${PRESERVE_DOORS_LINE}
${PRESERVE_FASCIA_LINE}${tone}`;
}

// Style prompt mirrors the same hybrid: surface descriptor from the
// playground brick/wood naked prompts + the 2x2 preserve block.
function buildStylePrompt(opts: ResolvePromptOpts): string {
  let surfaceDescriptor: string;
  if (opts.shape === "brick") {
    surfaceDescriptor = "the printed brick-look panels shown in the reference image — soft weathered brick pattern in light cream-tan, beige and grey-brown tones with subtle cream mortar lines, on flat panels (very slight relief from the print, not truly protruding bricks). Match the reference image's exact tones and pattern.";
  } else if (opts.shape === "spanish_tile") {
    surfaceDescriptor = "the printed Spanish roof-tile-look panels shown in the reference image — overlapping curved terracotta-style tiles in warm orange-red, ochre or weathered grey tones with shadowed grooves between rows. Match the reference image's exact colour palette and tile shape. NOT brick, NOT flat masonry — these are curved roof-tile shapes printed on flat wall panels.";
  } else if (opts.shape === "keralit_wood") {
    // Keralit-only branch. Catalog ships no hex, so the server
    // computes one from the per-color thumbnail swatch via sharp
    // (mean RGB of centre crop) and passes it via opts.colorHex.
    // Prompt mirrors Spanl RAL terseness — single noun phrase,
    // hex inline, no ALL CAPS, no negative directives. Spanl PBW
    // is NOT routed here (PBW keeps the original wood prompt
    // below) because the 5-iteration prompt thrash on this branch
    // was Keralit-specific.
    if (opts.colorHex) {
      surfaceDescriptor = `matt cladding panels painted in colour hex ${opts.colorHex}, with the surface pattern and grain shown in the reference image (image 2).`;
    } else {
      surfaceDescriptor =
        "matt cladding panels with the colour, surface pattern, and grain shown in the reference image (image 2).";
    }
  } else {
    // shape === "wood" — Spanl PBW (printed wood SKUs). Restored
    // to the exact text from before the Keralit debugging chain
    // started. Do NOT modify when iterating on Keralit colour-
    // pinning — Keralit lives on the keralit_wood branch above.
    surfaceDescriptor = "the printed wood-look panels shown in the reference image — wood-plank appearance with the exact tones, grain pattern and surface texture from the reference. Flat panels with very slight relief from the print, NOT truly grooved planks. Match the reference image's exact tones and pattern.";
  }

  return `Reclad the wall surfaces of this building with ${surfaceDescriptor}

Keep the roof, gutters, chimneys, sky, water, vegetation, neighbouring buildings, fences and any foreground objects exactly as in the source photo — same colour, same materials, same shape, same brightness and same overall lighting. Do NOT shift the global exposure of the scene to match the wall colour: the sky stays exactly as bright as in the source photo, the water stays exactly as in the source photo, the trees stay exactly as in the source photo, regardless of the new wall colour. Do not invent new windows or features. Match the source framing exactly.
${PRESERVE_WINDOWS_LINE}
${PRESERVE_DOORS_LINE}
${PRESERVE_FASCIA_LINE}`;
}

export function resolveBflPrompt(opts: ResolvePromptOpts): string {
  if (opts.family === "style") return buildStylePrompt(opts);
  return buildRalPrompt(opts);
}

// Heuristics to derive (family, shape) from a Spanl/Keralit product row.
// SKU prefixes are the most reliable discriminator we have today; switch
// to a dedicated DB column once the catalog is reorganised.
//
// Spanl SKU conventions:
//   - PB***  → Mono Flat (RAL family)
//   - SG***  → Mono Groove (RAL family)
//   - YMSG / YMPB → Mono Groove/Flat with linen structure (RAL family)
//   - B10-*  → printed brick (style family)
//   - CZS70-* → printed stone/brick (style family)
//   - PBW***-* → printed wood (style family)
export function detectFamilyAndShape(product: {
  sku?: string | null;
  ral_code?: string | null;
  name?: string | null;
}): { family: ProductFamily; shape: RalShape | StyleShape } {
  const sku = (product.sku ?? "").toUpperCase();
  if (sku.startsWith("CZS70")) {
    return { family: "style", shape: "spanish_tile" };
  }
  if (sku.startsWith("B10")) {
    return { family: "style", shape: "brick" };
  }
  if (sku.startsWith("PBW")) {
    return { family: "style", shape: "wood" };
  }
  if (sku.startsWith("SG") || sku.startsWith("YMSG")) {
    return { family: "ral", shape: "mono_groove" };
  }
  if (sku.startsWith("TS")) {
    return { family: "ral", shape: "strip" };
  }
  if (sku.startsWith("PB") || sku.startsWith("YMPB")) {
    return { family: "ral", shape: "mono_flat" };
  }
  // Keralit panels reach here with no SKU. Two sub-cases:
  //  - Keralit colour with a known RAL match (e.g. 322 Staalblauw → RAL
  //    5011): route.ts inflates ral_code + color_hex from RAL_HEX before
  //    calling us. Send those through the proven Spanl mono_flat path
  //    so klein-9b's RAL handling kicks in.
  //  - Keralit colour without RAL (wood-look colours like Bruin eiken,
  //    Vergrijsd ceder, all Pure mat): no ral_code, no DB hex. Stays on
  //    keralit_wood with swatch-extracted hex.
  if ((product.name ?? "").toLowerCase().startsWith("keralit")) {
    if (product.ral_code) {
      return { family: "ral", shape: "mono_flat" };
    }
    return { family: "style", shape: "keralit_wood" };
  }
  // Fallback — RAL Mono Flat is the safest default for unknown SKUs that
  // still ship with a ral_code, since most of the catalog is Mono Flat.
  if (product.ral_code) {
    return { family: "ral", shape: "mono_flat" };
  }
  // Truly unknown — assume style/brick so the call doesn't crash, ref image
  // (when wired) carries the actual look.
  return { family: "style", shape: "brick" };
}
