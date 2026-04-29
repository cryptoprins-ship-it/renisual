# Renisual smoke-test agent

Lightweight Playwright-driven smoke tests that hit a running Renisual instance
(local dev server or production) and verify the critical user-facing flows.

## Run

```bash
# all suites against http://localhost:3000
npm test

# all suites against a specific URL (positional or env)
npx tsx scripts/test-agent https://renisual.com
TEST_URL=https://renisual.com npx tsx scripts/test-agent

# only one suite (matches case-insensitively on suite name)
npm test -- --suite render
npx tsx scripts/test-agent --suite=homepage
```

`npm run test:local` is a shortcut for `tsx scripts/test-agent http://localhost:3000`.

## Output

Every run writes to `public/test-results/`:

- `report.html` — grouped per-suite table with screenshots inline
- `report.json` — machine-readable copy of the same data
- `screenshots/<suite>__<test>.png` — only created on the **last** failing attempt

The agent exits with code `0` when everything passes, `1` when at least one
test failed, and `2` on a runner error.

## Email on failure

On failure (and only on failure), the runner sends an HTML report to
`config.notifyEmail` using the same SMTP env vars as `/api/offerte`:

- `SMTP_HOST`, `SMTP_PORT` (defaults to 465), `SMTP_USER`, `SMTP_PASS`

If any of those are missing the runner just logs `Email skipped (SMTP env vars missing)`.

## Adding a suite

1. Drop a new file in `suites/<page>.ts` exporting a `TestSuite`. Each test
   gets a fresh Playwright `Page`; throw to fail.
2. Register it in `suites/index.ts` (just push it onto `allSuites`).
3. The runner picks it up automatically. Use `--suite <name>` to run yours
   in isolation while iterating.

Use `skip: true` on a test or suite to leave it in the file but exclude it
from a run.

## Files

```
scripts/test-agent/
  index.ts        # CLI entry point
  config.ts       # baseUrl / paths / timeout / retries
  runner.ts       # browser lifecycle, per-test retries, screenshots on fail
  reporter.ts     # console + HTML + JSON + email reporting
  types.ts        # TestCase / TestSuite / TestResult
  suites/
    index.ts      # registry + filter helper
    homepage.ts
    gevelcalc.ts
    render.ts
    renderApi.ts
    subsidie.ts
    wachten.ts
    leaderboard.ts
    offerte.ts
    waitlist.ts
```

## Cost & safety notes

- The Render API and Offerte API suites only exercise validation paths. They
  never send real lead emails or burn Gemini quota.
- Screenshots are written to `public/test-results/screenshots/` so the HTML
  report can embed them — that directory is `.gitignore`'d.
