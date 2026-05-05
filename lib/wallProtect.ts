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
  // Mono Flat: replace wall pixels with a smooth solid target_hex fill
  // (modulated by BFL luminance for natural shading) instead of using the
  // BFL render's textured wall. Kills BFL's residual panel-rhythm artifact
  // that violates the "smooth painted metal" Mono Flat product look.
  flatten?: boolean;
  // When flattening, draw uniform hairline seams at equal spacing along the
  // chosen orientation. Mono Flat panels still have visible joints — they
  // just need to be uniform (not BFL's irregular rhythm).
  flatSeamOrientation?: "horizontal" | "vertical";
  flatSeamCount?: number;
}): Promise<ProtectedRender | null> {
  const { sourceBytes, aiRenderBytes, targetHex, flatten, flatSeamOrientation, flatSeamCount } = args;

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

  // 3a. Mono Flat path: build a smooth solid wall fill in target_hex,
  //     softly modulated by BFL luminance so the wall isn't flat-cardboard
  //     but doesn't carry BFL's panel-rhythm seams either. This is what
  //     "smooth painted metal" actually looks like in product photography.
  let colorCorrected = aiRenderResized;
  let colorDelta: { dR: number; dG: number; dB: number } | undefined;
  let wallMean: { r: number; g: number; b: number } | undefined;
  if (flatten && targetHex) {
    const m = /^#([0-9a-f]{6})$/i.exec(targetHex);
    if (m) {
      const target = parseInt(m[1], 16);
      const tR = (target >> 16) & 0xff;
      const tG = (target >> 8) & 0xff;
      const tB = target & 0xff;
      // BFL luminance + per-channel mean of wall-like pixels inside the mask.
      // The mask covers the whole boat; we still need to distinguish wall
      // from windows/doors/dark trim because SAM is loose. Windows in BFL
      // are coloured very differently from the wall, so we use the BFL wall
      // mean as a soft anchor and exclude pixels far from it.
      const { data: rgbData } = await sharp(aiRenderResized).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      let sumLum = 0, sumR = 0, sumG = 0, sumB = 0, count = 0;
      const lum = new Float32Array(maskData.length);
      for (let i = 0, j = 0; j < maskData.length; i += 3, j++) {
        const l = 0.2126 * rgbData[i] + 0.7152 * rgbData[i + 1] + 0.0722 * rgbData[i + 2];
        lum[j] = l;
        if (maskData[j] > 128) {
          sumLum += l;
          sumR += rgbData[i];
          sumG += rgbData[i + 1];
          sumB += rgbData[i + 2];
          count++;
        }
      }
      if (count > 100) {
        const meanLum = Math.max(1, sumLum / count);
        const bflMeanR = sumR / count;
        const bflMeanG = sumG / count;
        const bflMeanB = sumB / count;
        // Color-distance threshold: pixels in BFL render this far from the
        // wall mean count as "feature" (window, door, frame) and stay
        // transparent so the source photo shows through.
        const featureThreshold = 75;
        // Build RGBA directly so we can hand it to composite as a real
        // alpha-bearing image (joinChannel/png round-trips have proven
        // unreliable when the source started as raw RGB).
        const fillRgba = Buffer.alloc(maskData.length * 4);
        const compress = 0.08;
        for (let j = 0, i = 0, k = 0; j < maskData.length; j++, i += 3, k += 4) {
          if (maskData[j] <= 128) {
            fillRgba[k + 3] = 0;
            continue;
          }
          const dR = rgbData[i] - bflMeanR;
          const dG = rgbData[i + 1] - bflMeanG;
          const dB = rgbData[i + 2] - bflMeanB;
          if (dR * dR + dG * dG + dB * dB > featureThreshold * featureThreshold) {
            // window / door / dark trim: keep source visible by leaving alpha 0
            fillRgba[k + 3] = 0;
            continue;
          }
          const ratio = 1 + compress * ((lum[j] / meanLum) - 1);
          const clamped = Math.max(0.85, Math.min(1.15, ratio));
          fillRgba[k] = Math.min(255, Math.max(0, Math.round(tR * clamped)));
          fillRgba[k + 1] = Math.min(255, Math.max(0, Math.round(tG * clamped)));
          fillRgba[k + 2] = Math.min(255, Math.max(0, Math.round(tB * clamped)));
          fillRgba[k + 3] = 255;
        }

        // Uniform panel seams: thin (~2px) hairlines slightly darker than the
        // wall color, only inside the wall mask. Default 10 seams horizontal.
        const seamOrientation = flatSeamOrientation ?? "horizontal";
        const seamCount = Math.max(2, Math.min(40, flatSeamCount ?? 10));
        const seamFactor = 0.85;
        const seamThickness = 2;
        const darken = (k: number) => {
          fillRgba[k] = Math.round(fillRgba[k] * seamFactor);
          fillRgba[k + 1] = Math.round(fillRgba[k + 1] * seamFactor);
          fillRgba[k + 2] = Math.round(fillRgba[k + 2] * seamFactor);
        };
        if (seamOrientation === "horizontal") {
          const spacing = Math.floor(H / seamCount);
          if (spacing > seamThickness) {
            for (let s = 1; s < seamCount; s++) {
              const y0 = s * spacing;
              for (let dy = 0; dy < seamThickness; dy++) {
                const yy = y0 + dy;
                if (yy >= H) continue;
                const rowOffset = yy * W;
                for (let x = 0; x < W; x++) {
                  if (maskData[rowOffset + x] <= 128) continue;
                  darken((rowOffset + x) * 4);
                }
              }
            }
          }
        } else {
          const spacing = Math.floor(W / seamCount);
          if (spacing > seamThickness) {
            for (let s = 1; s < seamCount; s++) {
              const x0 = s * spacing;
              for (let dx = 0; dx < seamThickness; dx++) {
                const xx = x0 + dx;
                if (xx >= W) continue;
                for (let y = 0; y < H; y++) {
                  if (maskData[y * W + xx] <= 128) continue;
                  darken((y * W + xx) * 4);
                }
              }
            }
          }
        }

        // Composite RGBA fill (with mask as alpha) over the source — skip the
        // applyMaskAsAlpha path entirely for the flatten branch since the
        // wall pixels are already in their final form here.
        const fillPng = await sharp(fillRgba, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
        const composited = await sharp(sourceResized)
          .composite([{ input: fillPng, blend: "over" }])
          .png()
          .toBuffer();
        wallMean = { r: tR, g: tG, b: tB };
        colorDelta = { dR: 0, dG: 0, dB: 0 };
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
    }
  }

  // 3b. Standard ΔE correction inside wall (used for groove/structure and
  //     for any non-flat call). Pulls the wall mean toward target_hex via a
  //     per-channel linear offset.
  if (!flatten && targetHex) {
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
