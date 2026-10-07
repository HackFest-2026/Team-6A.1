import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({ meta: [{ title: "History — PneumoScan AI" }, { name: "description", content: "History in PneumoScan AI." }, { property: "og:title", content: "History — PneumoScan AI" }, { property: "og:description", content: "History in PneumoScan AI." }] }),
  component: HistoryPage,
});

function HistoryPage() {
  return (
    <div>
      <h1 className="text-3xl">History</h1>
      <p className="mt-4 text-muted-foreground">This page has not been built yet.</p>
    </div>
  );
}
