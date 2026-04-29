import { config } from "../config";
import type { TestSuite } from "../types";

/**
 * NOTE: /api/offerte sends real lead emails on success — the suite ONLY
 * exercises the validation path so we never spam info@renisual.com.
 */
export const offerteTests: TestSuite = {
  name: "Offerte API",
  url: "/api/offerte",
  tests: [
    {
      name: "POST with empty body returns 400",
      run: async (page) => {
        const res = await page.request.post(`${config.baseUrl}/api/offerte`, {
          data: {},
        });
        if (res.status() !== 400) {
          throw new Error(`expected 400, got ${res.status()}`);
        }
        const json = await res.json().catch(() => ({}));
        if (!json?.error) throw new Error("expected error field in response");
      },
    },
    {
      name: "POST missing postcode returns 400",
      run: async (page) => {
        const res = await page.request.post(`${config.baseUrl}/api/offerte`, {
          data: { naam: "Test", email: "test@example.com" },
        });
        if (res.status() !== 400) {
          throw new Error(`expected 400, got ${res.status()}`);
        }
      },
    },
    {
      name: "GET is not allowed",
      run: async (page) => {
        const res = await page.request.get(`${config.baseUrl}/api/offerte`);
        if (res.status() < 400) {
          throw new Error(`expected 4xx for GET, got ${res.status()}`);
        }
      },
    },
  ],
};
