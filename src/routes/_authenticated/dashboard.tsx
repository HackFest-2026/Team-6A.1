import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  PlusCircle,
  ScanLine,
  Shield,
  Stethoscope,
  Trash2,
  Eye,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ResultView } from "@/components/ResultView";
import { pageHead } from "@/lib/page-head";
import { myAppointmentsQuery, scansQuery } from "@/lib/queries";
import { deleteScan, clearHistory, rowToResult } from "@/lib/scans";
import { downloadScanReport } from "@/lib/pdf";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () =>
    pageHead("Patient Dashboard", "Your recent chest X-ray screenings and upcoming appointments."),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(scansQuery),
      context.queryClient.ensureQueryData(myAppointmentsQuery),
    ]),
  component: DashboardPage,
});

function DashboardPage() {
  const qc = useQueryClient();
  const { data: scans } = useSuspenseQuery(scansQuery);
  const { data: appts } = useSuspenseQuery(myAppointmentsQuery);

  const [filter, setFilter] = useState<"ALL" | "NORMAL" | "PNEUMONIA">("ALL");
  const [expandedScanId, setExpandedScanId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Statistics calculation from real database records
  const totalScans = scans.length;
  const flaggedScans = scans.filter((s) => s.label === "PNEUMONIA").length;
  const normalScans = scans.filter((s) => s.label === "NORMAL").length;
  const upcomingAppts = appts.filter(
    (a) =>
      a.status.toUpperCase() !== "CANCELLED" &&
      a.status.toLowerCase() !== "cancelled" &&
      new Date(a.scheduled_at) > new Date(),
  ).length;

  const latestScan = scans.length > 0 ? scans[0] : null;

  async function handleDeleteScan(id: string) {
    if (!confirm("Are you sure you want to permanently delete this scan record?")) return;
    setIsDeleting(id);
    try {
      await deleteScan(supabase, id);
      qc.invalidateQueries({ queryKey: ["scans"] });
      toast.success("Scan record deleted successfully.");
    } catch {
      toast.error("Failed to delete scan record.");
    } finally {
      setIsDeleting(null);
    }
  }

  async function handleClearAllHistory() {
    if (!confirm("Warning: This will permanently delete ALL your saved scan history. Proceed?"))
      return;
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      await clearHistory(supabase, u.user.id);
      qc.invalidateQueries({ queryKey: ["scans"] });
      toast.success("All scan history cleared.");
    } catch {
      toast.error("Failed to clear scan history.");
    }
  }

  async function handleCancelAppt(id: string) {
    if (!confirm("Cancel this appointment request?")) return;
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status: "CANCELLED" })
        .eq("id", id);
      if (error) throw error;
      toast.success("Appointment cancelled.");
      qc.invalidateQueries({ queryKey: ["appointments"] });
    } catch (err) {
      toast.error("Could not cancel appointment.");
    }
  }

  const filteredScans = scans.filter((s) => {
    if (filter === "ALL") return true;
    return s.label === filter;
  });

  return (
    <div className="space-y-8">
      {/* Welcome & Primary CTA Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Patient Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Overview of your AI chest X-ray screenings and clinical consultations.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild className="gap-2">
            <Link to="/scan">
              <ScanLine className="size-4" />
              New X-Ray Scan
            </Link>
          </Button>
          <Button variant="outline" asChild className="gap-2">
            <Link to="/doctors">
              <Stethoscope className="size-4" />
              Find a Doctor
            </Link>
          </Button>
        </div>
      </div>

      {/* Real Statistics Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Total Screenings</CardDescription>
            <CardTitle className="text-3xl font-display">{totalScans}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground flex items-center gap-1">
            <Activity className="size-3.5 text-primary" />
            Lifetime chest scans recorded
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Normal / Low Risk</CardDescription>
            <CardTitle className="text-3xl font-display text-emerald-600 dark:text-emerald-400">
              {normalScans}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground flex items-center gap-1">
            <CheckCircle2 className="size-3.5 text-emerald-600" />
            Below screening threshold
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Pneumonia Flagged</CardDescription>
            <CardTitle className="text-3xl font-display text-destructive">
              {flaggedScans}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground flex items-center gap-1">
            <AlertTriangle className="size-3.5 text-destructive" />
            Recommended for doctor evaluation
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Active Appointments</CardDescription>
            <CardTitle className="text-3xl font-display text-blue-600 dark:text-blue-400">
              {upcomingAppts}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="size-3.5 text-blue-600" />
            Upcoming doctor consultations
          </CardContent>
        </Card>
      </div>

      {/* Latest Result Spotlight */}
      {latestScan ? (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge variant="outline" className="text-xs bg-background/80 font-medium">
                Latest Screening Result
              </Badge>
              <span className="text-xs text-muted-foreground">
                {new Date(latestScan.created_at).toLocaleString()}
              </span>
            </div>
            <CardTitle className="text-xl mt-2 flex items-center gap-2">
              {latestScan.label === "PNEUMONIA" ? (
                <>
                  <AlertTriangle className="size-5 text-destructive" />
                  <span className="text-destructive">Pneumonia Attention Flagged</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-600 dark:text-emerald-400">
                    No Pneumonia Detected
                  </span>
                </>
              )}
            </CardTitle>
            <CardDescription className="text-foreground/80 text-xs">
              AI screening inference completed on-device in {latestScan.inference_ms ?? 120}ms.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              {latestScan.thumbnail && (
                <img
                  src={latestScan.thumbnail}
                  alt="Chest X-Ray Thumbnail"
                  className="size-20 rounded-lg object-cover border bg-black shrink-0"
                />
              )}
              <div className="flex-1 space-y-2">
                <div className="flex justify-between text-xs font-medium">
                  <span>Confidence / Pneumonia Probability</span>
                  <span>{(latestScan.probability * 100).toFixed(1)}%</span>
                </div>
                <Progress
                  value={latestScan.probability * 100}
                  className={`h-2.5 ${
                    latestScan.label === "PNEUMONIA" ? "[&>div]:bg-destructive" : "[&>div]:bg-primary"
                  }`}
                />
                <p className="text-xs text-muted-foreground">
                  Threshold: 71.0%. Screening model: MobileNetV2 ONNX Runtime.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    downloadScanReport(latestScan).catch(() => toast.error("Report generation failed"))
                  }
                  className="gap-1.5 text-xs bg-background"
                >
                  <Download className="size-3.5" />
                  Download PDF
                </Button>
                {latestScan.label === "PNEUMONIA" && (
                  <Button size="sm" asChild className="gap-1.5 text-xs">
                    <Link to="/doctors">
                      Consult Doctor
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            <ScanLine className="size-10 text-muted-foreground mb-3 opacity-60" />
            <p className="text-base font-semibold">No Chest X-Ray Screenings Yet</p>
            <p className="text-xs text-muted-foreground max-w-sm mt-1">
              Upload a chest X-ray scan to receive an instant on-device screening analysis and
              downloadable PDF report.
            </p>
            <Button asChild className="mt-4 gap-2 text-xs">
              <Link to="/scan">
                <PlusCircle className="size-4" />
                Upload First Scan
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Two Column Layout: Appointments & Recent History */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Appointment Status Card */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <Calendar className="size-5 text-primary" />
              Your Appointments
            </h2>
            <Button variant="ghost" size="sm" asChild className="text-xs">
              <Link to="/appointments">View all</Link>
            </Button>
          </div>

          {appts.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                <p>No appointments booked.</p>
                <Button variant="outline" size="sm" asChild className="mt-3 text-xs">
                  <Link to="/doctors">Browse Verified Doctors</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {appts.slice(0, 4).map((a) => {
                const isConfirmed = a.status.toUpperCase() === "CONFIRMED";
                const isRequested = a.status.toUpperCase() === "REQUESTED";

                return (
                  <Card key={a.id} className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3 text-sm">
                      <div>
                        <p className="font-semibold text-foreground">
                          {a.doctors?.full_name ?? "Medical Doctor"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {a.doctors?.specialization} · {a.doctors?.clinic}
                        </p>
                        <p className="text-xs text-primary font-medium mt-1 flex items-center gap-1">
                          <Clock className="size-3" />
                          {new Date(a.scheduled_at).toLocaleString()}
                        </p>
                        {a.note && (
                          <p className="text-xs bg-muted/40 p-2 rounded mt-2 text-muted-foreground italic">
                            "{a.note}"
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge
                          variant={isConfirmed ? "default" : isRequested ? "secondary" : "outline"}
                          className="text-xs uppercase"
                        >
                          {a.status}
                        </Badge>
                        {(isRequested || isConfirmed) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleCancelAppt(a.id)}
                            className="text-xs h-7 text-muted-foreground hover:text-destructive"
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* Recent Scans List */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <FileText className="size-5 text-primary" />
              Recent Scan History
            </h2>
            <div className="flex gap-1">
              {(["ALL", "NORMAL", "PNEUMONIA"] as const).map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={filter === f ? "default" : "outline"}
                  onClick={() => setFilter(f)}
                  className="text-xs h-7 px-2"
                >
                  {f === "ALL" ? "All" : f}
                </Button>
              ))}
            </div>
          </div>

          {filteredScans.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                <p>No scans match the current filter.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredScans.slice(0, 4).map((s) => (
                <Card key={s.id} className="p-3">
                  <div className="flex items-center gap-3">
                    {s.thumbnail ? (
                      <img
                        src={s.thumbnail}
                        alt="Thumbnail"
                        className="size-12 rounded object-cover border bg-black shrink-0"
                      />
                    ) : (
                      <div className="size-12 rounded border bg-muted flex items-center justify-center text-xs text-muted-foreground shrink-0">
                        X-Ray
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-semibold ${
                            s.label === "PNEUMONIA" ? "text-destructive" : "text-primary"
                          }`}
                        >
                          {s.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({(s.probability * 100).toFixed(0)}%)
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {new Date(s.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setExpandedScanId(expandedScanId === s.id ? null : s.id)
                        }
                        className="h-8 px-2 text-xs"
                      >
                        <Eye className="size-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          downloadScanReport(s).catch(() => toast.error("Report failed"))
                        }
                        className="h-8 px-2 text-xs"
                      >
                        <Download className="size-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isDeleting === s.id}
                        onClick={() => handleDeleteScan(s.id)}
                        className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                  {expandedScanId === s.id && (
                    <div className="mt-3 border-t pt-3">
                      <ResultView result={rowToResult(s)} />
                    </div>
                  )}
                </Card>
              ))}

              {scans.length > 4 && (
                <div className="text-center pt-2">
                  <Button variant="link" size="sm" asChild className="text-xs">
                    <Link to="/history">View all {scans.length} saved scans →</Link>
                  </Button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Data Retention & Privacy Section */}
      <Card className="border-muted bg-muted/20">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground">
          <div className="flex items-start gap-2.5">
            <Shield className="size-4 shrink-0 text-primary mt-0.5" />
            <div>
              <p className="font-semibold text-foreground">Data Privacy & Retention Policy</p>
              <p>
                All image processing runs in-browser. Scans are stored securely under your account.
                You can delete individual scans or clear all saved history at any time.
              </p>
            </div>
          </div>
          {scans.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearAllHistory}
              className="text-xs shrink-0 text-destructive hover:bg-destructive/10"
            >
              Clear All Scan History
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
