// Pro-tier hybrid render route (post-cleanup 2026-05-06):
// Single BFL klein-9b call, raw output returned. Pre-cleanup this route
// also did SAM segmentation + ΔE correction + groove SVG overlay; that
// machinery introduced exposure-drift bugs on white targets and was
// shown unnecessary by playground validation on 2026-05-06 (klein-9b
// renders cladding + colour + grooves correctly from prompt alone).
// Kept as a separate endpoint so the existing smoke-test wiring works,
// but functionally a thin wrapper around renderViaBfl.

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

function buildHybridPrompt(body: Body): string {
  const ral = body.ralCode ? `RAL ${body.ralCode}` : "";
  const colorName = body.colorName ?? "matt grey";
  const targetHex = body.colorHex ?? "#B5B8B1";
  const colorPhrase = `matt ${colorName} ${ral} (hex ${targetHex})`;

  const isWhite = ["9003", "9010"].includes(body.ralCode ?? "");
  const isBlack = body.ralCode === "9005";
  const colorWarn = isWhite
    ? "Render as PURE COOL WHITE. NOT cream, NOT beige."
    : isBlack
    ? "Render as TRUE COOL BLACK. NOT brown."
    : "Render at the matt RAL color. NOT warm-tinted.";

  const isGroove = body.variant === "groove" || body.variant === "groove-structure";
  const orientWord = body.orientation === "vertical" ? "vertical" : "horizontal";
  const surface = isGroove
    ? `painted matt metal cladding with crisp ${orientWord} grooves recessed into the metal every ~13cm. Each groove is a 5mm shadow line — clearly visible but same metal colour, never wood, never planks.`
    : `painted matt metal cladding with very faint hairline ${orientWord} seams every ~37cm.`;

  const orientLine =
    body.orientation === "vertical"
      ? isGroove
        ? "Grooves run top-to-bottom across the facade."
        : "Hairline seams run top-to-bottom across the facade."
      : isGroove
        ? "Grooves run left-to-right across the facade."
        : "Hairline seams run left-to-right across the facade.";

  return `Recolour the wall surfaces of this building in ${colorPhrase}. ${surface} ${orientLine}

Keep the roof, gutters, chimneys, sky, water, vegetation, neighbouring buildings, fences and any foreground objects exactly as in the source photo — same colour, same materials, same shape, same brightness and same overall lighting. Keep windows, glass and window frames exactly as in the source photo. Keep doors and door frames exactly as in the source photo. Do not invent new windows or features. Match the source framing exactly.

${colorWarn}`;
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

  const finalJpeg = await sharp(aiRender).jpeg({ quality: 92 }).toBuffer();
  logger.info({ variant: body.variant }, "render_hybrid_ok");
  const response: Record<string, unknown> = {
    renderDataUrl: `data:image/jpeg;base64,${finalJpeg.toString("base64")}`,
    variant: body.variant,
  };
  if (body.debug) {
    response.debugAiRenderDataUrl = `data:image/jpeg;base64,${aiRender.toString("base64")}`;
  }
  return Response.json(response);
}
