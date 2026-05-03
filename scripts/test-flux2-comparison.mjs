// One-time FLUX.2 model comparison: feed the woonboot input photo to klein/
// pro/max with the same Mono Flat prompt, save the three outputs side by side
// for visual evaluation.
//
// Run: node scripts/test-flux2-comparison.mjs

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const INPUT_PATH = "public/test-inputs/woonboot.png";
const OUT_DIR = "public/test-outputs/flux-comparison";
const ENV_PATH = ".env.local";

const PROMPT = `Transform this facade by replacing all wall surfaces with new modern flat metal cladding panels.

REMOVE: existing wooden plank siding, all wood grain, peeling paint, weathering. Treat current cladding as if it doesn't exist.

ADD: smooth flat metal cladding panels, matt grey finish (approximately RAL 7038, hex #B5B8B1). Panels are 370mm wide and mounted vertically across the facade. Subtle light grey shadow seams between adjacent panels — barely visible, never dark.

PRESERVE EXACTLY AS-IS: all windows, glazing, window frames, doors, roof, gutters, sky, water, foreground railing, surrounding context.

Match the input image framing exactly. No cropping, no zoom change. Output dimensions and composition match input.`;

const MODELS = [
  { name: "klein-4b", slug: "flux-2-klein-4b" },
  { name: "pro", slug: "flux-2-pro-preview" },
  { name: "max", slug: "flux-2-max" },
];

async function loadEnvKey(name) {
  let raw;
  try {
    raw = await fs.readFile(ENV_PATH, "utf8");
  } catch {
    return undefined;
  }
  const target = name.toLowerCase();
  for (const line of raw.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][\w]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    if (m[1].toLowerCase() === target) {
      return m[2].replace(/^["']|["']$/g, "");
    }
  }
  return undefined;
}

// BFL accepts width/height as integers, minimum 64. Compute ~1MP dimensions
// preserving the input aspect, rounded to multiples of 32.
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
    headers: {
      "x-key": apiKey,
      "accept": "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const submitJson = await submitRes.json().catch(() => ({}));
  if (!submitRes.ok) {
    throw new Error(`submit ${submitRes.status}: ${JSON.stringify(submitJson)}`);
  }
  const { id, polling_url, cost } = submitJson;
  if (!polling_url) {
    throw new Error(`no polling_url in submit response: ${JSON.stringify(submitJson)}`);
  }

  const deadline = Date.now() + 90_000; // 90s cap per spec
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500));
    const pollRes = await fetch(polling_url, {
      headers: { "x-key": apiKey, "accept": "application/json" },
    });
    const pollJson = await pollRes.json().catch(() => ({}));
    const status = pollJson.status;
    if (status === "Ready") {
      return {
        sample: pollJson.result?.sample,
        cost: cost ?? pollJson.cost ?? null,
        raw: pollJson,
      };
    }
    if (status === "Error" || status === "Failed" || status === "Content Moderated") {
      throw new Error(`status=${status}: ${JSON.stringify(pollJson)}`);
    }
    // status="Pending" or "Task not found" early — keep polling
  }
  throw new Error(`timeout polling task ${id}`);
}

async function renderOne(model, inputBase64, dims, apiKey) {
  const body = {
    prompt: PROMPT,
    input_image: inputBase64,
    width: dims.width,
    height: dims.height,
    output_format: "jpeg",
    safety_tolerance: 2,
  };
  const start = Date.now();
  const result = await submitAndPoll(model.slug, body, apiKey);
  const elapsed = (Date.now() - start) / 1000;

  if (!result.sample) {
    throw new Error(`no result.sample in polling response: ${JSON.stringify(result.raw)}`);
  }

  const dlRes = await fetch(result.sample);
  if (!dlRes.ok) throw new Error(`download ${dlRes.status} from ${result.sample}`);
  const buf = Buffer.from(await dlRes.arrayBuffer());

  const outPath = path.join(OUT_DIR, `woonboot-${model.name}.jpg`);
  await fs.writeFile(outPath, buf);
  const meta = await sharp(buf).metadata();
  return {
    model: model.slug,
    endpoint: `https://api.bfl.ai/v1/${model.slug}`,
    time_seconds: Number(elapsed.toFixed(2)),
    cost_credits: result.cost,
    output_dimensions: `${meta.width}x${meta.height}`,
    output_path: outPath.replace(/\\/g, "/"),
    status: "success",
    error: null,
  };
}

async function main() {
  const apiKey =
    (await loadEnvKey("renisual_bfl_key")) ??
    (await loadEnvKey("BFL_API_KEY")) ??
    (await loadEnvKey("BFL_API_Key")) ??
    (await loadEnvKey("Flux_API_Key"));
  if (!apiKey) {
    console.error("No BFL key found in .env.local. Add e.g. renisual_bfl_key=bfl_...");
    process.exit(1);
  }

  await fs.mkdir(OUT_DIR, { recursive: true });

  const sourceBytes = await fs.readFile(INPUT_PATH);
  const sourceMeta = await sharp(sourceBytes).metadata();
  const sourceMP = ((sourceMeta.width ?? 0) * (sourceMeta.height ?? 0)) / 1_000_000;

  // Keep test cost predictable: BFL bills per output megapixel, and a 4 MP
  // input pushes the model toward producing a 4 MP output. Cap the input at
  // ~1 MP for fair model-vs-model comparison.
  let inputBytes = sourceBytes;
  let inputMeta = sourceMeta;
  let downscaled = false;
  if (sourceMP > 1.2) {
    const dims = targetDims(sourceMeta.width, sourceMeta.height);
    inputBytes = await sharp(sourceBytes).resize(dims.width, dims.height, { fit: "fill" }).toBuffer();
    inputMeta = await sharp(inputBytes).metadata();
    downscaled = true;
    const downPath = path.join(OUT_DIR, "woonboot-input-1mp.png");
    await fs.writeFile(downPath, inputBytes);
    console.log(`Source: ${INPUT_PATH} ${sourceMeta.width}x${sourceMeta.height} (~${sourceMP.toFixed(2)} MP) — downscaled to ${inputMeta.width}x${inputMeta.height}`);
    console.log(`        downscaled copy saved to ${downPath}`);
  } else {
    console.log(`Source: ${INPUT_PATH} ${sourceMeta.width}x${sourceMeta.height} (~${sourceMP.toFixed(2)} MP) — no downscale needed`);
  }

  const inputBase64 = inputBytes.toString("base64");
  const dims = targetDims(inputMeta.width ?? 1024, inputMeta.height ?? 1024);
  console.log(`Target: ${dims.width}x${dims.height} (~${((dims.width*dims.height)/1_000_000).toFixed(2)} MP)`);
  console.log(`Models: ${MODELS.map((m) => m.slug).join(", ")}\n`);

  globalThis.__inputMetadata = {
    source_path: INPUT_PATH,
    source_dimensions: `${sourceMeta.width}x${sourceMeta.height}`,
    source_megapixels: Number(sourceMP.toFixed(2)),
    downscaled,
    sent_dimensions: `${inputMeta.width}x${inputMeta.height}`,
    sent_megapixels: Number((((inputMeta.width ?? 0) * (inputMeta.height ?? 0)) / 1_000_000).toFixed(2)),
    note: downscaled
      ? "Source was >1.2 MP; downscaled to ~1 MP for cost-controlled fair model comparison. Production may want to re-test the chosen model at native resolution."
      : "Source was already ~1 MP or smaller; sent as-is. Production may want to re-test the chosen model at higher (4 MP) resolution.",
  };

  const results = {};
  for (const m of MODELS) {
    process.stdout.write(`[${m.name}] ${m.slug} ... `);
    try {
      results[m.name] = await renderOne(m, inputBase64, dims, apiKey);
      const r = results[m.name];
      console.log(`✓ ${r.time_seconds}s  ${r.cost_credits ?? "?"} credits  ${r.output_dimensions}  → ${r.output_path}`);
    } catch (err) {
      results[m.name] = {
        model: m.slug,
        endpoint: `https://api.bfl.ai/v1/${m.slug}`,
        status: "failed",
        error: err?.message ?? String(err),
      };
      console.log(`✗ ${results[m.name].error}`);
    }
  }

  const payload = { input: globalThis.__inputMetadata, models: results };
  const resultsPath = path.join(OUT_DIR, "results.json");
  await fs.writeFile(resultsPath, JSON.stringify(payload, null, 2));
  console.log(`\nresults.json:\n${JSON.stringify(payload, null, 2)}`);
  console.log(`\nFiles in ${OUT_DIR}:`);
  for (const m of MODELS) console.log(`  ${OUT_DIR}/woonboot-${m.name}.jpg`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
