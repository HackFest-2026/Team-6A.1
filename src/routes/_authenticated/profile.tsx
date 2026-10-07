import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — PneumoScan AI" }, { name: "description", content: "Profile in PneumoScan AI." }, { property: "og:title", content: "Profile — PneumoScan AI" }, { property: "og:description", content: "Profile in PneumoScan AI." }] }),
  component: ProfilePage,
});

function ProfilePage() {
  return (
    <div>
      <h1 className="text-3xl">Profile</h1>
      <p className="mt-4 text-muted-foreground">This page has not been built yet.</p>
    </div>
  );
}
