import nodemailer from "nodemailer";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { formLimit, clientKeyFromRequest, rateLimitResponse } from "@/lib/ratelimit";
import { verifyOrigin } from "@/lib/verifyOrigin";
import { logger } from "@/lib/logger";

// Honeypot field — hidden in the UI, so a real visitor never fills it.
// Bots that scrape and fill all visible inputs will land in this trap;
// we silently 200 them without sending anything so they don't learn the
// form has anti-spam.
const HONEYPOT_FIELD = "website";

// Lead body. Postcode is loosely validated as 4 digits + optional 2 letters
// (NL format) — keep room for foreign leads via the unicode allow-list.
const leadSchema = z.object({
  naam: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(255),
  telefoon: z
    .string()
    .trim()
    .max(30)
    .regex(/^[0-9+\-\s()./]*$/, "telefoon_invalid_chars")
    .optional()
    .or(z.literal("")),
  postcode: z.string().trim().min(3).max(20),
  type: z.string().trim().max(100).optional().or(z.literal("")),
  opmerking: z.string().trim().max(2000).optional().or(z.literal("")),
  // Honeypot — must be empty/absent. Anything else means we silently drop.
  [HONEYPOT_FIELD]: z.string().max(0).optional().or(z.literal("")),
});

// Escape characters that would otherwise terminate the surrounding HTML
// context in our nodemailer template. Without this, a name containing
// "<script>" would be rendered as live HTML inside the inbox preview.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function POST(req: NextRequest) {
  const forbidden = verifyOrigin(req);
  if (forbidden) return forbidden;

  const ip = clientKeyFromRequest(req);
  const { success, reset } = await formLimit.limit(ip);
  if (!success) {
    logger.warn({ ip, route: "offerte" }, "form_rate_limited");
    return rateLimitResponse(reset);
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = leadSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const body = parsed.data;

  // Honeypot trip — pretend success so bots don't learn they were caught.
  const honeyValue = (body as Record<string, unknown>)[HONEYPOT_FIELD];
  if (typeof honeyValue === "string" && honeyValue.length > 0) {
    logger.info({ ip }, "offerte_honeypot_drop");
    return NextResponse.json({ ok: true });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 465),
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const timestamp = new Date().toLocaleString("nl-NL", {
      timeZone: "Europe/Amsterdam",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const safe = {
      naam: escapeHtml(body.naam),
      email: escapeHtml(body.email),
      telefoon: escapeHtml(body.telefoon || ""),
      postcode: escapeHtml(body.postcode),
      type: escapeHtml(body.type || ""),
      opmerking: escapeHtml(body.opmerking || ""),
    };

    // E-mail naar jou
    await transporter.sendMail({
      from: `"Renisual Leads" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER,
      subject: `Nieuwe lead: ${body.naam} — ${body.postcode}`,
      html: `
        <h2>Nieuwe offerte aanvraag</h2>
        <table cellpadding="8" style="border-collapse:collapse;width:100%;max-width:500px">
          <tr><td><strong>Naam</strong></td><td>${safe.naam}</td></tr>
          <tr><td><strong>E-mail</strong></td><td><a href="mailto:${safe.email}">${safe.email}</a></td></tr>
          <tr><td><strong>Telefoon</strong></td><td>${safe.telefoon || "—"}</td></tr>
          <tr><td><strong>Postcode</strong></td><td>${safe.postcode}</td></tr>
          <tr><td><strong>Type gevel</strong></td><td>${safe.type || "—"}</td></tr>
          <tr><td><strong>Opmerking</strong></td><td>${safe.opmerking || "—"}</td></tr>
          <tr><td><strong>Tijdstip</strong></td><td>${timestamp}</td></tr>
        </table>
        <p style="margin-top:16px;font-size:12px;color:#666">
          Lead via renisual.com
        </p>
      `,
    });

    // Bevestiging naar klant
    await transporter.sendMail({
      from: `"Renisual" <${process.env.SMTP_USER}>`,
      to: body.email,
      subject: "Uw offerte aanvraag is ontvangen — Renisual",
      html: `
        <h2>Bedankt voor uw aanvraag, ${safe.naam}!</h2>
        <p>We hebben uw offerte aanvraag ontvangen en nemen zo snel mogelijk contact met u op.</p>
        <h3>Uw gegevens:</h3>
        <table cellpadding="8" style="border-collapse:collapse">
          <tr><td><strong>Naam</strong></td><td>${safe.naam}</td></tr>
          <tr><td><strong>Postcode</strong></td><td>${safe.postcode}</td></tr>
          <tr><td><strong>Type gevel</strong></td><td>${safe.type || "—"}</td></tr>
        </table>
        <p style="margin-top:24px">
          Met vriendelijke groet,<br/>
          <strong>Renisual</strong><br/>
          <a href="https://renisual.com">renisual.com</a>
        </p>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "offerte_mail_failed");
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
