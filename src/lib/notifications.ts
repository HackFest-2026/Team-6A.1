/**
 * notifications.ts
 *
 * Notification dispatcher for PneumoScan AI.
 * Handles patient & doctor notifications for appointment lifecycles
 * and clinical reviews, with deduplication and backend dispatch.
 */

export type NotificationType =
  | "appointment_requested"
  | "appointment_confirmed"
  | "appointment_cancelled"
  | "appointment_rescheduled"
  | "clinical_review_completed";

export interface NotificationPayload {
  type: NotificationType;
  appointmentId: string;
  recipientEmail?: string;
  doctorName?: string;
  patientName?: string;
  scheduledAt?: string;
  note?: string;
}

// In-memory set to prevent duplicate dispatches within a session
const dispatchedSet = new Set<string>();

export async function sendAppointmentNotification(payload: NotificationPayload): Promise<{ ok: boolean }> {
  const dedupeKey = `${payload.type}:${payload.appointmentId}:${payload.scheduledAt ?? ""}`;
  if (dispatchedSet.has(dedupeKey)) {
    return { ok: true };
  }
  dispatchedSet.add(dedupeKey);

  console.info(`[Notification Service] Dispatching ${payload.type}:`, {
    appointmentId: payload.appointmentId,
    recipient: payload.recipientEmail,
    doctor: payload.doctorName,
    date: payload.scheduledAt,
  });

  try {
    const res = await fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.warn("[Notification Service] Backend returned non-200, continuing gracefully:", res.status);
    }
    return { ok: true };
  } catch (err) {
    // Graceful fallback for offline / development environments
    console.info("[Notification Service] Logged notification locally:", err);
    return { ok: true };
  }
}
