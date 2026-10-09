import { CircleOff, TriangleAlert } from "lucide-react";
import { isValidCompleted, type ScanResult } from "@/lib/classifier/result";
import { MODEL_DISPLAY_NAME, THRESHOLD } from "@/lib/classifier/constants";
import { Disclaimers } from "./Disclaimers";

export function ResultView({ result }: { result: ScanResult }) {
  if (isValidCompleted(result)) {
    const flagged = result.prediction === "PNEUMONIA";
    return (
      <div className="space-y-4" data-testid="result-completed">
        <div className={`rounded-lg p-5 ${flagged ? "bg-flag text-flag-foreground" : "bg-success text-success-foreground"}`}>
          <p className="text-xs uppercase tracking-widest opacity-80">Screening result</p>
          <p className="mt-1 font-display text-3xl" data-testid="result-label">
            {flagged ? "Pneumonia pattern flagged" : "No pneumonia pattern flagged"}
          </p>
          <p className="mt-2 font-mono text-sm" data-testid="result-probability">
            Model output (pneumonia probability): {(result.pneumoniaProbability * 100).toFixed(1)}% · threshold {THRESHOLD}
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-3 font-mono text-xs text-muted-foreground">
          <div><dt>Model</dt><dd className="text-foreground">{MODEL_DISPLAY_NAME}</dd></div>
          <div><dt>Version</dt><dd className="text-foreground">{result.model.version}</dd></div>
          <div><dt>Inference</dt><dd className="text-foreground">{result.inferenceMs} ms</dd></div>
        </dl>
        <Disclaimers />
      </div>
    );
  }
  if (result.status === "model_unavailable") {
    return (
      <div className="space-y-4" data-testid="result-unavailable">
        <div className="flex gap-3 rounded-lg border bg-muted p-5">
          <CircleOff className="size-5 shrink-0 text-muted-foreground" />
          <div>
            <p className="font-medium">Classification unavailable</p>
            <p className="text-sm text-muted-foreground">The screening model could not be loaded. No result was produced.</p>
          </div>
        </div>
        <Disclaimers showPerformance={false} />
      </div>
    );
  }
  const msg = result.status === "error" ? result.userMessage : "The result could not be verified.";
  return (
    <div className="space-y-4" data-testid="result-error">
      <div className="flex gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-5">
        <TriangleAlert className="size-5 shrink-0 text-destructive" />
        <div>
          <p className="font-medium">No result</p>
          <p className="text-sm text-muted-foreground">{msg}</p>
        </div>
      </div>
      <Disclaimers showPerformance={false} />
    </div>
  );
}
