import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { pageHead } from "@/lib/page-head";
import { scansQuery, verifiedDoctorsQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/doctors")({
  head: () => pageHead("Find a doctor", "Browse verified doctors and request an appointment."),
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(verifiedDoctorsQuery), context.queryClient.ensureQueryData(scansQuery)]),
  component: DoctorsPage,
});

function DoctorsPage() {
  const { data: doctors } = useSuspenseQuery(verifiedDoctorsQuery);
  const { data: scans } = useSuspenseQuery(scansQuery);
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [booking, setBooking] = useState<string | null>(null);
  const [when, setWhen] = useState("");
  const [note, setNote] = useState("");
  const [shareId, setShareId] = useState("");
  const list = doctors.filter((d) => `${d.full_name} ${d.specialization} ${d.clinic}`.toLowerCase().includes(q.toLowerCase()));

  async function book(doctorId: string) {
    if (!when || new Date(when) <= new Date()) { toast.error("Pick a future date and time"); return; }
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("appointments").insert({ doctor_id: doctorId, patient_id: u.user.id, scheduled_at: new Date(when).toISOString(), note: note || null, status: "requested" });
    if (error) { toast.error(error.message); return; }
    if (shareId) await supabase.from("scan_shares").insert({ scan_id: shareId, doctor_id: doctorId, patient_id: u.user.id });
    toast.success("Appointment requested");
    setBooking(null); setWhen(""); setNote(""); setShareId("");
    qc.invalidateQueries({ queryKey: ["appointments"] });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl">Find a doctor</h1>
      <Input placeholder="Search by name, specialty or clinic" value={q} onChange={(e) => setQ(e.target.value)} />
      {list.length === 0 ? <p className="text-sm text-muted-foreground">No verified doctors available yet.</p> : (
        <ul className="grid gap-4 md:grid-cols-2">
          {list.map((d) => (
            <li key={d.id} className="space-y-3 rounded-xl border bg-card p-5">
              <div>
                <p className="font-display text-lg">{d.full_name}</p>
                <p className="text-sm text-muted-foreground">{d.specialization} · {d.qualification} · {d.experience_years} yrs</p>
                <p className="text-sm">{d.clinic}</p>
                <p className="text-xs text-muted-foreground">{d.available_days.join(", ")} {d.available_hours ?? ""} · Fee ₹{d.fee}</p>
              </div>
              {booking === d.id ? (
                <div className="space-y-2">
                  <Label>Date & time</Label><Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
                  <Label>Share a scan (optional)</Label>
                  <select className="w-full rounded-md border bg-background p-2 text-sm" value={shareId} onChange={(e) => setShareId(e.target.value)}>
                    <option value="">Don't share</option>
                    {scans.map((s) => <option key={s.id} value={s.id}>{new Date(s.created_at).toLocaleDateString()} · {s.label}</option>)}
                  </select>
                  <Label>Note</Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} />
                  <div className="flex gap-2"><Button onClick={() => book(d.id)}>Request</Button><Button variant="ghost" onClick={() => setBooking(null)}>Cancel</Button></div>
                </div>
              ) : <Button variant="outline" onClick={() => setBooking(d.id)}>Book appointment</Button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
