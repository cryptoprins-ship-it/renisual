import { config } from "../config";
import type { TestSuite } from "../types";

export const wachtenTests: TestSuite = {
  name: "Wachten",
  url: "/wachten",
  tests: [
    {
      name: "Page loads",
      run: async (page) => {
        const res = await page.goto(`${config.baseUrl}/wachten`);
        if (!res || res.status() >= 400) throw new Error(`HTTP ${res?.status() ?? "?"}`);
      },
    },
    {
      name: "Render-progress banner is shown",
      run: async (page) => {
        await page.goto(`${config.baseUrl}/wachten`);
        const text = await page.locator("body").innerText();
        if (!/(render|gegenereerd|seconden|sec)/i.test(text)) {
          throw new Error("no render-progress banner detected");
        }
      },
    },
    {
      name: "2048 board is rendered",
      run: async (page) => {
        await page.goto(`${config.baseUrl}/wachten`);
        const text = await page.locator("body").innerText();
        if (!/2048/.test(text)) {
          throw new Error("no 2048 game indicator on /wachten");
        }
      },
    },
    {
      name: "Score is shown",
      run: async (page) => {
        await page.goto(`${config.baseUrl}/wachten`);
        const text = await page.locator("body").innerText();
        if (!/score/i.test(text)) {
          throw new Error("no score label on /wachten");
        }
      },
    },
  ],
};
