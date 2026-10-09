import { INPUT_SIZE } from "./constants";

/** Jet-like colour ramp for a 0..1 attention value. */
function ramp(v: number): [number, number, number] {
  const r = Math.min(1, Math.max(0, 1.5 - Math.abs(4 * v - 3)));
  const g = Math.min(1, Math.max(0, 1.5 - Math.abs(4 * v - 2)));
  const b = Math.min(1, Math.max(0, 1.5 - Math.abs(4 * v - 1)));
  return [r * 255, g * 255, b * 255];
}

/** Overlay the real model attention map on the X-ray (same 224×224 framing the model saw). Returns a JPEG data URL. */
export function renderCamOverlay(img: ImageBitmap, cam: { map: Float32Array; size: number }, size = INPUT_SIZE): string {
  const small = document.createElement("canvas");
  small.width = small.height = cam.size;
  const sctx = small.getContext("2d")!;
  const id = sctx.createImageData(cam.size, cam.size);
  for (let i = 0; i < cam.map.length; i++) {
    const v = cam.map[i]!;
    const [r, g, b] = ramp(v);
    id.data.set([r, g, b, Math.round(v * 170)], i * 4);
  }
  sctx.putImageData(id, 0, 0);
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0, size, size);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(small, 0, 0, size, size);
  return c.toDataURL("image/jpeg", 0.8);
}

/** Share of attention in each lung-field half, from the real map (for factual AI explanation context). */
export function camSummary(cam: { map: Float32Array; size: number }) {
  const n = cam.size; let left = 0, right = 0, upper = 0, lower = 0;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const v = cam.map[y * n + x]!;
    if (x < n / 2) left += v; else right += v;
    if (y < n / 2) upper += v; else lower += v;
  }
  const t = left + right || 1;
  return { imageLeftPct: Math.round((left / t) * 100), imageUpperPct: Math.round((upper / (upper + lower || 1)) * 100) };
}
