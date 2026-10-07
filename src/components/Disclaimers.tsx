import { AlertTriangle, Info } from "lucide-react";
import { DATA_LIMITATION, DISCLAIMER, PERFORMANCE_NOTE } from "@/lib/classifier/constants";

export function Disclaimers({ showPerformance = true }: { showPerformance?: boolean }) {
  return (
    <div className="space-y-2 text-sm">
      <p className="flex gap-2 rounded-md border border-warning/50 bg-warning/15 p-3 text-warning-foreground">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <span>{DISCLAIMER}</span>
      </p>
      <p className="flex gap-2 rounded-md bg-muted p-3 text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" />
        <span>{DATA_LIMITATION}</span>
      </p>
      {showPerformance && (
        <p className="flex gap-2 rounded-md bg-muted p-3 text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" />
          <span>{PERFORMANCE_NOTE}</span>
        </p>
      )}
    </div>
  );
}
