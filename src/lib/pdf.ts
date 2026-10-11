import { MODEL_DISPLAY_NAME, REPORT_METRICS, THRESHOLD, DATA_LIMITATION, DISCLAIMER, PERFORMANCE_NOTE } from "@/lib/classifier/constants";
import { isValidCompleted } from "@/lib/classifier/result";
import { rowToResult, type ScanRow } from "@/lib/scans";

export interface ClinicalReviewDetails {
  doctorName?: string;
  specialization?: string;
  qualification?: string;
  registrationNumber?: string;
  clinic?: string;
  notes?: string;
  reviewedAt?: string;
  status?: string;
}

export async function downloadScanReport(row: ScanRow, clinicalReview?: ClinicalReviewDetails) {
  const result = rowToResult(row);
  if (!isValidCompleted(result)) throw new Error("Invalid result; report not generated");
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  let y = 50;
  const line = (t: string, size = 11, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(t, W - 100);
    doc.text(lines, 50, y);
    y += lines.length * size * 1.35 + 6;
  };

  line("PneumoScan AI — Clinical Screening Report", 18, true);
  line(`Report generated: ${new Date().toLocaleString()}`, 9);
  y += 6;

  if (clinicalReview?.doctorName) {
    line("Verified Medical Practitioner Review", 13, true);
    line(`Attending Physician: Dr. ${clinicalReview.doctorName} (${clinicalReview.qualification || "MD"})`);
    if (clinicalReview.specialization) line(`Specialty: ${clinicalReview.specialization}`);
    if (clinicalReview.registrationNumber) line(`Registration / License: ${clinicalReview.registrationNumber}`);
    if (clinicalReview.clinic) line(`Institution / Clinic: ${clinicalReview.clinic}`);
    if (clinicalReview.reviewedAt) line(`Review Timestamp: ${new Date(clinicalReview.reviewedAt).toLocaleString()}`);
    if (clinicalReview.notes) {
      y += 4;
      line("Clinical Findings & Recommendations:", 11, true);
      line(`"${clinicalReview.notes}"`, 10);
    }
    y += 10;
  }

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
  line(REPORT_METRICS);
  line(PERFORMANCE_NOTE);
  y += 10;
  line("Disclaimer", 12, true);
  line(DISCLAIMER);
  doc.save(`pneumoscan-report-${row.id.slice(0, 8)}.pdf`);
}
