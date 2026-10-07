import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/appointments")({
  head: () => ({ meta: [{ title: "Appointments — PneumoScan AI" }, { name: "description", content: "Appointments in PneumoScan AI." }, { property: "og:title", content: "Appointments — PneumoScan AI" }, { property: "og:description", content: "Appointments in PneumoScan AI." }] }),
  component: AppointmentsPage,
});

function AppointmentsPage() {
  return (
    <div>
      <h1 className="text-3xl">Appointments</h1>
      <p className="mt-4 text-muted-foreground">This page has not been built yet.</p>
    </div>
  );
}
