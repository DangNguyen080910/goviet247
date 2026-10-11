// Path: goviet247/apps/rider-mobile/services/notificationApi.ts
import { API_BASE_URL } from "../constants/api";
import { getRiderToken } from "./storage";

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
) {
  const url = new URL(`${API_BASE_URL}/api/public/rider-notifications`);
  url.searchParams.set("audience", audience);
  const token = await getRiderToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url.toString(), {
    method: "GET",
    headers,
  });

  const data = (await res
    .json()
    .catch(() => ({}))) as ListSystemNotificationsResponse;

  if (!res.ok || !data?.success) {
    throw new Error(data?.message || "Không tải được danh sách thông báo.");
  }

  return Array.isArray(data?.items) ? data.items : [];
}
