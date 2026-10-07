import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { APP_VERSION, MODEL_ID, MODEL_VERSION, THRESHOLD } from "@/lib/classifier/constants";
import { loadModel, modelStatus } from "@/lib/classifier/model";
import { Disclaimers } from "@/components/Disclaimers";

export const Route = createFileRoute("/status")({
  head: () => ({
    meta: [
      { title: "System status — PneumoScan AI" },
      { name: "description", content: "Verified facts about the PneumoScan AI screening model and what is not implemented." },
      { property: "og:title", content: "System status — PneumoScan AI" },
      { property: "og:description", content: "Model load state, app version and feature availability." },
    ],
  }),
  component: StatusPage,
});

function StatusPage() {
  const [, force] = useState(0);
  const [progress, setProgress] = useState<number | null>(null);
  useEffect(() => { const t = setInterval(() => force((n) => n + 1), 1000); return () => clearInterval(t); }, []);
  const rows: [string, string][] = [
    ["Model loaded in this browser session", modelStatus.loaded ? "Yes" : "No"],
    ["Last load time", modelStatus.lastLoadedAt ? modelStatus.lastLoadedAt.toLocaleString() : "—"],
    ["Last load error", modelStatus.lastError ?? "—"],
    ["Model", `${MODEL_ID} v${MODEL_VERSION}`],
    ["Decision threshold", String(THRESHOLD)],
    ["App version", APP_VERSION],
  ];
  const notImpl = ["Payments / billing", "Grad-CAM heatmaps", "Automatic doctor verification", "LLM-based classification"];
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link to="/" className="text-sm text-muted-foreground">← Home</Link>
      <h1 className="mt-4 text-4xl">System status</h1>
      <table className="mt-8 w-full text-sm">
        <tbody>{rows.map(([k, v]) => (
          <tr key={k} className="border-b"><td className="py-3 text-muted-foreground">{k}</td><td className="py-3 text-right font-mono">{v}</td></tr>
        ))}</tbody>
      </table>
      {!modelStatus.loaded && (
        <div className="mt-6 space-y-3">
          <Button variant="outline" onClick={() => { setProgress(0); loadModel(setProgress).catch(() => setProgress(null)); }}>Load model now</Button>
          {progress !== null && <Progress value={progress * 100} />}
        </div>
      )}
      <h2 className="mt-12 text-2xl">Not implemented</h2>
      <ul className="mt-4 space-y-2 text-sm">{notImpl.map((n) => (
        <li key={n} className="flex justify-between border-b py-2"><span>{n}</span><span className="font-mono text-muted-foreground">not implemented</span></li>
      ))}</ul>
      <div className="mt-12"><Disclaimers /></div>
    </div>
  );
}
