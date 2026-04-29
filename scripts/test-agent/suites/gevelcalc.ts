import { config } from "../config";
import type { TestSuite } from "../types";

export const gevelcalcTests: TestSuite = {
  name: "Gevelcalc",
  url: "/gevelcalc",
  tests: [
    {
      name: "Page loads",
      run: async (page) => {
        const res = await page.goto(`${config.baseUrl}/gevelcalc`);
        if (!res || res.status() >= 400) throw new Error(`HTTP ${res?.status() ?? "?"}`);
      },
    },
    {
      name: "Category tabs include Gevelbekleding, Kozijnen, Isolatie",
      run: async (page) => {
        await page.goto(`${config.baseUrl}/gevelcalc`);
        const body = await page.locator("body").innerText();
        for (const label of ["Gevelbekleding", "Kozijnen", "Isolatie"]) {
          if (!new RegExp(label, "i").test(body)) {
            throw new Error(`category tab "${label}" missing`);
          }
        }
      },
    },
    {
      name: "Surface input accepts a number",
      run: async (page) => {
        await page.goto(`${config.baseUrl}/gevelcalc`);
        const input = page.locator('input[type="number"]').first();
        if ((await input.count()) === 0) throw new Error("no number input on gevelcalc");
        await input.fill("42");
        const value = await input.inputValue();
        if (value !== "42") throw new Error(`input did not accept value, got "${value}"`);
      },
    },
    {
      name: "Has at least one product card",
      run: async (page) => {
        await page.goto(`${config.baseUrl}/gevelcalc`);
        await page.waitForLoadState("networkidle");
        const text = await page.locator("body").innerText();
        if (!/(Spanl|Keralit|Rockwool|Isover|Recticel)/i.test(text)) {
          throw new Error("no known product brand visible on gevelcalc");
        }
      },
    },
    {
      name: "Render link is reachable from gevelcalc",
      run: async (page) => {
        await page.goto(`${config.baseUrl}/gevelcalc`);
        const text = await page.locator("body").innerText();
        if (!/render|visualis/i.test(text)) {
          throw new Error("no link to /render found on gevelcalc");
        }
      },
    },
  ],
};
