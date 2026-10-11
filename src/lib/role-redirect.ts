/**
 * role-redirect.ts
 *
 * Single source of truth for post-authentication redirect logic.
 * Called from:
 *   • auth-callback.tsx  – after verifying a magic-link email
 *   • auth.tsx           – when a user visits /auth while already signed in
 *
 * Routing priority:
 *   1. admin role                    → /admin
 *   2. existing doctor record        → /doctor-portal  (component handles VERIFIED vs PENDING)
 *   3. intent === "doctor" (new applicant, no record yet) → /doctor-portal  (Apply form)
 *   4. everyone else                 → /dashboard
 *
 * SECURITY NOTES:
 *   • The DB is the only trusted source for access decisions.
 *   • `intent` is only used for UI navigation of brand-new users who have
 *     no doctor record yet. It NEVER grants access to clinical data — the
 *     doctor-portal beforeLoad guard enforces that independently.
 *   • `intent` must come from the emailRedirectTo URL our own frontend set
 *     (never from localStorage, sessionStorage, or user-supplied params).
 */

import { supabase } from "@/integrations/supabase/client";

export type PostAuthDestination = "/admin" | "/doctor" | "/doctor/verification-status" | "/dashboard";

/**
 * @param userId   – authenticated Supabase user ID
 * @param intent   – optional UX hint embedded in the magic-link callback URL
 *                   ("doctor" | "patient"). Used only for first-time sign-ups
 *                   with no doctor record. Never used for security decisions.
 */
export async function resolvePostAuthDestination(
  userId: string,
  intent?: string | null,
): Promise<PostAuthDestination> {
  // ── 1. Admin check (highest privilege) ───────────────────────────────────
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (roles?.some((r) => r.role === "admin")) return "/admin";

  // ── 2. Existing doctor record
  //       Verified doctors go to /doctor; unverified go to /doctor/verification-status.
  const { data: doctorRow } = await supabase
    .from("doctors")
    .select("id, status")
    .eq("user_id", userId)
    .maybeSingle();

  if (doctorRow) {
    if (doctorRow.status === "VERIFIED") return "/doctor";
    return "/doctor/verification-status";
  }

  // ── 3. New applicant: no record yet but signed up via the doctor flow.
  //       Route to the registration / verification status page.
  if (intent === "doctor") return "/doctor/verification-status";

  // ── 4. Default: patient dashboard.
  return "/dashboard";
}
