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
import { useProjectStore } from "@/lib/projectStore";
import { getPhotoUrl } from "@/lib/photoStorage";
import { checkRenderColor, type ColorCheck } from "@/lib/colorCheck";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
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

export default function RenderPage() {
  const { t, locale } = useLocale();
  const [savedConfig, setSavedConfig] = useState<SavedConfig | null>(null);
  const [savedPhotos, setSavedPhotos] = useState<Record<string, string>>({});
  const [selectedSideId, setSelectedSideId] = useState<string>("");
  const [photoOverride, setPhotoOverride] = useState<string>("");

  const [panels, setPanels] = useState<RenderPanel[]>([]);
  const [selectedSku, setSelectedSku] = useState<string>("");
  const [orientation, setOrientation] = useState<Orientation>("horizontal");


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

  const includeBoeideel = useProjectStore((s) => s.includeBoeideel);
  const setIncludeBoeideel = useProjectStore((s) => s.setIncludeBoeideel);

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

  // Allowed orientations per product. Spanl: monoFlat/monoGroove support
  // both, all other finishes (brick, spanishTile, wood, strip) horizontal-only.
  // Keralit: read directly from the catalog row.
  const allowedOrientations = useMemo<Orientation[]>(() => {
    if (brand === "keralit") {
      return selectedKeralitProduct?.orientations ?? ["horizontal", "vertical"];
    }
    if (!selectedPanel) return ["horizontal", "vertical"];
    return selectedPanel.finish === "monoFlat" || selectedPanel.finish === "monoGroove"
      ? ["horizontal", "vertical"]
      : ["horizontal"];
  }, [brand, selectedKeralitProduct, selectedPanel]);

  // If the product changes and the current orientation is no longer allowed,
  // snap to the first allowed value.
  useEffect(() => {
    if (allowedOrientations.length > 0 && !allowedOrientations.includes(orientation)) {
      setOrientation(allowedOrientations[0]);
    }
  }, [allowedOrientations, orientation]);
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

  const openingsForPrompt = useMemo(
    () => ({
      windowFrame: windowMaterial ? WINDOW_MATERIAL_EN[windowMaterial] : undefined,
      doorMaterial: doorMaterial ? DOOR_MATERIAL_EN[doorMaterial] : undefined,
      doorColour: doorColour ? DOOR_COLOUR_EN[doorColour] : undefined,
    }),
    [windowMaterial, doorMaterial, doorColour]
  );

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

  // Hydrate from the cross-page project store: photo uploaded in
  // /gevelcalc lives in Supabase Storage, the path is in zustand.
  // Resolve a signed URL and feed it into photoOverride so the rest
  // of the rendering pipeline uses it as the source photo.
  useEffect(() => {
    const path = useProjectStore.getState().photoStoragePath;
    if (!path) return;
    getPhotoUrl(path).then((url) => {
      if (url) {
        setPhotoOverride(url);
        setSelectedSideId("");
        setErrorMsg("");
      }
    });
  }, []);

  // Pre-select the product chosen in /gevelcalc.
  useEffect(() => {
    const stored = useProjectStore.getState().selectedProduct;
    if (!stored) return;
    if (stored.supplier_slug === "keralit") {
      setBrand("keralit");
      setSelectedKeralitProductId(stored.id);
    } else if (stored.supplier_slug === "spanl") {
      // productCatalog.id is built as `spanl-${sku.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
      // so reversing is: strip prefix, uppercase. Holds for the current
      // panel catalog where every SKU is uppercase A–Z, digits, and hyphens.
      setBrand("spanl");
      const sku = stored.id.replace(/^spanl-/, "").toUpperCase();
      setSelectedSku(sku);
    }
  }, []);

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

      let productSku: string | undefined;
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
        productSku = selectedPanel.sku;
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
        productSku,
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
        includeBoeideel,
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
        prompt: "",
        dataUrl: renderDataUrl,
        createdAt: Date.now(),
      };
      setVariants((prev) => [variant, ...prev]);
      const key = await sha256(`${photoLarge}|${panelSkuForVariant}|${orientation}|${variant.id}`);
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
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_500px]">
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
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-stone-500">
              {locale === "nl" ? "Of kies een voorbeeldfoto" : "Or pick a sample photo"}
            </p>
            <div className="flex gap-2">
              {houseSamples.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSampleTab(sampleTab === "houses" ? null : "houses")}
                  className={`border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.15em] ${
                    sampleTab === "houses" ? "border-ink bg-ink text-paper" : "border-stone-200 bg-paper text-ink hover:bg-stone-50"
                  }`}
                >
                  {t("woningen")} ({houseSamples.length})
                </button>
              )}
              {woonbootSamples.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSampleTab(sampleTab === "woonboten" ? null : "woonboten")}
                  className={`border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.15em] ${
                    sampleTab === "woonboten" ? "border-ink bg-ink text-paper" : "border-stone-200 bg-paper text-ink hover:bg-stone-50"
                  }`}
                >
                  {t("woonboten")} ({woonbootSamples.length})
                </button>
              )}
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
                    className="w-full rounded-xl border border-black p-3 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400"
                    value={orientation}
                    onChange={(e) => setOrientation(e.target.value as Orientation)}
                    disabled={allowedOrientations.length <= 1}
                  >
                    <option value="horizontal" disabled={!allowedOrientations.includes("horizontal")}>
                      {t("render.horizontal")}
                    </option>
                    <option value="vertical" disabled={!allowedOrientations.includes("vertical")}>
                      {t("render.vertical")}
                    </option>
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
                className="w-full rounded-xl border border-black p-3 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400"
                value={orientation}
                onChange={(e) => setOrientation(e.target.value as Orientation)}
                disabled={allowedOrientations.length <= 1}
              >
                <option value="horizontal" disabled={!allowedOrientations.includes("horizontal")}>
                  {t("render.horizontal")}
                </option>
                <option value="vertical" disabled={!allowedOrientations.includes("vertical")}>
                  {t("render.vertical")}
                </option>
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
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-stone-600">
            04 — {t("boeideel_section_title")}
          </p>
          <p className="mb-4 text-xs text-stone-500">{t("boeideel_explanation")}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => setIncludeBoeideel(true)}
              aria-pressed={includeBoeideel}
              className={`flex-1 bg-paper px-4 py-3 text-left text-ink transition-colors ${
                includeBoeideel
                  ? "border-2 border-ink"
                  : "border border-stone-300 hover:border-stone-500"
              }`}
            >
              <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.15em]">
                {t("boeideel_include")}
              </p>
              <p className="text-[11px] leading-tight text-stone-500">
                {t("boeideel_include_hint")}
              </p>
            </button>
            <button
              type="button"
              onClick={() => setIncludeBoeideel(false)}
              aria-pressed={!includeBoeideel}
              className={`flex-1 bg-paper px-4 py-3 text-left text-ink transition-colors ${
                !includeBoeideel
                  ? "border-2 border-ink"
                  : "border border-stone-300 hover:border-stone-500"
              }`}
            >
              <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.15em]">
                {t("boeideel_exclude")}
              </p>
              <p className="text-[11px] leading-tight text-stone-500">
                {t("boeideel_exclude_hint")}
              </p>
            </button>
          </div>
        </section>

        </div>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
          <header>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-stone-500">
              05 — {t("render.section.renders")}
            </p>
          </header>

          {sourcePhoto && (
            <div>
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.15em] text-stone-500">
                {locale === "nl" ? "Origineel"
                  : locale === "de" ? "Original"
                  : locale === "fr" ? "Original"
                  : locale === "es" ? "Original"
                  : "Original"}
              </p>
              <img
                src={sourcePhoto}
                alt=""
                className="block w-full border border-stone-200 object-contain"
              />
            </div>
          )}

        <section>
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-stone-600">
              {t("render.section.renders")}
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
                {/* Fixed-size viewport so the zoom transform stays inside its
                    box (otherwise scaling pushes content outside the article
                    border and the user sees a white gap). centerOnInit fits
                    the image to the box on first paint; double-click resets. */}
                <div className="relative h-56 w-full overflow-hidden bg-stone-100">
                  <TransformWrapper
                    minScale={1}
                    maxScale={6}
                    initialScale={1}
                    centerOnInit
                    doubleClick={{ mode: "reset" }}
                    wheel={{ step: 0.15 }}
                    pinch={{ step: 5 }}
                    limitToBounds
                  >
                    <TransformComponent
                      wrapperStyle={{ width: "100%", height: "100%" }}
                      contentStyle={{ width: "100%", height: "100%" }}
                    >
                      <img
                        src={v.dataUrl}
                        alt={v.panelLabel}
                        className="h-full w-full object-contain"
                      />
                    </TransformComponent>
                  </TransformWrapper>
                </div>
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
        </aside>
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
