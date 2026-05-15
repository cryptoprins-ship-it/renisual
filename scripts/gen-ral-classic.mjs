// One-off generator for lib/ralColors.ts.
//
// Embeds the canonical RAL Classic (K7) table as plain JS data. Re-run
// after edits to regenerate the TypeScript file. Preserves load-bearing
// rich descriptions for 9006 / 9007 (used by Gemini's prompt to enforce
// metallic appearance) and the short descriptions on the codes already
// in use by Spanl/Keralit catalogs (7021, 7038, 9005, 9010).
//
// Hex values are from the public RAL K7 reference (Wikipedia table /
// official RAL fan). Some sources differ by 1–2 LSBs per channel.
//
// Run: node scripts/gen-ral-classic.mjs

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "..", "lib", "ralColors.ts");

// [code, hex, English RAL name]
const RAL_K7 = [
  // 1xxx — yellow / cream / beige
  ["1000", "#BEBD7F", "Green Beige"],
  ["1001", "#C2B078", "Beige"],
  ["1002", "#C6A664", "Sand Yellow"],
  ["1003", "#E5BE01", "Signal Yellow"],
  ["1004", "#CDA434", "Golden Yellow"],
  ["1005", "#A98307", "Honey Yellow"],
  ["1006", "#E4A010", "Maize Yellow"],
  ["1007", "#DC9D00", "Daffodil Yellow"],
  ["1011", "#8A6642", "Brown Beige"],
  ["1012", "#C7B446", "Lemon Yellow"],
  ["1013", "#EAE6CA", "Oyster White"],
  ["1014", "#E1CC4F", "Ivory"],
  ["1015", "#E6D2B5", "Light Ivory"],
  ["1016", "#F5D033", "Sulfur Yellow"],
  ["1017", "#F8F32B", "Saffron Yellow"],
  ["1018", "#9D9101", "Zinc Yellow"],
  ["1019", "#6A5D4D", "Grey Beige"],
  ["1020", "#705335", "Olive Yellow"],
  ["1021", "#F39F18", "Rape Yellow"],
  ["1023", "#F8D030", "Traffic Yellow"],
  ["1024", "#AE7C2C", "Ochre Yellow"],
  ["1026", "#FFFF00", "Luminous Yellow"],
  ["1027", "#9D9101", "Curry"],
  ["1028", "#F4A900", "Melon Yellow"],
  ["1032", "#D6AE01", "Broom Yellow"],
  ["1033", "#F3A505", "Dahlia Yellow"],
  ["1034", "#EFA94A", "Pastel Yellow"],
  ["1035", "#6A5F31", "Pearl Beige"],
  ["1036", "#705335", "Pearl Gold"],
  ["1037", "#F39F18", "Sun Yellow"],

  // 2xxx — orange
  ["2000", "#ED760E", "Yellow Orange"],
  ["2001", "#C93C20", "Red Orange"],
  ["2002", "#CB2821", "Vermilion"],
  ["2003", "#FF7514", "Pastel Orange"],
  ["2004", "#F44611", "Pure Orange"],
  ["2005", "#FF2301", "Luminous Orange"],
  ["2007", "#FFA420", "Luminous Bright Orange"],
  ["2008", "#F75E25", "Bright Red Orange"],
  ["2009", "#F54021", "Traffic Orange"],
  ["2010", "#D84B20", "Signal Orange"],
  ["2011", "#EC7C26", "Deep Orange"],
  ["2012", "#E55137", "Salmon Orange"],
  ["2013", "#C35831", "Pearl Orange"],
  ["2017", "#F75E25", "RAL Orange"],

  // 3xxx — red
  ["3000", "#AF2B1E", "Flame Red"],
  ["3001", "#A52019", "Signal Red"],
  ["3002", "#A2231D", "Carmine Red"],
  ["3003", "#9B111E", "Ruby Red"],
  ["3004", "#75151E", "Purple Red"],
  ["3005", "#5E2129", "Wine Red"],
  ["3007", "#412227", "Black Red"],
  ["3009", "#642424", "Oxide Red"],
  ["3011", "#781F19", "Brown Red"],
  ["3012", "#C1876B", "Beige Red"],
  ["3013", "#A12312", "Tomato Red"],
  ["3014", "#D36E70", "Antique Pink"],
  ["3015", "#EA899A", "Light Pink"],
  ["3016", "#B32821", "Coral Red"],
  ["3017", "#E63244", "Rose"],
  ["3018", "#D53032", "Strawberry Red"],
  ["3020", "#CC0605", "Traffic Red"],
  ["3022", "#D95030", "Salmon Pink"],
  ["3024", "#F80000", "Luminous Red"],
  ["3026", "#FE0000", "Luminous Bright Red"],
  ["3027", "#C51D34", "Raspberry Red"],
  ["3028", "#CB3234", "Pure Red"],
  ["3031", "#B32428", "Orient Red"],
  ["3032", "#721422", "Pearl Ruby Red"],
  ["3033", "#B44C43", "Pearl Pink"],

  // 4xxx — violet
  ["4001", "#6D3F5B", "Red Lilac"],
  ["4002", "#922B3E", "Red Violet"],
  ["4003", "#DE4C8A", "Heather Violet"],
  ["4004", "#641C34", "Claret Violet"],
  ["4005", "#6C4675", "Blue Lilac"],
  ["4006", "#A03472", "Traffic Purple"],
  ["4007", "#4A192C", "Purple Violet"],
  ["4008", "#924E7D", "Signal Violet"],
  ["4009", "#A18594", "Pastel Violet"],
  ["4010", "#CF3476", "Telemagenta"],
  ["4011", "#8673A1", "Pearl Violet"],
  ["4012", "#6C6874", "Pearl Blackberry"],

  // 5xxx — blue
  ["5000", "#354D73", "Violet Blue"],
  ["5001", "#1F3438", "Green Blue"],
  ["5002", "#20214F", "Ultramarine Blue"],
  ["5003", "#1D1E33", "Sapphire Blue"],
  ["5004", "#18171C", "Black Blue"],
  ["5005", "#1E2460", "Signal Blue"],
  ["5007", "#3E5F8A", "Brilliant Blue"],
  ["5008", "#26252D", "Grey Blue"],
  ["5009", "#025669", "Azure Blue"],
  ["5010", "#0E294B", "Gentian Blue"],
  ["5011", "#231A24", "Steel Blue"],
  ["5012", "#3B83BD", "Light Blue"],
  ["5013", "#1E213D", "Cobalt Blue"],
  ["5014", "#606E8C", "Pigeon Blue"],
  ["5015", "#2271B3", "Sky Blue"],
  ["5017", "#063971", "Traffic Blue"],
  ["5018", "#3F888F", "Turquoise Blue"],
  ["5019", "#1B5583", "Capri Blue"],
  ["5020", "#1D334A", "Ocean Blue"],
  ["5021", "#256D7B", "Water Blue"],
  ["5022", "#252850", "Night Blue"],
  ["5023", "#49678D", "Distant Blue"],
  ["5024", "#5D9B9B", "Pastel Blue"],
  ["5025", "#2A6478", "Pearl Gentian Blue"],
  ["5026", "#102C54", "Pearl Night Blue"],

  // 6xxx — green
  ["6000", "#316650", "Patina Green"],
  ["6001", "#287233", "Emerald Green"],
  ["6002", "#2D572C", "Leaf Green"],
  ["6003", "#424632", "Olive Green"],
  ["6004", "#1F3A3D", "Blue Green"],
  ["6005", "#2F4538", "Moss Green"],
  ["6006", "#3E3B32", "Grey Olive"],
  ["6007", "#343B29", "Bottle Green"],
  ["6008", "#39352A", "Brown Green"],
  ["6009", "#31372B", "Fir Green"],
  ["6010", "#35682D", "Grass Green"],
  ["6011", "#587246", "Reseda Green"],
  ["6012", "#343E40", "Black Green"],
  ["6013", "#6C7156", "Reed Green"],
  ["6014", "#47402E", "Yellow Olive"],
  ["6015", "#3B3C36", "Black Olive"],
  ["6016", "#1E5945", "Turquoise Green"],
  ["6017", "#4C9141", "May Green"],
  ["6018", "#57A639", "Yellow Green"],
  ["6019", "#BDECB6", "Pastel Green"],
  ["6020", "#2E3A23", "Chrome Green"],
  ["6021", "#89AC76", "Pale Green"],
  ["6022", "#25221B", "Olive Drab"],
  ["6024", "#308446", "Traffic Green"],
  ["6025", "#3D642D", "Fern Green"],
  ["6026", "#015D52", "Opal Green"],
  ["6027", "#84C3BE", "Light Green"],
  ["6028", "#2C5545", "Pine Green"],
  ["6029", "#20603D", "Mint Green"],
  ["6032", "#317F43", "Signal Green"],
  ["6033", "#497E76", "Mint Turquoise"],
  ["6034", "#7FB5B5", "Pastel Turquoise"],
  ["6035", "#1C542D", "Pearl Green"],
  ["6036", "#193737", "Pearl Opal Green"],
  ["6037", "#008F39", "Pure Green"],
  ["6038", "#00BB2D", "Luminous Green"],

  // 7xxx — grey
  ["7000", "#78858B", "Squirrel Grey"],
  ["7001", "#8A9597", "Silver Grey"],
  ["7002", "#7E7B52", "Olive Grey"],
  ["7003", "#6C7059", "Moss Grey"],
  ["7004", "#969992", "Signal Grey"],
  ["7005", "#646B63", "Mouse Grey"],
  ["7006", "#6D6552", "Beige Grey"],
  ["7008", "#6A5F31", "Khaki Grey"],
  ["7009", "#4D5645", "Green Grey"],
  ["7010", "#4C514A", "Tarpaulin Grey"],
  ["7011", "#434B4D", "Iron Grey"],
  ["7012", "#4E5754", "Basalt Grey"],
  ["7013", "#464531", "Brown Grey"],
  ["7015", "#434750", "Slate Grey"],
  ["7016", "#293133", "Anthracite Grey"],
  ["7022", "#332F2C", "Umbra Grey"],
  ["7023", "#686C5E", "Concrete Grey"],
  ["7024", "#474A51", "Graphite Grey"],
  ["7026", "#2F353B", "Granite Grey"],
  ["7030", "#8B8C7A", "Stone Grey"],
  ["7031", "#474B4E", "Blue Grey"],
  ["7032", "#B8B799", "Pebble Grey"],
  ["7033", "#7D8471", "Cement Grey"],
  ["7034", "#8F8B66", "Yellow Grey"],
  ["7035", "#D7D7D7", "Light Grey"],
  ["7036", "#7F7679", "Platinum Grey"],
  ["7037", "#7D7F7D", "Dusty Grey"],
  ["7039", "#6C6960", "Quartz Grey"],
  ["7040", "#9DA1AA", "Window Grey"],
  ["7042", "#8D948D", "Traffic Grey A"],
  ["7043", "#4E5452", "Traffic Grey B"],
  ["7044", "#CAC4B0", "Silk Grey"],
  ["7045", "#909090", "Telegrey 1"],
  ["7046", "#82898F", "Telegrey 2"],
  ["7047", "#D0D0D0", "Telegrey 4"],
  ["7048", "#898176", "Pearl Mouse Grey"],

  // 8xxx — brown
  ["8000", "#826C34", "Green Brown"],
  ["8001", "#955F20", "Ochre Brown"],
  ["8002", "#6C3B2A", "Signal Brown"],
  ["8003", "#734222", "Clay Brown"],
  ["8004", "#8E402A", "Copper Brown"],
  ["8007", "#59351F", "Fawn Brown"],
  ["8008", "#6F4F28", "Olive Brown"],
  ["8011", "#5B3A29", "Nut Brown"],
  ["8012", "#592321", "Red Brown"],
  ["8014", "#382C1E", "Sepia Brown"],
  ["8015", "#633A34", "Chestnut Brown"],
  ["8016", "#4C2F27", "Mahogany Brown"],
  ["8017", "#45322E", "Chocolate Brown"],
  ["8019", "#403A3A", "Grey Brown"],
  ["8022", "#212121", "Black Brown"],
  ["8023", "#A65E2E", "Orange Brown"],
  ["8024", "#79553D", "Beige Brown"],
  ["8025", "#755C48", "Pale Brown"],
  ["8028", "#4E3B31", "Terra Brown"],
  ["8029", "#763C28", "Pearl Copper"],

  // 9xxx — black / white
  ["9001", "#FDF4E3", "Cream"],
  ["9002", "#E7EBDA", "Grey White"],
  ["9003", "#F4F4F4", "Signal White"],
  ["9004", "#282828", "Signal Black"],
  ["9011", "#1C1C1C", "Graphite Black"],
  ["9016", "#F6F6F6", "Traffic White"],
  ["9017", "#1E1E1E", "Traffic Black"],
  ["9018", "#D7D7D7", "Papyrus White"],
  ["9022", "#9C9C9C", "Pearl Light Grey"],
  ["9023", "#828282", "Pearl Dark Grey"],
];

// Codes whose entry must be preserved verbatim from the existing file
// (load-bearing descriptions used by the Gemini render prompt).
const PRESERVED = {
  "7021": { hex: "#2A2D2F", name: "Black Grey", description: "very dark charcoal grey, almost black" },
  "7038": { hex: "#7B7B79", name: "Agate Grey", description: "medium agate grey" },
  "9005": { hex: "#0E0E10", name: "Jet Black", description: "deep matt black" },
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
  "9010": { hex: "#F1ECE1", name: "Pure White", description: "warm off-white" },
};

const merged = {};
for (const [code, hex, name] of RAL_K7) {
  merged[code] = { hex, name, description: name.toLowerCase() };
}
for (const [code, entry] of Object.entries(PRESERVED)) {
  merged[code] = entry;
}

const codes = Object.keys(merged).sort();

function escapeStr(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

const header = `export type RalEntry = {
  hex: string;
  name: string;
  // Verbose description used in the Gemini prompt — captures sheen / metallic
  // qualities that a hex value alone can't communicate.
  description: string;
};

// Generated by scripts/gen-ral-classic.mjs. Re-run that script to regenerate.
// Hex values come from the public RAL Classic (K7) reference. Entries for
// codes already in use by Spanl/Keralit catalogs keep their hand-tuned
// descriptions (load-bearing for the Gemini prompt) — see the PRESERVED
// table in the generator.
export const RAL_COLORS: Record<string, RalEntry> = {
`;

const lines = codes.map((code) => {
  const { hex, name, description } = merged[code];
  if (description.length > 60) {
    return `  "${code}": {\n    hex: "${hex}",\n    name: "${escapeStr(name)}",\n    description:\n      "${escapeStr(description)}",\n  },`;
  }
  return `  "${code}": { hex: "${hex}", name: "${escapeStr(name)}", description: "${escapeStr(description)}" },`;
});

const footer = `};

export function metallicWarningFor(ralCode: string): string {
  if (ralCode === "9006") {
    return "CRITICAL COLOUR WARNING: RAL 9006 is WHITE ALUMINIUM — a metallic silver-grey colour, NOT white. The rendered facade MUST look distinctly grey-silver, like brushed metal. If the output looks white or cream, it is WRONG.";
  }
  if (ralCode === "9007") {
    return "CRITICAL COLOUR WARNING: RAL 9007 is GREY ALUMINIUM — a darker metallic silver-grey, NOT plain grey paint. The rendered facade MUST read as anodised aluminium with a clear metallic sheen. If the output looks like flat matte grey, it is WRONG.";
  }
  return "";
}
`;

const content = header + lines.join("\n") + "\n" + footer;
writeFileSync(OUT, content, "utf8");
console.log(`Wrote ${OUT} with ${codes.length} entries.`);
