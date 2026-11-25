import { fetchWithTimeout } from "../../mobile-chat/fetchWithTimeout.js";
// Path: goviet247/apps/rider-mobile/services/notificationApi.ts
import { API_BASE_URL } from "../constants/api";
import { getRiderToken } from "./storage";

type NotificationAudience = "RIDER" | "DRIVER";

export type RiderSystemNotificationItem = {
  id: string;
  isPinnedByDefault?: boolean;
  isPinned?: boolean;
  isCollapsed?: boolean;
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

export async function updateNotificationPreference(id: string, changes: { isPinned?: boolean; isCollapsed?: boolean }) {
  const token = await getRiderToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");
  const response = await fetchWithTimeout(`${API_BASE_URL.replace(/\/+$/, "").replace(/\/api$/, "")}/api/public/system-notifications/${encodeURIComponent(id)}/preferences`, {
    method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ...changes, audience: "RIDER" }),
  });
  const data = await response.json();
  if (!response.ok || !data?.success) throw new Error(data?.message || "Chưa lưu được lựa chọn thông báo.");
  return data.item as { id: string; isPinned: boolean; isCollapsed: boolean; isPinnedByDefault: boolean };
}
