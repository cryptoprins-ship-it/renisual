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

const PHOTO = "public/test-inputs/IMG_20260422_095323.jpg";
const OUT_DIR = "public/test-outputs/iterate";
const ENV_PATH = ".env.local";

// Test matrix: 5 products covering Flat/Groove × dark/mid/light + Structure.
const CASES = [
  { id: "PB7038A",   line: "flat",   color: { name: "matt grey",         ral: "7038", hex: "#B5B8B1" }, structure: false },
  { id: "PB9005A",   line: "flat",   color: { name: "diepzwart",         ral: "9005", hex: "#0A0A0A" }, structure: false },
  { id: "SG7038A",   line: "groove", color: { name: "matt grey",         ral: "7038", hex: "#B5B8B1" }, structure: false },
  // RAL 9003 = signal white. Use cool pure-white hex (#F4F4F4) — the
  // warm RAL 9010 cream value (#F1ECE0) was rendering beige.
  { id: "SG9003A",   line: "groove", color: { name: "pure cool white",   ral: "9003", hex: "#F4F4F4" }, structure: false },
  { id: "YMSG7038A", line: "groove", color: { name: "matt grey",         ral: "7038", hex: "#B5B8B1" }, structure: true  },
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

// === EXPERIMENTAL PROMPT — iterate this ===
function buildPrompt(c) {
  const targetHex = c.color.hex;
  const renderHex = darkenHex(targetHex, 0.15);
  const ralLine = `RAL ${c.color.ral}`;
  const colorLine = renderHex !== targetHex
    ? `${c.color.name} ${ralLine} (target ${targetHex}, render at ${renderHex} to compensate model lightening bias)`
    : `${c.color.name} ${ralLine} (hex ${targetHex})`;

  const isGroove = c.line === "groove";
  const surface = isGroove
    ? `painted metal cladding with crisp vertical grooves cut into the surface every ~13cm. The grooves are 5mm shadow lines pressed into a flat painted metal sheet.`
    : `painted metal cladding — smooth flat painted metal sheet with very faint hairline seams every 37cm (same-color hairlines, never contrasting).`;

  const structureLine = c.structure
    ? `\n\nThe metal surface has a fine linen-weave embossing pattern — soft fabric-like texture pressed into the painted metal. NOT wood, NOT wood grain, NOT planks. Color stays the matt RAL above.`
    : "";

  // Per-color anti-bias notes — append a tiny clarifier when the
  // requested color is in a known klein-9b drift zone.
  const isWhite = ["9003", "9010"].includes(c.color.ral);
  const isBlack = c.color.ral === "9005";
  const colorWarn = isWhite
    ? "  IMPORTANT: render as PURE COOL WHITE. NOT cream, NOT beige, NOT off-white, NOT yellow-tinted, NOT warm-tinted."
    : isBlack
    ? "  IMPORTANT: render as TRUE COOL BLACK. NOT brown, NOT dark brown, NOT warm-tinted."
    : "";

  return `REPLACE the wall cladding on this houseboat facade. The new cladding is PAINTED METAL — explicitly NOT wood, NOT wood plank, NOT siding, NOT cream-colored.

WALL COLOR: ${colorLine}.${colorWarn}
The walls MUST end up this exact color. Do NOT render walls as wood, do NOT render as cream/beige, do NOT keep them white if the requested color is grey or black.

WALL MATERIAL: ${surface}${structureLine}

REMOVE from source: existing wooden plank siding, wood grain, peeling paint. Source is wood, target is painted metal.

KEEP ORIGINAL (do not change):
- Windows, glazing, window frames (kozijnen)
- Doors and door frames
- Roof, gutters, chimneys
- Sky, water, vegetation, neighbors, fences, foreground objects

Match input image framing exactly.`;
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

async function renderCase(c, baseB64, dims, apiKey) {
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
      const out = path.join(OUT_DIR, `${c.id}.jpg`);
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

  const sourceBytes = await fs.readFile(PHOTO);
  const meta = await sharp(sourceBytes).rotate().metadata();
  const dims = targetDims(meta.width, meta.height);
  const baseBytes = await sharp(sourceBytes).rotate().resize(dims.width, dims.height, { fit: "fill" }).toBuffer();
  const baseB64 = baseBytes.toString("base64");

  console.log(`Source ${meta.width}x${meta.height} → ${dims.width}x${dims.height}`);
  console.log(`Cases:  ${CASES.map((c) => c.id).join(", ")}\n`);

  let totalCr = 0;
  for (const c of CASES) {
    process.stdout.write(`[${c.id} ${c.color.name} ${c.line}${c.structure ? "+struct" : ""}] `);
    try {
      const r = await renderCase(c, baseB64, dims, apiKey);
      console.log(`✓ ${r.cost ?? "?"} cr → ${r.out}`);
      totalCr += r.cost ?? 0;
    } catch (e) {
      console.log(`✗ ${e.message}`);
    }
  }
  console.log(`\nTotal: ${totalCr.toFixed(1)} cr (~$${(totalCr * 0.001).toFixed(4)})`);
}

main().catch((e) => { console.error(e); process.exit(1); });
