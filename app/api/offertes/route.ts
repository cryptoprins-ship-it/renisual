// POST /api/offertes
//
// Accepts a finished /gevelcalc snapshot, persists it to the offertes
// table, and returns the (unguessable) ref number plus the public URL
// the client can hand off to a supplier. PDF generation + signed PDF
// URL are wired in a later phase; this phase establishes the row and
// the ref so the rest of the flow can reference it.

import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { generateRef } from "@/lib/offerte/ref";
import { buildOffertePdf } from "@/lib/offerte/pdf";
import { verifyOrigin } from "@/lib/verifyOrigin";
import { logger } from "@/lib/logger";

const PDF_BUCKET = "offerte-pdfs";
// Photos already live in the project-photos bucket (uploaded by
// /gevelcalc via lib/photoStorage.ts) so we sign URLs against that
// bucket directly rather than maintain a duplicate offerte-photos
// copy. Deviates from the original Phase 1 spec which proposed a
// dedicated offerte-photos bucket — revisit if/when we want
// per-offerte privacy isolation.
const PHOTO_BUCKET = "project-photos";
const RENDER_BUCKET = "offerte-renders";
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

export const runtime = "nodejs";
export const maxDuration = 30;

const customerSchema = z
  .object({
    name: z.string().max(200).optional(),
    email: z.string().email().max(200).optional(),
    company: z.string().max(200).optional(),
    projectAddress: z.string().max(500).optional(),
  })
  .partial();

const calcOutputSchema = z.object({
  panelCount: z.number().int().nonnegative().max(100000),
  profileEndCount: z.number().int().nonnegative().max(100000),
  profileMiddleCount: z.number().int().nonnegative().max(100000),
  profileCornerCount: z.number().int().nonnegative().max(100000),
  subtotalExclBtw: z.number().nonnegative().max(10_000_000),
  totalInclBtw: z.number().nonnegative().max(10_000_000),
});

const bodySchema = z.object({
  // Free-form snapshot of the calc inputs. Schema may evolve so we
  // validate only that it's a JSON-serialisable object below 64 KB.
  calcInput: z.record(z.string(), z.unknown()),
  calcOutput: calcOutputSchema,
  customer: customerSchema.optional(),
  photoPath: z.string().max(500).optional(),
  renderPath: z.string().max(500).optional(),
});

const MAX_REF_RETRIES = 5;

export async function POST(request: Request) {
  const forbidden = verifyOrigin(request);
  if (forbidden) return forbidden;

  let parsed: z.infer<typeof bodySchema>;
  try {
    const json = await request.json();
    parsed = bodySchema.parse(json);
  } catch (err) {
    return NextResponse.json(
      { error: "invalid_body", details: err instanceof z.ZodError ? err.flatten() : String(err) },
      { status: 400 }
    );
  }

  // 64 KB is generous for a calc snapshot and keeps a misuse vector
  // (someone stuffing render bytes into calcInput) bounded.
  if (JSON.stringify(parsed.calcInput).length > 64 * 1024) {
    return NextResponse.json({ error: "calc_input_too_large" }, { status: 413 });
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id ?? null;

  // Insert with collision retry. UNIQUE on `ref` will reject on the
  // ~1-in-28M chance of a second-generation collision; we regenerate
  // and try again, capped to keep the request bounded.
  let inserted: { id: string; ref: string } | null = null;
  let lastError: unknown = null;
  for (let attempt = 0; attempt < MAX_REF_RETRIES; attempt++) {
    const candidate = generateRef();
    const { data, error } = await supabase
      .from("offertes")
      .insert({
        ref: candidate,
        customer_name: parsed.customer?.name ?? null,
        customer_email: parsed.customer?.email ?? null,
        customer_company: parsed.customer?.company ?? null,
        project_address: parsed.customer?.projectAddress ?? null,
        calc_input: parsed.calcInput,
        panel_count: parsed.calcOutput.panelCount,
        profile_end_count: parsed.calcOutput.profileEndCount,
        profile_middle_count: parsed.calcOutput.profileMiddleCount,
        profile_corner_count: parsed.calcOutput.profileCornerCount,
        subtotal_excl_btw: parsed.calcOutput.subtotalExclBtw,
        total_incl_btw: parsed.calcOutput.totalInclBtw,
        photo_path: parsed.photoPath ?? null,
        render_path: parsed.renderPath ?? null,
        user_id: userId,
      })
      .select("id, ref")
      .single();

    if (data) {
      inserted = data;
      break;
    }
    lastError = error;

    // Postgres 23505 = unique_violation. Anything else is a real failure.
    if (!error || error.code !== "23505") break;
  }

  if (!inserted) {
    logger.error({ err: lastError }, "offerte_insert_failed");
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  const offerteUrl = `https://renisual.com/offerte/${inserted.ref}`;

  // PDF generation + upload is best-effort: a failure here should not
  // void the persisted row (the user can still share the offerte URL,
  // and a retry endpoint can regenerate the PDF later).
  let pdfUrl: string | null = null;
  try {
    const admin = createAdminClient();
    const [photoSrc, renderSrc] = await Promise.all([
      parsed.photoPath ? signedUrl(admin, PHOTO_BUCKET, parsed.photoPath) : Promise.resolve(undefined),
      parsed.renderPath ? signedUrl(admin, RENDER_BUCKET, parsed.renderPath) : Promise.resolve(undefined),
    ]);

    const pdfBuffer = await buildOffertePdf({
      ref: inserted.ref,
      generatedAt: new Date(),
      customer: parsed.customer,
      panelCount: parsed.calcOutput.panelCount,
      pricePerPanel: derivePricePerPanel(parsed),
      profileEndCount: parsed.calcOutput.profileEndCount,
      profileMiddleCount: parsed.calcOutput.profileMiddleCount,
      profileCornerCount: parsed.calcOutput.profileCornerCount,
      pricePerEndProfile: numberFromCalcInput(parsed.calcInput, "pricePerEndProfile"),
      pricePerMiddleProfile: numberFromCalcInput(parsed.calcInput, "pricePerMiddleProfile"),
      pricePerCornerProfile: numberFromCalcInput(parsed.calcInput, "pricePerCornerProfile"),
      fastenerEstimateExBtw: numberFromCalcInput(parsed.calcInput, "fastenerEstimateExBtw"),
      subtotalExBtw: parsed.calcOutput.subtotalExclBtw,
      totalInclBtw: parsed.calcOutput.totalInclBtw,
      photoSrc,
      renderSrc,
    });

    const pdfPath = `${inserted.ref}.pdf`;
    const { error: uploadErr } = await admin.storage.from(PDF_BUCKET).upload(pdfPath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (uploadErr) throw uploadErr;

    const { error: updateErr } = await admin
      .from("offertes")
      .update({ pdf_path: pdfPath })
      .eq("id", inserted.id);
    if (updateErr) throw updateErr;

    pdfUrl = (await signedUrl(admin, PDF_BUCKET, pdfPath)) ?? null;
  } catch (err) {
    logger.error({ err, ref: inserted.ref }, "offerte_pdf_generation_failed");
    // pdfUrl stays null; client falls back to the public offerte page.
  }

  return NextResponse.json({
    ref: inserted.ref,
    offerteUrl,
    pdfUrl,
  });
}

async function signedUrl(
  admin: ReturnType<typeof createAdminClient>,
  bucket: string,
  path: string
): Promise<string | undefined> {
  const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data) {
    logger.warn({ err: error, bucket, path }, "offerte_signed_url_failed");
    return undefined;
  }
  return data.signedUrl;
}

// Pricing knobs travel through calcInput so the PDF stays consistent
// with whatever the calc engine quoted. Falls back to 0 when missing
// rather than guessing — the line will still render without a price.
function numberFromCalcInput(input: Record<string, unknown>, key: string): number {
  const v = input[key];
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function derivePricePerPanel(body: z.infer<typeof bodySchema>): number {
  const direct = numberFromCalcInput(body.calcInput, "pricePerPanel");
  if (direct > 0) return direct;
  // Reverse-engineer from totals when calcInput didn't carry it: assume
  // panels dominate the subtotal and divide. Better than 0,00 in the PDF.
  if (body.calcOutput.panelCount > 0 && body.calcOutput.subtotalExclBtw > 0) {
    return Math.round((body.calcOutput.subtotalExclBtw / body.calcOutput.panelCount) * 100) / 100;
  }
  return 0;
}
