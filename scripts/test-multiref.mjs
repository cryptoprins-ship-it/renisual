// Test A: does feeding a real Spanl product close-up as input_image_2
// improve klein-9b's rendering of texture/structure detail?
//
// Single render: groove-structure-vertical on Photo 3, with YMSG7038A
// product photo as a reference. Compare against the existing without-ref
// render at the same path-without-WITHREF suffix.
//
// Run: node scripts/test-multiref.mjs

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const PHOTO_PATH = "public/test-inputs/IMG_20260422_095323.jpg";
const REF_PATH = "public/samples/spanl/panels/ymsg7038a/main.jpg";
const OUT_PATH = "public/test-outputs/flux-comparison/multiref/IMG_20260422_095323-groove-structure-vertical-klein-9b-WITHREF-v2.jpg";
const ENV_PATH = ".env.local";

const PROMPT_PRESERVE = `APPLY CLADDING ONLY TO: the houseboat's exterior wall surfaces between the roof and the waterline/foundation.

DO NOT APPLY CLADDING TO: fences, gates, mesh, railings, vegetation, foreground objects, sky, water, neighboring buildings, roof, gutters, chimneys, windows, glazing, window frames, doors, fascia, eaves boards.

DO NOT INVENT new windows or architectural features.

Match the input image framing exactly. No cropping, no zoom change.`;

const PROMPT = `Transform this facade by replacing all wall surfaces with Mono Groove metal cladding with embossed linen surface texture.

The facade is 1350cm wide and 355cm tall.

REMOVE: existing wooden plank siding, all wood grain, peeling paint, weathering. Treat current cladding as if it doesn't exist.

ADD: matt grey RAL 7038 (hex #B5B8B1) Mono Groove metal cladding. Panels are 370mm wide and run the FULL 355cm height as unbroken vertical strips — NO horizontal couplings. Mounted vertically across the 1350cm width. Between adjacent panels is a smalle naad (same-color hairline seam). Each panel face has THREE narrow vertical decorative grooves cut into it, evenly spaced, dividing each 370mm panel face into four roughly equal vertical segments.

The SECOND image (input_image_2) is a Spanl product close-up. Use it ONLY for sampling: (1) the matte panel COLOR — match it precisely, (2) the surface TEXTURE — subtle linen wood-grain pattern across each panel face, (3) the matte finish QUALITY — non-reflective, powder-coated metal look.

CRITICAL — IGNORE the panel orientation of the second image. The product photo happens to show panels mounted horizontally because that's how the display board is built — that says NOTHING about how the panels mount on the wall. Panel orientation is dictated EXCLUSIVELY by the explicit text instruction above ("Panels are 370mm wide and run the FULL 355cm height as unbroken VERTICAL strips"). Do NOT rotate, mirror, or otherwise flip the wall layout to match the reference photo's orientation. Your panels MUST be vertical regardless of what the reference shows.

The reference image is a SURFACE SAMPLE, not a layout template.

${PROMPT_PRESERVE}`;

async function loadEnvKey(name) {
  let raw;
  try { raw = await fs.readFile(ENV_PATH, "utf8"); } catch { return undefined; }
  const target = name.toLowerCase();
  for (const line of raw.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][\w]*)\s*=\s*(.*)\s*$/.exec(line);
    if (m && m[1].toLowerCase() === target) return m[2].replace(/^["']|["']$/g, "");
  }
  return undefined;
}

function targetDims(w, h) {
  const aspect = w / h;
  const height = Math.sqrt(1_000_000 / aspect);
  const width = height * aspect;
  const round32 = (n) => Math.max(64, Math.round(n / 32) * 32);
  return { width: round32(width), height: round32(height) };
}

async function main() {
  const apiKey = (await loadEnvKey("renisual_bfl_key")) ?? (await loadEnvKey("BFL_API_KEY"));
  if (!apiKey) { console.error("No BFL key"); process.exit(1); }

  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });

  // Prepare base photo (downscale to ~1MP)
  const baseBytes0 = await fs.readFile(PHOTO_PATH);
  const baseMeta0 = await sharp(baseBytes0).rotate().metadata();
  const baseDims = targetDims(baseMeta0.width, baseMeta0.height);
  const baseBytes = await sharp(baseBytes0).rotate().resize(baseDims.width, baseDims.height, { fit: "fill" }).toBuffer();
  const baseB64 = baseBytes.toString("base64");

  // Reference photo — also downscale a bit so we don't blow the request size
  const refBytes0 = await fs.readFile(REF_PATH);
  const refMeta0 = await sharp(refBytes0).rotate().metadata();
  const refMaxDim = 800;
  const refScale = Math.min(1, refMaxDim / Math.max(refMeta0.width ?? 1, refMeta0.height ?? 1));
  const refBytes = refScale < 1
    ? await sharp(refBytes0).rotate().resize(Math.round((refMeta0.width ?? 0) * refScale), Math.round((refMeta0.height ?? 0) * refScale), { fit: "inside" }).toBuffer()
    : refBytes0;
  const refB64 = refBytes.toString("base64");

  console.log(`Base: ${PHOTO_PATH}  ${baseMeta0.width}x${baseMeta0.height} → ${baseDims.width}x${baseDims.height}`);
  console.log(`Ref:  ${REF_PATH}  ${refMeta0.width}x${refMeta0.height} → ${Math.round((refMeta0.width ?? 0) * refScale)}x${Math.round((refMeta0.height ?? 0) * refScale)}`);
  console.log(`Out:  ${OUT_PATH}\n`);

  process.stdout.write(`[groove-structure-vertical/klein-9b WITH REF] rendering ... `);
  const start = Date.now();

  const submitRes = await fetch("https://api.bfl.ai/v1/flux-2-klein-9b", {
    method: "POST",
    headers: { "x-key": apiKey, "accept": "application/json", "content-type": "application/json" },
    body: JSON.stringify({
      prompt: PROMPT,
      input_image: baseB64,
      input_image_2: refB64,
      width: baseDims.width,
      height: baseDims.height,
      output_format: "jpeg",
      safety_tolerance: 2,
    }),
  });
  const submitJson = await submitRes.json().catch(() => ({}));
  if (!submitRes.ok) {
    console.log(`✗ submit ${submitRes.status}: ${JSON.stringify(submitJson)}`);
    process.exit(1);
  }
  const { id, polling_url, cost } = submitJson;

  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500));
    const pollRes = await fetch(polling_url, { headers: { "x-key": apiKey, "accept": "application/json" } });
    const pollJson = await pollRes.json().catch(() => ({}));
    if (pollJson.status === "Ready") {
      const dlRes = await fetch(pollJson.result?.sample);
      const buf = Buffer.from(await dlRes.arrayBuffer());
      await fs.writeFile(OUT_PATH, buf);
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`✓ ${elapsed}s  ${cost} cr  → ${OUT_PATH}`);
      return;
    }
    if (["Error", "Failed", "Content Moderated"].includes(pollJson.status)) {
      console.log(`✗ ${pollJson.status}: ${JSON.stringify(pollJson)}`);
      process.exit(1);
    }
  }
  console.log(`✗ timeout`);
}

main().catch((e) => { console.error(e); process.exit(1); });
