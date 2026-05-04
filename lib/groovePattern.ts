// Procedural groove / structure overlay generation for the pro-tier
// hybrid pipeline. Produces SVG patterns that are masked to the wall
// region and composited onto the AI render.

export type Variant = "flat" | "groove" | "groove-structure";

export type Orientation = "vertical" | "horizontal";

export type PatternOpts = {
  width: number;
  height: number;
  facadeWidthCm: number;
  facadeHeightCm: number;
  variant: Variant;
  orientation: Orientation;
};

// Real spec: panel = 370mm wide, 3 grooves per panel face.
// Visual rendering thins the count for legibility (drawing 140 lines
// on a ~700px wall blurs to solid shading).
export function generateGrooveSvg(opts: PatternOpts): string {
  const { width: W, height: H, facadeWidthCm, facadeHeightCm, variant, orientation } = opts;

  if (variant === "flat") {
    // Mono Flat: very faint hairline at panel edges (37cm spacing)
    return buildSvg(W, H, {
      orientation,
      spacingCm: 37,
      lineWidthCm: 0.3,
      opacity: 0.10,
      pxPerCm: orientation === "vertical" ? W / facadeWidthCm : H / facadeHeightCm,
    });
  }

  if (variant === "groove") {
    // Mono Groove: panel edges + 1 internal groove → ~18.5cm spacing
    return buildSvg(W, H, {
      orientation,
      spacingCm: 37 / 2,
      lineWidthCm: 0.5,
      opacity: 0.30,
      pxPerCm: orientation === "vertical" ? W / facadeWidthCm : H / facadeHeightCm,
    });
  }

  // Mono Groove + Structure: dense grooves (3 per panel) for the
  // visual rhythm. Structure (linen) is added as a separate layer.
  return buildSvg(W, H, {
    orientation,
    spacingCm: 37 / 4,
    lineWidthCm: 0.4,
    opacity: 0.22,
    pxPerCm: orientation === "vertical" ? W / facadeWidthCm : H / facadeHeightCm,
  });
}

type LayoutOpts = {
  orientation: Orientation;
  spacingCm: number;
  lineWidthCm: number;
  opacity: number;
  pxPerCm: number;
};

function buildSvg(W: number, H: number, l: LayoutOpts): string {
  const spacingPx = l.pxPerCm * l.spacingCm;
  const lineWidthPx = Math.max(1, l.pxPerCm * l.lineWidthCm);
  const fill = `rgba(0,0,0,${l.opacity})`;
  let rects = "";
  if (l.orientation === "vertical") {
    for (let x = spacingPx; x < W; x += spacingPx) {
      rects += `<rect x="${x.toFixed(1)}" y="0" width="${lineWidthPx.toFixed(1)}" height="${H}" fill="${fill}" />`;
    }
  } else {
    for (let y = spacingPx; y < H; y += spacingPx) {
      rects += `<rect x="0" y="${y.toFixed(1)}" width="${W}" height="${lineWidthPx.toFixed(1)}" fill="${fill}" />`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${rects}</svg>`;
}
