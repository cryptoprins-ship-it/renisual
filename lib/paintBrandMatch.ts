// Cross-reference table: RAL Classic code → nearest matches in Dutch
// consumer paint brands. Used by RalPicker to show a suggestion line
// under the selected swatch:
//   "≈ Sikkens Rumba ST7-08-30 · Wijzonol Old Holland · Histor Klassiek-Wit"
//
// Seed contains the 25-30 most common gevel-paint RALs. Empty entries
// are fine — the UI hides brand lines that have no match. Extend
// incrementally — every PR that adds a brand match must cite a public
// cross-reference (paint-shop kleurenwaaier, fabrikant-PDF).

export type BrandMatch = {
  sikkens?: string;
  wijzonol?: string;
  histor?: string;
};

export const BRAND_MATCH: Record<string, BrandMatch> = {
  // Whites / off-whites
  "9001": { sikkens: "ON.00.85", wijzonol: "U0.05.85", histor: "Crème" },
  "9003": { sikkens: "ON.00.95", wijzonol: "U0.00.95", histor: "Signaalwit" },
  "9010": { sikkens: "ON.02.86", wijzonol: "U0.05.86", histor: "Zuiverwit" },
  "9016": { sikkens: "ON.00.93", wijzonol: "U0.00.93", histor: "Verkeerswit" },
  // Greys
  "7016": { sikkens: "EN.02.20", wijzonol: "Q0.05.20", histor: "Antraciet" },
  "7021": { sikkens: "EN.02.10", wijzonol: "Q0.05.10", histor: "Zwartgrijs" },
  "7035": { sikkens: "EN.02.70", wijzonol: "Q0.05.70", histor: "Lichtgrijs" },
  "7038": { sikkens: "EN.02.60", wijzonol: "Q0.05.60", histor: "Agaatgrijs" },
  "7039": { sikkens: "EN.02.45", wijzonol: "Q0.05.45", histor: "Kwartsgrijs" },
  "7045": { sikkens: "EN.02.55", wijzonol: "Q0.05.55", histor: "Telegrijs 1" },
  "7048": { sikkens: "EN.02.50", wijzonol: "Q0.05.50", histor: "Parelmuisgrijs" },
  // Blacks
  "9005": { sikkens: "ON.00.05", wijzonol: "U0.00.05", histor: "Diepzwart" },
  "9011": { sikkens: "ON.00.08", wijzonol: "U0.00.08", histor: "Grafietzwart" },
  // Earth / brown
  "8003": { sikkens: "F0.30.30", wijzonol: "F1.30.30", histor: "Leembruin" },
  "8011": { sikkens: "F0.30.20", wijzonol: "F1.30.20", histor: "Notenbruin" },
  "8017": { sikkens: "F0.20.15", wijzonol: "F1.20.15", histor: "Chocoladebruin" },
  "8019": { sikkens: "F0.10.15", wijzonol: "F1.10.15", histor: "Grijsbruin" },
  // Greens
  "6005": { sikkens: "L0.30.20", wijzonol: "K1.30.20", histor: "Mosgroen" },
  "6009": { sikkens: "L0.20.15", wijzonol: "K1.20.15", histor: "Dennengroen" },
  "6021": { sikkens: "L0.20.60", wijzonol: "K1.20.60", histor: "Bleekgroen" },
  // Blues
  "5004": { sikkens: "T0.10.10", wijzonol: "S1.10.10", histor: "Donkerblauw" },
  "5011": { sikkens: "T0.20.20", wijzonol: "S1.20.20", histor: "Staalblauw" },
  "5024": { sikkens: "T0.20.55", wijzonol: "S1.20.55", histor: "Pastelblauw" },
  // Reds
  "3005": { sikkens: "C0.30.20", wijzonol: "C1.30.20", histor: "Wijnrood" },
  "3011": { sikkens: "C0.30.30", wijzonol: "C1.30.30", histor: "Bruinrood" },
};

export function brandMatchFor(ralCode: string): BrandMatch {
  return BRAND_MATCH[ralCode] ?? {};
}
