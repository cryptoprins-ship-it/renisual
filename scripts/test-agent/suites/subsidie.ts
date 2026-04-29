import { config } from "../config";
import type { TestSuite } from "../types";

export const subsidieTests: TestSuite = {
  name: "Subsidie",
  url: "/subsidie",
  tests: [
    {
      name: "Page loads",
      run: async (page) => {
        const res = await page.goto(`${config.baseUrl}/subsidie`);
        if (!res || res.status() >= 400) throw new Error(`HTTP ${res?.status() ?? "?"}`);
      },
    },
    {
      name: "Heading mentions subsidies and 2026",
      run: async (page) => {
        await page.goto(`${config.baseUrl}/subsidie`);
        const h1 = await page.locator("h1").first().innerText();
        if (!/subsidie/i.test(h1)) throw new Error(`h1 mismatch: "${h1}"`);
        const body = await page.locator("body").innerText();
        if (!/2026/.test(body)) throw new Error("no 2026 reference on subsidie page");
      },
    },
    {
      name: "ISDE / SEEH-style scheme is mentioned",
      run: async (page) => {
        await page.goto(`${config.baseUrl}/subsidie`);
        const text = await page.locator("body").innerText();
        if (!/(ISDE|SEEH|gevelisolatie|dakisolatie)/i.test(text)) {
          throw new Error("no isolatie subsidie scheme mentioned");
        }
      },
    },
    {
      name: "Saldering article is removed",
      run: async (page) => {
        await page.goto(`${config.baseUrl}/subsidie`);
        const text = await page.locator("body").innerText();
        if (/saldering/i.test(text)) {
          throw new Error("saldering content still present on subsidie page");
        }
      },
    },
  ],
};
