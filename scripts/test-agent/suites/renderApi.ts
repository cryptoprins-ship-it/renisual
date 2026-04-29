import { config } from "../config";
import type { TestSuite } from "../types";

/**
 * NOTE: /api/render burns Gemini quota on a successful call. The suite only
 * verifies validation paths so live Gemini is never invoked from the smoke run.
 */
export const renderApiTests: TestSuite = {
  name: "Render API",
  url: "/api/render",
  tests: [
    {
      name: "POST with empty body returns 4xx",
      run: async (page) => {
        const res = await page.request.post(`${config.baseUrl}/api/render`, {
          data: {},
        });
        if (res.status() < 400) {
          throw new Error(`expected 4xx for empty body, got ${res.status()}`);
        }
      },
    },
    {
      name: "POST without photo returns 4xx",
      run: async (page) => {
        const res = await page.request.post(`${config.baseUrl}/api/render`, {
          data: { productLabel: "Spanl 9006", productDescription: "Test" },
        });
        if (res.status() < 400) {
          throw new Error(`expected 4xx without photo, got ${res.status()}`);
        }
      },
    },
  ],
};
