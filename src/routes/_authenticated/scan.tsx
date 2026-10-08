import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ResultView } from "@/components/ResultView";
import { pageHead } from "@/lib/page-head";
import { loadModel, runInference } from "@/lib/classifier/model";
import { decodeImage, makeThumbnail, resizeToRGBA, rgbaToCHW } from "@/lib/classifier/preprocess";
import { measureQuality } from "@/lib/classifier/quality";
import { isValidCompleted, type ScanResult } from "@/lib/classifier/result";
import { saveScan } from "@/lib/scans";

export const Route = createFileRoute("/_authenticated/scan")({
  head: () => pageHead("Scan X-Ray", "Upload a chest X-ray and get an AI-assisted pneumonia screening result."),
  component: ScanPage,
});

function ScanPage() {
  const qc = useQueryClient();
  const [modelProgress, setModelProgress] = useState(0);
  const [modelReady, setModelReady] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    loadModel(setModelProgress).then(() => setModelReady(true)).catch(() => setModelReady(false));
  }, []);

  async function onFile(file: File) {
    setResult(null); setSavedId(null); setWarnings([]); setBusy(true);
    try {
      let img: ImageBitmap;
      try { img = await decodeImage(file); } catch {
        setResult({ status: "error", stage: "decode", userMessage: "This file could not be read as an image." }); return;
      }
      setPreview(URL.createObjectURL(file));
      setWarnings(measureQuality(img).warnings);
      const thumb = makeThumbnail(img);
      const { data, dims } = rgbaToCHW(resizeToRGBA(img));
      const r = await runInference(data, dims);
      setResult(r);
      if (isValidCompleted(r)) {
        const { data: u } = await supabase.auth.getUser();
        if (u.user) {
          try {
            const id = await saveScan(supabase, u.user.id, r, thumb);
            setSavedId(id); qc.invalidateQueries({ queryKey: ["scans"] });
          } catch { toast.error("Result shown but could not be saved to history."); }
        }
      }
    } finally { setBusy(false); }
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
        <span className="font-medium">{busy ? "Analysing…" : "Choose a chest X-ray image"}</span>
        <span className="text-xs text-muted-foreground">JPG or PNG, frontal chest view</span>
        <input type="file" accept="image/*" className="hidden" disabled={busy}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
      </label>
      <div className="grid gap-6 md:grid-cols-2">
        {preview && <img src={preview} alt="Uploaded X-ray" className="w-full rounded-lg border object-contain" />}
        <div className="space-y-3">
          {warnings.length > 0 && (
            <ul className="rounded-md border bg-muted p-3 text-sm">{warnings.map((w) => <li key={w}>⚠ {w}</li>)}</ul>
          )}
          {result && <ResultView result={result} />}
          {savedId && <p className="text-sm">Saved. <Link to="/history" className="text-primary underline">View history</Link> · <Link to="/doctors" className="text-primary underline">Book a doctor</Link></p>}
        </div>
      </div>
    </div>
  );
}
