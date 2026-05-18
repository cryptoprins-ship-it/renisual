#!/usr/bin/env node
// Compress public/samples/**/*.{jpg,jpeg,png,webp} naar max 1MB elk.
// Strategie: probeer eerst alleen JPEG-quality drop (q=85 → 70 → 55).
// Als nog te groot, resize lange zijde stapsgewijs (2000 → 1600 → 1280 → 1024).
// In-place overschrijven. Bestanden ≤ 1MB blijven onaangeraakt.
//
// Run: node scripts/compress-samples.mjs

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const MAX_BYTES = 1024 * 1024; // 1 MB
const SAMPLES_DIR = path.join(process.cwd(), "public", "samples");
const QUALITY_STEPS = [85, 75, 65, 55];
const WIDTH_STEPS = [2400, 2000, 1600, 1280, 1024];

async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (/\.(jpe?g|png|webp)$/i.test(entry.name)) {
      yield full;
    }
  }
}

async function compressOne(file) {
  const orig = await fs.stat(file);
  if (orig.size <= MAX_BYTES) return { file, skipped: true, origSize: orig.size };

  const ext = path.extname(file).toLowerCase();
  const isPng = ext === ".png";
  const isWebp = ext === ".webp";

  // Lees naar buffer eerst — voorkomt file-lock op Windows zodra we
  // dezelfde file overschrijven.
  const inputBuf = await fs.readFile(file);

  // Probeer per (width, quality) combinatie. Eerst grootste width + hoogste
  // quality — als die past, accepteer; anders zak terug.
  for (const width of WIDTH_STEPS) {
    for (const q of QUALITY_STEPS) {
      let pipeline = sharp(inputBuf).rotate().resize({
        width,
        withoutEnlargement: true,
      });
      if (isPng) {
        // PNG → JPEG voor betere compressie (foto-content, geen alpha nodig).
        pipeline = pipeline.jpeg({ quality: q, mozjpeg: true });
      } else if (isWebp) {
        pipeline = pipeline.webp({ quality: q });
      } else {
        pipeline = pipeline.jpeg({ quality: q, mozjpeg: true });
      }
      const buf = await pipeline.toBuffer();
      if (buf.length <= MAX_BYTES) {
        // PNG → JPG: hernoem extensie ook
        const outFile = isPng ? file.replace(/\.png$/i, ".jpg") : file;
        await fs.writeFile(outFile, buf);
        if (outFile !== file) await fs.unlink(file);
        return {
          file: outFile,
          origFile: file,
          skipped: false,
          origSize: orig.size,
          newSize: buf.length,
          width,
          quality: q,
        };
      }
    }
  }
  // Onmogelijk om < 1MB te komen — schrijf de kleinste variant
  // (width=1024, q=55) en log waarschuwing.
  let pipeline = sharp(inputBuf).rotate().resize({
    width: 1024,
    withoutEnlargement: true,
  });
  pipeline = pipeline.jpeg({ quality: 55, mozjpeg: true });
  const buf = await pipeline.toBuffer();
  const outFile = isPng ? file.replace(/\.png$/i, ".jpg") : file;
  await fs.writeFile(outFile, buf);
  if (outFile !== file) await fs.unlink(file);
  return {
    file: outFile,
    origFile: file,
    skipped: false,
    origSize: orig.size,
    newSize: buf.length,
    width: 1024,
    quality: 55,
    overLimit: buf.length > MAX_BYTES,
  };
}

function fmtKb(n) {
  return `${(n / 1024).toFixed(0)}KB`;
}

async function main() {
  console.log(`Scanning ${SAMPLES_DIR}...`);
  const results = [];
  for await (const file of walk(SAMPLES_DIR)) {
    const res = await compressOne(file);
    results.push(res);
    if (!res.skipped) {
      const rel = path.relative(process.cwd(), res.file);
      const tag = res.overLimit ? " ⚠ STILL OVER" : "";
      console.log(
        `  ${fmtKb(res.origSize)} → ${fmtKb(res.newSize)} ` +
          `(w=${res.width} q=${res.quality}) ${rel}${tag}`,
      );
    }
  }
  const compressed = results.filter((r) => !r.skipped);
  const skipped = results.filter((r) => r.skipped);
  const overLimit = compressed.filter((r) => r.overLimit);
  const savedBytes = compressed.reduce(
    (sum, r) => sum + (r.origSize - r.newSize),
    0,
  );
  console.log(``);
  console.log(`Total: ${results.length} files`);
  console.log(`Skipped (already ≤1MB): ${skipped.length}`);
  console.log(`Compressed: ${compressed.length}`);
  console.log(`Saved: ${(savedBytes / 1024 / 1024).toFixed(2)} MB`);
  if (overLimit.length > 0) {
    console.log(`⚠ ${overLimit.length} files still over 1MB after max compression`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
