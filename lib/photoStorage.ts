import { createClient } from "@/utils/supabase/client";

const BUCKET = "project-photos";
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export type UploadErrorCode =
  | "too_large"
  | "wrong_type"
  | "compression_failed"
  | "upload_failed";

export class UploadError extends Error {
  code: UploadErrorCode;
  constructor(code: UploadErrorCode, message: string) {
    super(message);
    this.name = "UploadError";
    this.code = code;
  }
}

export function validateImageFile(file: File): void {
  if (file.size > MAX_FILE_SIZE) {
    throw new UploadError(
      "too_large",
      `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Max ${MAX_FILE_SIZE / 1024 / 1024}MB.`
    );
  }

  const isAllowedMime = (ALLOWED_MIME_TYPES as readonly string[]).includes(file.type);
  const isHeicByExtension = /\.(heic|heif)$/i.test(file.name);

  // Browsers often report empty `type` for HEIC, hence the extension fallback.
  if (!isAllowedMime && !isHeicByExtension) {
    throw new UploadError("wrong_type", `File type not allowed: ${file.type || "unknown"}.`);
  }
}

// Decode a File into a CanvasImageSource. createImageBitmap is the fast
// path (no DOM, no objectURL) but it throws on iPhone HEIC files in
// Chromium/WebKit. The <img> + URL.createObjectURL fallback delegates
// decoding to the browser's image pipeline, which handles HEIC natively
// on iOS Safari/Chrome (both use WebKit). On Android/desktop Chrome
// HEIC has no native decoder — both paths fail there and the caller
// surfaces a compression_failed error, which is correct.
async function decodeFileToCanvasSource(file: File): Promise<{
  width: number;
  height: number;
  src: CanvasImageSource;
  release: () => void;
}> {
  try {
    const bitmap = await createImageBitmap(file);
    return {
      width: bitmap.width,
      height: bitmap.height,
      src: bitmap,
      release: () => bitmap.close?.(),
    };
  } catch {
    // fall through to <img> path
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("img decode failed"));
      i.src = url;
    });
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      src: img,
      release: () => URL.revokeObjectURL(url),
    };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

export async function compressImage(
  file: File,
  maxSize = 1600,
  quality = 0.85
): Promise<Blob> {
  const decoded = await decodeFileToCanvasSource(file);
  try {
    const ratio = Math.min(maxSize / decoded.width, maxSize / decoded.height, 1);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(decoded.width * ratio);
    canvas.height = Math.round(decoded.height * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context unavailable");
    ctx.drawImage(decoded.src, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Compression failed"))),
        "image/jpeg",
        quality
      );
    });
  } finally {
    decoded.release();
  }
}

export async function uploadPhoto(
  file: File
): Promise<{ path: string; fileName: string }> {
  validateImageFile(file);

  let compressed: Blob;
  try {
    compressed = await compressImage(file);
  } catch {
    throw new UploadError("compression_failed", "Could not process image");
  }

  const supabase = createClient();
  const random = crypto.randomUUID();
  const path = `anon-uploads/${Date.now()}-${random}.jpg`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, compressed, {
    contentType: "image/jpeg",
    upsert: false,
  });

  if (error) {
    throw new UploadError("upload_failed", error.message);
  }

  return { path, fileName: file.name };
}

// Upload a render result (already a JPEG/PNG Blob, e.g. from a data
// URL produced by /api/render) into the offerte-renders bucket. The
// path is returned so the caller can stash it in projectStore and
// hand it to /api/offertes for the PDF render.
export async function uploadRender(blob: Blob): Promise<{ path: string }> {
  const supabase = createClient();
  const random = crypto.randomUUID();
  const ext = blob.type === "image/png" ? "png" : "jpg";
  const path = `anon-uploads/${Date.now()}-${random}.${ext}`;

  const { error } = await supabase.storage.from("offerte-renders").upload(path, blob, {
    contentType: blob.type || "image/jpeg",
    upsert: false,
  });

  if (error) {
    throw new UploadError("upload_failed", error.message);
  }

  return { path };
}

export async function getPhotoUrl(
  storagePath: string,
  bucket: string = BUCKET,
): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storagePath, 3600);

  if (error || !data) {
    console.error("Signed URL failed:", error);
    return null;
  }

  return data.signedUrl;
}
