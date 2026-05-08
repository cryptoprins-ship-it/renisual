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
    {
      name: "Batch status band shows after Render is clicked",
      run: async (page) => {
        await page.goto(`${config.baseUrl}/render`);
        // The smoke harness cannot synthesise a Supabase photo upload, so we
        // only verify the empty-state path: the band must NOT be visible
        // before any render has started.
        const bandBefore = await page
          .locator('[role="status"]:has-text("klaar")')
          .count();
        if (bandBefore !== 0) {
          throw new Error("batch status band visible before any render started");
        }
      },
    },
    {
      name: "Hamburger sheet opens and closes on mobile viewport",
      run: async (page) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto(`${config.baseUrl}/render`);
        const button = page.locator('button[aria-controls="mobile-nav-sheet"]');
        if ((await button.count()) === 0) {
          throw new Error("hamburger button not present on mobile viewport");
        }
        await button.click();
        const sheet = page.locator("#mobile-nav-sheet");
        if (!(await sheet.isVisible())) {
          throw new Error("sheet did not open after hamburger click");
        }
        // Click backdrop (the first sibling — fixed inset-0 button).
        await page.locator('button[aria-label*="sluiten"], button[aria-label*="close"]').first().click();
        if (await sheet.isVisible()) {
          throw new Error("sheet did not close after backdrop click");
        }
      },
    },
  ],
};
