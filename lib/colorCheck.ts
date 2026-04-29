export type Rgb = [number, number, number];
export type ColorVerdict = "good" | "off" | "way-off";

export type ColorCheck = {
  deltaE: number;
  verdict: ColorVerdict;
  sampledHex: string;
  targetHex: string;
};

export function hexToRgb(hex: string): Rgb {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: Rgb): string {
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92;
}

function rgbToLab([r, g, b]: Rgb): [number, number, number] {
  const R = srgbToLinear(r);
  const G = srgbToLinear(g);
  const B = srgbToLinear(b);
  const X = 0.4124 * R + 0.3576 * G + 0.1805 * B;
  const Y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const Z = 0.0193 * R + 0.1192 * G + 0.9505 * B;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(X / 0.95047);
  const fy = f(Y);
  const fz = f(Z / 1.08883);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function deltaE76(a: Rgb, b: Rgb): number {
  const [L1, a1, b1] = rgbToLab(a);
  const [L2, a2, b2] = rgbToLab(b);
  return Math.sqrt((L1 - L2) ** 2 + (a1 - a2) ** 2 + (b1 - b2) ** 2);
}

export function verdictFromDeltaE(deltaE: number): ColorVerdict {
  if (deltaE < 6) return "good";
  if (deltaE < 16) return "off";
  return "way-off";
}

async function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image decode failed"));
    img.src = dataUrl;
  });
}

export async function sampleFacadeColor(dataUrl: string): Promise<Rgb | null> {
  if (typeof document === "undefined") return null;
  const img = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);

  const samples: Rgb[] = [];
  const regions: Array<{ x: number; y: number; w: number; h: number }> = [
    { x: 0.30, y: 0.35, w: 0.10, h: 0.20 },
    { x: 0.45, y: 0.35, w: 0.10, h: 0.20 },
    { x: 0.60, y: 0.35, w: 0.10, h: 0.20 },
    { x: 0.30, y: 0.55, w: 0.10, h: 0.15 },
    { x: 0.60, y: 0.55, w: 0.10, h: 0.15 },
  ];

  for (const region of regions) {
    const x = Math.floor(canvas.width * region.x);
    const y = Math.floor(canvas.height * region.y);
    const w = Math.max(1, Math.floor(canvas.width * region.w));
    const h = Math.max(1, Math.floor(canvas.height * region.h));
    const data = ctx.getImageData(x, y, w, h).data;
    let r = 0;
    let g = 0;
    let b = 0;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 128) continue;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      count++;
    }
    if (count > 0) samples.push([Math.round(r / count), Math.round(g / count), Math.round(b / count)]);
  }
  if (samples.length === 0) return null;

  samples.sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]));
  return samples[Math.floor(samples.length / 2)];
}

export async function checkRenderColor(dataUrl: string, targetHex: string): Promise<ColorCheck | null> {
  const sampled = await sampleFacadeColor(dataUrl);
  if (!sampled) return null;
  const target = hexToRgb(targetHex);
  const deltaE = deltaE76(sampled, target);
  return {
    deltaE: Math.round(deltaE * 10) / 10,
    verdict: verdictFromDeltaE(deltaE),
    sampledHex: rgbToHex(sampled),
    targetHex,
  };
}
