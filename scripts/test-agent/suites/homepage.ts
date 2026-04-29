import { config } from "../config";
import type { TestSuite } from "../types";

export const homepageTests: TestSuite = {
  name: "Homepage",
  url: "/",
  tests: [
    {
      name: "Page loads with Renisual title",
      run: async (page) => {
        const res = await page.goto(`${config.baseUrl}/`);
        if (!res || res.status() >= 400) throw new Error(`HTTP ${res?.status() ?? "?"}`);
        const title = await page.title();
        if (!/Renisual/.test(title)) throw new Error(`title mismatch: "${title}"`);
      },
    },
    {
      name: "Hero H1 contains 'Renovatie'",
      run: async (page) => {
        await page.goto(`${config.baseUrl}/`);
        const h1 = await page.locator("h1").first().innerText();
        if (!/Renovatie/i.test(h1)) throw new Error(`h1 mismatch: "${h1}"`);
      },
    },
    {
      name: "Navigation has Calculator, AI Rendering, Subsidies",
      run: async (page) => {
        await page.goto(`${config.baseUrl}/`);
        for (const label of ["Calculator", "AI Rendering", "Subsidies"]) {
          const found = await page.locator(`nav >> text=${label}`).first().isVisible();
          if (!found) throw new Error(`nav missing "${label}"`);
        }
      },
    },
    {
      name: "ROI section renders bars",
      run: async (page) => {
        await page.goto(`${config.baseUrl}/#roi`);
        const text = await page.locator("body").innerText();
        if (!/Gevelisolatie|Dakisolatie|Gevelbekleding/i.test(text)) {
          throw new Error("ROI labels missing from page");
        }
      },
    },
    {
      name: "Roadmap section is present",
      run: async (page) => {
        await page.goto(`${config.baseUrl}/#roadmap`);
        const text = await page.locator("body").innerText();
        if (!/(Beschikbaar nu|Binnenkort)/i.test(text)) {
          throw new Error("Roadmap headings missing");
        }
      },
    },
    {
      name: "Waitlist form exists",
      run: async (page) => {
        await page.goto(`${config.baseUrl}/#roadmap`);
        const input = await page.locator('input[type="email"]').first().count();
        if (input === 0) throw new Error("waitlist email input not found");
      },
    },
    {
      name: "Footer has Subsidies link",
      run: async (page) => {
        await page.goto(`${config.baseUrl}/`);
        const footerHasSubsidies = await page
          .locator("footer >> text=Subsidies")
          .first()
          .isVisible();
        if (!footerHasSubsidies) throw new Error("footer Subsidies link missing");
      },
    },
  ],
};
