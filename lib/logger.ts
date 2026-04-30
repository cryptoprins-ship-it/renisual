// Structured logger with secret redaction. Pino is small (no deps in the
// browser bundle — server-only) and gives consistent JSON output that
// downstream services (Axiom, Logtail, BetterStack) ingest natively.
//
// Use `logger.info`, `logger.warn`, `logger.error` instead of console.*
// in API routes so secrets are never accidentally serialised. The redact
// list strips common credential field names plus PII keys we collect on
// lead/waitlist forms.

import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: [
      "password",
      "token",
      "apiKey",
      "api_key",
      "authorization",
      "headers.authorization",
      "headers.cookie",
      "*.password",
      "*.token",
      "*.apiKey",
      "*.api_key",
      "*.authorization",
      "body.password",
      "body.token",
      // PII collected by /api/offerte and /api/waitlist — never log raw.
      "email",
      "*.email",
      "telefoon",
      "*.telefoon",
      "phone",
      "*.phone",
    ],
    censor: "[redacted]",
  },
  base: { service: "renisual" },
  timestamp: pino.stdTimeFunctions.isoTime,
});
