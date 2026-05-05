// Pro-tier hybrid render route:
//   1. Calls BFL klein-9b for an AI render (one call per (photo, color))
//   2. Sends source + render to seg.mpsecurity.cloud/segment for wall mask
//   3. Generates a procedural groove SVG pattern per variant
//   4. Masks the pattern to wall pixels and composites onto the AI render
//
// Same response shape as /api/render so the frontend can swap between
// them. Pro tier gates this route via a feature flag (TBD); for now any
// caller can hit it as long as origin matches and rate-limit holds.

import sharp from "sharp";
import { z } from "zod";

// Vercel warm-instance memory hygiene — see /api/render for rationale.
sharp.cache(false);
sharp.simd(false);
sharp.concurrency(1);
import { renderLimit, clientKeyFromRequest, rateLimitResponse } from "@/lib/ratelimit";
import { verifyOrigin } from "@/lib/verifyOrigin";
import { logger } from "@/lib/logger";
import { resolveBflKey, renderViaBfl } from "@/lib/bflRender";
import { buildProtectedWallRender } from "@/lib/wallProtect";
import { generateGrooveSvg, type Variant } from "@/lib/groovePattern";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_DATA_URL_LEN = 8 * 1024 * 1024;

const dataUrl = z
  .string()
  .max(MAX_DATA_URL_LEN, "image_too_large")
  .regex(/^data:image\/(png|jpe?g|webp);base64,/, "not_image_data_url");

const schema = z.object({
  photoDataUrl: dataUrl,
  variant: z.enum(["flat", "groove", "groove-structure"]).default("flat"),
  orientation: z.enum(["vertical", "horizontal"]).default("horizontal"),
  ralCode: z.string().max(8).optional(),
  colorHex: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  colorName: z.string().max(64).optional(),
  facadeWidthCm: z.number().finite().positive().max(100000).default(1350),
  facadeHeightCm: z.number().finite().positive().max(100000).default(355),
  debug: z.boolean().optional(),
});

type Body = z.infer<typeof schema>;

function parseDataUrl(dataUrl: string): { mime: string; bytes: Buffer } | null {
  const m = /^data:([^;,]+);base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  return { mime: m[1], bytes: Buffer.from(m[2], "base64") };
}

// Anti-bias darken — copied from /api/render so hybrid path stays
// independent. Whites are skipped (already at brightness ceiling).
function darkenHex(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r0 = (n >> 16) & 0xff, g0 = (n >> 8) & 0xff, b0 = n & 0xff;
  const lum = (0.2126 * r0 + 0.7152 * g0 + 0.0722 * b0) / 255;
  if (lum > 0.82) return hex;
  const eff = lum > 0.65 ? amount * 0.5 : amount;
  const r = Math.max(0, Math.round(r0 * (1 - eff)));
  const g = Math.max(0, Math.round(g0 * (1 - eff)));
  const b = Math.max(0, Math.round(b0 * (1 - eff)));
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

function buildHybridPrompt(body: Body): string {
  const ral = body.ralCode ? `RAL ${body.ralCode}` : "";
  const colorName = body.colorName ?? "matt grey";
  const targetHex = body.colorHex ?? "#B5B8B1";
  const renderHex = darkenHex(targetHex, 0.15);
  const compensated = renderHex !== targetHex;
  const colorPhrase = compensated
    ? `matt ${colorName} ${ral} (target ${targetHex}, render at ${renderHex} to compensate model lightening bias)`
    : `matt ${colorName} ${ral} (hex ${targetHex})`;

  const isWhite = ["9003", "9010"].includes(body.ralCode ?? "");
  const isBlack = body.ralCode === "9005";
  const colorWarn = isWhite
    ? "Render as PURE COOL WHITE. NOT cream, NOT beige."
    : isBlack
    ? "Render as TRUE COOL BLACK. NOT brown."
    : "Render at the matt RAL color. NOT warm-tinted.";

  // For the hybrid pipeline the AI produces a Mono Flat painted-metal
  // render in the target color. If klein-9b shows any panel rhythm at all
  // (it usually does — cladding has visible panel breaks every 37cm), it
  // MUST follow the requested orientation. Otherwise the result looks
  // inconsistent vs. the user's choice.
  const orientLine =
    body.orientation === "vertical"
      ? "Panels are mounted VERTICALLY — visible panel seams run TOP-TO-BOTTOM (vertical hairlines spaced ~37cm apart across the facade WIDTH). NO horizontal seams. NO horizontal break lines. NO horizontal floor divisions."
      : "Panels are mounted HORIZONTALLY — visible panel seams run LEFT-TO-RIGHT (horizontal hairlines spaced ~37cm apart across the facade HEIGHT). NO vertical seams. NO vertical break lines.";

  return `RECOLOR AND RE-CLAD this wall as smooth matt painted metal cladding. Take the existing wall siding rhythm from the source photo and re-render it in the new color. Keep all positions and geometry — only color and material change.

WALL COLOR: ${colorPhrase}. ${colorWarn} The walls MUST end up this exact color. Do NOT render walls as wood, do NOT render as cream/beige, do NOT keep them white if the requested color is grey or black.

WALL MATERIAL: smooth matt painted metal sheet. NOT wood, NOT planks, NOT siding boards. Panel-to-panel shadows must be near-invisible hairlines, NOT deep grooves.

PANEL ORIENTATION (mandatory): ${orientLine}

KEEP UNCHANGED in original colors:
- Windows, glazing, window frames (kozijnen)
- Doors, door frames
- Roof, gutters, chimneys
- Sky, water, vegetation, neighbors, fences, foreground objects

DO NOT INVENT new windows or features. Match input image framing exactly.`;
}

export async function POST(request: Request) {
  const forbidden = verifyOrigin(request);
  if (forbidden) return forbidden;

  const ip = clientKeyFromRequest(request);
  try {
    const { success, reset } = await renderLimit.limit(ip);
    if (!success) {
      logger.warn({ ip }, "render_hybrid_rate_limited");
      return rateLimitResponse(reset);
    }
  } catch {
    // fail-open per existing /api/render policy
  }

  const apiKey = resolveBflKey();
  if (!apiKey) {
    logger.error("render_hybrid_missing_bfl_key");
    return Response.json({ error: "internal_error" }, { status: 500 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    logger.warn({ issues: parsed.error.flatten() }, "render_hybrid_invalid_input");
    return Response.json({ error: "invalid_input", issues: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;

  const photo = parseDataUrl(body.photoDataUrl);
  if (!photo) return Response.json({ error: "bad_photo" }, { status: 400 });
  const sourceBytes = photo.bytes;

  // 1. AI render via BFL (always smooth flat — variant detail comes from overlay)
  let aiRender: Buffer;
  try {
    const prompt = buildHybridPrompt(body);
    logger.info({ variant: body.variant, ral: body.ralCode }, "render_hybrid_bfl_attempt");
    const result = await renderViaBfl({
      apiKey,
      prompt,
      sourceBytes,
      referenceParts: [],
    });
    aiRender = result.bytes;
  } catch (err) {
    logger.error({ err }, "render_hybrid_bfl_failed");
    return Response.json({ error: "ai_render_failed" }, { status: 502 });
  }

  // 2. SAM seg + ΔE correction + boeideel/kozijn protection (shared with
  //    /api/render via lib/wallProtect).
  const isFlat = body.variant === "flat";
  const seamOrientation = body.orientation === "vertical" ? "vertical" : "horizontal";
  const facadeAlongSeamsCm = seamOrientation === "horizontal" ? body.facadeHeightCm : body.facadeWidthCm;
  const flatSeamCount = isFlat && facadeAlongSeamsCm > 0
    ? Math.max(2, Math.round(facadeAlongSeamsCm / 37))
    : undefined;
  const wp = await buildProtectedWallRender({
    sourceBytes,
    aiRenderBytes: aiRender,
    targetHex: body.colorHex,
    flatten: isFlat,
    flatSeamOrientation: seamOrientation,
    flatSeamCount,
  });
  if (!wp) {
    logger.warn("render_hybrid_seg_unavailable_returning_ai_render");
    return Response.json({
      renderDataUrl: `data:image/jpeg;base64,${aiRender.toString("base64")}`,
      degraded: true,
      note: "segmentation service unavailable — returned raw AI render",
    });
  }
  const W = wp.width;
  const H = wp.height;
  const maskData = wp.maskRaw;
  const protectedLayer = wp.bytes;
  const tightMaskPng = await sharp(maskData, { raw: { width: W, height: H, channels: 1 } })
    .png()
    .toBuffer();

  const buildDebugFields = async (): Promise<Record<string, unknown>> => {
    return {
      debugSegMaskDataUrl: `data:image/png;base64,${tightMaskPng.toString("base64")}`,
      debugTightMaskDataUrl: `data:image/png;base64,${tightMaskPng.toString("base64")}`,
      debugAiRenderDataUrl: `data:image/jpeg;base64,${aiRender.toString("base64")}`,
    };
  };

  // 3. Mono Flat: protected layer is the final result (no overlay).
  if (body.variant === "flat") {
    const finalFlat = await sharp(protectedLayer).jpeg({ quality: 92 }).toBuffer();
    logger.info(
      { variant: "flat", segMethod: wp.segMethod, colorDelta: wp.colorDelta, wallMean: wp.wallMean },
      "render_hybrid_ok",
    );
    const response: Record<string, unknown> = {
      renderDataUrl: `data:image/jpeg;base64,${finalFlat.toString("base64")}`,
      variant: body.variant,
      segMethod: wp.segMethod,
    };
    if (body.debug) Object.assign(response, await buildDebugFields());
    return Response.json(response);
  }

  // 6. Groove / structure: procedural overlay on top of the protected layer.
  //    Multiply the SVG's own alpha by the wall mask so the pattern only
  //    appears on wall pixels (and only where the SVG itself is opaque).
  const grooveSvg = generateGrooveSvg({
    width: W,
    height: H,
    facadeWidthCm: body.facadeWidthCm,
    facadeHeightCm: body.facadeHeightCm,
    variant: body.variant as Variant,
    orientation: body.orientation,
  });
  const grooveRaw = await sharp(Buffer.from(grooveSvg))
    .ensureAlpha()
    .resize(W, H, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const grooveData = Buffer.from(grooveRaw.data);
  for (let i = 0; i < maskData.length; i++) {
    grooveData[i * 4 + 3] = Math.round((grooveData[i * 4 + 3] * maskData[i]) / 255);
  }
  const maskedPattern = await sharp(grooveData, {
    raw: { width: W, height: H, channels: 4 },
  })
    .png()
    .toBuffer();

  const final = await sharp(protectedLayer)
    .composite([{ input: maskedPattern, blend: "over" }])
    .jpeg({ quality: 92 })
    .toBuffer();

  logger.info(
    { variant: body.variant, segMethod: wp.segMethod, colorDelta: wp.colorDelta, wallMean: wp.wallMean },
    "render_hybrid_ok",
  );
  const response: Record<string, unknown> = {
    renderDataUrl: `data:image/jpeg;base64,${final.toString("base64")}`,
    variant: body.variant,
    segMethod: wp.segMethod,
  };
  if (body.debug) Object.assign(response, await buildDebugFields());
  return Response.json(response);
}
