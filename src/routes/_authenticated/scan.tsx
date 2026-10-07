import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/scan")({
  head: () => ({ meta: [{ title: "Scan X-Ray — PneumoScan AI" }, { name: "description", content: "Scan X-Ray in PneumoScan AI." }, { property: "og:title", content: "Scan X-Ray — PneumoScan AI" }, { property: "og:description", content: "Scan X-Ray in PneumoScan AI." }] }),
  component: ScanPage,
});

function ScanPage() {
  return (
    <div>
      <h1 className="text-3xl">Scan X-Ray</h1>
      <p className="mt-4 text-muted-foreground">This page has not been built yet.</p>
    </div>
  );
}
