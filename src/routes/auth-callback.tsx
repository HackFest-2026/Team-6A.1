import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

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

/** Verifies the single-use email link (any format Supabase sends) and goes straight to the dashboard. */
function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const url = new URL(window.location.href);
      const q = url.searchParams;
      const h = new URLSearchParams(url.hash.replace(/^#/, ""));
      const errDesc = q.get("error_description") ?? h.get("error_description");
      if (errDesc) { setError(errDesc.replace(/\+/g, " ")); return; }
      try {
        const code = q.get("code");
        const tokenHash = q.get("token_hash");
        const at = h.get("access_token"), rt = h.get("refresh_token");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (tokenHash) {
          const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: (q.get("type") as EmailOtpType) ?? "email" });
          if (error) throw error;
        } else if (at && rt) {
          const { error } = await supabase.auth.setSession({ access_token: at, refresh_token: rt });
          if (error) throw error;
        }
        const { data } = await supabase.auth.getUser();
        if (!data.user) throw new Error("This sign-in link is invalid or has expired.");
        window.history.replaceState(null, "", "/auth-callback");
        navigate({ to: "/dashboard", replace: true });
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
            Signing you in…
          </div>
        )}
      </div>
    </div>
  );
}
