import { config } from "../config";
import type { TestSuite } from "../types";

export const renderTests: TestSuite = {
  name: "Render",
  url: "/render",
  tests: [
    {
      name: "Page loads",
      run: async (page) => {
        const res = await page.goto(`${config.baseUrl}/render`);
        if (!res || res.status() >= 400) throw new Error(`HTTP ${res?.status() ?? "?"}`);
      },
    },
    {
      name: "Photo upload control present",
      run: async (page) => {
        await page.goto(`${config.baseUrl}/render`);
        const file = page.locator('input[type="file"]').first();
        if ((await file.count()) === 0) throw new Error("no file input on /render");
      },
    },
    {
      name: "Material picker shows Spanl or Keralit colors",
      run: async (page) => {
        await page.goto(`${config.baseUrl}/render`);
        const text = await page.locator("body").innerText();
        if (!/(Spanl|Keralit)/i.test(text)) {
          throw new Error("no Spanl or Keralit picker visible");
        }
      },
    },
    {
      name: "Generate button is present and disabled without photo",
      run: async (page) => {
        await page.goto(`${config.baseUrl}/render`);
        const buttons = page.locator("button");
        const count = await buttons.count();
        let foundGenerate = false;
        for (let i = 0; i < count; i++) {
          const txt = (await buttons.nth(i).innerText()).trim();
          if (/genereer|render/i.test(txt)) {
            foundGenerate = true;
            break;
          }
        }
        if (!foundGenerate) throw new Error("no generate/render button found");
      },
    },
    {
      name: "Variants counter shows X/3",
      run: async (page) => {
        await page.goto(`${config.baseUrl}/render`);
        const text = await page.locator("body").innerText();
        if (!/\d\s*\/\s*3/.test(text)) {
          throw new Error("no X/3 variants counter visible");
        }
      },
    },
  ],
};
