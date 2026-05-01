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

export async function compressImage(
  file: File,
  maxSize = 1600,
  quality = 0.85
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(maxSize / bitmap.width, maxSize / bitmap.height, 1);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * ratio);
  canvas.height = Math.round(bitmap.height * ratio);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context unavailable");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Compression failed"))),
      "image/jpeg",
      quality
    );
  });
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

export async function getPhotoUrl(storagePath: string): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 3600);

  if (error || !data) {
    console.error("Signed URL failed:", error);
    return null;
  }

  return data.signedUrl;
}
