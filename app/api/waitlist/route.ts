import nodemailer from "nodemailer";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { formLimit, clientKeyFromRequest, rateLimitResponse } from "@/lib/ratelimit";
import { verifyOrigin } from "@/lib/verifyOrigin";
import { logger } from "@/lib/logger";

const HONEYPOT_FIELD = "website";

const waitlistSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  topic: z.string().trim().max(200).optional().or(z.literal("")),
  [HONEYPOT_FIELD]: z.string().max(0).optional().or(z.literal("")),
});

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
    logger.warn({ ip, route: "waitlist" }, "form_rate_limited");
    return rateLimitResponse(reset);
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = waitlistSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const body = parsed.data;

  const honeyValue = (body as Record<string, unknown>)[HONEYPOT_FIELD];
  if (typeof honeyValue === "string" && honeyValue.length > 0) {
    logger.info({ ip }, "waitlist_honeypot_drop");
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
      email: escapeHtml(body.email),
      topic: escapeHtml(body.topic || ""),
    };

    await transporter.sendMail({
      from: `"Renisual Waitlist" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER,
      subject: `Nieuwe waitlist aanmelding: ${body.email}`,
      html: `
        <h2>Nieuwe waitlist aanmelding</h2>
        <table cellpadding="8" style="border-collapse:collapse">
          <tr><td><strong>E-mail</strong></td><td><a href="mailto:${safe.email}">${safe.email}</a></td></tr>
          <tr><td><strong>Onderwerp</strong></td><td>${safe.topic || "—"}</td></tr>
          <tr><td><strong>Tijdstip</strong></td><td>${timestamp}</td></tr>
        </table>
        <p style="margin-top:16px;font-size:12px;color:#666">
          Aanmelding via renisual.com
        </p>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "waitlist_mail_failed");
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
