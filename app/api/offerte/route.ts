import nodemailer from "nodemailer";
import { NextRequest, NextResponse } from "next/server";

type LeadBody = {
  naam: string;
  email: string;
  telefoon?: string;
  postcode: string;
  type?: string;
  opmerking?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as LeadBody;

    if (!body.naam || !body.email || !body.postcode) {
      return NextResponse.json({ error: "Naam, email en postcode zijn verplicht." }, { status: 400 });
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

    // E-mail naar jou
    await transporter.sendMail({
      from: `"Renisual Leads" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER,
      subject: `Nieuwe lead: ${body.naam} — ${body.postcode}`,
      html: `
        <h2>Nieuwe offerte aanvraag</h2>
        <table cellpadding="8" style="border-collapse:collapse;width:100%;max-width:500px">
          <tr><td><strong>Naam</strong></td><td>${body.naam}</td></tr>
          <tr><td><strong>E-mail</strong></td><td><a href="mailto:${body.email}">${body.email}</a></td></tr>
          <tr><td><strong>Telefoon</strong></td><td>${body.telefoon || "—"}</td></tr>
          <tr><td><strong>Postcode</strong></td><td>${body.postcode}</td></tr>
          <tr><td><strong>Type gevel</strong></td><td>${body.type || "—"}</td></tr>
          <tr><td><strong>Opmerking</strong></td><td>${body.opmerking || "—"}</td></tr>
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
        <h2>Bedankt voor uw aanvraag, ${body.naam}!</h2>
        <p>We hebben uw offerte aanvraag ontvangen en nemen zo snel mogelijk contact met u op.</p>
        <h3>Uw gegevens:</h3>
        <table cellpadding="8" style="border-collapse:collapse">
          <tr><td><strong>Naam</strong></td><td>${body.naam}</td></tr>
          <tr><td><strong>Postcode</strong></td><td>${body.postcode}</td></tr>
          <tr><td><strong>Type gevel</strong></td><td>${body.type || "—"}</td></tr>
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
    console.error("Offerte mail error:", err);
    return NextResponse.json({ error: "Versturen mislukt." }, { status: 500 });
  }
}