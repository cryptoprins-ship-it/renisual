"use client";

import { useMemo, useState } from "react";
import { RAL_COLORS } from "@/lib/ralColors";
import { brandMatchFor } from "@/lib/paintBrandMatch";

export type RalPickerProps = {
  selected: string | null;
  onSelect: (ralCode: string) => void;
};

const FAMILIES: Array<{ key: string; label: string; range: [number, number] }> = [
  { key: "yellow", label: "Geel", range: [1000, 1999] },
  { key: "orange", label: "Oranje", range: [2000, 2999] },
  { key: "red", label: "Rood", range: [3000, 3999] },
  { key: "violet", label: "Violet", range: [4000, 4999] },
  { key: "blue", label: "Blauw", range: [5000, 5999] },
  { key: "green", label: "Groen", range: [6000, 6999] },
  { key: "grey", label: "Grijs", range: [7000, 7999] },
  { key: "brown", label: "Bruin", range: [8000, 8999] },
  { key: "white-black", label: "Wit & Zwart", range: [9000, 9999] },
];

export function RalPicker({ selected, onSelect }: RalPickerProps) {
  const [query, setQuery] = useState("");
  const all = useMemo(() => Object.entries(RAL_COLORS), []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      ([code, e]) => code.includes(q) || e.name.toLowerCase().includes(q),
    );
  }, [all, query]);

  const grouped = useMemo(() => {
    return FAMILIES.map((fam) => ({
      ...fam,
      entries: filtered.filter(([code]) => {
        const n = parseInt(code, 10);
        return n >= fam.range[0] && n <= fam.range[1];
      }),
    })).filter((g) => g.entries.length > 0);
  }, [filtered]);

  const selectedEntry = selected ? RAL_COLORS[selected] : null;
  const bm = selected ? brandMatchFor(selected) : {};

  return (
    <div className="flex flex-col gap-3">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Zoek op RAL-code of naam…"
        className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
      />

      <div className="flex max-h-[420px] flex-col gap-4 overflow-y-auto pr-1">
        {grouped.map((fam) => (
          <div key={fam.key}>
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-stone-600">
              {fam.label}
            </div>
            <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8 md:grid-cols-10">
              {fam.entries.map(([code, e]) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => onSelect(code)}
                  aria-pressed={selected === code}
                  title={`RAL ${code} — ${e.name}`}
                  className={`aspect-square rounded border-2 transition ${
                    selected === code
                      ? "border-stone-900"
                      : "border-transparent hover:border-stone-400"
                  }`}
                  style={{ backgroundColor: e.hex }}
                >
                  <span className="sr-only">
                    RAL {code} {e.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
        {grouped.length === 0 && (
          <div className="text-sm text-stone-600">Geen RAL-codes gevonden.</div>
        )}
      </div>

      {selectedEntry ? (
        <div className="rounded border border-stone-300 bg-stone-50 p-3 text-sm">
          <div className="flex items-center gap-3">
            <div
              aria-hidden
              className="h-10 w-10 rounded border border-stone-300"
              style={{ backgroundColor: selectedEntry.hex }}
            />
            <div>
              <div className="font-semibold">
                RAL {selected} · {selectedEntry.name}
              </div>
              <div className="text-stone-600">{selectedEntry.hex}</div>
            </div>
          </div>
          {(bm.sikkens || bm.wijzonol || bm.histor) && (
            <div className="mt-2 text-xs text-stone-700">
              ≈{" "}
              {[
                bm.sikkens && `Sikkens ${bm.sikkens}`,
                bm.wijzonol && `Wijzonol ${bm.wijzonol}`,
                bm.histor && `Histor ${bm.histor}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
