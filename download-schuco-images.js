import axios from "axios";
import fs from "fs";
import path from "path";
import * as cheerio from "cheerio";

const START_URL = "https://www.schueco.com/nl-nl/particulier/raamsystemen";
const BRAND_SLUG = "schuco";
const OUTPUT_ROOT = `./public/samples/kozijnen/${BRAND_SLUG}`;
const INDEX_FILE = `${OUTPUT_ROOT}/index.json`;
const HOST = new URL(START_URL).host;

fs.mkdirSync(OUTPUT_ROOT, { recursive: true });

const http = axios.create({
  timeout: 30000,
  headers: { "User-Agent": "Mozilla/5.0 Renisual Image Scraper" },
});

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function absUrl(url, base = START_URL) {
  if (!url) return null;
  if (url.startsWith("//")) return "https:" + url;
  if (url.startsWith("http")) return url;
  return new URL(url, base).href;
}

function cleanImageUrl(url) {
  return url ? url.split("?")[0] : null;
}

function imgFromSrcset(srcset) {
  if (!srcset) return null;
  const parts = srcset.split(",").map((x) => x.trim().split(" ")[0]).filter(Boolean);
  return parts[parts.length - 1] || null;
}

async function downloadImage(url, filepath) {
  if (!url) return false;
  fs.mkdirSync(path.dirname(filepath), { recursive: true });
  const response = await http.get(url, { responseType: "stream" });
  await new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(filepath);
    response.data.pipe(writer);
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
  return true;
}

function imageExt(url) {
  const ext = path.extname(cleanImageUrl(url)).toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp"].includes(ext) ? ext : ".jpg";
}

async function getHtml(url) {
  const { data } = await http.get(url);
  return cheerio.load(data);
}

async function getProductLinks() {
  const $ = await getHtml(START_URL);
  const links = new Set();
  $("a").each((_, el) => {
    const href = absUrl($(el).attr("href"));
    if (!href) return;
    const u = new URL(href);
    if (u.host !== HOST) return;
    if (/\/(raamsysteem|kozijn|venster|window|product|systeem|aws|ada)/i.test(u.pathname)) {
      links.add(href);
    }
  });
  return [...links];
}

function extractImages($) {
  const images = new Set();
  const selectors = ["main img", "article img", ".product img", ".gallery img", ".hero img"];
  for (const sel of selectors) {
    $(sel).each((_, el) => {
      const src =
        $(el).attr("data-large") ||
        imgFromSrcset($(el).attr("srcset")) ||
        $(el).attr("data-src") ||
        $(el).attr("src");
      const url = cleanImageUrl(absUrl(src));
      if (url && !/logo|icon|favicon|placeholder/i.test(url) && /\.(jpg|jpeg|png|webp)$/i.test(url)) {
        images.add(url);
      }
    });
  }
  return [...images];
}

async function scrapeProduct(productUrl) {
  const $ = await getHtml(productUrl);
  const name = $("h1").first().text().trim() || $("title").first().text().trim() || "unknown";
  const slug = slugify(name);
  const dir = path.join(OUTPUT_ROOT, slug);
  fs.mkdirSync(dir, { recursive: true });

  const imageUrls = extractImages($);
  const saved = [];
  for (let i = 0; i < imageUrls.length; i++) {
    const url = imageUrls[i];
    const ext = imageExt(url);
    const filename = i === 0 ? `main${ext}` : `variant-${String(i).padStart(2, "0")}${ext}`;
    const filepath = path.join(dir, filename);
    const localPath = `/samples/kozijnen/${BRAND_SLUG}/${slug}/${filename}`;
    try {
      console.log(`Downloading ${i + 1}/${imageUrls.length}: ${name}`);
      await downloadImage(url, filepath);
      saved.push({ type: i === 0 ? "main" : "variant", source: url, local: localPath });
    } catch (err) {
      console.log(`  failed: ${url}`);
    }
  }

  return {
    name,
    sku: slug,
    brand: BRAND_SLUG,
    slug,
    url: productUrl,
    folder: `/samples/kozijnen/${BRAND_SLUG}/${slug}`,
    images: saved,
  };
}

async function main() {
  console.log(`Reading: ${START_URL}`);
  const links = await getProductLinks();
  console.log(`Found ${links.length} candidate product pages`);

  const index = [];
  for (const url of links) {
    try {
      const product = await scrapeProduct(url);
      if (product.images.length > 0) index.push(product);
    } catch (err) {
      console.log(`Failed: ${url} (${err.message})`);
    }
  }

  fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2), "utf8");
  console.log(`Done. ${index.length} products with images written to ${INDEX_FILE}`);
}

main().catch((err) => {
  console.error("Scrape failed:", err.message);
  process.exit(1);
});
