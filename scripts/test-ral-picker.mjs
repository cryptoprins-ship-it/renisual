// One-off RAL grey-shade picker prototype: render Photo 3 (voorkant) at
// 5 grey RAL codes besides the default 7038, on klein-9b only. Outputs to
// public/test-outputs/flux-comparison/ral-picker/.
//
// Run: node scripts/test-ral-picker.mjs

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const INPUT_PATH = "public/test-inputs/IMG_20260422_095323.jpg";
const OUT_DIR = "public/test-outputs/flux-comparison/ral-picker";
const ENV_PATH = ".env.local";

const PROMPT_PRESERVE = `APPLY CLADDING ONLY TO: the houseboat's exterior wall surfaces between the roof and the waterline/foundation. The walls are the flat painted/sided panels of the building's hull and superstructure.

DO NOT APPLY CLADDING TO ANY OF THE FOLLOWING — they keep their original color, material, and texture exactly as in the source photo:
- Fences, gates, hekwerk, wire mesh, balustrades, railings, gratings, bars
- Vegetation, foreground objects, sky, water, neighboring buildings
- Roof, gutters, chimneys
- Windows, glazing, window frames (kozijnen) — keep their ORIGINAL color
- Doors, door frames — keep ORIGINAL color
- Fascia, eaves boards (boeidelen), trim — keep ORIGINAL color

DO NOT INVENT new windows or architectural features.

Match the input image framing exactly. No cropping, no zoom change.`;

// Spanl actually-sold panel greys (from catalog), lighter → darker.
// Limited to what's in spanl-images-index.json — picker only shows
// colors customers can actually order.
const GREYS = [
  { code: "9010", name: "wit (RAL 9010)", hex: "#F1ECE0" },
  { code: "9006", name: "zilver (RAL 9006)", hex: "#A5A8A8" },
  { code: "7038", name: "agaatgrijs (RAL 7038)", hex: "#B5B8B1" }, // matt grey
  { code: "7021", name: "zwartgrijs (RAL 7021)", hex: "#23282B" }, // dark grey/black
  { code: "9005", name: "diepzwart (RAL 9005)", hex: "#0A0A0A" },
];

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

function targetDims(inWidth, inHeight) {
  const aspect = inWidth / inHeight;
  const h = Math.sqrt(1_000_000 / aspect);
  const w = h * aspect;
  const round32 = (n) => Math.max(64, Math.round(n / 32) * 32);
  return { width: round32(w), height: round32(h) };
}

async function submitAndPoll(slug, body, apiKey) {
  const submitRes = await fetch(`https://api.bfl.ai/v1/${slug}`, {
    method: "POST",
    headers: { "x-key": apiKey, "accept": "application/json", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const submitJson = await submitRes.json().catch(() => ({}));
  if (!submitRes.ok) throw new Error(`submit ${submitRes.status}: ${JSON.stringify(submitJson)}`);
  const { id, polling_url, cost } = submitJson;
  if (!polling_url) throw new Error(`no polling_url`);

  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500));
    const pollRes = await fetch(polling_url, { headers: { "x-key": apiKey, "accept": "application/json" } });
    const pollJson = await pollRes.json().catch(() => ({}));
    if (pollJson.status === "Ready") return { sample: pollJson.result?.sample, cost: cost ?? null };
    if (["Error", "Failed", "Content Moderated"].includes(pollJson.status)) {
      throw new Error(`status=${pollJson.status}: ${JSON.stringify(pollJson)}`);
    }
  }
  throw new Error(`timeout polling task ${id}`);
}

function buildPrompt(grey) {
  return `Transform this facade by replacing all wall surfaces with smooth flat metal cladding panels.

The facade is 1350cm wide and 355cm tall.

REMOVE: existing wooden plank siding, all wood grain, peeling paint, weathering. Treat current cladding as if it doesn't exist.

ADD: matt ${grey.name} RAL ${grey.code} (hex ${grey.hex}) smooth flat metal cladding panels. The color must be a TRUE COOL ${grey.code === "9005" ? "BLACK" : grey.code === "9010" ? "WHITE" : "GREY"} matching exactly the named RAL code and hex value above — NOT warm-tinted, NOT brown-shifted, NOT yellow-shifted. Pure neutral metal-paint finish like a powder-coated steel panel, not wood-stain. Panels are 370mm wide and run the FULL 355cm height as unbroken vertical strips — NO horizontal couplings, NO horizontal joints anywhere. Mounted vertically across the 1350cm width (~37 panels side by side). Between adjacent panels is a smalle naad — a very narrow hairline seam in the SAME RAL ${grey.code} color as the panels, barely visible from a few meters back.

${PROMPT_PRESERVE}`;
}

async function main() {
  const apiKey = (await loadEnvKey("renisual_bfl_key")) ?? (await loadEnvKey("BFL_API_KEY"));
  if (!apiKey) { console.error("No BFL key in .env.local"); process.exit(1); }

  await fs.mkdir(OUT_DIR, { recursive: true });

  const sourceBytes = await fs.readFile(INPUT_PATH);
  const sourceMeta = await sharp(sourceBytes).rotate().metadata();
  const dims = targetDims(sourceMeta.width, sourceMeta.height);
  const inputBytes = await sharp(sourceBytes).rotate().resize(dims.width, dims.height, { fit: "fill" }).toBuffer();
  const inputBase64 = inputBytes.toString("base64");

  console.log(`Input: ${INPUT_PATH} ${sourceMeta.width}x${sourceMeta.height} → ${dims.width}x${dims.height}`);
  console.log(`Greys: ${GREYS.length} shades\n`);

  const results = [];
  for (const grey of GREYS) {
    const outPath = path.join(OUT_DIR, `ral-${grey.code}-klein-9b.jpg`);
    try {
      const stat = await fs.stat(outPath);
      if (stat.isFile() && stat.size > 0) {
        console.log(`[${grey.code} ${grey.name}] ⊘ skip (cached)`);
        results.push({ code: grey.code, name: grey.name, hex: grey.hex, output: outPath.replace(/\\/g, "/"), status: "cached" });
        continue;
      }
    } catch {}

    process.stdout.write(`[${grey.code} ${grey.name}] rendering ... `);
    const start = Date.now();
    try {
      const { sample, cost } = await submitAndPoll("flux-2-klein-9b", {
        prompt: buildPrompt(grey),
        input_image: inputBase64,
        width: dims.width,
        height: dims.height,
        output_format: "jpeg",
        safety_tolerance: 2,
      }, apiKey);
      const dlRes = await fetch(sample);
      const buf = Buffer.from(await dlRes.arrayBuffer());
      await fs.writeFile(outPath, buf);
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`✓ ${elapsed}s ${cost} cr`);
      results.push({ code: grey.code, name: grey.name, hex: grey.hex, output: outPath.replace(/\\/g, "/"), status: "rendered", time_seconds: Number(elapsed), cost_credits: cost });
    } catch (err) {
      console.log(`✗ ${err?.message ?? err}`);
      results.push({ code: grey.code, name: grey.name, hex: grey.hex, status: "failed", error: err?.message ?? String(err) });
    }
  }

  await fs.writeFile(path.join(OUT_DIR, "results.json"), JSON.stringify({ source: INPUT_PATH, results }, null, 2));
  console.log(`\nDone. ${results.filter((r) => r.status === "rendered").length} new, ${results.filter((r) => r.status === "cached").length} cached.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
