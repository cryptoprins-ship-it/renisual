import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyOrigin } from "@/lib/verifyOrigin";
import { buildCalcPdf, type CalcPdfSide } from "@/lib/calc/pdf";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 30;

const openingSchema = z.object({
  type: z.enum(["window", "door", "other"]),
  label: z.string().max(80).optional().default(""),
  widthCm: z.number().nonnegative(),
  heightCm: z.number().nonnegative(),
  count: z.number().int().nonnegative(),
});

const sideSchema = z.object({
  name: z.string().max(80),
  widthCm: z.number().nonnegative(),
  heightCm: z.number().nonnegative(),
  grossM2: z.number().nonnegative(),
  netM2: z.number().nonnegative(),
  openings: z.array(openingSchema),
});

const profileSchema = z.object({
  label: z.string(),
  name: z.string(),
  neededMeters: z.number(),
  lengthMeters: z.number(),
  count: z.number().int().nonnegative(),
  priceEachExVat: z.number().nonnegative(),
  totalExVat: z.number().nonnegative(),
});

const bodySchema = z.object({
  projectName: z.string().max(120).optional(),
  productLabel: z.string().max(160).optional(),
  orientationLabel: z.string().max(40),
  totals: z.object({
    gross: z.number().nonnegative(),
    openings: z.number().nonnegative(),
    net: z.number().nonnegative(),
  }),
  netWithWaste: z.number().nonnegative(),
  wasteFactor: z.number().nonnegative(),
  panelCount: z.number().int().nonnegative(),
  insideCornerCount: z.number().int().nonnegative().optional(),
  profileItems: z.array(profileSchema),
  sides: z.array(sideSchema).max(40),
});

export async function POST(req: NextRequest) {
  const forbidden = verifyOrigin(req);
  if (forbidden) return forbidden;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const pdf = await buildCalcPdf({
      generatedAt: new Date(),
      projectName: parsed.data.projectName,
      productLabel: parsed.data.productLabel,
      orientationLabel: parsed.data.orientationLabel,
      totals: parsed.data.totals,
      netWithWaste: parsed.data.netWithWaste,
      wasteFactor: parsed.data.wasteFactor,
      panelCount: parsed.data.panelCount,
      insideCornerCount: parsed.data.insideCornerCount,
      profileItems: parsed.data.profileItems,
      sides: parsed.data.sides as CalcPdfSide[],
    });
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="renisual-config.pdf"`,
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    logger.error({ err }, "calc_pdf_render_failed");
    return NextResponse.json({ error: "render_failed" }, { status: 500 });
  }
}
