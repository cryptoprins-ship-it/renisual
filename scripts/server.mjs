// SAM-based wall segmentation service for renisual hybrid render pipeline.
// POST /segment { sourceB64, renderB64, targetHex? }
// auth: x-api-token header

import express from "express";
import { SamModel, AutoProcessor, RawImage } from "@huggingface/transformers";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Inline .env loader — pm2 doesn't auto-load .env files
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  for (const raw of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(raw);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
    }
  }
}

const PORT = parseInt(process.env.PORT || "3001", 10);
const API_TOKEN = process.env.API_TOKEN;
if (!API_TOKEN) {
  console.error("API_TOKEN not set");
  process.exit(1);
}

console.log("loading SAM model…");
const samModel = await SamModel.from_pretrained("Xenova/slimsam-77-uniform");
const samProcessor = await AutoProcessor.from_pretrained("Xenova/slimsam-77-uniform");
console.log("SAM ready");

const app = express();
app.use(express.json({ limit: "30mb" }));

app.get("/health", (_req, res) => res.json({ ok: true, model: "slimsam-77-uniform" }));

app.post("/segment", async (req, res) => {
  if (req.headers["x-api-token"] !== API_TOKEN) {
    return res.status(401).json({ error: "unauthorized" });
  }
  const { renderB64, targetHex } = req.body || {};
  if (!renderB64) return res.status(400).json({ error: "missing renderB64" });

  const t0 = Date.now();
  try {
    const renderBytes = Buffer.from(renderB64, "base64");

    // 1. find wall centroid via color similarity to target hex
    const { data: rgb, info } = await sharp(renderBytes)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const W = info.width;
    const H = info.height;

    const hex = (targetHex || "#B5B8B1").replace(/^#/, "");
    const ref = parseInt(hex, 16);
    const refR = (ref >> 16) & 0xff;
    const refG = (ref >> 8) & 0xff;
    const refB = ref & 0xff;

    let sumX = 0, sumY = 0, count = 0;
    const threshold = 55;
    for (let y = 0; y < H; y++) {
      const yOff = y * W * 3;
      for (let x = 0; x < W; x++) {
        const i = yOff + x * 3;
        const dr = rgb[i] - refR;
        const dg = rgb[i + 1] - refG;
        const db = rgb[i + 2] - refB;
        if (dr * dr + dg * dg + db * db < threshold * threshold) {
          sumX += x;
          sumY += y;
          count++;
        }
      }
    }

    let cx, cy;
    if (count > 200) {
      cx = Math.round(sumX / count);
      cy = Math.round(sumY / count);
    } else {
      cx = Math.floor(W / 2);
      cy = Math.floor(H * 0.55);
    }

    // 2. run SAM with that centroid
    const image = await RawImage.fromBlob(new Blob([renderBytes]));
    const inputs = await samProcessor(image, {
      input_points: [[[[cx, cy]]]],
      input_labels: [[[1]]],
    });
    const outputs = await samModel({ ...inputs });
    const masks = await samProcessor.post_process_masks(
      outputs.pred_masks,
      inputs.original_sizes,
      inputs.reshaped_input_sizes,
    );
    const mask = masks[0][0];
    const scores = Array.from(outputs.iou_scores.data);
    const bestIdx = scores.indexOf(Math.max(...scores));
    const bestScore = scores[bestIdx];

    const [, mh, mw] = mask.dims;
    const planeSize = mh * mw;
    const planeStart = bestIdx * planeSize;
    const buf = Buffer.alloc(planeSize);
    for (let i = 0; i < planeSize; i++) {
      buf[i] = mask.data[planeStart + i] ? 255 : 0;
    }
    const maskPng = await sharp(buf, { raw: { width: mw, height: mh, channels: 1 } })
      .png()
      .toBuffer();

    const ms = Date.now() - t0;
    console.log(`segmented ${mw}x${mh} centroid=(${cx},${cy}) matches=${count} score=${bestScore.toFixed(3)} in ${ms}ms`);

    res.json({
      maskB64: maskPng.toString("base64"),
      width: mw,
      height: mh,
      method: `sam-slimsam-77 score=${bestScore.toFixed(3)}`,
    });
  } catch (err) {
    console.error("segment error:", err);
    res.status(500).json({ error: String(err?.message || err) });
  }
});

app.listen(PORT, () => console.log(`segmentation listening on :${PORT}`));
