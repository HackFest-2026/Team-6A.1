import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { explainScan } from "@/lib/ai.functions";

export function ExplainButton({ scanId, cam }: { scanId: string; cam: { imageLeftPct: number; imageUpperPct: number } | null }) {
  const fn = useServerFn(explainScan);
  const [text, setText] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true); setErr(null);
    try { const r = await fn({ data: { scanId, cam } }); if (r.ok) setText(r.text); else setErr(r.error); }
    catch { setErr("AI explanation unavailable right now."); }
    finally { setBusy(false); }
  }
  return (
    <div className="space-y-2">
      {!text && <Button size="sm" variant="outline" onClick={go} disabled={busy}>{busy ? "Explaining…" : "AI explanation"}</Button>}
      {err && <p className="text-sm text-destructive">{err}</p>}
      {text && (
        <div className="rounded-lg border bg-muted p-4 text-sm">
          <p className="mb-1 text-xs uppercase tracking-widest text-muted-foreground">AI explanation · based only on the model output</p>
          <p className="whitespace-pre-line">{text}</p>
        </div>
      )}
    </div>
  );
}

export function GradcamImage({ src }: { src: string }) {
  return (
    <figure className="space-y-1">
      <img src={src} alt="AI attention heatmap" className="w-full max-w-xs rounded-lg border" />
      <figcaption className="text-xs text-muted-foreground">Grad-CAM: AI attention visualization — shows where the model focused, not lesion localization.</figcaption>
    </figure>
  );
}
