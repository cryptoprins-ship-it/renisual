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
import { buildOffertePdf, type OfferteSideInfo } from "@/lib/offerte/pdf";
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
  // Beginprofiel (QBJ aluminium starter) — bottom rail, was missing
  // from the schema even though the calc engine produced it. Optional
  // for backward compat with payloads from older clients.
  profileStartCount: z.number().int().nonnegative().max(100000).optional(),
  profileEndCount: z.number().int().nonnegative().max(100000),
  profileMiddleCount: z.number().int().nonnegative().max(100000),
  profileCornerCount: z.number().int().nonnegative().max(100000),
  // YJDZ binnenhoek — only set when the user entered a non-zero
  // inside-corner count on /gevelcalc. Optional + defaults to 0
  // server-side so older payloads don't fail validation.
  profileInsideCornerCount: z.number().int().nonnegative().max(100000).optional(),
  subtotalExclBtw: z.number().nonnegative().max(10_000_000),
  totalInclBtw: z.number().nonnegative().max(10_000_000),
});

const orientationEnum = z.enum(["horizontal", "vertical"]);

const bodySchema = z.object({
  // Free-form snapshot of the calc inputs. Schema may evolve so we
  // validate only that it's a JSON-serialisable object below 64 KB.
  calcInput: z.record(z.string(), z.unknown()),
  calcOutput: calcOutputSchema,
  // Optional second BOM (the "Al gedacht aan de verticale/horizontale
  // optie?" toggle on /gevelcalc). When present, the PDF renders both
  // sections side-by-side. Both fields must be supplied together.
  alternateCalcOutput: calcOutputSchema.optional(),
  alternateOrientation: orientationEnum.optional(),
  customer: customerSchema.optional(),
  photoPath: z.string().max(500).optional(),
  renderPath: z.string().max(500).optional(),
  // Opt-in price indication on the PDF. Default OFF — the PDF renders
  // a BOM-only document. When true, prices are shown INCL BTW with an
  // "indicatie" disclaimer.
  includePrices: z.boolean().default(false),
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
        // Pass-through the alt-orientation snapshot via calc_input so a
        // future PDF re-generation or admin tool can recover both BOMs
        // without a schema migration. Falsy fields stay absent.
        calc_input: {
          ...parsed.calcInput,
          ...(parsed.alternateOrientation ? { alternateOrientation: parsed.alternateOrientation } : {}),
          ...(parsed.alternateCalcOutput ? { alternateCalcOutput: parsed.alternateCalcOutput } : {}),
        },
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
    // Surface the actual Postgres / Supabase error so the client (and
    // browser console) shows what tripped — covers RLS denials, column
    // mismatches, NOT-NULL violations, etc. instead of a generic message.
    const detail =
      lastError && typeof lastError === "object"
        ? {
            message: (lastError as { message?: string }).message,
            code: (lastError as { code?: string }).code,
            hint: (lastError as { hint?: string }).hint,
            details: (lastError as { details?: string }).details,
          }
        : String(lastError);
    return NextResponse.json({ error: "insert_failed", detail }, { status: 500 });
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

    const calcMode = stringFromCalcInput(parsed.calcInput, "mode");
    const calcProject = stringFromCalcInput(parsed.calcInput, "projectName");
    const productLabel = stringFromCalcInput(parsed.calcInput, "productLabel") || undefined;
    const modeLine = calcMode === "quick"
      ? "Schatting o.b.v. vierkante gevel — standaard kozijnen aangenomen."
      : calcMode === "advanced"
        ? "Berekening per zijde — exacte invoer."
        : undefined;

    const calcOrientationRaw = stringFromCalcInput(parsed.calcInput, "orientation");
    const primaryOrientation: "horizontal" | "vertical" | undefined =
      calcOrientationRaw === "horizontal" || calcOrientationRaw === "vertical"
        ? calcOrientationRaw
        : undefined;

    // Both alt fields must be present together — schema allows them
    // independently for forward-compat but we only render when both
    // arrived (orientation + counts).
    const alternate =
      parsed.alternateCalcOutput && parsed.alternateOrientation
        ? {
            orientation: parsed.alternateOrientation,
            panelCount: parsed.alternateCalcOutput.panelCount,
            profileStartCount: parsed.alternateCalcOutput.profileStartCount,
            profileEndCount: parsed.alternateCalcOutput.profileEndCount,
            profileMiddleCount: parsed.alternateCalcOutput.profileMiddleCount,
            profileCornerCount: parsed.alternateCalcOutput.profileCornerCount,
            profileInsideCornerCount: parsed.alternateCalcOutput.profileInsideCornerCount,
            subtotalExBtw: parsed.alternateCalcOutput.subtotalExclBtw,
            totalInclBtw: parsed.alternateCalcOutput.totalInclBtw,
          }
        : undefined;

    const pdfBuffer = await buildOffertePdf({
      ref: inserted.ref,
      generatedAt: new Date(),
      customer: parsed.customer,
      includePrices: parsed.includePrices,
      panelCount: parsed.calcOutput.panelCount,
      pricePerPanel: derivePricePerPanel(parsed),
      profileStartCount: parsed.calcOutput.profileStartCount,
      profileEndCount: parsed.calcOutput.profileEndCount,
      profileMiddleCount: parsed.calcOutput.profileMiddleCount,
      profileCornerCount: parsed.calcOutput.profileCornerCount,
      profileInsideCornerCount: parsed.calcOutput.profileInsideCornerCount,
      pricePerStartProfile: numberFromCalcInput(parsed.calcInput, "pricePerStartProfile"),
      pricePerEndProfile: numberFromCalcInput(parsed.calcInput, "pricePerEndProfile"),
      pricePerMiddleProfile: numberFromCalcInput(parsed.calcInput, "pricePerMiddleProfile"),
      pricePerCornerProfile: numberFromCalcInput(parsed.calcInput, "pricePerCornerProfile"),
      pricePerInsideCornerProfile: numberFromCalcInput(parsed.calcInput, "pricePerInsideCornerProfile"),
      lengthPanelM: numberFromCalcInput(parsed.calcInput, "lengthPanelM"),
      lengthStartProfileM: numberFromCalcInput(parsed.calcInput, "lengthStartProfileM"),
      lengthEndProfileM: numberFromCalcInput(parsed.calcInput, "lengthEndProfileM"),
      lengthMiddleProfileM: numberFromCalcInput(parsed.calcInput, "lengthMiddleProfileM"),
      lengthCornerProfileM: numberFromCalcInput(parsed.calcInput, "lengthCornerProfileM"),
      lengthInsideCornerProfileM: numberFromCalcInput(parsed.calcInput, "lengthInsideCornerProfileM"),
      fastenerEstimateExBtw: numberFromCalcInput(parsed.calcInput, "fastenerEstimateExBtw"),
      subtotalExBtw: parsed.calcOutput.subtotalExclBtw,
      totalInclBtw: parsed.calcOutput.totalInclBtw,
      photoSrc,
      renderSrc,
      modeLine,
      primaryOrientation,
      alternate,
      productLabel,
      sides: sidesFromCalcInput(parsed.calcInput),
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

    // Friendly download filename: gevelcalc-{project}-{modus}-{yyyy-mm-dd}.pdf
    // Falls back to the ref when project is empty so the file isn't named
    // gevelcalc--snel-...
    const today = new Date().toISOString().slice(0, 10);
    const slugProject = slugify(calcProject) || inserted.ref.toLowerCase();
    const slugMode = calcMode === "quick" ? "snel" : calcMode === "advanced" ? "per-zijde" : "berekening";
    const downloadName = `gevelcalc-${slugProject}-${slugMode}-${today}.pdf`;
    pdfUrl = (await signedUrl(admin, PDF_BUCKET, pdfPath, downloadName)) ?? null;
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
  path: string,
  downloadName?: string
): Promise<string | undefined> {
  // Pass `download: filename` so Supabase serves the file with a
  // Content-Disposition header that uses the friendly name (gevelcalc-…)
  // instead of the random ref. Browsers honour it on direct downloads.
  const opts = downloadName ? { download: downloadName } : undefined;
  const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, SIGNED_URL_TTL_SECONDS, opts);
  if (error || !data) {
    logger.warn({ err: error, bucket, path }, "offerte_signed_url_failed");
    return undefined;
  }
  return data.signedUrl;
}

function stringFromCalcInput(input: Record<string, unknown>, key: string): string {
  const v = input[key];
  return typeof v === "string" ? v : "";
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// Pricing knobs travel through calcInput so the PDF stays consistent
// with whatever the calc engine quoted. Falls back to 0 when missing
// rather than guessing — the line will still render without a price.
function numberFromCalcInput(input: Record<string, unknown>, key: string): number {
  const v = input[key];
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

// Sides in calcInput zijn vrije CalcSide-snapshots: width/height/count
// staan als strings ("4,2" of "4.2" of leeg). Parse comma-decimaal naar
// number, drop ongeldige entries zodat de PDF nooit "NaN × NaN cm" toont.
function toCm(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v !== "string") return 0;
  const n = parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function sidesFromCalcInput(input: Record<string, unknown>): OfferteSideInfo[] {
  const raw = input.sides;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s): OfferteSideInfo | null => {
      if (!s || typeof s !== "object") return null;
      const side = s as Record<string, unknown>;
      const widthCm = toCm(side.width);
      const heightCm = toCm(side.height);
      // Skip lege placeholder-zijdes (user heeft alleen een naam getypt
      // maar geen afmetingen ingevuld) zodat de PDF geen 0 × 0-blok krijgt.
      if (widthCm === 0 && heightCm === 0) return null;
      const openingsRaw = Array.isArray(side.openings) ? side.openings : [];
      const openings: OfferteSideInfo["openings"] = openingsRaw
        .map((o) => {
          if (!o || typeof o !== "object") return null;
          const op = o as Record<string, unknown>;
          const type =
            op.type === "window" || op.type === "door" || op.type === "other"
              ? op.type
              : "other";
          return {
            type: type as "window" | "door" | "other",
            label: typeof op.label === "string" ? op.label : "",
            widthCm: toCm(op.width),
            heightCm: toCm(op.height),
            count: toCm(op.count),
          };
        })
        .filter((o): o is OfferteSideInfo["openings"][number] => o !== null);
      return {
        name: typeof side.name === "string" ? side.name : "",
        widthCm,
        heightCm,
        openings,
      };
    })
    .filter((s): s is OfferteSideInfo => s !== null);
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
