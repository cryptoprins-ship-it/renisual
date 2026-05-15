// Lab-space hue/saturation shift on masked pixels. Pure function over
// raw RGBA pixel buffers — no sharp here so it stays unit-testable.
// Caller (api/render/paint) is responsible for sharp I/O around it.

const PRESERVATION_FACTOR = 0.85; // 85% of source-luminance variation preserved

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

// sRGB → linear → XYZ → Lab. Standard CIE formulas with D65 illuminant.
function srgbToLinear(c: number): number {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}
function linearToSrgb(c: number): number {
  const v = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(v * 255)));
}
function rgbToXyz(r: number, g: number, b: number): [number, number, number] {
  const R = srgbToLinear(r);
  const G = srgbToLinear(g);
  const B = srgbToLinear(b);
  return [
    R * 0.4124564 + G * 0.3575761 + B * 0.1804375,
    R * 0.2126729 + G * 0.7151522 + B * 0.0721750,
    R * 0.0193339 + G * 0.1191920 + B * 0.9503041,
  ];
}
function xyzToRgb(x: number, y: number, z: number): [number, number, number] {
  const R =  3.2404542 * x - 1.5371385 * y - 0.4985314 * z;
  const G = -0.9692660 * x + 1.8760108 * y + 0.0415560 * z;
  const B =  0.0556434 * x - 0.2040259 * y + 1.0572252 * z;
  return [linearToSrgb(R), linearToSrgb(G), linearToSrgb(B)];
}
const WHITE_X = 0.95047, WHITE_Y = 1.0, WHITE_Z = 1.08883;
function f(t: number): number {
  const eps = 0.008856;
  const kap = 903.3;
  return t > eps ? Math.cbrt(t) : (kap * t + 16) / 116;
}
function fInv(t: number): number {
  const t3 = t * t * t;
  const eps = 0.008856;
  return t3 > eps ? t3 : (116 * t - 16) / 903.3;
}
function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const [x, y, z] = rgbToXyz(r, g, b);
  const fx = f(x / WHITE_X);
  const fy = f(y / WHITE_Y);
  const fz = f(z / WHITE_Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
function labToRgb(L: number, a: number, b: number): [number, number, number] {
  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  return xyzToRgb(WHITE_X * fInv(fx), WHITE_Y * fInv(fy), WHITE_Z * fInv(fz));
}

export type RecolorOpts = {
  /** Raw RGBA buffer of the source image. Length = width*height*4. */
  pixels: Buffer;
  /** Single-channel uint8 mask (0 = keep original, 255 = recolor). Length = width*height. */
  mask: Buffer;
  width: number;
  height: number;
  /** Target color hex, e.g. "#7B7B79". */
  targetHex: string;
  /** Optional override (0..1) for how much source-luminance variation to preserve. */
  preservationFactor?: number;
};

/**
 * Recolor masked pixels in-place by shifting their Lab a/b toward the target
 * and rescaling L around the target's L while preserving relative variation.
 * Mutates the input pixels buffer and returns it.
 */
export function recolor(opts: RecolorOpts): Buffer {
  const { pixels, mask, width, height, targetHex } = opts;
  const preserve = opts.preservationFactor ?? PRESERVATION_FACTOR;
  const [tr, tg, tb] = hexToRgb(targetHex);
  const [tL, ta, tb_] = rgbToLab(tr, tg, tb);

  // First pass: compute mean L over masked pixels (luminance anchor).
  let lSum = 0;
  let nMasked = 0;
  for (let i = 0, p = 0; p < width * height; p++, i += 4) {
    if (mask[p] > 127) {
      const [L] = rgbToLab(pixels[i], pixels[i + 1], pixels[i + 2]);
      lSum += L;
      nMasked++;
    }
  }
  if (nMasked === 0) return pixels;
  const lMean = lSum / nMasked;

  // Second pass: shift masked pixels into target Lab, preserve variation.
  for (let i = 0, p = 0; p < width * height; p++, i += 4) {
    if (mask[p] > 127) {
      const [L] = rgbToLab(pixels[i], pixels[i + 1], pixels[i + 2]);
      const Lnew = tL + (L - lMean) * preserve;
      const [r2, g2, b2] = labToRgb(Lnew, ta, tb_);
      pixels[i] = r2;
      pixels[i + 1] = g2;
      pixels[i + 2] = b2;
      // alpha at i+3 stays
    }
  }
  return pixels;
}
