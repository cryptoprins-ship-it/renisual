"use client";

import { useMemo, useState } from "react";
import { products, type Orientation } from "@/lib/productCatalog";
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

const SIDE_NAMES = ["Voorzijde", "Achterzijde", "Linkerzijde", "Rechterzijde"];
const MAX_SIDES = 10;
const STORAGE_KEY = "renisual-gevelcalc-v1";

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

function createSide(index: number): CalcSide {
  return {
    id: crypto.randomUUID(),
    name: SIDE_NAMES[index] ?? `Zijde ${index + 1}`,
    width: "",
    height: "",
    openings: [],
    photoDataUrl: "",
  };
}

function createDefaultSides(): CalcSide[] {
  return [createSide(0), createSide(1), createSide(2), createSide(3)];
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Kon afbeelding niet lezen."));
    };
    reader.onerror = () => reject(new Error("Kon afbeelding niet laden."));
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
  const [sides, setSides] = useState<CalcSide[]>(createDefaultSides());
  const [frontBackSame, setFrontBackSame] = useState(false);
  const [leftRightSame, setLeftRightSame] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [orientation, setOrientation] = useState<Orientation>("horizontal");
  const [totalDiscountPercent, setTotalDiscountPercent] = useState("0");
  const [showInclVat, setShowInclVat] = useState(false);

  const VAT = 1.21;
  const selectedProduct = products.find((p) => p.id === selectedProductId);

  const resolvedSides = useMemo<CalcSide[]>(() => {
    return sides.map((side, index) => {
      if (index === 1 && frontBackSame && sides[0])
        return { ...side, width: sides[0].width, height: sides[0].height };
      if (index === 3 && leftRightSame && sides[2])
        return { ...side, width: sides[2].width, height: sides[2].height };
      return side;
    });
  }, [sides, frontBackSame, leftRightSame]);

  const activeSides = useMemo(
    () => resolvedSides.filter((s) => toNumber(s.width) > 0 && toNumber(s.height) > 0),
    [resolvedSides]
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

  function fmt(amount: number) {
    const value = showInclVat ? round2(amount * VAT) : amount;
    return `€${value.toFixed(2)}`;
  }

  function updateSide(sideId: string, updater: (side: CalcSide) => CalcSide) {
    setSides((prev) => prev.map((s) => (s.id === sideId ? updater(s) : s)));
  }

  function addSide() {
    setSides((prev) => prev.length >= MAX_SIDES ? prev : [...prev, createSide(prev.length)]);
  }

  function removeSide(sideId: string) {
    setSides((prev) => prev.filter((s) => s.id !== sideId));
  }

  function setHasWindows(sideId: string, checked: boolean) {
    updateSide(sideId, (side) => ({
      ...side,
      openings: checked
        ? [createOpening("window"), ...side.openings.filter((o) => o.type !== "window")]
        : side.openings.filter((o) => o.type !== "window"),
    }));
  }

  function setHasDoors(sideId: string, checked: boolean) {
    updateSide(sideId, (side) => ({
      ...side,
      openings: checked
        ? [...side.openings.filter((o) => o.type !== "door"), createOpening("door")]
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
    updateSide(sideId, (side) => ({
      ...side,
      openings: [...side.openings, createOpening(type)],
    }));
  }

  function removeOpening(sideId: string, openingId: string) {
    updateSide(sideId, (side) => ({
      ...side,
      openings: side.openings.filter((o) => o.id !== openingId),
    }));
  }

  async function handleImageUpload(sideId: string, file: File | null) {
    if (!file || !file.type.startsWith("image/")) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      updateSide(sideId, (side) => ({ ...side, photoDataUrl: dataUrl }));
    } catch {
      alert("Afbeelding uploaden mislukt.");
    }
  }

  function buildSaveData() {
    return {
      version: STORAGE_KEY,
      savedAt: new Date().toISOString(),
      sides,
      frontBackSame,
      leftRightSame,
      selectedProductId,
      orientation,
      totalDiscountPercent,
    };
  }

  function restoreFromData(data: ReturnType<typeof buildSaveData>) {
    setSides(data.sides ?? createDefaultSides());
    setFrontBackSame(data.frontBackSame ?? false);
    setLeftRightSame(data.leftRightSame ?? false);
    setSelectedProductId(data.selectedProductId ?? "");
    setOrientation(data.orientation ?? "horizontal");
    setTotalDiscountPercent(data.totalDiscountPercent ?? "0");
  }

  function saveToBrowser() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(buildSaveData()));
      alert("Berekening opgeslagen.");
    } catch {
      alert("Opslaan mislukt — mogelijk te veel foto's voor localStorage.");
    }
  }

  function loadFromBrowser() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) { alert("Geen opgeslagen berekening gevonden."); return; }
    try { restoreFromData(JSON.parse(raw)); }
    catch { alert("Laden mislukt."); }
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(buildSaveData(), null, 2)], { type: "application/json" });
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
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.sides)) { alert("Ongeldig JSON-bestand."); return; }
      restoreFromData(data);
      alert("JSON geïmporteerd.");
    } catch { alert("Importeren mislukt."); }
  }

  function resetData() {
    if (!confirm("Alle data wissen inclusief foto's? Dit kan niet ongedaan worden gemaakt.")) return;
    localStorage.removeItem(STORAGE_KEY);
    setSides(createDefaultSides());
    setFrontBackSame(false);
    setLeftRightSame(false);
    setSelectedProductId("");
    setOrientation("horizontal");
    setTotalDiscountPercent("0");
  }

  function exportPdf() { window.print(); }

  function sendMail() {
    const subject = encodeURIComponent("Renisual GevelCalc berekening");
    const vatLabel = showInclVat ? "incl. btw" : "excl. btw";
    const body = encodeURIComponent(
      `Renisual GevelCalc\n\n` +
      `Totaal bruto: ${totals.gross.toFixed(2)} m²\n` +
      `Totaal openingen: ${totals.openings.toFixed(2)} m²\n` +
      `Totaal netto: ${totals.net.toFixed(2)} m²\n\n` +
      `Product: ${selectedProduct ? `${selectedProduct.brand} - ${selectedProduct.name}` : "Niet gekozen"}\n` +
      `Richting: ${orientation === "horizontal" ? "Horizontaal" : "Verticaal"}\n\n` +
      `Netto incl. snijverlies: ${materialResult?.netWithWaste.toFixed(2) ?? "0.00"} m²\n` +
      `Panelen: ${materialResult?.panelCount ?? 0}\n` +
      `Materiaalprijs ${vatLabel}: ${fmt(materialResult?.materialPriceExVat ?? 0)}\n` +
      `Profielenprijs ${vatLabel}: ${fmt(materialResult?.profilePriceExVat ?? 0)}\n` +
      `Subtotaal ${vatLabel}: ${fmt(materialResult?.subtotalExVat ?? 0)}\n` +
      `Korting ${totalDiscountPercent}%: -${fmt(materialResult?.totalDiscount ?? 0)}\n` +
      `Totaal ${vatLabel} na korting: ${fmt(materialResult?.totalExVat ?? 0)}\n`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  return (
    <>
      <style>{`
        @media print {
          input[type="file"], button, .print-hidden { display: none !important; }
          section, table, img, .print-avoid { break-inside: avoid; page-break-inside: avoid; }
          img { max-height: 240px !important; max-width: 90% !important; margin: 0 auto !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <main className="min-h-screen bg-[#f6f4ef] p-4 pb-40 text-black md:p-6">
        <div className="mx-auto max-w-6xl space-y-6">

          <section className="rounded-2xl border border-black bg-white p-6 text-center print-avoid">
            <h1 className="text-3xl font-bold">Renisual GevelCalc</h1>
            <p className="mt-2">Bereken gevelpanelen, profielen, openingen, prijs en exporteer je resultaat.</p>
          </section>

          <section className="rounded-2xl border border-black bg-white p-4 print-avoid">
            <h2 className="text-lg font-semibold">Projectinstellingen</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <ToggleSwitch checked={frontBackSame} onChange={setFrontBackSame} label="Voorzijde en achterzijde hebben dezelfde afmetingen" />
              <ToggleSwitch checked={leftRightSame} onChange={setLeftRightSame} label="Linkerzijde en rechterzijde hebben dezelfde afmetingen" />
            </div>
          </section>

          {sides.map((side, index) => {
            const resolved = resolvedSides[index]!;
            const isLinked = (index === 1 && frontBackSame) || (index === 3 && leftRightSame);
            const hasWindows = side.openings.some((o) => o.type === "window");
            const hasDoors = side.openings.some((o) => o.type === "door");

            return (
              <section key={side.id} className="rounded-2xl border border-black bg-white p-4 md:p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold">{side.name}</h2>
                    {isLinked && <p className="text-sm text-gray-500">Afmetingen worden automatisch overgenomen.</p>}
                  </div>
                  {sides.length > 1 && (
                    <button type="button" onClick={() => removeSide(side.id)} className="rounded-xl border border-black px-4 py-2 text-sm">
                      Verwijder
                    </button>
                  )}
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium">Breedte zijde (cm)</label>
                    <input
                      className="w-full rounded-xl border border-black p-3 disabled:bg-neutral-100"
                      value={resolved.width}
                      disabled={isLinked}
                      onChange={(e) => updateSide(side.id, (s) => ({ ...s, width: e.target.value }))}
                      placeholder="Bijv. 540"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Hoogte zijde (cm)</label>
                    <input
                      className="w-full rounded-xl border border-black p-3 disabled:bg-neutral-100"
                      value={resolved.height}
                      disabled={isLinked}
                      onChange={(e) => updateSide(side.id, (s) => ({ ...s, height: e.target.value }))}
                      placeholder="Bijv. 280"
                    />
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border-2 border-dashed border-black p-4 text-center print-avoid">
                  <p className="mb-3 text-sm font-semibold">Foto van deze zijde</p>
                  <input type="file" accept="image/*" onChange={(e) => handleImageUpload(side.id, e.target.files?.[0] ?? null)} />
                  {side.photoDataUrl && (
                    <img src={side.photoDataUrl} alt={side.name} className="mx-auto mt-4 max-h-[320px] w-full rounded-xl object-contain" />
                  )}
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <ToggleSwitch checked={hasWindows} onChange={(c) => setHasWindows(side.id, c)} label="Deze zijde heeft kozijnen" />
                  <ToggleSwitch checked={hasDoors} onChange={(c) => setHasDoors(side.id, c)} label="Deze zijde heeft deuren" />
                </div>

                {side.openings.length > 0 && (
                  <div className="mt-5 space-y-4 rounded-2xl border border-black p-4">
                    <h3 className="font-semibold">Openingen</h3>
                    {side.openings.map((opening) => (
                      <div key={opening.id} className="rounded-xl border border-black p-4 print-avoid">
                        <div className="flex justify-between gap-4">
                          <h4 className="font-semibold">{opening.label}</h4>
                          <button type="button" onClick={() => removeOpening(side.id, opening.id)} className="text-sm underline">Verwijder</button>
                        </div>
                        <div className="mt-3 grid gap-3 md:grid-cols-3">
                          <input className="rounded-xl border border-black p-3" placeholder="Breedte cm" value={opening.width} onChange={(e) => updateOpening(side.id, opening.id, "width", e.target.value)} />
                          <input className="rounded-xl border border-black p-3" placeholder="Hoogte cm" value={opening.height} onChange={(e) => updateOpening(side.id, opening.id, "height", e.target.value)} />
                          <input className="rounded-xl border border-black p-3" placeholder="Aantal" value={opening.count} onChange={(e) => updateOpening(side.id, opening.id, "count", e.target.value)} />
                        </div>
                      </div>
                    ))}
                    <div className="flex flex-wrap gap-3 print-hidden">
                      <button type="button" onClick={() => addOpening(side.id, "window")} className="rounded-xl border border-black px-4 py-2">+ Extra kozijnmaat</button>
                      <button type="button" onClick={() => addOpening(side.id, "door")} className="rounded-xl border border-black px-4 py-2">+ Extra deurmaat</button>
                      <button type="button" onClick={() => addOpening(side.id, "other")} className="rounded-xl border border-black px-4 py-2">+ Overige opening</button>
                    </div>
                  </div>
                )}

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-black p-3">
                    <div className="text-sm">Bruto</div>
                    <div className="text-lg font-semibold">{calculateSideGrossM2(resolved).toFixed(2)} m²</div>
                  </div>
                  <div className="rounded-xl border border-black p-3">
                    <div className="text-sm">Openingen</div>
                    <div className="text-lg font-semibold">{calculateSideOpeningsM2(side).toFixed(2)} m²</div>
                  </div>
                  <div className="rounded-xl border border-black p-3">
                    <div className="text-sm">Netto</div>
                    <div className="text-lg font-semibold">{calculateSideNetM2(resolved).toFixed(2)} m²</div>
                  </div>
                </div>
              </section>
            );
          })}

          <section className="rounded-2xl border border-black bg-white p-4 print-avoid">
            <h2 className="text-lg font-semibold">Productkeuze</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Product</label>
                <select
                  className="w-full rounded-xl border border-black p-3"
                  value={selectedProductId}
                  onChange={(e) => {
                    const product = products.find((p) => p.id === e.target.value);
                    setSelectedProductId(e.target.value);
                    if (product?.orientations[0]) setOrientation(product.orientations[0]);
                  }}
                >
                  <option value="">Kies product</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.brand} - {p.name}</option>
                  ))}
                </select>
              </div>
              {selectedProduct && (
                <div>
                  <label className="mb-1 block text-sm font-medium">Richting</label>
                  <select className="w-full rounded-xl border border-black p-3" value={orientation} onChange={(e) => setOrientation(e.target.value as Orientation)}>
                    {selectedProduct.orientations.map((o) => (
                      <option key={o} value={o}>{o === "horizontal" ? "Horizontaal" : "Verticaal"}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium">Korting totaalprijs (%)</label>
                <input className="w-full rounded-xl border border-black p-3" value={totalDiscountPercent} onChange={(e) => setTotalDiscountPercent(e.target.value)} placeholder="Bijv. 10" />
              </div>
            </div>
            {selectedProduct && (
              <div className="mt-4 rounded-xl border border-black p-4">
                <h3 className="font-semibold">{selectedProduct.brand} - {selectedProduct.name}</h3>
                <p className="mt-2 text-sm">{selectedProduct.description}</p>
                {selectedProduct.type === "panel" && (
                  <>
                    <p className="mt-2 text-sm">Paneel: {selectedProduct.panelLength} mm × {selectedProduct.panelWorkSize} mm werkmaat</p>
                    <p className="mt-1 text-sm">Paneeloppervlak: {selectedProduct.panelAreaM2} m²</p>
                    <p className="mt-1 text-sm">Prijs per paneel: €{(selectedProduct.pricePerPanelExVat ?? selectedProduct.panelAreaM2 * selectedProduct.pricePerM2ExVat).toFixed(2)} excl. btw</p>
                  </>
                )}
                {selectedProduct.type === "paint" && (
                  <p className="mt-2 text-sm">Prijs per m²: €{selectedProduct.pricePerM2ExVat.toFixed(2)} excl. btw</p>
                )}
                <p className="mt-1 text-sm">Snijverlies: {selectedProduct.wasteFactor}%</p>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-black bg-white p-4 print-avoid">
            <h2 className="text-lg font-semibold">Totaaloverzicht</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-black p-3">
                <div className="text-sm">Totaal bruto</div>
                <div className="text-lg font-semibold">{totals.gross.toFixed(2)} m²</div>
              </div>
              <div className="rounded-xl border border-black p-3">
                <div className="text-sm">Totaal openingen</div>
                <div className="text-lg font-semibold">{totals.openings.toFixed(2)} m²</div>
              </div>
              <div className="rounded-xl border border-black p-3">
                <div className="text-sm">Totaal netto</div>
                <div className="text-lg font-semibold">{totals.net.toFixed(2)} m²</div>
              </div>
            </div>
          </section>

          {selectedProduct && materialResult && (
            <section className="rounded-2xl border border-black bg-white p-4 print-avoid">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <h2 className="text-lg font-semibold">Materiaalberekening</h2>
                <div className="w-64">
                  <ToggleSwitch checked={showInclVat} onChange={setShowInclVat} label="Incl. btw (21%)" />
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-black p-3">
                  <div className="text-sm">Netto incl. snijverlies</div>
                  <div className="text-lg font-semibold">{materialResult.netWithWaste.toFixed(2)} m²</div>
                </div>
                {selectedProduct.type === "panel" && (
                  <div className="rounded-xl border border-black p-3">
                    <div className="text-sm">Benodigde panelen</div>
                    <div className="text-lg font-semibold">{materialResult.panelCount}</div>
                  </div>
                )}
                <div className="rounded-xl border border-black p-3">
                  <div className="text-sm">Materiaalprijs</div>
                  <div className="text-lg font-semibold">{fmt(materialResult.materialPriceExVat)}</div>
                </div>
              </div>

              {materialResult.profileItems.length > 0 && (
                <>
                  <h3 className="mt-6 font-semibold">Profielen</h3>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="border border-black bg-neutral-100">
                          <th className="border border-black p-2 text-left">Type</th>
                          <th className="border border-black p-2 text-left">Naam</th>
                          <th className="border border-black p-2 text-right">Meters nodig</th>
                          <th className="border border-black p-2 text-right">Lengte/stuk</th>
                          <th className="border border-black p-2 text-right">Aantal</th>
                          <th className="border border-black p-2 text-right">Prijs/stuk</th>
                          <th className="border border-black p-2 text-right">Totaal</th>
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
                            <td className="border border-black p-2 text-right">{fmt(item.priceEachExVat)}</td>
                            <td className="border border-black p-2 text-right">{fmt(item.totalExVat)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              <div className="mt-4 rounded-xl border border-black p-4 text-sm space-y-1">
                <p>Materiaalprijs: {fmt(materialResult.materialPriceExVat)}</p>
                {materialResult.profileItems.length > 0 && (
                  <p>Profielenprijs: {fmt(materialResult.profilePriceExVat)}</p>
                )}
                <p>Subtotaal: {fmt(materialResult.subtotalExVat)}</p>
                <p>Korting {totalDiscountPercent}%: -{fmt(materialResult.totalDiscount)}</p>
                <p className="font-semibold pt-1 border-t border-black">
                  Totaal na korting: {fmt(materialResult.totalExVat)}
                </p>
              </div>
            </section>
          )}

        </div>

        <div className="fixed inset-x-0 bottom-0 border-t border-black bg-white p-3 print:hidden">
          <div className="mx-auto flex max-w-6xl items-center gap-2 flex-wrap">
            <button type="button" onClick={addSide} disabled={sides.length >= MAX_SIDES} className="rounded-xl bg-black text-white px-4 py-2.5 text-sm font-medium disabled:opacity-40">+ Zijde</button>
            <button type="button" onClick={exportPdf} className="rounded-xl bg-black text-white px-4 py-2.5 text-sm font-medium">Export PDF</button>
            <button type="button" onClick={sendMail} className="rounded-xl bg-black text-white px-4 py-2.5 text-sm font-medium">Mail resultaat</button>
            <div className="h-6 w-px bg-black/20 mx-1" />
            <button type="button" onClick={saveToBrowser} className="rounded-xl border border-black px-3 py-2 text-sm">Opslaan</button>
            <button type="button" onClick={loadFromBrowser} className="rounded-xl border border-black px-3 py-2 text-sm">Laden</button>
            <button type="button" onClick={exportJson} className="rounded-xl border border-black px-3 py-2 text-sm">JSON ↓</button>
            <label className="cursor-pointer rounded-xl border border-black px-3 py-2 text-sm">
              JSON ↑<input type="file" accept="application/json" className="hidden" onChange={(e) => importJson(e.target.files?.[0] ?? null)} />
            </label>
            <button type="button" onClick={resetData} className="rounded-xl border border-red-600 text-red-600 px-3 py-2 text-sm">Reset</button>
          </div>
        </div>
      </main>
    </>
  );
}