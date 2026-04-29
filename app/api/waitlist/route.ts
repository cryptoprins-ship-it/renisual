import nodemailer from "nodemailer";
import { NextRequest, NextResponse } from "next/server";

type WaitlistBody = {
  email: string;
  topic?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as WaitlistBody;
    const email = (body.email ?? "").trim();

    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Geldig e-mailadres vereist." }, { status: 400 });
    }

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

    await transporter.sendMail({
      from: `"Renisual Waitlist" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER,
      subject: `Nieuwe waitlist aanmelding: ${email}`,
      html: `
        <h2>Nieuwe waitlist aanmelding</h2>
        <table cellpadding="8" style="border-collapse:collapse">
          <tr><td><strong>E-mail</strong></td><td><a href="mailto:${email}">${email}</a></td></tr>
          <tr><td><strong>Onderwerp</strong></td><td>${body.topic ?? "—"}</td></tr>
          <tr><td><strong>Tijdstip</strong></td><td>${timestamp}</td></tr>
        </table>
        <p style="margin-top:16px;font-size:12px;color:#666">
          Aanmelding via renisual.com
        </p>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Waitlist mail error:", err);
    return NextResponse.json({ error: "Aanmelden mislukt." }, { status: 500 });
  }
}
