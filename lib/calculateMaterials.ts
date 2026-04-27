import type { Orientation, Product } from "./productCatalog";

export function calculateMaterials({
  netM2,
  product,
  orientation,
}: {
  netM2: number;
  product: Product;
  orientation: Orientation;
}) {
  const wasteMultiplier = 1 + product.wasteFactor / 100;
  const netWithWaste = netM2 * wasteMultiplier;

  const panelCount =
    product.type === "panel" && product.panelAreaM2 > 0
      ? Math.ceil(netWithWaste / product.panelAreaM2)
      : 0;

  const materialPriceExVat =
    product.type === "panel"
      ? panelCount * (product.pricePerPanelExVat ?? product.panelAreaM2 * product.pricePerM2ExVat)
      : netWithWaste * product.pricePerM2ExVat;

  const rules = product.profileRules[orientation];

  return {
    netM2,
    netWithWaste,
    panelCount,
    materialPriceExVat,
    needsConnectionProfile: rules.needsConnectionProfile,
    needsStartProfile: rules.needsStartProfile,
    needsEndProfile: rules.needsEndProfile,
    needsCornerProfile: rules.needsCornerProfile,
  };
}