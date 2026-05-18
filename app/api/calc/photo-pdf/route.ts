import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyOrigin } from "@/lib/verifyOrigin";
import { buildCalcPhotoPdf } from "@/lib/calc/photoPdf";
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

// Side mag een base64 data-URL meekrijgen. Beperk lengte voorzichtig —
// 8 MB ruw ≈ 11 MB base64. Max 12 MB string per side, max 8 zijdes.
const PHOTO_MAX = 12 * 1024 * 1024;

const sideSchema = z.object({
  name: z.string().max(80),
  widthCm: z.number().nonnegative(),
  heightCm: z.number().nonnegative(),
  photoDataUrl: z.string().max(PHOTO_MAX).optional(),
  openings: z.array(openingSchema),
});

const bodySchema = z.object({
  projectName: z.string().max(120).optional(),
  sides: z.array(sideSchema).max(8),
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
    const pdf = await buildCalcPhotoPdf({
      generatedAt: new Date(),
      projectName: parsed.data.projectName,
      sides: parsed.data.sides,
    });
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="renisual-fotos-maten.pdf"`,
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    logger.error({ err }, "calc_photo_pdf_render_failed");
    return NextResponse.json({ error: "render_failed" }, { status: 500 });
  }
}
