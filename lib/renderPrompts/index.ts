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
export type StyleShape = "brick" | "wood" | "spanish_tile";
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
  // Recolor toggles (UI section 03)
  includeFascia: boolean;
  windowFrame?: { material: string };
  door?: { material: string; colour: string };
  // User-driven nudge from variant picker. 0 = exact RAL.
  toneNudge?: ToneNudge;
};

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

function windowFrameLineFor(opts: ResolvePromptOpts): string {
  return opts.windowFrame?.material
    ? `Recolour the window frames as ${opts.windowFrame.material}. Keep the windows themselves and the glass exactly as in the source photo.`
    : "Keep the windows, glass and window frames exactly as in the source photo — same colour, same material.";
}

function doorLineFor(opts: ResolvePromptOpts): string {
  return opts.door?.material && opts.door?.colour
    ? `Recolour the doors as ${opts.door.material} in ${opts.door.colour}. Keep the door frames structurally as in the source.`
    : "Keep the doors and door frames exactly as in the source photo — same colour, same material.";
}

function fasciaLineFor(opts: ResolvePromptOpts): string {
  return opts.includeFascia
    ? "Apply cladding to ALL wall surfaces INCLUDING the fascia board (boeideel)."
    : "PRESERVE the fascia board (boeideel) — keep its original colour, do NOT recolour.";
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

  const tone = TONE_PHRASES[opts.toneNudge ?? 0] ?? "";

  return `Recolour the wall surfaces of this building as ${wallDesc}

Keep the roof, gutters, chimneys, sky, water, vegetation, neighbouring buildings, fences and any foreground objects exactly as in the source photo — same colour, same materials, same shape, same brightness and same overall lighting. Do NOT shift the global exposure of the scene to match the wall colour: the sky stays exactly as bright as in the source photo, the water stays exactly as in the source photo, the trees stay exactly as in the source photo, regardless of the new wall colour. Do not invent new windows or features. Match the source framing exactly.
${windowFrameLineFor(opts)}
${doorLineFor(opts)}
${fasciaLineFor(opts)}${tone}`;
}

// Style prompt mirrors the same hybrid: surface descriptor from the
// playground brick/wood naked prompts + the 2x2 preserve block.
function buildStylePrompt(opts: ResolvePromptOpts): string {
  let surfaceDescriptor: string;
  if (opts.shape === "brick") {
    surfaceDescriptor = "the printed brick-look panels shown in the reference image — soft weathered brick pattern in light cream-tan, beige and grey-brown tones with subtle cream mortar lines, on flat panels (very slight relief from the print, not truly protruding bricks). Match the reference image's exact tones and pattern.";
  } else if (opts.shape === "spanish_tile") {
    surfaceDescriptor = "the printed Spanish roof-tile-look panels shown in the reference image — overlapping curved terracotta-style tiles in warm orange-red, ochre or weathered grey tones with shadowed grooves between rows. Match the reference image's exact colour palette and tile shape. NOT brick, NOT flat masonry — these are curved roof-tile shapes printed on flat wall panels.";
  } else {
    surfaceDescriptor = "the printed wood-look panels shown in the reference image — wood-plank appearance with the exact tones, grain pattern and surface texture from the reference. Flat panels with very slight relief from the print, NOT truly grooved planks. Match the reference image's exact tones and pattern.";
  }

  return `Reclad the wall surfaces of this building with ${surfaceDescriptor}

Keep the roof, gutters, chimneys, sky, water, vegetation, neighbouring buildings, fences and any foreground objects exactly as in the source photo — same colour, same materials, same shape, same brightness and same overall lighting. Do NOT shift the global exposure of the scene to match the wall colour: the sky stays exactly as bright as in the source photo, the water stays exactly as in the source photo, the trees stay exactly as in the source photo, regardless of the new wall colour. Do not invent new windows or features. Match the source framing exactly.
${windowFrameLineFor(opts)}
${doorLineFor(opts)}
${fasciaLineFor(opts)}`;
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
  // Fallback — RAL Mono Flat is the safest default for unknown SKUs that
  // still ship with a ral_code, since most of the catalog is Mono Flat.
  if (product.ral_code) {
    return { family: "ral", shape: "mono_flat" };
  }
  // Truly unknown — assume style/brick so the call doesn't crash, ref image
  // (when wired) carries the actual look.
  return { family: "style", shape: "brick" };
}
