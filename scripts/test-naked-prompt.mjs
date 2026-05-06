// Naked-prompt BFL test — text-only render (no input_image, no SAM, no
// post-processing). Mirrors the BFL playground behaviour so we can see
// what klein-9b produces from prompt alone.
//
// Run: node scripts/test-naked-prompt.mjs

import fs from "node:fs/promises";
import path from "node:path";

const ENV_PATH = ".env.local";
const OUT_DIR = "public/test-outputs/naked-prompt";

const PROMPT = `A modern Dutch houseboat (woonboot) moored at a canal in a residential area, photographed from the water side on an overcast afternoon. The houseboat has flat sidewalls clad with printed brick-look panels — irregular weathered brick shapes in varied tones of warm brown, tan, cream-white and grey-brown, arranged in horizontal courses with offset rows and subtle white mortar lines between bricks. The surface gives the look of aged reclaimed brick masonry on a flat panel (very slight relief from the print, not truly protruding bricks). White PVC window frames, anthracite-grey door, dark grey roof, gutters and chimney. Trees and a neighbouring house in the background, calm water in the foreground. Realistic photography, natural daylight, eye-level perspective.`;

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
  throw new Error("no bfl key found in .env.local");
}

async function renderNaked(apiKey, prompt, w, h) {
  const submitRes = await fetch("https://api.bfl.ai/v1/flux-2-klein-9b", {
    method: "POST",
    headers: {
      "x-key": apiKey,
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      width: w,
      height: h,
      output_format: "jpeg",
      safety_tolerance: 2,
    }),
  });
  const submitJson = await submitRes.json().catch(() => ({}));
  if (!submitRes.ok) {
    throw new Error(`submit ${submitRes.status}: ${JSON.stringify(submitJson)}`);
  }
  const pollingUrl = submitJson.polling_url;
  if (!pollingUrl) throw new Error(`no polling_url: ${JSON.stringify(submitJson)}`);
  console.log(`  submitted id=${submitJson.id}`);

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500));
    const pollRes = await fetch(pollingUrl, {
      headers: { "x-key": apiKey, accept: "application/json" },
    });
    const pollJson = await pollRes.json().catch(() => ({}));
    if (pollJson.status === "Ready") {
      const sample = pollJson.result?.sample;
      if (!sample) throw new Error("no sample url");
      const dl = await fetch(sample);
      if (!dl.ok) throw new Error(`download ${dl.status}`);
      return Buffer.from(await dl.arrayBuffer());
    }
    if (
      pollJson.status === "Error" ||
      pollJson.status === "Failed" ||
      pollJson.status === "Content Moderated"
    ) {
      throw new Error(`bfl ${pollJson.status}: ${JSON.stringify(pollJson)}`);
    }
    process.stdout.write(".");
  }
  throw new Error("timeout");
}

async function main() {
  const apiKey = await loadKey();
  await fs.mkdir(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outPath = path.join(OUT_DIR, `naked-${stamp}.jpg`);
  console.log(`prompt:\n${PROMPT}\n`);
  console.log(`dims: ${WIDTH}x${HEIGHT}`);
  console.log(`rendering...`);
  const bytes = await renderNaked(apiKey, PROMPT, WIDTH, HEIGHT);
  await fs.writeFile(outPath, bytes);
  console.log(`\nwrote ${outPath} (${bytes.length} bytes)`);
}

main().catch((e) => {
  console.error("fail:", e.message);
  process.exit(1);
});
