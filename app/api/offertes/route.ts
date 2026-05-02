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
import { generateRef } from "@/lib/offerte/ref";
import { verifyOrigin } from "@/lib/verifyOrigin";
import { logger } from "@/lib/logger";

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

  // pdfUrl is filled in by a later phase that generates the PDF and
  // uploads it to the offerte-pdfs bucket. Keeping the field in the
  // response now means callers don't need a follow-up release.
  return NextResponse.json({
    ref: inserted.ref,
    offerteUrl,
    pdfUrl: null,
  });
}
