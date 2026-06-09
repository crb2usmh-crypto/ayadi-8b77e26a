/**
 * Browser image compression / down-scaling using the Canvas API.
 * Returns a JPEG/WEBP Blob smaller than the input when possible.
 */
export interface CompressOptions {
  /** Max width (px) of the longer dimension. Default 1024. */
  maxSize?: number;
  /** JPEG / WEBP quality 0–1. Default 0.82. */
  quality?: number;
  /** Output mime. Default "image/jpeg". */
  mimeType?: "image/jpeg" | "image/webp" | "image/png";
}

export async function compressImage(
  file: File,
  opts: CompressOptions = {},
): Promise<File> {
  const { maxSize = 1024, quality = 0.82, mimeType = "image/jpeg" } = opts;

  // Bail out for non-images or tiny payloads — not worth the work.
  if (!file.type.startsWith("image/")) return file;
  if (file.size < 80 * 1024) return file;

  try {
    const bitmap = await createBitmap(file);
    const { width, height } = scale(bitmap.width, bitmap.height, maxSize);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, mimeType, quality),
    );
    if (!blob || blob.size >= file.size) return file;

    const ext = mimeType === "image/webp" ? "webp" : mimeType === "image/png" ? "png" : "jpg";
    const name = file.name.replace(/\.[^.]+$/, "") + "." + ext;
    return new File([blob], name, { type: mimeType, lastModified: Date.now() });
  } catch {
    return file;
  }
}

async function createBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fallthrough */
    }
  }
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

function scale(w: number, h: number, max: number) {
  if (w <= max && h <= max) return { width: w, height: h };
  const ratio = w >= h ? max / w : max / h;
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) };
}