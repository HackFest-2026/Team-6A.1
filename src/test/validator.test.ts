import { describe, expect, it } from "vitest";
import { predictChestXray, validateChestXray, REJECTION_MESSAGE } from "@/lib/classifier/relevance";
import { isValidCompleted, type ErrorResult } from "@/lib/classifier/result";

describe("Chest X-ray vs Non-Chest X-ray Validation Pipeline", () => {
  it("rejects textbook page features with probability near zero", () => {
    // Synthetic feature vector representing a textbook page:
    // - 64 grid values mostly high paper brightness (~0.90)
    // - cornerMean = 0.95 (white margins)
    // - whiteRatio = 0.82 (mostly white paper)
    // - darkRatio = 0.08 (text strokes only)
    // - meanB = 0.88, stdB = 0.20
    // - symmetry = 0.15 (asymmetric text/paragraphs)
    // - centerLateralRatio = 1.0 (uniform text spread, no mediastinum)
    // - rowVar = 0.04 (periodic text lines)
    // - colorfulFraction = 0.0 (black and white text)
    const textbookFeatures = new Array(64).fill(0.9);
    textbookFeatures.push(
      0.95, // cornerMean
      0.82, // whiteRatio
      0.08, // darkRatio
      0.88, // meanB
      0.2, // stdB
      0.15, // symmetry
      1.0, // centerLateralRatio
      0.04, // rowVar
      0.0, // colorfulFraction
    );

    const { isChestXray, probability } = predictChestXray(textbookFeatures);
    expect(isChestXray).toBe(false);
    expect(probability).toBeLessThan(0.05);
  });

  it("accepts authentic chest X-ray feature vector", () => {
    // Synthetic feature vector representing a frontal chest radiograph:
    // - dark corners, central spine/mediastinum mass, bilateral lung radiolucency
    const xrayGrid = [
      0.05, 0.1, 0.2, 0.25, 0.25, 0.2, 0.1, 0.05, 0.08, 0.25, 0.35, 0.45, 0.45, 0.35, 0.25, 0.08,
      0.1, 0.25, 0.2, 0.55, 0.55, 0.2, 0.25, 0.1, 0.12, 0.22, 0.18, 0.6, 0.6, 0.18, 0.22, 0.12,
      0.15, 0.28, 0.22, 0.65, 0.65, 0.22, 0.28, 0.15, 0.18, 0.32, 0.3, 0.6, 0.6, 0.3, 0.32, 0.18,
      0.2, 0.38, 0.4, 0.5, 0.5, 0.4, 0.38, 0.2, 0.05, 0.15, 0.25, 0.3, 0.3, 0.25, 0.15, 0.05,
    ];
    const xrayFeatures = [
      ...xrayGrid,
      0.08, // cornerMean (dark collimation)
      0.02, // whiteRatio (<5% pure white)
      0.35, // darkRatio (lungs & air)
      0.38, // meanB
      0.22, // stdB
      0.82, // symmetry (high thoracic bilateral symmetry)
      1.45, // centerLateralRatio (mediastinum brighter than lungs)
      0.002, // rowVar (smooth anatomical gradients)
      0.0, // colorfulFraction (grayscale)
    ];

    const { isChestXray, probability } = predictChestXray(xrayFeatures);
    expect(isChestXray).toBe(true);
    expect(probability).toBeGreaterThan(0.7);
  });

  it("rejects non-image, corrupted or tiny files immediately", () => {
    const fakeFile = new File(["tiny"], "tiny.jpg", { type: "image/jpeg" });
    const fakeBitmap = { width: 500, height: 500 } as ImageBitmap;

    const res = validateChestXray(fakeBitmap, fakeFile);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe(REJECTION_MESSAGE);
    }
  });

  it("rejects extreme panoramic or tall strips", () => {
    const buffer = new Uint8Array(10000);
    const wideFile = new File([buffer], "panorama.jpg", { type: "image/jpeg" });
    const wideBitmap = { width: 3000, height: 500 } as ImageBitmap; // aspect = 6.0

    const res = validateChestXray(wideBitmap, wideFile);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe(REJECTION_MESSAGE);
    }
  });

  it("enforces pipeline safety: validation errors never produce completed results", () => {
    const errorResult: ErrorResult = {
      status: "error",
      stage: "validate",
      userMessage: "Invalid image: Please upload a clear chest X-ray.",
    };

    expect(isValidCompleted(errorResult)).toBe(false);
  });
});
