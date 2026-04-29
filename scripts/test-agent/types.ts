import type { Page } from "playwright";

export type TestStatus = "pass" | "fail" | "skip";

export type TestResult = {
  /** Suite the test belongs to. Set by the runner. */
  suite: string;
  /** Human-readable test name. */
  name: string;
  status: TestStatus;
  /** Total time spent on the test (last attempt) in ms. */
  duration: number;
  /** How many attempts were made (1 = passed first try, > 1 = retried). */
  attempts: number;
  /** Error message of the final failing attempt, if any. */
  error?: string;
  /** Path on disk to a failure screenshot, if captured. */
  screenshotPath?: string;
};

export type TestCase = {
  name: string;
  /**
   * Test body. Receives a fresh Playwright `Page`. Throw any error to mark the
   * test as failed; assertion helpers like `expect` from `@playwright/test`
   * also work fine.
   */
  run: (page: Page) => Promise<void>;
  /**
   * Set true to skip this test (without removing it from the suite). Useful
   * for tests that depend on routes/features not yet built.
   */
  skip?: boolean;
};

export type TestSuite = {
  /** Display name for the suite (used in CLI filter and reports). */
  name: string;
  /** Path under `baseUrl` that this suite primarily exercises. */
  url: string;
  tests: TestCase[];
  /** Optional: skip the entire suite. */
  skip?: boolean;
};
