import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Award,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  FileCheck2,
  FileText,
  IndianRupee,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  Upload,
  User,
  ArrowRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { pageHead } from "@/lib/page-head";
import { myDoctorQuery } from "@/lib/queries";

type DoctorRow = Database["public"]["Tables"]["doctors"]["Row"];

export const Route = createFileRoute("/_authenticated/doctor/verification-status")({
  head: () =>
    pageHead(
      "Doctor Verification Status",
      "Check your medical practitioner application and license verification status.",
    ),
  beforeLoad: async ({ context, location }) => {
    const userId = context.user.id;

    const { data: doctorRow } = await supabase
      .from("doctors")
      .select("id, status")
      .eq("user_id", userId)
      .maybeSingle();

    // If already verified, route to clinical tools at /doctor
    if (doctorRow?.status === "VERIFIED") {
      throw redirect({ to: "/doctor" });
    }

    if (doctorRow) return;

    // Check role or intent
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const hasRole = roles?.some((r) => r.role === "doctor" || r.role === "admin");
    if (hasRole) return;

    const params = new URLSearchParams(location.search);
    if (params.get("intent") === "doctor") return;

    // Pure patient with no doctor intent
    throw redirect({ to: "/dashboard" });
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(myDoctorQuery),
  component: DoctorVerificationStatusPage,
});

function DoctorVerificationStatusPage() {
  const { data: doc } = useSuspenseQuery(myDoctorQuery);

  if (!doc) {
    return <DoctorApplicationForm />;
  }

  return <VerificationStatusView doc={doc} />;
}

/* =========================================================================
   1. Application Status View for Unverified Doctors
   ========================================================================= */
function VerificationStatusView({ doc }: { doc: DoctorRow }) {
  const isPending = doc.status === "PENDING";
  const isUnderReview = doc.status === "UNDER_REVIEW";
  const isRejected = doc.status === "REJECTED";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Doctor Verification Status</h1>
          <p className="text-sm text-muted-foreground">
            Medical Practitioner Application & Credential Verification
          </p>
        </div>
        <Badge
          variant={isRejected ? "destructive" : isUnderReview ? "default" : "secondary"}
          className="w-fit text-sm font-medium uppercase px-3 py-1"
        >
          {doc.status}
        </Badge>
      </div>

      {(isPending || isUnderReview) && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader>
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <Clock className="size-5" />
              <CardTitle className="text-lg">Application Under Administrative Review</CardTitle>
            </div>
            <CardDescription className="text-foreground/80">
              Your credentials and medical council registration have been securely logged and are
              currently awaiting verification by a platform administrator.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 rounded-lg border bg-background/60 p-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Registered Practitioner</p>
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
                to safeguard clinical integrity.
              </p>
              <p>
                Once approved, you will gain full access to the Doctor Dashboard at{" "}
                <code className="text-primary font-mono">/doctor</code>, allowing you to review
                patient chest X-rays, confirm consultations, and issue clinical reports.
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
              please contact the platform administration for re-evaluation.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Submitted Details Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="size-4 text-primary" />
            Submitted Application Credentials
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
                {doc.documents && doc.documents.length > 0 ? (
                  doc.documents.map((d, i) => (
                    <Badge key={i} variant="outline" className="text-xs font-mono">
                      <FileCheck2 className="size-3 mr-1 text-primary" />
                      Document {i + 1}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">Council verification submitted</span>
                )}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

/* =========================================================================
   2. Doctor Registration / Application Form for New Doctors
   ========================================================================= */
function DoctorApplicationForm() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [fullName, setFullName] = useState("");
  const [qualification, setQualification] = useState("MBBS, MD (Pulmonology)");
  const [specialization, setSpecialization] = useState("Pulmonologist");
  const [experience, setExperience] = useState("8");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [council, setCouncil] = useState("State Medical Council");
  const [clinic, setClinic] = useState("City Hospital & Respiratory Center");
  const [fee, setFee] = useState("500");
  const [availableDays, setAvailableDays] = useState("Mon, Tue, Wed, Thu, Fri");
  const [availableHours, setAvailableHours] = useState("10:00 AM - 5:00 PM");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);

    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Please sign in first.");

      const daysArray = availableDays
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean);

      const { error } = await supabase.from("doctors").insert({
        user_id: u.user.id,
        full_name: fullName,
        qualification,
        specialization,
        experience_years: parseInt(experience, 10) || 0,
        registration_number: registrationNumber,
        council,
        clinic,
        fee: parseFloat(fee) || 0,
        available_days: daysArray,
        available_hours: availableHours,
        status: "PENDING",
      });

      if (error) throw error;

      toast.success("Doctor application submitted for admin verification!");
      qc.invalidateQueries({ queryKey: ["doctor", "me"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit application");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Doctor Credential Registration</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Register your medical credentials. Admin review and council verification are required
          before clinical tools can be accessed.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Stethoscope className="size-5 text-primary" />
            Practitioner Information
          </CardTitle>
          <CardDescription>
            Submit your professional medical details for licensing review.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="doc-name">Full Name (with Dr. prefix)</Label>
                <Input
                  id="doc-name"
                  required
                  placeholder="Dr. Rajesh Sharma"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="doc-qual">Medical Qualifications</Label>
                <Input
                  id="doc-qual"
                  required
                  placeholder="MBBS, MD (Pulmonology)"
                  value={qualification}
                  onChange={(e) => setQualification(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="doc-spec">Specialization</Label>
                <Input
                  id="doc-spec"
                  required
                  placeholder="Pulmonologist / Radiologist"
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="doc-exp">Years of Clinical Experience</Label>
                <Input
                  id="doc-exp"
                  type="number"
                  min="0"
                  required
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="doc-reg">Medical Registration Number</Label>
                <Input
                  id="doc-reg"
                  required
                  placeholder="MCI-123456 / KMC-78901"
                  value={registrationNumber}
                  onChange={(e) => setRegistrationNumber(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="doc-council">Medical Council</Label>
                <Input
                  id="doc-council"
                  required
                  placeholder="Karnataka Medical Council / NMC"
                  value={council}
                  onChange={(e) => setCouncil(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="doc-clinic">Clinic / Hospital Affiliation</Label>
                <Input
                  id="doc-clinic"
                  required
                  placeholder="Metro Pulmonology Care"
                  value={clinic}
                  onChange={(e) => setClinic(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="doc-fee">Consultation Fee (₹ INR)</Label>
                <Input
                  id="doc-fee"
                  type="number"
                  min="0"
                  required
                  value={fee}
                  onChange={(e) => setFee(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="doc-days">Available Days (comma separated)</Label>
                <Input
                  id="doc-days"
                  placeholder="Mon, Tue, Wed, Thu, Fri"
                  value={availableDays}
                  onChange={(e) => setAvailableDays(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="doc-hours">Available Hours</Label>
                <Input
                  id="doc-hours"
                  placeholder="10:00 AM - 5:00 PM"
                  value={availableHours}
                  onChange={(e) => setAvailableHours(e.target.value)}
                />
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground flex items-center gap-2">
              <ShieldCheck className="size-4 shrink-0 text-primary" />
              <span>
                All submitted licenses are reviewed by platform admins against registered medical
                councils before clinical privileges are granted.
              </span>
            </div>

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Submitting Registration..." : "Submit Doctor Credentials for Verification"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
