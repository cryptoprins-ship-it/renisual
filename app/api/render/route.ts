import { GoogleGenAI, Modality } from "@google/genai";
import { z } from "zod";
import { renderLimit, clientKeyFromRequest, rateLimitResponse } from "@/lib/ratelimit";
import { verifyOrigin } from "@/lib/verifyOrigin";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

type InlinePart = { inlineData: { mimeType: string; data: string } };

// Hard cap on inbound image bytes to keep one bad caller from blowing the
// 4MB Vercel body limit AND stop someone funneling huge files into Gemini.
// 8 MB base64 ≈ 6 MB raw — enough for a phone photo, modest for an SLR.
const MAX_DATA_URL_LEN = 8 * 1024 * 1024;

const dataUrl = z
  .string()
  .max(MAX_DATA_URL_LEN, "image_too_large")
  .regex(/^data:image\/(png|jpe?g|webp);base64,/, "not_image_data_url");

const renderSchema = z.object({
  photoDataUrl: dataUrl,
  referenceDataUrl: dataUrl.optional(),
  referenceDataUrls: z.array(dataUrl).max(5).optional(),
  productLabel: z.string().max(200).optional(),
  productDescription: z.string().max(2000).optional(),
  orientation: z.enum(["horizontal", "vertical"]).optional(),
  panelLength: z.number().finite().positive().max(10000).optional(),
  panelVisibleHeight: z.number().finite().positive().max(10000).optional(),
  panelWidthCm: z.number().finite().positive().max(10000).optional(),
  facadeWidthCm: z.number().finite().positive().max(100000).optional(),
  facadeHeightCm: z.number().finite().positive().max(100000).optional(),
  windowFrame: z.object({ material: z.string().max(200).optional() }).optional(),
  door: z
    .object({
      material: z.string().max(200).optional(),
      colour: z.string().max(100).optional(),
    })
    .optional(),
  prompt: z.string().max(4000).optional(),
  locale: z.string().max(10).optional(),
});

type RenderBody = z.infer<typeof renderSchema>;

function dataUrlToInlinePart(dataUrl: string): InlinePart | null {
  const m = /^data:([^;,]+);base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  return { inlineData: { mimeType: m[1], data: m[2] } };
}

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

function resolveGeminiKey(): string | undefined {
  const candidates = [
    "GEMINI_API_KEY",
    "Gemini_API_Key",
    "Gemini_Api_Key",
    "gemini_api_key",
    "GOOGLE_API_KEY",
    "Google_API_Key",
  ];
  for (const name of candidates) {
    const raw = process.env[name];
    if (typeof raw === "string" && raw.trim().length > 0) return raw.trim();
  }
  return readEnvCaseInsensitive("GEMINI_API_KEY")?.trim();
}

export async function POST(request: Request) {
  const forbidden = verifyOrigin(request);
  if (forbidden) return forbidden;

  const ip = clientKeyFromRequest(request);
  const { success, reset } = await renderLimit.limit(ip);
  if (!success) {
    logger.warn({ ip }, "render_rate_limited");
    return rateLimitResponse(reset);
  }

  const apiKey = resolveGeminiKey();
  if (!apiKey) {
    // Don't echo env-var diagnostics back to the caller — that information
    // is operationally useful but leaks our infra to attackers. Server log
    // captures the detail for an operator looking at the dashboard.
    logger.error("render_missing_gemini_key");
    return Response.json({ error: "internal_error" }, { status: 500 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = renderSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_input", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const body: RenderBody = parsed.data;

  const photoPart = dataUrlToInlinePart(body.photoDataUrl);
  if (!photoPart) {
    return Response.json({ error: "invalid_input" }, { status: 400 });
  }

  const referenceUrls = body.referenceDataUrls?.length
    ? body.referenceDataUrls
    : body.referenceDataUrl
    ? [body.referenceDataUrl]
    : [];
  const referenceParts = referenceUrls
    .map((url) => dataUrlToInlinePart(url))
    .filter((p): p is InlinePart => p !== null);

  const RAL_HEX: Record<string, { hex: string; description: string }> = {
    "7021": { hex: "#2A2D2F", description: "very dark charcoal grey, almost black" },
    "7038": { hex: "#7B7B79", description: "medium agate grey" },
    "9005": { hex: "#0E0E10", description: "deep matt black" },
    "9006": {
      hex: "#A5A8A6",
      description:
        "WHITE ALUMINIUM — this is NOT white. It is a medium metallic silver-grey, similar to brushed aluminium or galvanized steel. The surface has a subtle metallic sheen. Hex value #A5A8A6. Do NOT render as white or cream. Render as distinctly grey with metallic quality.",
    },
    "9007": {
      hex: "#8F8F8C",
      description:
        "GREY ALUMINIUM — a darker metallic silver-grey than RAL 9006, similar to anodised aluminium. Distinctly grey with a metallic sheen. Hex value #8F8F8C. Do NOT render as plain grey paint — it must read as metallic.",
    },
    "9010": { hex: "#F1ECE1", description: "warm off-white" },
  };

  function metallicWarningFor(ralCode: string): string {
    if (ralCode === "9006") {
      return "CRITICAL COLOUR WARNING: RAL 9006 is WHITE ALUMINIUM — a metallic silver-grey colour, NOT white. The rendered facade MUST look distinctly grey-silver, like brushed metal. If the output looks white or cream, it is WRONG.";
    }
    if (ralCode === "9007") {
      return "CRITICAL COLOUR WARNING: RAL 9007 is GREY ALUMINIUM — a darker metallic silver-grey, NOT plain grey paint. The rendered facade MUST read as anodised aluminium with a clear metallic sheen. If the output looks like flat matte grey, it is WRONG.";
    }
    return "";
  }

  const ralFromText = (() => {
    const haystack = `${body.productLabel ?? ""} ${body.productDescription ?? ""}`;
    const m = /RAL\s?(\d{4})/i.exec(haystack);
    return m ? m[1] : "";
  })();
  const ralEntry = ralFromText ? RAL_HEX[ralFromText] : undefined;
  const ralColourLine = ralEntry
    ? `COLOUR (CRITICAL): RAL ${ralFromText} — ${ralEntry.description} (hex ${ralEntry.hex}). The cladding MUST exactly match this colour.`
    : "";
  const ralMetallicWarning = ralFromText ? metallicWarningFor(ralFromText) : "";

  const orientationLabel = body.orientation === "vertical" ? "verticaal" : "horizontaal";
  const panelSize =
    body.panelLength && body.panelVisibleHeight
      ? `, paneelafmeting ${body.panelLength}×${body.panelVisibleHeight} mm`
      : "";
  const productLine = body.productLabel?.trim() || "het gespecificeerde gevelmateriaal";

  const panelWidth = body.panelWidthCm && body.panelWidthCm > 0 ? `${body.panelWidthCm} cm` : "";
  let visibleSeams = "";
  if (body.facadeWidthCm && body.panelWidthCm && body.orientation === "vertical") {
    const count = Math.round(body.facadeWidthCm / body.panelWidthCm);
    visibleSeams = `Op een gevelbreedte van ~${(body.facadeWidthCm / 100).toFixed(1)} m moeten ongeveer ${count} verticale paneelnaden zichtbaar zijn.`;
  } else if (body.facadeHeightCm && body.panelWidthCm && body.orientation === "horizontal") {
    const count = Math.round(body.facadeHeightCm / body.panelWidthCm);
    visibleSeams = `Op een gevelhoogte van ~${(body.facadeHeightCm / 100).toFixed(1)} m moeten ongeveer ${count} horizontale paneelnaden zichtbaar zijn.`;
  }

  const defaultPrompt = [
    "Je bent een gevelvisualisatie-assistent voor Renisual.",
    `Vervang uitsluitend het gevelmateriaal van het hoofdgebouw op de eerste foto door ${productLine}, ${orientationLabel} aangebracht${panelSize}.`,
    panelWidth ? `Paneelmaat: ${panelWidth} breed.` : "",
    visibleSeams,
    body.productDescription ? `Producteigenschappen: ${body.productDescription}.` : "",
    ralColourLine,
    ralMetallicWarning,
    referenceParts.length >= 2
      ? "Gebruik beide referentieafbeeldingen (afbeelding 2 en 3): close-up én toepassing — combineer voor kleur én plankritme."
      : referenceParts.length === 1
      ? "KRITISCH: gebruik de TWEEDE afbeelding als exacte visuele referentie voor kleur, motief, plankverdeling en oppervlaktestructuur."
      : "",
    "KRITISCH MOTIEF: het paneeloppervlak mag niet egaal zijn — toon individuele panelen met duidelijke naden ertussen.",
    "Do NOT add any black lines, dark stripes, or shadows between panels. Panel seams must be the same colour as the panels, only slightly darker. Maximum seam width 3mm. Do not add any new dark elements that were not in the original photo.",
    body.windowFrame?.material ? `Also replace all window frames with ${body.windowFrame.material}.` : "",
    body.door?.material && body.door?.colour ? `Replace all doors with ${body.door.material} in ${body.door.colour}.` : "",
    `Behoud raamopeningen${body.windowFrame?.material ? " (vervang alléén de kozijnen zoals beschreven)" : ", kozijnen"}, deuropeningen${body.door?.material ? " (vervang alléén het deurblad zoals beschreven)" : ", deuren"}, dakgoten, dakranden, regenpijpen, beglazing, omgeving (lucht, planten, straat, voertuigen), perspectief en belichting van de originele foto exact.`,
    "Lever één fotorealistische compositie van de volledige gevel als output.",
  ]
    .filter(Boolean)
    .join(" ");

  const promptText = body.prompt?.trim() || defaultPrompt;

  const parts = [photoPart, ...referenceParts, { text: promptText }];

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: parts,
      config: {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });

    const imagePart = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
    if (!imagePart?.inlineData?.data) {
      logger.warn("render_no_image_returned");
      return Response.json({ error: "upstream_no_image" }, { status: 502 });
    }

    const mime = imagePart.inlineData.mimeType ?? "image/png";
    return Response.json({ renderDataUrl: `data:${mime};base64,${imagePart.inlineData.data}` });
  } catch (err) {
    logger.error({ err }, "render_gemini_failed");
    return Response.json({ error: "upstream_error" }, { status: 502 });
  }
}
