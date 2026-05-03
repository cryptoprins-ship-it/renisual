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

// Real woonboot facade dimensions: 1350cm wide × 355cm tall.
//
// Mono Flat = SEAMLESS — panels butt naadloos together, no visible joints, no
// grooves. The whole facade reads as one continuous flat metal surface. Panels
// are 370mm wide for vertical (36 panels across) or 370mm tall for horizontal
// (10 rows). Vertical = full-height panels, no horizontal couplings.
//
// Mono Groove = same panel widths as Mono Flat, but each panel face has 3
// decorative grooves cut into it (running parallel to the panel direction),
// PLUS hairline seams between adjacent panels. So per 370mm panel the viewer
// sees 4 lines: 3 grooves + 1 panel-edge seam.
const FACADE_DIMS = `The facade is 1350cm wide and 355cm tall.`;

const PROMPT_PRESERVE = `APPLY CLADDING ONLY TO: the houseboat's exterior wall surfaces between the roof and the waterline/foundation. The walls are the flat painted/sided panels of the building's hull and superstructure.

DO NOT APPLY CLADDING TO ANY OF THE FOLLOWING — they keep their original color, material, and texture exactly as in the source photo:
- Fences, gates, hekwerk, wire mesh, balustrades, railings, gratings, bars (any barrier between camera and the houseboat — these are NOT walls even if they fill a rectangular area in front of the building)
- Vegetation: trees, hedges, plants, leaves, branches
- Foreground objects: bins, containers, equipment, tools, stored items, stairs, ramps
- Sky, clouds, water surface, water reflections, ripples
- Neighboring buildings (different houses next to the woonboot)
- Roof, roof tiles, roof edge, gutters, chimneys, antennas
- Windows, glazing, window frames (kozijnen) — keep their ORIGINAL color, do NOT recolor to match cladding
- Doors, door frames, door handles — keep ORIGINAL color
- Fascia, eaves boards (boeidelen), trim — keep ORIGINAL color, do NOT recolor to match cladding

DO NOT INVENT new windows, doors, vents, lights, balconies, or any architectural features. Walls that have no windows in the source MUST remain blank cladding — do NOT add imagined windows just because the building shape suggests they should be there.

Match the input image framing exactly. No cropping, no zoom change. Output dimensions and composition match input.`;

const PROMPT_REMOVE = `REMOVE: existing wooden plank siding, all wood grain, peeling paint, weathering. Treat current cladding as if it doesn't exist.`;

function structureAddendum(orientation) {
  const dir = orientation === "vertical" ? "vertical" : "horizontal";
  const dirOpp = orientation === "vertical" ? "top to bottom" : "left to right";
  return `ADDITIONAL DETAIL — SURFACE TEXTURE:

Plus a fine ${dir} wood-grain linen texture embossed on each panel face — subtle 3D relief running ${dirOpp} across the panel surface, parallel to the panel orientation. Not deep grooves, just textured surface like brushed wood grain. The texture catches light differently across the panel, giving each panel a tactile woven appearance while maintaining the overall flat panel shape. Texture follows each panel face individually — it does NOT bleed across panel boundaries or coupling joints.

The panels remain flat overall — the texture is surface detail only, not a structural change.`;
}

const VARIANTS = [
  {
    name: "mono-flat-vertical",
    label: "Mono Flat — vertical (smalle naad, no horizontal couplings)",
    prompt: `Transform this facade by replacing all wall surfaces with smooth flat metal cladding panels.

${FACADE_DIMS}

${PROMPT_REMOVE}

ADD: matt grey RAL 7038 (hex #B5B8B1) smooth flat metal cladding panels. Panels are 370mm wide and run the FULL 355cm height as unbroken vertical strips — NO horizontal couplings, NO horizontal joints anywhere. Mounted vertically across the 1350cm width (~36 panels side by side). Between adjacent panels is only a "smalle naad" — a very narrow hairline seam in the SAME RAL 7038 grey color as the panels, barely visible from a few meters back, never a contrasting dark shadow line. The overall facade reads as a near-uniform smooth flat metal surface with subtle same-color vertical hairline articulation.

${PROMPT_PRESERVE}`,
  },
  {
    name: "mono-flat-horizontal",
    label: "Mono Flat — horizontal (smalle naad rows + same-color couplings)",
    prompt: `Transform this facade by replacing all wall surfaces with smooth flat metal cladding panels.

${FACADE_DIMS}

${PROMPT_REMOVE}

ADD: matt grey RAL 7038 (hex #B5B8B1) smooth flat metal cladding panels. Panels are 370mm tall, mounted horizontally in rows across the 1350cm width. Between adjacent rows is a "smalle naad" — a very narrow hairline seam in the SAME RAL 7038 grey color as the panels, never a contrasting dark shadow. Standard panels are max 6000mm long, so each horizontal row must be split into 2 or 3 segments joined by vertical butt coupling profiles — also painted RAL 7038 grey, so the coupling joints are also same-color hairline seams, not dark contrasting lines. Place couplings at aesthetically balanced positions: divide each row into 3 equal segments of ~450cm with vertical butt joints aligned vertically at ~450cm and ~900cm from the left edge. Overall: a near-uniform smooth flat metal surface with subtle same-color hairline articulation along rows and a few aligned same-color vertical couplings.

${PROMPT_PRESERVE}`,
  },
  {
    name: "mono-groove-vertical",
    label: "Mono Groove — vertical (370mm panel + 3 grooves per face)",
    prompt: `Transform this facade by replacing all wall surfaces with Mono Groove metal cladding.

${FACADE_DIMS}

${PROMPT_REMOVE}

ADD: matt grey RAL 7038 (hex #B5B8B1) Mono Groove metal cladding. Panels are 370mm wide and run the FULL 355cm height as unbroken vertical strips — NO horizontal couplings, NO horizontal joints. Mounted vertically across the 1350cm width (~36 panels side by side). Between adjacent panels is a smalle naad — a narrow same-color hairline seam (NOT a dark line). On TOP of that, each panel face has THREE narrow vertical decorative grooves cut into it, evenly spaced and running top-to-bottom across the full panel height — about 5mm wide grooves with crisp shadow lines (these grooves ARE shaded because they are physically recessed into the panel face), dividing each 370mm panel face into four roughly equal vertical segments. Net result: pronounced vertical line pattern, with the in-panel grooves visually stronger than the same-color panel-to-panel hairline seams.

${PROMPT_PRESERVE}`,
  },
  {
    name: "mono-groove-horizontal",
    label: "Mono Groove — horizontal (370mm row + 3 grooves + same-color couplings)",
    prompt: `Transform this facade by replacing all wall surfaces with Mono Groove metal cladding.

${FACADE_DIMS}

${PROMPT_REMOVE}

ADD: matt grey RAL 7038 (hex #B5B8B1) Mono Groove metal cladding. Panels are 370mm tall, mounted horizontally in rows across the 1350cm width. Each row is split into 3 segments of ~450cm joined by vertical butt coupling profiles (also painted RAL 7038 — same color as panels, hairline seam not a dark shadow), aligned vertically at ~450cm and ~900cm from the left edge. Between adjacent rows is a smalle naad — a same-color hairline seam, not a dark line. On TOP of that, each panel face has THREE narrow horizontal decorative grooves cut into it, evenly spaced and running left-to-right across the panel width — about 5mm wide grooves with crisp shadow lines (these grooves ARE shaded because they are physically recessed into the panel face), dividing each 370mm row face into four roughly equal horizontal segments. Net result: pronounced horizontal line pattern with the in-panel grooves visually stronger than the same-color row-to-row hairline seams; the vertical couplings are barely visible same-color hairlines.

${PROMPT_PRESERVE}`,
  },
  {
    name: "flat-structure",
    label: "Mono Flat + Structure — horizontal (linen texture + same-color couplings)",
    bflOnly: true,
    prompt: `Transform this facade by replacing all wall surfaces with smooth flat metal cladding panels with embossed linen surface texture.

${FACADE_DIMS}

${PROMPT_REMOVE}

ADD: matt grey RAL 7038 (hex #B5B8B1) flat metal cladding panels. Panels are 370mm tall, mounted horizontally in rows across the 1350cm width. Between adjacent rows is a smalle naad (same-color hairline seam, not a dark line). Each row is split into 3 segments of ~450cm joined by vertical butt coupling profiles (also painted RAL 7038 — same-color hairline, not contrasting), aligned at ~450cm and ~900cm from the left edge.

${structureAddendum("horizontal")}

${PROMPT_PRESERVE}`,
  },
  {
    name: "flat-structure-vertical",
    label: "Mono Flat + Structure — vertical (linen texture, no couplings)",
    bflOnly: true,
    prompt: `Transform this facade by replacing all wall surfaces with smooth flat metal cladding panels with embossed linen surface texture.

${FACADE_DIMS}

${PROMPT_REMOVE}

ADD: matt grey RAL 7038 (hex #B5B8B1) flat metal cladding panels. Panels are 370mm wide and run the FULL 355cm height as unbroken vertical strips — NO horizontal couplings, NO horizontal joints anywhere. Mounted vertically across the 1350cm width (~36 panels side by side). Between adjacent panels is a smalle naad — a narrow same-color hairline seam (NOT a dark contrasting line).

${structureAddendum("vertical")}

${PROMPT_PRESERVE}`,
  },
  {
    name: "groove-structure",
    label: "Mono Groove + Structure — horizontal (3 grooves + linen texture + same-color couplings)",
    bflOnly: true,
    prompt: `Transform this facade by replacing all wall surfaces with Mono Groove metal cladding with embossed linen surface texture.

${FACADE_DIMS}

${PROMPT_REMOVE}

ADD: matt grey RAL 7038 (hex #B5B8B1) Mono Groove metal cladding. Panels are 370mm tall, mounted horizontally in rows across the 1350cm width, with each row split into 3 segments of ~450cm joined by vertical butt coupling profiles (also painted RAL 7038 — same-color hairline) at ~450cm and ~900cm from the left edge. Between adjacent rows is a smalle naad — a same-color hairline seam, not a dark line. Each panel face has THREE narrow horizontal decorative grooves cut into it, evenly spaced and running left-to-right — about 5mm wide grooves with crisp shadow lines (these grooves ARE shaded because they are physically recessed into the panel face), dividing each 370mm row face into four roughly equal horizontal segments.

${structureAddendum("horizontal")} Three visual layers must coexist: (1) same-color hairline seams between rows (subtle), (2) the three internal horizontal grooves per panel face (more prominent, shaded recess), (3) the horizontal linen wood-grain texture on the smooth panel surfaces between grooves. The texture sits ON the panel face, the grooves cut INTO the panel, the seams BETWEEN panels — three distinct visual layers, not conflated.

${PROMPT_PRESERVE}`,
  },
  {
    name: "groove-structure-vertical",
    label: "Mono Groove + Structure — vertical (3 grooves + linen texture, no couplings)",
    bflOnly: true,
    prompt: `Transform this facade by replacing all wall surfaces with Mono Groove metal cladding with embossed linen surface texture.

${FACADE_DIMS}

${PROMPT_REMOVE}

ADD: matt grey RAL 7038 (hex #B5B8B1) Mono Groove metal cladding. Panels are 370mm wide and run the FULL 355cm height as unbroken vertical strips — NO horizontal couplings, NO horizontal joints. Mounted vertically across the 1350cm width (~36 panels side by side). Between adjacent panels is a smalle naad — a narrow same-color hairline seam (NOT a dark line). Each panel face has THREE narrow vertical decorative grooves cut into it, evenly spaced and running top-to-bottom across the full panel height — about 5mm wide grooves with crisp shadow lines (these grooves ARE shaded because they are physically recessed into the panel face), dividing each 370mm panel face into four roughly equal vertical segments.

${structureAddendum("vertical")} Three visual layers must coexist: (1) same-color hairline seams between panels (subtle), (2) the three internal vertical grooves per panel face (more prominent, shaded recess), (3) the vertical linen wood-grain texture on the smooth panel surfaces between grooves. The texture sits ON the panel face, the grooves cut INTO the panel, the seams BETWEEN panels — three distinct visual layers, not conflated.

${PROMPT_PRESERVE}`,
  },
];

// Surviving primary candidate: klein-9b only.
// Production fallback (not active in this test): Gemini, only if BFL fails.
// Eliminated as primary candidates:
//   pro-preview — scale drift
//   klein-4b    — orientation drift
//   max         — color inconsistency across same-prompt runs
//   gemini      — needs much more elaborate prompts; demoted to fallback
const MODELS = [
  { name: "klein-9b", slug: "flux-2-klein-9b", provider: "bfl" },
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
      const modelsForVariant = v.bflOnly ? MODELS.filter((m) => m.provider === "bfl") : MODELS;
      for (const m of modelsForVariant) {
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
