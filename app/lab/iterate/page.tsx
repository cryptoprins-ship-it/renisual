import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Production prompt iteration — klein-9b",
  robots: { index: false, follow: false },
};

const OUT_BASE = "/test-outputs/iterate";

// Only "clean" facade photos here — matches the disclaimer that asks
// users to upload a photo without obstacles (no fences, no clutter
// in front). The earlier p2-back-fence test is excluded because it
// represents an out-of-spec input.
const PHOTOS = [
  { id: "p1-canal", file: "IMG_20260422_095323.jpg", title: "Boat 1 — canal front", subtitle: "single-storey, water front" },
  { id: "p3-white2story", file: "woonboot_dubbellaags_achterkant.jpg", title: "Boat 2 — white 2-storey", subtitle: "double-layer back view" },
  { id: "p4-mixed-back", file: "woonboot_achterkant_dubbelenenkel.jpg", title: "Boat 3 — mixed back", subtitle: "double + single layer" },
] as const;

const CASES = [
  { id: "PB7038A-V", label: "PB7038A V", desc: "Mono Flat · grey 7038 · vertical (restructure)" },
  { id: "PB7038A-H", label: "PB7038A H", desc: "Mono Flat · grey 7038 · horizontal (preserve)" },
  { id: "PB9005A-H", label: "PB9005A H", desc: "Mono Flat · diepzwart 9005 · horizontal (preserve)" },
  { id: "SG7038A-V", label: "SG7038A V", desc: "Mono Groove · grey 7038 · vertical (restructure)" },
  { id: "SG7038A-H", label: "SG7038A H", desc: "Mono Groove · grey 7038 · horizontal (preserve)" },
  { id: "SG9003A-H", label: "SG9003A H", desc: "Mono Groove · pure cool white 9003 · horizontal" },
  { id: "YMSG7038A-V", label: "YMSG7038A V", desc: "Groove + Structure · grey 7038 · vertical (restructure)" },
  { id: "YMSG7038A-H", label: "YMSG7038A H", desc: "Groove + Structure · grey 7038 · horizontal (preserve)" },
] as const;

function Cell({ src, label, desc, isSource }: { src: string; label: string; desc?: string; isSource?: boolean }) {
  return (
    <figure
      className={`m-0 flex flex-col overflow-hidden rounded-md border ${isSource ? "border-[#3a2614] bg-[#1a1410]" : "border-[#232733] bg-[#0a0c10]"}`}
    >
      <a href={src} target="_blank" rel="noopener noreferrer" className="block leading-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={label} loading="lazy" className="block w-full h-auto transition-opacity hover:opacity-90" />
      </a>
      <figcaption
        className={`flex flex-col gap-0.5 border-t px-2.5 py-2 text-xs ${isSource ? "border-[#3a2614] bg-[#14100c]" : "border-[#232733] bg-[#11141b]"}`}
      >
        <strong className="font-semibold text-[#e6e8eb]">{label}</strong>
        {desc && <span className="text-[10px] text-[#9aa0a6]">{desc}</span>}
      </figcaption>
    </figure>
  );
}

export default function IterateLabPage() {
  return (
    <main className="min-h-screen bg-[#0e1014] p-6 text-[#e6e8eb]">
      <h1 className="mb-2 text-[22px] font-semibold">Production prompt iteration — klein-9b</h1>
      <p className="mb-6 max-w-[820px] text-sm text-[#9aa0a6]">
        3 schone woonboot-foto&apos;s × 7 product-varianten (incl. horizontale Mono Groove + horizontale Mono Groove+Structure) = 21 renders, gegenereerd
        met de productie BFL klein-9b prompt zoals die nu in <code className="rounded bg-[#1a1d24] px-1 py-0.5">/api/render</code>{" "}
        leeft. Klik een afbeelding voor vol formaat. Springen naar:
        {" "}
        {PHOTOS.map((p, i) => (
          <span key={p.id}>
            {i > 0 && " · "}
            <a href={`#${p.id}`} className="text-[#7aa2ff] hover:underline">{p.title}</a>
          </span>
        ))}
      </p>

      {PHOTOS.map((photo) => (
        <section key={photo.id} id={photo.id} className="mb-8 scroll-mt-4">
          <h2 className="mb-3 border-b border-[#232733] pb-2 text-lg font-semibold text-[#e6e8eb]">
            {photo.title}{" "}
            <small className="ml-2 font-normal text-[#6b7280]">{photo.subtitle}</small>
          </h2>
          <div className="grid grid-cols-1 gap-2.5 rounded-lg border border-[#232733] bg-[#161922] p-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-9">
            <Cell src={`/test-inputs/${photo.file}`} label="Source" desc="origineel" isSource />
            {CASES.map((c) => (
              <Cell
                key={`${photo.id}-${c.id}`}
                src={`${OUT_BASE}/${photo.id}-${c.id}.jpg`}
                label={c.label}
                desc={c.desc}
              />
            ))}
          </div>
        </section>
      ))}

      <p className="mt-6 border-t border-[#232733] pt-4 text-xs text-[#6b7280]">
        Sole engine: BFL FLUX.2 klein-9b. Same prompt as production /api/render.
        Cost per run: ~36 credits ≈ $0.036 for 21 renders.
      </p>
    </main>
  );
}
