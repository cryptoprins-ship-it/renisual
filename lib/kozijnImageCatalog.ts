export type KozijnBrand = "deceuninck" | "kommerling" | "schuco";

export type KozijnImageItem = {
  type: "main" | "variant";
  source: string;
  local: string;
};

export type KozijnImageProduct = {
  name: string;
  sku: string;
  brand: KozijnBrand;
  slug: string;
  url: string;
  folder: string;
  images: KozijnImageItem[];
};

const INDEX_PATHS: Record<KozijnBrand, string> = {
  deceuninck: "/samples/kozijnen/deceuninck/index.json",
  kommerling: "/samples/kozijnen/kommerling/index.json",
  schuco: "/samples/kozijnen/schuco/index.json",
};

function clean(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export async function loadKozijnIndex(brand: KozijnBrand): Promise<KozijnImageProduct[]> {
  try {
    const res = await fetch(INDEX_PATHS[brand]);
    if (!res.ok) return [];
    const data = (await res.json()) as KozijnImageProduct[];
    return data.map((item) => ({ ...item, brand }));
  } catch {
    return [];
  }
}

export async function loadAllKozijnIndex(): Promise<KozijnImageProduct[]> {
  const brands: KozijnBrand[] = ["deceuninck", "kommerling", "schuco"];
  const results = await Promise.all(brands.map((b) => loadKozijnIndex(b)));
  return results.flat();
}

export function findKozijnMainImage(
  index: KozijnImageProduct[],
  productId?: string,
  productName?: string
): string {
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
