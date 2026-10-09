import type { InferenceSession } from "onnxruntime-web";
import { INPUT_NAME, MODEL_URL } from "./constants";
import camWeights from "./cam-weights.json";
import { resultFromLogit, type ScanResult } from "./result";

type Status = { loaded: boolean; lastLoadedAt: Date | null; lastError: string | null };
export const modelStatus: Status = { loaded: false, lastLoadedAt: null, lastError: null };

let sessionPromise: Promise<InferenceSession> | null = null;
let ortMod: typeof import("onnxruntime-web") | null = null;

const CACHE_NAME = "pneumoscan-model-v2";

async function fetchModel(onProgress: (f: number) => void): Promise<ArrayBuffer> {
  try {
    const cache = await caches.open(CACHE_NAME);
    const hit = await cache.match(MODEL_URL);
    if (hit) { onProgress(1); return await hit.arrayBuffer(); }
  } catch { /* cache unavailable */ }
  const res = await fetch(MODEL_URL);
  if (!res.ok || !res.body) throw new Error(`Model download failed (${res.status})`);
  const total = Number(res.headers.get("content-length")) || 0;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); got += value.length;
    if (total) onProgress(Math.min(0.99, got / total));
  }
  const buf = new Uint8Array(got);
  let o = 0; for (const c of chunks) { buf.set(c, o); o += c.length; }
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(MODEL_URL, new Response(buf.slice().buffer, { headers: { "content-type": "application/octet-stream" } }));
  } catch { /* ignore */ }
  onProgress(1);
  return buf.buffer;
}

export function loadModel(onProgress: (f: number) => void = () => {}): Promise<InferenceSession> {
  if (sessionPromise) { if (modelStatus.loaded) onProgress(1); return sessionPromise; }
  sessionPromise = (async () => {
    const ort = await import("onnxruntime-web");
    ortMod = ort;
    ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ort.env.versions.web}/dist/`;
    ort.env.wasm.numThreads = 1;
    const buf = await fetchModel(onProgress);
    const s = await ort.InferenceSession.create(new Uint8Array(buf), { executionProviders: ["wasm"] });
    if (!s.inputNames.includes(INPUT_NAME)) throw new Error(`Model input "${INPUT_NAME}" not found`);
    modelStatus.loaded = true;
    modelStatus.lastLoadedAt = new Date();
    modelStatus.lastError = null;
    return s;
  })().catch((e) => {
    sessionPromise = null;
    modelStatus.loaded = false;
    modelStatus.lastError = e instanceof Error ? e.message : String(e);
    throw e;
  });
  return sessionPromise;
}

export async function runInference(data: Float32Array, dims: number[]): Promise<ScanResult> {
  return (await runInferenceWithCam(data, dims)).result;
}

/** Class activation map from the real final feature map × classifier weights (equals Grad-CAM for GAP+linear heads). */
function computeCam(feat: Float32Array, fdims: readonly number[]): { map: Float32Array; size: number } | null {
  const [, c, h, w] = fdims as number[];
  if (!c || !h || !w || c !== camWeights.weights.length) return null;
  const hw = h * w, map = new Float32Array(hw);
  for (let k = 0; k < c; k++) { const wk = camWeights.weights[k]!; for (let i = 0; i < hw; i++) map[i]! += wk * feat[k * hw + i]!; }
  let max = 0; for (let i = 0; i < hw; i++) { map[i] = Math.max(0, map[i]!); max = Math.max(max, map[i]!); }
  if (max > 0) for (let i = 0; i < hw; i++) map[i]! /= max;
  return { map, size: h };
}

export async function runInferenceWithCam(data: Float32Array, dims: number[]): Promise<{ result: ScanResult; cam: { map: Float32Array; size: number } | null }> {
  let session: InferenceSession;
  try { session = await loadModel(); } catch { return { result: { status: "model_unavailable" }, cam: null }; }
  try {
    const ort = ortMod!;
    const t0 = performance.now();
    const out = await session.run({ [INPUT_NAME]: new ort.Tensor("float32", data, dims) });
    const ms = Math.round(performance.now() - t0);
    const tensor = out["logit"] ?? out[session.outputNames[0] ?? ""];
    if (!tensor) return { result: { status: "error", stage: "inference", userMessage: "Model produced no output." }, cam: null };
    const arr = tensor.data as Float32Array;
    if (arr.length !== 1) return { result: { status: "error", stage: "inference", userMessage: "Unexpected model output shape." }, cam: null };
    const f = out[camWeights.feature];
    const cam = f ? computeCam(f.data as Float32Array, f.dims) : null;
    return { result: resultFromLogit(arr[0] ?? NaN, ms), cam };
  } catch {
    return { result: { status: "error", stage: "inference", userMessage: "The scan could not be processed." }, cam: null };
  }
}
