// Sharp-based watermark compositor. Renders a small overlay (Renisual mark +
// text + url) onto the bottom-right of a JPEG. Used by both /api/render
// (FLUX output) and /api/render/paint (recolor output) so every share-able
// artifact carries the brand. Inline SVG — no PNG asset to maintain.

import sharp from "sharp";

function renisualMarkSvg(size: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">
  <defs>
    <pattern id="brick" patternUnits="userSpaceOnUse" x="0" y="0" width="10" height="6">
      <rect width="10" height="6" fill="#5C2E18"/>
      <rect x="0.3" y="0.3" width="9.4" height="2.4" fill="#A14B2A"/>
      <rect x="-4.7" y="3.3" width="9.4" height="2.4" fill="#A14B2A"/>
      <rect x="5.3" y="3.3" width="9.4" height="2.4" fill="#A14B2A"/>
    </pattern>
  </defs>
  <path d="M50 12 L86 32 L50 52 L14 32 Z" fill="#2D3437"/>
  <path d="M14 32 L50 52 L50 92 L14 72 Z" fill="#6B8E4E"/>
  <path d="M86 32 L50 52 L50 92 L86 72 Z" fill="url(#brick)"/>
</svg>`;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    '"': "&quot;",
    "'": "&apos;",
  }[c] as string));
}

export type WatermarkOpts = {
  /** Caption text — "Rendered by Renisual AI" or "Gemaakt met Renisual". */
  caption: string;
  /** URL line — typically "renisual.com". */
  url?: string;
};

/**
 * Composite a Renisual watermark onto the bottom-right of `imageBytes`.
 * Returns new JPEG bytes. Watermark height is ~6% of image height,
 * floor 40px, ceiling 120px. Opacity 0.6.
 */
export async function applyWatermark(
  imageBytes: Buffer,
  opts: WatermarkOpts,
): Promise<Buffer> {
  const meta = await sharp(imageBytes).metadata();
  const W = meta.width ?? 1024;
  const H = meta.height ?? 1024;

  const wmH = Math.min(120, Math.max(40, Math.round(H * 0.06)));
  const markSize = wmH;
  const fontSize = Math.round(wmH * 0.32);
  const padding = Math.round(wmH * 0.18);
  const captionText = escapeXml(opts.caption);
  const urlText = opts.url ? escapeXml(opts.url) : "";
  const wmW = Math.round(markSize + padding + Math.max(captionText.length, urlText.length) * fontSize * 0.55 + padding);

  const wmSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${wmW}" height="${wmH}" viewBox="0 0 ${wmW} ${wmH}">
    <g opacity="0.6">
      <rect width="${wmW}" height="${wmH}" fill="#000" opacity="0.35" rx="${Math.round(wmH * 0.12)}"/>
      <g transform="translate(${padding}, ${(wmH - markSize) / 2})">
        ${renisualMarkSvg(markSize)}
      </g>
      <text x="${padding + markSize + padding}" y="${wmH / 2 - 2}" fill="#fff" font-family="system-ui, sans-serif" font-size="${fontSize}" font-weight="600" dominant-baseline="middle">${captionText}</text>
      ${urlText ? `<text x="${padding + markSize + padding}" y="${wmH / 2 + fontSize + 2}" fill="#fff" font-family="system-ui, sans-serif" font-size="${Math.round(fontSize * 0.85)}" opacity="0.85" dominant-baseline="middle">${urlText}</text>` : ""}
    </g>
  </svg>`;

  const margin = Math.round(W * 0.02);
  const left = W - wmW - margin;
  const top = H - wmH - margin;

  return sharp(imageBytes)
    .composite([{ input: Buffer.from(wmSvg), left: Math.max(0, left), top: Math.max(0, top) }])
    .jpeg({ quality: 90 })
    .toBuffer();
}
