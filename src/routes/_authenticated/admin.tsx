import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { pageHead } from "@/lib/page-head";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => pageHead("Admin review", "Review and verify doctor applications."),
  component: AdminPage,
});

function AdminPage() {
  const { isAdmin, user, loading } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["doctors", "all"], enabled: isAdmin, queryFn: async () => {
    const { data, error } = await supabase.from("doctors").select("*").order("created_at", { ascending: false });
    if (error) throw error; return data;
  } });
  if (loading) return null;
  if (!isAdmin) return <p>Admins only.</p>;
  async function review(id: string, status: "VERIFIED" | "REJECTED" | "UNDER_REVIEW") {
    const rejection_reason = status === "REJECTED" ? prompt("Reason for rejection?") ?? "Not specified" : null;
    const { error } = await supabase.from("doctors").update({ status, rejection_reason, reviewed_by: user!.id, reviewed_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success(`Marked ${status}`); qc.invalidateQueries({ queryKey: ["doctors"] }); }
  }
  const rows = q.data ?? [];
  return (
    <div className="space-y-6">
      <h1 className="text-3xl">Admin review</h1>
      <p className="text-sm text-muted-foreground">{rows.filter((r) => r.status === "PENDING" || r.status === "UNDER_REVIEW").length} awaiting review · {rows.filter((r) => r.status === "VERIFIED").length} verified</p>
      <form className="flex flex-wrap gap-2 rounded-xl border bg-card p-4 text-sm" onSubmit={async (e) => {
        e.preventDefault(); const f = e.currentTarget; const email = (new FormData(f).get("email") as string) ?? "";
        const { error } = await supabase.rpc("grant_admin", { _email: email });
        if (error) toast.error(error.message); else { toast.success(`${email} is now an admin`); f.reset(); }
      }}>
        <input name="email" type="email" required placeholder="Existing account email" className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2" />
        <Button size="sm" type="submit">Make admin</Button>
      </form>
      <ul className="space-y-3">{rows.map((d) => (
        <li key={d.id} className="rounded-xl border bg-card p-4 text-sm">
          <p className="font-medium">{d.full_name} <span className="ml-2 rounded bg-muted px-2 py-0.5 text-xs">{d.status}</span></p>
          <p className="text-muted-foreground">Reg. {d.registration_number} · {d.council} · {d.qualification} · {d.specialization} · {d.clinic}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => review(d.id, "VERIFIED")}>Verify</Button>
            <Button size="sm" variant="outline" onClick={() => review(d.id, "UNDER_REVIEW")}>Under review</Button>
            <Button size="sm" variant="ghost" onClick={() => review(d.id, "REJECTED")}>Reject</Button>
          </div>
        </li>))}</ul>
    </div>
  );
}
