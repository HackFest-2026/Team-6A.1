import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { pageHead } from "@/lib/page-head";
import { tierLabel, usePremium } from "@/lib/premium";

export const Route = createFileRoute("/_authenticated/premium")({
  head: () => pageHead("Premium", "Unlock Grad-CAM, AI explanations, bulk scanning and more."),
  component: PremiumPage,
});

function PremiumPage() {
  const { tier, isPremium } = usePremium();
  const qc = useQueryClient();
  async function activate() {
    const { error } = await supabase.rpc("activate_premium_demo");
    if (error) toast.error(error.message);
    else { toast.success("Premium demo activated"); qc.invalidateQueries({ queryKey: ["subscription"] }); }
  }
  return (
    <div className="space-y-6">
      <h1 className="text-3xl">Premium</h1>
      <p className="text-sm">Current plan: <b>{tierLabel(tier)}</b></p>
      <ul className="list-disc pl-5 text-sm text-muted-foreground">
        <li>Grad-CAM attention heatmaps</li><li>AI explanation of results</li><li>Bulk X-ray scanning</li>
      </ul>
      {!isPremium && <Button onClick={activate}>Try Premium Demo</Button>}
      <p className="text-xs text-muted-foreground">Demo mode — no payment is taken.</p>
    </div>
  );
}
