import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { isValidCompleted, type CompletedResult, type ScanResult } from "@/lib/classifier/result";

export type ScanRow = Database["public"]["Tables"]["scans"]["Row"];
type Client = SupabaseClient<Database>;

export function rowToResult(row: ScanRow): ScanResult {
  const r = {
    status: "completed" as const,
    prediction: row.label as CompletedResult["prediction"],
    pneumoniaProbability: row.probability,
    model: { id: row.model_id, version: row.model_version },
    inferenceMs: row.inference_ms ?? 0,
  };
  return isValidCompleted(r) ? r : { status: "error", stage: "save", userMessage: "This saved record failed validation." };
}

export async function saveScan(client: Client, userId: string, result: CompletedResult, thumbnail: string) {
  if (!isValidCompleted(result)) throw new Error("Refusing to save an invalid result");
  const { data, error } = await client.from("scans").insert({
    user_id: userId,
    thumbnail,
    label: result.prediction,
    probability: result.pneumoniaProbability,
    model_id: result.model.id,
    model_version: result.model.version,
    inference_ms: result.inferenceMs,
  }).select("id").single();
  if (error) throw error;
  return data.id;
}

export async function listScans(client: Client) {
  const { data, error } = await client.from("scans").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function deleteScan(client: Client, id: string) {
  const { error } = await client.from("scans").delete().eq("id", id);
  if (error) throw error;
}

export async function clearHistory(client: Client, userId: string) {
  const { error } = await client.from("scans").delete().eq("user_id", userId);
  if (error) throw error;
}
