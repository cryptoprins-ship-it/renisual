# Security Policy

## Reporting a vulnerability

Email: **security@renisual.com**

Do **not** open public GitHub issues for security bugs — this gives
attackers a chance to exploit the issue before a fix ships.

If the issue is sensitive (account takeover, RCE, lead-data exposure),
please use PGP if you have it. Otherwise plain email is fine — the inbox
is monitored daily.

## Supported versions

Only the deployed production version (https://renisual.com) is supported.
There are no LTS branches.

## Response time

- Acknowledgment within **72 hours**.
- Severity assessment within **5 business days**.
- Fix timeline depends on severity:
  - **Critical** (RCE, lead-data exfil, payment data): hot-patch within 24 h.
  - **High** (auth bypass, full Gemini quota drain, privilege escalation):
    patch within 7 days.
  - **Medium / Low**: rolled into the next regular release.

## Scope

In scope:
- The deployed app at renisual.com (and www. variant)
- API routes under `/api/*`, especially `/api/render`, `/api/offerte`
- Lead and waitlist data integrity / confidentiality
- Anything that handles uploaded photos or third-party API keys

Out of scope:
- Third-party services (Gemini, OpenAI, Supabase, ipapi.co) — report
  directly to those vendors.
- Social-engineering attacks against staff.
- Volumetric DoS — we use rate-limiting at the application layer; report
  it if you can show it bypasses our limits.

## Secrets and key rotation

Documented rotation cadence for high-risk keys:

| Service          | Variable                          | Cadence  |
|------------------|-----------------------------------|----------|
| Gemini           | `GEMINI_API_KEY`                  | 90 days  |
| OpenAI           | `OPENAI_API_KEY`                  | 90 days  |
| Supabase service | `SUPABASE_SERVICE_ROLE_KEY`       | 90 days  |
| SMTP             | `SMTP_PASS`                       | 180 days |
| Upstash Redis    | `UPSTASH_REDIS_REST_TOKEN`        | 180 days |

If a key is suspected leaked: rotate in the provider dashboard, redeploy
with the new value, then revoke the old key.

## What we ask

- Don't access data that isn't yours.
- Don't disrupt other users (no DoS, no spam, no scraping at scale).
- Give us reasonable time to fix before public disclosure (90 days is
  typical).

Thank you for keeping Renisual's customers safe.
