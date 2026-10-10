import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ResultView } from "@/components/ResultView";
import { ExplainButton, GradcamImage } from "@/components/ExplainButton";
import { pageHead } from "@/lib/page-head";
import { loadModel, runInferenceWithCam } from "@/lib/classifier/model";
import { decodeImage, makeThumbnail, resizeToRGBA, rgbaToCHW } from "@/lib/classifier/preprocess";
import { measureQuality } from "@/lib/classifier/quality";
import { isValidCompleted, type ScanResult } from "@/lib/classifier/result";
import { camSummary, renderCamOverlay } from "@/lib/classifier/gradcam";
import { saveScan } from "@/lib/scans";
import { usePremium } from "@/lib/premium";

export const Route = createFileRoute("/_authenticated/scan")({
  head: () => pageHead("Scan X-Ray", "Upload a chest X-ray and get an AI-assisted pneumonia screening result."),
  component: ScanPage,
});

type Item = {
  key: string; name: string; preview: string | null; warnings: string[];
  result: ScanResult | null; savedId: string | null; gradcam: string | null;
  /** Real heatmap kept only in this browser until the user unlocks it. */
  locked: string | null;
  cam: { imageLeftPct: number; imageUpperPct: number } | null;
};

/** Each file is decoded, run and saved on its own — no result is ever shared between images. */
async function processOne(file: File, premium: boolean, userId: string | null): Promise<Omit<Item, "key" | "name">> {
  let img: ImageBitmap;
  try { img = await decodeImage(file); } catch {
    return { preview: null, warnings: [], result: { status: "error", stage: "decode", userMessage: "This file could not be read as an image." }, savedId: null, gradcam: null, locked: null, cam: null };
  }
  const preview = URL.createObjectURL(file);
  const warnings = measureQuality(img).warnings;
  const thumb = makeThumbnail(img);
  const { data, dims } = rgbaToCHW(resizeToRGBA(img));
  const { result, cam } = await runInferenceWithCam(data, dims);
  const overlay = cam && isValidCompleted(result) ? renderCamOverlay(img, cam) : null;
  const gradcam = premium ? overlay : null;
  let savedId: string | null = null;
  if (isValidCompleted(result) && userId) {
    try { savedId = await saveScan(supabase, userId, result, thumb, gradcam); }
    catch { toast.error(`${file.name}: result shown but not saved.`); }
  }
  return { preview, warnings, result, savedId, gradcam, locked: premium ? null : overlay, cam: premium && cam ? camSummary(cam) : null };
}

function ScanPage() {
  const qc = useQueryClient();
  const { isPremium } = usePremium();
  const [modelProgress, setModelProgress] = useState(0);
  const [modelReady, setModelReady] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [done, setDone] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadModel(setModelProgress).then(() => setModelReady(true)).catch(() => setModelReady(false));
  }, []);

  async function onFiles(list: File[]) {
    if (!list.length) return;
    if (list.length > 1 && !isPremium) { toast.error("Bulk scanning is a Premium feature. Scanning the first image only."); list = list.slice(0, 1); }
    list = list.slice(0, 20);
    setBusy(true); setDone(0);
    const base = list.map((f, i) => ({ key: `${Date.now()}-${i}`, name: f.name, preview: null, warnings: [], result: null, savedId: null, gradcam: null, locked: null, cam: null }));
    setItems(base);
    const { data: u } = await supabase.auth.getUser();
    for (let i = 0; i < list.length; i++) {
      const r = await processOne(list[i]!, isPremium, u.user?.id ?? null);
      setItems((prev) => prev.map((it, j) => (j === i ? { ...it, ...r } : it)));
      setDone(i + 1);
    }
    qc.invalidateQueries({ queryKey: ["scans"] });
    setBusy(false);
  }

  async function unlock(it: Item) {
    const { error } = await supabase.rpc("unlock_gradcam_demo", { _scan_id: it.savedId!, _gradcam: it.locked! });
    if (error) { toast.error(error.message); return; }
    toast.success("Grad-CAM unlocked for this image (demo — no payment taken)");
    setItems((prev) => prev.map((x) => (x.key === it.key ? { ...x, gradcam: x.locked, locked: null } : x)));
    qc.invalidateQueries({ queryKey: ["scans"] });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl">Scan X-Ray</h1>
      {!modelReady && (
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>Loading screening model… {Math.round(modelProgress * 100)}%</p>
          <Progress value={modelProgress * 100} />
        </div>
      )}
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed bg-card p-10 text-center hover:bg-muted">
        <Upload className="size-6 text-primary" />
        <span className="font-medium">{busy ? `Analysing ${done}/${items.length}…` : isPremium ? "Choose one or more chest X-rays" : "Choose a chest X-ray image"}</span>
        <span className="text-xs text-muted-foreground">JPG or PNG, frontal chest view{isPremium ? " · up to 20 at once" : ""}</span>
        <input type="file" accept="image/*" multiple={isPremium} className="hidden" disabled={busy}
          onChange={(e) => { const f = Array.from(e.target.files ?? []); onFiles(f); e.target.value = ""; }} />
      </label>
      {busy && items.length > 1 && <Progress value={(done / items.length) * 100} />}
      <div className="space-y-8">
        {items.map((it) => (
          <section key={it.key} className="space-y-3">
            {items.length > 1 && <p className="font-mono text-xs text-muted-foreground">{it.name}</p>}
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                {it.preview && <img src={it.preview} alt="Uploaded X-ray" className="w-full rounded-lg border object-contain" />}
                {it.gradcam && <GradcamImage src={it.gradcam} />}
                {!it.gradcam && it.locked && it.savedId && (
                  <div className="rounded-xl border bg-card p-4 text-sm">
                    <p className="font-medium">See where the model looked (Grad-CAM)</p>
                    <p className="mt-1 text-muted-foreground">₹9 for this image, or ₹59/month for full Premium. Online payment isn't on yet — unlock in demo mode, no money taken.</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => unlock(it)}>Unlock this image (demo)</Button>
                      <Button size="sm" variant="outline" asChild><Link to="/premium">See Premium</Link></Button>
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-3">
                {it.warnings.length > 0 && <ul className="rounded-md border bg-muted p-3 text-sm">{it.warnings.map((w) => <li key={w}>⚠ {w}</li>)}</ul>}
                {it.result ? <ResultView result={it.result} /> : <p className="text-sm text-muted-foreground">Waiting…</p>}
                {it.savedId && isPremium && <ExplainButton scanId={it.savedId} cam={it.cam} />}
                {it.savedId && <p className="text-sm">Saved. <Link to="/history" className="text-primary underline">View history</Link> · <Link to="/doctors" className="text-primary underline">Book a doctor</Link></p>}
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
