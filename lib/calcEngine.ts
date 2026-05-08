import type { Orientation, Product } from "@/lib/productCatalog";

export type OpeningType = "window" | "door" | "other";

export type OpeningGroup = {
  id: string;
  type: OpeningType;
  label: string;
  width: string;
  height: string;
  count: string;
};

export type CalcSide = {
  id: string;
  name: string;
  width: string;
  height: string;
  openings: OpeningGroup[];
  photoDataUrl?: string;
};

export type ProfileItem = {
  name: string;
  lengthMm: number;
  priceEachExVat: number;
};

export type ProfileCalculation = {
  label: string;
  name: string;
  neededMeters: number;
  lengthMeters: number;
  count: number;
  priceEachExVat: number;
  totalExVat: number;
};

export type ProfileSet = {
  startProfile: ProfileItem;
  endProfile: ProfileItem;
  connectionProfile: ProfileItem;
  cornerProfile: ProfileItem;
  insideCornerProfile: ProfileItem;
};

export const DEFAULT_SPANL_PROFILES: ProfileSet = {
  startProfile: {
    name: "QBJ startersprofiel aluminium",
    lengthMm: 3000,
    priceEachExVat: 7.95,
  },
  endProfile: {
    // 3,8 m sticks (not 3 m as previously stored). Price corrected per
    // Spanl catalog. The same SKU also serves as the BOTTOM rail for
    // vertical installs (mounted upside down with drainage holes
    // drilled every 1 m + primer-coated interior — see install notes).
    name: "SBT J Channel eindprofiel",
    lengthMm: 3800,
    priceEachExVat: 14.95,
  },
  connectionProfile: {
    name: "PJ01 verbindingsprofiel",
    lengthMm: 3000,
    priceEachExVat: 12.95,
  },
  cornerProfile: {
    // YJ01 is the white outside-corner profile per Spanl's catalog.
    // Earlier code referenced "YJ03 buitenhoek €19.95" which was wrong
    // on both SKU and price.
    name: "YJ01 hoekprofiel buitenhoek wit",
    lengthMm: 3000,
    priceEachExVat: 12.95,
  },
  insideCornerProfile: {
    // YJDZ — aluminium binnenhoek, used wherever the facade folds
    // INWARD (L-shape, U-shape, gevel-uitbouw). Default zero usage;
    // count is driven by an explicit user input on /gevelcalc since
    // it can't be derived from per-side dimensions alone.
    name: "YJDZ hoekprofiel binnenhoek aluminium",
    lengthMm: 3000,
    priceEachExVat: 15.95,
  },
};

export function toNumber(value: string | number): number {
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateOpeningM2(opening: OpeningGroup): number {
  const widthM = toNumber(opening.width) / 100;
  const heightM = toNumber(opening.height) / 100;
  const count = toNumber(opening.count);
  if (widthM <= 0 || heightM <= 0 || count <= 0) return 0;
  return round2(widthM * heightM * count);
}

export function calculateSideGrossM2(side: CalcSide): number {
  const widthM = toNumber(side.width) / 100;
  const heightM = toNumber(side.height) / 100;
  if (widthM <= 0 || heightM <= 0) return 0;
  return round2(widthM * heightM);
}

export function calculateSideOpeningsM2(side: CalcSide): number {
  return round2(
    side.openings.reduce((sum, opening) => sum + calculateOpeningM2(opening), 0)
  );
}

export function calculateSideNetM2(side: CalcSide): number {
  return round2(Math.max(0, calculateSideGrossM2(side) - calculateSideOpeningsM2(side)));
}

export function calculateTotals(sides: CalcSide[]) {
  return sides.reduce(
    (sum, side) => ({
      gross: round2(sum.gross + calculateSideGrossM2(side)),
      openings: round2(sum.openings + calculateSideOpeningsM2(side)),
      net: round2(sum.net + calculateSideNetM2(side)),
    }),
    { gross: 0, openings: 0, net: 0 }
  );
}

function calculateProfile(
  label: string,
  profile: ProfileItem,
  neededMeters: number,
  // Caller supplies the actual stick count derived from the cutting
  // strategy (bin-packing for horizontal rails, per-edge ceiling for
  // corners). The profile object only knows length + price.
  explicitCount: number,
): ProfileCalculation {
  const lengthMeters = profile.lengthMm / 1000;
  return {
    label,
    name: profile.name,
    neededMeters: round2(neededMeters),
    lengthMeters,
    count: explicitCount,
    priceEachExVat: profile.priceEachExVat,
    totalExVat: round2(explicitCount * profile.priceEachExVat),
  };
}

/**
 * Bin-packing first-fit-decreasing for stick allocation.
 *
 * Each segment must fit into a single stick (with butt-joins WITHIN
 * a stick allowed for segments longer than stickLen — those produce
 * one or more "full" closed sticks plus a remainder). Smaller leftover
 * pieces from one stick can be used by other segments — that's how
 * a long side's offcut can cover a short side's extension.
 *
 * For 4 sides x 2.5m on 3.8m sticks: 4 sticks (each 2.5m piece doesn't
 * fit in another's 1.3m offcut).
 * For [13.5, 13.5, 5, 5] on 3.8m sticks: 10 sticks (offcuts pool
 * neatly to cover the short-side extensions).
 */
function packSticks(segmentsM: number[], stickLenM: number): number {
  if (stickLenM <= 0) return 0;
  const sorted = segmentsM
    .filter((s) => s > 0)
    .sort((a, b) => b - a);
  const remaining: number[] = []; // remaining capacity per opened stick
  for (const seg of sorted) {
    let toPlace = seg;
    // Segments longer than one stick: split into N full sticks + a
    // remainder. Each full stick is closed (no usable offcut, since
    // the segment occupies the whole length).
    while (toPlace > stickLenM) {
      remaining.push(0);
      toPlace -= stickLenM;
    }
    if (toPlace <= 0) continue;
    // Try to fit the remainder into an already-opened stick.
    const slot = remaining.findIndex((rem) => rem >= toPlace);
    if (slot >= 0) {
      remaining[slot] -= toPlace;
    } else {
      remaining.push(stickLenM - toPlace);
    }
  }
  return remaining.length;
}

export function calculateMaterialResult({
  sides,
  product,
  orientation,
  profiles = DEFAULT_SPANL_PROFILES,
  insideCornerCount = 0,
}: {
  sides: CalcSide[];
  product: Product;
  orientation: Orientation;
  profiles?: ProfileSet;
  // Number of inwardly-folding corners (L-shape, U-shape,
  // gevel-uitbouw). Cannot be derived from per-side widths +
  // heights alone — has to come from the user. Each inside corner
  // gets a YJDZ binnenhoek profile spanning the max facade height.
  insideCornerCount?: number;
}) {
  const totals = calculateTotals(sides);

  const wasteMultiplier = 1 + product.wasteFactor / 100;
  const netWithWaste = round2(totals.net * wasteMultiplier);

  let panelCount = 0;
  let pricePerPanel = 0;
  let materialPriceExVat = 0;

  if (product.type === "panel") {
    const panelAreaM2 = product.panelAreaM2 > 0 ? product.panelAreaM2 : null;
    if (panelAreaM2) {
      panelCount = Math.ceil(netWithWaste / panelAreaM2);
      pricePerPanel = product.pricePerPanelExVat ?? product.panelAreaM2 * product.pricePerM2ExVat;
      materialPriceExVat = round2(panelCount * pricePerPanel);
    }
  } else if (product.type === "paint") {
    materialPriceExVat = round2(netWithWaste * product.pricePerM2ExVat);
  }

  // Cutting model summary:
  //   Start / End / Connection rails (horizontal cladding lines):
  //     bin-packing FFD across all sides. Offcuts pool — a long
  //     side's leftover can supply a short side's extension. Hidden
  //     butt-joins are acceptable here.
  //   Outside corners + inside corners (vertical edges):
  //     per-edge ceiling — each corner cut from its own dedicated
  //     stick(s), no pooling. Mid-corner seams are visible/structural.
  //   Vertical orientation:
  //     ONLY the bottom rail uses SBT-J Eindprofiel (with drainage
  //     holes drilled by installer). Per Spanl docs there is no
  //     specified top rail for vertical — the panel terminates against
  //     the eaves/fascia.
  const startSegments: number[] = [];
  const endSegments: number[] = [];
  const connectionSegments: number[] = [];
  let cornerSticks = 0;
  let startMeters = 0;
  let endMeters = 0;
  let connectionMeters = 0;
  let cornerMeters = 0;

  const startLen = profiles.startProfile.lengthMm / 1000;
  const endLen = profiles.endProfile.lengthMm / 1000;
  const connectionLen = profiles.connectionProfile.lengthMm / 1000;
  const cornerLen = profiles.cornerProfile.lengthMm / 1000;
  const insideCornerLen = profiles.insideCornerProfile.lengthMm / 1000;

  const panelLengthCm = product.panelLength / 10;
  const panelWorkCm = product.panelWorkSize / 10;

  // Inside corners run the full vertical edge of the building. We use
  // the max side height as a proxy — slight overestimate when facades
  // vary, but inside corners are uncommon (L-shape, U-shape) so the
  // approximation is acceptable until we get per-corner heights.
  const maxHeightM = Math.max(
    0,
    ...sides
      .map((s) => toNumber(s.height) / 100)
      .filter((h) => Number.isFinite(h) && h > 0),
  );
  const insideCornerMeters = Math.max(0, insideCornerCount) * maxHeightM;
  // Per-corner ceiling: each inside corner cut from its own sticks.
  const insideCornerSticks =
    Math.max(0, insideCornerCount) *
    (maxHeightM > 0 ? Math.ceil(maxHeightM / insideCornerLen) : 0);

  sides.forEach((side) => {
    const widthCm = toNumber(side.width);
    const heightCm = toNumber(side.height);
    if (widthCm <= 0 || heightCm <= 0) return;

    const widthM = widthCm / 100;
    const heightM = heightCm / 100;

    // Outside corner: each side contributes ONE vertical corner edge
    // (shared with the next side). Per-corner ceiling — no pooling.
    cornerMeters += heightM;
    cornerSticks += Math.ceil(heightM / cornerLen);

    if (orientation === "horizontal") {
      // Bottom: Beginprofiel (QBJ).  Top: Eindprofiel (SBT-J).
      startMeters += widthM;
      startSegments.push(widthM);
      endMeters += widthM;
      endSegments.push(widthM);
      // PJ01 verbindingsprofiel between panels in the same row when
      // facade is wider than one panel length. Each row is its own
      // continuous segment for bin-packing.
      if (panelWorkCm > 0 && panelLengthCm > 0) {
        const rows = Math.ceil(heightCm / panelWorkCm);
        const panelsPerRow = Math.ceil(widthCm / panelLengthCm);
        const connectionsPerRow = Math.max(0, panelsPerRow - 1);
        const meterPerRow = connectionsPerRow * (panelWorkCm / 100);
        if (meterPerRow > 0) {
          for (let r = 0; r < rows; r++) connectionSegments.push(meterPerRow);
          connectionMeters += rows * meterPerRow;
        }
      }
    } else {
      // Vertical: only the BOTTOM rail uses SBT-J Eindprofiel (with
      // drainage holes drilled). No top rail per Spanl docs. No QBJ
      // start profile, no PJ01 verbindingsprofiel (built-in interlock).
      endMeters += widthM;
      endSegments.push(widthM);
    }
  });

  const startSticks = packSticks(startSegments, startLen);
  const endSticks = packSticks(endSegments, endLen);
  const connectionSticks = packSticks(connectionSegments, connectionLen);

  const rules = product.profileRules[orientation];
  const profileItems: ProfileCalculation[] = [];

  if (rules.needsStartProfile)
    profileItems.push(calculateProfile("Beginprofiel", profiles.startProfile, startMeters, startSticks));
  if (rules.needsEndProfile)
    profileItems.push(calculateProfile("Eindprofiel", profiles.endProfile, endMeters, endSticks));
  if (rules.needsConnectionProfile)
    profileItems.push(calculateProfile("Verbindingsprofiel", profiles.connectionProfile, connectionMeters, connectionSticks));
  if (rules.needsCornerProfile)
    profileItems.push(calculateProfile("Hoekprofiel", profiles.cornerProfile, cornerMeters, cornerSticks));
  // Inside corner profile is gated by user-supplied count rather than a
  // product-level rule. If the user didn't enter any binnenhoeken the
  // line is skipped.
  if (insideCornerSticks > 0)
    profileItems.push(calculateProfile("Binnenhoekprofiel", profiles.insideCornerProfile, insideCornerMeters, insideCornerSticks));

  const profilePriceExVat = round2(
    profileItems.reduce((sum, item) => sum + item.totalExVat, 0)
  );
  const subtotalExVat = round2(materialPriceExVat + profilePriceExVat);
  const totalExVat = subtotalExVat;

  return {
    totals,
    netWithWaste,
    panelCount,
    pricePerPanel,
    materialPriceExVat,
    profileItems,
    profilePriceExVat,
    subtotalExVat,
    totalExVat,
  };
}