import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Award,
  Building2,
  Calendar,
  CheckCircle2,
  CheckCheck,
  Clock,
  Eye,
  FileCheck2,
  FileSearch,
  FileText,
  IndianRupee,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  Upload,
  User,
  X,
  XCircle,
  Briefcase,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

type DoctorRow = Database["public"]["Tables"]["doctors"]["Row"];

export const Route = createFileRoute("/_authenticated/doctor-portal")({
  head: () =>
    pageHead(
      "Doctor Portal",
      "Manage clinical consultation requests and review patient chest X-ray scans.",
    ),
  loader: ({ context }) => context.queryClient.ensureQueryData(myDoctorQuery),
  component: DoctorPortal,
});

function DoctorPortal() {
  const { data: doc } = useSuspenseQuery(myDoctorQuery);

  if (!doc) return <Apply />;

  if (doc.status !== "VERIFIED") {
    return <ApplicationStatusView doc={doc} />;
  }

  return <Requests doctorId={doc.id} doc={doc} />;
}

/* =========================================================================
   1. Application Status Component (Pending / Rejected / Suspended)
   ========================================================================= */
function ApplicationStatusView({ doc }: { doc: DoctorRow }) {
  const isPending = doc.status === "PENDING";
  const isRejected = doc.status === "REJECTED";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Doctor Portal</h1>
          <p className="text-sm text-muted-foreground">
            Medical Practitioner Application & Credential Verification
          </p>
        </div>
        <Badge
          variant={isPending ? "secondary" : isRejected ? "destructive" : "outline"}
          className="w-fit text-sm font-medium uppercase px-3 py-1"
        >
          {doc.status}
        </Badge>
      </div>

      {isPending && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader>
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <Clock className="size-5" />
              <CardTitle className="text-lg">Application Under Review</CardTitle>
            </div>
            <CardDescription className="text-foreground/80">
              Your credentials and medical council registration have been securely logged and are
              awaiting administrative verification.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 rounded-lg border bg-background/60 p-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Submitted Candidate</p>
                <p className="font-semibold text-sm">{doc.full_name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Registration Number</p>
                <p className="font-mono text-sm">{doc.registration_number}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Medical Council</p>
                <p className="text-sm">{doc.council}</p>
              </div>
            </div>

            <div className="space-y-2 text-xs text-muted-foreground">
              <p className="flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-primary" />
                Administrative reviews verify practitioner licenses against state medical councils
                to safeguard patient trust.
              </p>
              <p>
                Once verified, your profile will immediately activate in the public Doctor Directory
                and patients can request consultations.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {isRejected && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="size-5" />
              <CardTitle className="text-lg">Application Not Approved</CardTitle>
            </div>
            <CardDescription>
              The administrative medical reviewer could not verify your application with the
              submitted details.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {doc.rejection_reason && (
              <div className="rounded-lg border border-destructive/20 bg-background/80 p-4">
                <p className="text-xs font-semibold text-destructive uppercase tracking-wide">
                  Reviewer Reason
                </p>
                <p className="mt-1 text-sm text-foreground">{doc.rejection_reason}</p>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              If this was due to unclear document scans or a clerical error in registration numbers,
              please reach out to the platform administration for re-evaluation.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Submitted Details Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="size-4 text-primary" />
            Submitted Application Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Specialization</dt>
              <dd className="font-medium mt-0.5">{doc.specialization}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Qualification</dt>
              <dd className="font-medium mt-0.5">{doc.qualification}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Clinic / Hospital</dt>
              <dd className="font-medium mt-0.5">{doc.clinic}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Experience & Fee</dt>
              <dd className="font-medium mt-0.5">
                {doc.experience_years} years · ₹{doc.fee}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted-foreground">Practice Hours & Days</dt>
              <dd className="font-medium mt-0.5">
                {doc.available_days?.join(", ") || "Mon-Fri"} ·{" "}
                {doc.available_hours || "Standard Clinic Hours"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted-foreground">Verification Documents</dt>
              <dd className="mt-1 flex flex-wrap gap-2">
                {doc.documents?.map((d, i) => (
                  <Badge key={i} variant="outline" className="text-xs font-mono">
                    <FileCheck2 className="size-3 mr-1 text-primary" />
                    Document {i + 1}
                  </Badge>
                ))}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

/* =========================================================================
   2. Verified Doctor Portal Component
   ========================================================================= */
function Requests({ doctorId, doc }: { doctorId: string; doc: DoctorRow }) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("appointments");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedScan, setSelectedScan] = useState<{
    id: string;
    label: string;
    probability: number;
    created_at: string;
    thumbnail: string | null;
  } | null>(null);

  const appts = useQuery({
    queryKey: ["appointments", "doctor"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("doctor_id", doctorId)
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const shared = useQuery({
    queryKey: ["shares", "doctor"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scan_shares")
        .select("*, scans(label, probability, created_at, thumbnail)")
        .eq("doctor_id", doctorId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function updateAppointment(id: string, status: string, saveCurrentNote = true) {
    setProcessingId(id);
    const note = notes[id];
    const updatePayload: { status: string; note?: string } = { status };
    if (saveCurrentNote && note !== undefined) {
      updatePayload.note = note;
    }

    const { error } = await supabase.from("appointments").update(updatePayload).eq("id", id);

    setProcessingId(null);
    if (error) {
      toast.error(`Update failed: ${error.message}`);
    } else {
      toast.success(`Appointment marked as ${status}`);
      qc.invalidateQueries({ queryKey: ["appointments"] });
    }
  }

  async function saveNoteOnly(id: string) {
    const note = notes[id];
    if (note === undefined) return;
    setProcessingId(id);

    const { error } = await supabase.from("appointments").update({ note }).eq("id", id);

    setProcessingId(null);
    if (error) {
      toast.error(`Failed to save note: ${error.message}`);
    } else {
      toast.success("Consultation note saved");
      qc.invalidateQueries({ queryKey: ["appointments"] });
    }
  }

  const allAppointments = appts.data ?? [];
  const filteredAppointments = allAppointments.filter((a) => {
    if (statusFilter === "all") return true;
    return a.status.toLowerCase() === statusFilter.toLowerCase();
  });

  const pendingCount = allAppointments.filter(
    (a) => a.status.toLowerCase() === "requested" || a.status.toLowerCase() === "pending",
  ).length;

  return (
    <div className="space-y-6">
      {/* Top Header & Doctor Badge */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Doctor Portal</h1>
            <Badge
              variant="default"
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-xs"
            >
              <ShieldCheck className="size-3.5" />
              Verified Practitioner
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Clinical management dashboard for Dr. {doc.full_name}
          </p>
        </div>
      </div>

      {/* Practitioner Clinical Summary Card */}
      <Card className="border bg-card/60 backdrop-blur-sm shadow-sm">
        <CardContent className="p-4 sm:p-5">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
            <div className="flex items-start gap-2.5">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Stethoscope className="size-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Specialization</p>
                <p className="font-semibold">{doc.specialization}</p>
                <p className="text-xs text-muted-foreground truncate">{doc.qualification}</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Building2 className="size-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Clinic / Center</p>
                <p className="font-semibold truncate">{doc.clinic}</p>
                <p className="text-xs text-muted-foreground">{doc.council}</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Award className="size-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Registration</p>
                <p className="font-mono font-semibold text-xs">{doc.registration_number}</p>
                <p className="text-xs text-muted-foreground">
                  {doc.experience_years} yrs experience
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <IndianRupee className="size-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Consultation Fee</p>
                <p className="font-semibold">₹{doc.fee}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {doc.available_days?.slice(0, 3).join(", ")}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 sm:w-auto sm:inline-flex">
          <TabsTrigger value="appointments" className="gap-2">
            <Calendar className="size-4" />
            <span>Appointments</span>
            {pendingCount > 0 && (
              <Badge
                variant="secondary"
                className="ml-1 h-5 px-1.5 text-xs bg-amber-500/20 text-amber-700 dark:text-amber-300"
              >
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="scans" className="gap-2">
            <FileSearch className="size-4" />
            <span>Shared Scans</span>
            {shared.data && shared.data.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {shared.data.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="profile" className="gap-2">
            <User className="size-4" />
            <span>Schedule & Info</span>
          </TabsTrigger>
        </TabsList>

        {/* =================================================================
            Tab 1: Appointments
            ================================================================= */}
        <TabsContent value="appointments" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Patient Consultations</h2>
              <p className="text-xs text-muted-foreground">
                Review, confirm, or complete clinical appointment requests.
              </p>
            </div>
            {/* Filter Chips */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {(["all", "requested", "accepted", "completed", "declined"] as const).map((st) => (
                <Button
                  key={st}
                  variant={statusFilter === st ? "default" : "outline"}
                  size="sm"
                  className="h-7 capitalize text-xs px-2.5"
                  onClick={() => setStatusFilter(st)}
                >
                  {st}
                </Button>
              ))}
            </div>
          </div>

          {appts.isLoading ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              Loading appointment requests…
            </Card>
          ) : filteredAppointments.length === 0 ? (
            <Card className="border-dashed p-10 text-center">
              <Calendar className="mx-auto size-10 text-muted-foreground/60 mb-3" />
              <h3 className="font-medium text-base">No appointments found</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-1">
                {statusFilter === "all"
                  ? "When patients schedule a consultation with you from the Doctor directory, their appointments will appear here."
                  : `No appointments matching the "${statusFilter}" status filter.`}
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredAppointments.map((a) => {
                const statusLower = a.status.toLowerCase();
                const isPendingOrReq = statusLower === "requested" || statusLower === "pending";
                const isAccepted = statusLower === "accepted";
                const isCompleted = statusLower === "completed";
                const isDeclined = statusLower === "declined";
                const isBusy = processingId === a.id;

                const appointmentDate = new Date(a.scheduled_at);
                const isPast = appointmentDate < new Date();

                return (
                  <Card key={a.id} className="transition-colors hover:border-primary/30">
                    <CardContent className="p-5 space-y-4">
                      {/* Top Row: Date, Status Badge, Patient ID */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                        <div className="flex items-center gap-2">
                          <Clock className="size-4 text-primary" />
                          <span className="font-semibold text-sm">
                            {appointmentDate.toLocaleDateString(undefined, {
                              weekday: "short",
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}{" "}
                            at{" "}
                            {appointmentDate.toLocaleTimeString(undefined, {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {isPast && (
                            <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded">
                              Past
                            </span>
                          )}
                        </div>

                        <Badge
                          variant={
                            isAccepted
                              ? "default"
                              : isDeclined
                                ? "destructive"
                                : isCompleted
                                  ? "secondary"
                                  : "outline"
                          }
                          className={`capitalize text-xs font-semibold ${
                            isAccepted
                              ? "bg-emerald-600 text-white hover:bg-emerald-700"
                              : isPendingOrReq
                                ? "border-amber-500/50 bg-amber-500/15 text-amber-700 dark:text-amber-400"
                                : ""
                          }`}
                        >
                          {a.status}
                        </Badge>
                      </div>

                      {/* Middle: Patient Reference & Existing Note */}
                      <div className="grid gap-2 text-sm sm:grid-cols-2">
                        <div>
                          <p className="text-xs text-muted-foreground">Patient Identifier</p>
                          <p className="font-mono text-xs text-foreground/80 truncate">
                            {a.patient_id}
                          </p>
                        </div>
                        {a.note && (
                          <div className="sm:text-right">
                            <p className="text-xs text-muted-foreground">Current Clinical Note</p>
                            <p className="text-xs text-foreground/90 font-medium">{a.note}</p>
                          </div>
                        )}
                      </div>

                      {/* Note Edit Area */}
                      <div className="space-y-2 pt-1">
                        <Label
                          htmlFor={`note-${a.id}`}
                          className="text-xs text-muted-foreground flex items-center justify-between"
                        >
                          <span>Patient / Consultation Note</span>
                          {notes[a.id] !== undefined && notes[a.id] !== a.note && (
                            <button
                              type="button"
                              onClick={() => saveNoteOnly(a.id)}
                              disabled={isBusy}
                              className="text-xs text-primary hover:underline font-normal cursor-pointer"
                            >
                              Save note only
                            </button>
                          )}
                        </Label>
                        <Input
                          id={`note-${a.id}`}
                          placeholder="e.g. Please bring prior chest X-ray physical films / fasting required"
                          defaultValue={a.note ?? ""}
                          onChange={(e) => setNotes({ ...notes, [a.id]: e.target.value })}
                          disabled={isBusy}
                          className="text-sm"
                        />
                      </div>

                      {/* Actions Toolbar */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {isPendingOrReq && (
                          <>
                            <Button
                              size="sm"
                              disabled={isBusy}
                              onClick={() => updateAppointment(a.id, "accepted")}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                            >
                              <CheckCircle2 className="size-4" />
                              Accept Appointment
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isBusy}
                              onClick={() => updateAppointment(a.id, "declined")}
                              className="text-destructive hover:bg-destructive/10 border-destructive/30 gap-1.5"
                            >
                              <XCircle className="size-4" />
                              Decline
                            </Button>
                          </>
                        )}

                        {isAccepted && (
                          <>
                            <Button
                              size="sm"
                              disabled={isBusy}
                              onClick={() => updateAppointment(a.id, "completed")}
                              className="gap-1.5"
                            >
                              <CheckCheck className="size-4" />
                              Mark Completed
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isBusy}
                              onClick={() => updateAppointment(a.id, "declined")}
                              className="text-destructive hover:bg-destructive/10 border-destructive/30 text-xs"
                            >
                              Cancel / Decline
                            </Button>
                          </>
                        )}

                        {(isCompleted || isDeclined) && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isBusy}
                            onClick={() => updateAppointment(a.id, "accepted")}
                            className="text-xs"
                          >
                            Re-open as Accepted
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* =================================================================
            Tab 2: Shared Scans
            ================================================================= */}
        <TabsContent value="scans" className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Patient Chest X-Rays</h2>
            <p className="text-xs text-muted-foreground">
              Chest X-ray screening reports and images shared with your practice for clinical second
              opinion.
            </p>
          </div>

          {shared.isLoading ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              Loading shared scans…
            </Card>
          ) : !shared.data?.length ? (
            <Card className="border-dashed p-10 text-center">
              <FileSearch className="mx-auto size-10 text-muted-foreground/60 mb-3" />
              <h3 className="font-medium text-base">No scans shared yet</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-1">
                When patients choose to share their PneumoScan AI screening results with you, their
                X-ray records will appear here.
              </p>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {shared.data.map((s) => {
                if (!s.scans) return null;
                const isPneumonia = s.scans.label.toLowerCase().includes("pneumonia");
                const probPct = (s.scans.probability * 100).toFixed(1);

                return (
                  <Card key={s.id} className="overflow-hidden flex flex-col justify-between">
                    <CardContent className="p-4 space-y-3">
                      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-black/5 dark:bg-white/5 border flex items-center justify-center">
                        {s.scans.thumbnail ? (
                          <img
                            src={s.scans.thumbnail}
                            alt="Chest X-ray"
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <FileSearch className="size-12 text-muted-foreground" />
                        )}

                        <Badge
                          className={`absolute top-2 right-2 text-xs font-semibold ${
                            isPneumonia ? "bg-amber-600 text-white" : "bg-emerald-600 text-white"
                          }`}
                        >
                          {s.scans.label}
                        </Badge>
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Model Confidence</span>
                          <span className="font-semibold text-foreground">{probPct}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-muted mt-1 overflow-hidden">
                          <div
                            className={`h-full ${isPneumonia ? "bg-amber-500" : "bg-emerald-500"}`}
                            style={{
                              width: `${Math.min(100, Math.max(0, s.scans.probability * 100))}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Calendar className="size-3.5" />
                        <span>Scan Date: {new Date(s.scans.created_at).toLocaleDateString()}</span>
                      </div>
                    </CardContent>

                    <div className="border-t bg-muted/20 p-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-1.5 text-xs"
                        onClick={() =>
                          setSelectedScan({
                            id: s.scan_id,
                            label: s.scans!.label,
                            probability: s.scans!.probability,
                            created_at: s.scans!.created_at,
                            thumbnail: s.scans!.thumbnail,
                          })
                        }
                      >
                        <Eye className="size-3.5" />
                        Inspect Scan Details
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* =================================================================
            Tab 3: Practice Schedule & Doctor Profile
            ================================================================= */}
        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Practitioner Details & Practice Schedule</CardTitle>
              <CardDescription>
                Public verified information visible to patients in the PneumoScan directory.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 text-sm">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Practitioner Name</p>
                  <p className="font-medium text-base">Dr. {doc.full_name}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Medical Council & License</p>
                  <p className="font-medium">{doc.council}</p>
                  <p className="text-xs font-mono text-muted-foreground">
                    Reg No: {doc.registration_number}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Medical Qualification</p>
                  <p className="font-medium">{doc.qualification}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Specialization</p>
                  <p className="font-medium">{doc.specialization}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Clinic / Hospital Center</p>
                  <p className="font-medium">{doc.clinic}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Consultation Fee</p>
                  <p className="font-medium">₹{doc.fee} per appointment</p>
                </div>
              </div>

              <div className="border-t pt-4 space-y-3">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <Clock className="size-4 text-primary" />
                  Active Working Schedule
                </h4>
                <div className="grid gap-2 sm:grid-cols-2 text-sm">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Available Days</p>
                    <p className="font-medium mt-1">
                      {doc.available_days?.length
                        ? doc.available_days.join(", ")
                        : "Mon, Tue, Wed, Thu, Fri"}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Clinic Hours</p>
                    <p className="font-medium mt-1">
                      {doc.available_hours || "Standard Outpatient Hours (09:00 AM – 05:00 PM)"}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Inspect Scan Dialog */}
      {selectedScan && (
        <Dialog open={!!selectedScan} onOpenChange={(open) => !open && setSelectedScan(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>Scan Details</span>
                <Badge
                  className={
                    selectedScan.label.toLowerCase().includes("pneumonia")
                      ? "bg-amber-600 text-white"
                      : "bg-emerald-600 text-white"
                  }
                >
                  {selectedScan.label}
                </Badge>
              </DialogTitle>
              <DialogDescription>
                Screened on {new Date(selectedScan.created_at).toLocaleString()}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="aspect-square w-full overflow-hidden rounded-lg border bg-black/5 dark:bg-white/5 flex items-center justify-center">
                {selectedScan.thumbnail ? (
                  <img
                    src={selectedScan.thumbnail}
                    alt="X-ray full view"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <FileSearch className="size-16 text-muted-foreground" />
                )}
              </div>

              <div className="space-y-1.5 text-sm rounded-lg border p-3 bg-muted/30">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Screening Model Result:</span>
                  <span className="font-semibold">{selectedScan.label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Calculated Probability:</span>
                  <span className="font-semibold">
                    {(selectedScan.probability * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Decision Threshold:</span>
                  <span>71.0%</span>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground text-center">
                Note: PneumoScan AI provides screening support. Clinical decision-making rests with
                the treating practitioner.
              </p>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

/* =========================================================================
   3. Doctor Application Form Component
   ========================================================================= */
function Apply() {
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [f, setF] = useState({
    full_name: "",
    registration_number: "",
    council: "",
    qualification: "",
    specialization: "",
    clinic: "",
    experience_years: "5",
    fee: "500",
    available_hours: "09:00 AM - 01:00 PM, 05:00 PM - 08:00 PM",
    available_days: "Mon,Tue,Wed,Thu,Fri",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      toast.error("Please sign in before submitting an application.");
      return;
    }

    if (!files.length) {
      toast.error("Please attach your medical registration certificate or degree (PDF/Image).");
      return;
    }

    setSubmitting(true);
    const documents: string[] = [];

    for (const file of files.slice(0, 5)) {
      const path = `${u.user.id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("doctor-docs").upload(path, file);
      if (upErr) {
        setSubmitting(false);
        toast.error(`Document upload failed for ${file.name}: ${upErr.message}`);
        return;
      }
      documents.push(path);
    }

    const { error } = await supabase.from("doctors").insert({
      ...f,
      documents,
      user_id: u.user.id,
      status: "PENDING",
      experience_years: Number(f.experience_years) || 0,
      fee: Number(f.fee) || 0,
      available_days: f.available_days
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    });

    setSubmitting(false);

    if (error) {
      toast.error(`Application failed: ${error.message}`);
    } else {
      toast.success("Doctor application submitted successfully! Under review.");
      qc.invalidateQueries({ queryKey: ["doctor"] });
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length > 5) {
      toast.error("You can upload a maximum of 5 supporting documents.");
      setFiles(selected.slice(0, 5));
    } else {
      setFiles(selected);
    }
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Stethoscope className="size-6 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Apply as a Medical Practitioner</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Join the PneumoScan network of verified pulmonologists, radiologists, and clinicians to
          provide patient consultations.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-6">
        {/* Section 1: Professional Identity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="size-4 text-primary" />
              1. Professional & Educational Identity
            </CardTitle>
            <CardDescription>Basic credentials and medical qualifications.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="full_name">Full Name (with Dr. prefix)</Label>
              <Input
                id="full_name"
                required
                placeholder="Dr. Rajesh Sharma"
                value={f.full_name}
                onChange={(e) => setF({ ...f, full_name: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="qualification">Primary Qualification</Label>
              <Input
                id="qualification"
                required
                placeholder="MBBS, MD (Pulmonary Medicine)"
                value={f.qualification}
                onChange={(e) => setF({ ...f, qualification: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="specialization">Medical Specialization</Label>
              <Input
                id="specialization"
                required
                placeholder="Pulmonology / Respiratory Medicine"
                value={f.specialization}
                onChange={(e) => setF({ ...f, specialization: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Medical Council Registration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="size-4 text-primary" />
              2. Medical Licensing & Council Registration
            </CardTitle>
            <CardDescription>
              Your medical registration number will be authenticated against council records.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="registration_number">Medical Registration Number</Label>
              <Input
                id="registration_number"
                required
                placeholder="MCI-2015-89412"
                value={f.registration_number}
                onChange={(e) => setF({ ...f, registration_number: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="council">Medical Council</Label>
              <Input
                id="council"
                required
                placeholder="Medical Council of India / State Council"
                value={f.council}
                onChange={(e) => setF({ ...f, council: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="experience_years">Years of Clinical Experience</Label>
              <Input
                id="experience_years"
                type="number"
                min="0"
                max="70"
                required
                value={f.experience_years}
                onChange={(e) => setF({ ...f, experience_years: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fee">Consultation Fee (₹)</Label>
              <Input
                id="fee"
                type="number"
                min="0"
                required
                placeholder="500"
                value={f.fee}
                onChange={(e) => setF({ ...f, fee: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Clinic & Availability */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="size-4 text-primary" />
              3. Clinic Affiliation & Availability
            </CardTitle>
            <CardDescription>
              Details about your primary consultation clinic and operational schedule.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="clinic">Primary Clinic / Hospital Affiliation</Label>
              <Input
                id="clinic"
                required
                placeholder="Apollo Chest Care Center / City General Hospital"
                value={f.clinic}
                onChange={(e) => setF({ ...f, clinic: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="available_days">Available Days (comma separated)</Label>
              <Input
                id="available_days"
                required
                placeholder="Mon,Tue,Wed,Thu,Fri"
                value={f.available_days}
                onChange={(e) => setF({ ...f, available_days: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="available_hours">Available Consultation Hours</Label>
              <Input
                id="available_hours"
                placeholder="09:00 AM - 01:00 PM, 05:00 PM - 08:00 PM"
                value={f.available_hours}
                onChange={(e) => setF({ ...f, available_hours: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 4: Document Verification Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileCheck2 className="size-4 text-primary" />
              4. Supporting Documents (Registration Certificate / Degree)
            </CardTitle>
            <CardDescription>
              Upload up to 5 clear PDF or image documents for manual verification by medical admins.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed bg-card p-6 text-center hover:bg-muted/50 cursor-pointer transition-colors">
              <Upload className="size-6 text-primary" />
              <span className="font-medium text-sm">
                Click or drag registration certificates here
              </span>
              <span className="text-xs text-muted-foreground">
                Accepted: PDF, JPG, PNG (Max 5 files)
              </span>
              <input
                id="docs"
                type="file"
                multiple
                accept="application/pdf,image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>

            {files.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">
                  Selected Files ({files.length}/5):
                </p>
                <div className="flex flex-wrap gap-2">
                  {files.map((file, idx) => (
                    <Badge
                      key={idx}
                      variant="secondary"
                      className="gap-1.5 text-xs py-1 px-2.5 flex items-center"
                    >
                      <FileText className="size-3.5 text-primary" />
                      <span className="max-w-[180px] truncate">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="ml-1 text-muted-foreground hover:text-foreground"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="submit" size="lg" disabled={submitting} className="min-w-[200px]">
            {submitting ? "Submitting Application…" : "Submit Practitioner Application"}
          </Button>
        </div>
      </form>
    </div>
  );
}
