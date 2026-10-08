import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { pageHead } from "@/lib/page-head";
import { myDoctorQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/doctor-portal")({
  head: () => pageHead("Doctor portal", "Apply as a doctor and manage patient appointment requests."),
  loader: ({ context }) => context.queryClient.ensureQueryData(myDoctorQuery),
  component: DoctorPortal,
});

function DoctorPortal() {
  const { data: doc } = useSuspenseQuery(myDoctorQuery);
  if (!doc) return <Apply />;
  if (doc.status !== "VERIFIED") return (
    <div className="space-y-3"><h1 className="text-3xl">Doctor portal</h1>
      <p>Application status: <b>{doc.status}</b></p>
      {doc.rejection_reason && <p className="text-sm text-destructive">Reason: {doc.rejection_reason}</p>}
      <p className="text-sm text-muted-foreground">An admin reviews every application manually.</p></div>
  );
  return <Requests doctorId={doc.id} />;
}

function Requests({ doctorId }: { doctorId: string }) {
  const qc = useQueryClient();
  const appts = useQuery({ queryKey: ["appointments", "doctor"], queryFn: async () => {
    const { data, error } = await supabase.from("appointments").select("*").eq("doctor_id", doctorId).order("scheduled_at");
    if (error) throw error; return data;
  } });
  const shared = useQuery({ queryKey: ["shares", "doctor"], queryFn: async () => {
    const { data, error } = await supabase.from("scan_shares").select("*, scans(label, probability, created_at, thumbnail)").eq("doctor_id", doctorId);
    if (error) throw error; return data;
  } });
  const [notes, setNotes] = useState<Record<string, string>>({});
  async function setStatus(id: string, status: string) {
    const note = notes[id];
    const { error } = await supabase.from("appointments").update(note ? { status, note } : { status }).eq("id", id);
    if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: ["appointments"] });
  }
  return (
    <div className="space-y-8">
      <h1 className="text-3xl">Doctor portal</h1>
      <section><h2 className="text-xl">Appointment requests</h2>
        {!appts.data?.length ? <p className="mt-2 text-sm text-muted-foreground">No requests.</p> : (
          <ul className="mt-3 space-y-3">{appts.data.map((a) => (
            <li key={a.id} className="space-y-2 rounded-xl border bg-card p-4">
              <p className="text-sm"><b className="capitalize">{a.status}</b> · {new Date(a.scheduled_at).toLocaleString()}</p>
              {a.note && <p className="text-sm text-muted-foreground">{a.note}</p>}
              <Input placeholder="Add a note for the patient" value={notes[a.id] ?? ""} onChange={(e) => setNotes({ ...notes, [a.id]: e.target.value })} />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setStatus(a.id, "accepted")}>Accept</Button>
                <Button size="sm" variant="outline" onClick={() => setStatus(a.id, "declined")}>Decline</Button>
                <Button size="sm" variant="ghost" onClick={() => setStatus(a.id, "completed")}>Mark completed</Button>
              </div>
            </li>))}</ul>)}
      </section>
      <section><h2 className="text-xl">Shared scans</h2>
        {!shared.data?.length ? <p className="mt-2 text-sm text-muted-foreground">No scans shared with you.</p> : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">{shared.data.map((s) => s.scans && (
            <li key={s.id} className="flex gap-3 rounded-xl border bg-card p-3">
              {s.scans.thumbnail && <img src={s.scans.thumbnail} alt="" className="size-16 rounded object-cover" />}
              <div className="text-sm"><p className="font-medium">{s.scans.label}</p><p>{(s.scans.probability * 100).toFixed(1)}%</p><p className="text-xs text-muted-foreground">{new Date(s.scans.created_at).toLocaleString()}</p></div>
            </li>))}</ul>)}
      </section>
    </div>
  );
}

function Apply() {
  const qc = useQueryClient();
  const [f, setF] = useState({ full_name: "", registration_number: "", council: "", qualification: "", specialization: "", clinic: "", experience_years: "0", fee: "0", available_hours: "", available_days: "Mon,Tue,Wed,Thu,Fri" });
  const fields: [keyof typeof f, string][] = [["full_name", "Full name"], ["registration_number", "Medical registration number"], ["council", "Medical council"], ["qualification", "Qualification"], ["specialization", "Specialization"], ["clinic", "Clinic / hospital"], ["experience_years", "Years of experience"], ["fee", "Consultation fee (₹)"], ["available_days", "Available days (comma separated)"], ["available_hours", "Available hours"]];
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const { data: u } = await supabase.auth.getUser(); if (!u.user) return;
    const { error } = await supabase.from("doctors").insert({ ...f, user_id: u.user.id, status: "PENDING", experience_years: Number(f.experience_years) || 0, fee: Number(f.fee) || 0, available_days: f.available_days.split(",").map((s) => s.trim()).filter(Boolean) });
    if (error) toast.error(error.message); else { toast.success("Application submitted"); qc.invalidateQueries({ queryKey: ["doctor"] }); }
  }
  return (
    <form onSubmit={submit} className="max-w-xl space-y-4">
      <h1 className="text-3xl">Apply as a doctor</h1>
      {fields.map(([k, l]) => (<div key={k} className="space-y-1"><Label htmlFor={k}>{l}</Label><Input id={k} required={k !== "available_hours"} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>))}
      <Button>Submit application</Button>
    </form>
  );
}
