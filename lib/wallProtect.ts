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
  // For flatten path: fraction of mask pixels that were actually filled with
  // target color (rest stayed source as features). 0.0-1.0. undefined when
  // flatten didn't run.
  flattenFillRatio?: number;
  // True when flatten was requested but the count > 100 guard failed
  // (mask too small to be a real wall).
  flattenSkipped?: boolean;
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
  // When true (the user toggled "uitsluiten boeideel" in /render UI),
  // erode the topmost ~5% of the boat-mask region after the sky guard so
  // the fascia plank along the upper edge of the houseboat stays as
  // source pixels. Default true keeps current behaviour (fascia included
  // in the recolor area).
  includeFascia?: boolean;
}): Promise<ProtectedRender | null> {
  const { sourceBytes, aiRenderBytes, targetHex, flatten, flatSeamOrientation, flatSeamCount, includeFascia = true } = args;

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

  // Tight wall mask as raw single-channel buffer. Heavier blur and NO
  // threshold gives a soft alpha gradient at the boundary — the previous
  // 0/255 binary mask put painted-grey wall pixels next to original photo
  // pixels with no transition, which read as a posterized "tekening" cut
  // along the boat outline.
  const tightMaskRaw = await sharp(seg.maskBytes)
    .resize(W, H, { fit: "fill" })
    .greyscale()
    .blur(8)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const maskData = tightMaskRaw.data;

  // Belt-and-suspenders sky+water guard: in typical houseboat photos the
  // top strip is always sky and the bottom strip is always water. SAM has
  // proven unreliable on dark targets — when BFL globally darkens the
  // scene, segmentation drags sky/water into the wall mask because they
  // become "wand-coloured" too. Forcing the topmost/bottommost 10% of
  // rows to mask=0 guarantees those areas stay pure source pixels in the
  // final composite no matter how SAM behaved.
  const skyGuardH = Math.floor(H * 0.10);
  const waterGuardH = Math.floor(H * 0.10);
  for (let y = 0; y < skyGuardH; y++) {
    const row = y * W;
    for (let x = 0; x < W; x++) maskData[row + x] = 0;
  }
  for (let y = H - waterGuardH; y < H; y++) {
    const row = y * W;
    for (let x = 0; x < W; x++) maskData[row + x] = 0;
  }

  // Fascia exclusion: when the user picked "uitsluiten boeideel" we
  // additionally erode a ~5% strip directly below the topmost row of the
  // boat-mask. The boeideel is the trim plank along the upper edge of
  // the houseboat — once SAM gives us the boat outline, the fascia is
  // always the topmost slice of it. This belt-and-suspenders approach
  // doesn't need a separate fascia segmentation.
  if (!includeFascia) {
    let topY = -1;
    scan: for (let y = skyGuardH; y < H - waterGuardH; y++) {
      const row = y * W;
      for (let x = 0; x < W; x++) {
        if (maskData[row + x] > 128) {
          topY = y;
          break scan;
        }
      }
    }
    if (topY >= 0) {
      const fasciaH = Math.floor(H * 0.05);
      const endY = Math.min(H - waterGuardH, topY + fasciaH);
      for (let y = topY; y < endY; y++) {
        const row = y * W;
        for (let x = 0; x < W; x++) maskData[row + x] = 0;
      }
    }
  }

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
  let flattenFillRatio: number | undefined;
  let flattenSkipped = false;
  if (flatten && targetHex) {
    const m = /^#([0-9a-f]{6})$/i.exec(targetHex);
    if (m) {
      const target = parseInt(m[1], 16);
      const tR = (target >> 16) & 0xff;
      const tG = (target >> 8) & 0xff;
      const tB = target & 0xff;
      // BFL pixels for shading + as the second voter on whether a mask
      // pixel is a feature (window/door/frame).
      const { data: rgbData } = await sharp(aiRenderResized).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      // Source pixels: first voter on feature detection. A pixel only
      // counts as a feature if BOTH source AND BFL disagree with their
      // respective wall means — that filters out source weathering noise
      // (peeling paint reads as "different" in source but is uniform in
      // BFL) and BFL's window-color drift (windows look wall-coloured in
      // BFL but stand out in source).
      const { data: srcData } = await sharp(sourceResized).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      let sumLum = 0;
      let bflSumR = 0, bflSumG = 0, bflSumB = 0;
      let srcSumR = 0, srcSumG = 0, srcSumB = 0;
      let count = 0;
      const lum = new Float32Array(maskData.length);
      // Use deep-inside-mask pixels only (>200/255) so the feathered edge
      // doesn't contaminate the wall mean with sky/water.
      const meanThreshold = 200;
      for (let i = 0, j = 0; j < maskData.length; i += 3, j++) {
        const l = 0.2126 * rgbData[i] + 0.7152 * rgbData[i + 1] + 0.0722 * rgbData[i + 2];
        lum[j] = l;
        if (maskData[j] > meanThreshold) {
          sumLum += l;
          bflSumR += rgbData[i];
          bflSumG += rgbData[i + 1];
          bflSumB += rgbData[i + 2];
          srcSumR += srcData[i];
          srcSumG += srcData[i + 1];
          srcSumB += srcData[i + 2];
          count++;
        }
      }
      if (count <= 100) {
        flattenSkipped = true;
      }
      if (count > 100) {
        const meanLum = Math.max(1, sumLum / count);
        const bflMeanR = bflSumR / count;
        const bflMeanG = bflSumG / count;
        const bflMeanB = bflSumB / count;
        const srcMeanR = srcSumR / count;
        const srcMeanG = srcSumG / count;
        const srcMeanB = srcSumB / count;
        // Independent thresholds for each voter. Both must fire for a
        // pixel to count as a feature. Tuned permissive — we'd rather
        // over-paint a window edge than leave the whole wall un-recolored
        // because peeling-paint patches got classified as features.
        const srcFeatureThreshold = 95;
        const bflFeatureThreshold = 85;
        // Build RGBA directly so we can hand it to composite as a real
        // alpha-bearing image (joinChannel/png round-trips have proven
        // unreliable when the source started as raw RGB).
        const fillRgba = Buffer.alloc(maskData.length * 4);
        const compress = 0.08;
        let filledCount = 0;
        // First pass: with feature gate. If too few mask pixels survive
        // we redo without the gate — a wall that obviously isn't recolored
        // is a worse outcome than a window edge that got over-painted.
        const fillPass = (useGate: boolean) => {
          filledCount = 0;
          for (let j = 0, i = 0, k = 0; j < maskData.length; j++, i += 3, k += 4) {
            const m = maskData[j];
            if (m === 0) {
              fillRgba[k + 3] = 0;
              continue;
            }
            if (useGate) {
              const sR = srcData[i] - srcMeanR;
              const sG = srcData[i + 1] - srcMeanG;
              const sB = srcData[i + 2] - srcMeanB;
              const srcDiff2 = sR * sR + sG * sG + sB * sB;
              const bR = rgbData[i] - bflMeanR;
              const bG = rgbData[i + 1] - bflMeanG;
              const bB = rgbData[i + 2] - bflMeanB;
              const bflDiff2 = bR * bR + bG * bG + bB * bB;
              if (
                srcDiff2 > srcFeatureThreshold * srcFeatureThreshold &&
                bflDiff2 > bflFeatureThreshold * bflFeatureThreshold
              ) {
                fillRgba[k + 3] = 0;
                continue;
              }
            }
            const ratio = 1 + compress * ((lum[j] / meanLum) - 1);
            const clamped = Math.max(0.85, Math.min(1.15, ratio));
            fillRgba[k] = Math.min(255, Math.max(0, Math.round(tR * clamped)));
            fillRgba[k + 1] = Math.min(255, Math.max(0, Math.round(tG * clamped)));
            fillRgba[k + 2] = Math.min(255, Math.max(0, Math.round(tB * clamped)));
            // Use the feathered mask value directly as alpha so the
            // boundary blends source<->target smoothly instead of a hard
            // 1px cut along the SAM outline.
            fillRgba[k + 3] = m;
            if (m > 128) filledCount++;
          }
        };
        fillPass(true);
        if (filledCount < count * 0.5) {
          // gate over-rejected (probably weathered source / BFL drift):
          // drop the gate and fill all mask pixels.
          fillPass(false);
        }
        flattenFillRatio = count > 0 ? filledCount / count : 0;
        // Uniform panel seams: thin (~2px) hairlines slightly darker than the
        // wall color, only inside the wall mask. Default 10 seams horizontal.
        // Pass flatSeamCount=0 to skip seams entirely (caller will draw their
        // own overlay — e.g. groove SVG for Mono Groove).
        const seamOrientation = flatSeamOrientation ?? "horizontal";
        const seamCount = flatSeamCount === 0 ? 0 : Math.max(2, Math.min(40, flatSeamCount ?? 10));
        const seamFactor = 0.85;
        const seamThickness = 2;
        const darken = (k: number) => {
          fillRgba[k] = Math.round(fillRgba[k] * seamFactor);
          fillRgba[k + 1] = Math.round(fillRgba[k + 1] * seamFactor);
          fillRgba[k + 2] = Math.round(fillRgba[k + 2] * seamFactor);
        };
        if (seamCount === 0) {
          // skip seam drawing
        } else if (seamOrientation === "horizontal") {
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
          flattenFillRatio,
          flattenSkipped: false,
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
    flattenFillRatio,
    flattenSkipped,
  };
}
