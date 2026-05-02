"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { products, type Orientation } from "@/lib/productCatalog";
import type { SpanlFinish } from "@/lib/spanlPanelCatalog";
import {
  type CalcSide,
  type OpeningGroup,
  calculateMaterialResult,
  calculateSideNetM2,
  round2,
  toNumber,
} from "@/lib/calcEngine";
import { usePhotoStore } from "@/lib/usePhotoStore";
import { useLocale } from "@/lib/i18n";

const STORAGE_KEY = "renisual-gevelcalc-v1";
const MAX_SIDES = 10;
const QUICK_WINDOW_M2 = 1.5;
const QUICK_DOOR_M2 = 2.0;

// Display order for Spanl finish families, sorted by panel width
// (widest first). Within a family panels share the same width.
const SPANL_FAMILY_ORDER: SpanlFinish[] = [
  "monoFlat",
  "monoGroove",
  "wood",
  "spanishTile",
  "strip",
  "brick",
];

type Tab = "sides" | "product" | "total" | "render";

type StoredConfig = {
  sides: CalcSide[];
  selectedProductId?: string;
  orientation?: Orientation;
};

const sideNames = ["Voorgevel", "Achtergevel", "Linkergevel", "Rechtergevel"];

function makeSide(index: number): CalcSide {
  return {
    id: crypto.randomUUID(),
    name: sideNames[index] ?? `Gevel ${index + 1}`,
    width: "",
    height: "",
    openings: [],
  };
}

function makeOpening(type: "window" | "door"): OpeningGroup {
  return {
    id: crypto.randomUUID(),
    type,
    label: type === "window" ? "Raam" : "Deur",
    width: type === "window" ? "120" : "100",
    height: type === "window" ? "120" : "215",
    count: "1",
  };
}

function fmtEur(n: number): string {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n);
}

export default function MobileGevelcalcPage() {
  const { t } = useLocale();
  const [sides, setSides] = useState<CalcSide[]>(() => [makeSide(0)]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id ?? "");
  const [orientation, setOrientation] = useState<Orientation>("horizontal");
  const [tab, setTab] = useState<Tab>("sides");
  const [hydrated, setHydrated] = useState(false);
  const photoStore = usePhotoStore();
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredConfig;
        if (Array.isArray(parsed.sides) && parsed.sides.length > 0) setSides(parsed.sides);
        if (parsed.selectedProductId) setSelectedProductId(parsed.selectedProductId);
        if (parsed.orientation) setOrientation(parsed.orientation);
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const existingRaw = localStorage.getItem(STORAGE_KEY);
      const existing = existingRaw ? (JSON.parse(existingRaw) as Record<string, unknown>) : {};
      const merged = { ...existing, sides, selectedProductId, orientation };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch {
      /* ignore */
    }
  }, [hydrated, sides, selectedProductId, orientation]);

  useEffect(() => {
    photoStore.loadAllPhotos(sides.map((s) => s.id)).then(setPhotos).catch(() => {});
  }, [sides, photoStore]);

  const product = useMemo(
    () => products.find((p) => p.id === selectedProductId) ?? products[0],
    [selectedProductId]
  );

  const activeSide = sides[activeIdx] ?? sides[0];

  const result = useMemo(() => {
    if (!product) return null;
    return calculateMaterialResult({ sides, product, orientation });
  }, [sides, product, orientation]);

  function updateActiveSide(patch: Partial<CalcSide>) {
    setSides((prev) => prev.map((s, i) => (i === activeIdx ? { ...s, ...patch } : s)));
  }

  function addSide() {
    if (sides.length >= MAX_SIDES) return;
    const newSide = makeSide(sides.length);
    setSides((prev) => [...prev, newSide]);
    setActiveIdx(sides.length);
  }

  function removeActiveSide() {
    if (sides.length <= 1) return;
    const removedId = activeSide.id;
    setSides((prev) => prev.filter((_, i) => i !== activeIdx));
    setActiveIdx((idx) => Math.max(0, idx - 1));
    photoStore.deletePhoto(removedId).catch(() => {});
  }

  function adjustOpenings(type: "window" | "door", delta: number) {
    const existing = activeSide.openings.find((o) => o.type === type);
    if (!existing) {
      if (delta <= 0) return;
      updateActiveSide({ openings: [...activeSide.openings, { ...makeOpening(type), count: String(delta) }] });
      return;
    }
    const next = Math.max(0, toNumber(existing.count) + delta);
    if (next === 0) {
      updateActiveSide({ openings: activeSide.openings.filter((o) => o.id !== existing.id) });
    } else {
      updateActiveSide({
        openings: activeSide.openings.map((o) =>
          o.id === existing.id ? { ...o, count: String(next) } : o
        ),
      });
    }
  }

  function openingCount(type: "window" | "door"): number {
    const existing = activeSide.openings.find((o) => o.type === type);
    return existing ? toNumber(existing.count) : 0;
  }

  async function handlePhotoFile(file: File | null) {
    if (!file || !file.type.startsWith("image/")) return;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    await photoStore.savePhoto(activeSide.id, dataUrl);
    setPhotos((prev) => ({ ...prev, [activeSide.id]: dataUrl }));
  }

  const touchStartX = useRef<number | null>(null);
  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  }
  function handleTouchEnd(e: React.TouchEvent) {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start == null) return;
    const end = e.changedTouches[0]?.clientX ?? start;
    const delta = end - start;
    if (Math.abs(delta) < 60) return;
    if (delta < 0 && activeIdx < sides.length - 1) setActiveIdx(activeIdx + 1);
    else if (delta > 0 && activeIdx > 0) setActiveIdx(activeIdx - 1);
  }

  const sideNetM2 = activeSide ? calculateSideNetM2(activeSide) : 0;
  const widthCm = toNumber(activeSide?.width ?? "");
  const heightCm = toNumber(activeSide?.height ?? "");

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#f6f4ef] pb-24">
      <header className="sticky top-0 z-10 border-b border-black bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          <Link href="/" aria-label="Home" className="text-lg font-semibold">
            Renisual — gevelcalc
          </Link>
          <Link href="/gevelcalc" className="text-xs text-gray-600 underline">
            Desktop
          </Link>
        </div>
      </header>

      {tab === "sides" && (
        <main className="flex-1" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          <div className="flex items-center gap-2 overflow-x-auto px-4 pt-3">
            {sides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveIdx(i)}
                className={`min-h-[44px] shrink-0 rounded-full border px-4 text-sm ${
                  i === activeIdx ? "border-black bg-black text-white" : "border-black bg-white"
                }`}
              >
                {s.name}
              </button>
            ))}
            {sides.length < MAX_SIDES && (
              <button
                type="button"
                onClick={addSide}
                className="min-h-[44px] shrink-0 rounded-full border border-dashed border-black bg-white px-4 text-sm"
              >
                + Gevel
              </button>
            )}
          </div>

          <section className="space-y-4 px-4 pt-4">
            <div className="rounded-2xl border border-black bg-white p-4">
              <label className="mb-2 block text-sm font-medium">Naam</label>
              <input
                type="text"
                value={activeSide.name}
                onChange={(e) => updateActiveSide({ name: e.target.value })}
                className="min-h-[48px] w-full rounded-xl border border-black px-3 text-base"
              />

              <div className="mt-4 grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Breedte (cm)</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={activeSide.width}
                    onChange={(e) => updateActiveSide({ width: e.target.value })}
                    className="min-h-[48px] w-full rounded-xl border border-black px-3 text-lg"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Hoogte (cm)</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={activeSide.height}
                    onChange={(e) => updateActiveSide({ height: e.target.value })}
                    className="min-h-[48px] w-full rounded-xl border border-black px-3 text-lg"
                  />
                </label>
              </div>
              <p className="mt-2 text-xs text-gray-600">
                {widthCm > 0 && heightCm > 0
                  ? `${round2((widthCm * heightCm) / 10000)} m² bruto`
                  : "Vul breedte en hoogte in"}
              </p>
            </div>

            <div className="rounded-2xl border border-black bg-white p-4">
              <p className="mb-3 text-sm font-medium">Openingen</p>
              <OpeningRow
                label="Ramen"
                hint={`~${QUICK_WINDOW_M2} m² per stuk`}
                count={openingCount("window")}
                onAdd={() => adjustOpenings("window", 1)}
                onRemove={() => adjustOpenings("window", -1)}
              />
              <OpeningRow
                label="Deuren"
                hint={`~${QUICK_DOOR_M2} m² per stuk`}
                count={openingCount("door")}
                onAdd={() => adjustOpenings("door", 1)}
                onRemove={() => adjustOpenings("door", -1)}
              />
              <p className="mt-3 text-sm text-gray-700">
                Netto: <span className="font-semibold">{round2(sideNetM2)} m²</span>
              </p>
            </div>

            <div className="rounded-2xl border border-black bg-white p-4">
              <p className="mb-3 text-sm font-medium">Foto van deze gevel</p>
              {photos[activeSide.id] ? (
                <div className="space-y-3">
                  <img
                    src={photos[activeSide.id]}
                    alt={activeSide.name}
                    className="block aspect-[4/3] w-full rounded-xl border border-black object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => cameraRef.current?.click()}
                    className="min-h-[48px] w-full rounded-xl border border-black bg-white text-base font-medium"
                  >
                    Foto wijzigen
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => cameraRef.current?.click()}
                  className="flex min-h-[120px] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-black bg-neutral-50 text-base font-semibold"
                >
                  <span aria-hidden className="text-3xl">📷</span>
                  <span>Foto kiezen</span>
                  <span className="text-xs font-normal text-gray-600">{t("photo_upload_subtitle")}</span>
                </button>
              )}
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handlePhotoFile(e.target.files?.[0] ?? null)}
              />
            </div>

            {sides.length > 1 && (
              <button
                type="button"
                onClick={removeActiveSide}
                className="min-h-[48px] w-full rounded-xl border border-red-500 bg-white text-base font-medium text-red-700"
              >
                Verwijder {activeSide.name}
              </button>
            )}

            <p className="pb-4 text-center text-xs text-gray-500">
              Veeg ◀ ▶ om tussen gevels te wisselen
            </p>
          </section>
        </main>
      )}

      {tab === "product" && (
        <main className="flex-1 px-4 pt-4">
          <div className="mb-4 flex gap-2">
            <button
              type="button"
              onClick={() => setOrientation("horizontal")}
              className={`min-h-[48px] flex-1 rounded-xl border px-3 text-sm ${
                orientation === "horizontal" ? "border-black bg-black text-white" : "border-black bg-white"
              }`}
            >
              Horizontaal
            </button>
            <button
              type="button"
              onClick={() => setOrientation("vertical")}
              className={`min-h-[48px] flex-1 rounded-xl border px-3 text-sm ${
                orientation === "vertical" ? "border-black bg-black text-white" : "border-black bg-white"
              }`}
            >
              Verticaal
            </button>
          </div>
          <div className="space-y-4">
            {(() => {
              const visible = products.filter((p) => p.orientations.includes(orientation));
              const renderCard = (p: (typeof visible)[number]) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedProductId(p.id)}
                  className={`block w-full rounded-2xl border p-3 text-left ${
                    p.id === selectedProductId ? "border-black bg-neutral-100" : "border-black bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">
                      {p.brand} — {p.name}
                    </span>
                    <span className="text-sm">{fmtEur(p.pricePerM2ExVat)}/m²</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-600">{p.description}</p>
                </button>
              );
              const spanl = visible.filter((p) => p.brand === "Spanl");
              const others = visible.filter((p) => p.brand !== "Spanl");
              const spanlGroups = SPANL_FAMILY_ORDER
                .map((family) => ({
                  family,
                  items: spanl
                    .filter((p) => p.spanlFinish === family)
                    .sort((a, b) => a.name.localeCompare(b.name)),
                }))
                .filter((g) => g.items.length > 0);
              return (
                <>
                  {spanlGroups.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Spanl</p>
                      {spanlGroups.map(({ family, items }) => (
                        <div key={family} className="space-y-2">
                          <p className="text-[11px] uppercase tracking-wide text-gray-400">
                            {t(`finish.${family}`)} · {items[0]?.spanlPanelWidthCm} cm
                          </p>
                          {items.map(renderCard)}
                        </div>
                      ))}
                    </div>
                  )}
                  {others.length > 0 && (
                    <div className="space-y-2">
                      {others.map(renderCard)}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </main>
      )}

      {tab === "total" && result && product && (
        <main className="flex-1 space-y-3 px-4 pt-4">
          <div className="rounded-2xl border border-black bg-white p-4">
            <p className="text-xs uppercase text-gray-500">Geselecteerd</p>
            <p className="font-semibold">
              {product.brand} — {product.name}
            </p>
            <p className="text-xs text-gray-600">
              {orientation === "horizontal" ? "Horizontaal" : "Verticaal"}
            </p>
          </div>
          <Row label="Bruto m²" value={`${round2(result.totals.gross)} m²`} />
          <Row label="Openingen" value={`-${round2(result.totals.openings)} m²`} />
          <Row label="Netto" value={`${round2(result.totals.net)} m²`} bold />
          <Row label={`Met ${product.wasteFactor}% snijverlies`} value={`${round2(result.netWithWaste)} m²`} />
          {product.type === "panel" && (
            <Row label="Aantal panelen" value={`${result.panelCount}`} />
          )}
          <Row label="Materiaal excl. BTW" value={fmtEur(result.materialPriceExVat)} bold />
          {result.profileItems.length > 0 && (
            <div className="rounded-2xl border border-black bg-white p-4">
              <p className="mb-2 text-sm font-medium">Profielen</p>
              {result.profileItems.map((pc) => (
                <div key={pc.label} className="flex justify-between py-0.5 text-sm">
                  <span>
                    {pc.label} ({pc.count}×)
                  </span>
                  <span>{fmtEur(pc.totalExVat)}</span>
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {tab === "render" && (
        <main className="flex-1 px-4 pt-4">
          <p className="mb-4 text-sm">
            Maak een fotorealistische render van een gevel met het geselecteerde materiaal.
          </p>
          <Link
            href="/render"
            className="flex min-h-[64px] items-center justify-center rounded-2xl border border-black bg-black text-base font-semibold text-white"
          >
            Open render-tool
          </Link>
          <p className="mt-3 text-xs text-gray-600">
            De gevel-foto's en afmetingen die je hier hebt ingevuld zijn beschikbaar in /render.
          </p>
        </main>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-black bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-4">
          <NavBtn label="Gevels" active={tab === "sides"} onClick={() => setTab("sides")} icon="📐" />
          <NavBtn label="Materiaal" active={tab === "product"} onClick={() => setTab("product")} icon="🎨" />
          <NavBtn label="Totaal" active={tab === "total"} onClick={() => setTab("total")} icon="∑" />
          <NavBtn label="Render" active={tab === "render"} onClick={() => setTab("render")} icon="✨" />
        </div>
      </nav>
    </div>
  );
}

function OpeningRow({
  label,
  hint,
  count,
  onAdd,
  onRemove,
}: {
  label: string;
  hint: string;
  count: number;
  onAdd: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-neutral-200 py-2 last:border-b-0">
      <div>
        <p className="text-base font-medium">{label}</p>
        <p className="text-xs text-gray-500">{hint}</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onRemove}
          disabled={count === 0}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-black bg-white text-xl disabled:opacity-30"
          aria-label={`Verwijder ${label.toLowerCase()}`}
        >
          −
        </button>
        <span className="min-w-[32px] text-center text-lg font-semibold">{count}</span>
        <button
          type="button"
          onClick={onAdd}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-black bg-black text-xl text-white"
          aria-label={`Voeg ${label.toLowerCase()} toe`}
        >
          +
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between rounded-xl border border-black bg-white px-4 py-3 ${bold ? "font-semibold" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function NavBtn({
  label,
  active,
  onClick,
  icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[60px] flex-col items-center justify-center gap-0.5 px-2 py-1.5 text-xs ${
        active ? "font-semibold text-black" : "text-gray-600"
      }`}
    >
      <span aria-hidden className="text-lg">
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}
