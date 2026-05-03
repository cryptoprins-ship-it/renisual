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

const PHOTOS = [
  { base: "IMG_20260421_183639", title: "Photo 1 — achterkant met hek", subtitle: "3264×2448 → 1152×864" },
  { base: "IMG_20260422_094859", title: "Photo 2 — close-up bestaande damwand", subtitle: "3264×2448 → 1152×864 (geen facade-frame)" },
  { base: "IMG_20260422_095323", title: "Photo 3 — voorkant vanaf water", subtitle: "4080×3072 → 1152×864" },
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
      <p className="mb-6 max-w-[820px] text-sm text-[#9aa0a6]">
        Drie originele woonboot-foto&apos;s door 5 modellen (Gemini 2.5 Flash Image
        + FLUX.2 klein-4b / klein-9b / pro-preview / max) met 4 prompt-varianten
        — Mono Flat en Mono Groove, telkens in vertical en horizontal panel-
        oriëntatie. Inputs auto-downscaled naar ~1 MP voor eerlijke vergelijking.
        Klik een afbeelding voor vol formaat. Springen tussen secties:{" "}
        {VARIANTS.map((v, i) => (
          <span key={v.name}>
            {i > 0 && " · "}
            <a href={`#${v.name}`} className="text-[#7aa2ff] hover:underline">
              {v.label}
            </a>
          </span>
        ))}
      </p>

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
