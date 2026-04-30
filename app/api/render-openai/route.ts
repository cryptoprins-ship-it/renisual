import OpenAI, { toFile } from "openai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { renderLimit, clientKeyFromRequest, rateLimitResponse } from "@/lib/ratelimit";
import { verifyOrigin } from "@/lib/verifyOrigin";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_DATA_URL_LEN = 8 * 1024 * 1024;

const dataUrl = z
  .string()
  .max(MAX_DATA_URL_LEN, "image_too_large")
  .regex(/^data:image\/(png|jpe?g|webp);base64,/, "not_image_data_url");

const openaiSchema = z.object({
  photoDataUrl: dataUrl,
  prompt: z.string().max(4000).optional().or(z.literal("")),
  size: z.enum(["1024x1024", "1024x1536", "1536x1024", "auto"]).optional(),
});

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

function parseDataUrl(dataUrl: string): { mime: string; bytes: Buffer } | null {
  const m = /^data:([^;,]+);base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  return { mime: m[1], bytes: Buffer.from(m[2], "base64") };
}

// Map upstream errors to a stable, user-safe code without leaking the raw
// message. The internal message is logged server-side for diagnosis.
function classifyError(err: unknown): { status: number; code: string } {
  const e = err as { status?: number; code?: string; message?: string; error?: { message?: string; code?: string } };
  const status = typeof e?.status === "number" ? e.status : 0;
  const apiCode = e?.code ?? e?.error?.code ?? "";
  const message = e?.error?.message ?? e?.message ?? "";
  let code = "unknown";
  if (status === 429 || /quota|rate.?limit|exceed/i.test(message) || /quota|rate/i.test(apiCode)) code = "rate_limit";
  else if (/timeout|aborted|timed out/i.test(message)) code = "timeout";
  else if (/content.?policy|safety|moderation|rejected/i.test(message) || apiCode === "content_policy_violation") code = "content_policy";
  else if (status === 401 || status === 403) code = "auth";
  else if (status >= 500) code = "upstream";
  else if (status >= 400) code = "bad_request";
  return { status: status || 502, code };
}

export async function POST(req: Request) {
  const forbidden = verifyOrigin(req);
  if (forbidden) return forbidden;

  const ip = clientKeyFromRequest(req);
  const { success, reset } = await renderLimit.limit(ip);
  if (!success) {
    logger.warn({ ip, route: "render-openai" }, "render_rate_limited");
    return rateLimitResponse(reset);
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json", code: "bad_request" }, { status: 400 });
  }

  const parsed = openaiSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.flatten(), code: "bad_request" },
      { status: 400 }
    );
  }
  const body = parsed.data;

  const apiKey = readEnvCaseInsensitive("OPENAI_API_KEY");
  if (!apiKey) {
    logger.error("render_openai_missing_key");
    return NextResponse.json({ error: "internal_error", code: "auth" }, { status: 500 });
  }

  const parsedImg = parseDataUrl(body.photoDataUrl);
  if (!parsedImg) {
    return NextResponse.json({ error: "invalid_input", code: "bad_request" }, { status: 400 });
  }

  const prompt = (body.prompt ?? "").trim() ||
    "Replace the facade cladding with the described material; keep windows, doors, sky, surroundings and perspective unchanged.";
  const size = body.size ?? "1024x1024";

  const client = new OpenAI({ apiKey, timeout: 60_000, maxRetries: 0 });

  try {
    const ext = parsedImg.mime.includes("jpeg") || parsedImg.mime.includes("jpg") ? "jpg" : "png";
    const file = await toFile(parsedImg.bytes, `facade.${ext}`, { type: parsedImg.mime });

    const result = await client.images.edit({
      model: "gpt-image-2",
      image: file,
      prompt,
      size,
      n: 1,
    });

    const item = result.data?.[0];
    const b64 = item?.b64_json;
    if (!b64) {
      logger.warn("render_openai_no_image");
      return NextResponse.json(
        { error: "upstream_no_image", code: "upstream" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      renderDataUrl: `data:image/png;base64,${b64}`,
      modelUsed: "gpt-image-2",
    });
  } catch (err) {
    const { status, code } = classifyError(err);
    logger.error({ err, code, status }, "render_openai_failed");
    return NextResponse.json({ error: "upstream_error", code }, { status });
  }
}
