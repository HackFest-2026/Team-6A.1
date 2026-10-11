import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { validateChestXrayFromRGBA, REJECTION_MESSAGE } from "@/lib/classifier/relevance";
import { isValidCompleted, type CompletedResult } from "@/lib/classifier/result";

const ScanInput = z.object({
  result: z.object({
    status: z.literal("completed"),
    prediction: z.enum(["NORMAL", "PNEUMONIA"]),
    pneumoniaProbability: z.number().min(0).max(1),
    model: z.object({ id: z.string(), version: z.string() }),
    inferenceMs: z.number(),
  }),
  thumbnail: z.string(),
  gradcam: z.string().nullable().optional(),
  rgbaPreview: z.array(z.number()).min(64 * 64 * 4), // 64x64 RGBA thumbnail for backend validation
  originalWidth: z.number().positive(),
  originalHeight: z.number().positive(),
  fileSize: z.number().positive(),
});

export const validateAndSaveScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ScanInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1. Mandatory Backend Image Validation Gate
    const rgba = new Uint8ClampedArray(data.rgbaPreview);
    const validation = validateChestXrayFromRGBA(rgba, 64, 64, data.fileSize);
    if (!validation.ok) {
      return {
        ok: false as const,
        stage: "validate" as const,
        error: REJECTION_MESSAGE,
      };
    }

    // 2. Result structure validation
    if (!isValidCompleted(data.result as CompletedResult)) {
      return {
        ok: false as const,
        stage: "save" as const,
        error: "Invalid scan result payload.",
      };
    }

    // 3. Database persistence only for validated chest X-rays
    const { data: saved, error } = await supabase
      .from("scans")
      .insert({
        user_id: userId,
        thumbnail: data.thumbnail,
        gradcam: data.gradcam ?? null,
        label: data.result.prediction,
        probability: data.result.pneumoniaProbability,
        model_id: data.result.model.id,
        model_version: data.result.model.version,
        inference_ms: data.result.inferenceMs,
      })
      .select("id")
      .single();

    if (error) {
      return {
        ok: false as const,
        stage: "save" as const,
        error: error.message,
      };
    }

    return {
      ok: true as const,
      id: saved.id,
    };
  });
