import { chromium, type Browser } from "playwright";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { config } from "./config";
import type { TestResult, TestSuite } from "./types";

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function runOne(
  browser: Browser,
  suite: TestSuite,
  test: TestSuite["tests"][number]
): Promise<TestResult> {
  if (test.skip || suite.skip) {
    return {
      suite: suite.name,
      name: test.name,
      status: "skip",
      duration: 0,
      attempts: 0,
    };
  }

  const maxAttempts = 1 + Math.max(0, config.retries);
  let lastError = "";
  let lastDuration = 0;
  let attempts = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    attempts = attempt;
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(config.timeout);
    const t0 = Date.now();
    try {
      await test.run(page);
      lastDuration = Date.now() - t0;
      await ctx.close();
      return {
        suite: suite.name,
        name: test.name,
        status: "pass",
        duration: lastDuration,
        attempts,
      };
    } catch (err) {
      lastDuration = Date.now() - t0;
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt === maxAttempts) {
        const file = `${slug(suite.name)}__${slug(test.name)}.png`;
        const path = join(config.screenshotDir, file);
        try {
          await page.screenshot({ path, fullPage: false });
        } catch {
          /* ignore screenshot failures */
        }
        await ctx.close();
        return {
          suite: suite.name,
          name: test.name,
          status: "fail",
          duration: lastDuration,
          attempts,
          error: lastError,
          screenshotPath: path,
        };
      }
      await ctx.close();
    }
  }

  return {
    suite: suite.name,
    name: test.name,
    status: "fail",
    duration: lastDuration,
    attempts,
    error: lastError,
  };
}

export async function runSuites(suites: TestSuite[]): Promise<TestResult[]> {
  await mkdir(config.reportDir, { recursive: true });
  await mkdir(config.screenshotDir, { recursive: true });

  const browser = await chromium.launch();
  try {
    const results: TestResult[] = [];
    for (const suite of suites) {
      for (const test of suite.tests) {
        const res = await runOne(browser, suite, test);
        const tag = res.status === "pass" ? "PASS" : res.status === "skip" ? "SKIP" : "FAIL";
        const retryNote = res.attempts > 1 ? ` (retry ${res.attempts}/${1 + config.retries})` : "";
        const errNote = res.error ? ` — ${res.error.split("\n")[0]}` : "";
        console.log(`  [${tag}] ${suite.name} › ${res.name} ${res.duration}ms${retryNote}${errNote}`);
        results.push(res);
      }
    }
    return results;
  } finally {
    await browser.close();
  }
}
