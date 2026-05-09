export type KeralitFinish = "classic-houtnerf" | "pure-mat" | "modern-eiken";

export const KERALIT_FINISH_LABEL_NL: Record<KeralitFinish, string> = {
  "classic-houtnerf": "Classic met houtnerf",
  "pure-mat": "Pure mat effen",
  "modern-eiken": "Modern eiken met houtstructuur",
};

export const KERALIT_FINISH_LABEL_EN: Record<KeralitFinish, string> = {
  "classic-houtnerf": "Classic with wood-grain texture",
  "pure-mat": "Pure matt smooth solid",
  "modern-eiken": "Modern oak with wood structure",
};

export type KeralitColor = {
  number: number;
  name: string;
  sku: string;
  finish: KeralitFinish;
  thumbnailUrl: string;
  // When the Keralit colour ships with a known RAL match (per Keralit's
  // own product table), this is set so the render pipeline can route
  // the colour through the proven Spanl RAL prompt instead of the
  // swatch-only keralit_wood prompt. klein-9b respects RAL hex tokens
  // far more reliably than swatch-derived hexes.
  ralCode?: string;
};

const CDN = "https://d7rh5s3nxmpy4.cloudfront.net/CMP2458";

// Catalog scoped to colours with a known RAL match (per Keralit's own
// product table). RAL-bearing colours route through Spanl's proven
// mono_flat pipeline where klein-9b respects the hex token reliably.
// Wood-look variants (Donker eiken, Mahonie, Vergrijsd, etc.), all 6
// Pure mat effen, and all 5 Modern eiken were removed 2026-05-09 because
// they have no RAL match — the swatch-only render pipeline produced
// unreliable colour. Re-add them here once a reliable rendering path
// for non-RAL Keralit colours exists (likely: pre-rendered solid-hex
// reference image instead of wood-grain swatch).
export const KERALIT_COLORS: KeralitColor[] = [
  { number: 294, name: "Zwartgrijs", sku: "BI9053", finish: "classic-houtnerf", thumbnailUrl: `${CDN}/FVKQ123BI9053_294_Zwartgrijs_Classic_met_houtnerf_THM.jpg`, ralCode: "7021" },
  { number: 295, name: "Basaltgrijs", sku: "BI9018", finish: "classic-houtnerf", thumbnailUrl: `${CDN}/FVKQ124BI9018_295_Basaltgrijs_Classic_met_houtnerf_THM.jpg`, ralCode: "7012" },
  { number: 310, name: "Grijs", sku: "BI9030", finish: "classic-houtnerf", thumbnailUrl: `${CDN}/FVKQ126BI9030_310_Grijs_Classic_met_houtnerf_THM.jpg`, ralCode: "7001" },
  { number: 311, name: "Kwartsgrijs", sku: "BI9031", finish: "classic-houtnerf", thumbnailUrl: `${CDN}/FVKQ127BI9031_311_Kwartsgrijs_Classic_met_houtnerf_THM.jpg`, ralCode: "7039" },
  { number: 312, name: "Mosgroen", sku: "BI9036", finish: "classic-houtnerf", thumbnailUrl: `${CDN}/FVKQ128BI9036_312_Mosgroen_Classic_met_houtnerf_THM.jpg`, ralCode: "6005" },
  { number: 313, name: "Licht", sku: "BI9032", finish: "classic-houtnerf", thumbnailUrl: `${CDN}/FVKQ129BI9032_313_Licht_Classic_met_houtnerf_THM.jpg`, ralCode: "1015" },
  { number: 314, name: "Zwart", sku: "BI9052", finish: "classic-houtnerf", thumbnailUrl: `${CDN}/FVKQ130BI9052_314_Zwart_Classic_met_houtnerf_THM.jpg`, ralCode: "9005" },
  { number: 315, name: "Antraciet", sku: "BI9017", finish: "classic-houtnerf", thumbnailUrl: `${CDN}/FVKQ131BI9017_315_Antraciet_Classic_met_houtnerf_THM.jpg`, ralCode: "7016" },
  { number: 320, name: "Steenrood", sku: "BI9044", finish: "classic-houtnerf", thumbnailUrl: `${CDN}/FVKQ136BI9044_320_Steenrood_Classic_met_houtnerf_THM.jpg`, ralCode: "8004" },
  { number: 321, name: "Monumentenblauw", sku: "BI9034", finish: "classic-houtnerf", thumbnailUrl: `${CDN}/FVKQ137BI9034_321_Monumentenblauw_Classic_met_houtnerf_THM.jpg`, ralCode: "5004" },
  { number: 322, name: "Staalblauw", sku: "BI9043", finish: "classic-houtnerf", thumbnailUrl: `${CDN}/FVKQ138BI9043_322_Staalblauw_Classic_met_houtnerf_THM.jpg`, ralCode: "5011" },
  { number: 323, name: "Wijnrood", sku: "BI9050", finish: "classic-houtnerf", thumbnailUrl: `${CDN}/FVKQ139BI9050_323_Wijnrood_Classic_met_houtnerf_THM.jpg`, ralCode: "3005" },
  { number: 326, name: "Wit", sku: "BI9051", finish: "classic-houtnerf", thumbnailUrl: `${CDN}/FVKQ142BI9051_326_Wit_Classic_met_houtnerf_THM.jpg`, ralCode: "9016" },
  { number: 328, name: "Donkergroen", sku: "BI9024", finish: "classic-houtnerf", thumbnailUrl: `${CDN}/FVKQ144BI9024_328_Donkergroen_Classic_met_houtnerf_THM.jpg`, ralCode: "6009" },
  { number: 329, name: "Rood", sku: "BI9038", finish: "classic-houtnerf", thumbnailUrl: `${CDN}/FVKQ145BI9038_329_Rood_Classic_met_houtnerf_THM.jpg`, ralCode: "3011" },
  { number: 331, name: "Crème", sku: "BI6059", finish: "classic-houtnerf", thumbnailUrl: `${CDN}/FVKQ147BI6059_331_Creme_Classic_met_houtnerf_THM.jpg`, ralCode: "9001" },
];

export function getKeralitColorsByFinish(finish: KeralitFinish): KeralitColor[] {
  return KERALIT_COLORS.filter((c) => c.finish === finish);
}

export function findKeralitColorByNumber(num: number): KeralitColor | undefined {
  return KERALIT_COLORS.find((c) => c.number === num);
}
