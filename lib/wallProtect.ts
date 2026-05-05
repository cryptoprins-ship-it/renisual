// Post-render pass for any BFL/AI render of a facade photo:
//   1. Sample the AI render's central band to estimate its actual wall color
//      (BFL drifts from the requested target_hex, so we feed the seg service
//      the rendered hue rather than the requested hue — otherwise the
//      colour-similarity centroid in segment/server.mjs falls through to a
//      poor fallback point and SAM segments the wrong region).
//   2. Run SAM via the seg microservice to get a wall mask.
//   3. Inside the wall mask: shift the AI render's per-channel mean toward
//      target_hex via a linear offset. This is the ΔE correction layer that
//      darkenHex prompt-side compensation can't solve on dark RAL.
//   4. Outside the wall mask: composite the original source photo back over
//      the AI render so boeideel, kozijnen, ramen, lucht, water, buren all
//      stay pixel-identical to the input.
//
// Sharp note: composite + dest-in is a no-op when given a 1-channel grayscale
// PNG because there's no actual alpha channel on a single-band image. Wire
// masks in via joinChannel as the explicit alpha so it actually masks.

import sharp from "sharp";
import { segmentWallMask } from "@/lib/segmentation";
import { logger } from "@/lib/logger";

export interface ProtectedRender {
  // Composited PNG: wall pixels = colour-corrected AI render, non-wall = source
  bytes: Buffer;
  width: number;
  height: number;
  // Raw single-channel mask (0/255) at width × height — exposed so callers
  // can mask procedural overlays onto only wall pixels without re-running SAM.
  maskRaw: Buffer;
  segMethod: string;
  // Diagnostics (logged by callers)
  sampledSegHex?: string;
  colorDelta?: { dR: number; dG: number; dB: number };
  wallMean?: { r: number; g: number; b: number };
}

export async function buildProtectedWallRender(args: {
  sourceBytes: Buffer;
  aiRenderBytes: Buffer;
  targetHex?: string;
}): Promise<ProtectedRender | null> {
  const { sourceBytes, aiRenderBytes, targetHex } = args;

  // 1. Sample BFL render's central band so seg matches the rendered hue
  let sampledSegHex: string | undefined = targetHex;
  try {
    const meta = await sharp(aiRenderBytes).metadata();
    if (meta.width && meta.height) {
      const stats = await sharp(aiRenderBytes)
        .extract({
          left: Math.floor(meta.width * 0.3),
          top: Math.floor(meta.height * 0.3),
          width: Math.max(1, Math.floor(meta.width * 0.4)),
          height: Math.max(1, Math.floor(meta.height * 0.2)),
        })
        .stats();
      const r = Math.round(stats.channels[0].mean);
      const g = Math.round(stats.channels[1].mean);
      const b = Math.round(stats.channels[2].mean);
      sampledSegHex = "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
    }
  } catch {
    // best-effort
  }

  // 2. Segment via SAM
  const seg = await segmentWallMask({
    sourceBytes,
    renderBytes: aiRenderBytes,
    targetHex: sampledSegHex,
  });
  if (!seg) {
    logger.warn("wall_protect_seg_unavailable");
    return null;
  }

  const W = seg.width;
  const H = seg.height;

  // Tight wall mask as raw single-channel buffer
  const tightMaskRaw = await sharp(seg.maskBytes)
    .resize(W, H, { fit: "fill" })
    .greyscale()
    .blur(2)
    .threshold(100)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const maskData = tightMaskRaw.data;

  const aiRenderResized = await sharp(aiRenderBytes).resize(W, H, { fit: "fill" }).toBuffer();
  const sourceResized = await sharp(sourceBytes).resize(W, H, { fit: "fill" }).toBuffer();

  const applyMaskAsAlpha = (rgb: Buffer) =>
    sharp(rgb)
      .removeAlpha()
      .joinChannel(maskData, { raw: { width: W, height: H, channels: 1 } })
      .png()
      .toBuffer();

  // 3. ΔE correction inside wall
  let colorCorrected = aiRenderResized;
  let colorDelta: { dR: number; dG: number; dB: number } | undefined;
  let wallMean: { r: number; g: number; b: number } | undefined;
  if (targetHex) {
    const { data: rgbData } = await sharp(aiRenderResized).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    let sumR = 0, sumG = 0, sumB = 0, count = 0;
    for (let i = 0, j = 0; j < maskData.length; i += 3, j++) {
      if (maskData[j] > 128) {
        sumR += rgbData[i];
        sumG += rgbData[i + 1];
        sumB += rgbData[i + 2];
        count++;
      }
    }
    if (count > 100) {
      const meanR = sumR / count;
      const meanG = sumG / count;
      const meanB = sumB / count;
      wallMean = { r: Math.round(meanR), g: Math.round(meanG), b: Math.round(meanB) };
      const m = /^#([0-9a-f]{6})$/i.exec(targetHex);
      if (m) {
        const target = parseInt(m[1], 16);
        const tR = (target >> 16) & 0xff;
        const tG = (target >> 8) & 0xff;
        const tB = target & 0xff;
        const dR = tR - meanR;
        const dG = tG - meanG;
        const dB = tB - meanB;
        colorDelta = { dR: Math.round(dR), dG: Math.round(dG), dB: Math.round(dB) };
        const shifted = await sharp(aiRenderResized).linear([1, 1, 1], [dR, dG, dB]).toBuffer();
        const shiftedWall = await applyMaskAsAlpha(shifted);
        colorCorrected = await sharp(aiRenderResized)
          .composite([{ input: shiftedWall, blend: "over" }])
          .toBuffer();
      }
    }
  }

  // 4. Boeideel/kozijnen protection: source pixels outside the wall mask
  const wallLayer = await applyMaskAsAlpha(colorCorrected);
  const composited = await sharp(sourceResized)
    .composite([{ input: wallLayer, blend: "over" }])
    .png()
    .toBuffer();

  return {
    bytes: composited,
    width: W,
    height: H,
    maskRaw: Buffer.from(maskData),
    segMethod: seg.method,
    sampledSegHex,
    colorDelta,
    wallMean,
  };
}
