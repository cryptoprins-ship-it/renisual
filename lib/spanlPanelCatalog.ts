export type SpanlFinish = "monoFlat" | "monoGroove" | "strip" | "brick" | "spanishTile" | "wood";

export type SpanlPanelEntry = {
  sku: string;
  colorKey: string;
  colorEn: string;
  ral?: string;
  finish: SpanlFinish;
  panelWidthCm: number;
  note?: string;
  // Y-prefix SKUs (YMPB*, YMSG*, YPMB*) hebben wood-grain texture op het
  // anders gladde monoFlat/monoGroove oppervlak. Render-prompt voegt
  // 'subtle wood-grain texture' toe wanneer grain:true.
  grain?: boolean;
};

export const SPANL_PANELS: SpanlPanelEntry[] = [
  { sku: "B10-01", colorKey: "color.brickBeige", colorEn: "beige brick", finish: "brick", panelWidthCm: 21 },
  { sku: "B10-02", colorKey: "color.brickGrey", colorEn: "grey brick", finish: "brick", panelWidthCm: 21 },

  { sku: "CZS70-01A", colorKey: "color.spanishTileBeige", colorEn: "beige Spanish tile", finish: "spanishTile", panelWidthCm: 30 },
  { sku: "CZS70-02A", colorKey: "color.spanishTileGrey", colorEn: "grey Spanish tile", finish: "spanishTile", panelWidthCm: 30 },

  { sku: "PB7038A", colorKey: "color.mattGrey", colorEn: "matt grey", ral: "7038", finish: "monoFlat", panelWidthCm: 37 },
  { sku: "PB9003A", colorKey: "color.white", colorEn: "white", ral: "9010", finish: "monoFlat", panelWidthCm: 37, note: "RAL 9010 look" },

  { sku: "PBW32-06", colorKey: "color.warmOak", colorEn: "warm oak wood", finish: "wood", panelWidthCm: 32 },

  { sku: "SG7021A", colorKey: "color.darkGrey", colorEn: "dark grey almost black", ral: "7021", finish: "monoGroove", panelWidthCm: 37 },
  { sku: "SG7038A", colorKey: "color.concreteGrey", colorEn: "concrete look matt grey", ral: "7038", finish: "monoGroove", panelWidthCm: 37 },
  { sku: "SG9003A", colorKey: "color.white", colorEn: "white", ral: "9010", finish: "monoGroove", panelWidthCm: 37, note: "RAL 9010 look" },
  { sku: "SG9005A", colorKey: "color.mattBlack", colorEn: "matt black", ral: "9005", finish: "monoGroove", panelWidthCm: 37 },
  { sku: "SG9006A", colorKey: "color.silver", colorEn: "metallic silver-grey, brushed aluminium look — NOT white", ral: "9006", finish: "monoGroove", panelWidthCm: 37 },

  // TS strip-finish panels removed — klein-9b kept rendering them
  // with the wrong colour cast and the textured-relief surface drift
  // off-brand. Catalog row + finish enum value retained for a future
  // re-introduction once the prompt is dialled in.

  { sku: "YMPB7021A", colorKey: "color.darkGrey", colorEn: "dark grey almost black", ral: "7021", finish: "monoFlat", panelWidthCm: 37, grain: true },
  { sku: "YMPB9003A", colorKey: "color.white", colorEn: "white", ral: "9003", finish: "monoFlat", panelWidthCm: 37, grain: true },
  { sku: "YMPB9005A", colorKey: "color.black", colorEn: "black", ral: "9005", finish: "monoFlat", panelWidthCm: 37, grain: true },

  { sku: "YMSG7021A", colorKey: "color.darkGrey", colorEn: "dark grey almost black", ral: "7021", finish: "monoGroove", panelWidthCm: 37, grain: true },
  { sku: "YMSG7038A", colorKey: "color.mattGrey", colorEn: "matt grey", ral: "7038", finish: "monoGroove", panelWidthCm: 37, grain: true },
  { sku: "YMSG9003A", colorKey: "color.white", colorEn: "white", ral: "9010", finish: "monoGroove", panelWidthCm: 37, note: "RAL 9010 look", grain: true },
  { sku: "YMSG9005A", colorKey: "color.black", colorEn: "black", ral: "9005", finish: "monoGroove", panelWidthCm: 37, grain: true },

  { sku: "YPMB7038A", colorKey: "color.mattGrey", colorEn: "matt grey", ral: "7038", finish: "monoFlat", panelWidthCm: 37, grain: true },
];

export function findPanelBySku(sku: string): SpanlPanelEntry | undefined {
  const target = sku.toLowerCase().replace(/[^a-z0-9]/g, "");
  return SPANL_PANELS.find((p) => p.sku.toLowerCase().replace(/[^a-z0-9]/g, "") === target);
}

const FINISH_EN: Record<SpanlFinish, string> = {
  monoFlat: "Mono Flat (flat surface, narrow seam)",
  monoGroove: "Mono Groove (deep groove between panels)",
  strip: "Strip (narrow planks)",
  brick: "Brick look (each brick visible)",
  spanishTile: "Spanish roof tile look",
  wood: "wood plank look",
};

export function finishEn(finish: SpanlFinish): string {
  return FINISH_EN[finish];
}
