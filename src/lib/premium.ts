import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Tier = "free" | "premium_demo" | "premium_paid";

export const subscriptionQuery = queryOptions({
  queryKey: ["subscription"],
  queryFn: async (): Promise<Tier> => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return "free";
    const { data } = await supabase.from("subscriptions").select("tier").eq("user_id", u.user.id).maybeSingle();
    return (data?.tier as Tier | undefined) ?? "free";
  },
});

export function isPremiumTier(t: Tier | undefined) {
  return t === "premium_demo" || t === "premium_paid";
}

export function usePremium() {
  const q = useQuery(subscriptionQuery);
  return { tier: q.data ?? "free", isPremium: isPremiumTier(q.data), isDemo: q.data === "premium_demo", loading: q.isLoading };
}

export function tierLabel(t: Tier) {
  return t === "premium_demo" ? "Premium • Demo Mode" : t === "premium_paid" ? "Premium" : "Free";
}
