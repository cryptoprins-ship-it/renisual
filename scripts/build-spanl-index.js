import fs from "fs";
import path from "path";

const ROOT = "./public/samples/spanl";
const INDEX_FILE = path.join(ROOT, "spanl-images-index.json");

if (!fs.existsSync(ROOT)) {
  console.error(`Directory not found: ${ROOT}`);
  process.exit(1);
}

const groups = fs
  .readdirSync(ROOT, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

const index = [];

for (const group of groups) {
  const groupDir = path.join(ROOT, group);
  const productSlugs = fs
    .readdirSync(groupDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const slug of productSlugs) {
    const productDir = path.join(groupDir, slug);
    const files = fs
      .readdirSync(productDir)
      .filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f))
      .sort();

    if (files.length === 0) continue;

    const mainIndex = files.findIndex((f) => /^main\./i.test(f));
    const orderedFiles = mainIndex >= 0 ? [files[mainIndex], ...files.filter((_, i) => i !== mainIndex)] : files;

    const images = orderedFiles.map((file, i) => ({
      type: i === 0 ? "main" : "variant",
      source: "",
      local: `/samples/spanl/${group}/${slug}/${file}`,
    }));

    index.push({
      name: slug.replace(/-/g, " "),
      sku: slug,
      category: group,
      group,
      slug,
      url: "",
      folder: `/samples/spanl/${group}/${slug}`,
      images,
    });
  }
}

fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2), "utf8");
console.log(`Wrote ${index.length} products to ${INDEX_FILE}`);
