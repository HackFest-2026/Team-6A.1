import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — PneumoScan AI" }, { name: "description", content: "Dashboard in PneumoScan AI." }, { property: "og:title", content: "Dashboard — PneumoScan AI" }, { property: "og:description", content: "Dashboard in PneumoScan AI." }] }),
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <div>
      <h1 className="text-3xl">Dashboard</h1>
      <p className="mt-4 text-muted-foreground">This page has not been built yet.</p>
    </div>
  );
}
