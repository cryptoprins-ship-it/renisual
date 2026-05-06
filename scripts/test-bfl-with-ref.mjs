// Naked text prompt + product reference image (no input_image source).
// klein-9b uses input_image_2 as a texture/colour reference while
// generating from prompt. Useful for non-RAL panel styles where
// describing the look verbally drifts the model into a different
// material (e.g. "brick-look print panel" → real masonry).
//
// Run: node scripts/test-bfl-with-ref.mjs

import fs from "node:fs/promises";
import path from "node:path";

const ENV_PATH = ".env.local";
const OUT_DIR = "public/test-outputs/naked-prompt";
const REF = "public/samples/spanl/panels/b10-01/main.jpg";

const PROMPT = `A modern Dutch houseboat (woonboot) moored at a canal in a residential area, photographed from the water side on an overcast afternoon. The houseboat sidewalls are clad with the printed brick-look panels shown in the reference image — soft weathered brick pattern in light cream-tan, beige and grey-brown tones with subtle cream mortar lines, on flat panels (very slight relief from the print, not truly protruding bricks). Match the reference image's exact tones and pattern. White PVC window frames, anthracite-grey door, dark grey roof, gutters and chimney. Trees and a neighbouring house in the background, calm water in the foreground. Realistic photography, natural daylight, eye-level perspective.`;

const WIDTH = 1280;
const HEIGHT = 768;

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

async function main() {
  const apiKey = await loadKey();
  const refBytes = await fs.readFile(REF);
  await fs.mkdir(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outPath = path.join(OUT_DIR, `naked-ref-${stamp}.jpg`);

  console.log(`prompt:\n${PROMPT}\n`);
  console.log(`ref:    ${REF}`);
  console.log(`dims:   ${WIDTH}x${HEIGHT}`);
  console.log(`rendering...`);

  const submitRes = await fetch("https://api.bfl.ai/v1/flux-2-klein-9b", {
    method: "POST",
    headers: { "x-key": apiKey, accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({
      prompt: PROMPT,
      input_image_2: refBytes.toString("base64"),
      width: WIDTH,
      height: HEIGHT,
      output_format: "jpeg",
      safety_tolerance: 2,
    }),
  });
  const submitJson = await submitRes.json().catch(() => ({}));
  if (!submitRes.ok) throw new Error(`submit ${submitRes.status}: ${JSON.stringify(submitJson)}`);
  const pollingUrl = submitJson.polling_url;
  if (!pollingUrl) throw new Error("no polling_url");
  console.log(`  submitted id=${submitJson.id}`);

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
      const bytes = Buffer.from(await dl.arrayBuffer());
      await fs.writeFile(outPath, bytes);
      console.log(`\nwrote ${outPath} (${bytes.length} bytes)`);
      return;
    }
    if (pollJson.status === "Error" || pollJson.status === "Failed" || pollJson.status === "Content Moderated") {
      throw new Error(`bfl ${pollJson.status}: ${JSON.stringify(pollJson)}`);
    }
    process.stdout.write(".");
  }
  throw new Error("timeout");
}

main().catch((e) => {
  console.error("\nfail:", e.message);
  process.exit(1);
});
