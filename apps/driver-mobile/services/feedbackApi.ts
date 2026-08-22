// Path: goviet247/apps/driver-mobile/services/feedbackApi.ts
import { API_BASE_URL } from "../constants/api";
import { getDriverToken } from "./storage";

type CreateFeedbackPayload = {
  subject: string;
  message: string;
};

type CreateFeedbackResponse = {
  success: boolean;
  message?: string;
  feedback?: {
    id: string;
    subject: string | null;
    message: string;
    source: string;
    actorRole: string;
    createdAt: string;
  };
};

async function parseJson(res: Response) {
  return res.json().catch(() => ({}));
}

export async function createDriverMenuFeedback(
  payload: CreateFeedbackPayload,
) {
  const token = await getDriverToken();

  if (!token) {
    throw new Error("Phiên đăng nhập đã hết hạn.");
  }

  const subject = String(payload?.subject || "").trim();
  const message = String(payload?.message || "").trim();

  const res = await fetch(`${API_BASE_URL}/api/feedbacks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      source: "DRIVER_MENU",
      subject,
      message,
    }),
  });

  const data = (await parseJson(res)) as
    | CreateFeedbackResponse
    | { success?: false; message?: string; error?: { message?: string } };

  if (!res.ok || !data?.success) {
    throw new Error(
      (data as any)?.error?.message ||
        (data as any)?.message ||
        "Không thể gửi góp ý.",
    );
  }

  return data as CreateFeedbackResponse;
}