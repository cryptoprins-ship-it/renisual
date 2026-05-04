// Shared BFL FLUX.2 klein-9b render helpers used by both /api/render
// (free tier — single AI render) and /api/render/hybrid (pro tier —
// AI render + procedural overlay).

import sharp from "sharp";
import { logger } from "@/lib/logger";

type InlinePart = { inlineData: { mimeType: string; data: string } };

function readEnvCaseInsensitive(name: string): string | undefined {
  const target = name.toLowerCase();
  for (const k of Object.keys(process.env)) {
    if (k.toLowerCase() === target) {
      const v = process.env[k];
      if (typeof v === "string" && v.trim().length > 0) return v.trim();
    }
  }
  return undefined;
}

export function resolveBflKey(): string | undefined {
  for (const name of ["renisual_bfl_key", "BFL_API_KEY", "Flux_API_Key", "FLUX_API_KEY"]) {
    const raw = process.env[name];
    if (typeof raw === "string" && raw.trim().length > 0) return raw.trim();
  }
  return readEnvCaseInsensitive("renisual_bfl_key")?.trim()
    ?? readEnvCaseInsensitive("BFL_API_KEY")?.trim();
}

export function bflTargetDims(srcW: number, srcH: number): { width: number; height: number } {
  const aspect = srcW / srcH;
  const h = Math.sqrt(1_000_000 / aspect);
  const w = h * aspect;
  const round32 = (n: number) => Math.max(64, Math.round(n / 32) * 32);
  return { width: round32(w), height: round32(h) };
}

export async function renderViaBfl(args: {
  apiKey: string;
  prompt: string;
  sourceBytes: Buffer;
  referenceParts: InlinePart[];
}): Promise<{ bytes: Buffer; mime: string }> {
  const meta = await sharp(args.sourceBytes).metadata();
  const srcW = meta.width ?? 1024;
  const srcH = meta.height ?? 1024;
  const dims = bflTargetDims(srcW, srcH);

  const baseDownscaled = await sharp(args.sourceBytes)
    .rotate()
    .resize(dims.width, dims.height, { fit: "fill" })
    .toBuffer();

  const body: Record<string, unknown> = {
    prompt: args.prompt,
    input_image: baseDownscaled.toString("base64"),
    width: dims.width,
    height: dims.height,
    output_format: "jpeg",
    safety_tolerance: 2,
  };
  args.referenceParts.slice(0, 7).forEach((p, i) => {
    body[`input_image_${i + 2}`] = p.inlineData.data;
  });

  const submitRes = await fetch("https://api.bfl.ai/v1/flux-2-klein-9b", {
    method: "POST",
    headers: {
      "x-key": args.apiKey,
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const submitJson = await submitRes.json().catch(() => ({} as Record<string, unknown>));
  if (!submitRes.ok) {
    const detail = (submitJson as { detail?: string }).detail ?? `status ${submitRes.status}`;
    throw new Error(`bfl_submit_${submitRes.status}_${detail}`);
  }
  const id = (submitJson as { id?: string }).id;
  const pollingUrl = (submitJson as { polling_url?: string }).polling_url;
  if (!pollingUrl) throw new Error("bfl_no_polling_url");

  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500));
    const pollRes = await fetch(pollingUrl, {
      headers: { "x-key": args.apiKey, accept: "application/json" },
    });
    const pollJson = (await pollRes.json().catch(() => ({}))) as {
      status?: string;
      result?: { sample?: string };
    };
    if (pollJson.status === "Ready") {
      const sample = pollJson.result?.sample;
      if (!sample) throw new Error("bfl_no_sample");
      const dlRes = await fetch(sample);
      if (!dlRes.ok) throw new Error(`bfl_download_${dlRes.status}`);
      const buf = Buffer.from(await dlRes.arrayBuffer());
      logger.info({ id }, "bfl_ok");
      return { bytes: buf, mime: "image/jpeg" };
    }
    if (
      pollJson.status === "Error" ||
      pollJson.status === "Failed" ||
      pollJson.status === "Content Moderated"
    ) {
      throw new Error(`bfl_${pollJson.status}`);
    }
  }
  throw new Error(`bfl_timeout_${id ?? "unknown"}`);
}
