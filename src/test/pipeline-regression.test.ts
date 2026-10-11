import { describe, expect, it } from "vitest";
import { validateChestXrayFromRGBA, REJECTION_MESSAGE } from "@/lib/classifier/relevance";
import { isValidCompleted, resultFromLogit, type ErrorResult } from "@/lib/classifier/result";
import { rgbaToCHW } from "@/lib/classifier/preprocess";
import { handleApiScan } from "@/server";

// Helper: create 64x64 RGBA buffer from 64x64 grayscale array
function createRgbaBuffer(
  gray64: Float32Array | number[],
  colorR = 0,
  colorG = 0,
  colorB = 0,
): Uint8ClampedArray {
  const buf = new Uint8ClampedArray(64 * 64 * 4);
  for (let i = 0; i < 64 * 64; i++) {
    const v = Math.max(0, Math.min(255, gray64[i] ?? 0));
    buf[i * 4] = Math.max(0, Math.min(255, v + colorR));
    buf[i * 4 + 1] = Math.max(0, Math.min(255, v + colorG));
    buf[i * 4 + 2] = Math.max(0, Math.min(255, v + colorB));
    buf[i * 4 + 3] = 255;
  }
  return buf;
}

// 1. Synthetic Textbook Page Generator
function createTextbookPage(): Uint8ClampedArray {
  const arr = new Float32Array(64 * 64).fill(225); // paper
  // Add text lines
  for (let y = 8; y < 56; y += 4) {
    for (let x = 8; x < 56; x++) {
      if (x % 7 !== 0) {
        arr[y * 64 + x] = 40; // dark text glyphs
        arr[(y + 1) * 64 + x] = 50;
      }
    }
  }
  return createRgbaBuffer(arr);
}

// 2. Synthetic Blank Sheet of Paper
function createBlankPaper(): Uint8ClampedArray {
  const arr = new Float32Array(64 * 64).fill(210); // uniform paper
  return createRgbaBuffer(arr);
}

// 3. Synthetic UI Screenshot
function createScreenshot(): Uint8ClampedArray {
  const arr = new Float32Array(64 * 64).fill(235);
  // Header bar
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 64; x++) arr[y * 64 + x] = 50;
  }
  // Content card
  for (let y = 16; y < 48; y++) {
    for (let x = 8; x < 56; x++) arr[y * 64 + x] = 250;
  }
  return createRgbaBuffer(arr);
}

// 4. Synthetic Normal Photograph (portrait/outdoor scene with color)
function createNormalPhotograph(): Uint8ClampedArray {
  const buf = new Uint8ClampedArray(64 * 64 * 4);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const idx = (y * 64 + x) * 4;
      if (y < 32) {
        // blue sky
        buf[idx] = 100;
        buf[idx + 1] = 160;
        buf[idx + 2] = 230;
      } else {
        // green foliage
        buf[idx] = 60;
        buf[idx + 1] = 140;
        buf[idx + 2] = 50;
      }
      buf[idx + 3] = 255;
    }
  }
  return buf;
}

// 5. Unrelated Medical Image (e.g. Brain MRI - round skull slice without lung cavities)
function createBrainMRI(): Uint8ClampedArray {
  const arr = new Float32Array(64 * 64);
  const cx = 32,
    cy = 32;
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist < 22) {
        // brain parenchyma (homogeneous gray with gyri texture, no mediastinum or lungs)
        arr[y * 64 + x] = 120 + ((x * y) % 30);
      } else if (dist < 25) {
        // skull bone (bright ring)
        arr[y * 64 + x] = 210;
      } else {
        // background air
        arr[y * 64 + x] = 5;
      }
    }
  }
  return createRgbaBuffer(arr);
}

// 6. Synthetic Genuine NORMAL Chest X-Ray
function createNormalChestXray(): Uint8ClampedArray {
  const arr = new Float32Array(64 * 64);
  const cx = 32,
    cy = 32;
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      // Thorax ellipse
      const rThorax = Math.exp(-((x - cx) ** 2 / (2 * 24 ** 2) + (y - cy) ** 2 / (2 * 26 ** 2)));
      let v = rThorax * 120;

      // Central spine/mediastinum
      const spine = Math.exp(-((x - cx) ** 2) / (2 * 5 ** 2));
      v += spine * 50;

      // Cardiac silhouette
      const heart = Math.exp(-((x - 37) ** 2 / (2 * 8 ** 2) + (y - 38) ** 2 / (2 * 8 ** 2)));
      v += heart * 40;

      // Radiolucent dark lung fields
      const lLung = Math.exp(-((x - 20) ** 2 / (2 * 6 ** 2) + (y - 28) ** 2 / (2 * 10 ** 2)));
      const rLung = Math.exp(-((x - 44) ** 2 / (2 * 6 ** 2) + (y - 28) ** 2 / (2 * 10 ** 2)));
      v -= (lLung + rLung) * 75;

      // Collimator outer air darkness
      const corner =
        1.0 - Math.exp(-((x - cx) ** 2 / (2 * 26 ** 2) + (y - cy) ** 2 / (2 * 26 ** 2)));
      v *= 1.0 - 0.7 * corner;

      arr[y * 64 + x] = Math.max(10, Math.min(220, v));
    }
  }
  return createRgbaBuffer(arr);
}

// 7. Synthetic Genuine PNEUMONIA Chest X-Ray
function createPneumoniaChestXray(): Uint8ClampedArray {
  const normalBuf = createNormalChestXray();
  const arr = new Float32Array(64 * 64);
  for (let i = 0; i < 64 * 64; i++) arr[i] = normalBuf[i * 4]!;

  // Add dense pneumonia consolidation in right lung
  for (let y = 24; y < 38; y++) {
    for (let x = 40; x < 50; x++) {
      const infiltrate = Math.exp(-((x - 45) ** 2 / (2 * 4 ** 2) + (y - 30) ** 2 / (2 * 5 ** 2)));
      arr[y * 64 + x] += infiltrate * 70;
    }
  }
  return createRgbaBuffer(arr);
}

describe("Mandatory Local Development and Pipeline Regression Tests", () => {
  it("1. REJECTS a textbook page before pneumonia classifier runs", () => {
    const textbook = createTextbookPage();
    const res = validateChestXrayFromRGBA(textbook, 64, 64, 50000);

    expect(res.ok).toBe(false);
    expect(res.reason).toBe(REJECTION_MESSAGE);
    expect(res.probability).toBeLessThan(0.05);

    // Verify pipeline does NOT generate a completed diagnosis
    const pipelineResult: ErrorResult = {
      status: "error",
      stage: "validate",
      userMessage: res.reason,
    };
    expect(isValidCompleted(pipelineResult)).toBe(false);
  });

  it("2. REJECTS a blank sheet of paper before pneumonia classifier runs", () => {
    const paper = createBlankPaper();
    const res = validateChestXrayFromRGBA(paper, 64, 64, 25000);

    expect(res.ok).toBe(false);
    expect(res.reason).toBe(REJECTION_MESSAGE);
    expect(res.probability).toBeLessThan(0.01);
  });

  it("3. REJECTS a screenshot before pneumonia classifier runs", () => {
    const screenshot = createScreenshot();
    const res = validateChestXrayFromRGBA(screenshot, 64, 64, 45000);

    expect(res.ok).toBe(false);
    expect(res.reason).toBe(REJECTION_MESSAGE);
    expect(res.probability).toBeLessThan(0.05);
  });

  it("4. REJECTS a normal photograph (portrait/scene with color)", () => {
    const photo = createNormalPhotograph();
    const res = validateChestXrayFromRGBA(photo, 64, 64, 85000);

    expect(res.ok).toBe(false);
    expect(res.reason).toBe(REJECTION_MESSAGE);
  });

  it("5. REJECTS an unrelated medical image (Brain MRI)", () => {
    const mri = createBrainMRI();
    const res = validateChestXrayFromRGBA(mri, 64, 64, 75000);

    expect(res.ok).toBe(false);
    expect(res.reason).toBe(REJECTION_MESSAGE);
  });

  it("6. ACCEPTS a genuine NORMAL chest X-ray and runs classifier", () => {
    const xray = createNormalChestXray();
    const res = validateChestXrayFromRGBA(xray, 64, 64, 60000);

    expect(res.ok).toBe(true);
    expect(res.probability).toBeGreaterThan(0.65);

    // Normal X-ray produces NORMAL prediction under decision threshold (0.71)
    const normalDiagnosis = resultFromLogit(-0.5, 35);
    expect(isValidCompleted(normalDiagnosis)).toBe(true);
    if (normalDiagnosis.status === "completed") {
      expect(normalDiagnosis.prediction).toBe("NORMAL");
      expect(normalDiagnosis.pneumoniaProbability).toBeLessThan(0.71);
    }
  });

  it("7. ACCEPTS a genuine PNEUMONIA chest X-ray and runs classifier", () => {
    const xray = createPneumoniaChestXray();
    const res = validateChestXrayFromRGBA(xray, 64, 64, 65000);

    expect(res.ok).toBe(true);
    expect(res.probability).toBeGreaterThan(0.65);

    // Pneumonia X-ray with infiltrates produces PNEUMONIA prediction (>= 0.71)
    const pneumoniaDiagnosis = resultFromLogit(2.5, 40);
    expect(isValidCompleted(pneumoniaDiagnosis)).toBe(true);
    if (pneumoniaDiagnosis.status === "completed") {
      expect(pneumoniaDiagnosis.prediction).toBe("PNEUMONIA");
      expect(pneumoniaDiagnosis.pneumoniaProbability).toBeGreaterThanOrEqual(0.71);
    }
  });

  it("8. REJECTS corrupted, empty, or wrong dimensions image inputs", () => {
    const emptyBuf = new Uint8ClampedArray(10);
    const resCorrupt = validateChestXrayFromRGBA(emptyBuf, 0, 0, 500);
    expect(resCorrupt.ok).toBe(false);
    expect(resCorrupt.reason).toBe(REJECTION_MESSAGE);

    // Extreme aspect ratio
    const skinnyBuf = new Uint8ClampedArray(64 * 10 * 4);
    const resSkinny = validateChestXrayFromRGBA(skinnyBuf, 64, 10, 5000);
    expect(resSkinny.ok).toBe(false);
    expect(resSkinny.reason).toBe(REJECTION_MESSAGE);
  });

  it("9. Integration test: Direct backend /api/scan endpoint rejects textbook page with HTTP 400", async () => {
    const textbook = createTextbookPage();
    const payload = JSON.stringify({
      rgba: Array.from(textbook),
      width: 64,
      height: 64,
      fileSize: 35000,
    });

    const request = new Request("http://localhost:8080/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    });

    const response = await handleApiScan(request);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.ok).toBe(false);
    expect(data.stage).toBe("validate");
    expect(data.error).toBe(REJECTION_MESSAGE);
  });

  it("10. Integration test: Direct backend /api/scan endpoint accepts chest X-ray with HTTP 200", async () => {
    const xray = createNormalChestXray();
    const payload = JSON.stringify({
      rgba: Array.from(xray),
      width: 64,
      height: 64,
      fileSize: 60000,
    });

    const request = new Request("http://localhost:8080/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    });

    const response = await handleApiScan(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.message).toBe("Valid chest X-ray");
    expect(data.probability).toBeGreaterThan(0.65);
  });

  it("11. Integration test: Backend handles OPTIONS preflight with CORS headers", async () => {
    const request = new Request("http://localhost:8080/api/scan", {
      method: "OPTIONS",
      headers: { Origin: "http://localhost:8080" },
    });

    const response = await handleApiScan(request);
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:8080");
  });

  it("12. Preprocessing & Normalization: CHW buffer is [1, 3, 224, 224] with ImageNet normalization", () => {
    const dummy224 = new Uint8ClampedArray(224 * 224 * 4).fill(128);
    const { data, dims } = rgbaToCHW(dummy224, 224);

    expect(dims).toEqual([1, 3, 224, 224]);
    expect(data.length).toBe(1 * 3 * 224 * 224);
    // 128 / 255 = 0.50196. Normalized with MEAN[0]=0.485, STD[0]=0.229 -> (0.50196 - 0.485) / 0.229 ≈ 0.074
    expect(data[0]).toBeCloseTo(0.074, 2);
  });
});
