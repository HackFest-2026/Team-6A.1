import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/doctor-portal")({
  head: () => ({ meta: [{ title: "Doctor portal — PneumoScan AI" }, { name: "description", content: "Doctor portal in PneumoScan AI." }, { property: "og:title", content: "Doctor portal — PneumoScan AI" }, { property: "og:description", content: "Doctor portal in PneumoScan AI." }] }),
  component: DoctorPortalPage,
});

function DoctorPortalPage() {
  return (
    <div>
      <h1 className="text-3xl">Doctor portal</h1>
      <p className="mt-4 text-muted-foreground">This page has not been built yet.</p>
    </div>
  );
}
