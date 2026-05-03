import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FLUX.2 Mono Flat comparison — woonboot",
  robots: { index: false, follow: false },
};

type Cell = {
  src: string;
  label: string;
  meta: string;
  highlight?: "source" | "gemini";
};

type Row = {
  title: string;
  subtitle: string;
  cells: Cell[];
};

const ROWS: Row[] = [
  {
    title: "Photo 1 — achterkant met hek",
    subtitle: "3264×2448 → 1152×864",
    cells: [
      { src: "/test-inputs/IMG_20260421_183639.jpg", label: "Source", meta: "original 8 MP", highlight: "source" },
      { src: "/test-outputs/flux-comparison/IMG_20260421_183639-gemini.jpg", label: "gemini", meta: "8.4s · n/a", highlight: "gemini" },
      { src: "/test-outputs/flux-comparison/IMG_20260421_183639-klein-4b.jpg", label: "klein-4b", meta: "5.4s · 1.5 cr" },
      { src: "/test-outputs/flux-comparison/IMG_20260421_183639-klein-9b.jpg", label: "klein-9b", meta: "7.0s · 1.7 cr" },
      { src: "/test-outputs/flux-comparison/IMG_20260421_183639-pro.jpg", label: "pro-preview", meta: "11.2s · 4.5 cr" },
      { src: "/test-outputs/flux-comparison/IMG_20260421_183639-max.jpg", label: "max", meta: "25.1s · 10 cr" },
    ],
  },
  {
    title: "Photo 2 — close-up bestaande damwand",
    subtitle: "3264×2448 → 1152×864 (geen facade-frame)",
    cells: [
      { src: "/test-inputs/IMG_20260422_094859.jpg", label: "Source", meta: "original 8 MP", highlight: "source" },
      { src: "/test-outputs/flux-comparison/IMG_20260422_094859-gemini.jpg", label: "gemini", meta: "7.4s · n/a", highlight: "gemini" },
      { src: "/test-outputs/flux-comparison/IMG_20260422_094859-klein-4b.jpg", label: "klein-4b", meta: "6.9s · 1.5 cr" },
      { src: "/test-outputs/flux-comparison/IMG_20260422_094859-klein-9b.jpg", label: "klein-9b", meta: "5.2s · 1.7 cr" },
      { src: "/test-outputs/flux-comparison/IMG_20260422_094859-pro.jpg", label: "pro-preview", meta: "12.5s · 4.5 cr" },
      { src: "/test-outputs/flux-comparison/IMG_20260422_094859-max.jpg", label: "max", meta: "23.9s · 10 cr" },
    ],
  },
  {
    title: "Photo 3 — voorkant vanaf water",
    subtitle: "4080×3072 → 1152×864",
    cells: [
      { src: "/test-inputs/IMG_20260422_095323.jpg", label: "Source", meta: "original 12.5 MP", highlight: "source" },
      { src: "/test-outputs/flux-comparison/IMG_20260422_095323-gemini.jpg", label: "gemini", meta: "8.7s · n/a", highlight: "gemini" },
      { src: "/test-outputs/flux-comparison/IMG_20260422_095323-klein-4b.jpg", label: "klein-4b", meta: "6.2s · 1.5 cr" },
      { src: "/test-outputs/flux-comparison/IMG_20260422_095323-klein-9b.jpg", label: "klein-9b", meta: "7.8s · 1.7 cr" },
      { src: "/test-outputs/flux-comparison/IMG_20260422_095323-pro.jpg", label: "pro-preview", meta: "11.5s · 4.5 cr" },
      { src: "/test-outputs/flux-comparison/IMG_20260422_095323-max.jpg", label: "max", meta: "22.8s · 10 cr" },
    ],
  },
];

function Cell({ cell }: { cell: Cell }) {
  const bg =
    cell.highlight === "source" ? "bg-[#1a1410] border-[#3a2614]"
    : cell.highlight === "gemini" ? "bg-[#102018] border-[#1f3a2a]"
    : "bg-[#0a0c10] border-[#232733]";
  const captionBg =
    cell.highlight === "source" ? "bg-[#14100c] border-[#3a2614]"
    : cell.highlight === "gemini" ? "bg-[#0c1812] border-[#1f3a2a]"
    : "bg-[#11141b] border-[#232733]";
  return (
    <figure className={`m-0 flex flex-col overflow-hidden rounded-md border ${bg}`}>
      <a href={cell.src} target="_blank" rel="noopener noreferrer" className="block leading-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cell.src} alt={`${cell.label} output`} className="block w-full h-auto transition-opacity hover:opacity-90" />
      </a>
      <figcaption className={`flex flex-wrap justify-between gap-2 border-t px-2.5 py-2 text-xs ${captionBg}`}>
        <strong className="font-semibold text-[#e6e8eb]">{cell.label}</strong>
        <span className="text-[#9aa0a6]">{cell.meta}</span>
      </figcaption>
    </figure>
  );
}

export default function FluxComparisonPage() {
  return (
    <main className="min-h-screen bg-[#0e1014] p-6 text-[#e6e8eb] [color-scheme:dark]">
      <h1 className="mb-2 text-[22px] font-semibold">FLUX.2 Mono Flat comparison — woonboot</h1>
      <p className="mb-6 max-w-[780px] text-sm text-[#9aa0a6]">
        Drie originele woonboot-foto&apos;s (auto-downscaled naar ~1 MP) door
        Gemini 2.5 Flash Image + FLUX.2 klein-4b / klein-9b / pro-preview / max
        met dezelfde Mono Flat prompt. Gemini = current production engine, FLUX.2
        = candidate for pro-tier. Klik een afbeelding voor vol formaat.
      </p>

      {ROWS.map((row) => (
        <section
          key={row.title}
          className="mb-7 grid grid-cols-1 gap-2.5 rounded-lg border border-[#232733] bg-[#161922] p-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6"
        >
          <h2 className="col-span-full mb-1 text-[15px] font-semibold text-[#cbd0d6]">
            {row.title}{" "}
            <small className="ml-2 font-normal text-[#6b7280]">{row.subtitle}</small>
          </h2>
          {row.cells.map((cell) => (
            <Cell key={cell.src} cell={cell} />
          ))}
        </section>
      ))}

      <p className="mt-6 border-t border-[#232733] pt-4 text-xs text-[#6b7280]">
        Totaal: 15 renders (3 Gemini + 12 FLUX.2), 53.1 BFL credits (~$0.053) +
        Gemini token-billed, ~170s wall time.{" "}
        <a href="/test-outputs/flux-comparison/results.json" className="text-[#7aa2ff] hover:underline">
          results.json
        </a>{" "}
        · cr = credits (BFL), ~$0.001/credit · Gemini billed per-token by Google,
        n/a in cr
      </p>
    </main>
  );
}
