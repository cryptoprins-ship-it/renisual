/**
 * Download sample facade photos from Unsplash, resize to 1200px wide,
 * write to public/samples/<category>/, and update each category's index.json.
 *
 * Run:  node scripts/download-samples.mjs
 *
 * Note: Unsplash photo IDs occasionally change. After a successful run, eyeball
 * the saved files in public/samples/houses/ and public/samples/woonboten/ to
 * confirm the subjects are correct (a Dutch house, an actual houseboat, etc.).
 */

import axios from "axios";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const SAMPLES = {
  // disk folder uses the existing "houses" name; the UI label is translated
  // via i18n (key "woningen") on the /render page.
  houses: [
    { id: "1568605114967-8130f3a36994", file: "woning-1.jpg", label: "Modern huis" },
    { id: "1570129477492-45c003edd2be", file: "woning-2.jpg", label: "Vrijstaande woning" },
    { id: "1564013799919-ab600027ffc6", file: "woning-3.jpg", label: "Klassieke woning" },
    { id: "1605276374104-dee2a0ed3cd6", file: "woning-4.jpg", label: "Rijtjeshuis" },
  ],
  woonboten: [
    { id: "1512453979798-5ea266f8880c", file: "woonboot-1.jpg", label: "Woonboot" },
    { id: "1502082553048-f009c37129b9", file: "woonboot-2.jpg", label: "Amsterdamse woonboot" },
    { id: "1534430480872-3498386e7856", file: "woonboot-3.jpg", label: "Klassieke woonboot" },
    { id: "1559554498-fdcd6c64a06b",   file: "woonboot-4.jpg", label: "Houseboat" },
  ],
};

async function downloadOne(category, item) {
  const url = `https://images.unsplash.com/photo-${item.id}?w=1600&fit=max&fm=jpg&q=85`;
  const dir = path.join("public", "samples", category);
  await fs.mkdir(dir, { recursive: true });
  const out = path.join(dir, item.file);

  process.stdout.write(`  ${category}/${item.file} ... `);
  let res;
  try {
    res = await axios.get(url, {
      responseType: "arraybuffer",
      validateStatus: () => true,
      maxRedirects: 5,
      timeout: 30_000,
    });
  } catch (e) {
    console.log(`✗ network error: ${e.message}`);
    return null;
  }
  if (res.status !== 200) {
    console.log(`✗ HTTP ${res.status}`);
    return null;
  }
  const ct = res.headers["content-type"] ?? "";
  if (!ct.startsWith("image/")) {
    console.log(`✗ not an image (content-type: ${ct})`);
    return null;
  }
  const data = Buffer.from(res.data);
  if (data.length < 5_000) {
    console.log(`✗ suspiciously small (${data.length} bytes)`);
    return null;
  }
  try {
    await sharp(data)
      .resize(1200, null, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85, mozjpeg: true })
      .toFile(out);
  } catch (e) {
    console.log(`✗ sharp failed: ${e.message}`);
    return null;
  }
  const stat = await fs.stat(out);
  console.log(`✓ ${(stat.size / 1024).toFixed(0)}KB`);
  return { file: item.file, label: item.label };
}

async function main() {
  for (const [category, items] of Object.entries(SAMPLES)) {
    console.log(`\n${category}:`);
    const successes = [];
    for (const item of items) {
      const entry = await downloadOne(category, item);
      if (entry) successes.push(entry);
    }
    const indexPath = path.join("public", "samples", category, "index.json");
    await fs.writeFile(indexPath, JSON.stringify(successes, null, 2) + "\n");
    console.log(`  → wrote ${indexPath} (${successes.length} entries)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
