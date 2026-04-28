import axios from "axios";
import fs from "fs";
import path from "path";
import * as cheerio from "cheerio";

const START_URL = "https://spanl.nl/winkel/";
const OUTPUT_ROOT = "./public/samples/spanl";
const INDEX_FILE = "./public/samples/spanl/spanl-images-index.json";

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
    .replace(/[\u0300-\u036f]/g, "")
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

async function getCategoryLinks() {
  const $ = await getHtml(START_URL);
  const links = new Set();

  $("a").each((_, el) => {
    const href = absUrl($(el).attr("href"));
    if (!href) return;

    if (href.includes("/product-category/")) {
      links.add(href);
    }
  });

  return [...links];
}

async function getProductLinksFromCategory(categoryUrl) {
  const links = new Set();
  let pageUrl = categoryUrl;

  while (pageUrl) {
    const $ = await getHtml(pageUrl);

    $("a.woocommerce-LoopProduct-link, li.product a").each((_, el) => {
      const href = absUrl($(el).attr("href"), pageUrl);
      if (href && href.includes("/product/")) {
        links.add(href);
      }
    });

    const next =
      absUrl($("a.next.page-numbers").attr("href"), pageUrl) ||
      absUrl($(".woocommerce-pagination a.next").attr("href"), pageUrl);

    pageUrl = next && next !== pageUrl ? next : null;
  }

  return [...links];
}

function extractProductImages($) {
  const images = new Set();

  const selectors = [
    ".woocommerce-product-gallery__image img",
    "img.wp-post-image",
    ".product img",
    "img",
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
        !url.includes("logo") &&
        !url.includes("placeholder")
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

function detectGroup(name, category) {
  const text = `${name} ${category}`.toLowerCase();

  if (text.includes("accessoire") || text.includes("profiel") || text.includes("corner") || text.includes("hoek")) {
    return "accessories";
  }

  if (text.includes("schutting")) {
    return "fences";
  }

  return "panels";
}

async function scrapeProduct(productUrl) {
  const $ = await getHtml(productUrl);

  const name =
    $("h1.product_title").first().text().trim() ||
    $("h1").first().text().trim() ||
    "unknown-product";

  const category =
    $(".posted_in a").first().text().trim() ||
    $(".product_meta a").first().text().trim() ||
    "uncategorized";

  const sku =
    $(".sku").first().text().trim() ||
    slugify(name);

  const group = detectGroup(name, category);
  const productSlug = slugify(sku || name);
  const dir = path.join(OUTPUT_ROOT, group, productSlug);

  fs.mkdirSync(dir, { recursive: true });

  const imageUrls = extractProductImages($);

  const savedImages = [];

  for (let i = 0; i < imageUrls.length; i++) {
    const url = imageUrls[i];
    const ext = imageExt(url);

    const filename = i === 0 ? `main${ext}` : `variant-${String(i).padStart(2, "0")}${ext}`;
    const filepath = path.join(dir, filename);
    const localPath = `/samples/spanl/${group}/${productSlug}/${filename}`;

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
    category,
    group,
    slug: productSlug,
    url: productUrl,
    folder: `/samples/spanl/${group}/${productSlug}`,
    images: savedImages,
  };
}

async function main() {
  const index = [];

  console.log("Reading categories...");
  const categoryLinks = await getCategoryLinks();

  console.log(`Found categories: ${categoryLinks.length}`);

  const allProductLinks = new Set();

  for (const categoryUrl of categoryLinks) {
    console.log(`Reading category: ${categoryUrl}`);
    const productLinks = await getProductLinksFromCategory(categoryUrl);

    for (const link of productLinks) {
      allProductLinks.add(link);
    }
  }

  console.log(`Found products: ${allProductLinks.size}`);

  for (const productUrl of allProductLinks) {
    try {
      const product = await scrapeProduct(productUrl);
      index.push(product);
    } catch (err) {
      console.log(`Failed product: ${productUrl}`);
    }
  }

  fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2), "utf8");

  console.log("✅ Klaar");
  console.log(`Index: ${INDEX_FILE}`);
}

main();