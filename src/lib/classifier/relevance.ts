/**
 * Universal Chest X-ray vs. Non-Chest X-ray Validation Engine.
 *
 * Runs identically in the browser (frontend) and in Node.js (backend).
 * Uses a dedicated machine learning classifier trained on:
 * - 8x8 coarse spatial anatomical template grid (64 features)
 * - Bilateral thoracic cage symmetry correlation
 * - Central mediastinum-to-lateral lung field radiodensity contrast
 * - Four-corner radiation collimation/air darkness ratio
 * - High-frequency text line / row-gradient periodicity (textbook detection)
 * - Luminance distribution & dynamic range
 * - Color / HSV saturation fraction
 *
 * Strictly rejects:
 * - Textbook pages (scans and ambient phone camera photos)
 * - Blank sheets of paper and documents
 * - Screenshots and UI mockups
 * - Photographs, selfies, portraits, animals
 * - Corrupted, empty, or invalid images
 */

import validatorWeights from "./xray-validator-weights.json";

export type RelevanceResult =
  { ok: true; probability: number } | { ok: false; reason: string; probability: number };

export const REJECTION_MESSAGE = "Invalid image. Please upload a chest X-ray.";

export const MIN_FILE_BYTES = 2 * 1024; // 2 KB
export const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB
export const MIN_ASPECT = 0.35;
export const MAX_ASPECT = 2.8;
export const ANALYSIS_SIZE = 64;

/**
 * Resample any RGBA image buffer to a 64x64 grid and extract the 73 features.
 * Works without DOM canvas, so it runs identically on Node.js backend and browser.
 */
export function extractFeaturesFromRGBA(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
): number[] {
  const S = ANALYSIS_SIZE;
  const lum64 = new Float32Array(S * S);
  let colorfulPixels = 0;
  let sumB = 0;
  let sumBSq = 0;
  let whiteCount = 0;
  let darkCount = 0;

  // Resample / sample into 64x64 luminance grid
  for (let gy = 0; gy < S; gy++) {
    const srcY = Math.min(height - 1, Math.floor((gy / S) * height));
    for (let gx = 0; gx < S; gx++) {
      const srcX = Math.min(width - 1, Math.floor((gx / S) * width));
      const idx = (srcY * width + srcX) * 4;
      const r = rgba[idx] ?? 0;
      const g = rgba[idx + 1] ?? 0;
      const b = rgba[idx + 2] ?? 0;

      // BT.601 luminance
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      lum64[gy * S + gx] = l;
      sumB += l;
      sumBSq += l * l;

      if (l > 215) whiteCount++;
      if (l < 45) darkCount++;

      // HSV saturation (0..100)
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const sat = maxC === 0 ? 0 : ((maxC - minC) / maxC) * 100;
      if (sat > 18) colorfulPixels++;
    }
  }

  const totalPixels = S * S;
  const meanB = sumB / totalPixels;
  const variance = sumBSq / totalPixels - meanB * meanB;
  const stdB = Math.sqrt(Math.max(0, variance));
  const colorfulFraction = colorfulPixels / totalPixels;

  // 1. 8x8 coarse grid features (64)
  const gridSize = 8;
  const blockH = Math.floor(S / gridSize);
  const grid = new Array<number>(64);
  for (let gy = 0; gy < gridSize; gy++) {
    for (let gx = 0; gx < gridSize; gx++) {
      let patchSum = 0;
      for (let y = gy * blockH; y < (gy + 1) * blockH; y++) {
        for (let x = gx * blockH; x < (gx + 1) * blockH; x++) {
          patchSum += lum64[y * S + x]!;
        }
      }
      grid[gy * gridSize + gx] = patchSum / (blockH * blockH * 255.0);
    }
  }

  // 2. Corner intensity (mean of four 8x8 corners / 255.0)
  let cornerSum = 0;
  for (let y = 0; y < blockH; y++) {
    for (let x = 0; x < blockH; x++) {
      cornerSum += lum64[y * S + x]!; // TL
      cornerSum += lum64[y * S + (S - blockH + x)]!; // TR
      cornerSum += lum64[(S - blockH + y) * S + x]!; // BL
      cornerSum += lum64[(S - blockH + y) * S + (S - blockH + x)]!; // BR
    }
  }
  const cornerMean = cornerSum / (4.0 * blockH * blockH * 255.0);

  // 3. Bilateral symmetry correlation
  const halfW = Math.floor(S / 2);
  let sumL = 0;
  let sumR = 0;
  let sumLSq = 0;
  let sumRSq = 0;
  let sumLR = 0;
  const nHalf = S * halfW;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < halfW; x++) {
      const vL = lum64[y * S + x]!;
      const vR = lum64[y * S + (S - 1 - x)]!; // horizontally flipped
      sumL += vL;
      sumR += vR;
      sumLSq += vL * vL;
      sumRSq += vR * vR;
      sumLR += vL * vR;
    }
  }
  const meanL = sumL / nHalf;
  const meanR = sumR / nHalf;
  const varL = sumLSq / nHalf - meanL * meanL;
  const varR = sumRSq / nHalf - meanR * meanR;
  const cov = sumLR / nHalf - meanL * meanR;
  const symmetry = varL > 1e-4 && varR > 1e-4 ? cov / (Math.sqrt(varL) * Math.sqrt(varR)) : 0;

  // 4. Central mediastinum vs lateral lung zones
  const cX1 = Math.floor(S * 0.4);
  const cX2 = Math.floor(S * 0.6);
  const lX1 = Math.floor(S * 0.15);
  const lX2 = Math.floor(S * 0.35);
  const rX1 = Math.floor(S * 0.65);
  const rX2 = Math.floor(S * 0.85);
  const y1 = Math.floor(S * 0.25);
  const y2 = Math.floor(S * 0.65);

  let cSum = 0;
  let cCount = 0;
  let latSum = 0;
  let latCount = 0;
  for (let y = y1; y < y2; y++) {
    for (let x = cX1; x < cX2; x++) {
      cSum += lum64[y * S + x]!;
      cCount++;
    }
    for (let x = lX1; x < lX2; x++) {
      latSum += lum64[y * S + x]!;
      latCount++;
    }
    for (let x = rX1; x < rX2; x++) {
      latSum += lum64[y * S + x]!;
      latCount++;
    }
  }
  const centerVal = cCount > 0 ? cSum / cCount : 0;
  const lateralVal = latCount > 0 ? latSum / latCount : 1;
  const centerLateralRatio = centerVal / Math.max(1.0, lateralVal);

  // 5. Row gradient variance (textbook line oscillation)
  const rowSums = new Float32Array(S);
  for (let y = 0; y < S; y++) {
    let rSum = 0;
    for (let x = 0; x < S; x++) {
      rSum += lum64[y * S + x]!;
    }
    rowSums[y] = rSum / S;
  }
  let rowDiffSum = 0;
  let rowDiffSq = 0;
  for (let y = 0; y < S - 1; y++) {
    const d = rowSums[y + 1]! - rowSums[y]!;
    rowDiffSum += d;
    rowDiffSq += d * d;
  }
  const meanDiff = rowDiffSum / (S - 1);
  const rowVar = (rowDiffSq / (S - 1) - meanDiff * meanDiff) / (255.0 * 255.0);

  return [
    ...grid,
    cornerMean,
    whiteCount / totalPixels,
    darkCount / totalPixels,
    meanB / 255.0,
    stdB / 255.0,
    symmetry,
    centerLateralRatio,
    rowVar,
    colorfulFraction,
  ];
}

/**
 * Predict whether features match a chest X-ray using the trained ML model.
 */
export function predictChestXray(features: number[]): {
  isChestXray: boolean;
  probability: number;
} {
  const { weights, bias, scaler_mean, scaler_scale, threshold } = validatorWeights;

  let logit = bias;
  for (let i = 0; i < features.length; i++) {
    const raw = features[i] ?? 0;
    const mean = scaler_mean[i] ?? 0;
    const scale = scaler_scale[i] ?? 1;
    const scaled = (raw - mean) / scale;
    logit += scaled * (weights[i] ?? 0);
  }

  const probability = 1.0 / (1.0 + Math.exp(-logit));
  return {
    isChestXray: probability >= threshold,
    probability,
  };
}

/**
 * Core validation logic operating directly on RGBA pixel data.
 * Pure logic — runnable on both frontend and backend.
 */
export function validateChestXrayFromRGBA(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  fileSize?: number,
): RelevanceResult {
  // 1. File size guards
  if (fileSize !== undefined) {
    if (fileSize < MIN_FILE_BYTES || fileSize > MAX_FILE_BYTES) {
      return { ok: false, reason: REJECTION_MESSAGE, probability: 0 };
    }
  }

  // 2. Aspect ratio
  if (width <= 0 || height <= 0) {
    return { ok: false, reason: REJECTION_MESSAGE, probability: 0 };
  }
  const aspect = width / height;
  if (aspect < MIN_ASPECT || aspect > MAX_ASPECT) {
    return { ok: false, reason: REJECTION_MESSAGE, probability: 0 };
  }

  // 3. Extract 73 features
  const features = extractFeaturesFromRGBA(rgba, width, height);

  // 4. Deterministic physiological and document guards
  const cornerMean = features[64] ?? 0;
  const whiteRatio = features[65] ?? 0;
  const stdB = (features[68] ?? 0) * 255.0;
  const symmetry = features[69] ?? 0;
  const centerLateralRatio = features[70] ?? 0;
  const colorfulFraction = features[72] ?? 0;

  // Blank canvas, solid color, or completely uniform sheet
  if (stdB < 6.0) {
    return { ok: false, reason: REJECTION_MESSAGE, probability: 0 };
  }

  // Color photograph / selfie / cartoon (chest X-rays are ionising grayscale)
  if (colorfulFraction > 0.1) {
    return { ok: false, reason: REJECTION_MESSAGE, probability: 0 };
  }

  // High paper brightness or bright margins (textbook / paper / printed document)
  if (whiteRatio > 0.45 || cornerMean > 0.7) {
    return { ok: false, reason: REJECTION_MESSAGE, probability: 0 };
  }

  // Absence of central thoracic column (in chest X-rays, spine/heart is brighter than lateral lungs)
  // If center is darker or identical to lateral margins while symmetry is low, it's not a chest radiograph
  if (centerLateralRatio < 1.05 && symmetry < 0.4) {
    return { ok: false, reason: REJECTION_MESSAGE, probability: 0 };
  }

  // 5. ML Model Inference
  const { isChestXray, probability } = predictChestXray(features);
  if (!isChestXray) {
    return { ok: false, reason: REJECTION_MESSAGE, probability };
  }

  return { ok: true, probability };
}

/**
 * Browser-friendly validator taking ImageBitmap and File.
 */
export function validateChestXray(img: ImageBitmap, file: File): RelevanceResult {
  // Basic file checks
  if (file.size < MIN_FILE_BYTES || file.size > MAX_FILE_BYTES) {
    return { ok: false, reason: REJECTION_MESSAGE, probability: 0 };
  }
  const aspect = img.width / img.height;
  if (aspect < MIN_ASPECT || aspect > MAX_ASPECT) {
    return { ok: false, reason: REJECTION_MESSAGE, probability: 0 };
  }

  const S = ANALYSIS_SIZE;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return { ok: false, reason: REJECTION_MESSAGE, probability: 0 };
  }

  ctx.drawImage(img, 0, 0, S, S);
  const { data } = ctx.getImageData(0, 0, S, S);

  return validateChestXrayFromRGBA(data, S, S, file.size);
}
