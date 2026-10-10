import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { pageHead } from "@/lib/page-head";
import { tierLabel, usePremium } from "@/lib/premium";

export const Route = createFileRoute("/_authenticated/premium")({
  head: () => pageHead("Premium Membership", "Compare Free and Premium plans for PneumoScan AI."),
  validateSearch: (s: Record<string, unknown>): { payment?: string } => (typeof s["payment"] === "string" ? { payment: s["payment"] } : {}),
  component: PremiumPage,
});

const PRICE = 59;
const RAZORPAY_KEY = (import.meta.env["VITE_RAZORPAY_KEY_ID"] as string | undefined) || null;

const FREE = ["Single X-ray screening", "Scan history", "Basic PDF report", "Find & book doctors"];
const PREMIUM = ["Grad-CAM attention maps", "AI explanation", "X-ray comparison", "Advanced PDF reports", "Bulk scanning (up to 20)", "Advanced analytics", "API access"];

function PremiumPage() {
  const { tier, isPremium } = usePremium();
  const { payment } = Route.useSearch();
  const qc = useQueryClient();

  async function activateDemo() {
    const { error } = await supabase.rpc("activate_premium_demo");
    if (error) toast.error(error.message);
    else { toast.success("Premium Demo activated — no payment taken"); qc.invalidateQueries({ queryKey: ["subscription"] }); }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl">Premium Membership</h1>
      <p className="text-sm">Current plan: <b>{tierLabel(tier)}</b></p>
      {payment === "success" && <p className="rounded-md border bg-muted p-3 text-sm">Payment received. Premium unlocks once the payment is confirmed.</p>}
      {payment === "failed" && <p className="rounded-md border border-destructive p-3 text-sm text-destructive">Payment failed or was cancelled. You have not been charged.</p>}
      <div className="grid gap-6 md:grid-cols-3">
        <Plan title="Grad-CAM only" price="₹9 per image" features={["Real attention heatmap for one scan", "Unlock from the scan result"]} current={false} />
        <Plan title="Free" price="₹0" features={FREE} current={tier === "free"} />
        <Plan title="Premium" price={PRICE ? `₹${PRICE.toLocaleString("en-IN")} / month` : "Price not set yet"} features={PREMIUM} current={isPremium}>
          <Button className="w-full" disabled={!PRICE || !RAZORPAY_KEY || tier === "premium_paid"}>
            {tier === "premium_paid" ? "You're on Premium" : "Upgrade to Premium"}
          </Button>
          {(!PRICE || !RAZORPAY_KEY) && <p className="text-xs text-muted-foreground">Online payment isn't switched on yet. Use Premium Demo below to try every feature.</p>}
          {!isPremium && <Button variant="outline" className="w-full" onClick={activateDemo}>Try Premium Demo (free)</Button>}
        </Plan>
      </div>
      <p className="text-xs text-muted-foreground">Premium Demo is for demonstrations only — no money is taken and it is never counted as a paid plan.</p>
    </div>
  );
}

function Plan({ title, price, features, current, children }: { title: string; price: string; features: string[]; current: boolean; children?: React.ReactNode }) {
  return (
    <div className="space-y-4 rounded-xl border bg-card p-6 shadow-card">
      <div className="flex items-center justify-between"><h2 className="text-xl">{title}</h2>{current && <span className="rounded bg-primary px-2 py-0.5 text-xs text-primary-foreground">Current</span>}</div>
      <p className="font-display text-2xl">{price}</p>
      <ul className="space-y-2 text-sm">{features.map((f) => <li key={f} className="flex gap-2"><Check className="size-4 text-primary" />{f}</li>)}</ul>
      {children}
    </div>
  );
}
