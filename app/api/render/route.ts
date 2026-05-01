import { GoogleGenAI, Modality } from "@google/genai";
import sharp from "sharp";
import { z } from "zod";
import { renderLimit, clientKeyFromRequest, rateLimitResponse } from "@/lib/ratelimit";
import { verifyOrigin } from "@/lib/verifyOrigin";
import { logger } from "@/lib/logger";
import { createClient } from "@/utils/supabase/server";

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
  image_url: string | null;
};

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
  const sourceBytes = photoResult.bytes;

  // Resolve the product. Preferred path: productSku → DB row carrying
  // ral_code/color_name/color_hex/description/image_url. Fallback path:
  // free-text label/description (Keralit until it's seeded into Supabase).
  let product: ProductForPrompt;
  let brandPrefix = "";
  if (body.productSku) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("products")
      .select("sku, name, description, ral_code, color_name, color_hex, image_url")
      .eq("sku", body.productSku)
      .eq("active", true)
      .single();
    if (error || !data) {
      logger.warn({ err: error, sku: body.productSku }, "render_product_not_found");
      return Response.json({ error: "product_not_found" }, { status: 404 });
    }
    product = data as ProductForPrompt;
    brandPrefix = "Spanl ";
  } else if (body.productLabel) {
    product = {
      sku: null,
      name: body.productLabel,
      description: body.productDescription ?? null,
      ral_code: null,
      color_name: null,
      color_hex: null,
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

  const promptText = buildPrompt(
    product,
    brandPrefix,
    body.orientation,
    facadeWidthMeters,
    body.includeBoeideel,
  );

  console.log("[render] prompt:", promptText);
  console.log("[render] product:", product.sku, product.color_name, product.ral_code);
  console.log("[render] image_url:", product.image_url, "→ refs:", referenceParts.length);
  console.log("[render] includeBoeideel:", body.includeBoeideel);

  // Send: facade photo + each product-reference photo, with a short label
  // before each so Gemini knows which is which. The reference photos do
  // the heavy lifting — text just describes the action.
  const parts: Array<{ text: string } | InlinePart> = [
    { text: "Facade to modify:" },
    photoPart,
  ];
  referenceParts.forEach((p) => {
    parts.push({ text: "Product to apply:" });
    parts.push(p);
  });
  parts.push({ text: promptText });

  logger.info({ promptLen: promptText.length, refs: referenceParts.length }, "render_prompt");

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
