// Paint-mode render: semantic recolor via Gemini 2.5 Flash Image ("nano-banana").
// Caller sends original photo + target RAL code. Model recolors the main
// facade in place, preserving windows, water, sky, neighboring buildings.
//
// FLUX blijft leidend voor panel-renders (/api/render). Deze route is alleen
// voor paint-mode (RAL recolor van bestaande gevel).
//
// Shares cookie/IP credit cap met /api/render.

import sharp from "sharp";
sharp.cache(false);
sharp.simd(false);
sharp.concurrency(1);

import { GoogleGenAI, Modality } from "@google/genai";

import {
  consumeCredit,
  formatSetCookie,
  getUserKey,
  type SetCookieDirective,
} from "@/lib/credits";
import {
  renderLimit,
  clientKeyFromRequest,
  rateLimitResponse,
} from "@/lib/ratelimit";
import { verifyOrigin } from "@/lib/verifyOrigin";
import { logger } from "@/lib/logger";
import { RAL_COLORS } from "@/lib/ralColors";
import { applyWatermark } from "@/lib/watermark";

export const runtime = "nodejs";
export const maxDuration = 60;

function withCookie(
  response: Response,
  setCookie: SetCookieDirective | null,
): Response {
  if (setCookie) {
    response.headers.append(
      "Set-Cookie",
      formatSetCookie(setCookie, process.env.NODE_ENV === "production"),
    );
  }
  return response;
}

function jsonResponse(
  status: number,
  body: unknown,
  setCookie: SetCookieDirective | null,
): Response {
  return withCookie(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
    setCookie,
  );
}

function resolveGeminiKey(): string | undefined {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.Gemini_API_Key ||
    process.env.gemini_api_key
  );
}

function buildPrompt(ralCode: string, ralName: string, ralHex: string): string {
  return [
    `Recolor only the main building's facade/cladding to RAL ${ralCode} ${ralName} (${ralHex}).`,
    `Apply the new color as if it were freshly painted exterior wall paint — matte finish, photorealistic.`,
    `Preserve everything else exactly: windows, doors, frames, roof, gutters, sky, water, ground, vegetation, neighboring buildings, lighting, shadows, reflections, camera angle, composition.`,
    `Do not add, remove, or stylize any objects. Output must look like the same photo with only the facade color changed.`,
  ].join(" ");
}

function aspectRatioFromMeta(W: number, H: number): string | undefined {
  const supported: Array<[number, number, string]> = [
    [1, 1, "1:1"],
    [2, 3, "2:3"],
    [3, 2, "3:2"],
    [3, 4, "3:4"],
    [4, 3, "4:3"],
    [9, 16, "9:16"],
    [16, 9, "16:9"],
    [21, 9, "21:9"],
  ];
  const target = W / H;
  let best: string | undefined;
  let bestDelta = Infinity;
  for (const [a, b, label] of supported) {
    const delta = Math.abs(a / b - target);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = label;
    }
  }
  return best;
}

export async function POST(request: Request) {
  const forbidden = verifyOrigin(request);
  if (forbidden) return forbidden;

  const ip = clientKeyFromRequest(request);
  const { userKey, setCookie } = getUserKey(request);

  const credit = await consumeCredit(userKey);
  if (!credit.ok) {
    logger.warn({ ip, reason: credit.reason }, "paint_credit_cap");
    return jsonResponse(
      402,
      {
        error: "credit_cap",
        reason: credit.reason,
        remaining: 0,
        resetAt: credit.resetAt,
      },
      setCookie,
    );
  }

  try {
    const { success, reset } = await renderLimit.limit(ip);
    if (!success) {
      logger.warn({ ip }, "paint_rate_limited");
      return rateLimitResponse(reset);
    }
  } catch (err) {
    logger.warn({ err }, "paint_ratelimit_failopen");
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch (err) {
    return jsonResponse(400, { error: "bad_form", detail: String(err) }, setCookie);
  }

  const photoFile = form.get("photo");
  const ralCode = String(form.get("ralCode") ?? "").trim();

  if (!(photoFile instanceof File) || photoFile.size === 0) {
    return jsonResponse(400, { error: "missing_photo" }, setCookie);
  }

  const ral = RAL_COLORS[ralCode];
  if (!ral) {
    return jsonResponse(400, { error: "unknown_ral", ralCode }, setCookie);
  }

  const apiKey = resolveGeminiKey();
  if (!apiKey) {
    logger.error("paint_no_gemini_key");
    return jsonResponse(503, { error: "ai_unavailable" }, setCookie);
  }

  const photoBuf = Buffer.from(await photoFile.arrayBuffer());
  const rotated = await sharp(photoBuf).rotate().toBuffer();
  const meta = await sharp(rotated).metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;
  if (W < 600 || H < 400) {
    return jsonResponse(
      400,
      { error: "photo_too_small", width: W, height: H },
      setCookie,
    );
  }

  // Resize input down to keep Gemini fast + cheap. Max 1536 long side preserves
  // detail while keeping body ~1-2MB.
  const MAX_DIM = 1536;
  const inputBuf =
    Math.max(W, H) > MAX_DIM
      ? await sharp(rotated)
          .resize(MAX_DIM, MAX_DIM, { fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 90 })
          .toBuffer()
      : await sharp(rotated).jpeg({ quality: 92 }).toBuffer();

  const prompt = buildPrompt(ralCode, ral.name, ral.hex);
  const aspectRatio = aspectRatioFromMeta(W, H);

  const ai = new GoogleGenAI({ apiKey });
  const t0 = Date.now();

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: inputBuf.toString("base64"),
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
        temperature: 0.25,
        ...(aspectRatio ? { imageConfig: { aspectRatio } } : {}),
      },
    });

    const imagePart = response.candidates?.[0]?.content?.parts?.find(
      (p) => p.inlineData?.data,
    );
    if (!imagePart?.inlineData?.data) {
      logger.warn("paint_no_image_returned");
      return jsonResponse(502, { error: "upstream_no_image" }, setCookie);
    }

    const renderedBytes = Buffer.from(imagePart.inlineData.data, "base64");
    const branded = await applyWatermark(renderedBytes, {
      caption: "Gemaakt met Renisual",
      url: "renisual.com",
    });

    const ms = Date.now() - t0;
    logger.info(
      { ralCode, W, H, inputW: Math.min(W, MAX_DIM), ms, engine: "gemini-nb" },
      "paint_ok",
    );

    return withCookie(
      new Response(new Uint8Array(branded), {
        status: 200,
        headers: {
          "content-type": "image/jpeg",
          "x-credit-remaining": String(credit.remaining),
          "x-engine": "gemini-nb",
        },
      }),
      setCookie,
    );
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? err.message : String(err) },
      "paint_gemini_failed",
    );
    return jsonResponse(502, { error: "ai_failed" }, setCookie);
  }
}
