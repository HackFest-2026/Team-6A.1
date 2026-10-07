import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports — PneumoScan AI" }, { name: "description", content: "Reports in PneumoScan AI." }, { property: "og:title", content: "Reports — PneumoScan AI" }, { property: "og:description", content: "Reports in PneumoScan AI." }] }),
  component: ReportsPage,
});

function ReportsPage() {
  return (
    <div>
      <h1 className="text-3xl">Reports</h1>
      <p className="mt-4 text-muted-foreground">This page has not been built yet.</p>
    </div>
  );
}
