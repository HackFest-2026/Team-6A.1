import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { resolvePostAuthDestination } from "@/lib/role-redirect";

export const Route = createFileRoute("/auth-callback")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Signing you in — PneumoScan AI" },
      { name: "description", content: "Verifying your PneumoScan AI sign-in link." },
      { property: "og:title", content: "Signing you in — PneumoScan AI" },
      { property: "og:description", content: "Verifying your sign-in link." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthCallback,
});

/**
 * Handles every Supabase email link format:
 *   • PKCE code exchange  (?code=…)
 *   • Token hash (OTP)    (?token_hash=…&type=…)
 *   • Legacy implicit     (#access_token=…&refresh_token=…)
 *
 * Routing after a valid session:
 *   admin   → /admin
 *   doctor  → /doctor-portal  (verified AND unverified; component renders the right view)
 *   new doctor applicant (no record yet, intent=doctor in URL) → /doctor-portal (Apply form)
 *   patient → /dashboard
 *
 * Security: roles are ALWAYS resolved from the database. The ?intent= param is
 * only used so a brand-new applicant who opens the link in a new tab still
 * lands on the Apply form instead of /dashboard. It never grants data access —
 * the doctor-portal beforeLoad guard enforces that independently.
 */
function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const url = new URL(window.location.href);
      const q = url.searchParams;
      const h = new URLSearchParams(url.hash.replace(/^#/, ""));

      // ── 0. Read intent BEFORE cleaning the URL ────────────────────────────
      // ?intent=doctor is embedded by auth.tsx when the user chose "Continue
      // as Doctor". It survives the email link even when opened in a new tab.
      const intent = q.get("intent");

      // Surface any provider-level errors immediately.
      const errDesc = q.get("error_description") ?? h.get("error_description");
      if (errDesc) { setError(errDesc.replace(/\+/g, " ")); return; }

      try {
        // ── 1. Exchange / verify the link token ──────────────────────────────
        const code = q.get("code");
        const tokenHash = q.get("token_hash");
        const at = h.get("access_token"), rt = h.get("refresh_token");

        if (code) {
          // PKCE code exchange (newer Supabase clients / email OTP confirmation)
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (tokenHash) {
          // Token-hash OTP (magic link)
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: (q.get("type") as EmailOtpType) ?? "email",
          });
          if (error) throw error;
        } else if (at && rt) {
          // Legacy implicit-flow fragment (older Supabase links)
          const { error } = await supabase.auth.setSession({ access_token: at, refresh_token: rt });
          if (error) throw error;
        }
        // If none of the above tokens were present the session may already be
        // set (e.g. link clicked twice). Fall through to getUser().

        // ── 2. Confirm the session is valid ──────────────────────────────────
        const { data } = await supabase.auth.getUser();
        if (!data.user) throw new Error("This sign-in link is invalid or has expired.");

        // ── 3. Clean the URL (remove all token/intent params from history) ───
        window.history.replaceState(null, "", "/auth-callback");

        // ── 4. Resolve destination from the DB ───────────────────────────────
        // intent is passed only for new applicants with no doctor record yet.
        // It is never used for security decisions — the route guard handles that.
        const destination = await resolvePostAuthDestination(data.user.id, intent);
        navigate({ to: destination, replace: true });

      } catch (e) {
        setError(e instanceof Error ? e.message : "This sign-in link is invalid or has expired.");
      }
    })();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-hero px-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-8 text-center shadow-card">
        <p className="font-display text-xl">PneumoScan<span className="text-primary"> AI</span></p>
        {error ? (
          <>
            <p className="mt-6 text-sm">This sign-in link has expired or was already used.</p>
            <p className="mt-2 text-xs text-muted-foreground">{error}</p>
            <Button asChild className="mt-6 w-full"><Link to="/auth">Send a new link</Link></Button>
          </>
        ) : (
          <div className="mt-6 flex flex-col items-center gap-3 text-sm text-muted-foreground">
            <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            Verifying and signing you in…
          </div>
        )}
      </div>
    </div>
  );
}
