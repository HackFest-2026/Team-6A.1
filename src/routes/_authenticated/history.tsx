import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ResultView } from "@/components/ResultView";
import { pageHead } from "@/lib/page-head";
import { scansQuery } from "@/lib/queries";
import { deleteScan, rowToResult } from "@/lib/scans";
import { downloadScanReport } from "@/lib/pdf";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => pageHead("Scan history", "All your saved chest X-ray screening results."),
  loader: ({ context }) => context.queryClient.ensureQueryData(scansQuery),
  component: HistoryPage,
});

function HistoryPage() {
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(scansQuery);
  const [filter, setFilter] = useState<"ALL" | "NORMAL" | "PNEUMONIA">("ALL");
  const [open, setOpen] = useState<string | null>(null);
  const rows = data.filter((r) => filter === "ALL" || r.label === filter);
  async function del(id: string) {
    if (!confirm("Delete this scan?")) return;
    try { await deleteScan(supabase, id); qc.invalidateQueries({ queryKey: ["scans"] }); toast.success("Deleted"); }
    catch { toast.error("Could not delete"); }
  }
  return (
    <div className="space-y-6">
      <h1 className="text-3xl">Scan history</h1>
      <div className="flex gap-2">
        {(["ALL", "NORMAL", "PNEUMONIA"] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>{f === "ALL" ? "All" : f}</Button>
        ))}
      </div>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">No scans.</p> : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-center gap-4">
                {r.thumbnail && <img src={r.thumbnail} alt="" className="size-14 rounded object-cover" />}
                <div className="flex-1">
                  <p className="font-medium">{r.label}</p>
                  <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setOpen(open === r.id ? null : r.id)}>{open === r.id ? "Hide" : "Open"}</Button>
                <Button size="sm" variant="outline" onClick={() => downloadScanReport(r).catch(() => toast.error("Report failed"))}>PDF</Button>
                <Button size="sm" variant="ghost" onClick={() => del(r.id)}>Delete</Button>
              </div>
              {open === r.id && <div className="mt-4"><ResultView result={rowToResult(r)} /></div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
