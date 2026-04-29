/**
 * Renisual smoke-test entry point.
 *
 * Usage:
 *   npx tsx scripts/test-agent                # runs every suite against TEST_URL
 *   npx tsx scripts/test-agent http://...     # overrides baseUrl positionally
 *   npx tsx scripts/test-agent --suite render # runs suites whose name matches
 *
 * Reports are written to public/test-results (HTML + JSON + screenshots) and,
 * on failure, an email is sent via the same SMTP_* env vars used by /api/offerte.
 */

import { config } from "./config";
import { runSuites } from "./runner";
import {
  generateConsoleReport,
  sendEmailReport,
  writeReportFiles,
} from "./reporter";
import { findSuites } from "./suites";

function parseArgs(argv: string[]): { suiteFilter?: string; positionalUrl?: string } {
  let suiteFilter: string | undefined;
  let positionalUrl: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--suite" || a === "-s") {
      suiteFilter = argv[i + 1];
      i++;
    } else if (a.startsWith("--suite=")) {
      suiteFilter = a.slice("--suite=".length);
    } else if (!positionalUrl && /^https?:\/\//.test(a)) {
      positionalUrl = a;
    }
  }
  return { suiteFilter, positionalUrl };
}

async function main() {
  const { suiteFilter, positionalUrl } = parseArgs(process.argv.slice(2));

  if (positionalUrl) {
    // mutate via cast — config is `as const` but baseUrl is meant to be overridable here
    (config as { baseUrl: string }).baseUrl = positionalUrl;
  }

  const suites = findSuites(suiteFilter);

  console.log(
    `Running ${suites.length} suite(s)${
      suiteFilter ? ` matching "${suiteFilter}"` : ""
    } against ${config.baseUrl}`
  );

  const results = await runSuites(suites);

  generateConsoleReport(results);
  const { html, json } = await writeReportFiles(results);
  console.log(`Report: ${html}`);
  console.log(`JSON:   ${json}`);

  const mail = await sendEmailReport(results);
  if (mail.sent) {
    console.log(`Email report sent to ${config.notifyEmail}`);
  } else if (mail.reason && mail.reason !== "no failures") {
    console.log(`Email skipped (${mail.reason})`);
  }

  const failed = results.filter((r) => r.status === "fail").length;
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
