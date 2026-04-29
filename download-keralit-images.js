import axios from "axios";
import fs from "fs";
import path from "path";
import * as cheerio from "cheerio";

const START_URL = "https://www.keralit.nl/producten/";
const OUTPUT_ROOT = "./public/samples/keralit";
const INDEX_FILE = "./public/samples/keralit/keralit-images-index.json";
const HOST = new URL(START_URL).host;

fs.mkdirSync(OUTPUT_ROOT, { recursive: true });

const http = axios.create({
  timeout: 30000,
  headers: {
    "User-Agent": "Mozilla/5.0 Renisual Image Scraper",
  },
});

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ß/g, "ss")
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
  if ([".jpg", ".jpeg", ".png", ".webp"].includes(ext)) return ext;
  return ".jpg";
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
    if (
      /\/(product|gevelpaneel|rabatdeel|paneel|kleur|product-categorie|productcategorie|productrange)/i.test(
        u.pathname
      )
    ) {
      links.add(href);
    }
  });

  return [...links];
}

async function expandPaginatedLinks(links) {
  const expanded = new Set(links);
  for (const link of links) {
    try {
      const $ = await getHtml(link);
      $("a").each((_, el) => {
        const href = absUrl($(el).attr("href"), link);
        if (!href) return;
        const u = new URL(href);
        if (u.host !== HOST) return;
        if (/\/(product|gevelpaneel|rabatdeel|paneel)/i.test(u.pathname) && !u.pathname.endsWith("/producten/")) {
          expanded.add(href);
        }
      });
    } catch {
      // ignore failed sub-page fetches
    }
  }
  return [...expanded];
}

function extractProductImages($) {
  const images = new Set();

  const selectors = [
    "img.wp-post-image",
    ".product-gallery img",
    ".woocommerce-product-gallery__image img",
    ".product img",
    "main img",
    "article img",
  ];

  for (const selector of selectors) {
    $(selector).each((_, el) => {
      const src =
        $(el).attr("data-large_image") ||
        getImageFromSrcset($(el).attr("srcset")) ||
        $(el).attr("data-src") ||
        $(el).attr("src");

      const url = cleanImageUrl(absUrl(src));

      if (
        url &&
        url.includes("/wp-content/uploads/") &&
        !/logo|placeholder|icon|favicon/i.test(url)
      ) {
        images.add(url);
      }
    });
  }

  $("a").each((_, el) => {
    const href = cleanImageUrl(absUrl($(el).attr("href")));
    if (
      href &&
      href.includes("/wp-content/uploads/") &&
      /\.(jpg|jpeg|png|webp)$/i.test(href)
    ) {
      images.add(href);
    }
  });

  return [...images];
}

async function scrapeProduct(productUrl) {
  const $ = await getHtml(productUrl);

  const name =
    $("h1").first().text().trim() ||
    $("title").first().text().trim() ||
    "unknown-product";

  const sku = slugify(name);
  const productSlug = slugify(name);
  const dir = path.join(OUTPUT_ROOT, "panels", productSlug);

  fs.mkdirSync(dir, { recursive: true });

  const imageUrls = extractProductImages($);
  const savedImages = [];

  for (let i = 0; i < imageUrls.length; i++) {
    const url = imageUrls[i];
    const ext = imageExt(url);
    const filename = i === 0 ? `main${ext}` : `variant-${String(i).padStart(2, "0")}${ext}`;
    const filepath = path.join(dir, filename);
    const localPath = `/samples/keralit/panels/${productSlug}/${filename}`;

    try {
      console.log(`Downloading ${i + 1}/${imageUrls.length}: ${name}`);
      await downloadImage(url, filepath);
      savedImages.push({
        type: i === 0 ? "main" : "variant",
        source: url,
        local: localPath,
      });
    } catch (err) {
      console.log(`Failed image: ${url}`);
    }
  }

  return {
    name,
    sku,
    category: "panels",
    group: "panels",
    slug: productSlug,
    url: productUrl,
    folder: `/samples/keralit/panels/${productSlug}`,
    images: savedImages,
  };
}

async function main() {
  console.log(`Reading start URL: ${START_URL}`);
  const initial = await getProductLinks();
  console.log(`Initial links: ${initial.length}`);

  const allLinks = await expandPaginatedLinks(initial);
  console.log(`After expansion: ${allLinks.length}`);

  const productLinks = allLinks.filter((u) => /\/(product|gevelpaneel|rabatdeel|paneel)\//i.test(u));
  console.log(`Filtered to product pages: ${productLinks.length}`);

  if (productLinks.length === 0) {
    console.log(
      "No product pages detected. Edit START_URL and the regex in getProductLinks/expandPaginatedLinks to match keralit.nl's actual structure."
    );
  }

  const index = [];
  for (const productUrl of productLinks) {
    try {
      const product = await scrapeProduct(productUrl);
      if (product.images.length > 0) index.push(product);
    } catch (err) {
      console.log(`Failed product: ${productUrl} (${err.message})`);
    }
  }

  fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2), "utf8");
  console.log(`Done. Index written to ${INDEX_FILE} with ${index.length} products.`);
}

main().catch((err) => {
  console.error("Scrape failed:", err.message);
  process.exit(1);
});
