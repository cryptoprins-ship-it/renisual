// 2x2 parameter sweep on klein-9b for white target (RAL 9003).
// Axes:
//   strength: undefined (default) | 0.5 (image_prompt_strength)
//   ref:      none                 | spanl pb9003a panel reference
// Same prompt, same source photo, same dims for all four. Reveals
// which knob causes the global-exposure drift on white targets.
//
// Run: node scripts/test-bfl-2x2.mjs

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ENV_PATH = ".env.local";
const OUT_DIR = "public/test-outputs/bfl-2x2";
const SOURCE = "public/samples/woonboten/woonboot_dubbellaags_achterkant.jpg";
const REF = "public/samples/spanl/panels/pb9003a/main.jpg";

const PROMPT = `Recolour the wall surfaces of this building in matt pure cool white RAL 9003 (hex #F4F4F4). painted matt metal cladding with very faint hairline horizontal seams every 37cm. Seams are very subtly DARKER than the panel color — about 5% in luminance — so the panel orientation stays visible on light colours. Never grey, never contrasting. Otherwise smooth and uniform metal sheet. Hairline seams run left-to-right across the facade.

Keep the roof, gutters, chimneys, sky, water, vegetation, neighbouring buildings, fences and any foreground objects exactly as in the source photo — same colour, same materials, same shape, same brightness and same overall lighting. Do NOT shift the global exposure of the scene to match the wall colour: the sky stays exactly as bright as in the source photo, the water stays exactly as in the source photo, the trees stay exactly as in the source photo, regardless of the new wall colour. Do not invent new windows or features. Match the source framing exactly.
Keep the windows, glass and window frames exactly as in the source photo — same colour, same material.
Keep the doors and door frames exactly as in the source photo — same colour, same material.
PRESERVE the fascia board (boeideel) — keep its original color, do NOT recolor.
  IMPORTANT: render as PURE COOL WHITE. NOT cream, NOT beige, NOT off-white, NOT yellow-tinted, NOT warm-tinted.`;

async function loadKey() {
  const raw = await fs.readFile(ENV_PATH, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z0-9_]+)\s*=\s*(.+?)\s*$/.exec(line);
    if (!m) continue;
    const k = m[1].toLowerCase();
    if (k === "renisual_bfl_key" || k === "bfl_api_key" || k === "flux_api_key") {
      return m[2].replace(/^['"]|['"]$/g, "");
    }
  }
  throw new Error("no bfl key");
}

function bflTargetDims(srcW, srcH) {
  const aspect = srcW / srcH;
  const h = Math.sqrt(1_000_000 / aspect);
  const w = h * aspect;
  const round32 = (n) => Math.max(64, Math.round(n / 32) * 32);
  return { width: round32(w), height: round32(h) };
}

async function renderOne(apiKey, srcBytes, refBytes, useStrength, useRef) {
  const meta = await sharp(srcBytes).metadata();
  const dims = bflTargetDims(meta.width ?? 1024, meta.height ?? 1024);
  const baseDownscaled = await sharp(srcBytes)
    .rotate()
    .resize(dims.width, dims.height, { fit: "fill" })
    .toBuffer();

  const body = {
    prompt: PROMPT,
    input_image: baseDownscaled.toString("base64"),
    width: dims.width,
    height: dims.height,
    output_format: "jpeg",
    safety_tolerance: 2,
  };
  if (useStrength) body.image_prompt_strength = 0.5;
  if (useRef && refBytes) body.input_image_2 = refBytes.toString("base64");

  const submitRes = await fetch("https://api.bfl.ai/v1/flux-2-klein-9b", {
    method: "POST",
    headers: { "x-key": apiKey, accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const submitJson = await submitRes.json().catch(() => ({}));
  if (!submitRes.ok) throw new Error(`submit ${submitRes.status}: ${JSON.stringify(submitJson)}`);
  const pollingUrl = submitJson.polling_url;
  if (!pollingUrl) throw new Error("no polling_url");

  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500));
    const pollRes = await fetch(pollingUrl, {
      headers: { "x-key": apiKey, accept: "application/json" },
    });
    const pollJson = await pollRes.json().catch(() => ({}));
    if (pollJson.status === "Ready") {
      const sample = pollJson.result?.sample;
      if (!sample) throw new Error("no sample");
      const dl = await fetch(sample);
      if (!dl.ok) throw new Error(`download ${dl.status}`);
      return Buffer.from(await dl.arrayBuffer());
    }
    if (pollJson.status === "Error" || pollJson.status === "Failed" || pollJson.status === "Content Moderated") {
      throw new Error(`bfl ${pollJson.status}: ${JSON.stringify(pollJson)}`);
    }
  }
  throw new Error("timeout");
}

async function main() {
  const apiKey = await loadKey();
  const srcBytes = await fs.readFile(SOURCE);
  const refBytes = await fs.readFile(REF);
  await fs.mkdir(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

  const cells = [
    { id: "A_default-noref",  strength: false, ref: false, label: "default strength, no ref" },
    { id: "B_strength-noref", strength: true,  ref: false, label: "strength=0.5, no ref" },
    { id: "C_default-ref",    strength: false, ref: true,  label: "default strength, with ref" },
    { id: "D_strength-ref",   strength: true,  ref: true,  label: "strength=0.5, with ref" },
  ];

  console.log(`source: ${SOURCE}`);
  console.log(`ref:    ${REF}`);
  console.log(`out:    ${OUT_DIR}`);
  console.log(`prompt: ${PROMPT.slice(0, 80)}...\n`);

  const errors = [];
  for (const c of cells) {
    process.stdout.write(`[${c.id}] ${c.label}... `);
    try {
      const t0 = Date.now();
      const bytes = await renderOne(apiKey, srcBytes, refBytes, c.strength, c.ref);
      const ms = Date.now() - t0;
      const out = path.join(OUT_DIR, `${stamp}_${c.id}.jpg`);
      await fs.writeFile(out, bytes);
      console.log(`ok (${ms}ms, ${bytes.length} bytes) → ${out}`);
    } catch (e) {
      console.log(`FAIL: ${e.message}`);
      errors.push({ id: c.id, msg: e.message });
    }
  }
  if (errors.length) {
    console.log(`\n${errors.length} failed:`, errors);
  } else {
    console.log("\nall four cells rendered.");
  }
}

main().catch((e) => {
  console.error("fatal:", e.message);
  process.exit(1);
});
