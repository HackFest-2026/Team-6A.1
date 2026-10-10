import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — PneumoScan AI" },
      { name: "description", content: "Sign in to PneumoScan AI with a secure link sent to your email." },
      { property: "og:title", content: "Sign in — PneumoScan AI" },
      { property: "og:description", content: "Passwordless email link sign-in." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const [pw, setPw] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { if (data.user) navigate({ to: "/dashboard", replace: true }); });
    const { data } = supabase.auth.onAuthStateChange((e) => { if (e === "SIGNED_IN") navigate({ to: "/dashboard", replace: true }); });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function send(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + "/auth-callback" } });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setSent(true);
  }
  async function pwLogin() {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    setBusy(false);
    if (error) toast.error(error.message);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-hero px-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-8 shadow-card">
        <Link to="/" className="font-display text-xl">PneumoScan<span className="text-primary"> AI</span></Link>
        <h1 className="mt-6 text-2xl">{sent ? "Check your email" : "Sign in or create account"}</h1>
        {sent ? (
          <div className="mt-6 space-y-4 text-sm">
            <p>We sent a secure sign-in link to <b>{email}</b>. Open it on this device to go straight to your dashboard.</p>
            <p className="text-muted-foreground">The link works once and expires after a short time.</p>
            <Button variant="outline" className="w-full" disabled={busy} onClick={send}>Resend link</Button>
            <button type="button" className="w-full text-muted-foreground underline" onClick={() => setSent(false)}>Use a different email</button>
          </div>
        ) : (
          <form onSubmit={send} className="mt-6 space-y-4">
            <div className="space-y-2"><Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <Button className="w-full" disabled={busy}>Email me a sign-in link</Button>
            {!showDemo ? (
              <button type="button" className="w-full text-xs text-muted-foreground underline" onClick={() => setShowDemo(true)}>Demo account sign-in</button>
            ) : (
              <div className="space-y-2 border-t pt-4">
                <Label htmlFor="pw">Demo account password</Label>
                <Input id="pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
                <Button type="button" variant="outline" className="w-full" disabled={busy || !pw || !email} onClick={pwLogin}>Sign in to demo account</Button>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
