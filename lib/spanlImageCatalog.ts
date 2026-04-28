import { useEffect, useState } from "react";

export type SpanlImageItem = {
  type: "main" | "variant";
  source: string;
  local: string;
};

export type SpanlImageProduct = {
  name: string;
  sku: string;
  category: string;
  group: string;
  slug: string;
  url: string;
  folder: string;
  images: SpanlImageItem[];
};

function clean(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export async function loadSpanlImageIndex(): Promise<SpanlImageProduct[]> {
  try {
    const res = await fetch("/samples/spanl/spanl-images-index.json");
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export function findSpanlMainImage(
  index: SpanlImageProduct[],
  productId?: string,
  productName?: string
) {
  const id = clean(productId ?? "");
  const name = clean(productName ?? "");

  if (!id && !name) return "";

  const match = index.find((item) => {
    const sku = clean(item.sku);
    const slug = clean(item.slug);
    const title = clean(item.name);

    return (
      (id && (sku.includes(id) || slug.includes(id) || title.includes(id))) ||
      (name && (title.includes(name) || name.includes(title)))
    );
  });

  return match?.images?.[0]?.local ?? "";
}

let cachedIndex: SpanlImageProduct[] | null = null;
let inflight: Promise<SpanlImageProduct[]> | null = null;

async function getIndex(): Promise<SpanlImageProduct[]> {
  if (cachedIndex) return cachedIndex;
  if (!inflight) {
    inflight = loadSpanlImageIndex().then((idx) => {
      cachedIndex = idx;
      inflight = null;
      return idx;
    });
  }
  return inflight;
}

export function useSpanlImage(productId?: string, productName?: string): string {
  const [src, setSrc] = useState("");
  useEffect(() => {
    if (!productId && !productName) {
      setSrc("");
      return;
    }
    let cancelled = false;
    getIndex().then((idx) => {
      if (!cancelled) setSrc(findSpanlMainImage(idx, productId, productName));
    });
    return () => {
      cancelled = true;
    };
  }, [productId, productName]);
  return src;
}