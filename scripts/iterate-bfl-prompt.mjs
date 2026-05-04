// Autonomous prompt-iteration loop for production /api/render BFL path.
// Renders 5 test cases on klein-9b with the experimental prompt below,
// saves outputs to public/test-outputs/iterate/. After each run I review,
// update the prompt in this script, re-run, until all 5 pass.
//
// Final prompt gets mirrored to app/api/render/route.ts.
//
// Run: node scripts/iterate-bfl-prompt.mjs

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// Only "clean" facade photos — matches the disclaimer asking users to
// upload a photo without fences/obstacles. The fence boat is excluded
// from prompt iteration because it's out-of-spec input.
const PHOTOS = [
  { id: "p1-canal",       file: "IMG_20260422_095323.jpg" },                    // single-storey canal front
  { id: "p3-white2story", file: "woonboot_dubbellaags_achterkant.jpg" },        // white 2-storey back
  { id: "p4-mixed-back",  file: "woonboot_achterkant_dubbelenenkel.jpg" },      // mixed double/single back
];
const OUT_DIR = "public/test-outputs/iterate";
const ENV_PATH = ".env.local";

// Test matrix: 5 products covering Flat/Groove × dark/mid/light + Structure.
const CASES = [
  { id: "PB7038A-V",    line: "flat",   color: { name: "matt grey",         ral: "7038", hex: "#B5B8B1" }, structure: false, orientation: "vertical" },
  { id: "PB9005A-V",    line: "flat",   color: { name: "diepzwart",         ral: "9005", hex: "#0A0A0A" }, structure: false, orientation: "vertical" },
  { id: "SG7038A-V",    line: "groove", color: { name: "matt grey",         ral: "7038", hex: "#B5B8B1" }, structure: false, orientation: "vertical" },
  { id: "SG7038A-H",    line: "groove", color: { name: "matt grey",         ral: "7038", hex: "#B5B8B1" }, structure: false, orientation: "horizontal" },
  // RAL 9003 = signal white. Use cool pure-white hex (#F4F4F4) — the
  // warm RAL 9010 cream value (#F1ECE0) was rendering beige.
  { id: "SG9003A-V",    line: "groove", color: { name: "pure cool white",   ral: "9003", hex: "#F4F4F4" }, structure: false, orientation: "vertical" },
  { id: "YMSG7038A-V",  line: "groove", color: { name: "matt grey",         ral: "7038", hex: "#B5B8B1" }, structure: true,  orientation: "vertical" },
  { id: "YMSG7038A-H",  line: "groove", color: { name: "matt grey",         ral: "7038", hex: "#B5B8B1" }, structure: true,  orientation: "horizontal" },
];

// Hex compensation — luminance-aware, skips whites.
function darkenHex(hex, amount) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r0 = (n >> 16) & 0xff, g0 = (n >> 8) & 0xff, b0 = n & 0xff;
  const lum = (0.2126 * r0 + 0.7152 * g0 + 0.0722 * b0) / 255;
  if (lum > 0.82) return hex;
  const eff = lum > 0.65 ? amount * 0.5 : amount;
  const r = Math.max(0, Math.round(r0 * (1 - eff)));
  const g = Math.max(0, Math.round(g0 * (1 - eff)));
  const b = Math.max(0, Math.round(b0 * (1 - eff)));
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

// === EXPERIMENTAL PROMPT — recolor existing plank rhythm approach ===
//
// Insight from real Spanl product photos (2026-05-04): on a woonboot
// already clad with rabat (wood plank), the panels mount in essentially
// the same plank rhythm as the existing wood. The visual difference
// between Mono Flat and Mono Groove is the depth of the inter-plank
// shadow + extra in-panel grooves. Mono Flat panels have a near-invisible
// naad; Mono Groove has 3 grooves per panel face; +Structure adds a
// fine fabric-weave-like vertical relief.
//
// So instead of "tear off the wood, build new cladding", the prompt is
// "recolor the existing plank surface, adjust shadow depth per variant,
// optionally add fine relief". This preserves the photo's lighting,
// perspective, and architectural detail and avoids AI hallucination.
function buildPrompt(c) {
  const targetHex = c.color.hex;
  const renderHex = darkenHex(targetHex, 0.15);
  const ralLine = `RAL ${c.color.ral}`;
  const colorLine = renderHex !== targetHex
    ? `${c.color.name} ${ralLine} (target ${targetHex}, render at ${renderHex} to compensate model lightening bias)`
    : `${c.color.name} ${ralLine} (hex ${targetHex})`;

  const isGroove = c.line === "groove";

  // Per-color anti-bias notes
  const isWhite = ["9003", "9010"].includes(c.color.ral);
  const isBlack = c.color.ral === "9005";
  const colorWarn = isWhite
    ? "Render as PURE COOL WHITE. NOT cream, NOT beige, NOT yellow-tinted."
    : isBlack
    ? "Render as TRUE COOL BLACK. NOT brown, NOT warm-tinted."
    : "Render at the matt RAL color. NOT warm-tinted, NOT shifted.";

  const variantDetail = c.structure
    ? `Mono Groove + Structure: keep the plank-to-plank shadows of the source AS-IS in their existing rhythm. Add 2 extra shallow vertical grooves within each plank face (3 visible vertical lines per plank). On TOP of that, render a fine vertical fabric-weave / linen relief on each panel face — many close-spaced fine vertical lines pressed into the matt metal surface, like a brushed grain texture. Subtle 3D relief, NOT deep grooves, NOT wood, NOT planking texture.`
    : isGroove
    ? `Mono Groove: keep the plank-to-plank shadows of the source AS-IS in their existing rhythm. Add 2 extra shallow vertical grooves within each plank face (3 visible vertical lines per plank). Surface between grooves is smooth matt metal in the chosen RAL.`
    : `Mono Flat: SMOOTH matt metal cladding with nearly invisible plank-to-plank seams. Lighten / soften the plank-to-plank shadow lines from the source so they read as hairline naden, NOT prominent plank gaps. From facade distance the wall reads as one continuous matt-painted metal surface.`;

  return `RECOLOR AND RE-CLAD this wall. Take the EXISTING wall siding rhythm (the wood-plank pattern visible in the source photo) and re-render it as Spanl-style painted matt metal cladding in the chosen RAL color. The wall's existing plank rhythm, panel positions, and overall geometry stay the same — only the color, material, and surface finish change.

WALL COLOR: ${colorLine}. ${colorWarn} The existing wood color of the source is REPLACED entirely with this RAL color.

WALL MATERIAL: matt painted metal cladding (Spanl PB / SG / YMSG style). The metal is non-reflective, NOT glossy, NOT weathered, NOT wood. Powder-coated finish.

VARIANT DETAIL — ${variantDetail}

SOURCE-CONTEXT PRESERVATION:
- KEEP the wall's existing plank rhythm, plank widths, and plank positions as visible in the source photo. Do NOT invent a different plank arrangement.
- KEEP all windows, glazing, window frames (kozijnen) in their ORIGINAL color from the source.
- KEEP doors and door frames in their ORIGINAL color.
- KEEP the roof, gutters, chimneys, sky, water, vegetation, neighbors, fences, and any foreground objects unchanged.
- DO NOT apply cladding to fences, mesh, balustrades, vegetation, foreground objects.
- DO NOT INVENT new windows, doors, or architectural features.

Match the input image framing exactly. No cropping, no zoom change.`;
}

async function loadEnvKey(name) {
  let raw;
  try { raw = await fs.readFile(ENV_PATH, "utf8"); } catch { return undefined; }
  for (const line of raw.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][\w]*)\s*=\s*(.*)\s*$/.exec(line);
    if (m && m[1].toLowerCase() === name.toLowerCase()) return m[2].replace(/^["']|["']$/g, "");
  }
  return undefined;
}

function targetDims(w, h) {
  const aspect = w / h;
  const height = Math.sqrt(1_000_000 / aspect);
  const width = height * aspect;
  const r = (n) => Math.max(64, Math.round(n / 32) * 32);
  return { width: r(width), height: r(height) };
}

async function renderCase(c, photo, baseB64, dims, apiKey) {
  const prompt = buildPrompt(c);
  const submitRes = await fetch("https://api.bfl.ai/v1/flux-2-klein-9b", {
    method: "POST",
    headers: { "x-key": apiKey, accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({
      prompt,
      input_image: baseB64,
      width: dims.width,
      height: dims.height,
      output_format: "jpeg",
      safety_tolerance: 2,
    }),
  });
  const submitJson = await submitRes.json().catch(() => ({}));
  if (!submitRes.ok) throw new Error(`submit ${submitRes.status}: ${JSON.stringify(submitJson)}`);
  const { polling_url, cost } = submitJson;
  if (!polling_url) throw new Error("no polling_url");

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500));
    const pollRes = await fetch(polling_url, { headers: { "x-key": apiKey, accept: "application/json" } });
    const j = await pollRes.json().catch(() => ({}));
    if (j.status === "Ready") {
      const dl = await fetch(j.result?.sample);
      const buf = Buffer.from(await dl.arrayBuffer());
      const out = path.join(OUT_DIR, `${photo.id}-${c.id}.jpg`);
      await fs.writeFile(out, buf);
      return { ok: true, cost, out };
    }
    if (["Error", "Failed", "Content Moderated"].includes(j.status)) {
      throw new Error(`status=${j.status}`);
    }
  }
  throw new Error("timeout");
}

async function main() {
  const apiKey = (await loadEnvKey("renisual_bfl_key")) ?? (await loadEnvKey("BFL_API_KEY"));
  if (!apiKey) { console.error("no key"); process.exit(1); }

  await fs.mkdir(OUT_DIR, { recursive: true });

  let totalCr = 0;
  for (const photo of PHOTOS) {
    const sourceBytes = await fs.readFile(`public/test-inputs/${photo.file}`);
    const meta = await sharp(sourceBytes).rotate().metadata();
    const dims = targetDims(meta.width, meta.height);
    const baseBytes = await sharp(sourceBytes).rotate().resize(dims.width, dims.height, { fit: "fill" }).toBuffer();
    const baseB64 = baseBytes.toString("base64");
    console.log(`\n=== ${photo.id} (${photo.file}) ${meta.width}x${meta.height} → ${dims.width}x${dims.height} ===`);

    for (const c of CASES) {
      const out = path.join(OUT_DIR, `${photo.id}-${c.id}.jpg`);
      try {
        const stat = await fs.stat(out);
        if (stat.isFile() && stat.size > 0) {
          console.log(`  [${c.id}] ⊘ skip cached`);
          continue;
        }
      } catch {}
      process.stdout.write(`  [${c.id} ${c.color.name} ${c.line}${c.structure ? "+struct" : ""}] `);
      try {
        const r = await renderCase(c, photo, baseB64, dims, apiKey);
        console.log(`✓ ${r.cost ?? "?"} cr`);
        totalCr += r.cost ?? 0;
      } catch (e) {
        console.log(`✗ ${e.message}`);
      }
    }
  }
  console.log(`\nTotal new: ${totalCr.toFixed(1)} cr (~$${(totalCr * 0.001).toFixed(4)})`);
}

main().catch((e) => { console.error(e); process.exit(1); });
