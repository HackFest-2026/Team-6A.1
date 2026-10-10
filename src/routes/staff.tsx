import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/staff")({
  head: () => ({
    meta: [
      { title: "Staff sign-in — PneumoScan AI" },
      { name: "description", content: "Sign-in for PneumoScan AI staff." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Staff sign-in — PneumoScan AI" },
      { property: "og:description", content: "Sign-in for PneumoScan AI staff." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StaffLogin,
});

/** Separate admin entry. Access is decided only by the admin role stored in the database. */
function StaffLogin() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pw });
    if (error || !data.user) { setErr("Incorrect email or password."); setBusy(false); return; }
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id).eq("role", "admin");
    if (!roles?.length) { await supabase.auth.signOut(); setErr("This account does not have staff access."); setBusy(false); return; }
    nav({ to: "/admin" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-8 shadow-card">
        <Link to="/" className="font-display text-xl">PneumoScan<span className="text-primary"> AI</span></Link>
        <h1 className="text-2xl">Staff sign-in</h1>
        <div className="space-y-2"><Label htmlFor="se">Email</Label><Input id="se" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="sp">Password</Label><Input id="sp" type="password" required value={pw} onChange={(e) => setPw(e.target.value)} /></div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <Button className="w-full" disabled={busy}>{busy ? "Checking…" : "Sign in"}</Button>
      </form>
    </div>
  );
}
