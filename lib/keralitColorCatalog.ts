export type KeralitFinish = "classic-houtnerf" | "pure-mat" | "modern-eiken";

export const KERALIT_FINISH_LABEL_NL: Record<KeralitFinish, string> = {
  "classic-houtnerf": "Classic met houtnerf",
  "pure-mat": "Pure mat effen",
  "modern-eiken": "Modern eiken met houtstructuur",
};

export const KERALIT_FINISH_LABEL_EN: Record<KeralitFinish, string> = {
  "classic-houtnerf": "Classic with wood-grain texture",
  "pure-mat": "Pure matt smooth solid",
  "modern-eiken": "Modern oak with wood structure",
};

export type KeralitColor = {
  number: number;
  name: string;
  sku: string;
  finish: KeralitFinish;
  thumbnailUrl: string;
};

const CDN = "https://d7rh5s3nxmpy4.cloudfront.net/CMP2458";

export const KERALIT_COLORS: KeralitColor[] = [
  { number: 249, name: "Bruingrijs", sku: "BI9020", finish: "classic-houtnerf", thumbnailUrl: `${CDN}/FVKQ108BI9020_249_Bruingrijs_Classic_met_houtnerf_THM.jpg` },
  { number: 294, name: "Zwartgrijs", sku: "BI9053", finish: "classic-houtnerf", thumbnailUrl: `${CDN}/FVKQ123BI9053_294_Zwartgrijs_Classic_met_houtnerf_THM.jpg` },
  { number: 295, name: "Basaltgrijs", sku: "BI9018", finish: "classic-houtnerf", thumbnailUrl: `${CDN}/FVKQ124BI9018_295_Basaltgrijs_Classic_met_houtnerf_THM.jpg` },
  { number: 310, name: "Grijs", sku: "BI9030", finish: "classic-houtnerf", thumbnailUrl: `${CDN}/FVKQ126BI9030_310_Grijs_Classic_met_houtnerf_THM.jpg` },
  { number: 311, name: "Kwartsgrijs", sku: "BI9031", finish: "classic-houtnerf", thumbnailUrl: `${CDN}/FVKQ127BI9031_311_Kwartsgrijs_Classic_met_houtnerf_THM.jpg` },
  { number: 312, name: "Mosgroen", sku: "BI9036", finish: "classic-houtnerf", thumbnailUrl: `${CDN}/FVKQ128BI9036_312_Mosgroen_Classic_met_houtnerf_THM.jpg` },
  { number: 313, name: "Licht", sku: "BI9032", finish: "classic-houtnerf", thumbnailUrl: `${CDN}/FVKQ129BI9032_313_Licht_Classic_met_houtnerf_THM.jpg` },
  { number: 314, name: "Zwart", sku: "BI9052", finish: "classic-houtnerf", thumbnailUrl: `${CDN}/FVKQ130BI9052_314_Zwart_Classic_met_houtnerf_THM.jpg` },
  { number: 315, name: "Antraciet", sku: "BI9017", finish: "classic-houtnerf", thumbnailUrl: `${CDN}/FVKQ131BI9017_315_Antraciet_Classic_met_houtnerf_THM.jpg` },
  { number: 317, name: "Donker eiken", sku: "BI9027", finish: "classic-houtnerf", thumbnailUrl: `${CDN}/FVKQ133BI9027_317_Donker_eiken_Classic_met_houtnerf_THM.jpg` },
  { number: 318, name: "Licht eiken", sku: "BI9028", finish: "classic-houtnerf", thumbnailUrl: `${CDN}/FVKQ134BI9028_318_Licht_eiken_Classic_met_houtnerf_THM.jpg` },
  { number: 319, name: "Mahonie", sku: "BI9033", finish: "classic-houtnerf", thumbnailUrl: `${CDN}/FVKQ135BI9033_319_Mahonie_Classic_met_houtnerf_THM.jpg` },
  { number: 320, name: "Steenrood", sku: "BI9044", finish: "classic-houtnerf", thumbnailUrl: `${CDN}/FVKQ136BI9044_320_Steenrood_Classic_met_houtnerf_THM.jpg` },
  { number: 321, name: "Monumentenblauw", sku: "BI9034", finish: "classic-houtnerf", thumbnailUrl: `${CDN}/FVKQ137BI9034_321_Monumentenblauw_Classic_met_houtnerf_THM.jpg` },
  { number: 322, name: "Staalblauw", sku: "BI9043", finish: "classic-houtnerf", thumbnailUrl: `${CDN}/FVKQ138BI9043_322_Staalblauw_Classic_met_houtnerf_THM.jpg` },
  { number: 323, name: "Wijnrood", sku: "BI9050", finish: "classic-houtnerf", thumbnailUrl: `${CDN}/FVKQ139BI9050_323_Wijnrood_Classic_met_houtnerf_THM.jpg` },
  { number: 324, name: "Monumentengroen", sku: "BI9035", finish: "classic-houtnerf", thumbnailUrl: `${CDN}/FVKQ140BI9035_324_Monumentengroen_Classic_met_houtnerf_THM.jpg` },
  { number: 325, name: "Golden", sku: "BI9029", finish: "classic-houtnerf", thumbnailUrl: `${CDN}/FVKQ141BI9029_325_Golden_Classic_met_houtnerf_THM.jpg` },
  { number: 326, name: "Wit", sku: "BI9051", finish: "classic-houtnerf", thumbnailUrl: `${CDN}/FVKQ142BI9051_326_Wit_Classic_met_houtnerf_THM.jpg` },
  { number: 327, name: "Donkerbruin", sku: "BI9023", finish: "classic-houtnerf", thumbnailUrl: `${CDN}/FVKQ143BI9023_327_Donkerbruin_Classic_met_houtnerf_THM.jpg` },
  { number: 328, name: "Donkergroen", sku: "BI9024", finish: "classic-houtnerf", thumbnailUrl: `${CDN}/FVKQ144BI9024_328_Donkergroen_Classic_met_houtnerf_THM.jpg` },
  { number: 329, name: "Rood", sku: "BI9038", finish: "classic-houtnerf", thumbnailUrl: `${CDN}/FVKQ145BI9038_329_Rood_Classic_met_houtnerf_THM.jpg` },
  { number: 330, name: "Bruin", sku: "BI9019", finish: "classic-houtnerf", thumbnailUrl: `${CDN}/FVKQ146BI9019_330_Bruin_Classic_met_houtnerf_THM.jpg` },
  { number: 331, name: "Crème", sku: "BI6059", finish: "classic-houtnerf", thumbnailUrl: `${CDN}/FVKQ147BI6059_331_Creme_Classic_met_houtnerf_THM.jpg` },
  { number: 333, name: "Californian", sku: "BI9021", finish: "classic-houtnerf", thumbnailUrl: `${CDN}/FVKQ149BI9021_333_Californian_Classic_met_houtnerf_THM.jpg` },
  { number: 334, name: "Vergrijsd", sku: "BI9048", finish: "classic-houtnerf", thumbnailUrl: `${CDN}/FVKQ150BI9048_334_Vergrijsd_Classic_met_houtnerf_THM.jpg` },

  { number: 281, name: "Timbergreen", sku: "BI9046", finish: "pure-mat", thumbnailUrl: `${CDN}/FVKQ112BI9046_281_Timbergreen_Pure_mat_effen_THM.jpg` },
  { number: 282, name: "Snowwhite", sku: "BI9042", finish: "pure-mat", thumbnailUrl: `${CDN}/FVKQ113BI9042_282_Snowwhite_Pure_mat_effen_THM.jpg` },
  { number: 283, name: "Sandcream", sku: "BI9039", finish: "pure-mat", thumbnailUrl: `${CDN}/FVKQ114BI9039_283_Sandcream_Pure_mat_effen_THM.jpg` },
  { number: 286, name: "Skyblue", sku: "BI9041", finish: "pure-mat", thumbnailUrl: `${CDN}/FVKQ117BI9041_286_Skyblue_Pure_mat_effen_THM.jpg` },
  { number: 289, name: "Dustgrey", sku: "BI9025", finish: "pure-mat", thumbnailUrl: `${CDN}/FVKQ120BI9025_289_Dustgrey_Pure_mat_effen_THM.jpg` },
  { number: 290, name: "Nightblack", sku: "BI9037", finish: "pure-mat", thumbnailUrl: `${CDN}/FVKQ121BI9037_290_Nightblack_Pure_mat_effen_THM.jpg` },

  { number: 369, name: "Wit", sku: "BI9374", finish: "modern-eiken", thumbnailUrl: `${CDN}/FVKQ474BI9374_369_Wit_Modern_eiken_met_houtstructuur_THM.jpg` },
  { number: 370, name: "Natuur", sku: "BI9373", finish: "modern-eiken", thumbnailUrl: `${CDN}/FVKQ475BI9373_370_Natuur_Modern_eiken_met_houtstructuur_THM.jpg` },
  { number: 371, name: "Taupe", sku: "BI9372", finish: "modern-eiken", thumbnailUrl: `${CDN}/FVKQ476BI9372_371_Taupe_Modern_eiken_met_houtstructuur_THM.jpg` },
  { number: 553, name: "Bruin", sku: "BI9370", finish: "modern-eiken", thumbnailUrl: `${CDN}/FVKQ472BI9370_553_Bruin_Modern_eiken_met_houtstructuur_THM.jpg` },
  { number: 554, name: "Zwart", sku: "BI9371", finish: "modern-eiken", thumbnailUrl: `${CDN}/FVKQ473BI9371_554_Zwart_Modern_eiken_met_houtstructuur_THM.jpg` },
];

export function getKeralitColorsByFinish(finish: KeralitFinish): KeralitColor[] {
  return KERALIT_COLORS.filter((c) => c.finish === finish);
}

export function findKeralitColorByNumber(num: number): KeralitColor | undefined {
  return KERALIT_COLORS.find((c) => c.number === num);
}
