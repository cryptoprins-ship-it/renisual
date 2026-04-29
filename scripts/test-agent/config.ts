/**
 * Renisual test-agent configuration.
 *
 * Override `baseUrl` via the TEST_URL env var or by passing a URL as the first
 * positional CLI argument to scripts/test-agent/index.ts.
 */

export const config = {
  baseUrl: process.env.TEST_URL ?? "http://localhost:3000",
  reportDir: "public/test-results",
  screenshotDir: "public/test-results/screenshots",
  notifyEmail: "info@renisual.com",
  /** Per-test timeout in milliseconds. */
  timeout: 30_000,
  /** Number of retries before reporting a test as failed. */
  retries: 2,
} as const;

export type Config = typeof config;
