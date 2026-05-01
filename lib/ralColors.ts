export type RalEntry = {
  hex: string;
  name: string;
  // Verbose description used in the Gemini prompt — captures sheen / metallic
  // qualities that a hex value alone can't communicate.
  description: string;
};

// Single source of truth for RAL → name + hex + prompt description.
// Limited to the codes used by Spanl/Keralit cladding today; extend when
// new SKUs appear. Hex values follow common reference tables (RAL K7);
// some sources differ by 1-2 LSBs in each channel — close enough for
// Gemini's purposes.
export const RAL_COLORS: Record<string, RalEntry> = {
  "7021": {
    hex: "#2A2D2F",
    name: "Black Grey",
    description: "very dark charcoal grey, almost black",
  },
  "7038": {
    hex: "#7B7B79",
    name: "Agate Grey",
    description: "medium agate grey",
  },
  "9005": {
    hex: "#0E0E10",
    name: "Jet Black",
    description: "deep matt black",
  },
  "9006": {
    hex: "#A5A8A6",
    name: "White Aluminium",
    description:
      "WHITE ALUMINIUM — this is NOT white. It is a medium metallic silver-grey, similar to brushed aluminium or galvanized steel. The surface has a subtle metallic sheen. Hex value #A5A8A6. Do NOT render as white or cream. Render as distinctly grey with metallic quality.",
  },
  "9007": {
    hex: "#8F8F8C",
    name: "Grey Aluminium",
    description:
      "GREY ALUMINIUM — a darker metallic silver-grey than RAL 9006, similar to anodised aluminium. Distinctly grey with a metallic sheen. Hex value #8F8F8C. Do NOT render as plain grey paint — it must read as metallic.",
  },
  "9010": {
    hex: "#F1ECE1",
    name: "Pure White",
    description: "warm off-white",
  },
};

export function metallicWarningFor(ralCode: string): string {
  if (ralCode === "9006") {
    return "CRITICAL COLOUR WARNING: RAL 9006 is WHITE ALUMINIUM — a metallic silver-grey colour, NOT white. The rendered facade MUST look distinctly grey-silver, like brushed metal. If the output looks white or cream, it is WRONG.";
  }
  if (ralCode === "9007") {
    return "CRITICAL COLOUR WARNING: RAL 9007 is GREY ALUMINIUM — a darker metallic silver-grey, NOT plain grey paint. The rendered facade MUST read as anodised aluminium with a clear metallic sheen. If the output looks like flat matte grey, it is WRONG.";
  }
  return "";
}
