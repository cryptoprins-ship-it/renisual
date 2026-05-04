// Calls the renisual-segmentation microservice on seg.mpsecurity.cloud
// to obtain a wall mask (PNG) for a rendered facade. Used only by the
// pro-tier hybrid pipeline.

import { logger } from "@/lib/logger";

function readEnv(name: string): string | undefined {
  for (const k of Object.keys(process.env)) {
    if (k.toLowerCase() === name.toLowerCase()) {
      const v = process.env[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  return undefined;
}

export async function segmentWallMask(args: {
  sourceBytes: Buffer;
  renderBytes: Buffer;
}): Promise<{ maskBytes: Buffer; width: number; height: number; method: string } | null> {
  const url = readEnv("SEG_API_URL");
  const token = readEnv("SEG_API_TOKEN");
  if (!url || !token) {
    logger.warn("seg_api_not_configured");
    return null;
  }

  const start = Date.now();
  try {
    const res = await fetch(`${url.replace(/\/+$/, "")}/segment`, {
      method: "POST",
      headers: {
        "x-api-token": token,
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sourceB64: args.sourceBytes.toString("base64"),
        renderB64: args.renderBytes.toString("base64"),
      }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      logger.warn({ status: res.status, body: txt.slice(0, 200) }, "seg_api_error");
      return null;
    }
    const json = (await res.json()) as { maskB64?: string; width?: number; height?: number; method?: string };
    if (!json.maskB64 || !json.width || !json.height) {
      logger.warn("seg_api_bad_response");
      return null;
    }
    const ms = Date.now() - start;
    logger.info({ ms, method: json.method ?? "unknown" }, "seg_api_ok");
    return {
      maskBytes: Buffer.from(json.maskB64, "base64"),
      width: json.width,
      height: json.height,
      method: json.method ?? "unknown",
    };
  } catch (err) {
    logger.warn({ err }, "seg_api_failed");
    return null;
  }
}
