import { config } from "../config";
import type { TestSuite } from "../types";

export const waitlistTests: TestSuite = {
  name: "Waitlist API",
  url: "/api/waitlist",
  tests: [
    {
      name: "POST with invalid email returns 4xx",
      run: async (page) => {
        const res = await page.request.post(`${config.baseUrl}/api/waitlist`, {
          data: { email: "not-an-email" },
        });
        if (res.status() < 400) {
          throw new Error(`expected 4xx for invalid email, got ${res.status()}`);
        }
      },
    },
    {
      name: "POST with empty body returns 4xx",
      run: async (page) => {
        const res = await page.request.post(`${config.baseUrl}/api/waitlist`, {
          data: {},
        });
        if (res.status() < 400) {
          throw new Error(`expected 4xx, got ${res.status()}`);
        }
      },
    },
  ],
};
