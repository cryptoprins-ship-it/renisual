import { config } from "../config";
import type { TestSuite } from "../types";

export const leaderboardTests: TestSuite = {
  name: "Leaderboard",
  url: "/leaderboard",
  tests: [
    {
      name: "Page loads",
      run: async (page) => {
        const res = await page.goto(`${config.baseUrl}/leaderboard`);
        if (!res || res.status() >= 400) throw new Error(`HTTP ${res?.status() ?? "?"}`);
      },
    },
    {
      name: "Heading mentions leaderboard or scores",
      run: async (page) => {
        await page.goto(`${config.baseUrl}/leaderboard`);
        const h1 = await page.locator("h1").first().innerText();
        if (!/(leaderboard|topscore|highscore|ranglijst)/i.test(h1)) {
          throw new Error(`h1 mismatch: "${h1}"`);
        }
      },
    },
    {
      name: "API /api/leaderboard returns JSON list",
      run: async (page) => {
        const res = await page.request.get(`${config.baseUrl}/api/leaderboard`);
        if (!res.ok()) throw new Error(`HTTP ${res.status()}`);
        const data = await res.json();
        if (!Array.isArray(data?.entries)) {
          throw new Error(`unexpected payload: ${JSON.stringify(data).slice(0, 100)}`);
        }
      },
    },
  ],
};
