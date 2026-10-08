import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pageHead } from "@/lib/page-head";
import { scansQuery } from "@/lib/queries";
import { downloadScanReport } from "@/lib/pdf";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => pageHead("Reports", "Download PDF screening reports for your chest X-ray scans."),
  loader: ({ context }) => context.queryClient.ensureQueryData(scansQuery),
  component: ReportsPage,
});

function ReportsPage() {
  const { data } = useSuspenseQuery(scansQuery);
  return (
    <div className="space-y-6">
      <h1 className="text-3xl">Reports</h1>
      {data.length === 0 ? <p className="text-sm text-muted-foreground">No scans yet — run a scan to generate a report.</p> : (
        <ul className="divide-y rounded-xl border bg-card">
          {data.map((r) => (
            <li key={r.id} className="flex items-center gap-4 p-4">
              <FileText className="size-5 text-primary" />
              <div className="flex-1"><p className="text-sm font-medium">Report · {r.label}</p><p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p></div>
              <Button size="sm" onClick={() => downloadScanReport(r).catch(() => toast.error("Report could not be generated"))}>Download PDF</Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
