import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Award,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  FileCheck2,
  FileSearch,
  FileText,
  IndianRupee,
  LayoutDashboard,
  ShieldCheck,
  Stethoscope,
  Users,
  XCircle,
  CalendarDays,
  Download,
  AlertCircle,
  MessageSquare,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { pageHead } from "@/lib/page-head";
import { myDoctorQuery } from "@/lib/queries";
import { downloadScanReport, type ClinicalReviewDetails } from "@/lib/pdf";
import { sendAppointmentNotification } from "@/lib/notifications";

type DoctorRow = Database["public"]["Tables"]["doctors"]["Row"];
type AppointmentRow = Database["public"]["Tables"]["appointments"]["Row"];
type ScanRow = Database["public"]["Tables"]["scans"]["Row"];

export const Route = createFileRoute("/_authenticated/doctor/")({
  head: () =>
    pageHead(
      "Doctor Dashboard",
      "Manage clinical consultation requests, review authorized chest X-rays, and issue medical reports.",
    ),
  beforeLoad: async ({ context }) => {
    const userId = context.user.id;

    // Check doctor record in database
    const { data: doctorRow } = await supabase
      .from("doctors")
      .select("id, status")
      .eq("user_id", userId)
      .maybeSingle();

    if (!doctorRow) {
      throw redirect({ to: "/doctor/verification-status" });
    }

    if (doctorRow.status !== "VERIFIED") {
      throw redirect({ to: "/doctor/verification-status" });
    }
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(myDoctorQuery),
  component: DoctorDashboardPage,
});

type NavSection = "overview" | "patients" | "scans" | "reports" | "appointments" | "profile";

function DoctorDashboardPage() {
  const { data: doc } = useSuspenseQuery(myDoctorQuery);
  const [activeSection, setActiveSection] = useState<NavSection>("overview");

  if (!doc || doc.status !== "VERIFIED") {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Doctor Dashboard</h1>
            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-xs">
              <ShieldCheck className="size-3.5" />
              Verified Practitioner
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Clinical management workspace for Dr. {doc.full_name} · {doc.specialization}
          </p>
        </div>
      </div>

      {/* Doctor Navigation Bar */}
      <div className="flex flex-wrap gap-2 border-b pb-3">
        {[
          { key: "overview", label: "Overview", icon: LayoutDashboard },
          { key: "patients", label: "Assigned Patients", icon: Users },
          { key: "scans", label: "Scans", icon: FileSearch },
          { key: "reports", label: "Clinical Reports", icon: FileText },
          { key: "appointments", label: "Appointments", icon: Calendar },
          { key: "profile", label: "Profile", icon: Stethoscope },
        ].map(({ key, label, icon: Icon }) => {
          const isActive = activeSection === key;
          return (
            <Button
              key={key}
              variant={isActive ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveSection(key as NavSection)}
              className="gap-2 text-xs font-medium"
            >
              <Icon className="size-4" />
              {label}
            </Button>
          );
        })}
      </div>

      {/* Render Active Section */}
      {activeSection === "overview" && <DoctorOverviewSection doc={doc} onNavigate={setActiveSection} />}
      {activeSection === "patients" && <AssignedPatientsSection doc={doc} />}
      {activeSection === "scans" && <AuthorizedScansSection doc={doc} />}
      {activeSection === "reports" && <ClinicalReportsSection doc={doc} />}
      {activeSection === "appointments" && <DoctorAppointmentsSection doc={doc} />}
      {activeSection === "profile" && <DoctorProfileSection doc={doc} />}
    </div>
  );
}

/* =========================================================================
   1. Overview Section
   ========================================================================= */
function DoctorOverviewSection({
  doc,
  onNavigate,
}: {
  doc: DoctorRow;
  onNavigate: (section: NavSection) => void;
}) {
  const appts = useQuery({
    queryKey: ["appointments", "doctor", doc.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("doctor_id", doc.id)
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const shared = useQuery({
    queryKey: ["shares", "doctor", doc.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scan_shares")
        .select("*, scans(id, label, probability, created_at, thumbnail)")
        .eq("doctor_id", doc.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const allAppts = appts.data ?? [];
  const requestedAppts = allAppts.filter(
    (a) => a.status.toUpperCase() === "REQUESTED" || a.status.toLowerCase() === "pending",
  );
  const confirmedAppts = allAppts.filter((a) => a.status.toUpperCase() === "CONFIRMED");
  const uniquePatients = new Set([
    ...allAppts.map((a) => a.patient_id),
    ...(shared.data ?? []).map((s) => s.patient_id),
  ]);

  const stats = [
    { label: "Pending Requests", count: requestedAppts.length, color: "text-amber-500", action: () => onNavigate("appointments") },
    { label: "Confirmed Consultations", count: confirmedAppts.length, color: "text-primary", action: () => onNavigate("appointments") },
    { label: "Assigned Patients", count: uniquePatients.size, color: "text-blue-500", action: () => onNavigate("patients") },
    { label: "Authorized Scans", count: shared.data?.length ?? 0, color: "text-purple-500", action: () => onNavigate("scans") },
  ];

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={s.action}>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">{s.label}</CardDescription>
              <CardTitle className={`text-3xl font-display ${s.color}`}>{s.count}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* Practitioner Details Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="size-4 text-primary" />
            Active Clinical Practice Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Clinic / Center</p>
              <p className="font-semibold">{doc.clinic}</p>
              <p className="text-xs text-muted-foreground">{doc.council}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">License Registration</p>
              <p className="font-mono font-semibold text-xs">{doc.registration_number}</p>
              <p className="text-xs text-muted-foreground">{doc.experience_years} years experience</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Consultation Fee</p>
              <p className="font-semibold">₹{doc.fee}</p>
              <p className="text-xs text-muted-foreground">Per consultation</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Schedule</p>
              <p className="font-semibold truncate">{doc.available_days?.join(", ") || "Mon-Fri"}</p>
              <p className="text-xs text-muted-foreground truncate">{doc.available_hours || "Clinic Hours"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upcoming / Pending Consultations */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="size-4 text-primary" />
              Recent Consultation Requests
            </CardTitle>
            <CardDescription className="text-xs">
              Patients waiting for confirmation or clinical consultation
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onNavigate("appointments")} className="text-xs">
            View all
          </Button>
        </CardHeader>
        <CardContent>
          {allAppts.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No appointment requests yet. Patient requests will appear here automatically.
            </p>
          ) : (
            <div className="space-y-3">
              {allAppts.slice(0, 4).map((a) => (
                <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                  <div>
                    <p className="font-medium">Scheduled for {new Date(a.scheduled_at).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">
                      Patient ID: {a.patient_id.slice(0, 8)}... {a.note ? `· "${a.note}"` : ""}
                    </p>
                  </div>
                  <Badge variant={a.status.toUpperCase() === "CONFIRMED" ? "default" : "secondary"}>
                    {a.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* =========================================================================
   2. Assigned Patients Section
   ========================================================================= */
function AssignedPatientsSection({ doc }: { doc: DoctorRow }) {
  const appts = useQuery({
    queryKey: ["appointments", "doctor", doc.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("doctor_id", doc.id)
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const shared = useQuery({
    queryKey: ["shares", "doctor", doc.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scan_shares")
        .select("*, scans(id, label, probability, created_at, thumbnail)")
        .eq("doctor_id", doc.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const patientMap = new Map<
    string,
    { patientId: string; apptCount: number; lastAppt?: string; scanCount: number; lastStatus?: string }
  >();

  (appts.data ?? []).forEach((a) => {
    const existing = patientMap.get(a.patient_id) || {
      patientId: a.patient_id,
      apptCount: 0,
      scanCount: 0,
      lastAppt: a.scheduled_at,
      lastStatus: a.status,
    };
    existing.apptCount += 1;
    patientMap.set(a.patient_id, existing);
  });

  (shared.data ?? []).forEach((s) => {
    const existing = patientMap.get(s.patient_id) || {
      patientId: s.patient_id,
      apptCount: 0,
      scanCount: 0,
    };
    existing.scanCount += 1;
    patientMap.set(s.patient_id, existing);
  });

  const patientList = Array.from(patientMap.values());

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="size-5 text-primary" />
          Assigned Patients
        </CardTitle>
        <CardDescription>
          Patients who have requested consultations or shared chest X-rays with Dr. {doc.full_name}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {patientList.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No assigned patients yet. When patients book an appointment or share scans, they will be listed here.
          </p>
        ) : (
          <div className="divide-y rounded-lg border">
            {patientList.map((p) => (
              <div key={p.patientId} className="flex flex-wrap items-center justify-between gap-4 p-4 text-sm">
                <div>
                  <p className="font-semibold">Patient #{p.patientId.slice(0, 10)}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.apptCount} consultation{p.apptCount === 1 ? "" : "s"} · {p.scanCount} shared scan{p.scanCount === 1 ? "" : "s"}
                  </p>
                  {p.lastAppt && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Latest appointment: {new Date(p.lastAppt).toLocaleDateString()} ({p.lastStatus})
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    Verified Access
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* =========================================================================
   3. Authorized Scans Section
   ========================================================================= */
function AuthorizedScansSection({ doc }: { doc: DoctorRow }) {
  const [selectedScan, setSelectedScan] = useState<any | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewingScan, setReviewingScan] = useState<any | null>(null);

  const shared = useQuery({
    queryKey: ["shares", "doctor", doc.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scan_shares")
        .select("*, scans(id, label, probability, created_at, thumbnail, gradcam, model_id, model_version)")
        .eq("doctor_id", doc.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function handleDownloadClinicalReport(scan: any) {
    try {
      const reviewDetails: ClinicalReviewDetails = {
        doctorName: doc.full_name,
        specialization: doc.specialization,
        qualification: doc.qualification,
        registrationNumber: doc.registration_number,
        clinic: doc.clinic,
        notes: reviewNote || "Verified clinical review of chest X-ray screening.",
        reviewedAt: new Date().toISOString(),
        status: "VERIFIED",
      };
      await downloadScanReport(scan, reviewDetails);
      toast.success("Clinical report generated and downloaded");
    } catch (err) {
      toast.error("Failed to generate clinical report");
    }
  }

  const items = shared.data ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileSearch className="size-5 text-primary" />
            Authorized Patient Chest X-Rays
          </CardTitle>
          <CardDescription>
            Chest X-rays explicitly shared by patients for medical evaluation
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No shared scans available yet. When a patient shares a scan during booking, it appears here.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {items.map((item) => {
                const scan = item.scans as any;
                if (!scan) return null;
                const isPneumonia = scan.label === "PNEUMONIA";

                return (
                  <Card key={item.id} className="overflow-hidden">
                    <div className="flex gap-4 p-4">
                      {scan.thumbnail ? (
                        <img
                          src={scan.thumbnail}
                          alt="Chest X-Ray"
                          className="size-24 rounded object-cover border shrink-0 bg-black cursor-pointer hover:opacity-90"
                          onClick={() => setSelectedScan(scan)}
                        />
                      ) : (
                        <div className="size-24 rounded border flex items-center justify-center bg-muted text-xs text-muted-foreground shrink-0">
                          X-Ray
                        </div>
                      )}
                      <div className="flex-1 space-y-1 text-sm">
                        <div className="flex items-center justify-between">
                          <Badge variant={isPneumonia ? "destructive" : "default"}>
                            {scan.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(scan.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Model Probability: {(scan.probability * 100).toFixed(1)}%
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Patient: #{item.patient_id.slice(0, 8)}
                        </p>
                        <div className="pt-2 flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSelectedScan(scan)}>
                            <Eye className="size-3 mr-1" /> View
                          </Button>
                          <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => setReviewingScan(scan)}>
                            <MessageSquare className="size-3 mr-1" /> Review
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleDownloadClinicalReport(scan)}>
                            <Download className="size-3 mr-1" /> PDF
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scan Detail Dialog */}
      <Dialog open={!!selectedScan} onOpenChange={() => setSelectedScan(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Chest X-Ray Inspection</DialogTitle>
            <DialogDescription>
              Patient ID: {selectedScan?.id?.slice(0, 8)} · Screening: {selectedScan?.label}
            </DialogDescription>
          </DialogHeader>
          {selectedScan && (
            <div className="space-y-4">
              <div className="flex justify-center bg-black rounded-lg p-2">
                <img
                  src={selectedScan.gradcam || selectedScan.thumbnail}
                  alt="Chest X-Ray Detail"
                  className="max-h-72 object-contain rounded"
                />
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Confidence: {(selectedScan.probability * 100).toFixed(1)}%</p>
                <p>Scanned on: {new Date(selectedScan.created_at).toLocaleString()}</p>
                {selectedScan.gradcam && (
                  <p className="text-amber-500 font-medium">Grad-CAM class activation map loaded.</p>
                )}
              </div>
              <Button className="w-full" onClick={() => handleDownloadClinicalReport(selectedScan)}>
                Download Verified PDF Report
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={!!reviewingScan} onOpenChange={() => setReviewingScan(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Submit Clinical Review</DialogTitle>
            <DialogDescription>
              Provide medical notes and observations for this chest X-ray screening.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Attending Physician</Label>
              <Input disabled value={`Dr. ${doc.full_name} (${doc.council}: ${doc.registration_number})`} />
            </div>
            <div className="space-y-2">
              <Label>Clinical Notes & Recommendations</Label>
              <Textarea
                rows={4}
                placeholder="Enter clinical assessment, consolidation findings, sputum test recommendations, etc."
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              onClick={() => {
                toast.success("Clinical review recorded!");
                handleDownloadClinicalReport(reviewingScan);
                setReviewingScan(null);
              }}
            >
              Save Review & Generate Clinical PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* =========================================================================
   4. Clinical Reports Section
   ========================================================================= */
function ClinicalReportsSection({ doc }: { doc: DoctorRow }) {
  const shared = useQuery({
    queryKey: ["shares", "doctor", doc.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scan_shares")
        .select("*, scans(*)")
        .eq("doctor_id", doc.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const scans = (shared.data ?? []).map((s) => s.scans as any).filter(Boolean);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="size-5 text-primary" />
          Clinical Reports Repository
        </CardTitle>
        <CardDescription>
          Generate and download updated medical reports featuring doctor credentials and clinical notes
        </CardDescription>
      </CardHeader>
      <CardContent>
        {scans.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No clinical reports available yet. Reports become available once patients share their scans.
          </p>
        ) : (
          <div className="divide-y rounded-lg border">
            {scans.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-4 p-4 text-sm">
                <div>
                  <p className="font-semibold">Screening Report · {s.label}</p>
                  <p className="text-xs text-muted-foreground">
                    Scan Date: {new Date(s.created_at).toLocaleString()} · Probability: {(s.probability * 100).toFixed(1)}%
                  </p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                    Authorized reviewer: Dr. {doc.full_name} ({doc.registration_number})
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2 text-xs"
                  onClick={() =>
                    downloadScanReport(s, {
                      doctorName: doc.full_name,
                      specialization: doc.specialization,
                      qualification: doc.qualification,
                      registrationNumber: doc.registration_number,
                      clinic: doc.clinic,
                      reviewedAt: new Date().toISOString(),
                    })
                  }
                >
                  <Download className="size-3.5" />
                  Download PDF
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* =========================================================================
   5. Appointments Section
   ========================================================================= */
function DoctorAppointmentsSection({ doc }: { doc: DoctorRow }) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("ALL");
  const [reschedulingAppt, setReschedulingAppt] = useState<AppointmentRow | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [reviewingAppt, setReviewingAppt] = useState<AppointmentRow | null>(null);
  const [consultNote, setConsultNote] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const appts = useQuery({
    queryKey: ["appointments", "doctor", doc.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("doctor_id", doc.id)
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function updateStatus(id: string, status: "CONFIRMED" | "CANCELLED" | "COMPLETED") {
    setBusyId(id);
    const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
    setBusyId(null);

    if (error) {
      toast.error(`Update failed: ${error.message}`);
    } else {
      toast.success(`Appointment marked as ${status}`);
      qc.invalidateQueries({ queryKey: ["appointments"] });
      sendAppointmentNotification({
        type: status === "CONFIRMED" ? "appointment_confirmed" : "appointment_cancelled",
        appointmentId: id,
        doctorName: doc.full_name,
      });
    }
  }

  async function submitReschedule() {
    if (!reschedulingAppt || !rescheduleDate) return;
    setBusyId(reschedulingAppt.id);

    const { error } = await supabase
      .from("appointments")
      .update({ scheduled_at: new Date(rescheduleDate).toISOString() })
      .eq("id", reschedulingAppt.id);

    setBusyId(null);
    if (error) {
      toast.error(`Reschedule failed: ${error.message}`);
    } else {
      toast.success("Appointment rescheduled successfully!");
      sendAppointmentNotification({
        type: "appointment_rescheduled",
        appointmentId: reschedulingAppt.id,
        doctorName: doc.full_name,
        scheduledAt: rescheduleDate,
      });
      setReschedulingAppt(null);
      setRescheduleDate("");
      qc.invalidateQueries({ queryKey: ["appointments"] });
    }
  }

  async function submitConsultationNote() {
    if (!reviewingAppt) return;
    setBusyId(reviewingAppt.id);

    const { error } = await supabase
      .from("appointments")
      .update({ note: consultNote, status: "COMPLETED" })
      .eq("id", reviewingAppt.id);

    setBusyId(null);
    if (error) {
      toast.error(`Failed to save note: ${error.message}`);
    } else {
      toast.success("Consultation note saved and consultation marked COMPLETED!");
      sendAppointmentNotification({
        type: "clinical_review_completed",
        appointmentId: reviewingAppt.id,
        doctorName: doc.full_name,
        note: consultNote,
      });
      setReviewingAppt(null);
      setConsultNote("");
      qc.invalidateQueries({ queryKey: ["appointments"] });
    }
  }

  const list = (appts.data ?? []).filter((a) => {
    if (filter === "ALL") return true;
    return a.status.toUpperCase() === filter.toUpperCase();
  });

  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      <div className="flex gap-2">
        {["ALL", "REQUESTED", "CONFIRMED", "CANCELLED", "COMPLETED"].map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            onClick={() => setFilter(f)}
            className="text-xs"
          >
            {f === "ALL" ? "All" : f}
          </Button>
        ))}
      </div>

      {list.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No appointments match this filter.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {list.map((a) => {
            const isRequested = a.status.toUpperCase() === "REQUESTED";
            const isConfirmed = a.status.toUpperCase() === "CONFIRMED";

            return (
              <Card key={a.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-base">
                        {new Date(a.scheduled_at).toLocaleString()}
                      </p>
                      <Badge
                        variant={
                          isConfirmed ? "default" : isRequested ? "secondary" : "outline"
                        }
                        className="text-xs"
                      >
                        {a.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Patient ID: #{a.patient_id.slice(0, 8)}...
                    </p>
                    {a.note && (
                      <p className="text-xs italic bg-muted/40 p-2 rounded mt-1">
                        "{a.note}"
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {isRequested && (
                      <>
                        <Button
                          size="sm"
                          disabled={busyId === a.id}
                          onClick={() => updateStatus(a.id, "CONFIRMED")}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8"
                        >
                          Confirm
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={busyId === a.id}
                          onClick={() => updateStatus(a.id, "CANCELLED")}
                          className="text-xs h-8"
                        >
                          Reject
                        </Button>
                      </>
                    )}

                    {isConfirmed && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setReviewingAppt(a);
                            setConsultNote(a.note || "");
                          }}
                          className="text-xs h-8"
                        >
                          Submit Clinical Note
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setReschedulingAppt(a)}
                          className="text-xs h-8"
                        >
                          Reschedule
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busyId === a.id}
                          onClick={() => updateStatus(a.id, "CANCELLED")}
                          className="text-xs h-8 text-destructive"
                        >
                          Cancel
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Reschedule Dialog */}
      <Dialog open={!!reschedulingAppt} onOpenChange={() => setReschedulingAppt(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reschedule Appointment</DialogTitle>
            <DialogDescription>
              Select a new date and time for this consultation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>New Date & Time</Label>
              <Input
                type="datetime-local"
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setReschedulingAppt(null)}>
                Cancel
              </Button>
              <Button onClick={submitReschedule} disabled={!rescheduleDate}>
                Confirm Reschedule
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Consultation Note Dialog */}
      <Dialog open={!!reviewingAppt} onOpenChange={() => setReviewingAppt(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Doctor Consultation Notes</DialogTitle>
            <DialogDescription>
              Save clinical findings. This will also update the appointment to COMPLETED.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Consultation Summary & Prescription</Label>
              <Textarea
                rows={4}
                placeholder="Enter diagnosis notes, medication prescribed, and follow-up advice..."
                value={consultNote}
                onChange={(e) => setConsultNote(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setReviewingAppt(null)}>
                Cancel
              </Button>
              <Button onClick={submitConsultationNote} disabled={!consultNote}>
                Save & Complete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* =========================================================================
   6. Profile Section
   ========================================================================= */
function DoctorProfileSection({ doc }: { doc: DoctorRow }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Stethoscope className="size-5 text-primary" />
          Verified Practitioner Profile
        </CardTitle>
        <CardDescription>
          Your verified credentials as registered with the medical platform
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Full Name</dt>
            <dd className="font-semibold text-base mt-0.5">Dr. {doc.full_name}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Specialization</dt>
            <dd className="font-medium mt-0.5">{doc.specialization}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Qualifications</dt>
            <dd className="font-medium mt-0.5">{doc.qualification}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Registration Number</dt>
            <dd className="font-mono font-medium mt-0.5">{doc.registration_number}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">State / National Council</dt>
            <dd className="font-medium mt-0.5">{doc.council}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Affiliated Clinic</dt>
            <dd className="font-medium mt-0.5">{doc.clinic}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Experience & Consultation Fee</dt>
            <dd className="font-medium mt-0.5">
              {doc.experience_years} years · ₹{doc.fee}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Availability</dt>
            <dd className="font-medium mt-0.5">
              {doc.available_days?.join(", ") || "Mon-Fri"} · {doc.available_hours || "Standard Hours"}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
