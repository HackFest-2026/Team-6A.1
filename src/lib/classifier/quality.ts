export type QualityReport = {
  width: number;
  height: number;
  meanBrightness: number; // 0-255
  blurVariance: number; // variance of Laplacian on 256px grayscale
  warnings: string[];
};

/** Measures only; never alters the classification. */
export function measureQuality(img: ImageBitmap): QualityReport {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, size, size);
  const d = ctx.getImageData(0, 0, size, size).data as unknown as number[];
  const g: number[] = new Array(size * size).fill(0);
  let sum = 0;
  for (let i = 0; i < g.length; i++) {
    const v = 0.299 * d[i * 4]! + 0.587 * d[i * 4 + 1]! + 0.114 * d[i * 4 + 2]!;
    g[i] = v;
    sum += v;
  }
  const meanBrightness = sum / g.length;
  let lsum = 0, lsq = 0, n = 0;
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const i = y * size + x;
      const l = g[i - 1]! + g[i + 1]! + g[i - size]! + g[i + size]! - 4 * g[i]!;
      lsum += l; lsq += l * l; n++;
    }
  }
  const blurVariance = lsq / n - (lsum / n) ** 2;
  const warnings: string[] = [];
  if (Math.min(img.width, img.height) < 224) warnings.push("Image is smaller than 224 px on one side.");
  if (meanBrightness < 30) warnings.push("Image is very dark.");
  if (meanBrightness > 225) warnings.push("Image is very bright.");
  if (blurVariance < 20) warnings.push("Image may be blurry.");
  return { width: img.width, height: img.height, meanBrightness, blurVariance, warnings };
}
