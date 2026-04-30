"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { products, type Orientation } from "@/lib/productCatalog";
import { loadSpanlImageIndex, type SpanlImageProduct } from "@/lib/spanlImageCatalog";
import { SPANL_PANELS, finishEn, type SpanlPanelEntry } from "@/lib/spanlPanelCatalog";
import {
  KERALIT_COLORS,
  KERALIT_FINISH_LABEL_NL,
  KERALIT_FINISH_LABEL_EN,
  type KeralitColor,
} from "@/lib/keralitColorCatalog";
import { usePhotoStore } from "@/lib/usePhotoStore";
import { useLocale } from "@/lib/i18n";
import { checkRenderColor, type ColorCheck } from "@/lib/colorCheck";
import DynamicMetadata from "@/components/DynamicMetadata";
import RenderingLoader from "@/components/RenderingLoader";
import SiteNav from "@/components/SiteNav";

const STORAGE_KEY = "renisual-gevelcalc-v1";
const MAX_VARIANTS = 3;

type SavedSide = {
  id: string;
  name: string;
  width: string;
  height: string;
  openings: unknown[];
};

type SavedConfig = {
  sides: SavedSide[];
  selectedProductId?: string;
  keralitColorNumber?: number | null;
  orientation?: Orientation;
  projectName?: string;
  /**
   * Inline fallback set by gevelcalc when an imported config carries photos
   * that may not have flushed to IndexedDB yet. Optional and bypassed when
   * IndexedDB already has the side photo.
   */
  photos?: Record<string, string>;
};

type RenderPanel = SpanlPanelEntry & {
  imageUrl?: string;
  variantUrl?: string;
};

type RenderVariant = {
  id: string;
  panelLabel: string;
  panelSku: string;
  orientation: Orientation;
  prompt: string;
  dataUrl: string;
  createdAt: number;
  colorCheck?: ColorCheck;
};

type WindowMaterial = "hardwood" | "plastic-white" | "plastic-anthracite" | "aluminium";
type DoorMaterial = "hardwood" | "plastic-white" | "plastic-anthracite" | "steel";
type DoorColour = "white" | "anthracite" | "black" | "wood-colour";

const WINDOW_MATERIAL_LABEL_NL: Record<WindowMaterial, string> = {
  hardwood: "Hardhout",
  "plastic-white": "Kunststof wit",
  "plastic-anthracite": "Kunststof antraciet",
  aluminium: "Aluminium",
};

const DOOR_MATERIAL_LABEL_NL: Record<DoorMaterial, string> = {
  hardwood: "Hardhout",
  "plastic-white": "Kunststof wit",
  "plastic-anthracite": "Kunststof antraciet",
  steel: "Staal",
};

const DOOR_COLOUR_LABEL_NL: Record<DoorColour, string> = {
  white: "Wit",
  anthracite: "Antraciet",
  black: "Zwart",
  "wood-colour": "Houtkleur",
};

// i18n key fragments — link option values to render.frames.*Mat.* / *Col.* keys.
const WINDOW_MATERIAL_KEY: Record<WindowMaterial, string> = {
  hardwood: "hardwood",
  "plastic-white": "plasticWhite",
  "plastic-anthracite": "plasticAnthracite",
  aluminium: "aluminium",
};
const DOOR_MATERIAL_KEY: Record<DoorMaterial, string> = {
  hardwood: "hardwood",
  "plastic-white": "plasticWhite",
  "plastic-anthracite": "plasticAnthracite",
  steel: "steel",
};
const DOOR_COLOUR_KEY: Record<DoorColour, string> = {
  white: "white",
  anthracite: "anthracite",
  black: "black",
  "wood-colour": "wood",
};

const WINDOW_MATERIAL_EN: Record<WindowMaterial, string> = {
  hardwood: "natural-finish hardwood timber",
  "plastic-white": "white PVC plastic",
  "plastic-anthracite": "anthracite-grey PVC plastic",
  aluminium: "powder-coated aluminium",
};

const DOOR_MATERIAL_EN: Record<DoorMaterial, string> = {
  hardwood: "hardwood timber",
  "plastic-white": "PVC plastic",
  "plastic-anthracite": "PVC plastic",
  steel: "steel",
};

const DOOR_COLOUR_EN: Record<DoorColour, string> = {
  white: "white (RAL 9010 / 9016)",
  anthracite: "anthracite grey (RAL 7016)",
  black: "matt black (RAL 9005)",
  "wood-colour": "natural wood colour",
};

function cleanSku(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findImagesForSku(index: SpanlImageProduct[], sku: string): { main?: string; variant?: string } {
  const target = cleanSku(sku);
  if (!target) return {};
  const candidates = [target];
  if (target.includes("9003")) candidates.push(target.replace("9003", "9010"));
  if (target.includes("9010")) candidates.push(target.replace("9010", "9003"));

  const match = index.find((p) => {
    const folderClean = cleanSku(p.slug);
    return candidates.some((c) => folderClean.includes(c) || c.includes(folderClean.slice(0, c.length)));
  });
  if (!match) return {};
  const main = match.images.find((i) => i.type === "main") ?? match.images[0];
  const variant = match.images.find((i) => i.type === "variant");
  return { main: main?.local, variant: variant?.local };
}

function buildPanels(index: SpanlImageProduct[]): RenderPanel[] {
  return SPANL_PANELS.map((entry) => {
    const { main, variant } = findImagesForSku(index, entry.sku);
    const out: RenderPanel = { ...entry };
    if (main) out.imageUrl = main;
    if (variant) out.variantUrl = variant;
    return out;
  });
}

async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function compressDataUrl(dataUrl: string, maxEdge: number, quality = 0.85): Promise<string> {
  if (!dataUrl.startsWith("data:")) return dataUrl;
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("img decode failed"));
    i.src = dataUrl;
  });
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const longest = Math.max(w, h);
  if (longest <= maxEdge && dataUrl.startsWith("data:image/jpeg")) return dataUrl;
  const scale = Math.min(1, maxEdge / longest);
  const cw = Math.round(w * scale);
  const ch = Math.round(h * scale);
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, cw, ch);
  return canvas.toDataURL("image/jpeg", quality);
}

async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => (typeof r.result === "string" ? resolve(r.result) : reject(new Error("read failed")));
      r.onerror = () => reject(r.error ?? new Error("read failed"));
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () =>
      typeof r.result === "string" ? resolve(r.result) : reject(new Error("read failed"));
    r.onerror = () => reject(r.error ?? new Error("read failed"));
    r.readAsDataURL(file);
  });
}

const RAL_HEX: Record<string, { hex: string; description: string }> = {
  "7021": { hex: "#2A2D2F", description: "very dark charcoal grey, almost black" },
  "7038": { hex: "#7B7B79", description: "medium agate grey" },
  "9005": { hex: "#0E0E10", description: "deep matt black" },
  "9006": {
    hex: "#A5A8A6",
    description:
      "WHITE ALUMINIUM — this is NOT white. It is a medium metallic silver-grey, similar to brushed aluminium or galvanized steel. The surface has a subtle metallic sheen. Hex value #A5A8A6. Do NOT render as white or cream. Render as distinctly grey with metallic quality.",
  },
  "9007": {
    hex: "#8F8F8C",
    description:
      "GREY ALUMINIUM — a darker metallic silver-grey than RAL 9006, similar to anodised aluminium. Distinctly grey with a metallic sheen. Hex value #8F8F8C. Do NOT render as plain grey paint — it must read as metallic.",
  },
  "9010": { hex: "#F1ECE1", description: "warm off-white" },
};

const METALLIC_RALS = new Set(["9006", "9007"]);

function metallicWarning(ral: string): string {
  if (ral === "9006") {
    return "CRITICAL COLOUR WARNING: RAL 9006 is WHITE ALUMINIUM — a metallic silver-grey colour, NOT white. The rendered facade MUST look distinctly grey-silver, like brushed metal. If the output looks white or cream, it is WRONG.";
  }
  if (ral === "9007") {
    return "CRITICAL COLOUR WARNING: RAL 9007 is GREY ALUMINIUM — a darker metallic silver-grey, NOT plain grey paint. The rendered facade MUST read as anodised aluminium with a clear metallic sheen. If the output looks like flat matte grey, it is WRONG.";
  }
  return "";
}

function describeColor(panel: RenderPanel): string {
  if (panel.ral && RAL_HEX[panel.ral]) {
    const { hex, description } = RAL_HEX[panel.ral];
    return `${panel.colorEn} — RAL ${panel.ral} (${description}, hex ${hex})`;
  }
  if (panel.ral) return `${panel.colorEn} (RAL ${panel.ral})`;
  return panel.colorEn;
}

function isLightPanel(panel: RenderPanel): boolean {
  if (panel.ral === "9010" || panel.ral === "9006") return true;
  const c = panel.colorEn.toLowerCase();
  return c.includes("white") || c.includes("silver") || c.includes("beige");
}

function describeSeam(panel: RenderPanel): string {
  const light = isLightPanel(panel);
  const lightShadowRule = light
    ? "SHADOW RULE FOR LIGHT/WHITE PANELS: the seam shadow MUST be very pale grey (e.g. RGB ~210,210,210), NEVER black, NEVER dark grey. On a white wall a normal-strength shadow reads as a stark black stripe — that is wrong. Render the seam as an almost-imperceptible tonal break. If you cannot render a sufficiently subtle shadow, render NO seam line rather than a black/dark line."
    : "";
  switch (panel.finish) {
    case "monoFlat":
      return `Seam style: very narrow hairline seam between panels — NOT a dark gap, NOT a black line. The seam is essentially the same colour as the panel itself, only slightly darker by a thin shadow on one side. Adjacent panels read as one continuous coloured surface with subtle dividers. ${lightShadowRule}`;
    case "monoGroove":
      return `Seam style: a deep V-groove between panels. The groove sits a few millimeters back from the panel face and casts a clean shadow line, but its colour is still the panel colour — not pure black. ${lightShadowRule}`;
    case "strip":
      return `Seam style: thin horizontal/vertical shadow lines between narrow planks. The seam is a fine soft shadow, never a black gap; the planks themselves remain the panel colour edge-to-edge. ${lightShadowRule}`;
    case "brick":
      return "Seam style: thin mortar line between individual bricks — light grey mortar, NOT dark. Each brick keeps its full colour and surface texture.";
    case "spanishTile":
      return "Seam style: 3D tile overlap — each curved tile partially covers the next. Shadows fall under each tile lip, but no pure-black gaps.";
    case "wood":
      return `Seam style: tongue-and-groove plank seam, soft shadow line between planks; never a dark gap. ${lightShadowRule}`;
    default:
      return "";
  }
}

function buildKeralitPrompt(opts: {
  productName: string;
  panelWidthCm: number;
  finishEn: string;
  colorName: string;
  colorNumber: number;
  orientation: Orientation;
  refCount: number;
  facade?: { widthCm?: number; heightCm?: number };
  openings?: { windowFrame?: string; doorMaterial?: string; doorColour?: string };
}): string {
  const { productName, panelWidthCm, finishEn, colorName, colorNumber, orientation, refCount, facade, openings } = opts;
  const isVertical = orientation === "vertical";

  let seamCountLine = "";
  if (isVertical && facade?.widthCm && facade.widthCm > 0) {
    const count = Math.max(2, Math.round(facade.widthCm / panelWidthCm));
    seamCountLine = `The facade is approximately ${(facade.widthCm / 100).toFixed(1)} m wide, so exactly ${count} vertical panels must be visible side-by-side.`;
  } else if (!isVertical && facade?.heightCm && facade.heightCm > 0) {
    const count = Math.max(2, Math.round(facade.heightCm / panelWidthCm));
    seamCountLine = `The facade is approximately ${(facade.heightCm / 100).toFixed(1)} m tall, so exactly ${count} horizontal panels must be visible stacked vertically.`;
  } else {
    seamCountLine = `Seams visible at a regular interval of ${panelWidthCm} cm across the entire facade.`;
  }

  const orientationLine = isVertical
    ? `PLACEMENT: VERTICAL — panels stand upright, seams are straight TOP-TO-BOTTOM lines, horizontal distance between adjacent seams = ${panelWidthCm} cm.`
    : `PLACEMENT: HORIZONTAL — panels lie on their long edge, seams are straight LEFT-TO-RIGHT lines parallel to the ground, vertical distance between adjacent seams = ${panelWidthCm} cm.`;

  const refLine = refCount === 1
    ? "REFERENCE: image 2 is the official Keralit color thumbnail. Sample its underlying tone for the facade colour."
    : "";

  const windowLine = openings?.windowFrame ? `Also replace all window frames with ${openings.windowFrame}.` : "";
  const doorLine = openings?.doorMaterial && openings?.doorColour
    ? `Replace all doors with ${openings.doorMaterial} in ${openings.doorColour}.`
    : "";

  const lines = [
    "You are a facade visualisation assistant for Renisual.",
    "OUTPUT REQUIREMENT: the result MUST differ visibly from the input.",
    `TASK: replace the existing facade material on the main building with Keralit ${productName} (PVC cladding, fully maintenance-free), ${finishEn}.`,
    `COLOUR: Keralit color number ${colorNumber} — "${colorName}". Match this colour exactly. The Keralit ${finishEn} surface texture must be visible.`,
    `TEXTURE: ${
      finishEn.includes("Pure matt")
        ? "completely smooth, matt finish, no wood grain, no relief"
        : finishEn.includes("Modern oak")
        ? "soft, even oak wood texture with subtle grain"
        : "fine wood-grain texture across each panel face, like Classic Keralit profile"
    }.`,
    `STEP — ERASE: discard every seam, plank, brick joint, slat or board division of the OLD facade — they belong to the existing material and must NOT survive in the output.`,
    `STEP — APPLY: install Keralit panels at ${panelWidthCm} cm visible width.`,
    orientationLine,
    seamCountLine,
    refLine,
    "Do NOT add any black lines, dark stripes, or shadows between panels. Panel seams must be the same colour as the panels, only slightly darker. Maximum seam width 3mm.",
    "UNIFORMITY: every seam line identical to every other seam — same colour, width, intensity. Treat the entire facade as one continuous panelled surface.",
    windowLine,
    doorLine,
    `PRESERVE EXACTLY (do NOT change position, size or shape of): window openings${
      windowLine ? " (replace only the FRAMES as instructed above)" : ", window frames"
    }, door openings${
      doorLine ? " (replace only the door leaf as instructed above)" : ", doors, door frames"
    }, gutters, roof edges, downspouts, glazing, sky, plants, street, vehicles, camera angle, perspective, lighting and shadows.`,
    "OUTPUT: one photorealistic image of the full facade.",
  ];
  return lines.filter(Boolean).join(" ");
}

function buildDefaultPrompt(
  panel: RenderPanel | undefined,
  orientation: Orientation,
  refCount: number,
  facade?: { widthCm?: number; heightCm?: number },
  openings?: { windowFrame?: string; doorMaterial?: string; doorColour?: string }
): string {
  if (!panel) return "";
  const colorDesc = describeColor(panel);
  const seamStyle = describeSeam(panel);
  const isVertical = orientation === "vertical";

  const windowLine = openings?.windowFrame
    ? `Also replace all window frames with ${openings.windowFrame}.`
    : "";
  const doorLine = openings?.doorMaterial && openings?.doorColour
    ? `Replace all doors with ${openings.doorMaterial} in ${openings.doorColour}.`
    : "";

  let seamCountLine = "";
  if (isVertical && facade?.widthCm && facade.widthCm > 0) {
    const count = Math.max(2, Math.round(facade.widthCm / panel.panelWidthCm));
    seamCountLine = `The facade is approximately ${(facade.widthCm / 100).toFixed(1)} m wide, so exactly ${count} vertical panels must be visible side-by-side, producing ${count - 1} evenly-spaced vertical seam lines across the wall.`;
  } else if (!isVertical && facade?.heightCm && facade.heightCm > 0) {
    const count = Math.max(2, Math.round(facade.heightCm / panel.panelWidthCm));
    seamCountLine = `The facade is approximately ${(facade.heightCm / 100).toFixed(1)} m tall, so exactly ${count} horizontal panels must be visible stacked vertically, producing ${count - 1} evenly-spaced horizontal seam lines across the wall.`;
  } else {
    seamCountLine = `Seams must be clearly visible at a regular interval of ${panel.panelWidthCm} cm across the entire facade.`;
  }

  const orientationBlock = isVertical
    ? [
        "PLACEMENT: VERTICAL CLADDING.",
        "- Panels stand upright; long edge runs from the ground line up to the roof line.",
        "- Seams between adjacent panels are STRAIGHT VERTICAL LINES (perpendicular to the ground).",
        `- Horizontal distance between two consecutive vertical seams = ${panel.panelWidthCm} cm in reality.`,
        "- All seams parallel, evenly spaced, running unbroken from bottom of wall to top of wall (interrupted only by openings).",
        "VERIFY: looking at the output, you should see a row of evenly-spaced TOP-TO-BOTTOM seam lines across the entire facade.",
      ].join(" ")
    : [
        "PLACEMENT: HORIZONTAL CLADDING.",
        "- Panels lie on their long edge; long edge runs LEFT-TO-RIGHT across the wall.",
        "- Seams between adjacent panels are STRAIGHT HORIZONTAL LINES (parallel to the ground).",
        `- Vertical distance between two consecutive horizontal seams = ${panel.panelWidthCm} cm in reality. So across a 3-meter-tall wall there must be ~${Math.max(2, Math.round(300 / panel.panelWidthCm)) - 1} horizontal seam lines, evenly stacked.`,
        "- All seams parallel, evenly spaced, running unbroken from the left edge of the wall to the right edge (interrupted only by openings).",
        "VERIFY: looking at the output, you should see a stack of evenly-spaced LEFT-TO-RIGHT seam lines across the entire facade. If the output has no visible horizontal seam lines, it is wrong — redo it.",
        "DO NOT keep the original facade material. DO NOT output a near-identical copy of the input photo. The cladding must clearly read as horizontal panels.",
      ].join(" ");

  const refLine =
    refCount >= 2
      ? "REFERENCES: image 2 is a close-up swatch (use for exact colour and surface texture). Image 3 shows installation context (use for plank rhythm and seam depth). The references are SWATCHES, not compositions — do not paste them; sample them."
      : refCount === 1
      ? "REFERENCE: use image 2 as a colour/texture/finish swatch — sample its colour and material, do not paste it as a layer."
      : "NO REFERENCE IMAGE PROVIDED: render the material entirely from the colour and finish description above.";

  const lines = [
    "You are a facade visualisation assistant for Renisual.",
    "OUTPUT REQUIREMENT: the result MUST differ visibly from the input. If your output looks identical to the input, the answer is incorrect.",
    "STEP 1 — ERASE: in your mind, FIRST replace the entire existing facade with a smooth blank coloured wall. Discard every seam, plank line, weatherboard rabat, brick joint, slat edge, mortar line, board division and any other small-scale rhythm visible on the building. These belong to the OLD cladding and MUST NOT survive into the output. The output must NOT inherit the spacing of the existing planks/boards/bricks visible in the photo.",
    `STEP 2 — APPLY: onto that blank wall, install Spanl panel ${panel.sku}. Finish/profile: ${finishEn(panel.finish)}. Each new panel has a visible width of ${panel.panelWidthCm} cm — this is typically MUCH wider than narrow weatherboard rabat (~15 cm) you may see in the input. The new panel rhythm must override the old one entirely.`,
    `COLOUR (CRITICAL): ${colorDesc}. The cladding colour MUST exactly match this RAL value. Do NOT lighten the colour. Do NOT desaturate to white or pale grey. Reference photos may have been shot under bright studio lighting that makes them look paler — sample the underlying tone, not the highlights. The final wall must read as the stated colour at midday daylight.`,
    panel.ral && METALLIC_RALS.has(panel.ral) ? metallicWarning(panel.ral) : "",
    seamStyle,
    orientationBlock,
    seamCountLine,
    refLine,
    "TEXTURE: surface must NOT be a flat uniform colour — render each panel with its seam, plank rhythm and surface structure matching the finish (deep groove / narrow strip / brick face / Spanish-tile relief / wood grain).",
    "UNIFORMITY (CRITICAL): every seam line must look IDENTICAL to every other seam line on the facade — same colour, same width, same intensity, same shadow direction. Do NOT render some seams as dark stripes and others as faint lines. Do NOT skip seams in the middle of the wall and only draw them near the edges. Treat the entire facade as one continuous panelled surface with a perfectly uniform seam pattern, broken only by openings (windows/doors).",
    "Do NOT add any black lines, dark stripes, or shadows between panels. Panel seams must be the same colour as the panels, only slightly darker. Maximum seam width 3mm. Do not add any new dark elements that were not in the original photo.",
    windowLine,
    doorLine,
    `PRESERVE EXACTLY (do NOT change position, size or shape of): window openings${
      windowLine ? " (replace only the FRAMES as instructed above; keep glazing, opening size and position identical)" : ", window frames"
    }, door openings${
      doorLine ? " (replace only the door leaf/material as instructed above; keep opening size and position identical)" : ", doors, door frames"
    }, gutters, roof edges, downspouts, glazing, sky, plants, street, vehicles, camera angle, perspective, lighting direction and shadows.`,
    "OUTPUT: one photorealistic image of the full facade.",
  ];
  return lines.filter(Boolean).join(" ");
}

export default function RenderPage() {
  const { t, locale } = useLocale();
  const [savedConfig, setSavedConfig] = useState<SavedConfig | null>(null);
  const [savedPhotos, setSavedPhotos] = useState<Record<string, string>>({});
  const [selectedSideId, setSelectedSideId] = useState<string>("");
  const [photoOverride, setPhotoOverride] = useState<string>("");

  const [panels, setPanels] = useState<RenderPanel[]>([]);
  const [selectedSku, setSelectedSku] = useState<string>("");
  const [orientation, setOrientation] = useState<Orientation>("horizontal");

  const [customPrompt, setCustomPrompt] = useState<string>("");
  const [promptTouched, setPromptTouched] = useState<boolean>(false);

  const [variants, setVariants] = useState<RenderVariant[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(id);
  }, [toast]);
  const [attemptCount, setAttemptCount] = useState(0);
  const [windowMaterial, setWindowMaterial] = useState<WindowMaterial | "">("");
  const [doorMaterial, setDoorMaterial] = useState<DoorMaterial | "">("");
  const [doorColour, setDoorColour] = useState<DoorColour | "">("");
  const [brand, setBrand] = useState<"spanl" | "keralit">("spanl");
  const [selectedKeralitProductId, setSelectedKeralitProductId] = useState<string>("");
  const [selectedKeralitColorNumber, setSelectedKeralitColorNumber] = useState<number | null>(null);
  const [sampleTab, setSampleTab] = useState<"houses" | "woonboten" | null>(null);
  const [houseSamples, setHouseSamples] = useState<Array<{ file: string; label: string }>>([]);
  const [woonbootSamples, setWoonbootSamples] = useState<Array<{ file: string; label: string }>>([]);

  useEffect(() => {
    fetch("/samples/houses/index.json")
      .then((r) => (r.ok ? r.json() : []))
      .then(setHouseSamples)
      .catch(() => setHouseSamples([]));
    fetch("/samples/woonboten/index.json")
      .then((r) => (r.ok ? r.json() : []))
      .then(setWoonbootSamples)
      .catch(() => setWoonbootSamples([]));
  }, []);

  async function loadSamplePhoto(folder: "houses" | "woonboten", file: string) {
    try {
      const res = await fetch(`/samples/${folder}/${file}`);
      const blob = await res.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      const compressed = await compressDataUrl(dataUrl, 1600, 0.85);
      setPhotoOverride(compressed);
      setSelectedSideId("");
    } catch {
      setErrorMsg(t("render.error.upload"));
    }
  }

  const keralitProducts = useMemo(() => products.filter((p) => p.brand === "Keralit"), []);
  const selectedKeralitProduct = useMemo(
    () => keralitProducts.find((p) => p.id === selectedKeralitProductId),
    [keralitProducts, selectedKeralitProductId]
  );
  const selectedKeralitColor = useMemo(
    () => (selectedKeralitColorNumber != null ? KERALIT_COLORS.find((c) => c.number === selectedKeralitColorNumber) : undefined),
    [selectedKeralitColorNumber]
  );

  const { loadAllPhotos, saveRender } = usePhotoStore();

  const selectedPanel = useMemo(
    () => (selectedSku ? panels.find((p) => p.sku === selectedSku) : undefined),
    [panels, selectedSku]
  );
  const sourcePhoto = photoOverride || (selectedSideId ? savedPhotos[selectedSideId] : "");
  const sidesWithPhoto = useMemo(
    () => (savedConfig?.sides ?? []).filter((s) => savedPhotos[s.id]),
    [savedConfig?.sides, savedPhotos]
  );

  const facadeDims = useMemo(() => {
    if (!selectedSideId || !savedConfig) return undefined;
    const side = savedConfig.sides.find((s) => s.id === selectedSideId);
    if (!side) return undefined;
    const widthCm = Number(side.width) || 0;
    const heightCm = Number(side.height) || 0;
    if (widthCm <= 0 && heightCm <= 0) return undefined;
    return { widthCm, heightCm };
  }, [selectedSideId, savedConfig]);

  const refCount = selectedPanel ? (selectedPanel.variantUrl ? 2 : selectedPanel.imageUrl ? 1 : 0) : 0;

  const openingsForPrompt = useMemo(
    () => ({
      windowFrame: windowMaterial ? WINDOW_MATERIAL_EN[windowMaterial] : undefined,
      doorMaterial: doorMaterial ? DOOR_MATERIAL_EN[doorMaterial] : undefined,
      doorColour: doorColour ? DOOR_COLOUR_EN[doorColour] : undefined,
    }),
    [windowMaterial, doorMaterial, doorColour]
  );

  const keralitRefCount = brand === "keralit" && selectedKeralitColor ? 1 : 0;

  const defaultPrompt = useMemo(() => {
    if (brand === "keralit" && selectedKeralitProduct && selectedKeralitColor) {
      return buildKeralitPrompt({
        productName: selectedKeralitProduct.name,
        panelWidthCm: selectedKeralitProduct.panelWorkSize / 10,
        finishEn: KERALIT_FINISH_LABEL_EN[selectedKeralitColor.finish],
        colorName: selectedKeralitColor.name,
        colorNumber: selectedKeralitColor.number,
        orientation,
        refCount: keralitRefCount,
        facade: facadeDims,
        openings: openingsForPrompt,
      });
    }
    return buildDefaultPrompt(selectedPanel, orientation, refCount, facadeDims, openingsForPrompt);
  }, [brand, selectedKeralitProduct, selectedKeralitColor, selectedPanel, orientation, refCount, keralitRefCount, facadeDims, openingsForPrompt]);
  const effectivePrompt = promptTouched ? customPrompt : defaultPrompt;

  useEffect(() => {
    loadSpanlImageIndex()
      .then((idx) => setPanels(buildPanels(idx)))
      .catch(() => setPanels(buildPanels([])));
  }, []);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as SavedConfig;
      setSavedConfig(parsed);
      if (parsed.orientation) setOrientation(parsed.orientation);
      if (parsed.selectedProductId) {
        const product = products.find((p) => p.id === parsed.selectedProductId);
        if (product?.brand === "Keralit") {
          setBrand("keralit");
          setSelectedKeralitProductId(parsed.selectedProductId);
          if (typeof parsed.keralitColorNumber === "number") {
            setSelectedKeralitColorNumber(parsed.keralitColorNumber);
          }
        }
      }
      const ids = (parsed.sides ?? []).map((s) => s.id);
      if (ids.length === 0) return;
      loadAllPhotos(ids)
        .then((map) => {
          // Merge IndexedDB photos with the inline photos in sessionStorage.
          // IndexedDB wins where both exist; the inline map fills the gaps
          // (e.g. right after importing a config file).
          const merged: Record<string, string> = { ...(parsed.photos ?? {}), ...map };
          setSavedPhotos(merged);
          const firstWithPhoto = ids.find((id) => merged[id]);
          if (firstWithPhoto) {
            setSelectedSideId(firstWithPhoto);
          } else {
            setErrorMsg(t("render.error.noPhoto"));
          }
        })
        .catch(() => {
          // IndexedDB blew up — try the inline fallback alone.
          const fallback = parsed.photos ?? {};
          setSavedPhotos(fallback);
          const firstWithPhoto = ids.find((id) => fallback[id]);
          if (firstWithPhoto) setSelectedSideId(firstWithPhoto);
          else setErrorMsg(t("render.error.noPhoto"));
        });
    } catch {
      setErrorMsg(t("render.error.config"));
    }
  }, [loadAllPhotos, t]);

  useEffect(() => {
    setVariants([]);
    setErrorMsg("");
  }, [sourcePhoto]);


  async function handleUpload(file: File | null) {
    if (!file || !file.type.startsWith("image/")) return;
    try {
      const raw = await fileToDataUrl(file);
      const compressed = await compressDataUrl(raw, 1600, 0.85);
      setPhotoOverride(compressed);
      setSelectedSideId("");
    } catch {
      setErrorMsg(t("render.error.upload"));
    }
  }

  async function handleGenerate() {
    if (!sourcePhoto) return;
    if (brand === "spanl" && !selectedPanel) return;
    if (brand === "keralit" && (!selectedKeralitProduct || !selectedKeralitColor)) return;
    if (variants.length >= MAX_VARIANTS) {
      setToast("Maximaal 3 varianten — verwijder er één om verder te gaan");
      return;
    }
    setIsGenerating(true);
    setErrorMsg("");
    setAttemptCount(0);
    try {
      const refUrls: string[] = [];
      if (brand === "spanl" && selectedPanel) {
        if (selectedPanel.imageUrl) {
          const main = await urlToDataUrl(selectedPanel.imageUrl);
          if (main) refUrls.push(await compressDataUrl(main, 1024, 0.82));
        }
        if (selectedPanel.variantUrl) {
          const variant = await urlToDataUrl(selectedPanel.variantUrl);
          if (variant) refUrls.push(await compressDataUrl(variant, 1024, 0.82));
        }
      } else if (brand === "keralit" && selectedKeralitColor) {
        const swatch = await urlToDataUrl(selectedKeralitColor.thumbnailUrl);
        if (swatch) refUrls.push(await compressDataUrl(swatch, 1024, 0.82));
      }
      const photoLarge = await compressDataUrl(sourcePhoto, 1600, 0.85);

      let productLabel: string;
      let productDescription: string;
      let panelWidthCm: number;
      let panelSkuForVariant: string;
      let targetHex: string | undefined;
      if (brand === "keralit" && selectedKeralitProduct && selectedKeralitColor) {
        productLabel = `Keralit ${selectedKeralitProduct.name} — ${selectedKeralitColor.name} (${selectedKeralitColor.number}), ${KERALIT_FINISH_LABEL_NL[selectedKeralitColor.finish]}`;
        productDescription = `Keralit PVC cladding, ${KERALIT_FINISH_LABEL_EN[selectedKeralitColor.finish]}, color ${selectedKeralitColor.name} (Keralit color number ${selectedKeralitColor.number}).`;
        panelWidthCm = selectedKeralitProduct.panelWorkSize / 10;
        panelSkuForVariant = `keralit-${selectedKeralitProduct.id}-${selectedKeralitColor.number}`;
        targetHex = undefined;
      } else if (selectedPanel) {
        const ralPart = selectedPanel.ral ? ` (RAL ${selectedPanel.ral})` : "";
        productLabel = `Spanl ${selectedPanel.sku} — ${selectedPanel.colorEn}${ralPart}, ${finishEn(selectedPanel.finish)}`;
        productDescription = `Color: ${selectedPanel.colorEn}${ralPart}. Finish: ${finishEn(selectedPanel.finish)}. Visible panel width: ${selectedPanel.panelWidthCm} cm.`;
        panelWidthCm = selectedPanel.panelWidthCm;
        panelSkuForVariant = selectedPanel.sku;
        targetHex = selectedPanel.ral && RAL_HEX[selectedPanel.ral]?.hex;
      } else {
        return;
      }
      const payload = {
        photoDataUrl: photoLarge,
        referenceDataUrls: refUrls,
        productLabel,
        productDescription,
        orientation,
        panelWidthCm,
        facadeWidthCm: facadeDims?.widthCm,
        facadeHeightCm: facadeDims?.heightCm,
        windowFrame: openingsForPrompt.windowFrame ? { material: openingsForPrompt.windowFrame } : undefined,
        door: openingsForPrompt.doorMaterial && openingsForPrompt.doorColour
          ? { material: openingsForPrompt.doorMaterial, colour: openingsForPrompt.doorColour }
          : undefined,
        prompt: effectivePrompt || undefined,
        locale,
      };

      const MAX_ATTEMPTS = 3;
      let renderDataUrl: string | null = null;
      let lastError = "";
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        setAttemptCount(attempt);
        const res = await fetch("/api/render", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as { renderDataUrl?: string; error?: string };
        if (res.ok && data.renderDataUrl) {
          renderDataUrl = data.renderDataUrl;
          break;
        }
        const errorText = String(data.error ?? "");
        const isRateLimit =
          res.status === 429 ||
          errorText.includes('"code":429') ||
          /quota|rate.?limit|exhausted|too many/i.test(errorText);
        lastError = errorText || `HTTP ${res.status}`;
        if (!isRateLimit || attempt >= MAX_ATTEMPTS) break;
        const m = errorText.match(/"retryDelay":\s*"(\d+)s"/);
        const delaySec = m ? Math.min(45, Number(m[1]) + 2) : 30;
        await new Promise((r) => setTimeout(r, delaySec * 1000));
      }
      if (!renderDataUrl) {
        setErrorMsg(lastError || t("render.error.failed"));
        return;
      }
      const variant: RenderVariant = {
        id: crypto.randomUUID(),
        panelLabel: productLabel,
        panelSku: panelSkuForVariant,
        orientation,
        prompt: effectivePrompt,
        dataUrl: renderDataUrl,
        createdAt: Date.now(),
      };
      setVariants((prev) => [variant, ...prev]);
      const key = await sha256(`${photoLarge}|${panelSkuForVariant}|${orientation}|${effectivePrompt}|${variant.id}`);
      await saveRender(key, renderDataUrl).catch(() => {});
      if (targetHex) {
        try {
          const check = await checkRenderColor(renderDataUrl, targetHex);
          if (check) {
            setVariants((prev) => prev.map((v) => (v.id === variant.id ? { ...v, colorCheck: check } : v)));
          }
        } catch {
          /* color check best-effort */
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t("render.error.generic"));
    } finally {
      setIsGenerating(false);
    }
  }

  function resetPrompt() {
    setPromptTouched(false);
    setCustomPrompt("");
  }

  const localeForDate = locale === "nl" ? "nl-NL" : locale === "de" ? "de-DE" : locale === "fr" ? "fr-FR" : locale === "es" ? "es-ES" : "en-GB";

  return (
    <main className="min-h-[100dvh] bg-paper text-ink">
      <DynamicMetadata page="render" />
      <SiteNav />
      <div className="mx-auto max-w-[1400px] px-6 py-12 pb-28 md:px-12 md:py-16 lg:px-20">
        <header className="mb-12 flex flex-wrap items-end justify-between gap-6 border-b border-stone-200 pb-8">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-stone-600">
              {t("home.nav.render")}
            </p>
            <h1 className="mt-3 font-display text-4xl tracking-tight text-ink md:text-5xl">
              {t("render.title")}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-stone-600">
              {savedConfig?.projectName ?? t("render.subtitleStandalone")}
            </p>
          </div>
          <Link
            href="/gevelcalc"
            className="border border-ink px-6 py-2.5 font-mono text-[11px] uppercase tracking-[0.15em] text-ink transition-colors hover:bg-ink hover:text-paper"
          >
            {t("nav.toCalc")} →
          </Link>
        </header>
        <div className="space-y-12">
        <section>
          <p className="mb-6 font-mono text-[11px] uppercase tracking-[0.2em] text-stone-600">
            01 — {t("render.section.photo")}
          </p>

          {sidesWithPhoto.length > 0 && (
            <div className="mt-3">
              <p className="mb-2 text-xs text-gray-500">{t("render.fromCalc")}</p>
              <div className="flex flex-wrap gap-2">
                {sidesWithPhoto.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setSelectedSideId(s.id);
                      setPhotoOverride("");
                    }}
                    className={`rounded-xl border px-4 py-2 text-sm ${
                      s.id === selectedSideId && !photoOverride
                        ? "border-black bg-black text-white"
                        : "border-black bg-white"
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div
            className="mt-3 border border-dashed border-stone-300 bg-stone-50 p-8 text-center"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleUpload(e.dataTransfer.files?.[0] ?? null);
            }}
          >
            <div className="flex flex-col items-center gap-3">
              <div className="flex flex-wrap justify-center gap-2">
                <label className="cursor-pointer">
                  <span className="block bg-ink px-7 py-3 font-mono text-[11px] uppercase tracking-[0.15em] text-paper transition-colors hover:bg-stone-800">
                    {photoOverride ? t("render.changePhoto") : t("render.uploadOwn")}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleUpload(e.target.files?.[0] ?? null)}
                  />
                </label>
                {/* Mobile-only camera capture — uses the rear camera via
                    the "environment" capture hint. Hidden on md+ where a
                    physical camera button would only confuse desktop
                    users. */}
                <label className="cursor-pointer md:hidden">
                  <span className="block border border-ink px-7 py-3 font-mono text-[11px] uppercase tracking-[0.15em] text-ink transition-colors hover:bg-ink hover:text-paper">
                    {locale === "nl" ? "Maak foto" : locale === "de" ? "Foto aufnehmen" : locale === "fr" ? "Prendre une photo" : locale === "es" ? "Tomar foto" : "Take photo"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => handleUpload(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
              <span className="text-xs text-stone-500">{t("render.dropOrDrag")}</span>
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-xs text-gray-500">
              {locale === "nl" ? "Of kies een voorbeeldfoto" : "Or pick a sample photo"}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSampleTab(sampleTab === "houses" ? null : "houses")}
                className={`rounded-xl border px-3 py-1.5 text-sm ${
                  sampleTab === "houses" ? "border-black bg-black text-white" : "border-black bg-white"
                }`}
              >
                {t("woningen")} ({houseSamples.length})
              </button>
              <button
                type="button"
                onClick={() => setSampleTab(sampleTab === "woonboten" ? null : "woonboten")}
                className={`rounded-xl border px-3 py-1.5 text-sm ${
                  sampleTab === "woonboten" ? "border-black bg-black text-white" : "border-black bg-white"
                }`}
              >
                {t("woonboten")} ({woonbootSamples.length})
              </button>
            </div>
            {sampleTab && (
              <div className="mt-3">
                {(sampleTab === "houses" ? houseSamples : woonbootSamples).length === 0 ? (
                  <p className="rounded-xl border border-dashed border-black/40 p-4 text-center text-xs text-gray-500">
                    {locale === "nl"
                      ? `Nog geen voorbeeldfoto's. Plaats afbeeldingen in /public/samples/${sampleTab}/ en update index.json.`
                      : `No samples yet. Drop images in /public/samples/${sampleTab}/ and update index.json.`}
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {(sampleTab === "houses" ? houseSamples : woonbootSamples).map((s) => (
                      <button
                        key={s.file}
                        type="button"
                        onClick={() => loadSamplePhoto(sampleTab, s.file)}
                        className="overflow-hidden rounded-xl border border-black bg-white text-left hover:bg-neutral-50"
                      >
                        <img
                          src={`/samples/${sampleTab}/${s.file}`}
                          alt={s.label}
                          loading="lazy"
                          className="block aspect-[4/3] w-full object-cover"
                        />
                        <p className="px-2 py-1 text-xs">{s.label}</p>
                      </button>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-[11px] text-gray-400">
                  Sample images:{" "}
                  <a
                    href="https://unsplash.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-gray-600"
                  >
                    Unsplash
                  </a>
                </p>
              </div>
            )}
          </div>

          {sourcePhoto && (
            <div className="mt-3">
              <img
                src={sourcePhoto}
                alt="source"
                className="mx-auto max-h-64 w-full rounded-xl object-contain"
              />
            </div>
          )}
        </section>

        <section>
          <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.2em] text-stone-600">
            02 — {t("render.section.panel")}
          </p>

          <div className="mb-4 flex gap-2">
            <button
              type="button"
              onClick={() => setBrand("spanl")}
              className={`rounded-xl border px-4 py-2 text-sm ${
                brand === "spanl" ? "border-black bg-black text-white" : "border-black bg-white"
              }`}
            >
              Spanl
            </button>
            <button
              type="button"
              onClick={() => setBrand("keralit")}
              className={`rounded-xl border px-4 py-2 text-sm ${
                brand === "keralit" ? "border-black bg-black text-white" : "border-black bg-white"
              }`}
            >
              Keralit
            </button>
          </div>

          {brand === "keralit" ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Keralit paneel</label>
                  <select
                    className="w-full rounded-xl border border-black p-3"
                    value={selectedKeralitProductId}
                    onChange={(e) => setSelectedKeralitProductId(e.target.value)}
                  >
                    <option value="">{t("render.choosePanel")}</option>
                    {keralitProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.panelWorkSize} mm)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">{t("render.orientation")}</label>
                  <select
                    className="w-full rounded-xl border border-black p-3"
                    value={orientation}
                    onChange={(e) => setOrientation(e.target.value as Orientation)}
                  >
                    <option value="horizontal">{t("render.horizontal")}</option>
                    <option value="vertical">{t("render.vertical")}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Kleur ({KERALIT_COLORS.length} kleuren)
                </label>
                {(["classic-houtnerf", "pure-mat", "modern-eiken"] as const).map((finish) => {
                  const colors = KERALIT_COLORS.filter((c) => c.finish === finish);
                  return (
                    <div key={finish} className="mb-4">
                      <p className="mb-2 text-xs font-semibold text-gray-600">
                        {KERALIT_FINISH_LABEL_NL[finish]} ({colors.length})
                      </p>
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
                        {colors.map((c) => (
                          <button
                            key={c.number}
                            type="button"
                            onClick={() => setSelectedKeralitColorNumber(c.number)}
                            className={`overflow-hidden rounded-lg border-2 text-left transition ${
                              selectedKeralitColorNumber === c.number
                                ? "border-black ring-2 ring-black"
                                : "border-gray-200 hover:border-gray-400"
                            }`}
                            title={`${c.number} ${c.name}`}
                          >
                            <img src={c.thumbnailUrl} alt={c.name} className="block aspect-square w-full object-cover" />
                            <div className="p-1 text-[10px] leading-tight">
                              <div className="font-semibold">{c.number}</div>
                              <div className="truncate text-gray-600">{c.name}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">{t("render.orientation")}</label>
              <select
                className="w-full rounded-xl border border-black p-3"
                value={orientation}
                onChange={(e) => setOrientation(e.target.value as Orientation)}
              >
                <option value="horizontal">{t("render.horizontal")}</option>
                <option value="vertical">{t("render.vertical")}</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                {t("render.spanlPanel")} ({panels.length})
              </label>
              {panels.every((p) => !p.imageUrl) && (
                <p className="mb-3 text-xs text-amber-700">
                  {t("render.panelIndexHint", {
                    cmd: "node scripts/build-spanl-index.js",
                  })}
                </p>
              )}
              {(["monoFlat", "monoGroove", "strip", "brick", "spanishTile", "wood"] as const).map((finish) => {
                const group = panels.filter((p) => p.finish === finish);
                if (group.length === 0) return null;
                return (
                  <div key={finish} className="mb-4">
                    <p className="mb-2 text-xs font-semibold text-gray-600">
                      {t(`finish.${finish}`)} ({group.length})
                    </p>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
                      {group.map((p) => {
                        const ral = p.ral ? ` (RAL ${p.ral})` : "";
                        return (
                          <button
                            key={p.sku}
                            type="button"
                            onClick={() => setSelectedSku(p.sku)}
                            className={`overflow-hidden rounded-lg border-2 text-left transition ${
                              selectedSku === p.sku
                                ? "border-black ring-2 ring-black"
                                : "border-gray-200 hover:border-gray-400"
                            }`}
                            title={`${p.sku} — ${t(p.colorKey)}${ral}`}
                          >
                            {p.imageUrl ? (
                              <img
                                src={p.imageUrl}
                                alt={p.sku}
                                loading="lazy"
                                className="block aspect-square w-full object-cover"
                              />
                            ) : (
                              <div className="flex aspect-square w-full items-center justify-center bg-neutral-100 text-[9px] text-gray-400">
                                {t("render.noReference")}
                              </div>
                            )}
                            <div className="p-1 text-[10px] leading-tight">
                              <div className="font-semibold">{p.sku}</div>
                              <div className="truncate text-gray-600">
                                {t(p.colorKey)}
                                {p.ral ? ` · ${p.ral}` : ""}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          )}
        </section>

        <section>
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-stone-600">
            03 — {t("render.frames.heading")}
          </p>
          <p className="mb-4 text-xs text-stone-500">{t("render.frames.subtitle")}</p>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium">{t("render.frames.windowMaterial")}</label>
              <select
                className="w-full rounded-xl border border-black p-3"
                value={windowMaterial}
                onChange={(e) => setWindowMaterial(e.target.value as WindowMaterial | "")}
              >
                <option value="">{t("render.frames.unchanged")}</option>
                {(Object.keys(WINDOW_MATERIAL_LABEL_NL) as WindowMaterial[]).map((k) => (
                  <option key={k} value={k}>
                    {t(`render.frames.windowMat.${WINDOW_MATERIAL_KEY[k]}`)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">{t("render.frames.doorMaterial")}</label>
              <select
                className="w-full rounded-xl border border-black p-3"
                value={doorMaterial}
                onChange={(e) => setDoorMaterial(e.target.value as DoorMaterial | "")}
              >
                <option value="">{t("render.frames.unchanged")}</option>
                {(Object.keys(DOOR_MATERIAL_LABEL_NL) as DoorMaterial[]).map((k) => (
                  <option key={k} value={k}>
                    {t(`render.frames.doorMat.${DOOR_MATERIAL_KEY[k]}`)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">{t("render.frames.doorColour")}</label>
              <select
                className="w-full rounded-xl border border-black p-3"
                value={doorColour}
                onChange={(e) => setDoorColour(e.target.value as DoorColour | "")}
              >
                <option value="">{t("render.frames.unchanged")}</option>
                {(Object.keys(DOOR_COLOUR_LABEL_NL) as DoorColour[]).map((k) => (
                  <option key={k} value={k}>
                    {t(`render.frames.doorCol.${DOOR_COLOUR_KEY[k]}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {doorMaterial && !doorColour && (
            <p className="mt-2 text-xs text-amber-700">{t("render.frames.doorWarn")}</p>
          )}
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-stone-600">
              04 — {t("render.section.prompt")}
            </p>
            {promptTouched && (
              <button
                type="button"
                onClick={resetPrompt}
                className="font-mono text-[10px] uppercase tracking-[0.15em] text-stone-500 underline-offset-4 hover:text-ink hover:underline"
              >
                {t("render.promptReset")}
              </button>
            )}
          </div>
          <p className="mb-3 text-xs text-stone-500">{t("render.promptHint")}</p>
          <textarea
            value={effectivePrompt}
            onChange={(e) => {
              setPromptTouched(true);
              setCustomPrompt(e.target.value);
            }}
            rows={6}
            placeholder={defaultPrompt || t("render.promptPlaceholder")}
            className="w-full border border-stone-200 bg-paper p-3 font-mono text-xs text-ink"
          />
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-stone-600">
              05 — {t("render.section.renders")}
            </p>
            <span
              className={`text-xs font-medium ${
                variants.length >= MAX_VARIANTS ? "text-amber-700" : "text-gray-500"
              }`}
            >
              {`${variants.length}/${MAX_VARIANTS}`}
            </span>
          </div>

          {variants.length >= MAX_VARIANTS && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border-2 border-amber-500 bg-amber-50 p-3 text-sm text-amber-900">
              <span aria-hidden className="text-base leading-none">⚠</span>
              <span>{t("render.cap.banner")}</span>
            </div>
          )}

          {isGenerating && (
            <div className="mt-3 overflow-hidden rounded-xl border border-black">
              <RenderingLoader attempt={attemptCount} />
            </div>
          )}

          {!isGenerating && variants.length === 0 && !errorMsg && (
            <p className="mt-3 text-sm text-gray-500">{t("rendering_empty_state")}</p>
          )}

          <div className="mt-4 space-y-4">
            {variants.map((v) => (
              <article key={v.id} className="overflow-hidden rounded-xl border border-black">
                <img src={v.dataUrl} alt={v.panelLabel} className="block w-full" />
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-black p-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    {v.colorCheck && (
                      <span
                        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] ${
                          v.colorCheck.verdict === "good"
                            ? "bg-green-100 text-green-800"
                            : v.colorCheck.verdict === "off"
                            ? "bg-amber-100 text-amber-900"
                            : "bg-red-100 text-red-800"
                        }`}
                        title={`sampled ${v.colorCheck.sampledHex} vs target ${v.colorCheck.targetHex}, ΔE76 = ${v.colorCheck.deltaE}`}
                      >
                        <span
                          aria-hidden
                          className="inline-block h-2.5 w-2.5 rounded-full border border-black/20"
                          style={{ background: v.colorCheck.sampledHex }}
                        />
                        →
                        <span
                          aria-hidden
                          className="inline-block h-2.5 w-2.5 rounded-full border border-black/20"
                          style={{ background: v.colorCheck.targetHex }}
                        />
                        ΔE {v.colorCheck.deltaE}
                      </span>
                    )}
                    <span className="font-semibold">{v.panelLabel}</span>
                    <span className="text-gray-500">
                      {" · "}
                      {v.orientation === "horizontal" ? t("render.horizontal") : t("render.vertical")}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400">{new Date(v.createdAt).toLocaleString(localeForDate)}</span>
                    <a
                      href={v.dataUrl}
                      download={`renisual-render-${v.panelSku}-${v.orientation}-${v.id.slice(0, 6)}.png`}
                      className="rounded-lg border border-black px-2 py-1"
                    >
                      {t("render.download")}
                    </a>
                    <button
                      type="button"
                      onClick={() => setVariants((prev) => prev.filter((x) => x.id !== v.id))}
                      className="rounded-lg border border-black px-2 py-1"
                    >
                      {t("render.delete")}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {errorMsg && (
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">
              <span className="flex-1">{errorMsg}</span>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating || !sourcePhoto}
                className="rounded-lg border border-red-400 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                {t("rendering_retry_button")}
              </button>
            </div>
          )}
        </section>
        </div>
      </div>

      {toast && (
        <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-xl border border-amber-400 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 shadow-md">
          {toast}
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 border-t border-stone-200 bg-paper/95 p-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] items-center justify-end gap-2 px-6 md:px-12 lg:px-20">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={
              isGenerating ||
              !sourcePhoto ||
              variants.length >= MAX_VARIANTS ||
              (brand === "spanl" ? !selectedPanel : !selectedKeralitProduct || !selectedKeralitColor)
            }
            className="bg-ink px-8 py-3 font-mono text-[11px] uppercase tracking-[0.15em] text-paper transition-colors hover:bg-stone-800 disabled:opacity-40"
          >
            {variants.length >= MAX_VARIANTS
              ? t("render.cap.btnLabel")
              : variants.length > 0
              ? t("render.btnAddVariant")
              : t("render.btnGenerate")}
          </button>
        </div>
      </div>
    </main>
  );
}
