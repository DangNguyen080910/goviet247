// Path: goviet247/apps/rider-mobile/services/feedbackApi.ts
import { API_BASE_URL } from "../constants/api";
import { getRiderToken } from "./storage";

type SubmitFeedbackPayload = {
  message: string;
  tripId?: string | null;
};

export async function submitFeedback(payload: SubmitFeedbackPayload) {
  const token = await getRiderToken();

  if (!token) {
    throw new Error("Bạn cần đăng nhập để gửi góp ý.");
  }

  const isTripFeedback = Boolean(String(payload.tripId || "").trim());
  const source = isTripFeedback ? "RIDER_TRIP_HISTORY" : "RIDER_PROFILE";

  const res = await fetch(`${API_BASE_URL}/api/feedbacks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      source,
      subject: isTripFeedback ? "Góp ý chuyến đi" : "Góp ý chung",
      message: String(payload.message || "").trim(),
      tripId: isTripFeedback ? String(payload.tripId || "").trim() : null,
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data?.success) {
    throw new Error(data?.message || "Gửi góp ý thất bại.");
  }

  return data;
}