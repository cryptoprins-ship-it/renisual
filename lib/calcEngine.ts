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
};

export const DEFAULT_SPANL_PROFILES: ProfileSet = {
  startProfile: {
    name: "QBJ startersprofiel aluminium",
    lengthMm: 3000,
    priceEachExVat: 7.95,
  },
  endProfile: {
    name: "SBT J Channel eindprofiel wit",
    lengthMm: 3000,
    priceEachExVat: 12.95,
  },
  connectionProfile: {
    name: "PJ01 verbindingsprofiel",
    lengthMm: 3000,
    priceEachExVat: 12.95,
  },
  cornerProfile: {
    name: "YJ03 outside corner buitenhoek",
    lengthMm: 3000,
    priceEachExVat: 19.95,
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
  neededMeters: number
): ProfileCalculation {
  const lengthMeters = profile.lengthMm / 1000;
  const count = neededMeters > 0 ? Math.ceil(neededMeters / lengthMeters) : 0;
  return {
    label,
    name: profile.name,
    neededMeters: round2(neededMeters),
    lengthMeters,
    count,
    priceEachExVat: profile.priceEachExVat,
    totalExVat: round2(count * profile.priceEachExVat),
  };
}

export function calculateMaterialResult({
  sides,
  product,
  orientation,
  profiles = DEFAULT_SPANL_PROFILES,
}: {
  sides: CalcSide[];
  product: Product;
  orientation: Orientation;
  profiles?: ProfileSet;
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

  let startMeters = 0;
  let endMeters = 0;
  let connectionMeters = 0;
  let cornerMeters = 0;

  const panelLengthCm = product.panelLength / 10;
  const panelWorkCm = product.panelWorkSize / 10;

  sides.forEach((side) => {
    const widthCm = toNumber(side.width);
    const heightCm = toNumber(side.height);
    if (widthCm <= 0 || heightCm <= 0) return;

    // Bottom rail (Beginprofiel) — width of each side, regardless of
    // panel orientation. Top rail (Eindprofiel) likewise — both
    // orientations finish the upper edge with a J-channel.
    startMeters += widthCm / 100;
    endMeters += widthCm / 100;
    cornerMeters += 2 * (heightCm / 100);

    // PJ01 verbindingsprofiel exists only for horizontal panels.
    // Vertical panels have a built-in interlock and don't need it.
    if (orientation === "horizontal") {
      if (panelWorkCm > 0 && panelLengthCm > 0) {
        const rows = Math.ceil(heightCm / panelWorkCm);
        const panelsPerRow = Math.ceil(widthCm / panelLengthCm);
        connectionMeters += Math.max(0, panelsPerRow - 1) * rows * (panelWorkCm / 100);
      }
    }
  });

  const rules = product.profileRules[orientation];
  const profileItems: ProfileCalculation[] = [];

  if (rules.needsStartProfile)
    profileItems.push(calculateProfile("Beginprofiel", profiles.startProfile, startMeters));
  if (rules.needsEndProfile)
    profileItems.push(calculateProfile("Eindprofiel", profiles.endProfile, endMeters));
  if (rules.needsConnectionProfile)
    profileItems.push(calculateProfile("Verbindingsprofiel", profiles.connectionProfile, connectionMeters));
  if (rules.needsCornerProfile)
    profileItems.push(calculateProfile("Hoekprofiel", profiles.cornerProfile, cornerMeters));

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