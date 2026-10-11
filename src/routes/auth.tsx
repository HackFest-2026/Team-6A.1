import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Stethoscope, User } from "lucide-react";
import { resolvePostAuthDestination } from "@/lib/role-redirect";

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

type Role = "patient" | "doctor" | null;

function AuthPage() {
  const navigate = useNavigate();
  const [role, setRole] = useState<Role>(null);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const [pw, setPw] = useState("");

  useEffect(() => {
    // If already signed in, resolve the correct destination from the DB.
    // Pass the current role selection as intent so a new doctor who
    // verified email in this same tab still lands on /doctor-portal.
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        const dest = await resolvePostAuthDestination(data.user.id, role);
        navigate({ to: dest, replace: true });
      }
    });
    const { data } = supabase.auth.onAuthStateChange(async (e, session) => {
      if (e === "SIGNED_IN" && session?.user) {
        const dest = await resolvePostAuthDestination(session.user.id, role);
        navigate({ to: dest, replace: true });
      }
    });
    return () => data.subscription.unsubscribe();
  }, [navigate, role]);

  function chooseRole(r: Role) {
    // UI convenience only — actual destination is always resolved from the DB
    // in auth-callback.tsx and never from any client-side storage.
    setRole(r);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    // Embed the role intent as a query param so it survives the email link
    // being opened in a new tab (where sessionStorage would be empty).
    // This is only used for UX navigation — security is enforced by the DB.
    const intentParam = role === "doctor" ? "?intent=doctor" : "";
    const isLocalhost =
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
    const baseOrigin = isLocalhost ? "http://localhost:3000" : window.location.origin;
    const redirectTo = `${baseOrigin}/auth-callback${intentParam}`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
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

  /* ── Step 1: Role chooser ── */
  if (!role) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-hero px-4">
        <div className="w-full max-w-sm rounded-xl border bg-card p-8 shadow-card">
          <Link to="/" className="font-display text-xl">PneumoScan<span className="text-primary"> AI</span></Link>
          <h1 className="mt-6 text-2xl">Who are you signing in as?</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose your role. Access to clinical tools is determined by your database role, not by this selection alone.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              id="role-patient"
              onClick={() => chooseRole("patient")}
              className="flex flex-col items-center gap-3 rounded-xl border-2 border-transparent bg-muted/50 p-5 text-sm font-medium transition-all hover:border-primary hover:bg-primary/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <User className="size-8 text-primary" />
              Continue as Patient
            </button>
            <button
              id="role-doctor"
              onClick={() => chooseRole("doctor")}
              className="flex flex-col items-center gap-3 rounded-xl border-2 border-transparent bg-muted/50 p-5 text-sm font-medium transition-all hover:border-primary hover:bg-primary/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Stethoscope className="size-8 text-primary" />
              Continue as Doctor
            </button>
          </div>
          <Link to="/staff" className="mt-6 block text-center text-[11px] text-muted-foreground/60 hover:underline">Staff</Link>
        </div>
      </div>
    );
  }

  /* ── Step 2: Email sign-in ── */
  return (
    <div className="flex min-h-screen items-center justify-center bg-hero px-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-8 shadow-card">
        <Link to="/" className="font-display text-xl">PneumoScan<span className="text-primary"> AI</span></Link>
        <div className="mt-4 flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          {role === "doctor" ? <Stethoscope className="size-3.5 shrink-0" /> : <User className="size-3.5 shrink-0" />}
          Signing in as <span className="font-semibold capitalize text-foreground">{role}</span>
          <button className="ml-auto underline" onClick={() => setRole(null)}>Change</button>
        </div>
        <h1 className="mt-4 text-2xl">{sent ? "Check your email" : "Sign in or create account"}</h1>
        {sent ? (
          <div className="mt-6 space-y-4 text-sm">
            <p>We sent a secure sign-in link to <b>{email}</b>. Open it on this device to proceed.</p>
            <p className="text-muted-foreground">The link works once and expires after a short time.</p>
            <Button variant="outline" className="w-full" disabled={busy} onClick={send}>Resend link</Button>
            <button type="button" className="w-full text-muted-foreground underline" onClick={() => setSent(false)}>Use a different email</button>
          </div>
        ) : (
          <form onSubmit={send} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
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
        <Link to="/staff" className="mt-6 block text-center text-[11px] text-muted-foreground/60 hover:underline">Staff</Link>
      </div>
    </div>
  );
}
