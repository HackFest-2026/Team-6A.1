import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { pageHead } from "@/lib/page-head";
import { myAppointmentsQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/appointments")({
  head: () => pageHead("Appointments", "Track and manage your doctor appointment requests."),
  loader: ({ context }) => context.queryClient.ensureQueryData(myAppointmentsQuery),
  component: AppointmentsPage,
});

function AppointmentsPage() {
  const { data } = useSuspenseQuery(myAppointmentsQuery);
  const qc = useQueryClient();
  async function cancel(id: string) {
    const { error } = await supabase.from("appointments").update({ status: "CANCELLED" }).eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Cancelled appointment request");
      qc.invalidateQueries({ queryKey: ["appointments"] });
      import("@/lib/notifications").then(({ sendAppointmentNotification }) => {
        sendAppointmentNotification({
          type: "appointment_cancelled",
          appointmentId: id,
        });
      });
    }
  }
  return (
    <div className="space-y-6">
      <h1 className="text-3xl">Appointments</h1>
      {data.length === 0 ? <p className="text-sm text-muted-foreground">No appointments yet.</p> : (
        <ul className="divide-y rounded-xl border bg-card">
          {data.map((a) => {
            const st = a.status.toUpperCase();
            return (
              <li key={a.id} className="flex flex-wrap items-center gap-4 p-4">
                <div className="flex-1">
                  <p className="font-medium">{a.doctors?.full_name ?? "Doctor"}</p>
                  <p className="text-xs text-muted-foreground">{a.doctors?.specialization} · {new Date(a.scheduled_at).toLocaleString()}</p>
                </div>
                <span className="rounded-full bg-muted px-3 py-1 text-xs capitalize">{a.status}</span>
                {(st === "REQUESTED" || st === "CONFIRMED") && <Button size="sm" variant="ghost" onClick={() => cancel(a.id)}>Cancel</Button>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
