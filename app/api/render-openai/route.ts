import OpenAI, { toFile } from "openai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type OpenAIBody = {
  photoDataUrl?: string;
  prompt?: string;
  size?: "1024x1024" | "1024x1536" | "1536x1024" | "auto";
};

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

function classifyError(err: unknown): { status: number; code: string; message: string } {
  const e = err as { status?: number; code?: string; message?: string; error?: { message?: string; code?: string } };
  const status = typeof e?.status === "number" ? e.status : 0;
  const apiCode = e?.code ?? e?.error?.code ?? "";
  const message = e?.error?.message ?? e?.message ?? "Unknown OpenAI error";
  let code = "unknown";
  if (status === 429 || /quota|rate.?limit|exceed/i.test(message) || /quota|rate/i.test(apiCode)) code = "rate_limit";
  else if (/timeout|aborted|timed out/i.test(message)) code = "timeout";
  else if (/content.?policy|safety|moderation|rejected/i.test(message) || apiCode === "content_policy_violation") code = "content_policy";
  else if (status === 401 || status === 403) code = "auth";
  else if (status >= 500) code = "upstream";
  else if (status >= 400) code = "bad_request";
  return { status: status || 502, code, message };
}

export async function POST(req: Request) {
  let body: OpenAIBody;
  try {
    body = (await req.json()) as OpenAIBody;
  } catch (err) {
    console.error("[render-openai] JSON parse failed:", err);
    return NextResponse.json({ error: "Invalid JSON.", code: "bad_request" }, { status: 400 });
  }

  const apiKey = readEnvCaseInsensitive("OPENAI_API_KEY");
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY missing on the server.", code: "auth" },
      { status: 500 }
    );
  }

  if (!body.photoDataUrl) {
    return NextResponse.json({ error: "photoDataUrl required.", code: "bad_request" }, { status: 400 });
  }
  const parsed = parseDataUrl(body.photoDataUrl);
  if (!parsed) {
    return NextResponse.json({ error: "photoDataUrl is not a valid data URL.", code: "bad_request" }, { status: 400 });
  }

  const prompt = (body.prompt ?? "").trim() ||
    "Replace the facade cladding with the described material; keep windows, doors, sky, surroundings and perspective unchanged.";
  const size = body.size ?? "1024x1024";

  const client = new OpenAI({ apiKey, timeout: 60_000, maxRetries: 0 });

  try {
    const ext = parsed.mime.includes("jpeg") || parsed.mime.includes("jpg") ? "jpg" : "png";
    const file = await toFile(parsed.bytes, `facade.${ext}`, { type: parsed.mime });

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
      return NextResponse.json(
        { error: "OpenAI returned no image data.", code: "upstream" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      renderDataUrl: `data:image/png;base64,${b64}`,
      modelUsed: "gpt-image-2",
    });
  } catch (err) {
    const { status, code, message } = classifyError(err);
    console.error(`[render-openai] failed (${code}, ${status}): ${message}`);
    return NextResponse.json({ error: message, code }, { status });
  }
}
