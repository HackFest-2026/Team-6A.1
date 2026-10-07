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
      { name: "description", content: "Sign in to PneumoScan AI with a one-time code sent to your email." },
      { property: "og:title", content: "Sign in — PneumoScan AI" },
      { property: "og:description", content: "Email one-time code sign-in." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { if (data.user) navigate({ to: "/dashboard", replace: true }); });
    const { data } = supabase.auth.onAuthStateChange((e) => { if (e === "SIGNED_IN") navigate({ to: "/dashboard", replace: true }); });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function send(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + "/auth" } });
    setBusy(false);
    if (error) return toast.error(error.message);
    setSent(true); toast.success("Check your email for the sign-in code.");
  }
  async function verify(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: "email" });
    setBusy(false);
    if (error) toast.error(error.message);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-hero px-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-8 shadow-card">
        <Link to="/" className="font-display text-xl">PneumoScan<span className="text-primary"> AI</span></Link>
        <h1 className="mt-6 text-2xl">{sent ? "Enter your code" : "Sign in or create account"}</h1>
        {!sent ? (
          <form onSubmit={send} className="mt-6 space-y-4">
            <div className="space-y-2"><Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <Button className="w-full" disabled={busy}>Send code</Button>
          </form>
        ) : (
          <form onSubmit={verify} className="mt-6 space-y-4">
            <p className="text-sm text-muted-foreground">We emailed {email}. Enter the code, or open the link in that email.</p>
            <div className="space-y-2"><Label htmlFor="code">Code</Label>
              <Input id="code" inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={(e) => setCode(e.target.value)} className="font-mono tracking-widest" /></div>
            <Button className="w-full" disabled={busy}>Verify</Button>
            <button type="button" className="w-full text-sm text-muted-foreground underline" onClick={() => setSent(false)}>Use a different email</button>
          </form>
        )}
      </div>
    </div>
  );
}
