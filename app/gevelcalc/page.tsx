"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { products, categoryForType, type Orientation, type ProductCategory } from "@/lib/productCatalog";
import type { SpanlFinish } from "@/lib/spanlPanelCatalog";
import { useSpanlImage } from "@/lib/spanlImageCatalog";
import {
  KERALIT_COLORS,
  KERALIT_FINISH_LABEL_NL,
  type KeralitFinish,
  type KeralitColor,
} from "@/lib/keralitColorCatalog";
import {
  type CalcSide,
  type OpeningType,
  type OpeningGroup,
  calculateMaterialResult,
  calculateSideGrossM2,
  calculateSideOpeningsM2,
  calculateSideNetM2,
  round2,
  toNumber,
  DEFAULT_SPANL_PROFILES,
} from "@/lib/calcEngine";
import { usePhotoStore } from "@/lib/usePhotoStore";
import { useLocale, type Locale } from "@/lib/i18n";
import { useProjectStore } from "@/lib/projectStore";
import { uploadPhoto, UploadError } from "@/lib/photoStorage";
import DynamicMetadata from "@/components/DynamicMetadata";
import SiteNav from "@/components/SiteNav";
import PhotoUploader from "@/components/PhotoUploader";

// Permissive accept hint so Android/iOS pickers offer Camera + Gallery +
// Files. Real type/size validation happens in lib/photoStorage.ts after
// the user picks; the bucket policy rejects non-images server-side too.
const PHOTO_ACCEPT = "image/*";

const MAX_SIDES = 10;
const STORAGE_KEY = "renisual-gevelcalc-v1";

const QUICK_WINDOW_M2 = 1.5;
const QUICK_DOOR_M2 = 2.0;
const M2_TO_FT2 = 10.7639;
const QUICK_SIDE_ID = "quick-side";

// Display order for Spanl finish families in the product picker, sorted by
// panel width (widest first). Within a family all panels share the same
// width, so the visible secondary sort is by SKU.
//   monoFlat 37 → monoGroove 37 → wood 32 → spanishTile 30 → strip 25 → brick 21
const SPANL_FAMILY_ORDER: SpanlFinish[] = [
  "monoFlat",
  "monoGroove",
  "wood",
  "spanishTile",
  "strip",
  "brick",
];

type Mode = "quick" | "advanced";
type Unit = "m2" | "ft2";
type DisplayMode = "foto" | "tekst";

function defaultDisplayModeFor(_mode: Mode): DisplayMode {
  // Foto is the default for both modes — renisual is visual-first and
  // most users recognise panels by their finish image, not by SKU code.
  return "foto";
}

function sideKeyForIndex(i: number): string {
  return ["gc.side.front", "gc.side.back", "gc.side.left", "gc.side.right"][i] ?? "gc.side.numbered";
}

// Defaults across all locales + the raw i18n keys themselves. Used by the
// locale-rewrite effect to detect "this side name is a default that should
// be re-translated" vs "the user typed a custom name we must preserve".
const SIDE_DEFAULTS: ReadonlySet<string> = new Set([
  // raw keys (leak when initial useState runs before t() is ready)
  "gc.side.front", "gc.side.back", "gc.side.left", "gc.side.right",
  // nl
  "Voorzijde", "Achterzijde", "Linkerzijde", "Rechterzijde",
  // en
  "Front", "Back", "Left", "Right",
  // de
  "Vorderseite", "Rückseite", "Linke Seite", "Rechte Seite",
  // fr
  "Façade avant", "Façade arrière", "Côté gauche", "Côté droit",
  // es
  "Frente", "Trasera", "Lado izquierdo", "Lado derecho",
]);

function createOpening(type: OpeningType, t: (k: string, p?: Record<string, string | number>) => string): OpeningGroup {
  return {
    id: crypto.randomUUID(),
    type,
    label: t(`gc.opening.${type}`),
    width: "",
    height: "",
    count: "1",
  };
}

function createSide(index: number, t: (k: string, p?: Record<string, string | number>) => string): CalcSide {
  const key = sideKeyForIndex(index);
  return {
    id: crypto.randomUUID(),
    name: key === "gc.side.numbered" ? t(key, { n: index + 1 }) : t(key),
    width: "",
    height: "",
    openings: [],
  };
}

function createDefaultSides(t: (k: string, p?: Record<string, string | number>) => string): CalcSide[] {
  return [createSide(0, t), createSide(1, t), createSide(2, t), createSide(3, t)];
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("read failed"));
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

const BRAND_ORDER = [
  "Spanl",
  "Keralit",
  "Novicell",
  "VinyPlus",
  "Deceuninck",
  "Kömmerling",
  "Schüco",
  "Generic",
];

function sortedBrandNames(brands: string[]): string[] {
  const score = (b: string) => {
    const i = BRAND_ORDER.indexOf(b);
    return i === -1 ? BRAND_ORDER.length : i;
  };
  return [...brands].sort((a, b) => score(a) - score(b) || a.localeCompare(b));
}

function localeToDateLocale(locale: Locale): string {
  return locale === "nl" ? "nl-NL" : locale === "de" ? "de-DE" : locale === "fr" ? "fr-FR" : locale === "es" ? "es-ES" : "en-GB";
}

function formatDate(iso: string, locale: Locale) {
  return new Date(iso).toLocaleString(localeToDateLocale(locale), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function defaultUnitFor(locale: Locale): Unit {
  return locale === "en" ? "ft2" : "m2";
}

function quickAreaToM2(value: string, unit: Unit): number {
  const v = toNumber(value);
  return unit === "ft2" ? v / M2_TO_FT2 : v;
}

function m2ToUnit(m2: number, unit: Unit): number {
  return unit === "ft2" ? m2 * M2_TO_FT2 : m2;
}

function buildQuickSide(
  totalAreaM2: number,
  windowCount: number,
  doorCount: number,
  name: string
): CalcSide {
  const sideCm = totalAreaM2 > 0 ? Math.round(Math.sqrt(totalAreaM2) * 100) : 0;
  const openings: OpeningGroup[] = [];
  if (windowCount > 0) {
    openings.push({
      id: "quick-window",
      type: "window",
      label: "windows",
      width: "150",
      height: "100",
      count: String(windowCount),
    });
  }
  if (doorCount > 0) {
    openings.push({
      id: "quick-door",
      type: "door",
      label: "doors",
      width: "100",
      height: "200",
      count: String(doorCount),
    });
  }
  return {
    id: QUICK_SIDE_ID,
    name,
    width: String(sideCm),
    height: String(sideCm),
    openings,
  };
}

function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-xl border border-black bg-white px-4 py-3 text-left"
    >
      <span className="text-sm font-medium">{label}</span>
      <span className={`relative h-6 w-11 rounded-full border border-black transition-colors ${checked ? "bg-black" : "bg-white"}`}>
        <span className={`absolute top-1 h-4 w-4 rounded-full transition-all ${checked ? "left-6 bg-white" : "left-1 bg-black"}`} />
      </span>
    </button>
  );
}

function ModusToggle({
  value,
  onChange,
  quickLabel,
  advancedLabel,
}: {
  value: Mode;
  onChange: (next: Mode) => void;
  quickLabel: string;
  advancedLabel: string;
}) {
  // Segmented pill: full width on mobile, max-w-md on desktop.
  // Min 44px tap target. Active = ink fill, inactive = transparent w/ hairline.
  return (
    <div
      role="tablist"
      aria-label="Modus"
      className="mt-5 flex w-full max-w-md items-stretch gap-0 overflow-hidden rounded-full border border-stone-300 bg-paper"
    >
      {([
        { id: "quick" as Mode, label: quickLabel },
        { id: "advanced" as Mode, label: advancedLabel },
      ]).map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.id)}
            className={`flex-1 min-h-[44px] px-4 font-mono text-[11px] uppercase tracking-[0.15em] transition-colors ${
              active ? "bg-ink text-paper" : "bg-transparent text-ink hover:bg-stone-100"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function InputWithSuffix({
  value,
  onChange,
  placeholder,
  suffix,
  disabled,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  suffix?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className="relative">
      <input
        className={`w-full rounded-xl border border-black p-3 pr-14 disabled:bg-neutral-100 ${className ?? ""}`}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none select-none print:hidden">
          {suffix}
        </span>
      )}
    </div>
  );
}

function SpanlThumb({
  productId,
  productName,
  compact = false,
}: {
  productId: string;
  productName: string;
  compact?: boolean;
}) {
  const sku = productId.replace(/^spanl-/, "");
  const src = useSpanlImage(sku, productName);
  if (!src) return null;
  return (
    <img
      src={src}
      alt={productName}
      className={
        compact
          ? "block h-12 w-12 shrink-0 rounded-md border border-black object-cover"
          : "block aspect-[4/3] w-32 shrink-0 rounded-xl border border-black object-cover sm:w-40"
      }
    />
  );
}

function KeralitThumb({
  productName,
  selectedNumber,
  compact = false,
}: {
  productName: string;
  selectedNumber: number | null;
  compact?: boolean;
}) {
  // Prefer the user's currently picked colour; otherwise show a representative
  // sample so the product card doesn't look empty before they pick a colour.
  const color =
    (selectedNumber != null
      ? KERALIT_COLORS.find((c) => c.number === selectedNumber)
      : null) ?? KERALIT_COLORS[0];
  if (!color) return null;
  return (
    <img
      src={color.thumbnailUrl}
      alt={`${productName} — ${color.name}`}
      loading="lazy"
      className={
        compact
          ? "block h-12 w-12 shrink-0 rounded-md border border-black object-cover"
          : "block aspect-[4/3] w-32 shrink-0 rounded-xl border border-black object-cover sm:w-40"
      }
    />
  );
}

function KeralitColorPicker({
  selectedNumber,
  onSelect,
}: {
  selectedNumber: number | null;
  onSelect: (n: number) => void;
}) {
  const finishes = Array.from(new Set(KERALIT_COLORS.map((c) => c.finish))) as KeralitFinish[];
  const [activeFinish, setActiveFinish] = useState<KeralitFinish>(finishes[0]);
  const colorsForFinish = KERALIT_COLORS.filter((c) => c.finish === activeFinish);
  const selected = selectedNumber != null ? KERALIT_COLORS.find((c) => c.number === selectedNumber) : null;

  return (
    <div className="mt-4 rounded-xl border border-black p-4 print-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Keralit kleur</h3>
        {selected && (
          <span className="text-xs text-gray-600">
            {selected.name} · {selected.number} · {KERALIT_FINISH_LABEL_NL[selected.finish]}
          </span>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {finishes.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setActiveFinish(f)}
            className={`rounded-lg border px-3 py-1 text-xs ${
              activeFinish === f ? "border-black bg-black text-white" : "border-black bg-white"
            }`}
          >
            {KERALIT_FINISH_LABEL_NL[f]}
          </button>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
        {colorsForFinish.map((c) => (
          <button
            key={c.number}
            type="button"
            onClick={() => onSelect(c.number)}
            title={`${c.name} (${c.number})`}
            className={`group flex flex-col items-center gap-1 rounded-lg border p-1 ${
              selectedNumber === c.number ? "border-black ring-2 ring-black" : "border-neutral-300"
            }`}
          >
            <img
              src={c.thumbnailUrl}
              alt={c.name}
              loading="lazy"
              className="h-12 w-full rounded object-cover"
            />
            <span className="truncate text-[10px] leading-tight">{c.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function RenderingPanel({
  selectedProduct,
  keralitColorNumber,
  emptyText,
  emptyHint,
  selectedLabel,
  ctaTitle,
  ctaBody,
  ctaButton,
}: {
  selectedProduct: (typeof products)[number] | undefined;
  keralitColorNumber: number | null;
  emptyText: string;
  emptyHint: string;
  selectedLabel: string;
  ctaTitle: string;
  ctaBody: string;
  ctaButton: string;
}) {
  const { t } = useLocale();
  const includeBoeideel = useProjectStore((s) => s.includeBoeideel);
  const setIncludeBoeideel = useProjectStore((s) => s.setIncludeBoeideel);
  const isSpanl = selectedProduct?.brand === "Spanl";
  const spanlSku = isSpanl ? selectedProduct!.id.replace(/^spanl-/, "") : "";
  const spanlName = isSpanl ? selectedProduct!.name : "";
  const spanlSrc = useSpanlImage(spanlSku, spanlName);

  let src: string | null = null;
  let alt = "";
  let skuLine = "";
  if (isSpanl) {
    src = spanlSrc;
    alt = spanlName;
    skuLine = spanlSku.toUpperCase();
  } else if (selectedProduct?.brand === "Keralit") {
    const color =
      (keralitColorNumber != null
        ? KERALIT_COLORS.find((c) => c.number === keralitColorNumber)
        : null) ?? KERALIT_COLORS[0];
    src = color?.thumbnailUrl ?? null;
    alt = `${selectedProduct.name} — ${color?.name ?? ""}`;
    skuLine = color ? `${selectedProduct.brand} · ${color.name}` : selectedProduct.brand;
  }

  // When a product is selected we render at content-height (no h-full,
  // no stone-50 background): the aside collapses around the compact card
  // instead of stretching a tinted box across the full viewport. The
  // empty state still uses the full panel — that's where stretched space
  // is actually wanted (it acts as a placeholder canvas).
  const hasSelection = !!(src && selectedProduct);
  return (
    <div
      className={
        hasSelection
          ? "print-hidden"
          : "relative h-full min-h-[40vh] overflow-y-auto bg-stone-50 lg:min-h-0 print-hidden"
      }
    >
      {hasSelection && selectedProduct ? (
        <div className="mx-auto flex w-full max-w-md flex-col gap-8 px-6 py-12">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-stone-500">
              {selectedLabel}
            </p>
            <div className="mt-3 aspect-square overflow-hidden border border-stone-200 bg-paper">
              <img src={src ?? ""} alt={alt} className="h-full w-full object-contain p-4" />
            </div>
            <p className="mt-3 font-display text-lg leading-tight text-ink">
              {selectedProduct.name}
            </p>
            {skuLine && (
              <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-stone-500">
                {skuLine}
              </p>
            )}
          </div>

          <div className="border-t border-stone-200 pt-6">
            <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-stone-500">
              {t("boeideel_section_title")}
            </p>
            <p className="mb-4 text-xs leading-relaxed text-stone-600">
              {t("boeideel_explanation")}
            </p>
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
          </div>

          <div className="border-t border-stone-200 pt-6">
            <p className="font-display text-base text-ink">{ctaTitle}</p>
            <p className="mt-2 text-sm leading-relaxed text-stone-600">{ctaBody}</p>
            <Link
              href={`/render?product=${encodeURIComponent(selectedProduct.id)}`}
              className="mt-5 inline-flex items-center gap-2 bg-ink px-7 py-3 font-mono text-[11px] uppercase tracking-[0.15em] text-paper transition-colors hover:bg-stone-800"
            >
              <span>{ctaButton}</span>
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-stone-600">
            VISUALISATIE
          </p>
          <p className="font-display text-xl italic leading-snug text-ink">
            {emptyText}
          </p>
          <p className="max-w-xs text-xs leading-relaxed text-stone-500">
            {emptyHint}
          </p>
        </div>
      )}
    </div>
  );
}

// Brands whose catalogue ships a reference image. When `displayMode` is
// "foto" but the product is from a brand without a thumbnail, the renderer
// falls back to ProductRow (text) rather than showing a broken/empty image.
function productHasReferenceImage(product: (typeof products)[number]): boolean {
  return product.brand === "Spanl" || product.brand === "Keralit";
}

function productCode(product: (typeof products)[number]): string {
  if (product.brand === "Spanl") return product.id.replace(/^spanl-/, "").toUpperCase();
  return product.id;
}

function ProductCard({
  product,
  selected,
  onSelect,
}: {
  product: (typeof products)[number];
  selected: boolean;
  onSelect: () => void;
}) {
  const isSpanl = product.brand === "Spanl";
  const spanlSku = isSpanl ? product.id.replace(/^spanl-/, "") : "";
  const spanlSrc = useSpanlImage(spanlSku, product.name);
  const code = productCode(product);
  const altText = `${code} — ${product.name}`;

  let thumb: React.ReactNode;
  if (isSpanl && spanlSrc) {
    thumb = (
      <img
        src={spanlSrc}
        alt={altText}
        loading="lazy"
        className="block aspect-[4/3] w-full object-cover"
      />
    );
  } else if (product.brand === "Keralit") {
    const ref = KERALIT_COLORS[0];
    thumb = ref ? (
      <img
        src={ref.thumbnailUrl}
        alt={altText}
        loading="lazy"
        className="block aspect-[4/3] w-full object-cover"
      />
    ) : (
      <div className="flex aspect-[4/3] w-full items-center justify-center bg-stone-100 text-[10px] uppercase tracking-[0.15em] text-stone-400">
        Keralit
      </div>
    );
  } else {
    thumb = (
      <div className="flex aspect-[4/3] w-full items-center justify-center bg-stone-100 font-mono text-[10px] uppercase tracking-[0.15em] text-stone-500">
        {product.brand}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      title={`${code} — ${product.name}`}
      className={`group block overflow-hidden border text-left transition ${
        selected
          ? "border-ink ring-1 ring-ink"
          : "border-stone-200 hover:border-stone-400"
      }`}
    >
      {thumb}
      <div className="border-t border-stone-200 p-2">
        <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-stone-500">
          {code}
        </p>
        <p className="mt-0.5 truncate text-xs font-medium text-ink">{product.name}</p>
      </div>
    </button>
  );
}

function ProductRow({
  product,
  selected,
  onSelect,
}: {
  product: (typeof products)[number];
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      title={`${product.brand} — ${product.name}`}
      className={`block w-full border p-3 text-left transition ${
        selected
          ? "border-ink ring-1 ring-ink"
          : "border-stone-200 hover:border-stone-400"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-stone-500">
            {product.brand}
          </p>
          <p className="mt-0.5 truncate text-sm font-medium text-ink">{product.name}</p>
        </div>
        <p className="whitespace-nowrap font-mono text-[11px] text-stone-600">
          €{product.pricePerM2ExVat.toFixed(2)}/m²
        </p>
      </div>
      {product.description && (
        <p className="mt-1 text-xs leading-relaxed text-stone-500">{product.description}</p>
      )}
    </button>
  );
}

function Toast({
  message,
  type,
  onDismiss,
}: {
  message: string;
  type: "ok" | "error";
  onDismiss?: () => void;
}) {
  return (
    <div
      role={type === "error" ? "alert" : "status"}
      className={`fixed top-4 right-4 z-50 flex max-w-md items-start gap-2 rounded-xl border px-4 py-3 text-sm font-medium shadow-md print:hidden ${
        type === "ok" ? "border-green-300 bg-green-50 text-green-800" : "border-red-300 bg-red-50 text-red-800"
      }`}
    >
      <span className="flex-1 whitespace-pre-line break-words">{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Sluiten"
          className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-base leading-none opacity-70 hover:opacity-100"
        >
          ×
        </button>
      )}
    </div>
  );
}

export default function GevelCalcPage() {
  const { t, locale } = useLocale();

  // Default to "snel" when query is absent (per modus-toggle spec).
  const [mode, setMode] = useState<Mode>("quick");
  const [modeHydrated, setModeHydrated] = useState(false);

  // Auto-generate a project number on first mount when the field is
  // empty — gives the user a sensible default they can edit, and
  // doubles as the slug feeding the offerte PDF filename. Format:
  // P-YYYY-MM-DD-AB12 (4 random hex chars suffix to keep it unique
  // across same-day offertes from one client).
  useEffect(() => {
    if (projectName) return;
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const suffix = Math.floor(Math.random() * 0xffff)
      .toString(16)
      .toUpperCase()
      .padStart(4, "0");
    setProjectName(`P-${yyyy}-${mm}-${dd}-${suffix}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hydrate the product picker from the cross-page project store so a
  // user landing here from /render's "Bereken materiaal" arrives with
  // their chosen panel already selected AND the picker collapsed so
  // the compact "Geselecteerd product" chip is the first thing on the
  // page. Subscribe via the hook (not getState) so a late zustand
  // persist hydration still triggers — same gotcha as renderStoragePath
  // below. The `productHydrated` guard makes this run once.
  const storedProductSubscribed = useProjectStore((s) => s.selectedProduct);
  const [productHydrated, setProductHydrated] = useState(false);
  useEffect(() => {
    if (productHydrated) return;
    if (!storedProductSubscribed) return;
    if (!products.find((p) => p.id === storedProductSubscribed.id)) return;
    setSelectedProductId(storedProductSubscribed.id);
    setShowProductPicker(false);
    setProductHydrated(true);
  }, [storedProductSubscribed, products, productHydrated]);

  // Resolve the render-storage path from the project store into a
  // signed URL so the right-column overview can preview the AI-render
  // the offerte PDF will embed. Best-effort — if the URL fetch fails
  // the preview just doesn't appear; the calc + offerte still work.
  //
  // IMPORTANT: subscribe via the hook (not getState) so we re-run after
  // zustand's persist middleware hydrates from localStorage. With a
  // one-shot useEffect([]) the path is still null on first render and
  // the preview never loads — the bug that caused the carry-over to
  // appear "broken" even though /render did upload + setRender(path).
  const renderStoragePathSubscribed = useProjectStore((s) => s.renderStoragePath);
  useEffect(() => {
    if (!renderStoragePathSubscribed) return;
    let cancelled = false;
    import("@/lib/photoStorage").then(({ getPhotoUrl }) => {
      getPhotoUrl(renderStoragePathSubscribed, "offerte-renders").then((url) => {
        if (!cancelled && url) setRenderPreviewUrl(url);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [renderStoragePathSubscribed]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let resolved: Mode | null = null;
    const params = new URLSearchParams(window.location.search);
    const modus = params.get("modus");
    // Accept new (snel / per-zijde) plus legacy (quick / pro / advanced /
    // eenvoudig) so old links keep working.
    if (modus === "snel" || modus === "quick" || modus === "eenvoudig") resolved = "quick";
    else if (modus === "per-zijde" || modus === "pro" || modus === "professional" || modus === "advanced") resolved = "advanced";
    if (!resolved) {
      const stored = window.localStorage.getItem("renisual-mode");
      if (stored === "quick" || stored === "advanced") resolved = stored;
    }
    setMode(resolved ?? "quick");
    setModeHydrated(true);
  }, []);

  useEffect(() => {
    if (!modeHydrated) return;
    try {
      window.localStorage.setItem("renisual-mode", mode);
    } catch {
      /* ignore */
    }
    // Mirror current mode into ?modus= so the URL is shareable and
    // mobile/desktop behave identically. Use replaceState — no reload,
    // no new history entry.
    if (typeof window !== "undefined") {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set("modus", mode === "quick" ? "snel" : "per-zijde");
        window.history.replaceState({}, "", url.toString());
      } catch {
        /* ignore */
      }
    }
  }, [mode, modeHydrated]);

  // Restore the full calc form from sessionStorage on mount. Pairs
  // with the auto-save effect below that keeps sessionStorage current
  // on every form change — together they survive any navigation away
  // (SiteNav links, hamburger sheet, browser back from /render).
  // Run once after `mode` settles so the URL ?modus= can't re-overwrite
  // the restored mode.
  const [calcRestored, setCalcRestored] = useState(false);
  useEffect(() => {
    if (!modeHydrated || calcRestored) return;
    setCalcRestored(true);
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.sides)) {
        restoreFromData(data);
      }
    } catch {
      /* ignore — corrupt payload, treat as fresh start */
    }
  }, [modeHydrated, calcRestored]);

  // Display preference for the product picker: "foto" shows reference
  // images, "tekst" shows a text-only list. Session-only — re-derived
  // from `mode` whenever the mode changes (and on first hydration).
  const [displayMode, setDisplayMode] = useState<DisplayMode>(() => defaultDisplayModeFor("advanced"));
  useEffect(() => {
    setDisplayMode(defaultDisplayModeFor(mode));
  }, [mode]);
  const [unit, setUnit] = useState<Unit>("m2");
  const [unitTouched, setUnitTouched] = useState(false);

  const [quickTotalArea, setQuickTotalArea] = useState("");
  const [quickWindowCount, setQuickWindowCount] = useState("0");
  const [quickDoorCount, setQuickDoorCount] = useState("0");

  const [sides, setSides] = useState<CalcSide[]>(() => createDefaultSides((k, p) => k));
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [frontBackSame, setFrontBackSame] = useState(false);
  const [leftRightSame, setLeftRightSame] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [keralitColorNumber, setKeralitColorNumber] = useState<number | null>(null);
  const [productCategory, setProductCategory] = useState<ProductCategory>("gevelbekleding");
  const [orientation, setOrientation] = useState<Orientation>("horizontal");
  const [showAlternateOrientation, setShowAlternateOrientation] = useState(false);
  // Number of inside corners (binnenhoeken) — L-shape, U-shape, or
  // gevel-uitbouw. Default 0 since most rectangular houses have none.
  // Stored as string so the input field accepts "" while editing;
  // calc engine coerces with toNumber().
  const [insideCornerCount, setInsideCornerCount] = useState<string>("0");
  // Collapse the long product-picker section once a product is selected
  // (typically carried over from /render). The user can still expand
  // via "Paneel wijzigen" if they want to switch panels here.
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [showInclVat, setShowInclVat] = useState(false);
  // projectName is now the auto-generated project number (e.g.
  // P-2026-05-06-A3B4). Kept under the old key for storage compat.
  const [projectName, setProjectName] = useState("");
  // Customer fields — destination for the offerte.
  const [customerLastName, setCustomerLastName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  // Postcode + huisnummer drive the optional autofill helper above the
  // free-text address field. They're kept in local state (not persisted
  // to sessionStorage / offerte payload) — the canonical address that
  // ships with the offerte stays `customerAddress`, which the user can
  // edit after autofill (e.g., to add an appartement-nummer).
  const [postcode, setPostcode] = useState("");
  const [huisnummer, setHuisnummer] = useState("");
  const [addressLookupState, setAddressLookupState] = useState<
    "idle" | "loading" | "ok" | "notfound" | "error"
  >("idle");
  const [calcDate, setCalcDate] = useState<string>("");
  const [toast, setToast] = useState<{ message: string; type: "ok" | "error" } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // Side id whose upload produced the current uploadError, so the error
  // banner + retry button only appear next to the box that actually failed.
  const [uploadErrorSideId, setUploadErrorSideId] = useState<string | null>(null);
  // Offerte download flow (POST /api/offertes -> PDF + ref + public URL).
  const [offerteSubmitting, setOfferteSubmitting] = useState(false);
  const [offerteResult, setOfferteResult] = useState<{ ref: string; offerteUrl: string } | null>(null);
  // Opt-in to include indicative prices on the PDF. Default off per
  // user request — the offerte is a BOM document by default; prices
  // are explicit consent.
  const [includePrices, setIncludePrices] = useState(false);
  // Whether to attach the /render handoff render to the offerte (PDF +
  // mail). Default true when a render exists, but the user can toggle
  // off — useful when they loaded a saved config and the inherited
  // render is from a different project.
  const [includeRenderPhoto, setIncludeRenderPhoto] = useState(true);
  // Signed URL for the render produced on /render, resolved at mount
  // so the right-column overview can preview the visual the offerte
  // PDF will embed. Null when the user arrived without going through
  // /render (no renderStoragePath in the project store).
  const [renderPreviewUrl, setRenderPreviewUrl] = useState<string | null>(null);

  const VAT = 1.21;
  const selectedProduct = products.find((p) => p.id === selectedProductId);
  // Right-column overview thumbnail. Hook called unconditionally — returns
  // empty string when sku/name are empty so it's safe across product changes.
  const overviewSpanlSku = selectedProduct?.brand === "Spanl"
    ? selectedProduct.id.replace(/^spanl-/, "")
    : "";
  const overviewSpanlSrc = useSpanlImage(overviewSpanlSku, selectedProduct?.name);
  const overviewThumbSrc = (() => {
    if (selectedProduct?.brand === "Spanl") return overviewSpanlSrc;
    if (selectedProduct?.brand === "Keralit") {
      const c = keralitColorNumber != null
        ? KERALIT_COLORS.find((x) => x.number === keralitColorNumber)
        : null;
      return c?.thumbnailUrl ?? KERALIT_COLORS[0]?.thumbnailUrl ?? "";
    }
    return "";
  })();
  const productsByCategory = useMemo(
    () => products.filter((p) => categoryForType(p.type) === productCategory),
    [productCategory]
  );
  const brandsForCategory = useMemo(
    () => sortedBrandNames(Array.from(new Set(productsByCategory.map((p) => p.brand)))),
    [productsByCategory]
  );
  const { savePhoto, deletePhoto, loadAllPhotos, clearAllPhotos } = usePhotoStore();
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Per-side <input type="file"> refs so we can reset .value after each
  // upload (otherwise re-selecting the same file fires no change event)
  // and after a remove/retry (so the box is clean again).
  const fileInputRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());
  // Monotonic id stamped on every handleImageUpload call. After each await
  // we compare against the latest id; if a newer upload has started, the
  // current invocation is stale and must not write to state.
  const uploadIdRef = useRef(0);
  // Forces React to unmount and remount the file <input> after each
  // completed/cleared upload. Reasons for the hard remount:
  //   1. The input is inside a <label> and uses className="hidden". On
  //      mobile Safari, repeatedly clicking the same hidden input via
  //      its label has known listener-staleness issues — a fresh DOM
  //      node sidesteps them.
  //   2. e.target.value = "" mutates DOM out-of-band from React; some
  //      browsers retain selected-file state under specific conditions
  //      and refuse to re-fire change for a similar file. Remounting
  //      the element guarantees a pristine state.
  //   3. Re-renders triggered by other parts of the form (e.g. product
  //      selection) cause the inline ref callback to detach/reattach;
  //      on the next user click we want the input to be unambiguously
  //      fresh rather than reusing whatever React reconciled.
  const [inputResetKey, setInputResetKey] = useState(0);

  // Initialise sides with translated names once locale is known
  useEffect(() => {
    setSides((prev) =>
      prev.map((s, i) => {
        const key = sideKeyForIndex(i);
        const defaultName = key === "gc.side.numbered" ? t(key, { n: i + 1 }) : t(key);
        // Rewrite when name is empty, a raw i18n key, or a known default in
        // any supported locale. User-typed custom names are preserved.
        if (!s.name || SIDE_DEFAULTS.has(s.name)) {
          return { ...s, name: defaultName };
        }
        return s;
      })
    );
  }, [t]);

  // Locale-driven default unit (only when user has not manually touched it)
  useEffect(() => {
    if (!unitTouched) setUnit(defaultUnitFor(locale));
  }, [locale, unitTouched]);

  function showToast(message: string, type: "ok" | "error" = "ok") {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    // OK toasts auto-dismiss; error toasts stay until the user clicks
    // them away so diagnostic text (e.g. Zod field errors from the
    // offerte route) doesn't blink away before it can be read.
    if (type === "ok") {
      toastTimer.current = setTimeout(() => setToast(null), 2500);
    }
  }

  useEffect(() => {
    loadAllPhotos([QUICK_SIDE_ID, ...sides.map((s) => s.id)])
      .then(setPhotos)
      .catch(() => {});
  }, []);

  const resolvedSides = useMemo<CalcSide[]>(() => {
    return sides.map((side, index) => {
      if (index === 1 && frontBackSame && sides[0]) return { ...side, width: sides[0].width, height: sides[0].height };
      if (index === 3 && leftRightSame && sides[2]) return { ...side, width: sides[2].width, height: sides[2].height };
      return side;
    });
  }, [sides, frontBackSame, leftRightSame]);

  const quickSide = useMemo<CalcSide>(
    () =>
      buildQuickSide(
        quickAreaToM2(quickTotalArea, unit),
        toNumber(quickWindowCount),
        toNumber(quickDoorCount),
        t("gc.mode.quick")
      ),
    [quickTotalArea, unit, quickWindowCount, quickDoorCount, t]
  );

  const effectiveSides = mode === "quick" ? [quickSide] : resolvedSides;

  const activeSides = useMemo(
    () => effectiveSides.filter((s) => toNumber(s.width) > 0 && toNumber(s.height) > 0),
    [effectiveSides]
  );

  const insideCornerCountNum = useMemo(() => {
    const n = toNumber(insideCornerCount);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  }, [insideCornerCount]);

  const materialResult = useMemo(() => {
    if (!selectedProduct) return null;
    return calculateMaterialResult({
      sides: activeSides,
      product: selectedProduct,
      orientation,
      profiles: DEFAULT_SPANL_PROFILES,
      insideCornerCount: insideCornerCountNum,
    });
  }, [selectedProduct, orientation, activeSides, insideCornerCountNum]);

  // The opposite orientation for the comparison card. Only computed when
  // the selected product physically supports both (Spanl Mono Flat/Groove
  // and Strip do; printed-look panels typically don't).
  const alternateOrientation: Orientation = orientation === "horizontal" ? "vertical" : "horizontal";
  const alternateMaterialResult = useMemo(() => {
    if (!selectedProduct) return null;
    if (!selectedProduct.orientations.includes(alternateOrientation)) return null;
    return calculateMaterialResult({
      sides: activeSides,
      product: selectedProduct,
      orientation: alternateOrientation,
      profiles: DEFAULT_SPANL_PROFILES,
      insideCornerCount: insideCornerCountNum,
    });
  }, [selectedProduct, alternateOrientation, activeSides, insideCornerCountNum]);

  const totals = materialResult?.totals ?? { gross: 0, openings: 0, net: 0 };
  const adviesPrijs = materialResult?.totalExVat ?? 0;

  // Kozijnen and Isolatie tabs only become available once a Gevelbekleding
  // calculation produced an advice price. Revert to gevelbekleding if the
  // user is currently on a now-locked tab.
  useEffect(() => {
    if (adviesPrijs <= 0 && productCategory !== "gevelbekleding") {
      setProductCategory("gevelbekleding");
    }
  }, [adviesPrijs, productCategory]);

  // Auto-expand the product picker when no product is selected, so a
  // greenfield calc still surfaces the catalog. Once a product is set
  // (manually or via /render handoff) it stays collapsed unless the
  // user explicitly clicks "Paneel wijzigen".
  useEffect(() => {
    if (!selectedProductId) setShowProductPicker(true);
  }, [selectedProductId]);

  function fmtMoney(amount: number) {
    const value = showInclVat ? round2(amount * VAT) : amount;
    return `€${value.toFixed(2)}`;
  }

  // Resolve a NL postcode + huisnummer to street + city via the PDOK
  // locatieserver — Dutch government, free, no API key required, CORS
  // enabled. The endpoint accepts free-text queries and ranks results;
  // we ask for one. On success we set the canonical customerAddress
  // string in the format that NL invoices/letters use, leaving the
  // user free to edit afterwards (e.g., add an appartement-nummer).
  async function lookupAddress() {
    const cleanPostcode = postcode.replace(/\s+/g, "").toUpperCase();
    const cleanNumber = huisnummer.trim();
    if (!/^\d{4}[A-Z]{2}$/.test(cleanPostcode) || !cleanNumber) {
      setAddressLookupState("notfound");
      return;
    }
    setAddressLookupState("loading");
    try {
      const url = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${encodeURIComponent(
        `postcode:${cleanPostcode} and huisnummer:${cleanNumber}`,
      )}&rows=1&fl=straatnaam,woonplaatsnaam,huisnummer,postcode`;
      const res = await fetch(url);
      if (!res.ok) {
        setAddressLookupState("error");
        return;
      }
      const data = await res.json();
      const doc = data?.response?.docs?.[0];
      if (!doc?.straatnaam || !doc?.woonplaatsnaam) {
        setAddressLookupState("notfound");
        return;
      }
      const formattedPostcode = `${cleanPostcode.slice(0, 4)} ${cleanPostcode.slice(4)}`;
      setCustomerAddress(
        `${doc.straatnaam} ${cleanNumber}, ${formattedPostcode} ${doc.woonplaatsnaam}`,
      );
      setAddressLookupState("ok");
    } catch {
      setAddressLookupState("error");
    }
  }

  function validateForExport(): string | null {
    if (mode === "quick" && quickAreaToM2(quickTotalArea, unit) <= 0) return t("gc.error.fillArea");
    if (mode === "advanced" && activeSides.length === 0) return t("gc.error.fillSide");
    if (!selectedProduct) return t("gc.error.chooseProduct");
    return null;
  }

  function switchMode(next: Mode) {
    if (next === mode) return;

    if (next === "advanced") {
      // Snel → Per zijde: refinement, no confirm. Map quick area onto
      // sides[0..3] as a square (sqrt(area)*100 cm). User can tweak
      // afterwards. Sides beyond the first four are left untouched.
      const m2 = quickAreaToM2(quickTotalArea, unit);
      if (m2 > 0) {
        const sideCm = String(Math.round(Math.sqrt(m2) * 100));
        setSides((prev) =>
          prev.map((s, i) => (i < 4 ? { ...s, width: sideCm, height: sideCm } : s))
        );
        setFrontBackSame(true);
        setLeftRightSame(true);
      }
      setMode(next);
      return;
    }

    // Per zijde → Snel: confirm before simplifying. Per-zijde data is
    // preserved in state so the user can switch back without losing it.
    if (typeof window !== "undefined" && !window.confirm(t("gc.confirmModeSwitchToQuick"))) {
      return;
    }
    // Suggest the sum of the first four sides' gross-m² as the new
    // quickTotalArea (only when the field is empty, so we don't
    // overwrite a value the user explicitly typed).
    if (!quickTotalArea) {
      const totalM2 = resolvedSides
        .slice(0, 4)
        .reduce((acc, s) => acc + calculateSideGrossM2(s), 0);
      if (totalM2 > 0) {
        const display = unit === "ft2" ? totalM2 * M2_TO_FT2 : totalM2;
        setQuickTotalArea(display.toFixed(2));
      }
    }
    setMode(next);
  }

  function updateSide(sideId: string, updater: (side: CalcSide) => CalcSide) {
    setSides((prev) => prev.map((s) => (s.id === sideId ? updater(s) : s)));
  }

  function addSide() {
    setSides((prev) => (prev.length >= MAX_SIDES ? prev : [...prev, createSide(prev.length, t)]));
  }

  async function removeSide(sideId: string) {
    setSides((prev) => prev.filter((s) => s.id !== sideId));
    await deletePhoto(sideId).catch(() => {});
    setPhotos((prev) => {
      const n = { ...prev };
      delete n[sideId];
      return n;
    });
  }

  function setHasWindows(sideId: string, checked: boolean) {
    updateSide(sideId, (side) => ({
      ...side,
      openings: checked
        ? [{ ...createOpening("window", t) }, ...side.openings.filter((o) => o.type !== "window")]
        : side.openings.filter((o) => o.type !== "window"),
    }));
  }

  function setHasDoors(sideId: string, checked: boolean) {
    updateSide(sideId, (side) => ({
      ...side,
      openings: checked
        ? [...side.openings.filter((o) => o.type !== "door"), createOpening("door", t)]
        : side.openings.filter((o) => o.type !== "door"),
    }));
  }

  function updateOpening(sideId: string, openingId: string, field: keyof OpeningGroup, value: string) {
    updateSide(sideId, (side) => ({
      ...side,
      openings: side.openings.map((o) => (o.id === openingId ? { ...o, [field]: value } : o)),
    }));
  }

  function addOpening(sideId: string, type: OpeningType) {
    updateSide(sideId, (side) => ({ ...side, openings: [...side.openings, createOpening(type, t)] }));
  }

  function removeOpening(sideId: string, openingId: string) {
    updateSide(sideId, (side) => ({ ...side, openings: side.openings.filter((o) => o.id !== openingId) }));
  }

  // Wipe every piece of upload state for a side: local preview, IndexedDB
  // entry, file-input value (so the same file can be re-selected), upload
  // error, and any in-flight handler (via uploadIdRef bump). Used by the
  // error-state retry button and the loaded-state remove button.
  function clearPhotoState(sideId: string) {
    uploadIdRef.current += 1;
    setUploadError(null);
    setUploadErrorSideId(null);
    setUploading(false);
    setPhotos((prev) => {
      if (!(sideId in prev)) return prev;
      const next = { ...prev };
      delete next[sideId];
      return next;
    });
    deletePhoto(sideId).catch(() => {});
    const input = fileInputRefs.current.get(sideId);
    if (input) input.value = "";
    // Force React to remount every <input type="file"> on the page so
    // the next click hits a fresh DOM node — see the inputResetKey
    // declaration for the full reasoning.
    setInputResetKey((k) => k + 1);
  }

  async function handleImageUpload(sideId: string, file: File | null) {
    if (!file) return;
    // Stamp this invocation. Any prior in-flight upload sees myId !==
    // uploadIdRef.current after its await and bails out before writing
    // stale data into state.
    const myId = ++uploadIdRef.current;
    setUploadError(null);
    setUploadErrorSideId(null);
    setUploading(true);
    try {
      // Local IndexedDB save keeps the per-side gallery + offline preview
      // working even if Supabase Storage is unreachable.
      const dataUrl = await fileToDataUrl(file);
      if (myId !== uploadIdRef.current) return;
      await savePhoto(sideId, dataUrl);
      if (myId !== uploadIdRef.current) return;
      setPhotos((prev) => ({ ...prev, [sideId]: dataUrl }));

      // Upload to Supabase Storage so /render can hydrate via the
      // shared project store. Last upload wins as the "primary" photo.
      const { path, fileName } = await uploadPhoto(file);
      if (myId !== uploadIdRef.current) return;
      useProjectStore.getState().setPhoto(path, fileName);
      // Success path: re-assert that no error message is showing for
      // this side. Already cleared at the top of the function, but a
      // defensive re-clear here makes error+success states provably
      // mutually exclusive — callers reading state after a resolved
      // upload promise can rely on uploadError being null.
      setUploadError(null);
      setUploadErrorSideId(null);
    } catch (err) {
      if (myId !== uploadIdRef.current) return;
      const messageKey =
        err instanceof UploadError
          ? {
              too_large: "upload_error_too_large",
              wrong_type: "upload_error_wrong_type",
              compression_failed: "upload_error_compression",
              upload_failed: "upload_error_failed",
            }[err.code]
          : "upload_error_unknown";
      setUploadError(t(messageKey));
      setUploadErrorSideId(sideId);
      showToast(t("gc.toast.uploadFailed"), "error");
      // Log the real error to the console so we can debug actual
      // failures — the user-facing message above is intentionally
      // generic and sometimes hides the root cause.
      console.error("[gevelcalc] photo upload failed", err);
    } finally {
      if (myId === uploadIdRef.current) {
        setUploading(false);
        // Remount file inputs once the upload settles — successful or
        // failed, doesn't matter, the next attempt should start from a
        // clean DOM. Skipped for stale invocations so we don't yank
        // the input out from under a still-running newer upload.
        setInputResetKey((k) => k + 1);
      }
    }
  }

  function buildSaveData(includingPhotos = false) {
    const now = new Date().toISOString();
    setCalcDate(now);
    const sidesToSave = mode === "quick" ? [quickSide] : sides;
    const base = {
      version: STORAGE_KEY,
      savedAt: now,
      projectName,
      mode,
      unit,
      quickTotalArea,
      quickWindowCount,
      quickDoorCount,
      sides: sidesToSave,
      frontBackSame,
      leftRightSame,
      selectedProductId,
      keralitColorNumber,
      orientation,
    };
    return includingPhotos ? { ...base, photos } : base;
  }

  function restoreFromData(data: ReturnType<typeof buildSaveData> & { photos?: Record<string, string> }) {
    setMode(data.mode === "quick" ? "quick" : "advanced");
    if (data.unit === "ft2" || data.unit === "m2") {
      setUnit(data.unit);
      setUnitTouched(true);
    }
    setQuickTotalArea(data.quickTotalArea ?? "");
    setQuickWindowCount(data.quickWindowCount ?? "0");
    setQuickDoorCount(data.quickDoorCount ?? "0");
    if (data.mode !== "quick") setSides(data.sides ?? createDefaultSides(t));
    setFrontBackSame(data.frontBackSame ?? false);
    setLeftRightSame(data.leftRightSame ?? false);
    // Conditional overwrites for fields the user typically wants to
    // preserve when re-loading a config on top of the current session.
    // Without this, loading a saved JSON to skip re-entering dimensions
    // also wipes the panel + project number that came from /render or
    // the just-mounted page. Pattern: only adopt the JSON value if the
    // JSON has one; otherwise keep whatever is in state already.
    if (data.projectName) setProjectName(data.projectName);
    if (data.selectedProductId) setSelectedProductId(data.selectedProductId);
    if (typeof data.keralitColorNumber === "number") setKeralitColorNumber(data.keralitColorNumber);
    if (data.orientation === "horizontal" || data.orientation === "vertical") {
      setOrientation(data.orientation);
    }
    if (data.savedAt) setCalcDate(data.savedAt);
    if (data.photos) {
      setPhotos(data.photos);
      Object.entries(data.photos).forEach(([id, url]) => savePhoto(id, url).catch(() => {}));
    } else {
      const ids = data.mode === "quick" ? [QUICK_SIDE_ID] : (data.sides ?? []).map((s: CalcSide) => s.id);
      loadAllPhotos(ids).then(setPhotos).catch(() => {});
    }
  }

  // Auto-save the calc form to sessionStorage on change so any
  // navigation away — SiteNav, hamburger sheet, browser back from
  // /render — preserves state for the on-mount restore. Debounced so
  // we don't thrash storage on every keystroke. Gated on calcRestored
  // so the empty pre-restore state can't overwrite a freshly-loaded
  // payload. Photos excluded — they're in IndexedDB and would
  // otherwise blow the ~5MB sessionStorage cap.
  useEffect(() => {
    if (!calcRestored) return;
    const handle = window.setTimeout(() => {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(buildSaveData(false)));
      } catch {
        /* quota / serialise failure — photos are in IndexedDB so a
           skip just means re-typing dimensions if the next
           navigation happens before the next attempt */
      }
    }, 600);
    return () => window.clearTimeout(handle);
    // buildSaveData is a non-stable closure but only reads the listed
    // state, so the deps here are exhaustive in practice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    calcRestored,
    projectName,
    mode,
    unit,
    quickTotalArea,
    quickWindowCount,
    quickDoorCount,
    sides,
    frontBackSame,
    leftRightSame,
    selectedProductId,
    keralitColorNumber,
    orientation,
  ]);

  async function exportConfig() {
    const data = buildSaveData(true);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const filename = `renisual-${new Date().toISOString().slice(0, 10)}.json`;

    // Web Share API path — gated to iOS only. Desktop Chrome / Edge
    // also implement canShare but the user expects a Save / Save As
    // dialog when they click "export config", not the OS share sheet.
    // iOS Safari is where blob anchors don't reliably download and the
    // share sheet is the genuine path to Files.
    const file = new File([blob], filename, { type: "application/json" });
    const isIOS =
      typeof navigator !== "undefined" &&
      /iPad|iPhone|iPod/.test(navigator.userAgent ?? "");
    if (
      isIOS &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] })
    ) {
      try {
        await navigator.share({ files: [file], title: filename });
        return;
      } catch {
        // user cancelled or share failed — fall through to anchor download
      }
    }

    // Anchor-download path. Mobile-safe pattern:
    //  - Anchor must live in the DOM before click() on some browsers
    //  - revokeObjectURL must wait — iOS Safari starts the download
    //    asynchronously and a synchronous revoke kills the blob URL
    //    before the file lands.
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  async function importConfig(file: File | null) {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.sides)) {
        showToast(t("gc.toast.invalidConfig"), "error");
        return;
      }
      restoreFromData(data);
      showToast(t("gc.toast.configLoaded"));
    } catch {
      showToast(t("gc.toast.loadFailed"), "error");
    }
  }

  async function resetData() {
    if (!confirm(t("gc.confirmReset"))) return;
    localStorage.removeItem(STORAGE_KEY);
    // Also wipe the sessionStorage payload that the auto-save effect
    // writes — otherwise the on-mount restore would revert this reset
    // the next time the user returns to /gevelcalc in the same tab.
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    await clearAllPhotos().catch(() => {});
    // Also wipe the cross-page projectStore (photo + product handed off
    // from /render). Without this, hitting Reset cleared the gevelcalc
    // form but /render still showed the old photo + selected panel,
    // confusing users into thinking Reset didn't work. Best-effort
    // delete the orphaned signed-URL photo from Supabase Storage too.
    const storedPhotoPath = useProjectStore.getState().photoStoragePath;
    if (storedPhotoPath) {
      fetch("/api/photo/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: storedPhotoPath }),
      }).catch(() => {
        /* swept by background job if it fails */
      });
    }
    useProjectStore.getState().reset();
    setSides(createDefaultSides(t));
    setPhotos({});
    setProjectName("");
    setFrontBackSame(false);
    setLeftRightSame(false);
    setSelectedProductId("");
    setOrientation("horizontal");
    setCalcDate("");
    setQuickTotalArea("");
    setQuickWindowCount("0");
    setQuickDoorCount("0");
    showToast(t("gc.toast.dataCleared"));
  }


  // Build the calc snapshot the offerte API expects. Pulls profile
  // counts out of materialResult.profileItems by their canonical
  // engine label so display-side renaming never breaks the payload.
  function buildOffertePayload() {
    if (!selectedProduct || !materialResult) return null;
    const findCount = (label: string, src = materialResult) =>
      src.profileItems.find((p) => p.label === label)?.count ?? 0;
    const subtotal = round2Money(materialResult.totalExVat);
    const total = round2Money(subtotal * VAT);
    const photoStoragePath = useProjectStore.getState().photoStoragePath;
    const renderStoragePath = useProjectStore.getState().renderStoragePath;

    // Include the alt orientation only when the user has explicitly
    // toggled the comparison card on AND the engine produced a result
    // for the opposite orientation (skipped for printed-look panels
    // which only support one direction).
    const alt = showAlternateOrientation && alternateMaterialResult ? alternateMaterialResult : null;
    const alternateCalcOutput = alt
      ? {
          panelCount: alt.panelCount,
          profileStartCount: findCount("Beginprofiel", alt),
          profileEndCount: findCount("Eindprofiel", alt),
          profileMiddleCount: findCount("Verbindingsprofiel", alt),
          profileCornerCount: findCount("Hoekprofiel", alt),
          profileInsideCornerCount: findCount("Binnenhoekprofiel", alt),
          subtotalExclBtw: round2Money(alt.totalExVat),
          totalInclBtw: round2Money(alt.totalExVat * VAT),
        }
      : undefined;

    // Strip side photos before serialising — `photoDataUrl` is a base64
    // string that can be megabytes per side. With 4 sides we'd push the
    // request body past Hostinger's 10 MB JSON limit and the server's
    // request.json() would fail with a SyntaxError before it could even
    // run the schema check. The actual photo lives in Supabase Storage
    // (photoStoragePath); these inline previews are only for the UI.
    const stripPhoto = (s: CalcSide): Omit<CalcSide, "photoDataUrl"> => ({
      id: s.id,
      name: s.name,
      width: s.width,
      height: s.height,
      openings: s.openings,
    });

    // Human-readable product label for the PDF — includes brand + SKU
    // + colour. Spanl panels look like "Spanl PB9003A — white (RAL 9010)".
    // The route reads this back out of calcInput.
    const productLabel = `${selectedProduct.brand} ${selectedProduct.name}`;

    return {
      calcInput: {
        mode,
        unit,
        orientation,
        projectName,
        selectedProductId,
        productLabel,
        keralitColorNumber,
        sides: (mode === "quick" ? [quickSide] : sides).map(stripPhoto),
        // Pricing knobs the PDF needs but that the calc engine
        // doesn't currently surface as named fields.
        pricePerPanel:
          selectedProduct.pricePerPanelExVat ??
          selectedProduct.panelAreaM2 * selectedProduct.pricePerM2ExVat,
        pricePerStartProfile: DEFAULT_SPANL_PROFILES.startProfile.priceEachExVat,
        pricePerEndProfile: DEFAULT_SPANL_PROFILES.endProfile.priceEachExVat,
        pricePerMiddleProfile: DEFAULT_SPANL_PROFILES.connectionProfile.priceEachExVat,
        pricePerCornerProfile: DEFAULT_SPANL_PROFILES.cornerProfile.priceEachExVat,
        pricePerInsideCornerProfile: DEFAULT_SPANL_PROFILES.insideCornerProfile.priceEachExVat,
        fastenerEstimateExBtw: 0,
      },
      calcOutput: {
        panelCount: materialResult.panelCount,
        profileStartCount: findCount("Beginprofiel"),
        profileEndCount: findCount("Eindprofiel"),
        profileMiddleCount: findCount("Verbindingsprofiel"),
        profileCornerCount: findCount("Hoekprofiel"),
        profileInsideCornerCount: findCount("Binnenhoekprofiel"),
        subtotalExclBtw: subtotal,
        totalInclBtw: total,
      },
      alternateOrientation: alt ? alternateOrientation : undefined,
      alternateCalcOutput,
      customer:
        customerLastName || customerEmail || customerAddress
          ? {
              name: customerLastName || undefined,
              email: customerEmail || undefined,
              projectAddress: customerAddress || undefined,
            }
          : undefined,
      photoPath: photoStoragePath ?? undefined,
      // Render-foto meesturen is optioneel — gebruiker kan in de
      // offerte-CTA kaart de toggle uitvinken (bv. wanneer ze een
      // saved config laadden en de oude render niet meer relevant is).
      renderPath: includeRenderPhoto ? (renderStoragePath ?? undefined) : undefined,
      includePrices,
    };
  }

  async function downloadOfferte() {
    const validationErr = validateForExport();
    if (validationErr) {
      showToast(validationErr, "error");
      return;
    }
    // Klantgegevens — minimaal e-mailadres vereist, anders kunnen wij
    // de offerte niet in behandeling nemen en de leverancier ook niet.
    // Naam en adres zijn óók nodig voor een nuttig dossier; we vragen
    // alle drie tegelijk uit zodat de gebruiker er één keer naar kijkt.
    const missing: string[] = [];
    if (!customerEmail.trim()) missing.push("e-mail");
    if (!customerLastName.trim()) missing.push("achternaam");
    if (!customerAddress.trim()) missing.push("adres");
    if (missing.length > 0) {
      showToast(
        `Vul ${missing.join(", ")} in — zonder die gegevens kunnen we de offerte niet versturen.`,
        "error",
      );
      return;
    }
    const payload = buildOffertePayload();
    if (!payload) {
      showToast(t("gc.error.chooseProduct"), "error");
      return;
    }
    setOfferteSubmitting(true);
    setOfferteResult(null);
    try {
      const res = await fetch("/api/offertes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.text();
        console.error("[offerte] HTTP", res.status, body);
        console.error("[offerte] payload that was rejected:", payload);
        let suffix = "";
        try {
          const parsed = JSON.parse(body) as {
            error?: string;
            detail?: { code?: string; message?: string } | string;
            // invalid_body path uses "details" (plural) and embeds the
            // Zod flatten — fieldErrors / formErrors objects.
            details?:
              | string
              | {
                  fieldErrors?: Record<string, string[] | undefined>;
                  formErrors?: string[];
                };
          };
          // Prefer the Zod flatten when available so the user sees WHICH
          // field tripped (e.g. "calcOutput.panelCount: required").
          if (parsed.details && typeof parsed.details === "object") {
            const flat = parsed.details;
            const fieldEntries = Object.entries(flat.fieldErrors ?? {})
              .filter(([, errs]) => errs && errs.length > 0)
              .map(([k, errs]) => `${k}: ${(errs ?? []).join(", ")}`);
            const formMsgs = (flat.formErrors ?? []).join(", ");
            const combined = [...fieldEntries, formMsgs].filter(Boolean).join(" | ");
            if (combined) suffix = `: ${combined.slice(0, 140)}`;
          } else if (typeof parsed.details === "string") {
            suffix = `: ${parsed.details.slice(0, 140)}`;
          } else if (typeof parsed.detail === "object" && parsed.detail) {
            if (parsed.detail.code) suffix = ` [${parsed.detail.code}]`;
            else if (parsed.detail.message) suffix = `: ${parsed.detail.message.slice(0, 80)}`;
          } else if (typeof parsed.detail === "string") {
            suffix = `: ${parsed.detail.slice(0, 80)}`;
          } else if (parsed.error) {
            suffix = ` (${parsed.error})`;
          }
        } catch {
          /* non-JSON body — keep generic toast */
        }
        showToast(t("gc.offerte.errorGeneric") + suffix, "error");
        return;
      }
      const data = (await res.json()) as { ref: string; offerteUrl: string; pdfUrl: string | null };
      setOfferteResult({ ref: data.ref, offerteUrl: data.offerteUrl });

      // Wipe the cross-page project store so a return visit to /render
      // starts blank instead of showing the previous project's photo +
      // render + panel. Local form fields stay untouched (the user is
      // still on /gevelcalc looking at the result) — only the persisted
      // session that bleeds into /render is cleared.
      useProjectStore.getState().clearPhoto();
      useProjectStore.getState().clearRender();
      useProjectStore.getState().clearProduct();

      // Email the request to info@renisual.com so the team picks it
      // up internally. AWAIT this before triggering the PDF download —
      // mobile browsers abort in-flight fetches when the page unloads
      // for the PDF viewer, which previously left the send silently
      // hanging with no toast and no inbox delivery. The await adds
      // 1-3s but the user sees the offerteSubmitting spinner the whole
      // time so it doesn't read as "stuck".
      let sendOk = false;
      try {
        const sendRes = await fetch("/api/offertes/send", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ref: data.ref }),
        });
        if (sendRes.ok) {
          sendOk = true;
        } else {
          let detail = `HTTP ${sendRes.status}`;
          try {
            const body = (await sendRes.json()) as { error?: string };
            if (body.error) detail = body.error;
          } catch {
            /* non-JSON */
          }
          console.warn("[offerte] send to info@renisual.com failed", detail);
          // Persistent error toast — no auto-dismiss, no overwrite by
          // the downstream linkCopied OK toast (gated below) so the
          // diagnostic code stays visible until the user reads it.
          showToast(
            `Verzending naar Renisual mislukt (${detail}) — uw PDF is wel opgeslagen, deel zelf de link of mail naar info@renisual.com.`,
            "error",
          );
        }
      } catch (err) {
        console.warn("[offerte] send fetch threw", err);
        showToast(
          "Verzending naar Renisual mislukt (netwerk) — uw PDF is wel opgeslagen, deel zelf de link of mail naar info@renisual.com.",
          "error",
        );
      }

      // Save-As friendly download. Fetch the PDF bytes, wrap in a
      // same-origin Blob URL, and trigger an anchor click so the
      // browser respects the `download` attribute. With "ask where to
      // save" enabled in browser settings the user gets a Save As
      // dialog; otherwise the file lands in their Downloads folder
      // with a friendly filename instead of a random hash.
      if (data.pdfUrl) {
        try {
          const today = new Date().toISOString().slice(0, 10);
          const filename = `gevelcalc-${data.ref}-${today}.pdf`;
          const pdfRes = await fetch(data.pdfUrl);
          const blob = await pdfRes.blob();
          // Web Share API path — iOS only. Desktop Chrome / Edge also
          // support canShare but on those a click-on-Download should
          // produce a Save dialog, not the OS share sheet.
          const file = new File([blob], filename, { type: "application/pdf" });
          const isIOS =
            typeof navigator !== "undefined" &&
            /iPad|iPhone|iPod/.test(navigator.userAgent ?? "");
          if (
            isIOS &&
            typeof navigator.canShare === "function" &&
            navigator.canShare({ files: [file] })
          ) {
            try {
              await navigator.share({ files: [file], title: filename });
            } catch {
              // user cancelled — fall through to anchor download
              triggerBlobDownload(blob, filename);
            }
          } else {
            triggerBlobDownload(blob, filename);
          }
        } catch (err) {
          console.error("[offerte] download failed", err);
          // Fall back to opening the signed URL in a new tab.
          window.open(data.pdfUrl, "_blank", "noopener,noreferrer");
        }
      }
      // Best-effort copy of the public offerte URL — most browsers
      // grant clipboard inside a click handler without prompting.
      // Only surface the success toast when the send to info@ also
      // succeeded; otherwise an OK toast here would overwrite the
      // persistent error toast set above and make the diagnostic
      // code disappear before the user can read it.
      try {
        await navigator.clipboard.writeText(data.offerteUrl);
        if (sendOk) {
          showToast(`Offerte verstuurd naar Renisual ✓ — ${t("gc.offerte.linkCopied")}`);
        }
      } catch {
        /* clipboard blocked — link is still in the success block */
      }
    } catch (err) {
      console.error("[offerte] fetch failed", err);
      showToast(t("gc.offerte.errorGeneric"), "error");
    } finally {
      setOfferteSubmitting(false);
    }
  }

  function round2Money(v: number): number {
    return Math.round(v * 100) / 100;
  }

  // Anchor-based blob download. Anchor must live in the DOM and the
  // revoke must be deferred so iOS Safari has time to commit the file.
  function triggerBlobDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  const unitLabel = unit === "ft2" ? "ft²" : "m²";
  const totalAreaPlaceholder = unit === "ft2" ? "e.g. 700" : t("gc.quick.totalAreaPlaceholder");

  // Quick mode derived values for display
  const quickTotalAreaM2 = quickAreaToM2(quickTotalArea, unit);
  const quickOpeningsM2 =
    toNumber(quickWindowCount) * QUICK_WINDOW_M2 + toNumber(quickDoorCount) * QUICK_DOOR_M2;
  const quickNetM2 = Math.max(0, quickTotalAreaM2 - quickOpeningsM2);
  const quickNetDisplay = m2ToUnit(quickNetM2, unit).toFixed(2);

  // Mirror totalArea / openings into the cross-page project store so /render
  // can show them. Run at component-render time; zustand's set() is a no-op
  // when the values are unchanged.
  useEffect(() => {
    useProjectStore.getState().setCalculation(quickTotalAreaM2, quickOpeningsM2);
  }, [quickTotalAreaM2, quickOpeningsM2]);

  // Renders one BOM summary block. Reused for the primary calc (chosen
  // orientation) and the optional alternate-orientation comparison block
  // surfaced by the "Al gedacht aan de X optie?" card.
  const orientationLabel = (o: Orientation) =>
    o === "horizontal" ? t("render.horizontal") : t("render.vertical");
  const bomBlock = (result: NonNullable<typeof materialResult>, label?: string) => {
    if (!selectedProduct) return null;
    const startProfile = result.profileItems.find((p) => p.label === "Beginprofiel");
    const endProfile = result.profileItems.find((p) => p.label === "Eindprofiel");
    const connProfile = result.profileItems.find((p) => p.label === "Verbindingsprofiel");
    const cornerProfile = result.profileItems.find((p) => p.label === "Hoekprofiel");
    const insideCornerProfile = result.profileItems.find((p) => p.label === "Binnenhoekprofiel");
    return (
      <div className="border border-stone-200 bg-paper p-4 space-y-2 text-sm">
        {label && (
          <div className="-mt-1 mb-1 border-b border-stone-100 pb-1 font-mono text-[10px] uppercase tracking-[0.15em] text-stone-500">
            {label}
          </div>
        )}
        {/* Snel mode treats the project as ONE virtual side, so profile
            counts (especially Hoek + Verbinding) under-estimate the real
            need. Per-zijde mode bin-packs each side individually. */}
        {mode === "quick" && (
          <div className="-mt-1 mb-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-[11px] leading-snug text-amber-900">
            {t("gc.modeAccuracyDisclaimer")}
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-stone-600">{t("gc.netWithWaste")}</span>
          <span className="font-semibold text-ink">{result.netWithWaste.toFixed(2)} m²</span>
        </div>
        {selectedProduct.type === "panel" && (
          <div className="flex justify-between">
            <span className="text-stone-600">{t("gc.panelsNeeded")}</span>
            <span className="font-semibold text-ink">{result.panelCount}</span>
          </div>
        )}
        {startProfile && startProfile.count > 0 && (
          <div className="flex justify-between">
            <span className="text-stone-600">{t("gc.startProfilesNeeded")}</span>
            <span className="font-semibold text-ink">{startProfile.count}</span>
          </div>
        )}
        {endProfile && endProfile.count > 0 && (
          <div className="flex justify-between">
            <span className="text-stone-600">{t("gc.endProfilesNeeded")}</span>
            <span className="font-semibold text-ink">{endProfile.count}</span>
          </div>
        )}
        {connProfile && connProfile.count > 0 && (
          <div className="flex justify-between">
            <span className="text-stone-600">{t("gc.middleProfilesNeeded")}</span>
            <span className="font-semibold text-ink">{connProfile.count}</span>
          </div>
        )}
        {cornerProfile && cornerProfile.count > 0 && (
          <div className="flex justify-between">
            <span className="text-stone-600">{t("gc.cornerProfilesNeeded")}</span>
            <span className="font-semibold text-ink">{cornerProfile.count}</span>
          </div>
        )}
        {insideCornerProfile && insideCornerProfile.count > 0 && (
          <div className="flex justify-between">
            <span className="text-stone-600">{t("gc.insideCornerProfilesNeeded")}</span>
            <span className="font-semibold text-ink">{insideCornerProfile.count}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-stone-600">{t("gc.materialPrice")}</span>
          <span className="font-semibold text-ink">{fmtMoney(result.materialPriceExVat)}</span>
        </div>
        {result.profileItems.length > 0 && (
          <div className="flex justify-between">
            <span className="text-stone-600">{t("gc.profilesPrice")}</span>
            <span className="font-semibold text-ink">{fmtMoney(result.profilePriceExVat)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-stone-200 pt-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-stone-600">{t("gc.totalLabel")}</span>
          <span className="font-display text-base text-ink">{fmtMoney(result.totalExVat)}</span>
        </div>
        <p className="pt-1 text-[11px] leading-snug text-stone-500">
          {t("gc.totalsDisclaimer")}
        </p>
      </div>
    );
  };

  return (
    <>
      <DynamicMetadata page="gevelcalc" />
      <style>{`
        @media print {
          input[type="file"], button, label, .print-hidden { display: none !important; }
          main { padding: 0 !important; }
          .space-y-6 > * + * { margin-top: 0.75rem !important; }
          section { padding: 0.75rem !important; margin-bottom: 0.5rem !important; }
          img { max-height: 180px !important; max-width: 55% !important; margin: 0.25rem auto !important; display: block !important; }
          .border-dashed { display: none !important; }
          table { font-size: 11px !important; }
          th, td { padding: 3px 6px !important; }
          .page-break-before { page-break-before: always; break-before: page; }
          section, table { break-inside: avoid; page-break-inside: avoid; }
          .fixed { display: none !important; }
          .opening-print-label { display: block !important; }
          .metrics-row { display: flex !important; gap: 8px !important; }
          .metrics-row > div { flex: 1 !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; font-size: 13px; }
        }
      `}</style>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}

      <main className="min-h-[100dvh] bg-paper text-ink print:!h-auto print:!min-h-0 print:!overflow-visible">
        <SiteNav />
        <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-6 px-6 py-8 pb-56 md:px-12 md:pb-24 lg:grid-cols-[1fr_500px] lg:gap-12 lg:px-20 lg:py-10 print:!block print:!h-auto print:!pb-0">
          <div className="space-y-10 print:!h-auto print:!overflow-visible">
          <header className="border-b border-stone-200 pb-8 print-hidden">
            <Link
              href="/"
              aria-label="Home"
              className="inline-flex items-center gap-1 rounded-full border border-stone-300 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-stone-600 transition-colors hover:bg-stone-100 hover:text-ink"
            >
              <span aria-hidden>←</span>
              <span>Home</span>
            </Link>
            <h1 className="mt-3 font-display text-4xl font-bold uppercase tracking-tight text-ink md:text-6xl">
              {t("gc.title")}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-stone-600">{t("gc.subtitle")}</p>
            <ModusToggle
              value={mode}
              onChange={switchMode}
              quickLabel={t("gc.mode.quick")}
              advancedLabel={t("gc.mode.advanced")}
            />
          </header>

          <div className="hidden print:block mb-4">
            <h1 className="text-2xl font-bold">{t("gc.title")}</h1>
            {projectName && <p className="text-base font-medium mt-1">{projectName}</p>}
            {calcDate && <p className="text-sm text-gray-500 mt-1">{t("gc.dateLabel", { date: formatDate(calcDate, locale) })}</p>}
            <p className="text-sm italic text-gray-600 mt-1">
              {mode === "quick" ? t("gc.pdfModeQuick") : t("gc.pdfModeAdvanced")}
            </p>
          </div>

          <section className="print-hidden">
            <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.2em] text-stone-600">
              01 — {t("gc.projectSettings")}
            </p>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.2em] text-stone-600">{t("gc.projectNumber")}</label>
                <input
                  className="w-full border border-stone-200 bg-paper p-3 text-sm text-ink"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="P-2026-05-06-A3B4"
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.2em] text-stone-600">
                    {t("gc.customerLastName")} <span className="text-red-600">*</span>
                  </label>
                  <input
                    required
                    className="w-full border border-stone-200 bg-paper p-3 text-sm text-ink"
                    value={customerLastName}
                    onChange={(e) => setCustomerLastName(e.target.value)}
                    placeholder={t("gc.customerLastNamePlaceholder")}
                    autoComplete="family-name"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.2em] text-stone-600">
                    {t("gc.customerEmail")} <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="email"
                    inputMode="email"
                    required
                    className="w-full border border-stone-200 bg-paper p-3 text-sm text-ink"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="naam@voorbeeld.nl"
                    autoComplete="email"
                  />
                </div>
              </div>
              {/* Postcode + huisnummer autofill — optional helper that
                  pre-fills the canonical address textarea below via PDOK
                  locatieserver. The user can still type the address by
                  hand, or edit after autofill (e.g., add a unit number). */}
              <div className="grid gap-3 sm:grid-cols-[minmax(0,7rem)_minmax(0,5rem)_auto]">
                <div>
                  <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.2em] text-stone-600">
                    Postcode
                  </label>
                  <input
                    className="w-full border border-stone-200 bg-paper p-3 text-sm text-ink uppercase"
                    value={postcode}
                    onChange={(e) => {
                      setPostcode(e.target.value);
                      setAddressLookupState("idle");
                    }}
                    placeholder="1234 AB"
                    autoComplete="postal-code"
                    inputMode="text"
                    maxLength={7}
                  />
                </div>
                <div>
                  <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.2em] text-stone-600">
                    Nr.
                  </label>
                  <input
                    className="w-full border border-stone-200 bg-paper p-3 text-sm text-ink"
                    value={huisnummer}
                    onChange={(e) => {
                      setHuisnummer(e.target.value);
                      setAddressLookupState("idle");
                    }}
                    placeholder="12"
                    autoComplete="address-line2"
                    inputMode="numeric"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={lookupAddress}
                    disabled={addressLookupState === "loading"}
                    className="w-full sm:w-auto border border-ink bg-paper px-4 py-3 font-mono text-[11px] uppercase tracking-[0.15em] text-ink hover:bg-ink hover:text-paper disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {addressLookupState === "loading" ? "Zoeken…" : "Vul adres in"}
                  </button>
                </div>
              </div>
              {addressLookupState === "notfound" && (
                <p className="text-[11px] leading-snug text-red-700">
                  Geen adres gevonden voor deze postcode + huisnummer. Controleer of beide kloppen, of vul het adres handmatig in hieronder.
                </p>
              )}
              {addressLookupState === "error" && (
                <p className="text-[11px] leading-snug text-red-700">
                  Adres opzoeken lukte niet (netwerk?). Vul het hieronder handmatig in.
                </p>
              )}
              {addressLookupState === "ok" && (
                <p className="text-[11px] leading-snug text-emerald-700">
                  Adres ingevuld — pas hieronder aan als er bv. een appartementnummer bij hoort.
                </p>
              )}
              <div>
                <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.2em] text-stone-600">
                  {t("gc.customerAddress")} <span className="text-red-600">*</span>
                </label>
                <input
                  required
                  className="w-full border border-stone-200 bg-paper p-3 text-sm text-ink"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder={t("gc.customerAddressPlaceholder")}
                  autoComplete="street-address"
                />
              </div>
              <p className="text-[11px] leading-snug text-stone-500">
                Achternaam, e-mail en adres zijn verplicht voor de offerte.
                Zonder die gegevens kunnen wij — en de leverancier — geen contact opnemen.
              </p>
              {mode === "advanced" && (
                <div className="grid gap-4 md:grid-cols-2">
                  <ToggleSwitch checked={frontBackSame} onChange={setFrontBackSame} label={t("gc.frontBackSame")} />
                  <ToggleSwitch checked={leftRightSame} onChange={setLeftRightSame} label={t("gc.leftRightSame")} />
                </div>
              )}
            </div>
          </section>

          {mode === "quick" && (
            <section className="rounded-2xl border border-black bg-white p-4 md:p-6">
              <p className="mb-4 text-xs leading-relaxed text-stone-500 print-hidden">
                {t("gc.modeAssumptionsBefore")}
                <button
                  type="button"
                  onClick={() => switchMode("advanced")}
                  className="font-medium text-stone-700 underline underline-offset-2 hover:text-ink"
                >
                  {t("gc.modeAssumptionsLink")}
                </button>
                {t("gc.modeAssumptionsAfter")}
              </p>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xl font-semibold">{t("gc.mode.quick")}</h2>
                <div className="inline-flex rounded-xl border border-black p-1 print-hidden">
                  <button
                    type="button"
                    onClick={() => {
                      setUnit("m2");
                      setUnitTouched(true);
                    }}
                    className={`rounded-lg px-3 py-1 text-xs font-medium ${
                      unit === "m2" ? "bg-black text-white" : "bg-white text-black"
                    }`}
                  >
                    m²
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUnit("ft2");
                      setUnitTouched(true);
                    }}
                    className={`rounded-lg px-3 py-1 text-xs font-medium ${
                      unit === "ft2" ? "bg-black text-white" : "bg-white text-black"
                    }`}
                  >
                    ft²
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">{t("gc.quick.totalArea")}</label>
                  <InputWithSuffix
                    value={quickTotalArea}
                    onChange={setQuickTotalArea}
                    placeholder={totalAreaPlaceholder}
                    suffix={unitLabel}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">{t("gc.quick.windowCount")}</label>
                  <input
                    className="w-full rounded-xl border border-black p-3"
                    value={quickWindowCount}
                    onChange={(e) => setQuickWindowCount(e.target.value)}
                    placeholder="0"
                    inputMode="numeric"
                  />
                  <p className="mt-1 text-xs text-gray-500">{t("gc.quick.avgHint", { avg: QUICK_WINDOW_M2 })}</p>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">{t("gc.quick.doorCount")}</label>
                  <input
                    className="w-full rounded-xl border border-black p-3"
                    value={quickDoorCount}
                    onChange={(e) => setQuickDoorCount(e.target.value)}
                    placeholder="0"
                    inputMode="numeric"
                  />
                  <p className="mt-1 text-xs text-gray-500">{t("gc.quick.avgHint", { avg: QUICK_DOOR_M2 })}</p>
                </div>
              </div>

              {/* Photo upload moved to /render — the new flow is upload
                  there, then "Bereken materiaal" → here. The handler
                  + state stay so prior IndexedDB photos still display
                  in the offerte PDF. */}
              {uploading && (
                <p className="mt-2 text-sm text-stone-500 print-hidden">{t("uploading_photo")}</p>
              )}
              {uploadError && uploadErrorSideId === QUICK_SIDE_ID && (
                <div className="mt-2 print-hidden">
                  <p className="text-sm text-red-600">{uploadError}</p>
                  <button
                    type="button"
                    onClick={() => clearPhotoState(QUICK_SIDE_ID)}
                    className="mt-2 rounded-xl border border-black px-3 py-1.5 text-xs font-medium hover:bg-stone-100"
                  >
                    {t("upload_remove_retry")}
                  </button>
                </div>
              )}

              {photos[QUICK_SIDE_ID] && (
                <div className="relative mt-3 text-center">
                  <img src={photos[QUICK_SIDE_ID]} alt="" className="mx-auto max-h-[320px] w-full rounded-xl object-contain" />
                  <button
                    type="button"
                    onClick={() => clearPhotoState(QUICK_SIDE_ID)}
                    aria-label={t("upload_remove_tooltip")}
                    title={t("upload_remove_tooltip")}
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-base text-stone-700 shadow-sm transition hover:bg-white print-hidden"
                  >
                    ×
                  </button>
                </div>
              )}

              <div className="metrics-row mt-5 grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-black p-3">
                  <div className="text-xs text-gray-500">{t("gc.gross")}</div>
                  <div className="text-base font-semibold">
                    {m2ToUnit(quickTotalAreaM2, unit).toFixed(2)} {unitLabel}
                  </div>
                </div>
                <div className="rounded-xl border border-black p-3">
                  <div className="text-xs text-gray-500">{t("gc.openings")}</div>
                  <div className="text-base font-semibold">
                    {m2ToUnit(quickOpeningsM2, unit).toFixed(2)} {unitLabel}
                  </div>
                </div>
                <div className="rounded-xl border border-black p-3">
                  <div className="text-xs text-gray-500">{t("gc.quick.netEstimate")}</div>
                  <div className="text-base font-semibold">
                    {quickNetDisplay} {unitLabel}
                  </div>
                </div>
              </div>

              <p className="mt-3 text-xs text-gray-500 print-hidden">{t("gc.quick.profileNote")}</p>
            </section>
          )}

          {mode === "advanced" &&
            sides.map((side, index) => {
              const resolved = resolvedSides[index]!;
              const isLinked = (index === 1 && frontBackSame) || (index === 3 && leftRightSame);
              const hasWindowsOpening = side.openings.some((o) => o.type === "window");
              const hasDoorsOpening = side.openings.some((o) => o.type === "door");
              const photo = photos[side.id];

              return (
                <section key={side.id} className="rounded-2xl border border-black bg-white p-4 md:p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-semibold">{side.name}</h2>
                      {isLinked && <p className="text-sm text-gray-500">{t("gc.linkedNote")}</p>}
                    </div>
                    {sides.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (typeof window !== "undefined" && !window.confirm(t("gc.confirmRemoveSide"))) return;
                          removeSide(side.id);
                        }}
                        className="rounded-md border border-stone-300 px-2.5 py-1 text-xs text-stone-600 transition-colors hover:border-stone-500 hover:text-ink print-hidden"
                      >
                        {t("gc.remove")}
                      </button>
                    )}
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium">{t("gc.widthSide")}</label>
                      <InputWithSuffix
                        value={resolved.width}
                        onChange={(v) => updateSide(side.id, (s) => ({ ...s, width: v }))}
                        placeholder={t("gc.widthPlaceholder")}
                        suffix="cm"
                        disabled={isLinked}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium">{t("gc.heightSide")}</label>
                      <InputWithSuffix
                        value={resolved.height}
                        onChange={(v) => updateSide(side.id, (s) => ({ ...s, height: v }))}
                        placeholder={t("gc.heightPlaceholder")}
                        suffix="cm"
                        disabled={isLinked}
                      />
                    </div>
                  </div>

                  {/* Per-side photo upload removed in render-first flow.
                      See note above the QUICK_SIDE_ID uploader for
                      rationale; the handler + state remain for any
                      photos already saved in IndexedDB. */}

                  {uploadError && uploadErrorSideId === side.id && (
                    <div className="mt-2 print-hidden">
                      <p className="text-sm text-red-600">{uploadError}</p>
                      <button
                        type="button"
                        onClick={() => clearPhotoState(side.id)}
                        className="mt-2 rounded-xl border border-black px-3 py-1.5 text-xs font-medium hover:bg-stone-100"
                      >
                        {t("upload_remove_retry")}
                      </button>
                    </div>
                  )}

                  {photo && (
                    <div className="relative mt-3 text-center">
                      <img src={photo} alt={side.name} className="mx-auto max-h-[320px] w-full rounded-xl object-contain" />
                      <button
                        type="button"
                        onClick={() => clearPhotoState(side.id)}
                        aria-label={t("upload_remove_tooltip")}
                        title={t("upload_remove_tooltip")}
                        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-base text-stone-700 shadow-sm transition hover:bg-white print-hidden"
                      >
                        ×
                      </button>
                    </div>
                  )}

                  <div className="mt-5 grid gap-4 md:grid-cols-2 print-hidden">
                    <ToggleSwitch checked={hasWindowsOpening} onChange={(c) => setHasWindows(side.id, c)} label={t("gc.hasWindows")} />
                    <ToggleSwitch checked={hasDoorsOpening} onChange={(c) => setHasDoors(side.id, c)} label={t("gc.hasDoors")} />
                  </div>

                  {side.openings.length > 0 && (
                    <div className="mt-5 space-y-4 rounded-2xl border border-black p-4">
                      <h3 className="font-semibold">{t("gc.openings")}</h3>
                      {side.openings.map((opening) => (
                        <div key={opening.id} className="rounded-xl border border-black p-4">
                          <div className="flex justify-between gap-4">
                            <h4 className="font-semibold">{t(`gc.opening.${opening.type}`)}</h4>
                            <button type="button" onClick={() => removeOpening(side.id, opening.id)} className="text-sm underline print-hidden">
                              {t("gc.remove")}
                            </button>
                          </div>
                          <p className="opening-print-label hidden text-sm text-gray-600 mt-1">
                            {t("gc.printedOpening", {
                              w: opening.width || "—",
                              h: opening.height || "—",
                              n: opening.count || "—",
                            })}
                          </p>
                          <div className="mt-3 grid gap-3 md:grid-cols-3 print-hidden">
                            <InputWithSuffix
                              value={opening.width}
                              onChange={(v) => updateOpening(side.id, opening.id, "width", v)}
                              placeholder={t("gc.widthShort")}
                              suffix="cm"
                            />
                            <InputWithSuffix
                              value={opening.height}
                              onChange={(v) => updateOpening(side.id, opening.id, "height", v)}
                              placeholder={t("gc.heightShort")}
                              suffix="cm"
                            />
                            <input
                              className="rounded-xl border border-black p-3"
                              placeholder={t("gc.countPlaceholder")}
                              value={opening.count}
                              onChange={(e) => updateOpening(side.id, opening.id, "count", e.target.value)}
                            />
                          </div>
                        </div>
                      ))}
                      <div className="flex flex-wrap gap-3 print-hidden">
                        <button type="button" onClick={() => addOpening(side.id, "window")} className="rounded-xl border border-black px-4 py-2">
                          {t("gc.addWindow")}
                        </button>
                        <button type="button" onClick={() => addOpening(side.id, "door")} className="rounded-xl border border-black px-4 py-2">
                          {t("gc.addDoor")}
                        </button>
                        <button type="button" onClick={() => addOpening(side.id, "other")} className="rounded-xl border border-black px-4 py-2">
                          {t("gc.addOther")}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="metrics-row mt-5 grid grid-cols-3 gap-2">
                    <div className="rounded-xl border border-black p-3">
                      <div className="text-xs text-gray-500">{t("gc.gross")}</div>
                      <div className="text-base font-semibold">{calculateSideGrossM2(resolved).toFixed(2)} m²</div>
                    </div>
                    <div className="rounded-xl border border-black p-3">
                      <div className="text-xs text-gray-500">{t("gc.openings")}</div>
                      <div className="text-base font-semibold">{calculateSideOpeningsM2(side).toFixed(2)} m²</div>
                    </div>
                    <div className="rounded-xl border border-black p-3">
                      <div className="text-xs text-gray-500">{t("gc.net")}</div>
                      <div className="text-base font-semibold">{calculateSideNetM2(resolved).toFixed(2)} m²</div>
                    </div>
                  </div>
                </section>
              );
            })}

          {/* Compact panel chip — visible when a product is already
              selected (via /render handoff or earlier interaction) and
              the picker section is collapsed. Click expands the full
              picker so the user can swap panels. */}
          {!showProductPicker && selectedProduct && (
            <section className="rounded-2xl border border-stone-300 bg-stone-50 p-4 print-hidden">
              <button
                type="button"
                onClick={() => setShowProductPicker(true)}
                className="flex w-full items-center justify-between gap-4 text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {selectedProduct.brand === "Spanl" ? (
                    <SpanlThumb productId={selectedProduct.id} productName={selectedProduct.name} compact />
                  ) : selectedProduct.brand === "Keralit" ? (
                    <KeralitThumb productName={selectedProduct.name} selectedNumber={keralitColorNumber} compact />
                  ) : null}
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-stone-500">
                      {t("gc.selectedProduct")}
                    </p>
                    <p className="truncate font-display text-sm text-ink">
                      {selectedProduct.brand} — {selectedProduct.name}
                    </p>
                  </div>
                </div>
                <span className="flex-shrink-0 font-mono text-[10px] uppercase tracking-[0.15em] text-stone-600 hover:text-ink">
                  Paneel wijzigen ▾
                </span>
              </button>
            </section>
          )}

          {showProductPicker && (
          <section className="rounded-2xl border border-black bg-white p-4 page-break-before">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold">{t("gc.productChoice")}</h2>
              {selectedProduct && (
                <button
                  type="button"
                  onClick={() => setShowProductPicker(false)}
                  className="flex-shrink-0 font-mono text-[10px] uppercase tracking-[0.15em] text-stone-600 hover:text-ink print-hidden"
                >
                  Inklappen ▴
                </button>
              )}
            </div>
            <div className="mt-3 inline-flex rounded-xl border border-black p-1 print-hidden">
              <button
                type="button"
                onClick={() => setProductCategory("gevelbekleding")}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  productCategory === "gevelbekleding" ? "bg-black text-white" : "bg-white text-black"
                }`}
              >
                {t("gevelbekleding")}
              </button>
              {/* Kozijnen + Isolatie tabs hidden for v1 — separate
                  product flows that introduced too much complexity for
                  the primary gevelbekleding journey. The state +
                  category enum stay on the file so re-enabling later
                  is just flipping this gate. */}
            </div>
            <div className="mt-4 print-hidden">
              <div className="mb-2 flex items-center justify-between gap-3">
                <label className="block font-mono text-[10px] uppercase tracking-[0.15em] text-stone-600">
                  {t("product")}
                </label>
                <div
                  role="radiogroup"
                  aria-label={t("gc.display")}
                  className="inline-flex rounded-xl border border-black p-1"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={displayMode === "foto"}
                    onClick={() => setDisplayMode("foto")}
                    className={`rounded-lg px-3 py-1 text-xs font-medium ${
                      displayMode === "foto" ? "bg-black text-white" : "bg-white text-black"
                    }`}
                  >
                    {t("gc.display.photo")}
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={displayMode === "tekst"}
                    onClick={() => setDisplayMode("tekst")}
                    className={`rounded-lg px-3 py-1 text-xs font-medium ${
                      displayMode === "tekst" ? "bg-black text-white" : "bg-white text-black"
                    }`}
                  >
                    {t("gc.display.text")}
                  </button>
                </div>
              </div>
              <div className="space-y-5">
                {brandsForCategory.map((brand) => {
                  const items = productsByCategory.filter((p) => p.brand === brand);
                  if (items.length === 0) return null;
                  const onSelect = (p: (typeof items)[number]) => {
                    setSelectedProductId(p.id);
                    if (p.orientations[0]) setOrientation(p.orientations[0]);
                    if (p.brand !== "Keralit") setKeralitColorNumber(null);
                    useProjectStore.getState().setProduct({
                      id: p.id,
                      sku: p.id,
                      name: p.name,
                      supplier_slug: p.brand.toLowerCase(),
                      image_url: null,
                    });
                  };
                  // In foto mode, products without a reference image fall
                  // back to the text row for that specific product so we
                  // never render empty thumbnails.
                  const renderEntry = (p: (typeof items)[number]) =>
                    displayMode === "foto" && productHasReferenceImage(p) ? (
                      <ProductCard
                        key={p.id}
                        product={p}
                        selected={selectedProductId === p.id}
                        onSelect={() => onSelect(p)}
                      />
                    ) : (
                      <ProductRow
                        key={p.id}
                        product={p}
                        selected={selectedProductId === p.id}
                        onSelect={() => onSelect(p)}
                      />
                    );
                  const listClass =
                    displayMode === "tekst"
                      ? "space-y-2"
                      : "grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4";
                  if (brand === "Spanl") {
                    // Group by finish family, sort each group by panel width
                    // (widest first). Without this, the 24 Spanl SKUs render
                    // as one long flat list and panels like YMPB9003A get
                    // buried near the bottom.
                    const groups = SPANL_FAMILY_ORDER
                      .map((family) => ({
                        family,
                        items: items
                          .filter((p) => p.spanlFinish === family)
                          .sort((a, b) => a.name.localeCompare(b.name)),
                      }))
                      .filter((g) => g.items.length > 0);
                    return (
                      <div key={brand}>
                        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.15em] text-stone-500">
                          {brand}
                        </p>
                        <div className="space-y-4">
                          {groups.map(({ family, items: familyItems }) => (
                            <div key={family}>
                              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.15em] text-stone-400">
                                {t(`finish.${family}`)}
                                <span className="ml-2 normal-case tracking-normal text-stone-400">
                                  · {familyItems[0]?.spanlPanelWidthCm} cm
                                </span>
                              </p>
                              <div className={listClass}>
                                {familyItems.map(renderEntry)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={brand}>
                      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.15em] text-stone-500">
                        {brand}
                      </p>
                      <div className={listClass}>
                        {items.map(renderEntry)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {selectedProduct && (
                <div>
                  <label className="mb-1 block text-sm font-medium">{t("render.orientation")}</label>
                  <select
                    className="w-full rounded-xl border border-black p-3"
                    value={orientation}
                    onChange={(e) => setOrientation(e.target.value as Orientation)}
                  >
                    {selectedProduct.orientations.map((o) => (
                      <option key={o} value={o}>
                        {o === "horizontal" ? t("render.horizontal") : t("render.vertical")}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {selectedProduct && (
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    {t("gc.insideCornerCount")}
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    value={insideCornerCount}
                    onChange={(e) => setInsideCornerCount(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-xl border border-black p-3"
                  />
                  <p className="mt-1 text-xs text-stone-500">
                    {t("gc.insideCornerHint")}
                  </p>
                </div>
              )}
            </div>
            {selectedProduct && (
              <div className="mt-4 flex flex-col gap-4 rounded-xl border border-black p-4 sm:flex-row">
                {selectedProduct.brand === "Spanl" && (
                  <SpanlThumb productId={selectedProduct.id} productName={selectedProduct.name} />
                )}
                {selectedProduct.brand === "Keralit" && (
                  <KeralitThumb
                    productName={selectedProduct.name}
                    selectedNumber={keralitColorNumber}
                  />
                )}
                <div className="flex-1">
                <h3 className="font-semibold">
                  {selectedProduct.brand} - {selectedProduct.name}
                </h3>
                <p className="mt-2 text-sm">{selectedProduct.description}</p>
                {selectedProduct.type === "panel" && (
                  <>
                    <p className="mt-2 text-sm">
                      {t("gc.panelInfo", { length: selectedProduct.panelLength, work: selectedProduct.panelWorkSize })}
                    </p>
                    <p className="mt-1 text-sm">{t("gc.panelArea", { area: selectedProduct.panelAreaM2 })}</p>
                    <p className="mt-1 text-sm">
                      {t("gc.pricePerPanel", {
                        price: (selectedProduct.pricePerPanelExVat ?? selectedProduct.panelAreaM2 * selectedProduct.pricePerM2ExVat).toFixed(2),
                      })}
                    </p>
                  </>
                )}
                {selectedProduct.type === "paint" && (
                  <p className="mt-2 text-sm">{t("gc.pricePerM2", { price: selectedProduct.pricePerM2ExVat.toFixed(2) })}</p>
                )}
                <p className="mt-1 text-sm">{t("gc.wasteFactor", { percent: selectedProduct.wasteFactor })}</p>
                <p className="mt-3 text-xs text-gray-400 border-t border-gray-200 pt-3">
                  {t("gc.priceDisclaimer")}
                </p>
                </div>
              </div>
            )}

            {selectedProduct?.brand === "Keralit" && (
              <KeralitColorPicker
                selectedNumber={keralitColorNumber}
                onSelect={setKeralitColorNumber}
              />
            )}

            {selectedProduct?.insulationValue && locale === "nl" && (
              <div className="mt-4 rounded-xl border-2 border-amber-400 bg-amber-50 p-3 text-sm print-hidden">
                <p className="font-semibold text-amber-900">
                  💡 Subsidie beschikbaar voor isolatie via ISDE
                </p>
                <a
                  href="/subsidie"
                  className="mt-1 inline-block text-xs font-semibold text-amber-900 underline underline-offset-2"
                >
                  Bekijk regelingen →
                </a>
              </div>
            )}
          </section>
          )}

          {/* Bottom material-calculation block removed — the right-column
              "04 — Totaaloverzicht" aside shows the same numbers. */}
        </div>

        <div
          className="fixed inset-x-0 bottom-0 z-30 hidden border-t border-black bg-white px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:block print:hidden"
        >
          <div className="mx-auto max-w-[1400px]">
            {/* Mobile: 2-col grid with primaries side-by-side, Reset
                full-width at the bottom (less prominent, harder to tap
                accidentally). Desktop: original flex layout, all on one
                row right-aligned.
                Prijzen-meenemen toggle lives in the right-column
                "Wilt u een offerte aanvragen?" card — single canonical
                action point. */}
            <div className="grid grid-cols-2 items-center gap-2 pb-1 md:flex md:flex-wrap">
              <Link
                href={selectedProduct ? `/render?product=${encodeURIComponent(selectedProduct.id)}` : "/render"}
                className={`rounded-xl px-4 py-2.5 text-center text-sm font-medium ${
                  selectedProduct
                    ? "border border-ink text-ink"
                    : "border border-stone-300 text-stone-400 cursor-not-allowed"
                }`}
                aria-disabled={!selectedProduct}
                onClick={(e) => {
                  if (!selectedProduct) e.preventDefault();
                }}
              >
                {t("gc.viewRender")}
              </Link>
              {/* Primary action — same handler as the right-column
                  "Vraag offerte aan" card. Putting it in the always-
                  visible bottom bar means mobile users don't need to
                  scroll past the entire form to find it.
                  The mailto: button that sat here previously opened
                  the OS mail-app picker with no PDF attached, which
                  confused users into thinking that was the offerte
                  flow. Removed. */}
              <button
                type="button"
                onClick={downloadOfferte}
                disabled={offerteSubmitting || !selectedProduct || !materialResult}
                className="rounded-xl bg-black px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
              >
                {offerteSubmitting ? t("gc.btnExportPdfBusy") : "Vraag offerte aan"}
              </button>
              {mode === "advanced" && (
                <>
                  <button type="button" onClick={exportConfig} className="rounded-xl border border-black px-3 py-2 text-sm">
                    {t("gc.btnExportConfig")}
                  </button>
                  <label className="cursor-pointer rounded-xl border border-black px-3 py-2 text-center text-sm">
                    {t("gc.btnLoadConfig")}
                    <input
                      type="file"
                      accept=".config,application/json"
                      className="hidden"
                      onChange={(e) => importConfig(e.target.files?.[0] ?? null)}
                    />
                  </label>
                </>
              )}
              <button
                type="button"
                onClick={resetData}
                className="col-span-2 rounded-xl border border-red-600 px-3 py-2 text-sm text-red-600 md:col-auto"
              >
                {t("gc.btnReset")}
              </button>
            </div>
          </div>
          </div>
          <aside className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto print-hidden">
            <header>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-stone-500">
                04 — {t("gc.totalsOverview")}
              </p>
            </header>

            {/* Totals: gross / openings / net */}
            <div className="border border-stone-200 bg-paper p-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-stone-500">
                    {t("gc.totalGross")}
                  </p>
                  <p className="mt-1 font-display text-lg text-ink">{totals.gross.toFixed(2)}<span className="ml-1 font-mono text-xs text-stone-500">m²</span></p>
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-stone-500">
                    {t("gc.totalOpenings")}
                  </p>
                  <p className="mt-1 font-display text-lg text-ink">{totals.openings.toFixed(2)}<span className="ml-1 font-mono text-xs text-stone-500">m²</span></p>
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-stone-500">
                    {t("gc.totalNet")}
                  </p>
                  <p className="mt-1 font-display text-lg text-ink">{totals.net.toFixed(2)}<span className="ml-1 font-mono text-xs text-stone-500">m²</span></p>
                </div>
              </div>
            </div>

            {/* AI render preview — visible when the user arrived here
                via /render's "Bereken materiaal →" handoff. Confirms
                visually which render lands in the offerte PDF. */}
            {renderPreviewUrl && (
              <div className="border border-stone-200 bg-paper p-4">
                <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.15em] text-stone-500">
                  {locale === "nl"
                    ? "Render uit /render"
                    : locale === "de"
                      ? "Render aus /render"
                      : locale === "fr"
                        ? "Rendu depuis /render"
                        : locale === "es"
                          ? "Render desde /render"
                          : "Render from /render"}
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={renderPreviewUrl}
                  alt=""
                  className="block w-full border border-stone-200 object-contain"
                />
              </div>
            )}

            {/* Question-driven flow on the right column.
                Order: alt-orientation question → primary BOM → alt BOM
                (when toggled) → offerte question + CTA. Each Q-card
                has the same shape so the eye reads them as a sequence
                of choices rather than a wall of info. */}

            {/* Verticale/horizontale optie? — only when product supports
                both. Toggling expands a second BOM after the primary. */}
            {selectedProduct && materialResult && alternateMaterialResult && (
              <label className="flex cursor-pointer items-start gap-3 border border-stone-300 bg-stone-50 p-4">
                <input
                  type="checkbox"
                  checked={showAlternateOrientation}
                  onChange={(e) => setShowAlternateOrientation(e.target.checked)}
                  className="mt-0.5 h-4 w-4 flex-shrink-0 border-stone-400"
                />
                <div className="text-sm">
                  <span className="font-display text-ink">
                    Verticale optie ook bekijken?
                  </span>
                  <span className="mt-0.5 block text-[12px] text-stone-600">
                    {alternateOrientation === "vertical"
                      ? "Hetzelfde paneel kan ook verticaal — vergelijk aantallen en prijs."
                      : "Hetzelfde paneel kan ook horizontaal — vergelijk aantallen en prijs."}
                  </span>
                </div>
              </label>
            )}

            {/* Material summary — primary BOM in chosen orientation. */}
            {selectedProduct && materialResult &&
              bomBlock(materialResult, showAlternateOrientation ? orientationLabel(orientation) : undefined)}

            {showAlternateOrientation && alternateMaterialResult &&
              bomBlock(alternateMaterialResult, orientationLabel(alternateOrientation))}

            {/* Wilt u een offerte aanvragen? — primary CTA card with
                the action button. Moved out of the fixed bottom bar so
                the right-column flow is self-contained: see totals →
                see BOM → ask for offerte. */}
            {selectedProduct && materialResult && (
              <div className="border border-ink bg-paper p-4">
                <p className="font-display text-base text-ink">
                  Wilt u een offerte aanvragen?
                </p>
                <p className="mt-1 text-[12px] leading-snug text-stone-600">
                  Je offerte gaat naar Renisual. Wij sturen hem naar de juiste
                  leverancier(s). Vul je achternaam, e-mail en adres in zodat
                  we — en de leverancier — contact op kunnen nemen.
                </p>
                <p className="mt-1.5 text-[11px] leading-snug text-stone-500">
                  Wilt u zelf dit traject doen, dan kunt u de PDF opslaan en
                  gebruiken als offerte.
                </p>
                <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-md border border-stone-300 bg-stone-50 p-2.5 text-[12px] text-stone-700 select-none">
                  <input
                    type="checkbox"
                    checked={includePrices}
                    onChange={(e) => setIncludePrices(e.target.checked)}
                    className="mt-0.5 h-4 w-4 flex-shrink-0"
                  />
                  <span>
                    <span className="block font-medium text-ink">
                      Richtprijzen meenemen in PDF
                    </span>
                    <span className="block text-[11px] text-stone-600">
                      Standaard zonder prijzen — vink aan voor een PDF met indicatieve
                      paneel- en profielprijzen incl. BTW.
                    </span>
                  </span>
                </label>
                {renderPreviewUrl && (
                  <label className="mt-2 flex cursor-pointer items-start gap-2 rounded-md border border-stone-300 bg-stone-50 p-2.5 text-[12px] text-stone-700 select-none">
                    <input
                      type="checkbox"
                      checked={includeRenderPhoto}
                      onChange={(e) => setIncludeRenderPhoto(e.target.checked)}
                      className="mt-0.5 h-4 w-4 flex-shrink-0"
                    />
                    <span>
                      <span className="block font-medium text-ink">
                        Visualisatie-foto meesturen
                      </span>
                      <span className="block text-[11px] text-stone-600">
                        De visualisatie uit /render wordt mee in de PDF en als
                        bijlage bij de mail. Vink uit als de visualisatie niet bij
                        deze offerte hoort (bv. na het laden van een oude config).
                      </span>
                    </span>
                  </label>
                )}
                <button
                  type="button"
                  onClick={downloadOfferte}
                  disabled={offerteSubmitting}
                  className="mt-3 flex w-full items-center justify-center gap-2 bg-ink px-6 py-3 font-mono text-[11px] uppercase tracking-[0.15em] text-paper transition-colors hover:bg-stone-800 disabled:opacity-50"
                >
                  <span>
                    {offerteSubmitting ? t("gc.btnExportPdfBusy") : "Vraag offerte aan"}
                  </span>
                  <span aria-hidden>→</span>
                </button>
                {offerteResult && (
                  <a
                    href={offerteResult.offerteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 block text-center text-[11px] text-stone-600 underline underline-offset-2 hover:text-ink"
                  >
                    {t("gc.offerte.successOpenPage")} → {offerteResult.ref}
                  </a>
                )}
              </div>
            )}

            {/* "Geselecteerd product + Naar de rendering" card removed
                — it duplicated the compact picker chip at the top of
                the form (selected product display) and the bottom-bar
                "Bekijk de rendering" link (navigation). The collapsed
                chip + the calc-state-preserving auto-save effect cover
                both functions without a redundant aside section. */}
          </aside>
        </div>
      </main>
    </>
  );
}
