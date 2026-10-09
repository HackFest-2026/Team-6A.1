import modelAsset from "@/assets/pneumoscan_single_cam.onnx.asset.json";

export const MODEL_ID = "pneumoscan-mobilenetv2";
/** User-facing name; MODEL_ID stays the internal identifier. */
export const MODEL_DISPLAY_NAME = "PneumoScan AI";
export const MODEL_VERSION = "1.0";
export const THRESHOLD = 0.71;
export const INPUT_NAME = "input";
export const INPUT_SIZE = 224;
export const MEAN = [0.485, 0.456, 0.406] as const;
export const STD = [0.229, 0.224, 0.225] as const;
export const APP_VERSION = "1.0.0";

export const MODEL_URL: string =
  (import.meta.env['VITE_MODEL_URL'] as string | undefined) || modelAsset.url;

export const DISCLAIMER =
  "This is an AI-assisted screening result and is not a definitive medical diagnosis. Please consult a qualified healthcare professional for medical evaluation.";
export const DATA_LIMITATION =
  "Trained on pediatric chest X-rays from one source (Kermany); may not generalize to adults or other devices.";
export const PERFORMANCE_NOTE =
  "Held-out test (618 images, threshold 0.71): sensitivity 99.0%, specificity 71.9%. About 1 in 4 normal X-rays may be flagged as pneumonia. Screening support only.";
