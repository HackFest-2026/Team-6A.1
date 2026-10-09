import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Input = z.object({
  scanId: z.string().uuid(),
  cam: z.object({ imageLeftPct: z.number().min(0).max(100), imageUpperPct: z.number().min(0).max(100) }).nullable(),
});

export const explainScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: premium, error: pe } = await supabase.rpc("is_premium", { _user_id: userId });
    if (pe || !premium) return { ok: false as const, error: "AI explanation is a Premium feature." };
    const { data: scan, error } = await supabase.from("scans").select("label, probability, model_version, created_at").eq("id", data.scanId).maybeSingle();
    if (error || !scan) return { ok: false as const, error: "Scan not found." };
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { ok: false as const, error: "AI service is not configured." };

    const facts = [
      `Screening label from the trained model: ${scan.label}`,
      `Model pneumonia probability: ${(scan.probability * 100).toFixed(1)}% (decision threshold 71%)`,
      `Model: PneumoScan AI classifier v${scan.model_version}, trained on pediatric chest X-rays (Kermany dataset)`,
      `Validation: sensitivity 99.0%, specificity 71.9% — about 1 in 4 normal X-rays may be flagged`,
      data.cam
        ? `Attention map: ${data.cam.imageLeftPct}% of model attention on the image-left half, ${data.cam.imageUpperPct}% on the upper half. This is AI attention, not lesion localization.`
        : "No attention map available for this scan.",
    ].join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key, Authorization: `Bearer ${key}`, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "low" },
        instructions:
          "You explain an AI chest X-ray screening result to a patient in plain language, under 160 words. Use ONLY the facts given. Never invent findings, anatomy, severity, diagnoses or treatment. Do not describe the image. State clearly that this is AI-assisted screening, not a diagnosis, and recommend consulting a qualified doctor.",
        input: facts,
      }),
    });
    if (!res.ok || !res.body) {
      const msg = res.status === 402 ? "AI credits are exhausted." : res.status === 429 ? "AI is busy, try again shortly." : "AI explanation unavailable right now.";
      return { ok: false as const, error: msg };
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "", text = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line.startsWith("data:")) continue;
        try {
          const ev = JSON.parse(line.slice(5));
          if (ev.type === "response.output_text.delta") text += ev.delta;
        } catch { /* ignore keepalives */ }
      }
    }
    if (!text.trim()) return { ok: false as const, error: "AI returned no explanation." };
    return { ok: true as const, text: text.trim() };
  });
