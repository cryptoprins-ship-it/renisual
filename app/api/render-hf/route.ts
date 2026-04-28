import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, maskBase64, prompt } = await req.json();

    if (!imageBase64 || !maskBase64) {
      return NextResponse.json({ error: "Afbeelding en masker zijn verplicht" }, { status: 400 });
    }

    const hfKey = process.env.HUGGINGFACE_API_KEY;
    if (!hfKey) {
      return NextResponse.json({ error: "HF API key ontbreekt" }, { status: 500 });
    }

    // Converteer base64 naar blob
    const imageBlob = base64ToBlob(imageBase64, "image/png");
    const maskBlob = base64ToBlob(maskBase64, "image/png");

    const formData = new FormData();
    formData.append("inputs", JSON.stringify({ prompt: prompt || "realistic facade material, architectural photography, high quality" }));
    formData.append("image", imageBlob, "image.png");
    formData.append("mask_image", maskBlob, "mask.png");

    // Stable Diffusion inpainting — gratis op HF
    const response = await fetch(
      "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2-inpainting",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${hfKey}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const err = await response.text();
      // Model laadt op (cold start) — geef hint terug
      if (response.status === 503) {
        return NextResponse.json(
          { error: "Model wordt gestart, probeer over 20 seconden opnieuw." },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: `HF fout: ${err}` }, { status: response.status });
    }

    // Response is een afbeelding (binary)
    const buffer = await response.arrayBuffer();
    const base64Result = Buffer.from(buffer).toString("base64");

    return NextResponse.json({ image: `data:image/png;base64,${base64Result}` });
  } catch (err) {
    console.error("HF render error:", err);
    return NextResponse.json({ error: "Server fout" }, { status: 500 });
  }
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  // Verwijder data URL prefix als aanwezig
  const base64Data = base64.includes(",") ? base64.split(",")[1] : base64;
  const bytes = Buffer.from(base64Data, "base64");
  return new Blob([bytes], { type: mimeType });
}