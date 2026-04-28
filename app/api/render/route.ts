import { GoogleGenAI, Modality } from "@google/genai";

export const runtime = "nodejs";
export const maxDuration = 60;

type RenderBody = {
  photoDataUrl?: string;
  referenceDataUrl?: string;
  referenceDataUrls?: string[];
  productLabel?: string;
  productDescription?: string;
  orientation?: "horizontal" | "vertical";
  panelLength?: number;
  panelVisibleHeight?: number;
  panelWidthCm?: number;
  facadeWidthCm?: number;
  facadeHeightCm?: number;
  prompt?: string;
  locale?: string;
};

type InlinePart = { inlineData: { mimeType: string; data: string } };

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

function resolveGeminiKey(): { key?: string; diag: Record<string, unknown> } {
  const candidates = [
    "GEMINI_API_KEY",
    "Gemini_API_Key",
    "Gemini_Api_Key",
    "gemini_api_key",
    "GOOGLE_API_KEY",
    "Google_API_Key",
  ];
  const tried: Record<string, string> = {};
  for (const name of candidates) {
    const raw = process.env[name];
    if (typeof raw === "string") {
      tried[name] = `len=${raw.length}, trim=${raw.trim().length}`;
      if (raw.trim().length > 0) return { key: raw.trim(), diag: { matchedDirect: name, tried } };
    } else {
      tried[name] = "undefined";
    }
  }
  const ci = readEnvCaseInsensitive("GEMINI_API_KEY");
  if (ci) return { key: ci.trim(), diag: { matchedCaseInsensitive: true, tried } };

  const allMatching = Object.keys(process.env).filter((k) => /gemini|google/i.test(k));
  const valuesProbe = allMatching.map((k) => {
    const v = process.env[k];
    return { name: k, type: typeof v, len: typeof v === "string" ? v.length : null };
  });
  return { diag: { tried, allMatching, valuesProbe } };
}

export async function POST(request: Request) {
  const { key: apiKey, diag } = resolveGeminiKey();
  if (!apiKey) {
    console.error("[render] No usable Gemini API key found. Diagnostic:", JSON.stringify(diag));
    return Response.json(
      {
        error: "Gemini API key missing or empty on server.",
        hint: "Add GEMINI_API_KEY in Vercel → Settings → Environment Variables (Production scope) with a non-empty value, then redeploy. Mixed-case names like 'Gemini_API_Key' also work.",
        diag,
      },
      { status: 500 }
    );
  }
  console.log(`[render] Gemini key resolved (length=${apiKey.length}, prefix=${apiKey.slice(0, 4)}…), diag=${JSON.stringify(diag)}`);

  let body: RenderBody;
  try {
    body = (await request.json()) as RenderBody;
  } catch (err) {
    console.error("[render] JSON parse failed:", err);
    return Response.json({ error: "Invalid JSON in request." }, { status: 400 });
  }

  const photoPart = body.photoDataUrl ? dataUrlToInlinePart(body.photoDataUrl) : null;
  if (!photoPart) {
    console.error("[render] photoDataUrl missing or malformed. Body keys:", Object.keys(body));
    return Response.json({ error: "Valid photoDataUrl missing." }, { status: 400 });
  }

  const referenceUrls = body.referenceDataUrls?.length
    ? body.referenceDataUrls
    : body.referenceDataUrl
    ? [body.referenceDataUrl]
    : [];
  const referenceParts = referenceUrls
    .map((url) => dataUrlToInlinePart(url))
    .filter((p): p is InlinePart => p !== null);

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
    referenceParts.length >= 2
      ? "Gebruik beide referentieafbeeldingen (afbeelding 2 en 3): close-up én toepassing — combineer voor kleur én plankritme."
      : referenceParts.length === 1
      ? "KRITISCH: gebruik de TWEEDE afbeelding als exacte visuele referentie voor kleur, motief, plankverdeling en oppervlaktestructuur."
      : "",
    "KRITISCH MOTIEF: het paneeloppervlak mag niet egaal zijn — toon individuele panelen met duidelijke naden ertussen.",
    "Behoud ramen, kozijnen, deuren, dakgoten, dakranden, regenpijpen, beglazing, omgeving (lucht, planten, straat, voertuigen), perspectief en belichting van de originele foto exact.",
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
      return Response.json({ error: "Geen afbeelding ontvangen van het model." }, { status: 502 });
    }

    const mime = imagePart.inlineData.mimeType ?? "image/png";
    return Response.json({ renderDataUrl: `data:${mime};base64,${imagePart.inlineData.data}` });
  } catch (err) {
    console.error("[render] Gemini call failed:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: `Gemini call failed: ${message}` }, { status: 502 });
  }
}
