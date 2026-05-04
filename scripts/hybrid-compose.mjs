// Pro-tier hybrid pipeline: take an AI-rendered Mono Flat output and
// derive Mono Groove (and later +Structure) variants by procedurally
// overlaying groove patterns. Color stays from the AI render; pattern
// is deterministic SVG → guarantees uniform spacing.
//
// Run: node scripts/hybrid-compose.mjs

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const INPUT_BASE = "public/test-outputs/iterate";
const OUT_DIR = "public/test-outputs/hybrid";

const TESTS = [
  {
    id: "p3-white2story",
    sourcePhoto: "../../test-inputs/woonboot_dubbellaags_achterkant.jpg",
    flatSource: "p3-white2story-PB7038A-V.jpg",
    facadeWidthCm: 1350,
    facadeHeightCm: 355,
  },
  {
    id: "p4-mixed-back",
    sourcePhoto: "../../test-inputs/woonboot_achterkant_dubbelenenkel.jpg",
    flatSource: "p4-mixed-back-PB7038A-V.jpg",
    facadeWidthCm: 1350,
    facadeHeightCm: 355,
  },
];

// ──────────────────────────────────────────────────────────────────────
// Wall mask — intersection of two signals:
//   (a) diff-vs-source: pixel changed substantially from the source
//   (b) color-similar-to-target: pixel is close to the AI's chosen
//       cladding color (low saturation, mid-brightness grey)
// Each alone is too noisy: (a) catches every tree-leaf shift, (b)
// catches sky/water that happen to be greyish. The intersection is
// usually clean — only pixels that BOTH changed AND look like cladding.
// ──────────────────────────────────────────────────────────────────────
async function detectWallMask(renderPath, sourcePath, opts = {}) {
  const diffThreshold = opts.diffThreshold ?? 100; // STRICT — wall must change a lot
  const colorRefHex = opts.colorRefHex;
  const colorThreshold = opts.colorThreshold ?? 30; // STRICT — tight color match

  const renderMeta = await sharp(renderPath).metadata();
  const W = renderMeta.width;
  const H = renderMeta.height;

  const renderBuf = await sharp(renderPath).raw().toBuffer({ resolveWithObject: true });
  const sourceBuf = await sharp(sourcePath).rotate().resize(W, H, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true });

  const rChan = renderBuf.info.channels;
  const sChan = sourceBuf.info.channels;
  const total = W * H;

  // If no color ref given, auto-detect by sampling the center 30% of
  // the image (assumes wall is in centre — true for facade photos)
  let refR, refG, refB;
  if (colorRefHex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(colorRefHex);
    const n = parseInt(m[1], 16);
    refR = (n >> 16) & 0xff; refG = (n >> 8) & 0xff; refB = n & 0xff;
  } else {
    let sumR = 0, sumG = 0, sumB = 0, count = 0;
    const xMin = Math.floor(W * 0.35), xMax = Math.floor(W * 0.65);
    const yMin = Math.floor(H * 0.40), yMax = Math.floor(H * 0.65);
    for (let y = yMin; y < yMax; y++) {
      for (let x = xMin; x < xMax; x++) {
        const o = (y * W + x) * rChan;
        sumR += renderBuf.data[o]; sumG += renderBuf.data[o + 1]; sumB += renderBuf.data[o + 2];
        count++;
      }
    }
    refR = Math.round(sumR / count); refG = Math.round(sumG / count); refB = Math.round(sumB / count);
    console.log(`  auto color ref: rgb(${refR},${refG},${refB})`);
  }

  const rawMask = Buffer.alloc(total);
  let passDiff = 0, passColor = 0, passBoth = 0;
  for (let i = 0; i < total; i++) {
    const ro = i * rChan;
    const so = i * sChan;
    const rr = renderBuf.data[ro], rg = renderBuf.data[ro + 1], rb = renderBuf.data[ro + 2];
    const dr = rr - sourceBuf.data[so];
    const dg = rg - sourceBuf.data[so + 1];
    const db = rb - sourceBuf.data[so + 2];
    const diffDist = Math.sqrt(dr * dr + dg * dg + db * db);
    const cr = rr - refR, cg = rg - refG, cb = rb - refB;
    const colorDist = Math.sqrt(cr * cr + cg * cg + cb * cb);
    const okDiff = diffDist > diffThreshold;
    const okColor = colorDist < colorThreshold;
    if (okDiff) passDiff++;
    if (okColor) passColor++;
    if (okDiff && okColor) { passBoth++; rawMask[i] = 255; }
  }
  const pct = (n) => `${((n / total) * 100).toFixed(1)}%`;
  console.log(`  mask: diff ${pct(passDiff)} | color ${pct(passColor)} | intersection ${pct(passBoth)}`);

  // Light blur to fill small holes
  const cleaned = await sharp(rawMask, { raw: { width: W, height: H, channels: 1 } })
    .blur(3)
    .threshold(100)
    .raw()
    .toBuffer();

  return { mask: cleaned, width: W, height: H };
}

// ──────────────────────────────────────────────────────────────────────
// Groove pattern — real spec spacing.
// Mono Groove on Spanl: 37cm panel width, 3 grooves per panel face.
//   → panel-edge lines every 37cm
//   → in-panel grooves every ~9.25cm (37/4) within each panel face
// At facade scale (1350cm wide) that's ~35 panel edges + ~140 grooves.
// We render a reduced visual density (panel-edges + 1 groove per panel)
// for legibility — drawing all 140 lines on a ~700px wall blurs them
// into solid shading.
// ──────────────────────────────────────────────────────────────────────
function generateGrooveSvg({ W, H, facadeWidthCm, facadeHeightCm, orientation, mode }) {
  // Pixels per cm — naive (wall doesn't fill the photo, so the mask
  // already crops the visible area; this gives reasonable line density)
  const pxPerCmW = W / facadeWidthCm;
  const pxPerCmH = H / facadeHeightCm;
  const ppc = orientation === "vertical" ? pxPerCmW : pxPerCmH;

  // mode: "flat" → panel edges only, near-invisible
  //       "groove" → panel edges + 1 internal groove per panel
  //       "groove-dense" → panel edges + 3 internal grooves per panel
  let lineSpacingCm;
  let lineOpacity;
  let lineWidthPx;
  if (mode === "flat") {
    lineSpacingCm = 37;
    lineOpacity = 0.10; // hairline
    lineWidthPx = Math.max(1, ppc * 0.3);
  } else if (mode === "groove") {
    lineSpacingCm = 37 / 2; // panel edge + 1 in-panel groove
    lineOpacity = 0.30;
    lineWidthPx = Math.max(1, ppc * 0.5);
  } else {
    // groove-dense
    lineSpacingCm = 37 / 4; // panel edge + 3 grooves per panel
    lineOpacity = 0.25;
    lineWidthPx = Math.max(1, ppc * 0.4);
  }
  const spacingPx = ppc * lineSpacingCm;

  const isVertical = orientation === "vertical";
  let rects = "";
  if (isVertical) {
    for (let x = spacingPx; x < W; x += spacingPx) {
      rects += `<rect x="${x.toFixed(1)}" y="0" width="${lineWidthPx.toFixed(1)}" height="${H}" fill="rgba(0,0,0,${lineOpacity})" />`;
    }
  } else {
    for (let y = spacingPx; y < H; y += spacingPx) {
      rects += `<rect x="0" y="${y.toFixed(1)}" width="${W}" height="${lineWidthPx.toFixed(1)}" fill="rgba(0,0,0,${lineOpacity})" />`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${rects}</svg>`;
}

async function composeVariant({ flatRenderPath, maskBuffer, W, H, outPath, facadeWidthCm, facadeHeightCm, orientation, mode }) {
  const grooveSvg = generateGrooveSvg({ W, H, facadeWidthCm, facadeHeightCm, orientation, mode });
  const groovePng = await sharp(Buffer.from(grooveSvg)).png().toBuffer();
  const maskPng = await sharp(maskBuffer, { raw: { width: W, height: H, channels: 1 } }).png().toBuffer();

  const maskedGrooves = await sharp(groovePng)
    .composite([{ input: maskPng, blend: "dest-in" }])
    .png()
    .toBuffer();

  await sharp(flatRenderPath)
    .composite([{ input: maskedGrooves, blend: "over" }])
    .jpeg({ quality: 92 })
    .toFile(outPath);
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  for (const tc of TESTS) {
    const flatPath = path.join(INPUT_BASE, tc.flatSource);
    try {
      await fs.access(flatPath);
    } catch {
      console.log(`✗ ${tc.id}: source not found ${flatPath}`);
      continue;
    }
    const sourcePath = path.resolve(path.dirname(flatPath), tc.sourcePhoto);

    const { mask, width: W, height: H } = await detectWallMask(flatPath, sourcePath);

    // Save mask for debugging
    await sharp(mask, { raw: { width: W, height: H, channels: 1 } })
      .png()
      .toFile(path.join(OUT_DIR, `${tc.id}-mask.png`));

    // Reference: copy the AI-rendered Flat as-is
    await sharp(flatPath).jpeg({ quality: 92 }).toFile(path.join(OUT_DIR, `${tc.id}-flat.jpg`));

    // Hybrid Mono Flat — adds hairline panel-edges to make panel rhythm
    // visible without looking like grooves. Optional; the AI render is
    // already pretty smooth, so this is a "subtle articulation" pass.
    await composeVariant({
      flatRenderPath: flatPath, maskBuffer: mask, W, H,
      outPath: path.join(OUT_DIR, `${tc.id}-flat-hairlines.jpg`),
      facadeWidthCm: tc.facadeWidthCm, facadeHeightCm: tc.facadeHeightCm,
      orientation: "vertical", mode: "flat",
    });

    // Hybrid Mono Groove — panel edges + 1 internal groove per panel
    await composeVariant({
      flatRenderPath: flatPath, maskBuffer: mask, W, H,
      outPath: path.join(OUT_DIR, `${tc.id}-groove-V.jpg`),
      facadeWidthCm: tc.facadeWidthCm, facadeHeightCm: tc.facadeHeightCm,
      orientation: "vertical", mode: "groove",
    });

    // Hybrid Mono Groove dense — full spec (3 internal grooves per panel)
    await composeVariant({
      flatRenderPath: flatPath, maskBuffer: mask, W, H,
      outPath: path.join(OUT_DIR, `${tc.id}-groove-V-dense.jpg`),
      facadeWidthCm: tc.facadeWidthCm, facadeHeightCm: tc.facadeHeightCm,
      orientation: "vertical", mode: "groove-dense",
    });

    console.log(`✓ ${tc.id}: flat / flat-hairlines / groove-V / groove-V-dense → ${OUT_DIR}/`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
