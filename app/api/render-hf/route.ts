import { InferenceClient } from "@huggingface/inference";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type HfBody = {
  photoDataUrl?: string;
  prompt?: string;
  strength?: number;
  model?: string;
  provider?: string;
};

const DEFAULT_MODEL = "black-forest-labs/FLUX.1-Kontext-dev";
const FALLBACK_MODELS = [
  "Qwen/Qwen-Image-Edit",
  "timbrooks/instruct-pix2pix",
];

function stripDataUrlPrefix(dataUrl: string): { mime: string; b64: string } | null {
  const m = /^data:([^;,]+);base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  return { mime: m[1], b64: m[2] };
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

function base64ToBlob(b64: string, mime: string): Blob {
  const bytes = Buffer.from(b64, "base64");
  return new Blob([new Uint8Array(bytes)], { type: mime });
}

async function blobToBase64DataUrl(blob: Blob): Promise<string> {
  const buf = Buffer.from(await blob.arrayBuffer());
  const mime = blob.type || "image/png";
  return `data:${mime};base64,${buf.toString("base64")}`;
}

type CallResult = { ok: true; dataUrl: string; modelUsed: string } | { ok: false; error: string };

async function tryModel(
  client: InferenceClient,
  model: string,
  imageBlob: Blob,
  prompt: string,
  strength: number
): Promise<CallResult> {
  try {
    const result = await client.imageToImage({
      model,
      inputs: imageBlob,
      parameters: {
        prompt,
        guidance_scale: 7.5,
        num_inference_steps: 30,
        strength,
      },
    });
    const dataUrl = await blobToBase64DataUrl(result);
    return { ok: true, dataUrl, modelUsed: model };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: `${model}: ${message}` };
  }
}

export async function POST(req: Request) {
  let body: HfBody;
  try {
    body = (await req.json()) as HfBody;
  } catch (err) {
    console.error("[render-hf] JSON parse failed:", err);
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const hfKey = readEnvCaseInsensitive("HUGGINGFACE_API_KEY") || readEnvCaseInsensitive("HF_API_KEY");
  if (!hfKey) {
    console.error("[render-hf] HUGGINGFACE_API_KEY missing");
    return NextResponse.json(
      { error: "HUGGINGFACE_API_KEY missing on the server.", hint: "Add it in Vercel env vars and redeploy." },
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

  const prompt = (body.prompt ?? "").trim() || "Replace the facade cladding with the described modern panels, keep windows/doors/sky/perspective unchanged.";
  const strength = typeof body.strength === "number" ? body.strength : 0.78;
  const requestedModel = body.model || DEFAULT_MODEL;

  const client = new InferenceClient(hfKey);
  const imageBlob = base64ToBlob(parsed.b64, parsed.mime);

  const tried: string[] = [];
  const candidates = [requestedModel, ...FALLBACK_MODELS.filter((m) => m !== requestedModel)];

  for (const model of candidates) {
    const result = await tryModel(client, model, imageBlob, prompt, strength);
    if (result.ok) {
      console.log(`[render-hf] success with ${result.modelUsed}, prior tries: ${JSON.stringify(tried)}`);
      return NextResponse.json({
        renderDataUrl: result.dataUrl,
        modelUsed: result.modelUsed,
        triedBeforeSuccess: tried,
      });
    }
    console.error(`[render-hf] ${model} failed: ${result.error}`);
    tried.push(result.error);
  }

  return NextResponse.json(
    {
      error: "All HF models failed.",
      tried,
      hint:
        "Check HF token permissions (must include 'inference'). FLUX.1-Kontext-dev requires accepting its license on the model page. Some models need a paid Inference Endpoint or Inference Providers credit.",
    },
    { status: 502 }
  );
}
