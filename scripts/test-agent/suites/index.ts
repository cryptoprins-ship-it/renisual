import type { TestSuite } from "../types";
import { homepageTests } from "./homepage";
import { gevelcalcTests } from "./gevelcalc";
import { renderTests } from "./render";
import { renderApiTests } from "./renderApi";
import { subsidieTests } from "./subsidie";
import { wachtenTests } from "./wachten";
import { leaderboardTests } from "./leaderboard";
import { offerteTests } from "./offerte";
import { waitlistTests } from "./waitlist";

export const allSuites: TestSuite[] = [
  homepageTests,
  gevelcalcTests,
  renderTests,
  renderApiTests,
  subsidieTests,
  wachtenTests,
  leaderboardTests,
  offerteTests,
  waitlistTests,
];

export function findSuites(filter: string | undefined): TestSuite[] {
  if (!filter) return allSuites;
  const needle = filter.toLowerCase();
  const matched = allSuites.filter((s) => s.name.toLowerCase().includes(needle));
  if (matched.length === 0) {
    const known = allSuites.map((s) => s.name).join(", ");
    throw new Error(`No suite matches "${filter}". Available: ${known}`);
  }
  return matched;
}
