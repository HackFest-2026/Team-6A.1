import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { pageHead } from "@/lib/page-head";
import { myAppointmentsQuery, scansQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => pageHead("Dashboard", "Your recent chest X-ray screenings and upcoming appointments."),
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(scansQuery), context.queryClient.ensureQueryData(myAppointmentsQuery)]),
  component: DashboardPage,
});

function DashboardPage() {
  const { data: scans } = useSuspenseQuery(scansQuery);
  const { data: appts } = useSuspenseQuery(myAppointmentsQuery);
  const flagged = scans.filter((s) => s.label === "PNEUMONIA").length;
  const upcoming = appts.filter((a) => a.status !== "cancelled" && new Date(a.scheduled_at) > new Date()).length;
  const stats = [["Total scans", scans.length], ["Flagged", flagged], ["Upcoming appointments", upcoming]] as const;
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl">Dashboard</h1>
        <Button asChild><Link to="/scan">New scan</Link></Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map(([k, v]) => (
          <div key={k} className="rounded-xl border bg-card p-5"><p className="text-sm text-muted-foreground">{k}</p><p className="mt-1 font-display text-3xl">{v}</p></div>
        ))}
      </div>
      <section>
        <h2 className="text-xl">Recent scans</h2>
        {scans.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No scans yet.</p> : (
          <ul className="mt-3 divide-y rounded-xl border bg-card">
            {scans.slice(0, 5).map((s) => (
              <li key={s.id} className="flex items-center gap-4 p-3">
                {s.thumbnail && <img src={s.thumbnail} alt="" className="size-12 rounded object-cover" />}
                <div className="flex-1 text-sm">{new Date(s.created_at).toLocaleString()}</div>
                <span className={`text-sm font-medium ${s.label === "PNEUMONIA" ? "text-destructive" : "text-primary"}`}>{s.label}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
