// Path: goviet247/apps/rider-mobile/services/notificationApi.ts
import { API_BASE_URL } from "../constants/api";

type NotificationAudience = "RIDER" | "DRIVER";

export type RiderSystemNotificationItem = {
  id: string;
  title: string;
  body?: string | null;
  message?: string | null;
  audience?: string | null;
  targetType?: string | null;
  targetUserId?: string | null;
  tripId?: string | null;
  isActive?: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type ListSystemNotificationsResponse = {
  success?: boolean;
  items?: RiderSystemNotificationItem[];
  message?: string;
};

export async function getSystemNotifications(
  audience: NotificationAudience = "RIDER",
  userId?: string,
) {
  const url = new URL(`${API_BASE_URL}/api/public/system-notifications`);
  url.searchParams.set("audience", audience);

  const normalizedUserId = String(userId || "").trim();
  if (normalizedUserId) {
    url.searchParams.set("userId", normalizedUserId);
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  const data = (await res
    .json()
    .catch(() => ({}))) as ListSystemNotificationsResponse;

  if (!res.ok || !data?.success) {
    throw new Error(data?.message || "Không tải được danh sách thông báo.");
  }

  return Array.isArray(data?.items) ? data.items : [];
}
