"use client";

import { useEffect, useRef, useState } from "react";

type Material = {
  id: string;
  label: string;
  color: string;
  opacity: number;
  blend: GlobalCompositeOperation;
};

const MATERIALS: Material[] = [
  { id: "wit-pleister",    label: "Wit pleister",     color: "#f5f0e8", opacity: 0.72, blend: "multiply" },
  { id: "antraciet",       label: "Antraciet",        color: "#2d2d2d", opacity: 0.68, blend: "multiply" },
  { id: "baksteen-rood",   label: "Baksteen rood",    color: "#8b3a2a", opacity: 0.60, blend: "multiply" },
  { id: "baksteen-beige",  label: "Baksteen beige",   color: "#c9a97a", opacity: 0.58, blend: "multiply" },
  { id: "hout-naturel",    label: "Hout naturel",     color: "#a07850", opacity: 0.55, blend: "multiply" },
  { id: "hout-zwart",      label: "Hout zwart",       color: "#1a1a1a", opacity: 0.70, blend: "multiply" },
  { id: "zink-grijs",      label: "Zink grijs",       color: "#7a8a90", opacity: 0.60, blend: "multiply" },
  { id: "crème",           label: "Crème",            color: "#e8dfc0", opacity: 0.65, blend: "multiply" },
];

function renderVariant(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  material: Material,
  brightness: number,
  contrast: number
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
  ctx.drawImage(img, 0, 0, w, h);
  ctx.filter = "none";
  ctx.globalCompositeOperation = material.blend;
  ctx.globalAlpha = material.opacity;
  ctx.fillStyle = material.color;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, h - 32, w, 32);
  ctx.fillStyle = "#ffffff";
  ctx.font = "500 13px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(material.label, w / 2, h - 11);
}

function VariantCard({
  img,
  material,
  brightness,
  contrast,
  selected,
  onSelect,
}: {
  img: HTMLImageElement | null;
  material: Material;
  brightness: number;
  contrast: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!img || !canvasRef.current) return;
    renderVariant(canvasRef.current, img, material, brightness, contrast);
  }, [img, material, brightness, contrast]);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative overflow-hidden rounded-xl border-2 transition-all ${
        selected ? "border-black shadow-lg scale-[1.02]" : "border-transparent hover:border-gray-300"
      }`}
    >
      <canvas ref={canvasRef} width={320} height={240} className="block w-full h-auto" />
      {selected && (
        <div className="absolute top-2 right-2 bg-black text-white text-xs font-medium px-2 py-1 rounded-full">
          Geselecteerd
        </div>
      )}
    </button>
  );
}

export default function RenderingPage() {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [imgSrc, setImgSrc] = useState<string>("");
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(105);
  const [selectedId, setSelectedId] = useState<string>("");
  const [downloading, setDownloading] = useState(false);
  const downloadRef = useRef<HTMLCanvasElement>(null);

  function handleUpload(file: File | null) {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      setImgSrc(src);
      const image = new Image();
      image.onload = () => setImg(image);
      image.src = src;
      setSelectedId("");
    };
    reader.readAsDataURL(file);
  }

  function downloadSelected() {
    if (!img || !selectedId || !downloadRef.current) return;
    const material = MATERIALS.find((m) => m.id === selectedId);
    if (!material) return;
    setDownloading(true);
    const canvas = downloadRef.current;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    renderVariant(canvas, img, material, brightness, contrast);
    const link = document.createElement("a");
    link.download = `renisual-${material.id}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    setDownloading(false);
  }

  const selectedMaterial = MATERIALS.find((m) => m.id === selectedId);

  return (
    <main className="min-h-screen bg-[#f4f1ec] p-4 pb-16 text-black md:p-6">
      <div className="mx-auto max-w-6xl space-y-6">

        <section className="rounded-2xl border border-black bg-white p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold">Gevel Rendering</h1>
              <p className="mt-1 text-sm text-gray-500">Upload een foto van je gevel en zie direct hoe verschillende materialen eruitzien.</p>
            </div>
            <a href="/gevelcalc" className="rounded-xl border border-black px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors">
              ← Terug naar calculator
            </a>
          </div>
        </section>

        <section className="rounded-2xl border border-black bg-white p-5">
          <h2 className="text-base font-semibold mb-4">Foto van je gevel</h2>
          {!imgSrc ? (
            <label className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-300 p-10 text-center cursor-pointer hover:border-black hover:bg-gray-50 transition-all">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-gray-400">
                <path d="M16 4v16M8 12l8-8 8 8M4 24h24M4 28h24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <div>
                <p className="text-sm font-medium">Klik om een foto te uploaden</p>
                <p className="text-xs text-gray-400 mt-1">JPG, PNG of WEBP</p>
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUpload(e.target.files?.[0] ?? null)} />
            </label>
          ) : (
            <div className="space-y-4">
              <div className="relative rounded-xl overflow-hidden border border-gray-200">
                <img src={imgSrc} alt="Origineel" className="w-full max-h-64 object-contain bg-gray-50" />
                <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">Origineel</div>
              </div>
              <label className="inline-flex items-center gap-2 rounded-xl border border-black px-4 py-2 text-sm cursor-pointer hover:bg-gray-50 transition-colors">
                Andere foto
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUpload(e.target.files?.[0] ?? null)} />
              </label>
            </div>
          )}
        </section>

        {img && (
          <section className="rounded-2xl border border-black bg-white p-5">
            <h2 className="text-base font-semibold mb-4">Fotoaanpassingen</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-medium">Helderheid</label>
                  <span className="text-sm text-gray-500">{brightness}%</span>
                </div>
                <input type="range" min={60} max={140} value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} className="w-full" />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-medium">Contrast</label>
                  <span className="text-sm text-gray-500">{contrast}%</span>
                </div>
                <input type="range" min={80} max={140} value={contrast} onChange={(e) => setContrast(Number(e.target.value))} className="w-full" />
              </div>
            </div>
          </section>
        )}

        {img && (
          <section className="rounded-2xl border border-black bg-white p-5">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
              <h2 className="text-base font-semibold">Materiaalvarianten</h2>
              {selectedId && (
                <button
                  type="button"
                  onClick={downloadSelected}
                  disabled={downloading}
                  className="rounded-xl bg-black text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {downloading ? "Bezig..." : `↓ Download — ${selectedMaterial?.label}`}
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {MATERIALS.map((material) => (
                <VariantCard
                  key={material.id}
                  img={img}
                  material={material}
                  brightness={brightness}
                  contrast={contrast}
                  selected={selectedId === material.id}
                  onSelect={() => setSelectedId(material.id)}
                />
              ))}
            </div>
            {!selectedId && (
              <p className="mt-4 text-sm text-gray-400 text-center">Klik op een variant om te selecteren en te downloaden.</p>
            )}
          </section>
        )}

        {selectedId && (
          <section className="rounded-2xl border border-black bg-black text-white p-6 text-center">
            <h2 className="text-lg font-bold mb-2">Interesse in {selectedMaterial?.label}?</h2>
            <p className="text-sm text-gray-300 mb-4">Bereken de exacte materiaalkosten voor uw project via de gevelcalculator.</p>
            <div className="flex gap-3 justify-center flex-wrap">
              <a href="/gevelcalc" className="rounded-xl bg-white text-black px-5 py-2.5 text-sm font-medium hover:bg-gray-100 transition-colors">
                Naar calculator →
              </a>
              <a href="mailto:info@renisual.nl" className="rounded-xl border border-white text-white px-5 py-2.5 text-sm font-medium hover:bg-white/10 transition-colors">
                Offerte aanvragen
              </a>
            </div>
          </section>
        )}

      </div>
      <canvas ref={downloadRef} className="hidden" />
    </main>
  );
}