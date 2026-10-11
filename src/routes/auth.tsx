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
  const [agreed, setAgreed] = useState(true);

  useEffect(() => {
    // If already signed in, resolve the correct destination from the DB.
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
    setRole(r);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!agreed) {
      toast.error("Please acknowledge the medical disclaimer to proceed.");
      return;
    }
    setBusy(true);
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
      <div className="flex min-h-screen items-center justify-center bg-hero px-4 py-8">
        <div className="w-full max-w-md rounded-xl border bg-card p-6 sm:p-8 shadow-card space-y-6">
          <div>
            <Link to="/" className="font-display text-xl">PneumoScan<span className="text-primary"> AI</span></Link>
            <h1 className="mt-4 text-2xl font-bold tracking-tight">Select your portal</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose your role to continue. Access to clinical tools is determined by your verified credentials.
            </p>
          </div>

          {/* Initial Disclaimer Card */}
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-900 dark:text-amber-200 space-y-1">
            <p className="font-semibold text-amber-800 dark:text-amber-300">
              ⚠️ Medical Disclaimer & Privacy Notice
            </p>
            <p className="leading-relaxed">
              PneumoScan AI provides investigational screening support and is <b>not a substitute for professional medical diagnosis</b>. Chest X-ray images are processed on your local device.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              id="role-patient"
              onClick={() => chooseRole("patient")}
              className="flex flex-col items-center gap-2.5 rounded-xl border-2 border-transparent bg-muted/50 p-4 text-sm font-medium transition-all hover:border-primary hover:bg-primary/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <User className="size-7 text-primary" />
              <span>Continue as Patient</span>
            </button>
            <button
              id="role-doctor"
              onClick={() => chooseRole("doctor")}
              className="flex flex-col items-center gap-2.5 rounded-xl border-2 border-transparent bg-muted/50 p-4 text-sm font-medium transition-all hover:border-primary hover:bg-primary/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Stethoscope className="size-7 text-primary" />
              <span>Continue as Doctor</span>
            </button>
          </div>

          <div className="border-t pt-4 text-center">
            <Link to="/staff" className="text-xs text-muted-foreground/70 hover:underline">Staff Sign In</Link>
          </div>
        </div>
      </div>
    );
  }

  /* ── Step 2: Email sign-in ── */
  return (
    <div className="flex min-h-screen items-center justify-center bg-hero px-4 py-8">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 sm:p-8 shadow-card space-y-5">
        <div>
          <Link to="/" className="font-display text-xl">PneumoScan<span className="text-primary"> AI</span></Link>
          <div className="mt-3 flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
            {role === "doctor" ? <Stethoscope className="size-3.5 shrink-0" /> : <User className="size-3.5 shrink-0" />}
            Signing in as <span className="font-semibold capitalize text-foreground">{role}</span>
            <button className="ml-auto underline hover:text-foreground" onClick={() => setRole(null)}>Change</button>
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">
            {sent ? "Check your email inbox" : "Sign in with your Gmail"}
          </h1>
        </div>

        {sent ? (
          <div className="space-y-4 text-sm">
            <div className="rounded-lg border bg-muted/40 p-4">
              <p>We sent a secure passwordless sign-in link to <b>{email}</b>.</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Click the magic link in your Gmail inbox on this device to access your dashboard. The link expires shortly.
              </p>
            </div>
            <Button variant="outline" className="w-full text-xs" disabled={busy} onClick={send}>Resend link</Button>
            <button type="button" className="w-full text-xs text-muted-foreground underline" onClick={() => setSent(false)}>Use a different email</button>
          </div>
        ) : (
          <form onSubmit={send} className="space-y-4">
            {/* Prominent Initial Disclaimer & Gmail Purpose Notice */}
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-900 dark:text-amber-200 space-y-1.5">
              <p className="font-semibold text-amber-800 dark:text-amber-300">
                ⚠️ Screening Disclaimer & Gmail Account Usage
              </p>
              <p className="leading-relaxed">
                PneumoScan AI is an <b>AI-assisted screening support tool</b> and does not make clinical diagnoses. Always consult a qualified medical doctor for medical advice.
              </p>
              <p className="text-[11px] leading-relaxed text-foreground/80 pt-0.5">
                🔒 <b>Why we take your Gmail account:</b> Your email is used exclusively to send your secure login link, associate your saved scan history, and provide appointment updates. Chest X-ray images are processed on your device and are never sold or shared.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-medium">Your Gmail / Email Address</Label>
              <Input
                id="email"
                type="email"
                required
                placeholder="name@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {/* Acknowledgment Checkbox */}
            <div className="flex items-start gap-2.5 pt-1 text-xs text-muted-foreground">
              <input
                type="checkbox"
                id="disclaimer-consent"
                required
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 size-4 rounded border-input text-primary accent-primary cursor-pointer"
              />
              <label htmlFor="disclaimer-consent" className="cursor-pointer leading-tight select-none">
                I understand this is an AI screening tool, not a medical diagnosis, and consent to using my Gmail for account login and notifications.
              </label>
            </div>

            <Button className="w-full" disabled={busy || !agreed || !email}>
              {busy ? "Sending secure link..." : "Email me a secure sign-in link"}
            </Button>

            {!showDemo ? (
              <button type="button" className="w-full text-xs text-muted-foreground underline pt-1" onClick={() => setShowDemo(true)}>
                Demo account sign-in
              </button>
            ) : (
              <div className="space-y-2 border-t pt-3">
                <Label htmlFor="pw" className="text-xs">Demo password</Label>
                <Input id="pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
                <Button type="button" variant="outline" className="w-full text-xs" disabled={busy || !pw || !email} onClick={pwLogin}>
                  Sign in with demo password
                </Button>
              </div>
            )}
          </form>
        )}

        <div className="border-t pt-3 text-center">
          <Link to="/staff" className="text-xs text-muted-foreground/60 hover:underline">Staff Access</Link>
        </div>
      </div>
    </div>
  );
}
