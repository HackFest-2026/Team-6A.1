import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { pageHead } from "@/lib/page-head";
import { profileQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => pageHead("Profile", "Manage your name, phone and date of birth."),
  loader: ({ context }) => context.queryClient.ensureQueryData(profileQuery),
  component: ProfilePage,
});

function ProfilePage() {
  const { data } = useSuspenseQuery(profileQuery);
  const qc = useQueryClient();
  const [f, setF] = useState({ full_name: data.profile?.full_name ?? "", phone: data.profile?.phone ?? "", date_of_birth: data.profile?.date_of_birth ?? "" });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("profiles").upsert({ id: data.id, full_name: f.full_name || null, phone: f.phone || null, date_of_birth: f.date_of_birth || null });
    if (error) toast.error(error.message); else { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["profile"] }); }
  }
  return (
    <form onSubmit={save} className="max-w-md space-y-4">
      <h1 className="text-3xl">Profile</h1>
      <div className="space-y-1"><Label htmlFor="n">Full name</Label><Input id="n" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></div>
      <div className="space-y-1"><Label htmlFor="p">Phone</Label><Input id="p" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
      <div className="space-y-1"><Label htmlFor="d">Date of birth</Label><Input id="d" type="date" value={f.date_of_birth} onChange={(e) => setF({ ...f, date_of_birth: e.target.value })} /></div>
      <Button>Save</Button>
    </form>
  );
}
