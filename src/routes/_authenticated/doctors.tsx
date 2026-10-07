import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/doctors")({
  head: () => ({ meta: [{ title: "Find Doctor — PneumoScan AI" }, { name: "description", content: "Find Doctor in PneumoScan AI." }, { property: "og:title", content: "Find Doctor — PneumoScan AI" }, { property: "og:description", content: "Find Doctor in PneumoScan AI." }] }),
  component: DoctorsPage,
});

function DoctorsPage() {
  return (
    <div>
      <h1 className="text-3xl">Find Doctor</h1>
      <p className="mt-4 text-muted-foreground">This page has not been built yet.</p>
    </div>
  );
}
