/**
 * Top up the Spanl image index with products that the original scraper missed
 * because Spanl publishes each panel-series under /product-category/ rather
 * than /product/. The original scraper only walked /product/ links.
 *
 * Run:  node scripts/spanl-fill-missing.mjs
 */

import axios from "axios";
import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";

const INDEX_FILE = "./public/samples/spanl/spanl-images-index.json";
const OUTPUT_ROOT = "./public/samples/spanl/panels";

// SKU + canonical URL on spanl.nl. Source: WebFetch of /winkel/ on this run.
const MISSING = [
  { sku: "CZS70-01A", url: "https://spanl.nl/product-category/spanish-tile-czs70-01a/" },
  { sku: "CZS70-02A", url: "https://spanl.nl/product-category/spanish-tile-czs70-02a/" },
  { sku: "PB9003A",   url: "https://spanl.nl/product-category/pb9003a/" },
  { sku: "PBW32-06",  url: "https://spanl.nl/product-category/natural-wood/" },
  { sku: "SG7021A",   url: "https://spanl.nl/product-category/sg-dark-grey-7021a-serie/" },
  { sku: "SG9003A",   url: "https://spanl.nl/product-category/sg-white-9010a-serie/" },
  { sku: "SG9005A",   url: "https://spanl.nl/product-category/sg-black-9005a-serie/" },
  { sku: "TS70-02A",  url: "https://spanl.nl/product-category/ts70-02a-serie/" },
  { sku: "TS7021A",   url: "https://spanl.nl/product-category/ts7021a/" },
  { sku: "TS9003P",   url: "https://spanl.nl/product-category/ts-9010p-serie/" },
  { sku: "YMPB9003A", url: "https://spanl.nl/product-category/ympb-9010a-white-serie/" },
  { sku: "YMPB9005A", url: "https://spanl.nl/product-category/ympb-9005a-black-serie/" },
  { sku: "YMSG7021A", url: "https://spanl.nl/product-category/ymsg-7021a-serie/" },
  { sku: "YMSG7038A", url: "https://spanl.nl/product-category/ymsg7038a-serie/" },
  { sku: "YMSG9003A", url: "https://spanl.nl/product-category/ymsg-9010a-serie/" },
  { sku: "YMSG9005A", url: "https://spanl.nl/product-category/ymsg9005a/" },
  { sku: "YPMB7038A", url: "https://spanl.nl/product-category/ypmb7038a-serie/" },
];

// SKUs whose existing "RAL 9010 look" folders are mis-labelled and will be
// superseded by the freshly-downloaded entries above. Drop them so the index
// stays clean and the matcher doesn't have ambiguous candidates.
const ORPHAN_SKUS_TO_DROP = ["sg9010a", "ts9010p-1"];

const http = axios.create({
  timeout: 30000,
  headers: { "User-Agent": "Mozilla/5.0 Renisual Image Scraper" },
});

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function absUrl(url, base) {
  if (!url) return null;
  if (url.startsWith("//")) return "https:" + url;
  if (url.startsWith("http")) return url;
  return new URL(url, base).href;
}

function cleanImageUrl(url) {
  if (!url) return null;
  return url.split("?")[0];
}

function getImageFromSrcset(srcset) {
  if (!srcset) return null;
  const parts = srcset
    .split(",")
    .map((x) => x.trim().split(" ")[0])
    .filter(Boolean);
  return parts[parts.length - 1] || null;
}

// WordPress image filenames look like `something-300x300.jpg` for resized
// variants and `something.jpg` for the original. Strip the dimension suffix
// to get the original (best effort — falls back to the variant on failure).
function toFullSize(url) {
  return url.replace(/-(\d{2,4})x(\d{2,4})(\.[a-z]+)$/i, "$3");
}

function pickFirstUploadImage($, base) {
  const candidates = new Set();
  const selectors = [
    ".woocommerce-product-gallery__image img",
    "img.wp-post-image",
    ".product img",
    ".attachment-woocommerce_thumbnail",
    "li.product img",
    "img",
  ];
  for (const sel of selectors) {
    $(sel).each((_, el) => {
      const raw =
        $(el).attr("data-large_image") ||
        getImageFromSrcset($(el).attr("srcset")) ||
        $(el).attr("data-src") ||
        $(el).attr("src");
      const url = cleanImageUrl(absUrl(raw, base));
      if (
        url &&
        url.includes("/wp-content/uploads/") &&
        !url.includes("logo") &&
        !url.includes("placeholder")
      ) {
        candidates.add(url);
      }
    });
    if (candidates.size > 0) break;
  }
  return [...candidates][0] || null;
}

async function downloadImage(url, filepath) {
  fs.mkdirSync(path.dirname(filepath), { recursive: true });
  const response = await http.get(url, { responseType: "stream" });
  await new Promise((resolve, reject) => {
    const w = fs.createWriteStream(filepath);
    response.data.pipe(w);
    w.on("finish", resolve);
    w.on("error", reject);
  });
}

async function processOne(item) {
  const slug = slugify(item.sku);
  const variant = await http
    .get(item.url)
    .then((r) => cheerio.load(r.data))
    .then(($) => pickFirstUploadImage($, item.url));

  if (!variant) {
    console.log(`  ⚠ ${item.sku}: no image found on ${item.url}`);
    return null;
  }

  const fullSize = toFullSize(variant);
  const ext = path.extname(fullSize).toLowerCase() || ".jpg";
  const filename = `main${ext}`;
  const filepath = path.join(OUTPUT_ROOT, slug, filename);
  const localPath = `/samples/spanl/panels/${slug}/${filename}`;

  // Try the dimension-stripped URL first; if it 404s, fall back to the variant.
  let downloaded = false;
  try {
    await downloadImage(fullSize, filepath);
    downloaded = true;
  } catch {
    try {
      await downloadImage(variant, filepath);
      downloaded = true;
    } catch (err) {
      console.log(`  ✗ ${item.sku}: download failed (${err.message})`);
    }
  }
  if (!downloaded) return null;

  console.log(`  ✓ ${item.sku} → ${localPath}`);
  return {
    name: item.sku,
    sku: item.sku.toLowerCase(),
    category: "panels",
    group: "panels",
    slug,
    url: item.url,
    folder: `/samples/spanl/panels/${slug}`,
    images: [{ type: "main", source: fullSize, local: localPath }],
  };
}

async function main() {
  const raw = fs.readFileSync(INDEX_FILE, "utf8");
  /** @type {Array<{sku:string}>} */
  const index = JSON.parse(raw);

  // Drop the mis-labelled "9010" folders that will be replaced.
  const before = index.length;
  for (const orphan of ORPHAN_SKUS_TO_DROP) {
    const i = index.findIndex((e) => e.sku === orphan);
    if (i !== -1) index.splice(i, 1);
  }
  if (index.length !== before) {
    console.log(`Dropped ${before - index.length} orphan entr(y/ies)`);
  }

  let added = 0;
  for (const item of MISSING) {
    // Skip if (re-running) the SKU already lives in the index.
    if (index.some((e) => (e.sku || "").toLowerCase() === item.sku.toLowerCase())) {
      console.log(`  · ${item.sku}: already indexed, skipping`);
      continue;
    }
    const entry = await processOne(item);
    if (entry) {
      index.push(entry);
      added++;
    }
  }

  fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2), "utf8");
  console.log(`\nDone. Added ${added}/${MISSING.length}. Index now has ${index.length} entries.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
