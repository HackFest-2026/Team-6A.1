import { MODEL_DISPLAY_NAME, THRESHOLD, DATA_LIMITATION, DISCLAIMER, PERFORMANCE_NOTE } from "@/lib/classifier/constants";
import { isValidCompleted } from "@/lib/classifier/result";
import { rowToResult, type ScanRow } from "@/lib/scans";

export async function downloadScanReport(row: ScanRow) {
  const result = rowToResult(row);
  if (!isValidCompleted(result)) throw new Error("Invalid result; report not generated");
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  let y = 60;
  const line = (t: string, size = 11, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(t, W - 100);
    doc.text(lines, 50, y);
    y += lines.length * size * 1.35 + 6;
  };
  line("PneumoScan AI - Screening Report", 18, true);
  line(`Generated ${new Date().toLocaleString()}`, 9);
  y += 8;
  line(`Scan time: ${new Date(row.created_at).toLocaleString()}`);
  line(`Screening result: ${result.prediction === "PNEUMONIA" ? "PNEUMONIA DETECTED" : "NO PNEUMONIA DETECTED"}`, 12, true);
  line(`Pneumonia probability (model output): ${(result.pneumoniaProbability * 100).toFixed(1)}% (threshold ${THRESHOLD})`);
  line(`Model: ${MODEL_DISPLAY_NAME}  Version: ${result.model.version}`);
  y += 6;
  line("What this means", 12, true);
  line(result.prediction === "PNEUMONIA"
    ? "The model's pneumonia probability is at or above the screening threshold. Please have the X-ray reviewed by a doctor."
    : "The model's pneumonia probability is below the screening threshold. This does not rule out disease; see a doctor if you have symptoms.");
  if (row.gradcam) {
    y += 6;
    line("Grad-CAM attention map", 12, true);
    doc.addImage(row.gradcam, "JPEG", 50, y, 180, 180);
    y += 190;
    line("Shows where the model focused, not confirmed lesion locations.", 9);
  }
  line(`Scan ID: ${row.id}`, 9);
  y += 10;
  line("Limitations", 12, true);
  line(DATA_LIMITATION);
  line(PERFORMANCE_NOTE);
  y += 10;
  line("Disclaimer", 12, true);
  line(DISCLAIMER);
  doc.save(`pneumoscan-report-${row.id.slice(0, 8)}.pdf`);
}
