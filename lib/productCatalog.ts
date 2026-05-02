import { SPANL_PANELS, finishEn, type SpanlFinish } from "@/lib/spanlPanelCatalog";

export type Orientation = "horizontal" | "vertical";
export type ProductType = "panel" | "paint" | "kozijn" | "insulation";
export type ProductCategory = "gevelbekleding" | "kozijnen" | "isolatie";

export function categoryForType(type: ProductType): ProductCategory {
  if (type === "kozijn") return "kozijnen";
  if (type === "insulation") return "isolatie";
  return "gevelbekleding";
}

export type ProfileRules = {
  needsConnectionProfile: boolean;
  needsStartProfile: boolean;
  needsEndProfile: boolean;
  needsCornerProfile: boolean;
};

export type Product = {
  id: string;
  name: string;
  brand: string;
  description: string;
  type: ProductType;
  orientations: Orientation[];
  panelLength: number;
  panelVisibleHeight: number;
  panelWorkSize: number;
  thickness: number;
  panelAreaM2: number;
  pricePerLinearMeterExVat?: number;
  pricePerPanelExVat?: number;
  pricePerM2ExVat: number;
  wasteFactor: number;
  insulationValue?: string;
  soundReduction?: string;
  fireClass?: string;
  coating?: string;
  warranty?: string;
  colors?: string[];
  profileRules: Record<Orientation, ProfileRules>;
  spanlFinish?: SpanlFinish;
  spanlPanelWidthCm?: number;
};

const defaultPanelRules: Record<Orientation, ProfileRules> = {
  horizontal: {
    needsConnectionProfile: true,
    needsStartProfile: true,
    needsEndProfile: true,
    needsCornerProfile: true,
  },
  vertical: {
    needsConnectionProfile: true,
    needsStartProfile: true,
    needsEndProfile: true,
    needsCornerProfile: true,
  },
};

const paintProfileRules: Record<Orientation, ProfileRules> = {
  horizontal: {
    needsConnectionProfile: false,
    needsStartProfile: false,
    needsEndProfile: false,
    needsCornerProfile: false,
  },
  vertical: {
    needsConnectionProfile: false,
    needsStartProfile: false,
    needsEndProfile: false,
    needsCornerProfile: false,
  },
};

const SPANL_PROFILE_RULES: Record<Orientation, ProfileRules> = {
  horizontal: { needsConnectionProfile: true, needsStartProfile: true, needsEndProfile: true, needsCornerProfile: true },
  vertical: { needsConnectionProfile: false, needsStartProfile: true, needsEndProfile: false, needsCornerProfile: true },
};

const SPANL_PRICE_PER_M2 = 29.5;

function spanlOrientations(finish: SpanlFinish): Orientation[] {
  if (finish === "monoFlat" || finish === "monoGroove") return ["horizontal", "vertical"];
  return ["horizontal"];
}

function spanlProducts(): Product[] {
  return SPANL_PANELS.map((panel) => {
    const widthM = panel.panelWidthCm / 100;
    const lengthMm = 4200;
    const lengthM = lengthMm / 1000;
    const panelAreaM2 = Number((widthM * lengthM).toFixed(3));
    const pricePerPanelExVat = Number((panelAreaM2 * SPANL_PRICE_PER_M2).toFixed(2));
    const ralPart = panel.ral ? ` (RAL ${panel.ral})` : "";
    const note = panel.note ? ` — ${panel.note}` : "";
    return {
      id: `spanl-${panel.sku.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
      name: `${panel.sku} — ${panel.colorEn}${ralPart}`,
      brand: "Spanl",
      description: `Spanl ${panel.sku} (${finishEn(panel.finish)}). ${panel.panelWidthCm} cm zichtbare paneelmaat${note}.`,
      type: "panel",
      orientations: spanlOrientations(panel.finish),
      panelLength: lengthMm,
      panelVisibleHeight: panel.panelWidthCm * 10 + 10,
      panelWorkSize: panel.panelWidthCm * 10,
      thickness: 16,
      panelAreaM2,
      pricePerPanelExVat,
      pricePerM2ExVat: SPANL_PRICE_PER_M2,
      wasteFactor: 8,
      insulationValue: "m².K/W 0.74",
      soundReduction: "20-25 dB",
      fireClass: "Euroklasse A2 volgens EN13501-1",
      coating: "Akzo Nobel poedercoating, vuilafstotend",
      warranty: "10 jaar garantie op coating",
      profileRules: SPANL_PROFILE_RULES,
      spanlFinish: panel.finish,
      spanlPanelWidthCm: panel.panelWidthCm,
    } satisfies Product;
  });
}

export const products: Product[] = [
  ...spanlProducts(),
  {
    id: "keralit-gevelpaneel-250",
    name: "Gevelpaneel 250mm",
    brand: "Keralit",
    description: "PVC gevelpaneel 250mm, onderhoudsvrij, 30 jaar garantie",
    type: "panel",
    orientations: ["horizontal"],
    panelLength: 4000,
    panelVisibleHeight: 250,
    panelWorkSize: 250,
    thickness: 13,
    panelAreaM2: 1.0,
    pricePerM2ExVat: 28,
    wasteFactor: 10,
    warranty: "30 jaar",
    coating: "Onderhoudsvrije PVC-coating",
    colors: ["Wit", "Crème", "Grijs", "Antraciet", "Zwart", "Bruin", "Donker eiken", "Licht eiken", "Mahonie", "Steenrood", "Monumentenblauw", "Staalblauw", "Mosgroen", "Donkergroen", "Bruingrijs", "Zwartgrijs", "Basaltgrijs", "Kwartsgrijs", "Licht", "Wijnrood", "Rood", "Donkerbruin", "Golden", "Californian", "Vergrijsd", "Monumentengroen", "Timbergreen", "Snowwhite", "Sandcream", "Skyblue", "Dustgrey", "Nightblack", "Natuur", "Taupe"],
    profileRules: defaultPanelRules,
  },
  {
    id: "keralit-gevelpaneel-167",
    name: "Gevelpaneel 167mm",
    brand: "Keralit",
    description: "PVC gevelpaneel 167mm, onderhoudsvrij, 30 jaar garantie",
    type: "panel",
    orientations: ["horizontal"],
    panelLength: 4000,
    panelVisibleHeight: 167,
    panelWorkSize: 167,
    thickness: 13,
    panelAreaM2: 0.668,
    pricePerM2ExVat: 30,
    wasteFactor: 10,
    warranty: "30 jaar",
    coating: "Onderhoudsvrije PVC-coating",
    colors: ["Wit", "Crème", "Grijs", "Antraciet", "Zwart", "Bruin", "Donker eiken", "Licht eiken", "Mahonie", "Steenrood", "Monumentenblauw", "Staalblauw", "Mosgroen", "Donkergroen", "Bruingrijs", "Zwartgrijs", "Basaltgrijs", "Kwartsgrijs", "Licht", "Wijnrood", "Rood", "Donkerbruin", "Golden", "Californian", "Vergrijsd", "Monumentengroen", "Timbergreen", "Snowwhite", "Sandcream", "Skyblue", "Dustgrey", "Nightblack", "Natuur", "Taupe"],
    profileRules: defaultPanelRules,
  },
  {
    id: "keralit-rabatdeel-180",
    name: "Rabatdeel 180mm",
    brand: "Keralit",
    description: "PVC rabatdeel met klassieke uitstraling, volledig onderhoudsvrij",
    type: "panel",
    orientations: ["horizontal"],
    panelLength: 4000,
    panelVisibleHeight: 180,
    panelWorkSize: 180,
    thickness: 13,
    panelAreaM2: 0.72,
    pricePerM2ExVat: 32,
    wasteFactor: 10,
    warranty: "30 jaar",
    coating: "Onderhoudsvrije PVC-coating",
    colors: ["Wit", "Crème", "Grijs", "Antraciet", "Zwart", "Bruin", "Donker eiken", "Licht eiken", "Mahonie", "Steenrood", "Monumentenblauw", "Staalblauw", "Mosgroen", "Donkergroen", "Bruingrijs", "Zwartgrijs", "Basaltgrijs", "Kwartsgrijs", "Licht", "Wijnrood", "Rood", "Donkerbruin", "Golden", "Californian", "Vergrijsd", "Monumentengroen", "Timbergreen", "Snowwhite", "Sandcream", "Skyblue", "Dustgrey", "Nightblack", "Natuur", "Taupe"],
    profileRules: defaultPanelRules,
  },
  {
    id: "generic-wood-cladding-horizontal",
    name: "Wood Cladding Horizontal",
    brand: "Generic",
    description: "Generic horizontal wood cladding for facade renovation.",
    type: "panel",
    orientations: ["horizontal"],
    panelLength: 3000,
    panelVisibleHeight: 180,
    panelWorkSize: 180,
    thickness: 18,
    panelAreaM2: 0.54,
    pricePerM2ExVat: 65,
    wasteFactor: 10,
    profileRules: defaultPanelRules,
  },
  {
    id: "generic-wood-cladding-vertical",
    name: "Wood Cladding Vertical",
    brand: "Generic",
    description: "Generic vertical wood cladding for facade renovation.",
    type: "panel",
    orientations: ["vertical"],
    panelLength: 3000,
    panelVisibleHeight: 150,
    panelWorkSize: 150,
    thickness: 18,
    panelAreaM2: 0.45,
    pricePerM2ExVat: 70,
    wasteFactor: 12,
    profileRules: defaultPanelRules,
  },
  {
    id: "generic-composite-panels",
    name: "Composite Facade Panels",
    brand: "Generic",
    description: "Generic composite facade panel system.",
    type: "panel",
    orientations: ["horizontal", "vertical"],
    panelLength: 3600,
    panelVisibleHeight: 180,
    panelWorkSize: 180,
    thickness: 20,
    panelAreaM2: 0.65,
    pricePerM2ExVat: 85,
    wasteFactor: 8,
    profileRules: defaultPanelRules,
  },
  {
    id: "generic-facade-board",
    name: "Facade Board",
    brand: "Generic",
    description: "Generic facade board / sheet material.",
    type: "panel",
    orientations: ["horizontal", "vertical"],
    panelLength: 3050,
    panelVisibleHeight: 1220,
    panelWorkSize: 1220,
    thickness: 8,
    panelAreaM2: 3.72,
    pricePerM2ExVat: 55,
    wasteFactor: 10,
    profileRules: defaultPanelRules,
  },
  {
    id: "generic-exterior-paint",
    name: "Exterior Paint",
    brand: "Generic",
    description: "Generic exterior paint system for facade renovation.",
    type: "paint",
    orientations: ["horizontal", "vertical"],
    panelLength: 0,
    panelVisibleHeight: 0,
    panelWorkSize: 0,
    thickness: 0,
    panelAreaM2: 0,
    pricePerM2ExVat: 25,
    wasteFactor: 5,
    profileRules: paintProfileRules,
  },
  {
    id: "deceuninck-zendow-70",
    name: "Zendow 70",
    brand: "Deceuninck",
    description: "Kunststof kozijnsysteem met 5-kamer profiel, 70 mm bouwdiepte, hoge isolatiewaarde.",
    type: "kozijn",
    orientations: ["horizontal", "vertical"],
    panelLength: 0,
    panelVisibleHeight: 0,
    panelWorkSize: 0,
    thickness: 70,
    panelAreaM2: 0,
    pricePerM2ExVat: 580,
    wasteFactor: 5,
    insulationValue: "Uf 1.3 W/m².K",
    warranty: "10 jaar garantie op profielen",
    profileRules: paintProfileRules,
  },
  {
    id: "kommerling-88-md",
    name: "76 MD",
    brand: "Kömmerling",
    description: "Duits 6-kamer kunststof kozijnsysteem, 76 mm bouwdiepte, geschikt voor passief bouwen.",
    type: "kozijn",
    orientations: ["horizontal", "vertical"],
    panelLength: 0,
    panelVisibleHeight: 0,
    panelWorkSize: 0,
    thickness: 76,
    panelAreaM2: 0,
    pricePerM2ExVat: 620,
    wasteFactor: 5,
    insulationValue: "Uf 1.0 W/m².K",
    warranty: "10 jaar garantie op profielen",
    profileRules: paintProfileRules,
  },
  {
    id: "schuco-aws-75",
    name: "AWS 75.SI+",
    brand: "Schüco",
    description: "Aluminium kozijnsysteem met thermische onderbreking, 75 mm bouwdiepte, hoogwaardige afwerking.",
    type: "kozijn",
    orientations: ["horizontal", "vertical"],
    panelLength: 0,
    panelVisibleHeight: 0,
    panelWorkSize: 0,
    thickness: 75,
    panelAreaM2: 0,
    pricePerM2ExVat: 850,
    wasteFactor: 5,
    insulationValue: "Uf 1.1 W/m².K",
    warranty: "10 jaar garantie op profielen en coating",
    profileRules: paintProfileRules,
  },
  {
    id: "rockwool-frontrock",
    name: "Frontrock MAX E",
    brand: "Rockwool",
    description: "Steenwol gevelisolatieplaat voor minerale buitenpleister, niet brandbaar (Euroklasse A1).",
    type: "insulation",
    orientations: ["horizontal", "vertical"],
    panelLength: 1000,
    panelVisibleHeight: 600,
    panelWorkSize: 600,
    thickness: 100,
    panelAreaM2: 0.6,
    pricePerM2ExVat: 45,
    wasteFactor: 5,
    insulationValue: "λ 0.036 W/m.K — Rd 2.78 m².K/W bij 100 mm",
    fireClass: "Euroklasse A1 (niet brandbaar)",
    warranty: "Levenslang (steenwol)",
    profileRules: paintProfileRules,
  },
  {
    id: "isover-facade",
    name: "Façade 32",
    brand: "Isover",
    description: "Glaswol gevelisolatie geschikt voor spouw- en voorzetwand-isolatie.",
    type: "insulation",
    orientations: ["horizontal", "vertical"],
    panelLength: 1200,
    panelVisibleHeight: 600,
    panelWorkSize: 600,
    thickness: 100,
    panelAreaM2: 0.72,
    pricePerM2ExVat: 18,
    wasteFactor: 5,
    insulationValue: "λ 0.032 W/m.K — Rd 3.13 m².K/W bij 100 mm",
    fireClass: "Euroklasse A1",
    warranty: "Levenslang (glaswol)",
    profileRules: paintProfileRules,
  },
  {
    id: "recticel-eurowall",
    name: "Eurowall PIR",
    brand: "Recticel",
    description: "PIR isolatieplaat met aluminium cachering — hoge isolatiewaarde bij beperkte dikte.",
    type: "insulation",
    orientations: ["horizontal", "vertical"],
    panelLength: 1200,
    panelVisibleHeight: 600,
    panelWorkSize: 600,
    thickness: 80,
    panelAreaM2: 0.72,
    pricePerM2ExVat: 35,
    wasteFactor: 5,
    insulationValue: "λ 0.022 W/m.K — Rd 3.6 m².K/W bij 80 mm",
    fireClass: "Euroklasse E",
    warranty: "10 jaar fabrieksgarantie",
    profileRules: paintProfileRules,
  },
];