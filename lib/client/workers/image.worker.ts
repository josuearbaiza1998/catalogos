/// <reference lib="webworker" />
// Optimiza cada foto fuera del hilo principal:
//  - respeta la orientación EXIF,
//  - genera una miniatura (480 px) para el lienzo,
//  - genera la versión de subida (máx. 2048 px, WebP/JPEG) para ahorrar datos móviles,
//  - calcula el SHA-256 para deduplicar en el bucket.

export interface ImageJob {
  id: string;
  file: Blob;
}

export interface ImageResult {
  id: string;
  ok: boolean;
  thumb?: Blob;
  upload: Blob;
  width?: number;
  height?: number;
  sha256: string;
  mime: string;
  error?: string;
}

const THUMB_MAX = 480;
const UPLOAD_MAX = 2048;

async function encode(canvas: OffscreenCanvas, quality: number): Promise<Blob> {
  // Safari no codifica WebP desde canvas: devuelve PNG. En ese caso usamos JPEG.
  const webp = await canvas.convertToBlob({ type: "image/webp", quality });
  if (webp.type === "image/webp") return webp;
  return canvas.convertToBlob({ type: "image/jpeg", quality });
}

function resize(bitmap: ImageBitmap, max: number): OffscreenCanvas {
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas;
}

async function sha256(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

self.onmessage = async (e: MessageEvent<ImageJob>) => {
  const { id, file } = e.data;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const thumb = await encode(resize(bitmap, THUMB_MAX), 0.78);
    let upload: Blob = await encode(resize(bitmap, UPLOAD_MAX), 0.86);
    // Si el original ya era pequeño y liviano, no lo recomprimimos.
    if (upload.size >= file.size && file.type && /image\/(jpeg|webp|avif)/.test(file.type)) upload = file;
    const result: ImageResult = {
      id,
      ok: true,
      thumb,
      upload,
      width: bitmap.width,
      height: bitmap.height,
      sha256: await sha256(upload),
      mime: upload.type || "application/octet-stream",
    };
    bitmap.close();
    (self as unknown as Worker).postMessage(result);
  } catch (err) {
    // HEIC en Chrome/Android u otro formato no decodificable: se sube el original y
    // el servidor genera las variantes.
    const result: ImageResult = {
      id,
      ok: false,
      upload: file,
      sha256: await sha256(file),
      mime: file.type || "application/octet-stream",
      error: err instanceof Error ? err.message : String(err),
    };
    (self as unknown as Worker).postMessage(result);
  }
};
