"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { type Orientation } from "@/lib/productCatalog";
import { loadSpanlImageIndex, type SpanlImageProduct } from "@/lib/spanlImageCatalog";
import { SPANL_PANELS, finishEn, type SpanlPanelEntry } from "@/lib/spanlPanelCatalog";
import { usePhotoStore } from "@/lib/usePhotoStore";
import { useLocale } from "@/lib/i18n";

const STORAGE_KEY = "renisual-gevelcalc-v1";

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
  orientation?: Orientation;
  projectName?: string;
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
  provider: "gemini" | "hf";
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
  "9006": { hex: "#A5A8A6", description: "white-aluminium silver, light metallic grey" },
  "9010": { hex: "#F1ECE1", description: "warm off-white" },
};

function describeColor(panel: RenderPanel): string {
  if (panel.ral && RAL_HEX[panel.ral]) {
    const { hex, description } = RAL_HEX[panel.ral];
    return `${panel.colorEn} — RAL ${panel.ral} (${description}, hex ${hex})`;
  }
  if (panel.ral) return `${panel.colorEn} (RAL ${panel.ral})`;
  return panel.colorEn;
}

function describeSeam(panel: RenderPanel): string {
  switch (panel.finish) {
    case "monoFlat":
      return "Seam style: very narrow hairline seam between panels — NOT a dark gap, NOT a black line. The seam is essentially the same colour as the panel itself, only slightly darker by a thin shadow on one side. Adjacent panels read as one continuous coloured surface with subtle dividers.";
    case "monoGroove":
      return "Seam style: a deep V-groove between panels. The groove sits a few millimeters back from the panel face and casts a clean shadow line, but its colour is still the panel colour — not pure black.";
    case "strip":
      return "Seam style: thin horizontal/vertical shadow lines between narrow planks. The seam is a fine soft shadow, never a black gap; the planks themselves remain the panel colour edge-to-edge.";
    case "brick":
      return "Seam style: thin mortar line between individual bricks — light grey mortar, NOT dark. Each brick keeps its full colour and surface texture.";
    case "spanishTile":
      return "Seam style: 3D tile overlap — each curved tile partially covers the next. Shadows fall under each tile lip, but no pure-black gaps.";
    case "wood":
      return "Seam style: tongue-and-groove plank seam, soft shadow line between planks; never a dark gap.";
    default:
      return "";
  }
}

function buildDefaultPrompt(
  panel: RenderPanel | undefined,
  orientation: Orientation,
  refCount: number,
  facade?: { widthCm?: number; heightCm?: number }
): string {
  if (!panel) return "";
  const colorDesc = describeColor(panel);
  const seamStyle = describeSeam(panel);
  const isVertical = orientation === "vertical";

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
    `TASK: remove the existing facade material on the main building (whatever it is — brick, plaster, render, paint, stone, weatherboard, siding) and replace it with Spanl panel ${panel.sku}. Finish/profile: ${finishEn(panel.finish)}. Each panel has a visible width of ${panel.panelWidthCm} cm.`,
    `COLOUR (CRITICAL): ${colorDesc}. The cladding colour MUST exactly match this RAL value. Do NOT lighten the colour. Do NOT desaturate to white or pale grey. Reference photos may have been shot under bright studio lighting that makes them look paler — sample the underlying tone, not the highlights. The final wall must read as the stated colour at midday daylight.`,
    seamStyle,
    orientationBlock,
    seamCountLine,
    refLine,
    "TEXTURE: surface must NOT be a flat uniform colour — render each panel with its seam, plank rhythm and surface structure matching the finish (deep groove / narrow strip / brick face / Spanish-tile relief / wood grain).",
    "PRESERVE EXACTLY (do NOT change): windows, window frames, doors, door frames, gutters, roof edges, downspouts, glazing, sky, plants, street, vehicles, camera angle, perspective, lighting direction and shadows.",
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
  const [provider, setProvider] = useState<"gemini" | "hf">("gemini");

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

  const defaultPrompt = useMemo(
    () => buildDefaultPrompt(selectedPanel, orientation, refCount, facadeDims),
    [selectedPanel, orientation, refCount, facadeDims]
  );
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
      const ids = (parsed.sides ?? []).map((s) => s.id);
      if (ids.length === 0) return;
      loadAllPhotos(ids)
        .then((map) => {
          setSavedPhotos(map);
          const firstWithPhoto = ids.find((id) => map[id]);
          if (firstWithPhoto) setSelectedSideId(firstWithPhoto);
        })
        .catch(() => {});
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
    if (!sourcePhoto || !selectedPanel) return;
    setIsGenerating(true);
    setErrorMsg("");
    try {
      const refUrls: string[] = [];
      if (selectedPanel.imageUrl) {
        const main = await urlToDataUrl(selectedPanel.imageUrl);
        if (main) refUrls.push(await compressDataUrl(main, 1024, 0.82));
      }
      if (selectedPanel.variantUrl) {
        const variant = await urlToDataUrl(selectedPanel.variantUrl);
        if (variant) refUrls.push(await compressDataUrl(variant, 1024, 0.82));
      }
      const photoForApi = await compressDataUrl(sourcePhoto, 1600, 0.85);
      const ralPart = selectedPanel.ral ? ` (RAL ${selectedPanel.ral})` : "";
      const productLabel = `Spanl ${selectedPanel.sku} — ${selectedPanel.colorEn}${ralPart}, ${finishEn(selectedPanel.finish)}`;
      const endpoint = provider === "hf" ? "/api/render-hf" : "/api/render";
      const payload = provider === "hf"
        ? {
            photoDataUrl: photoForApi,
            prompt: effectivePrompt,
            strength: 0.82,
          }
        : {
            photoDataUrl: photoForApi,
            referenceDataUrls: refUrls,
            productLabel,
            productDescription: `Color: ${selectedPanel.colorEn}${ralPart}. Finish: ${finishEn(selectedPanel.finish)}. Visible panel width: ${selectedPanel.panelWidthCm} cm.`,
            orientation,
            panelWidthCm: selectedPanel.panelWidthCm,
            facadeWidthCm: facadeDims?.widthCm,
            facadeHeightCm: facadeDims?.heightCm,
            prompt: effectivePrompt || undefined,
            locale,
          };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { renderDataUrl?: string; error?: string };
      if (!res.ok || !json.renderDataUrl) {
        setErrorMsg(json.error ?? t("render.error.failed"));
        return;
      }
      const variant: RenderVariant = {
        id: crypto.randomUUID(),
        panelLabel: productLabel,
        panelSku: selectedPanel.sku,
        orientation,
        prompt: effectivePrompt,
        dataUrl: json.renderDataUrl,
        createdAt: Date.now(),
        provider,
      };
      setVariants((prev) => [variant, ...prev]);
      const key = await sha256(`${photoForApi}|${selectedPanel.sku}|${orientation}|${effectivePrompt}|${variant.id}`);
      await saveRender(key, json.renderDataUrl).catch(() => {});
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
    <main className="min-h-screen bg-[#f6f4ef] p-4 pb-28 text-black md:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-black bg-white p-6">
          <div>
            <h1 className="text-2xl font-bold">{t("render.title")}</h1>
            {savedConfig?.projectName ? (
              <p className="mt-1 text-sm text-gray-500">{savedConfig.projectName}</p>
            ) : (
              <p className="mt-1 text-sm text-gray-500">{t("render.subtitleStandalone")}</p>
            )}
          </div>
          <Link href="/gevelcalc" className="rounded-xl border border-black px-4 py-2 text-sm">
            {t("nav.toCalc")}
          </Link>
        </section>

        <section className="rounded-2xl border border-black bg-white p-4">
          <h2 className="text-lg font-semibold">{t("render.section.photo")}</h2>

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
            className="mt-3 rounded-2xl border-2 border-dashed border-black p-4 text-center"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleUpload(e.dataTransfer.files?.[0] ?? null);
            }}
          >
            <label className="inline-flex cursor-pointer flex-col items-center gap-2">
              <span className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white">
                {photoOverride ? t("render.changePhoto") : t("render.uploadOwn")}
              </span>
              <span className="text-xs text-gray-400">{t("render.dropOrDrag")}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleUpload(e.target.files?.[0] ?? null)}
              />
            </label>
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

        <section className="rounded-2xl border border-black bg-white p-4">
          <h2 className="text-lg font-semibold">{t("render.section.panel")}</h2>

          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">{t("render.spanlPanel")}</label>
              <select
                className="w-full rounded-xl border border-black p-3"
                value={selectedSku}
                onChange={(e) => setSelectedSku(e.target.value)}
              >
                <option value="">{t("render.choosePanel")}</option>
                {panels.map((p) => {
                  const ral = p.ral ? ` (RAL ${p.ral})` : "";
                  const noRef = !p.imageUrl ? ` — ${t("render.noReference")}` : "";
                  return (
                    <option key={p.sku} value={p.sku}>
                      {p.sku} — {t(p.colorKey)}{ral}, {t(`finish.${p.finish}`)}{noRef}
                    </option>
                  );
                })}
              </select>
              {panels.every((p) => !p.imageUrl) && (
                <p className="mt-1 text-xs text-amber-700">
                  {t("render.panelIndexHint", {
                    cmd: "node scripts/build-spanl-index.js",
                  })}
                </p>
              )}
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

          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium">Render engine</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setProvider("gemini")}
                className={`rounded-xl border px-4 py-2 text-sm ${
                  provider === "gemini" ? "border-black bg-black text-white" : "border-black bg-white"
                }`}
              >
                Gemini
              </button>
              <button
                type="button"
                onClick={() => setProvider("hf")}
                className={`rounded-xl border px-4 py-2 text-sm ${
                  provider === "hf" ? "border-black bg-black text-white" : "border-black bg-white"
                }`}
              >
                Hugging Face (test)
              </button>
            </div>
            {provider === "hf" && (
              <p className="mt-1 text-xs text-amber-700">
                Experimenteel: img2img zonder mask via HF inference (instruct-pix2pix). Cold start kan 30-60 s duren. Geen
                referentiebeeld, alleen tekst-prompt.
              </p>
            )}
          </div>

          {selectedPanel && (
            <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-black p-4">
              {selectedPanel.imageUrl ? (
                <img
                  src={selectedPanel.imageUrl}
                  alt={selectedPanel.sku}
                  className="h-28 w-36 rounded-xl object-cover"
                />
              ) : (
                <div className="flex h-28 w-36 items-center justify-center rounded-xl border border-dashed border-black text-center text-[10px] text-gray-500">
                  {t("render.noReference")}
                </div>
              )}
              <div className="text-sm">
                <div className="font-semibold">
                  {t(selectedPanel.colorKey)}
                  {selectedPanel.ral ? ` (RAL ${selectedPanel.ral})` : ""}
                </div>
                <p className="mt-1 text-gray-500">
                  {t(`finish.${selectedPanel.finish}`)} · {selectedPanel.panelWidthCm} cm ·{" "}
                  {orientation === "horizontal"
                    ? t("render.horizontal").toLowerCase()
                    : t("render.vertical").toLowerCase()}
                </p>
                <p className="mt-1 text-xs text-gray-400">Spanl {selectedPanel.sku}</p>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-black bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">{t("render.section.prompt")}</h2>
            {promptTouched && (
              <button type="button" onClick={resetPrompt} className="text-xs underline">
                {t("render.promptReset")}
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-gray-500">{t("render.promptHint")}</p>
          <textarea
            value={effectivePrompt}
            onChange={(e) => {
              setPromptTouched(true);
              setCustomPrompt(e.target.value);
            }}
            rows={6}
            placeholder={defaultPrompt || t("render.promptPlaceholder")}
            className="mt-3 w-full rounded-xl border border-black p-3 font-mono text-xs"
          />
        </section>

        <section className="rounded-2xl border border-black bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">{t("render.section.renders")}</h2>
            {variants.length > 0 && (
              <span className="text-xs text-gray-500">
                {variants.length === 1
                  ? t("render.variantsOne", { count: variants.length })
                  : t("render.variantsMany", { count: variants.length })}
              </span>
            )}
          </div>

          {isGenerating && (
            <div className="mt-3 flex aspect-[16/10] w-full items-center justify-center rounded-xl border border-black bg-neutral-100 text-sm font-medium">
              {t("render.generating")}
            </div>
          )}

          {!isGenerating && variants.length === 0 && (
            <p className="mt-3 text-sm text-gray-500">{t("render.empty")}</p>
          )}

          <div className="mt-4 space-y-4">
            {variants.map((v) => (
              <article key={v.id} className="overflow-hidden rounded-xl border border-black">
                <img src={v.dataUrl} alt={v.panelLabel} className="block w-full" />
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-black p-3 text-xs">
                  <div>
                    <span className="mr-2 rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] uppercase">
                      {v.provider}
                    </span>
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

          {errorMsg && <p className="mt-3 text-sm text-red-700">{errorMsg}</p>}
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-black bg-white p-3">
        <div className="mx-auto flex max-w-5xl items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating || !selectedPanel || !sourcePhoto}
            className="rounded-xl bg-black px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40"
          >
            {variants.length > 0 ? t("render.btnAddVariant") : t("render.btnGenerate")}
          </button>
        </div>
      </div>
    </main>
  );
}
