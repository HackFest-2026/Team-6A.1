# PneumoScan AI

AI-assisted chest X-ray **screening** (not diagnosis) for pneumonia.

## Stack
TanStack Start (React 19, Vite), Tailwind CSS v4, Lovable Cloud (database, auth, server functions), onnxruntime-web, jsPDF.

## Model
- MobileNetV2 binary classifier exported to ONNX, run entirely in the browser (images never leave the device; only results are saved).
- Training data: Kermany pediatric chest X-ray dataset — may not generalize to adults or other devices.
- Threshold 0.71. Held-out test (618 images): sensitivity 99.0%, specificity 71.9%.
- Grad-CAM: class activation map from the model's real final feature map × classifier weights. It shows model attention, not lesion locations.

## Plans
- Free: single scan, history, basic PDF, doctor search, appointments.
- Grad-CAM for one image: ₹9. Premium: ₹59/month (Grad-CAM, AI explanation, bulk scans, advanced PDF, etc.).
- Real payments are **not enabled yet**. Premium Demo and demo Grad-CAM unlocks are clearly labelled and never stored as paid. Entitlements are enforced in the database.

## Auth
Email sign-in link (lands on `/auth-callback`, then dashboard), email + password, Google.

## Doctors & admin
Doctors apply from the app; status stays PENDING until an admin verifies it at `/admin`. Only admins can change status (database trigger); rejection needs a reason; reviewer and time are recorded. Existing admins can grant admin to another account from `/admin`. The first admin is assigned directly in the database by the project owner — no admin credentials live in the code.

## Setup
```sh
bun install
bun run dev
```
Environment: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (set automatically by Lovable Cloud). Optional `VITE_MODEL_URL`.

## Limitations
Screening support only. Always consult a qualified healthcare professional.
