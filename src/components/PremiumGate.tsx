import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { usePremium } from "@/lib/premium";

export function PremiumGate({ feature, children }: { feature: string; children: ReactNode }) {
  const { isPremium, loading } = usePremium();
  if (loading) return null;
  if (isPremium) return <>{children}</>;
  return (
    <div className="rounded-xl border bg-card p-6 text-sm">
      <p className="flex items-center gap-2 font-medium"><Sparkles className="size-4 text-primary" />{feature} is a Premium feature</p>
      <p className="mt-1 text-muted-foreground">Try Premium in demo mode — no payment needed.</p>
      <Button asChild size="sm" className="mt-3"><Link to="/premium">See Premium</Link></Button>
    </div>
  );
}
