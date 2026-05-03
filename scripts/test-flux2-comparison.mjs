// FLUX.2 + Gemini comparison runner. Each input photo gets rendered through
// every (variant × model) combo defined below. Outputs are saved as
// {photo}-{variant}-{model}.jpg so adding new variants is incremental and
// already-rendered combinations are skipped.
//
// Run: node scripts/test-flux2-comparison.mjs

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { GoogleGenAI, Modality } from "@google/genai";

const INPUT_DIR = "public/test-inputs";
const OUT_DIR = "public/test-outputs/flux-comparison";
const ENV_PATH = ".env.local";
const IMG_RE = /\.(jpe?g|png|webp)$/i;

const PROMPT_PRESERVE = `PRESERVE EXACTLY AS-IS: all windows, glazing, window frames, doors, roof, gutters, sky, water, foreground railing, surrounding context.

Match the input image framing exactly. No cropping, no zoom change. Output dimensions and composition match input.`;

const PROMPT_REMOVE = `REMOVE: existing wooden plank siding, all wood grain, peeling paint, weathering. Treat current cladding as if it doesn't exist.`;

const VARIANTS = [
  {
    name: "mono-flat-vertical",
    label: "Mono Flat — vertical panels",
    prompt: `Transform this facade by replacing all wall surfaces with new modern flat metal cladding panels.

${PROMPT_REMOVE}

ADD: smooth flat metal cladding panels, matt grey finish (approximately RAL 7038, hex #B5B8B1). Panels are 370mm wide and mounted VERTICALLY across the facade — vertical seams between adjacent panels every 370mm. Subtle light grey shadow seams — barely visible, never dark.

${PROMPT_PRESERVE}`,
  },
  {
    name: "mono-flat-horizontal",
    label: "Mono Flat — horizontal panels",
    prompt: `Transform this facade by replacing all wall surfaces with new modern flat metal cladding panels.

${PROMPT_REMOVE}

ADD: smooth flat metal cladding panels, matt grey finish (approximately RAL 7038, hex #B5B8B1). Panels are 370mm tall and mounted HORIZONTALLY across the facade — horizontal seams between adjacent panels every 370mm. Subtle light grey shadow seams — barely visible, never dark.

${PROMPT_PRESERVE}`,
  },
  {
    name: "mono-groove-vertical",
    label: "Mono Groove — vertical grooves",
    prompt: `Transform this facade by replacing all wall surfaces with new modern Mono Groove metal cladding.

${PROMPT_REMOVE}

ADD: vertically-mounted metal cladding panels with prominent vertical standing-seam grooves running top to bottom. Matt grey finish (approximately RAL 7038, hex #B5B8B1). Panels are 370mm wide. The grooves are about 20mm wide channels between panels, with visible shadow lines — distinctive standing-seam look, NOT flat.

${PROMPT_PRESERVE}`,
  },
  {
    name: "mono-groove-horizontal",
    label: "Mono Groove — horizontal grooves",
    prompt: `Transform this facade by replacing all wall surfaces with new modern Mono Groove metal cladding.

${PROMPT_REMOVE}

ADD: horizontally-mounted metal cladding panels with prominent horizontal standing-seam grooves running left to right. Matt grey finish (approximately RAL 7038, hex #B5B8B1). Panels are 370mm tall. The grooves are about 20mm wide channels between panels, with visible shadow lines — distinctive standing-seam look, NOT flat.

${PROMPT_PRESERVE}`,
  },
];

const MODELS = [
  { name: "gemini", slug: "gemini-2.5-flash-image", provider: "gemini" },
  { name: "klein-4b", slug: "flux-2-klein-4b", provider: "bfl" },
  { name: "klein-9b", slug: "flux-2-klein-9b", provider: "bfl" },
  { name: "pro", slug: "flux-2-pro-preview", provider: "bfl" },
  { name: "max", slug: "flux-2-max", provider: "bfl" },
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

function targetDims(inWidth, inHeight) {
  const aspect = inWidth / inHeight;
  const h = Math.sqrt(1_000_000 / aspect);
  const w = h * aspect;
  const round32 = (n) => Math.max(64, Math.round(n / 32) * 32);
  return { width: round32(w), height: round32(h) };
}

function pickGeminiAspectRatio(w, h) {
  const ratios = { "1:1": 1, "4:3": 4/3, "3:4": 3/4, "16:9": 16/9, "9:16": 9/16, "3:2": 3/2, "2:3": 2/3 };
  const a = w / h;
  let best = "1:1", diff = Infinity;
  for (const [k, v] of Object.entries(ratios)) {
    const d = Math.abs(a - v);
    if (d < diff) { diff = d; best = k; }
  }
  return best;
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
  if (!polling_url) throw new Error(`no polling_url: ${JSON.stringify(submitJson)}`);

  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500));
    const pollRes = await fetch(polling_url, { headers: { "x-key": apiKey, "accept": "application/json" } });
    const pollJson = await pollRes.json().catch(() => ({}));
    const status = pollJson.status;
    if (status === "Ready") {
      return { sample: pollJson.result?.sample, cost: cost ?? pollJson.cost ?? null, raw: pollJson };
    }
    if (status === "Error" || status === "Failed" || status === "Content Moderated") {
      throw new Error(`status=${status}: ${JSON.stringify(pollJson)}`);
    }
  }
  throw new Error(`timeout polling task ${id}`);
}

async function renderBfl(model, prompt, inputBase64, dims, apiKey, outPath) {
  const body = {
    prompt, input_image: inputBase64,
    width: dims.width, height: dims.height,
    output_format: "jpeg", safety_tolerance: 2,
  };
  const start = Date.now();
  const result = await submitAndPoll(model.slug, body, apiKey);
  const elapsed = (Date.now() - start) / 1000;
  if (!result.sample) throw new Error("no result.sample");

  const dlRes = await fetch(result.sample);
  if (!dlRes.ok) throw new Error(`download ${dlRes.status}`);
  const buf = Buffer.from(await dlRes.arrayBuffer());
  await fs.writeFile(outPath, buf);
  const meta = await sharp(buf).metadata();
  return {
    model: model.slug, time_seconds: Number(elapsed.toFixed(2)),
    cost_credits: result.cost, output_dimensions: `${meta.width}x${meta.height}`,
    output_path: outPath.replace(/\\/g, "/"), status: "success", error: null,
  };
}

async function renderGemini(model, prompt, inputBytes, inputMeta, geminiKey, outPath) {
  const ai = new GoogleGenAI({ apiKey: geminiKey });
  const aspectRatio = pickGeminiAspectRatio(inputMeta.width ?? 1, inputMeta.height ?? 1);
  const photoPart = { inlineData: { mimeType: "image/jpeg", data: inputBytes.toString("base64") } };
  const parts = [
    { text: "BASE PHOTO — edit this image. The output must match this image's camera angle, frame edges, and aspect ratio exactly. Modify only the wall cladding surface; everything else (frame, sky, surroundings, windows, doors, roof) stays in place." },
    photoPart,
    { text: prompt },
  ];

  const start = Date.now();
  const response = await ai.models.generateContent({
    model: model.slug,
    contents: parts,
    config: { responseModalities: [Modality.IMAGE, Modality.TEXT], temperature: 0.3, imageConfig: { aspectRatio } },
  });
  const elapsed = (Date.now() - start) / 1000;
  const imagePart = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!imagePart?.inlineData?.data) throw new Error("gemini returned no image");
  const buf = Buffer.from(imagePart.inlineData.data, "base64");
  await fs.writeFile(outPath, buf);
  const meta = await sharp(buf).metadata();
  return {
    model: model.slug, time_seconds: Number(elapsed.toFixed(2)),
    cost_credits: null, output_dimensions: `${meta.width}x${meta.height}`,
    output_path: outPath.replace(/\\/g, "/"), status: "success", error: null,
  };
}

async function prepareInput(filename) {
  const sourcePath = path.join(INPUT_DIR, filename);
  const sourceBytes = await fs.readFile(sourcePath);
  const sourceMeta = await sharp(sourceBytes).rotate().metadata();
  const sourceMP = ((sourceMeta.width ?? 0) * (sourceMeta.height ?? 0)) / 1_000_000;

  let inputBytes = sourceBytes;
  let inputMeta = sourceMeta;
  let downscaled = false;
  if (sourceMP > 1.2) {
    const dims = targetDims(sourceMeta.width, sourceMeta.height);
    inputBytes = await sharp(sourceBytes).rotate().resize(dims.width, dims.height, { fit: "fill" }).toBuffer();
    inputMeta = await sharp(inputBytes).metadata();
    downscaled = true;
  }

  return {
    sourcePath, filename, base: filename.replace(IMG_RE, ""),
    bytes: inputBytes, meta: inputMeta,
    metadata: {
      source_path: sourcePath.replace(/\\/g, "/"),
      source_dimensions: `${sourceMeta.width}x${sourceMeta.height}`,
      source_megapixels: Number(sourceMP.toFixed(2)),
      downscaled,
      sent_dimensions: `${inputMeta.width}x${inputMeta.height}`,
    },
  };
}

async function main() {
  const bflKey = (await loadEnvKey("renisual_bfl_key")) ?? (await loadEnvKey("BFL_API_KEY")) ?? (await loadEnvKey("Flux_API_Key"));
  const geminiKey = (await loadEnvKey("GEMINI_API_KEY")) ?? (await loadEnvKey("Gemini_API_Key"));
  if (!bflKey && !geminiKey) {
    console.error("No API keys found in .env.local");
    process.exit(1);
  }

  await fs.mkdir(OUT_DIR, { recursive: true });

  const dirEntries = await fs.readdir(INPUT_DIR);
  const inputFiles = dirEntries.filter((f) => IMG_RE.test(f)).sort();
  if (inputFiles.length === 0) {
    console.error(`No image files in ${INPUT_DIR}`);
    process.exit(1);
  }
  console.log(`Inputs:   ${inputFiles.length} (${inputFiles.join(", ")})`);
  console.log(`Variants: ${VARIANTS.length} (${VARIANTS.map((v) => v.name).join(", ")})`);
  console.log(`Models:   ${MODELS.length} (${MODELS.map((m) => m.name).join(", ")})`);
  console.log(`Total:    ${inputFiles.length * VARIANTS.length * MODELS.length} renders (skipping cached)\n`);

  const overall = { runs: [] };
  for (const filename of inputFiles) {
    const input = await prepareInput(filename);
    const dims = targetDims(input.meta.width ?? 1024, input.meta.height ?? 1024);
    const inputBase64 = input.bytes.toString("base64");
    console.log(`=== ${filename}  ${input.metadata.source_dimensions}` +
                (input.metadata.downscaled ? ` → ${input.metadata.sent_dimensions}` : "") + " ===");

    const variantResults = {};
    for (const v of VARIANTS) {
      const modelResults = {};
      for (const m of MODELS) {
        const outPath = path.join(OUT_DIR, `${input.base}-${v.name}-${m.name}.jpg`);
        try {
          const stat = await fs.stat(outPath);
          if (stat.isFile() && stat.size > 0) {
            const buf = await fs.readFile(outPath);
            const meta = await sharp(buf).metadata();
            modelResults[m.name] = {
              model: m.slug, output_dimensions: `${meta.width}x${meta.height}`,
              output_path: outPath.replace(/\\/g, "/"), status: "success", error: null,
              note: "cached",
            };
            console.log(`  [${v.name}/${m.name}] ⊘ skip (cached)`);
            continue;
          }
        } catch { /* render below */ }

        process.stdout.write(`  [${v.name}/${m.name}] ${m.slug} ... `);
        try {
          if (m.provider === "gemini") {
            if (!geminiKey) throw new Error("no GEMINI_API_KEY");
            modelResults[m.name] = await renderGemini(m, v.prompt, input.bytes, input.meta, geminiKey, outPath);
          } else {
            if (!bflKey) throw new Error("no BFL key");
            modelResults[m.name] = await renderBfl(m, v.prompt, inputBase64, dims, bflKey, outPath);
          }
          const r = modelResults[m.name];
          const costStr = r.cost_credits != null ? `${r.cost_credits} cr` : "(n/a)";
          console.log(`✓ ${r.time_seconds}s  ${costStr}  ${r.output_dimensions}`);
        } catch (err) {
          modelResults[m.name] = {
            model: m.slug, status: "failed", error: err?.message ?? String(err),
          };
          console.log(`✗ ${modelResults[m.name].error}`);
        }
      }
      variantResults[v.name] = modelResults;
    }

    overall.runs.push({ input: input.metadata, variants: variantResults });
    console.log("");
  }

  const totals = { credits: 0, time_seconds: 0, ok: 0, failed: 0, cached: 0 };
  for (const run of overall.runs) {
    for (const variant of Object.values(run.variants)) {
      for (const r of Object.values(variant)) {
        if (r.note === "cached") totals.cached++;
        else if (r.status === "success") {
          totals.credits += r.cost_credits ?? 0;
          totals.time_seconds += r.time_seconds ?? 0;
          totals.ok++;
        } else totals.failed++;
      }
    }
  }
  overall.totals = {
    new_renders: totals.ok, cached_renders: totals.cached, failed_renders: totals.failed,
    new_cost_credits: Number(totals.credits.toFixed(2)),
    approx_new_cost_usd: Number((totals.credits * 0.001).toFixed(4)),
    new_time_seconds: Number(totals.time_seconds.toFixed(2)),
  };
  overall.notes = [
    "BFL cost field returns credits, not USD. approx_new_cost_usd uses ~$0.001/credit.",
    "Inputs >1.2 MP auto-downscaled to ~1 MP for fair comparison.",
    "Variant matrix: 4 prompts (Mono Flat × {vertical, horizontal} + Mono Groove × {vertical, horizontal}).",
  ];

  const resultsPath = path.join(OUT_DIR, "results.json");
  await fs.writeFile(resultsPath, JSON.stringify(overall, null, 2));
  console.log(`results.json → ${resultsPath}`);
  console.log(`Totals: ${totals.ok} new, ${totals.cached} cached, ${totals.failed} failed | ${overall.totals.new_cost_credits} credits (~$${overall.totals.approx_new_cost_usd}) | ${overall.totals.new_time_seconds}s`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
