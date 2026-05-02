// Generate PWA icons from public/icons/icon.svg.
//
// Outputs:
//   public/icons/icon-192.png            (full-bleed)
//   public/icons/icon-512.png            (full-bleed)
//   public/icons/icon-192-maskable.png   (10% padding, #0a0a0a background)
//   public/icons/icon-512-maskable.png   (10% padding, #0a0a0a background)

import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\//, ""), "..");
const SRC = path.join(ROOT, "public", "icons", "icon.svg");
const OUT_DIR = path.join(ROOT, "public", "icons");

const MASKABLE_BG = { r: 10, g: 10, b: 10, alpha: 1 }; // #0a0a0a

async function fullBleed(size) {
  const out = path.join(OUT_DIR, `icon-${size}.png`);
  await sharp(await fs.readFile(SRC), { density: 384 })
    .resize(size, size)
    .png()
    .toFile(out);
  console.log(`wrote ${out}`);
}

async function maskable(size) {
  const inner = Math.round(size * 0.8);
  const out = path.join(OUT_DIR, `icon-${size}-maskable.png`);
  const innerBuf = await sharp(await fs.readFile(SRC), { density: 384 })
    .resize(inner, inner)
    .png()
    .toBuffer();
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: MASKABLE_BG,
    },
  })
    .composite([{ input: innerBuf, gravity: "center" }])
    .png()
    .toFile(out);
  console.log(`wrote ${out}`);
}

await fs.mkdir(OUT_DIR, { recursive: true });
await Promise.all([fullBleed(192), fullBleed(512), maskable(192), maskable(512)]);
console.log("PWA icons regenerated.");
