import { INPUT_SIZE, MEAN, STD } from "./constants";

/**
 * Convert RGBA pixels (already resized to size x size) into a normalized
 * CHW float32 tensor buffer of shape [1, 3, size, size].
 */
export function rgbaToCHW(rgba: Uint8ClampedArray | Uint8Array, size = INPUT_SIZE) {
  const plane = size * size;
  if (rgba.length !== plane * 4) throw new Error(`Expected ${plane * 4} RGBA values, got ${rgba.length}`);
  const out = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    for (let c = 0; c < 3; c++) {
      out[c * plane + i] = ((rgba[i * 4 + c] ?? 0) / 255 - (MEAN[c] ?? 0)) / (STD[c] ?? 1);
    }
  }
  return { data: out, dims: [1, 3, size, size] as [number, number, number, number] };
}

/** Browser-only: decode an image file into an ImageBitmap (rejects non-images).
 *  Some phones/OSes send an empty MIME type, so we trust the decoder, not the label. */
export async function decodeImage(file: File): Promise<ImageBitmap> {
  if (file.type && !file.type.startsWith("image/")) throw new Error("Not an image file");
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const el = new Image(); el.src = url; await el.decode();
      return await createImageBitmap(el);
    } finally { URL.revokeObjectURL(url); }
  }
}

/** Browser-only: direct (non-aspect-preserving) resize to size x size, RGB. */
export function resizeToRGBA(img: ImageBitmap, size = INPUT_SIZE): Uint8ClampedArray {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(img, 0, 0, size, size);
  return ctx.getImageData(0, 0, size, size).data;
}

export function makeThumbnail(img: ImageBitmap, max = 160): string {
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.7);
}
