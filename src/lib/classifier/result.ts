import { MODEL_ID, MODEL_VERSION, THRESHOLD } from "./constants";

export type Prediction = "NORMAL" | "PNEUMONIA";

export type CompletedResult = {
  status: "completed";
  prediction: Prediction;
  pneumoniaProbability: number;
  model: { id: string; version: string };
  inferenceMs: number;
};
export type ModelUnavailableResult = { status: "model_unavailable" };
export type ErrorResult = {
  status: "error";
  stage: "decode" | "quality" | "preprocess" | "inference" | "save";
  userMessage: string;
};
export type ScanResult = CompletedResult | ModelUnavailableResult | ErrorResult;

export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export function labelFor(p: number): Prediction {
  return p >= THRESHOLD ? "PNEUMONIA" : "NORMAL";
}

/** Only a result passing this guard may ever show a label or probability. */
export function isValidCompleted(r: unknown): r is CompletedResult {
  if (!r || typeof r !== "object") return false;
  const c = r as Partial<CompletedResult>;
  if (c.status !== "completed") return false;
  const p = c.pneumoniaProbability;
  if (typeof p !== "number" || !Number.isFinite(p) || p < 0 || p > 1) return false;
  if (!c.model || typeof c.model.id !== "string" || !c.model.id) return false;
  if (typeof c.model.version !== "string" || !c.model.version) return false;
  if (c.prediction !== "NORMAL" && c.prediction !== "PNEUMONIA") return false;
  if (c.prediction !== labelFor(p)) return false;
  return true;
}

export function resultFromLogit(logit: number, inferenceMs: number): ScanResult {
  if (!Number.isFinite(logit)) {
    return { status: "error", stage: "inference", userMessage: "The model returned an invalid output." };
  }
  const p = sigmoid(logit);
  const r: CompletedResult = {
    status: "completed",
    prediction: labelFor(p),
    pneumoniaProbability: p,
    model: { id: MODEL_ID, version: MODEL_VERSION },
    inferenceMs,
  };
  return isValidCompleted(r)
    ? r
    : { status: "error", stage: "inference", userMessage: "The model returned an invalid output." };
}
