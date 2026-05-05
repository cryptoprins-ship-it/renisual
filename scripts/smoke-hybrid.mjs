// End-to-end smoke test for /api/render/hybrid
// 1. Loads a small test photo
// 2. POSTs to local dev server
// 3. Saves the returned image so we can eyeball it

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const PHOTO = "public/test-inputs/woonboot_dubbellaags_achterkant.jpg";
const OUT_DIR = "public/test-outputs/hybrid-smoke";

async function runOne(variant, ralCode, colorHex, colorName, downscaledDataUrl) {
  const body = {
    photoDataUrl: downscaledDataUrl,
    variant,
    orientation: "horizontal",
    ralCode,
    colorHex,
    colorName,
    facadeWidthCm: 1350,
    facadeHeightCm: 355,
    debug: true,
  };
  console.log(`\nPOST → variant=${variant}, RAL ${ralCode} (${colorHex})`);
  const t0 = Date.now();
  const res = await fetch("http://localhost:3000/api/render/hybrid", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost:3000" },
    body: JSON.stringify(body),
  });
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`  HTTP ${res.status} in ${elapsed}s`);
  const json = await res.json();
  if (!res.ok) { console.error("  Error:", json); return; }
  console.log(`  degraded=${json.degraded ?? false} seg=${json.segMethod} variant=${json.variant}`);
  const saveDataUrl = async (key, name) => {
    if (!json[key]) return;
    const m = /^data:image\/(?:jpeg|png|webp);base64,(.+)$/.exec(json[key]);
    if (!m) return;
    const out = path.join(OUT_DIR, name);
    await fs.writeFile(out, Buffer.from(m[1], "base64"));
    console.log(`  ✓ ${name}`);
  };
  await saveDataUrl("renderDataUrl", `smoke-${variant}-${ralCode}.jpg`);
  await saveDataUrl("debugAiRenderDataUrl", `smoke-${variant}-${ralCode}-aionly.jpg`);
  await saveDataUrl("debugSegMaskDataUrl", `smoke-${variant}-${ralCode}-mask-seg.png`);
  await saveDataUrl("debugTightMaskDataUrl", `smoke-${variant}-${ralCode}-mask-tight.png`);
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const downscaled = await sharp(PHOTO).rotate().resize({ width: 1200, withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
  const dataUrl = `data:image/jpeg;base64,${downscaled.toString("base64")}`;

  const variants = [
    { variant: "flat",             ralCode: "7038", colorHex: "#B5B8B1", colorName: "agate grey" },
    { variant: "groove",           ralCode: "7038", colorHex: "#B5B8B1", colorName: "agate grey" },
    { variant: "groove-structure", ralCode: "7038", colorHex: "#B5B8B1", colorName: "agate grey" },
    { variant: "groove",           ralCode: "7021", colorHex: "#2F353B", colorName: "black grey" },
  ];
  for (const v of variants) {
    await runOne(v.variant, v.ralCode, v.colorHex, v.colorName, dataUrl);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
