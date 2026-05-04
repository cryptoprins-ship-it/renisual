import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FLUX.2 + Gemini comparison — woonboot",
  robots: { index: false, follow: false },
};

const OUT_BASE = "/test-outputs/flux-comparison";

type Variant = { name: string; label: string; bflOnly?: boolean };
const VARIANTS: ReadonlyArray<Variant> = [
  { name: "mono-flat-vertical", label: "Mono Flat — vertical (smalle naad, no couplings)" },
  { name: "mono-flat-horizontal", label: "Mono Flat — horizontal (smalle naad + same-color couplings)" },
  { name: "mono-groove-vertical", label: "Mono Groove — vertical (3 grooves per face, no couplings)" },
  { name: "mono-groove-horizontal", label: "Mono Groove — horizontal (3 grooves + same-color couplings)" },
  { name: "flat-structure", label: "Mono Flat + Structure — horizontal (linen texture + couplings)", bflOnly: true },
  { name: "flat-structure-vertical", label: "Mono Flat + Structure — vertical (linen texture, no couplings)", bflOnly: true },
  { name: "groove-structure", label: "Mono Groove + Structure — horizontal (3 grooves + linen texture + couplings)", bflOnly: true },
  { name: "groove-structure-vertical", label: "Mono Groove + Structure — vertical (3 grooves + linen texture, no couplings)", bflOnly: true },
];

// Only clean facade photos — fence/obstacle boats excluded per the
// disclaimer on /render asking users to upload obstacle-free shots.
const PHOTOS = [
  { base: "IMG_20260422_095323", title: "Boat 1 — voorkant vanaf water", subtitle: "originele test, schone gevel" },
  { base: "woonboot_achterkant_dubbelenenkel", title: "Boat 2 — wit, deels dubbel/enkel laags", subtitle: "achterkant vanaf water" },
  { base: "woonboot_achterkant_enkellaags", title: "Boat 3 — wijnrood, enkellaags", subtitle: "achterkant vanaf water" },
  { base: "woonboot_achterkant_enkellaags2", title: "Boat 4 — wit met blauwe kozijnen, enkellaags", subtitle: "achterkant vanaf water" },
  { base: "woonboot_dubbellaags_achterkant", title: "Boat 5 — wit, dubbellaags", subtitle: "achterkant vanaf water" },
] as const;

type Highlight = "source" | "gemini" | undefined;

// Sole primary candidate: klein-9b.
// Fallback chain in production: klein-4b → gemini (not shown here).
const MODELS: ReadonlyArray<{ name: string; label: string; highlight?: Highlight }> = [
  { name: "klein-9b", label: "klein-9b" },
];

function Cell({ src, label, highlight }: { src: string; label: string; highlight?: Highlight }) {
  const bg =
    highlight === "source" ? "bg-[#1a1410] border-[#3a2614]"
    : highlight === "gemini" ? "bg-[#102018] border-[#1f3a2a]"
    : "bg-[#0a0c10] border-[#232733]";
  const captionBg =
    highlight === "source" ? "bg-[#14100c] border-[#3a2614]"
    : highlight === "gemini" ? "bg-[#0c1812] border-[#1f3a2a]"
    : "bg-[#11141b] border-[#232733]";
  return (
    <figure className={`m-0 flex flex-col overflow-hidden rounded-md border ${bg}`}>
      <a href={src} target="_blank" rel="noopener noreferrer" className="block leading-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={`${label} output`} loading="lazy" className="block w-full h-auto transition-opacity hover:opacity-90" />
      </a>
      <figcaption className={`flex flex-wrap justify-between gap-2 border-t px-2.5 py-2 text-xs ${captionBg}`}>
        <strong className="font-semibold text-[#e6e8eb]">{label}</strong>
      </figcaption>
    </figure>
  );
}

export default function FluxLabPage() {
  return (
    <main className="min-h-screen bg-[#0e1014] p-6 text-[#e6e8eb]">
      <h1 className="mb-2 text-[22px] font-semibold">FLUX.2 + Gemini comparison — woonboot</h1>

      {/* Artistic-impression disclaimer — required next to all renders. */}
      <aside className="mb-5 max-w-[820px] rounded-md border border-[#5a4a1a] bg-[#1f1a0d] px-4 py-3 text-sm text-[#e8d790]">
        <strong className="font-semibold">⚠ Artistieke impressie — niet exact.</strong>{" "}
        De rendermodellen interpreteren paneel-aantallen stilistisch, niet
        wiskundig. Een 13,5 m brede gevel met 370mm panelen geeft ~37 panelen
        in werkelijkheid; in de render zie je er ~8–12. Gebruik deze
        weergave als sfeerimpressie, niet als maatvaste tekening. Exacte
        aantallen en m² komen uit de gevelcalc / offerte.
      </aside>

      <p className="mb-6 max-w-[820px] text-sm text-[#9aa0a6]">
        Sole primary candidate na elimination round: <strong>FLUX.2
        klein-9b</strong> (BFL, EU/GDPR). Gemini blijft als referentie
        zichtbaar op de niet-Structure varianten (in productie alleen
        fallback bij BFL outage). Klik een afbeelding voor vol formaat.
        Springen tussen secties:{" "}
        <a href="#ral-picker" className="text-[#7aa2ff] hover:underline">RAL grey picker</a>
        {" · "}
        {VARIANTS.map((v, i) => (
          <span key={v.name}>
            {i > 0 && " · "}
            <a href={`#${v.name}`} className="text-[#7aa2ff] hover:underline">
              {v.label}
            </a>
          </span>
        ))}
      </p>

      {/* RAL grey-shade picker prototype */}
      <section id="ral-picker" className="mb-10 scroll-mt-4">
        <h2 className="mb-1 border-b border-[#232733] pb-2 text-lg font-semibold text-[#e6e8eb]">
          RAL grey-shade picker — klein-9b prototype
        </h2>
        <p className="mb-3 max-w-[820px] text-xs text-[#9aa0a6]">
          Photo 3 (voorkant vanaf water) gerenderd in 5 grijstinten die
          Spanl daadwerkelijk levert (uit catalog), op Mono Flat —
          vertical. Productie-UI krijgt deze als clickable swatches naast
          het beeld; hier alle 5 naast elkaar zodat je het verloop ziet.
          Klik een afbeelding voor vol formaat.
        </p>
        <div className="grid grid-cols-1 gap-2.5 rounded-lg border border-[#232733] bg-[#161922] p-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          <Cell src={`/test-inputs/IMG_20260422_095323.jpg`} label="Source" highlight="source" />
          {[
            { code: "9010", name: "wit", hex: "#F1ECE0", src: `${OUT_BASE}/ral-picker/ral-9010-klein-9b.jpg`, series: "PB9003A" },
            { code: "9006", name: "zilver", hex: "#A5A8A8", src: `${OUT_BASE}/ral-picker/ral-9006-klein-9b.jpg`, series: "SG9006A · TS-9006P" },
            { code: "7038", name: "agaatgrijs (default)", hex: "#B5B8B1", src: `${OUT_BASE}/IMG_20260422_095323-mono-flat-vertical-klein-9b.jpg`, series: "PB7038A · SG-7038A · YPMB7038A · YMSG7038A" },
            { code: "7021", name: "zwartgrijs", hex: "#23282B", src: `${OUT_BASE}/ral-picker/ral-7021-klein-9b.jpg`, series: "YMPB-7021A · SG7021A · TS7021A · YMSG7021A" },
            { code: "9005", name: "diepzwart", hex: "#0A0A0A", src: `${OUT_BASE}/ral-picker/ral-9005-klein-9b.jpg`, series: "SG9005A · YMPB9005A · YMSG9005A" },
          ].map((g) => (
            <figure key={g.code} className="m-0 flex flex-col overflow-hidden rounded-md border border-[#232733] bg-[#0a0c10]">
              <a href={g.src} target="_blank" rel="noopener noreferrer" className="block leading-none">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={g.src} alt={`RAL ${g.code} render`} loading="lazy" className="block w-full h-auto transition-opacity hover:opacity-90" />
              </a>
              <figcaption className="flex flex-col gap-1 border-t border-[#232733] bg-[#11141b] px-2.5 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 rounded-sm border border-[#444]" style={{ backgroundColor: g.hex }} />
                  <strong className="font-semibold text-[#e6e8eb]">RAL {g.code}</strong>
                  <span className="text-[#9aa0a6]">{g.name}</span>
                </div>
                <span className="text-[10px] text-[#6b7280]">in: {g.series}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {VARIANTS.map((variant) => (
        <section key={variant.name} id={variant.name} className="mb-10 scroll-mt-4">
          <h2 className="mb-3 border-b border-[#232733] pb-2 text-lg font-semibold text-[#e6e8eb]">
            {variant.label}
          </h2>

          {PHOTOS.map((photo) => {
            const modelsForVariant = variant.bflOnly ? MODELS.filter((m) => m.name !== "gemini") : MODELS;
            const cols = modelsForVariant.length + 1; // +1 for source
            const colsClass = cols === 3 ? "xl:grid-cols-3" : cols === 4 ? "xl:grid-cols-4" : "xl:grid-cols-6";
            return (
              <div
                key={`${variant.name}-${photo.base}`}
                className={`mb-4 grid grid-cols-1 gap-2.5 rounded-lg border border-[#232733] bg-[#161922] p-4 sm:grid-cols-2 md:grid-cols-3 ${colsClass}`}
              >
                <h3 className="col-span-full text-[14px] font-medium text-[#cbd0d6]">
                  {photo.title}{" "}
                  <small className="ml-2 font-normal text-[#6b7280]">{photo.subtitle}</small>
                </h3>
                <Cell src={`/test-inputs/${photo.base}.jpg`} label="Source" highlight="source" />
                {modelsForVariant.map((model) => (
                  <Cell
                    key={`${variant.name}-${photo.base}-${model.name}`}
                    src={`${OUT_BASE}/${photo.base}-${variant.name}-${model.name}.jpg`}
                    label={model.label}
                    highlight={model.highlight}
                  />
                ))}
              </div>
            );
          })}
        </section>
      ))}

      <p className="mt-6 border-t border-[#232733] pt-4 text-xs text-[#6b7280]">
        Totaal: 60 renders (15 Gemini + 45 FLUX.2). Nieuwe BFL credits voor deze
        run: ~159 (~$0.16). Gemini billed per token by Google.{" "}
        <a href={`${OUT_BASE}/results.json`} className="text-[#7aa2ff] hover:underline">
          results.json
        </a>
      </p>
    </main>
  );
}
