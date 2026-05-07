// POST /api/offertes/send
//
// Email an existing offerte (created via POST /api/offertes) to the
// internal offerte@renisual.com inbox so the team can pick it up and
// follow up with the customer. Body is just the offerte ref; the
// route looks the row up, fetches the PDF + render attachments from
// Supabase Storage, and sends via Hostinger SMTP.
//
// Failure here MUST NOT void the saved row — the customer can still
// share the public /offerte/{ref} URL even if the internal mail step
// failed.

import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { z } from "zod";

import { createAdminClient } from "@/utils/supabase/admin";
import { verifyOrigin } from "@/lib/verifyOrigin";
import { logger } from "@/lib/logger";

const PDF_BUCKET = "offerte-pdfs";
const RENDER_BUCKET = "offerte-renders";
const PHOTO_BUCKET = "project-photos";
const TO_ADDRESS = "offerte@renisual.com";

export const runtime = "nodejs";
export const maxDuration = 30;

const bodySchema = z.object({
  ref: z.string().min(1).max(64),
});

function readEnvCaseInsensitive(name: string): string | undefined {
  const target = name.toLowerCase();
  for (const k of Object.keys(process.env)) {
    if (k.toLowerCase() === target) {
      const v = process.env[k];
      if (typeof v === "string" && v.trim().length > 0) return v;
    }
  }
  return undefined;
}

function smtpConfig() {
  const host = readEnvCaseInsensitive("Hostinger_SMTP_Host") ?? "smtp.hostinger.com";
  const portRaw = readEnvCaseInsensitive("Hostinger_SMTP_Port") ?? "465";
  const user = readEnvCaseInsensitive("Hostinger_SMTP_User");
  const pass = readEnvCaseInsensitive("Hostinger_SMTP_Password");
  const port = Number(portRaw) || 465;
  return { host, port, secure: port === 465, user, pass };
}

async function downloadFromBucket(
  admin: ReturnType<typeof createAdminClient>,
  bucket: string,
  path: string,
): Promise<Buffer | null> {
  const { data, error } = await admin.storage.from(bucket).download(path);
  if (error || !data) {
    logger.warn({ err: error, bucket, path }, "offerte_send_attachment_fetch_failed");
    return null;
  }
  return Buffer.from(await data.arrayBuffer());
}

export async function POST(request: Request) {
  const forbidden = verifyOrigin(request);
  if (forbidden) return forbidden;

  let parsed: z.infer<typeof bodySchema>;
  try {
    const json = await request.json();
    parsed = bodySchema.parse(json);
  } catch (err) {
    return NextResponse.json({ error: "invalid_body", details: String(err) }, { status: 400 });
  }

  const cfg = smtpConfig();
  if (!cfg.user || !cfg.pass) {
    logger.error("offerte_send_smtp_not_configured");
    return NextResponse.json({ error: "smtp_not_configured" }, { status: 500 });
  }

  const admin = createAdminClient();
  const { data: row, error: rowErr } = await admin
    .from("offertes")
    .select("ref, customer_name, customer_email, customer_company, project_address, calc_input, panel_count, photo_path, render_path, pdf_path")
    .eq("ref", parsed.ref)
    .single();
  if (rowErr || !row) {
    logger.warn({ err: rowErr, ref: parsed.ref }, "offerte_send_row_lookup_failed");
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Pull all attachments in parallel; any that fail are logged but
  // don't block the email — the recipient still gets the body and
  // whatever attachments did resolve.
  const [pdfBuf, renderBuf, photoBuf] = await Promise.all([
    row.pdf_path ? downloadFromBucket(admin, PDF_BUCKET, row.pdf_path) : Promise.resolve(null),
    row.render_path ? downloadFromBucket(admin, RENDER_BUCKET, row.render_path) : Promise.resolve(null),
    row.photo_path ? downloadFromBucket(admin, PHOTO_BUCKET, row.photo_path) : Promise.resolve(null),
  ]);

  const calcInput = (row.calc_input ?? {}) as Record<string, unknown>;
  const projectName = typeof calcInput.projectName === "string" ? calcInput.projectName : "";
  const orientation = typeof calcInput.orientation === "string" ? calcInput.orientation : "";
  const productLabel =
    typeof calcInput.selectedProductId === "string" ? calcInput.selectedProductId : "";

  const subject = `Offerte-aanvraag — ${projectName || row.ref}${row.customer_name ? ` — ${row.customer_name}` : ""}`;
  const offerteUrl = `https://renisual.com/offerte/${row.ref}`;
  const bodyLines = [
    `Nieuwe offerte-aanvraag binnengekomen via renisual.com.`,
    ``,
    `Projectnummer: ${projectName || row.ref}`,
    `Klant: ${row.customer_name ?? "(niet ingevuld)"}`,
    `E-mail: ${row.customer_email ?? "(niet ingevuld)"}`,
    `Adres: ${row.project_address ?? "(niet ingevuld)"}`,
    ``,
    `Product: ${productLabel || "(niet ingevuld)"}`,
    `Oriëntatie: ${orientation || "(niet ingevuld)"}`,
    `Aantal panelen: ${row.panel_count ?? "?"}`,
    ``,
    `Online versie: ${offerteUrl}`,
  ];

  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });

  const attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];
  if (pdfBuf) attachments.push({ filename: `${row.ref}.pdf`, content: pdfBuf, contentType: "application/pdf" });
  if (renderBuf) attachments.push({ filename: `${row.ref}-render.jpg`, content: renderBuf, contentType: "image/jpeg" });
  if (photoBuf) attachments.push({ filename: `${row.ref}-foto.jpg`, content: photoBuf, contentType: "image/jpeg" });

  try {
    await transporter.sendMail({
      from: `Renisual <${cfg.user}>`,
      to: TO_ADDRESS,
      replyTo: row.customer_email ?? undefined,
      subject,
      text: bodyLines.join("\n"),
      attachments,
    });
  } catch (err) {
    logger.error({ err, ref: parsed.ref }, "offerte_send_smtp_failed");
    return NextResponse.json({ error: "send_failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
