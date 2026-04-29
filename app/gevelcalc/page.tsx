"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { products, categoryForType, type Orientation, type ProductCategory } from "@/lib/productCatalog";
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
  type ProfileCalculation,
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

const MAX_SIDES = 10;
const STORAGE_KEY = "renisual-gevelcalc-v1";

const QUICK_WINDOW_M2 = 1.5;
const QUICK_DOOR_M2 = 2.0;
const M2_TO_FT2 = 10.7639;
const QUICK_SIDE_ID = "quick-side";

type Mode = "quick" | "advanced";
type Unit = "m2" | "ft2";

function sideKeyForIndex(i: number): string {
  return ["gc.side.front", "gc.side.back", "gc.side.left", "gc.side.right"][i] ?? "gc.side.numbered";
}

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
      <span className={`relative h-6 w-11 rounded-full border border-black ${checked ? "bg-black" : "bg-white"}`}>
        <span className={`absolute top-1 h-4 w-4 rounded-full transition ${checked ? "left-6 bg-white" : "left-1 bg-black"}`} />
      </span>
    </button>
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

function SpanlThumb({ productId, productName }: { productId: string; productName: string }) {
  const sku = productId.replace(/^spanl-/, "");
  const src = useSpanlImage(sku, productName);
  if (!src) return null;
  return (
    <img
      src={src}
      alt={productName}
      className="block aspect-[4/3] w-32 shrink-0 rounded-xl border border-black object-cover sm:w-40"
    />
  );
}

function KeralitThumb({
  productName,
  selectedNumber,
}: {
  productName: string;
  selectedNumber: number | null;
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
      className="block aspect-[4/3] w-32 shrink-0 rounded-xl border border-black object-cover sm:w-40"
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

function Toast({ message, type }: { message: string; type: "ok" | "error" }) {
  return (
    <div
      className={`fixed top-4 right-4 z-50 rounded-xl border px-5 py-3 text-sm font-medium shadow-md print:hidden ${
        type === "ok" ? "border-green-300 bg-green-50 text-green-800" : "border-red-300 bg-red-50 text-red-800"
      }`}
    >
      {message}
    </div>
  );
}

export default function GevelCalcPage() {
  const { t, locale } = useLocale();

  const [mode, setMode] = useState<Mode>("advanced");
  const [modeHydrated, setModeHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let resolved: Mode | null = null;
    const params = new URLSearchParams(window.location.search);
    const modus = params.get("modus");
    if (modus === "quick" || modus === "eenvoudig") resolved = "quick";
    else if (modus === "pro" || modus === "professional" || modus === "advanced") resolved = "advanced";
    if (!resolved) {
      const stored = window.localStorage.getItem("renisual-mode");
      if (stored === "quick" || stored === "advanced") resolved = stored;
    }
    if (resolved) setMode(resolved);
    setModeHydrated(true);
  }, []);

  useEffect(() => {
    if (!modeHydrated) return;
    try {
      window.localStorage.setItem("renisual-mode", mode);
    } catch {
      /* ignore */
    }
  }, [mode, modeHydrated]);
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
  const [totalDiscountPercent, setTotalDiscountPercent] = useState("0");
  const [showInclVat, setShowInclVat] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [calcDate, setCalcDate] = useState<string>("");
  const [toast, setToast] = useState<{ message: string; type: "ok" | "error" } | null>(null);

  const VAT = 1.21;
  const selectedProduct = products.find((p) => p.id === selectedProductId);
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

  const hasPhotos = Object.keys(photos).length > 0;

  // Initialise sides with translated names once locale is known
  useEffect(() => {
    setSides((prev) =>
      prev.map((s, i) => {
        const key = sideKeyForIndex(i);
        const defaultName = key === "gc.side.numbered" ? t(key, { n: i + 1 }) : t(key);
        // only rewrite if name was empty or matches a known default in any locale
        if (!s.name || s.name === "Voorzijde" || s.name === "Achterzijde" || s.name === "Linkerzijde" || s.name === "Rechterzijde") {
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
    toastTimer.current = setTimeout(() => setToast(null), 2500);
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

  const materialResult = useMemo(() => {
    if (!selectedProduct) return null;
    return calculateMaterialResult({
      sides: activeSides,
      product: selectedProduct,
      orientation,
      totalDiscountPercent,
      profiles: DEFAULT_SPANL_PROFILES,
    });
  }, [selectedProduct, orientation, activeSides, totalDiscountPercent]);

  const totals = materialResult?.totals ?? { gross: 0, openings: 0, net: 0 };

  function fmtMoney(amount: number) {
    const value = showInclVat ? round2(amount * VAT) : amount;
    return `€${value.toFixed(2)}`;
  }

  function validateForExport(): string | null {
    if (mode === "quick" && quickAreaToM2(quickTotalArea, unit) <= 0) return t("gc.error.fillArea");
    if (mode === "advanced" && activeSides.length === 0) return t("gc.error.fillSide");
    if (!selectedProduct) return t("gc.error.chooseProduct");
    return null;
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

  async function handleImageUpload(sideId: string, file: File | null) {
    if (!file || !file.type.startsWith("image/")) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      await savePhoto(sideId, dataUrl);
      setPhotos((prev) => ({ ...prev, [sideId]: dataUrl }));
    } catch {
      showToast(t("gc.toast.uploadFailed"), "error");
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
      totalDiscountPercent,
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
    setProjectName(data.projectName ?? "");
    setFrontBackSame(data.frontBackSame ?? false);
    setLeftRightSame(data.leftRightSame ?? false);
    setSelectedProductId(data.selectedProductId ?? "");
    setKeralitColorNumber(typeof data.keralitColorNumber === "number" ? data.keralitColorNumber : null);
    setOrientation(data.orientation ?? "horizontal");
    setTotalDiscountPercent(data.totalDiscountPercent ?? "0");
    setCalcDate(data.savedAt ?? "");
    if (data.photos) {
      setPhotos(data.photos);
      Object.entries(data.photos).forEach(([id, url]) => savePhoto(id, url).catch(() => {}));
    } else {
      const ids = data.mode === "quick" ? [QUICK_SIDE_ID] : (data.sides ?? []).map((s: CalcSide) => s.id);
      loadAllPhotos(ids).then(setPhotos).catch(() => {});
    }
  }

  function exportConfig() {
    const data = buildSaveData(true);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `renisual-${new Date().toISOString().slice(0, 10)}.config`;
    link.click();
    URL.revokeObjectURL(url);
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
    await clearAllPhotos().catch(() => {});
    setSides(createDefaultSides(t));
    setPhotos({});
    setProjectName("");
    setFrontBackSame(false);
    setLeftRightSame(false);
    setSelectedProductId("");
    setOrientation("horizontal");
    setTotalDiscountPercent("0");
    setCalcDate("");
    setQuickTotalArea("");
    setQuickWindowCount("0");
    setQuickDoorCount("0");
    showToast(t("gc.toast.dataCleared"));
  }

  function exportPdf() {
    const err = validateForExport();
    if (err) {
      showToast(err, "error");
      return;
    }
    setCalcDate(new Date().toISOString());
    setTimeout(() => window.print(), 100);
  }

  function sendMail() {
    const err = validateForExport();
    if (err) {
      showToast(err, "error");
      return;
    }
    const vatLabel = showInclVat ? t("gc.inclVat") : "excl.";
    const subject = encodeURIComponent(`${t("gc.email.subject")}${projectName ? ` — ${projectName}` : ""}`);
    const body = encodeURIComponent(
      `${t("gc.email.subject")}${projectName ? `\n${projectName}` : ""}\n${t("gc.dateLabel", { date: formatDate(new Date().toISOString(), locale) })}\n\n` +
        `${t("gc.totalGross")}: ${totals.gross.toFixed(2)} m²\n` +
        `${t("gc.totalOpenings")}: ${totals.openings.toFixed(2)} m²\n` +
        `${t("gc.totalNet")}: ${totals.net.toFixed(2)} m²\n\n` +
        `${t("gc.product")}: ${selectedProduct ? `${selectedProduct.brand} - ${selectedProduct.name}` : t("gc.notChosen")}\n` +
        `${t("gc.orientation" as never)}: ${orientation === "horizontal" ? t("render.horizontal") : t("render.vertical")}\n\n` +
        `${t("gc.netWithWaste")}: ${materialResult?.netWithWaste.toFixed(2) ?? "0.00"} m²\n` +
        `${t("gc.panelsNeeded")}: ${materialResult?.panelCount ?? 0}\n` +
        `${t("gc.materialPrice")} ${vatLabel}: ${fmtMoney(materialResult?.materialPriceExVat ?? 0)}\n` +
        `${t("gc.profilesPrice")} ${vatLabel}: ${fmtMoney(materialResult?.profilePriceExVat ?? 0)}\n` +
        `${t("gc.subtotal")} ${vatLabel}: ${fmtMoney(materialResult?.subtotalExVat ?? 0)}\n` +
        `${t("gc.discountLine", { percent: totalDiscountPercent })}: -${fmtMoney(materialResult?.totalDiscount ?? 0)}\n` +
        `${t("gc.totalAfterDiscount")} ${vatLabel}: ${fmtMoney(materialResult?.totalExVat ?? 0)}\n\n` +
        `${t("gc.priceDisclaimer")}\n`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  async function goToRender() {
    // 1. Make sure every photo currently in component state is also persisted
    //    to IndexedDB. After importing a config file the writes were fire-and-forget,
    //    so navigating before they completed left /render with no photo.
    const sidesToSync = mode === "quick" ? [quickSide] : sides;
    const sideIds = sidesToSync.map((s) => s.id);
    try {
      await Promise.all(
        sideIds
          .filter((id) => photos[id])
          .map((id) => savePhoto(id, photos[id]))
      );
    } catch {
      showToast(t("gc.toast.handoffFailed"), "error");
      return;
    }

    // 2. Hand off the config plus an inline photo map. /render prefers IndexedDB
    //    but falls back to this map if a side photo is missing there. Photos can
    //    be large; if sessionStorage rejects the payload, retry without them.
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(buildSaveData(true)));
    } catch {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(buildSaveData(false)));
      } catch {
        showToast(t("gc.toast.handoffFailed"), "error");
        return;
      }
    }

    window.location.href = "/render";
  }

  const unitLabel = unit === "ft2" ? "ft²" : "m²";
  const totalAreaPlaceholder = unit === "ft2" ? "e.g. 700" : t("gc.quick.totalAreaPlaceholder");

  // Quick mode derived values for display
  const quickTotalAreaM2 = quickAreaToM2(quickTotalArea, unit);
  const quickOpeningsM2 =
    toNumber(quickWindowCount) * QUICK_WINDOW_M2 + toNumber(quickDoorCount) * QUICK_DOOR_M2;
  const quickNetM2 = Math.max(0, quickTotalAreaM2 - quickOpeningsM2);
  const quickNetDisplay = m2ToUnit(quickNetM2, unit).toFixed(2);

  return (
    <>
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

      {toast && <Toast message={toast.message} type={toast.type} />}

      <main className="min-h-screen bg-[#f6f4ef] p-4 pb-40 text-black md:p-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <section className="rounded-2xl border border-black bg-white p-6 text-center print-hidden">
            <h1 className="text-3xl font-bold">{t("gc.title")}</h1>
            <p className="mt-2">{t("gc.subtitle")}</p>
          </section>

          <div className="hidden print:block mb-4">
            <h1 className="text-2xl font-bold">{t("gc.title")}</h1>
            {projectName && <p className="text-base font-medium mt-1">{projectName}</p>}
            {calcDate && <p className="text-sm text-gray-500 mt-1">{t("gc.dateLabel", { date: formatDate(calcDate, locale) })}</p>}
          </div>

          <section className="rounded-2xl border border-black bg-white p-4 print-hidden">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-lg font-semibold">{t("gc.mode")}</h2>
              <div className="inline-flex rounded-xl border border-black p-1">
                <button
                  type="button"
                  onClick={() => setMode("quick")}
                  className={`rounded-lg px-4 py-1.5 text-sm font-medium ${
                    mode === "quick" ? "bg-black text-white" : "bg-white text-black"
                  }`}
                >
                  {t("gc.mode.quick")}
                </button>
                <button
                  type="button"
                  onClick={() => setMode("advanced")}
                  className={`rounded-lg px-4 py-1.5 text-sm font-medium ${
                    mode === "advanced" ? "bg-black text-white" : "bg-white text-black"
                  }`}
                >
                  {t("gc.mode.advanced")}
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-black bg-white p-4 print-hidden">
            <h2 className="text-lg font-semibold">{t("gc.projectSettings")}</h2>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">{t("gc.projectName")}</label>
                <input
                  className="w-full rounded-xl border border-black p-3"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder={t("gc.projectNamePlaceholder")}
                />
              </div>
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

              <div
                className="mt-5 rounded-2xl border-2 border-dashed border-black p-4 text-center print-hidden"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleImageUpload(QUICK_SIDE_ID, e.dataTransfer.files?.[0] ?? null);
                }}
              >
                <label className="cursor-pointer inline-flex flex-col items-center gap-2">
                  <span className="rounded-xl bg-black text-white px-4 py-2 text-sm font-medium">
                    {photos[QUICK_SIDE_ID] ? t("gc.choosePhoto") : t("gc.quick.uploadPhoto")}
                  </span>
                  <span className="text-xs text-gray-400">{t("gc.dragDrop")}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleImageUpload(QUICK_SIDE_ID, e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>

              {photos[QUICK_SIDE_ID] && (
                <div className="mt-3 text-center">
                  <img src={photos[QUICK_SIDE_ID]} alt="" className="mx-auto max-h-[320px] w-full rounded-xl object-contain" />
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
                        onClick={() => removeSide(side.id)}
                        className="rounded-xl border border-black px-4 py-2 text-sm print-hidden"
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

                  <div
                    className="mt-5 rounded-2xl border-2 border-dashed border-black p-4 text-center print-hidden"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleImageUpload(side.id, e.dataTransfer.files?.[0] ?? null);
                    }}
                  >
                    <label className="cursor-pointer inline-flex flex-col items-center gap-2">
                      <span className="rounded-xl bg-black text-white px-4 py-2 text-sm font-medium">
                        {photo ? t("gc.choosePhoto") : t("gc.uploadPhoto")}
                      </span>
                      <span className="text-xs text-gray-400">{t("gc.dragDrop")}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleImageUpload(side.id, e.target.files?.[0] ?? null)}
                      />
                    </label>
                  </div>

                  {photo && (
                    <div className="mt-3 text-center">
                      <img src={photo} alt={side.name} className="mx-auto max-h-[320px] w-full rounded-xl object-contain" />
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

          <section className="rounded-2xl border border-black bg-white p-4 page-break-before">
            <h2 className="text-lg font-semibold">{t("gc.productChoice")}</h2>
            <div className="mt-3 inline-flex rounded-xl border border-black p-1 print-hidden">
              <button
                type="button"
                onClick={() => setProductCategory("gevelbekleding")}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  productCategory === "gevelbekleding" ? "bg-black text-white" : "bg-white text-black"
                }`}
              >
                Gevelbekleding
              </button>
              <button
                type="button"
                onClick={() => setProductCategory("kozijnen")}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  productCategory === "kozijnen" ? "bg-black text-white" : "bg-white text-black"
                }`}
              >
                Kozijnen
              </button>
              <button
                type="button"
                onClick={() => setProductCategory("isolatie")}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  productCategory === "isolatie" ? "bg-black text-white" : "bg-white text-black"
                }`}
              >
                Isolatie
              </button>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium">{t("gc.product")}</label>
                <select
                  className="w-full rounded-xl border border-black p-3"
                  value={selectedProductId}
                  onChange={(e) => {
                    const product = products.find((p) => p.id === e.target.value);
                    setSelectedProductId(e.target.value);
                    if (product?.orientations[0]) setOrientation(product.orientations[0]);
                    if (product?.brand !== "Keralit") setKeralitColorNumber(null);
                  }}
                >
                  <option value="">{t("gc.chooseProduct")}</option>
                  {brandsForCategory.map((brand) => (
                    <optgroup key={brand} label={brand}>
                      {productsByCategory
                        .filter((p) => p.brand === brand)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </div>
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
              {mode === "advanced" && (
                <div>
                  <label className="mb-1 block text-sm font-medium">{t("gc.discount")}</label>
                  <input
                    className="w-full rounded-xl border border-black p-3"
                    value={totalDiscountPercent}
                    onChange={(e) => setTotalDiscountPercent(e.target.value)}
                    placeholder={t("gc.discountPlaceholder")}
                  />
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

            {selectedProduct?.insulationValue && (
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

          <section className="rounded-2xl border border-black bg-white p-4">
            <h2 className="text-lg font-semibold">{t("gc.totalsOverview")}</h2>
            <div className="metrics-row mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-black p-3">
                <div className="text-xs text-gray-500">{t("gc.totalGross")}</div>
                <div className="text-base font-semibold">{totals.gross.toFixed(2)} m²</div>
              </div>
              <div className="rounded-xl border border-black p-3">
                <div className="text-xs text-gray-500">{t("gc.totalOpenings")}</div>
                <div className="text-base font-semibold">{totals.openings.toFixed(2)} m²</div>
              </div>
              <div className="rounded-xl border border-black p-3">
                <div className="text-xs text-gray-500">{t("gc.totalNet")}</div>
                <div className="text-base font-semibold">{totals.net.toFixed(2)} m²</div>
              </div>
            </div>
          </section>

          {selectedProduct && materialResult && (
            <section className="rounded-2xl border border-black bg-white p-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <h2 className="text-lg font-semibold">{t("gc.materialCalc")}</h2>
                {mode === "advanced" && (
                  <div className="w-64 print-hidden">
                    <ToggleSwitch checked={showInclVat} onChange={setShowInclVat} label={t("gc.inclVat")} />
                  </div>
                )}
              </div>
              <div className="metrics-row mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-black p-3">
                  <div className="text-xs text-gray-500">{t("gc.netWithWaste")}</div>
                  <div className="text-base font-semibold">{materialResult.netWithWaste.toFixed(2)} m²</div>
                </div>
                {selectedProduct.type === "panel" && (
                  <div className="rounded-xl border border-black p-3">
                    <div className="text-xs text-gray-500">{t("gc.panelsNeeded")}</div>
                    <div className="text-base font-semibold">{materialResult.panelCount}</div>
                  </div>
                )}
                <div className="rounded-xl border border-black p-3">
                  <div className="text-xs text-gray-500">{t("gc.materialPrice")}</div>
                  <div className="text-base font-semibold">{fmtMoney(materialResult.materialPriceExVat)}</div>
                </div>
              </div>
              {materialResult.profileItems.length > 0 && (
                <>
                  <h3 className="mt-6 font-semibold">{t("gc.profiles")}</h3>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="border border-black bg-neutral-100">
                          <th className="border border-black p-2 text-left">{t("gc.profileType")}</th>
                          <th className="border border-black p-2 text-left">{t("gc.profileName")}</th>
                          <th className="border border-black p-2 text-right">{t("gc.metersNeeded")}</th>
                          <th className="border border-black p-2 text-right">{t("gc.lengthEach")}</th>
                          <th className="border border-black p-2 text-right">{t("gc.count")}</th>
                          <th className="border border-black p-2 text-right">{t("gc.priceEach")}</th>
                          <th className="border border-black p-2 text-right">{t("gc.total")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {materialResult.profileItems.map((item: ProfileCalculation) => (
                          <tr key={item.label}>
                            <td className="border border-black p-2">{item.label}</td>
                            <td className="border border-black p-2">{item.name}</td>
                            <td className="border border-black p-2 text-right">{item.neededMeters.toFixed(2)} m</td>
                            <td className="border border-black p-2 text-right">{item.lengthMeters.toFixed(2)} m</td>
                            <td className="border border-black p-2 text-right">{item.count}</td>
                            <td className="border border-black p-2 text-right">{fmtMoney(item.priceEachExVat)}</td>
                            <td className="border border-black p-2 text-right">{fmtMoney(item.totalExVat)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              <div className="mt-4 rounded-xl border border-black p-4 text-sm space-y-1">
                <p>
                  {t("gc.materialPrice")}: {fmtMoney(materialResult.materialPriceExVat)}
                </p>
                {materialResult.profileItems.length > 0 && (
                  <p>
                    {t("gc.profilesPrice")}: {fmtMoney(materialResult.profilePriceExVat)}
                  </p>
                )}
                <p>
                  {t("gc.subtotal")}: {fmtMoney(materialResult.subtotalExVat)}
                </p>
                <p>
                  {t("gc.discountLine", { percent: totalDiscountPercent })}: -{fmtMoney(materialResult.totalDiscount)}
                </p>
                <p className="font-semibold pt-1 border-t border-black">
                  {t("gc.totalAfterDiscount")}: {fmtMoney(materialResult.totalExVat)}
                </p>
                <p className="mt-3 text-xs text-gray-400 border-t border-gray-200 pt-3">
                  {t("gc.priceDisclaimer")}
                </p>
              </div>
            </section>
          )}

          <div className="hidden print:block mt-6 pt-4 border-t border-gray-300 text-xs text-gray-400">
            <p>{t("gc.priceDisclaimer")}</p>
            <p className="mt-2">
              {t("gc.title")}
              {projectName ? ` — ${projectName}` : ""}
              {calcDate ? ` — ${formatDate(calcDate, locale)}` : ""}
            </p>
          </div>
        </div>

        <div className="fixed inset-x-0 bottom-0 border-t border-black bg-white p-3 print:hidden">
          <div className="mx-auto max-w-6xl">
            {hasPhotos ? (
              <button
                type="button"
                onClick={goToRender}
                className="flex items-center justify-center w-full rounded-xl border-2 border-black bg-white text-black px-4 py-2.5 text-sm font-semibold mb-2 hover:bg-black hover:text-white transition-colors"
              >
                {t("gc.viewRender")}
              </button>
            ) : (
              <p className="text-xs text-center text-gray-400 mb-2 py-1">{t("gc.uploadHint")}</p>
            )}

            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {mode === "advanced" && (
                <button
                  type="button"
                  onClick={addSide}
                  disabled={sides.length >= MAX_SIDES}
                  className="flex-shrink-0 rounded-xl bg-black text-white px-4 py-2.5 text-sm font-medium disabled:opacity-40"
                >
                  {t("gc.btnAddSide")}
                </button>
              )}
              <button type="button" onClick={exportPdf} className="flex-shrink-0 rounded-xl bg-black text-white px-4 py-2.5 text-sm font-medium">
                {t("gc.btnExportPdf")}
              </button>
              <button type="button" onClick={sendMail} className="flex-shrink-0 rounded-xl bg-black text-white px-4 py-2.5 text-sm font-medium">
                {t("gc.btnMail")}
              </button>
              {mode === "advanced" && (
                <>
                  <div className="flex-shrink-0 h-6 w-px bg-black/20" />
                  <button type="button" onClick={exportConfig} className="flex-shrink-0 rounded-xl border border-black px-3 py-2 text-sm">
                    {t("gc.btnExportConfig")}
                  </button>
                  <label className="flex-shrink-0 cursor-pointer rounded-xl border border-black px-3 py-2 text-sm">
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
                className="flex-shrink-0 rounded-xl border border-red-600 text-red-600 px-3 py-2 text-sm"
              >
                {t("gc.btnReset")}
              </button>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
