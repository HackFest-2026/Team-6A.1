import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — PneumoScan AI" }, { name: "description", content: "Settings in PneumoScan AI." }, { property: "og:title", content: "Settings — PneumoScan AI" }, { property: "og:description", content: "Settings in PneumoScan AI." }] }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div>
      <h1 className="text-3xl">Settings</h1>
      <p className="mt-4 text-muted-foreground">This page has not been built yet.</p>
    </div>
  );
}
