import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type HfBody = {
  photoDataUrl?: string;
  prompt?: string;
  strength?: number;
  model?: string;
};

const DEFAULT_MODEL = "timbrooks/instruct-pix2pix";

function stripDataUrlPrefix(dataUrl: string): { mime: string; b64: string } | null {
  const m = /^data:([^;,]+);base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  return { mime: m[1], b64: m[2] };
}

function readEnvCaseInsensitive(name: string): string | undefined {
  const target = name.toLowerCase();
  for (const [k, v] of Object.entries(process.env)) {
    if (k.toLowerCase() === target && v) return v;
  }
  return undefined;
}

export async function POST(req: Request) {
  let body: HfBody;
  try {
    body = (await req.json()) as HfBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const hfKey = readEnvCaseInsensitive("HUGGINGFACE_API_KEY") || readEnvCaseInsensitive("HF_API_KEY");
  if (!hfKey) {
    return NextResponse.json(
      { error: "HUGGINGFACE_API_KEY missing on the server." },
      { status: 500 }
    );
  }

  if (!body.photoDataUrl) {
    return NextResponse.json({ error: "photoDataUrl required." }, { status: 400 });
  }
  const parsed = stripDataUrlPrefix(body.photoDataUrl);
  if (!parsed) {
    return NextResponse.json({ error: "photoDataUrl is not a valid data URL." }, { status: 400 });
  }

  const model = body.model || DEFAULT_MODEL;
  const prompt = (body.prompt ?? "").trim() || "modern facade cladding, architectural photo";
  const strength = typeof body.strength === "number" ? body.strength : 0.85;

  try {
    const response = await fetch(
      `https://api-inference.huggingface.co/models/${encodeURIComponent(model)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${hfKey}`,
          "Content-Type": "application/json",
          "x-use-cache": "false",
          Accept: "image/png",
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            image: parsed.b64,
            strength,
            num_inference_steps: 30,
            guidance_scale: 7.5,
          },
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      if (response.status === 503) {
        return NextResponse.json(
          { error: "HF model is loading (cold start). Try again in 30-60 s." },
          { status: 503 }
        );
      }
      return NextResponse.json(
        { error: `HF (${response.status}): ${text.slice(0, 400)}` },
        { status: response.status }
      );
    }

    const ct = response.headers.get("content-type") ?? "";
    if (ct.startsWith("application/json")) {
      const errJson = await response.json().catch(() => null);
      return NextResponse.json(
        { error: `HF returned JSON instead of image: ${JSON.stringify(errJson).slice(0, 400)}` },
        { status: 502 }
      );
    }

    const buf = await response.arrayBuffer();
    const b64 = Buffer.from(buf).toString("base64");
    const mime = ct || "image/png";
    return NextResponse.json({ renderDataUrl: `data:${mime};base64,${b64}` });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown HF error";
    return NextResponse.json({ error: `HF call failed: ${message}` }, { status: 502 });
  }
}
