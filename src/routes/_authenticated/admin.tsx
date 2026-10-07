import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin review — PneumoScan AI" }, { name: "description", content: "Admin review in PneumoScan AI." }, { property: "og:title", content: "Admin review — PneumoScan AI" }, { property: "og:description", content: "Admin review in PneumoScan AI." }] }),
  component: AdminPage,
});

function AdminPage() {
  return (
    <div>
      <h1 className="text-3xl">Admin review</h1>
      <p className="mt-4 text-muted-foreground">This page has not been built yet.</p>
    </div>
  );
}
