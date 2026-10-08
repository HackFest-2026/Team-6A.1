import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { pageHead } from "@/lib/page-head";
import { clearHistory } from "@/lib/scans";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => pageHead("Settings", "Clear your scan history or sign out."),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  async function clear() {
    if (!confirm("Delete all your saved scans? This cannot be undone.")) return;
    const { data } = await supabase.auth.getUser(); if (!data.user) return;
    try { await clearHistory(supabase, data.user.id); qc.invalidateQueries({ queryKey: ["scans"] }); toast.success("History cleared"); }
    catch { toast.error("Could not clear history"); }
  }
  async function signOut() { qc.clear(); await supabase.auth.signOut(); navigate({ to: "/auth", replace: true }); }
  return (
    <div className="max-w-md space-y-6">
      <h1 className="text-3xl">Settings</h1>
      <div className="space-y-2 rounded-xl border bg-card p-5"><p className="font-medium">Delete my scan data</p><p className="text-sm text-muted-foreground">Removes every saved scan and thumbnail.</p><Button variant="destructive" onClick={clear}>Delete all scans</Button></div>
      <div className="space-y-2 rounded-xl border bg-card p-5"><p className="font-medium">Sign out</p><Button variant="outline" onClick={signOut}>Sign out</Button></div>
    </div>
  );
}
