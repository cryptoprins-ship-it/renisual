"use client";

import { useMemo, useState } from "react";
import { products, type Orientation } from "@/lib/productCatalog";
import { calculateMaterials } from "@/lib/calculateMaterials";

type YesNo = "yes" | "no";
type OpeningType = "window" | "door" | "other";

type OpeningGroup = {
  id: string;
  type: OpeningType;
  label: string;
  width: string;
  height: string;
  count: string;
};

type Side = {
  id: string;
  name: string;
  width: string;
  height: string;
  hasWindows: YesNo;
  hasDoors: YesNo;
  openings: OpeningGroup[];
  previewUrl: string;
  photoDataUrl: string;
};

const SIDE_NAMES = ["Voorzijde", "Achterzijde", "Linkerzijde", "Rechterzijde"];
const MAX_SIDES = 10;
const STORAGE_KEY = "renisual-gevelcalc-v1";

function toNumber(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function createOpening(type: OpeningType): OpeningGroup {
  return {
    id: crypto.randomUUID(),
    type,
    label: type === "window" ? "Kozijnen" : type === "door" ? "Deuren" : "Overige opening",
    width: "",
    height: "",
    count: "1",
  };
}

function createSide(index: number): Side {
  return {
    id: crypto.randomUUID(),
    name: SIDE_NAMES[index] ?? `Zijde ${index + 1}`,
    width: "",
    height: "",
    hasWindows: "no",
    hasDoors: "no",
    openings: [],
    previewUrl: "",
    photoDataUrl: "",
  };
}

function createDefaultSides() {
  return [createSide(0), createSide(1), createSide(2), createSide(3)];
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
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

export default function GevelCalcPage() {
  const [sides, setSides] = useState<Side[]>(createDefaultSides());
  const [frontBackSame, setFrontBackSame] = useState(false);
  const [leftRightSame, setLeftRightSame] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [orientation, setOrientation] = useState<Orientation>("horizontal");

  const selectedProduct = products.find((product) => product.id === selectedProductId);

  function getResolvedWidth(side: Side, index: number) {
    if (index === 1 && frontBackSame && sides[0]) return sides[0].width;
    if (index === 3 && leftRightSame && sides[2]) return sides[2].width;
    return side.width;
  }

  function getResolvedHeight(side: Side, index: number) {
    if (index === 1 && frontBackSame && sides[0]) return sides[0].height;
    if (index === 3 && leftRightSame && sides[2]) return sides[2].height;
    return side.height;
  }

  function grossM2(side: Side, index: number) {
    return round2((toNumber(getResolvedWidth(side, index)) / 100) * (toNumber(getResolvedHeight(side, index)) / 100));
  }

  function openingsM2(side: Side) {
    return round2(
      side.openings.reduce((sum, opening) => {
        return sum + (toNumber(opening.width) / 100) * (toNumber(opening.height) / 100) * toNumber(opening.count);
      }, 0)
    );
  }

  function netM2(side: Side, index: number) {
    return round2(Math.max(0, grossM2(side, index) - openingsM2(side)));
  }

  function updateSide(sideId: string, updater: (side: Side) => Side) {
    setSides((prev) => prev.map((side) => (side.id === sideId ? updater(side) : side)));
  }

  function addSide() {
    setSides((prev) => {
      if (prev.length >= MAX_SIDES) return prev;
      return [...prev, createSide(prev.length)];
    });
  }

  function removeSide(sideId: string) {
    setSides((prev) => prev.filter((side) => side.id !== sideId));
  }

  function setHasWindows(sideId: string, checked: boolean) {
    updateSide(sideId, (side) => ({
      ...side,
      hasWindows: checked ? "yes" : "no",
      openings: checked ? [createOpening("window"), ...side.openings.filter((o) => o.type !== "window")] : side.openings.filter((o) => o.type !== "window"),
    }));
  }

  function setHasDoors(sideId: string, checked: boolean) {
    updateSide(sideId, (side) => ({
      ...side,
      hasDoors: checked ? "yes" : "no",
      openings: checked ? [...side.openings.filter((o) => o.type !== "door"), createOpening("door")] : side.openings.filter((o) => o.type !== "door"),
    }));
  }

  function updateOpening(sideId: string, openingId: string, field: keyof OpeningGroup, value: string) {
    updateSide(sideId, (side) => ({
      ...side,
      openings: side.openings.map((opening) => (opening.id === openingId ? { ...opening, [field]: value } : opening)),
    }));
  }

  function addOpening(sideId: string, type: OpeningType) {
    updateSide(sideId, (side) => ({
      ...side,
      openings: [...side.openings, createOpening(type)],
    }));
  }

  function removeOpening(sideId: string, openingId: string) {
    updateSide(sideId, (side) => ({
      ...side,
      openings: side.openings.filter((opening) => opening.id !== openingId),
    }));
  }

  async function handleImageUpload(sideId: string, file: File | null) {
    if (!file || !file.type.startsWith("image/")) return;

    const dataUrl = await fileToDataUrl(file);

    updateSide(sideId, (side) => ({
      ...side,
      previewUrl: dataUrl,
      photoDataUrl: dataUrl,
    }));
  }

  const totals = useMemo(() => {
    return sides.reduce(
      (sum, side, index) => {
        sum.gross += grossM2(side, index);
        sum.openings += openingsM2(side);
        sum.net += netM2(side, index);
        return sum;
      },
      { gross: 0, openings: 0, net: 0 }
    );
  }, [sides, frontBackSame, leftRightSame]);

  const materialResult = useMemo(() => {
    if (!selectedProduct) return null;

    return calculateMaterials({
      netM2: round2(totals.net),
      product: selectedProduct,
      orientation,
    });
  }, [selectedProduct, orientation, totals.net]);

  function buildSaveData() {
    return {
      version: "renisual-gevelcalc-v1",
      savedAt: new Date().toISOString(),
      sides,
      frontBackSame,
      leftRightSame,
      selectedProductId,
      orientation,
      totals,
      materialResult,
    };
  }

  function saveToBrowser() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(buildSaveData()));
    alert("Berekening opgeslagen.");
  }

  function loadFromBrowser() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      alert("Geen opgeslagen berekening gevonden.");
      return;
    }

    const data = JSON.parse(raw);

    setSides(data.sides ?? createDefaultSides());
    setFrontBackSame(data.frontBackSame ?? false);
    setLeftRightSame(data.leftRightSame ?? false);
    setSelectedProductId(data.selectedProductId ?? "");
    setOrientation(data.orientation ?? "horizontal");
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(buildSaveData(), null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `renisual-gevelcalc-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();

    URL.revokeObjectURL(url);
  }

  async function importJson(file: File | null) {
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!Array.isArray(data.sides)) {
        alert("Ongeldig JSON-bestand.");
        return;
      }

      setSides(data.sides);
      setFrontBackSame(data.frontBackSame ?? false);
      setLeftRightSame(data.leftRightSame ?? false);
      setSelectedProductId(data.selectedProductId ?? "");
      setOrientation(data.orientation ?? "horizontal");

      alert("JSON geïmporteerd.");
    } catch {
      alert("Importeren mislukt.");
    }
  }

  function resetData() {
    localStorage.removeItem(STORAGE_KEY);
    setSides(createDefaultSides());
    setFrontBackSame(false);
    setLeftRightSame(false);
    setSelectedProductId("");
    setOrientation("horizontal");
  }

  return (
    <main className="min-h-screen bg-[#f6f4ef] p-4 pb-36 text-black md:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-2xl border border-black bg-white p-6 text-center">
          <h1 className="text-3xl font-bold">Renisual GevelCalc</h1>
          <p className="mt-2">Bereken bruto oppervlak, openingen, netto geveloppervlak, panelen en prijs.</p>
        </section>

        <section className="rounded-2xl border border-black bg-white p-4">
          <h2 className="text-lg font-semibold">Projectinstellingen</h2>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <ToggleSwitch checked={frontBackSame} onChange={setFrontBackSame} label="Voorzijde en achterzijde hebben dezelfde afmetingen" />
            <ToggleSwitch checked={leftRightSame} onChange={setLeftRightSame} label="Linkerzijde en rechterzijde hebben dezelfde afmetingen" />
          </div>
        </section>

        {sides.map((side, index) => {
          const isLinked = (index === 1 && frontBackSame) || (index === 3 && leftRightSame);

          return (
            <section key={side.id} className="rounded-2xl border border-black bg-white p-4 md:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">{side.name}</h2>
                  {isLinked && <p className="text-sm">Afmetingen worden automatisch overgenomen.</p>}
                </div>

                {sides.length > 1 && (
                  <button type="button" onClick={() => removeSide(side.id)} className="rounded-xl border border-black px-4 py-2">
                    Verwijder
                  </button>
                )}
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Breedte zijde (cm)</label>
                  <input
                    className="w-full rounded-xl border border-black p-3 disabled:bg-neutral-100"
                    value={getResolvedWidth(side, index)}
                    disabled={isLinked}
                    onChange={(e) => updateSide(side.id, (s) => ({ ...s, width: e.target.value }))}
                    placeholder="Bijv. 540"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Hoogte zijde (cm)</label>
                  <input
                    className="w-full rounded-xl border border-black p-3 disabled:bg-neutral-100"
                    value={getResolvedHeight(side, index)}
                    disabled={isLinked}
                    onChange={(e) => updateSide(side.id, (s) => ({ ...s, height: e.target.value }))}
                    placeholder="Bijv. 280"
                  />
                </div>
              </div>

              <div className="mt-5 rounded-2xl border-2 border-dashed border-black p-4 text-center">
                <p className="mb-3 text-sm font-semibold">Upload foto van deze zijde</p>
                <input type="file" accept="image/*" onChange={(e) => handleImageUpload(side.id, e.target.files?.[0] ?? null)} />

                {side.previewUrl && <img src={side.previewUrl} alt={side.name} className="mt-4 max-h-[320px] w-full rounded-xl object-contain" />}
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <ToggleSwitch checked={side.hasWindows === "yes"} onChange={(checked) => setHasWindows(side.id, checked)} label="Deze zijde heeft kozijnen" />
                <ToggleSwitch checked={side.hasDoors === "yes"} onChange={(checked) => setHasDoors(side.id, checked)} label="Deze zijde heeft deuren" />
              </div>

              {side.openings.length > 0 && (
                <div className="mt-5 space-y-4 rounded-2xl border border-black p-4">
                  <h3 className="font-semibold">Openingen</h3>

                  {side.openings.map((opening) => (
                    <div key={opening.id} className="rounded-xl border border-black p-4">
                      <div className="flex justify-between gap-4">
                        <h4 className="font-semibold">{opening.label}</h4>
                        <button type="button" onClick={() => removeOpening(side.id, opening.id)} className="text-sm underline">
                          Verwijder
                        </button>
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-3">
                        <input className="rounded-xl border border-black p-3" placeholder="Breedte cm" value={opening.width} onChange={(e) => updateOpening(side.id, opening.id, "width", e.target.value)} />
                        <input className="rounded-xl border border-black p-3" placeholder="Hoogte cm" value={opening.height} onChange={(e) => updateOpening(side.id, opening.id, "height", e.target.value)} />
                        <input className="rounded-xl border border-black p-3" placeholder="Aantal" value={opening.count} onChange={(e) => updateOpening(side.id, opening.id, "count", e.target.value)} />
                      </div>
                    </div>
                  ))}

                  <div className="flex flex-wrap gap-3">
                    <button type="button" onClick={() => addOpening(side.id, "window")} className="rounded-xl border border-black px-4 py-2">
                      + Extra kozijnmaat
                    </button>
                    <button type="button" onClick={() => addOpening(side.id, "door")} className="rounded-xl border border-black px-4 py-2">
                      + Extra deurmaat
                    </button>
                    <button type="button" onClick={() => addOpening(side.id, "other")} className="rounded-xl border border-black px-4 py-2">
                      + Overige opening
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-black p-3">
                  <div className="text-sm">Bruto</div>
                  <div className="text-lg font-semibold">{grossM2(side, index).toFixed(2)} m²</div>
                </div>

                <div className="rounded-xl border border-black p-3">
                  <div className="text-sm">Openingen</div>
                  <div className="text-lg font-semibold">{openingsM2(side).toFixed(2)} m²</div>
                </div>

                <div className="rounded-xl border border-black p-3">
                  <div className="text-sm">Netto</div>
                  <div className="text-lg font-semibold">{netM2(side, index).toFixed(2)} m²</div>
                </div>
              </div>
            </section>
          );
        })}

        <section className="rounded-2xl border border-black bg-white p-4">
          <h2 className="text-lg font-semibold">Productkeuze</h2>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Product</label>
              <select
                className="w-full rounded-xl border border-black p-3"
                value={selectedProductId}
                onChange={(e) => {
                  const productId = e.target.value;
                  const product = products.find((item) => item.id === productId);

                  setSelectedProductId(productId);

                  if (product?.orientations[0]) {
                    setOrientation(product.orientations[0]);
                  }
                }}
              >
                <option value="">Kies product</option>

                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.brand} - {product.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedProduct && (
              <div>
                <label className="mb-1 block text-sm font-medium">Richting</label>
                <select className="w-full rounded-xl border border-black p-3" value={orientation} onChange={(e) => setOrientation(e.target.value as Orientation)}>
                  {selectedProduct.orientations.map((item) => (
                    <option key={item} value={item}>
                      {item === "horizontal" ? "Horizontaal" : "Verticaal"}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {selectedProduct && (
            <div className="mt-4 rounded-xl border border-black p-4">
              <h3 className="font-semibold">
                {selectedProduct.brand} - {selectedProduct.name}
              </h3>
              <p className="mt-2 text-sm">{selectedProduct.description}</p>
              <p className="mt-2 text-sm">Prijs: €{selectedProduct.pricePerM2ExVat.toFixed(2)} excl. btw per m²</p>
              <p className="mt-1 text-sm">Snijverlies: {selectedProduct.wasteFactor}%</p>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-black bg-white p-4">
          <h2 className="text-lg font-semibold">Totaaloverzicht</h2>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-black p-3">
              <div className="text-sm">Totaal bruto</div>
              <div className="text-lg font-semibold">{round2(totals.gross).toFixed(2)} m²</div>
            </div>

            <div className="rounded-xl border border-black p-3">
              <div className="text-sm">Totaal openingen</div>
              <div className="text-lg font-semibold">{round2(totals.openings).toFixed(2)} m²</div>
            </div>

            <div className="rounded-xl border border-black p-3">
              <div className="text-sm">Totaal netto</div>
              <div className="text-lg font-semibold">{round2(totals.net).toFixed(2)} m²</div>
            </div>
          </div>
        </section>

        {selectedProduct && materialResult && (
          <section className="rounded-2xl border border-black bg-white p-4">
            <h2 className="text-lg font-semibold">Materiaalberekening</h2>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-black p-3">
                <div className="text-sm">Netto incl. snijverlies</div>
                <div className="text-lg font-semibold">{materialResult.netWithWaste.toFixed(2)} m²</div>
              </div>

              <div className="rounded-xl border border-black p-3">
                <div className="text-sm">Benodigde panelen</div>
                <div className="text-lg font-semibold">{materialResult.panelCount}</div>
              </div>

              <div className="rounded-xl border border-black p-3">
                <div className="text-sm">Materiaalprijs excl. btw</div>
                <div className="text-lg font-semibold">€{materialResult.materialPriceExVat.toFixed(2)}</div>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-black p-4 text-sm">
              <p>Verbindingsprofiel: {materialResult.needsConnectionProfile ? "Ja" : "Nee"}</p>
              <p>Startprofiel: {materialResult.needsStartProfile ? "Ja" : "Nee"}</p>
              <p>Eindprofiel: {materialResult.needsEndProfile ? "Ja" : "Nee"}</p>
              <p>Hoekprofiel: {materialResult.needsCornerProfile ? "Ja" : "Nee"}</p>
            </div>
          </section>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-black bg-white p-4">
        <div className="mx-auto flex max-w-6xl flex-wrap gap-3">
          <button type="button" onClick={addSide} disabled={sides.length >= MAX_SIDES} className="rounded-xl border border-black px-4 py-3 disabled:opacity-50">
            Zijde toevoegen
          </button>

          <button type="button" onClick={saveToBrowser} className="rounded-xl border border-black px-4 py-3">
            Opslaan
          </button>

          <button type="button" onClick={loadFromBrowser} className="rounded-xl border border-black px-4 py-3">
            Laden
          </button>

          <button type="button" onClick={exportJson} className="rounded-xl border border-black px-4 py-3">
            Export JSON
          </button>

          <label className="cursor-pointer rounded-xl border border-black px-4 py-3">
            Import JSON
            <input type="file" accept="application/json" className="hidden" onChange={(e) => importJson(e.target.files?.[0] ?? null)} />
          </label>

          <button type="button" onClick={resetData} className="rounded-xl border border-black px-4 py-3">
            Reset
          </button>
        </div>
      </div>
    </main>
  );
}