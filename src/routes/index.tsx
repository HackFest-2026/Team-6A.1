import { createFileRoute, Link } from "@tanstack/react-router";
import { Lock, ScanLine, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Disclaimers } from "@/components/Disclaimers";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PneumoScan AI — In-browser chest X-ray screening support" },
      { name: "description", content: "Screen a chest X-ray for pneumonia patterns in your browser. Screening support only, not a diagnosis." },
      { property: "og:title", content: "PneumoScan AI — Chest X-ray screening support" },
      { property: "og:description", content: "In-browser AI screening for pneumonia patterns on chest X-rays. Not a diagnosis." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-hero">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <span className="font-display text-xl">PneumoScan<span className="text-primary"> AI</span></span>
        <nav className="flex items-center gap-4 text-sm">
          <Link to="/status" className="text-muted-foreground hover:text-foreground">System status</Link>
          <Button asChild size="sm"><Link to="/auth">Sign in</Link></Button>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-6 pb-20 pt-12">
        <p className="font-mono text-xs uppercase tracking-widest text-primary">Screening support · not a diagnosis</p>
        <h1 className="mt-4 max-w-3xl text-5xl leading-tight md:text-6xl">A second look at chest X-rays, right in your browser.</h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          PneumoScan AI runs a screening model on your device to flag possible pneumonia patterns. Your image never leaves your browser — only the result is saved to your history.
        </p>
        <div className="mt-8 flex gap-3">
          <Button asChild size="lg"><Link to="/auth">Start screening</Link></Button>
          <Button asChild size="lg" variant="outline"><Link to="/status">How it works</Link></Button>
        </div>
        <div className="mt-16 grid gap-4 md:grid-cols-3">
          {[
            { i: ScanLine, t: "Runs on your device", d: "The model loads once and runs locally." },
            { i: Lock, t: "Images stay private", d: "Only label, probability and a small thumbnail are stored." },
            { i: ShieldCheck, t: "Reviewed doctors", d: "Doctors are manually verified before getting a badge." },
          ].map(({ i: I, t, d }) => (
            <div key={t} className="rounded-lg border bg-card p-5 shadow-card">
              <I className="size-5 text-primary" />
              <p className="mt-3 font-medium">{t}</p>
              <p className="text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
        <div className="mt-12 max-w-3xl"><Disclaimers /></div>
      </main>
    </div>
  );
}
