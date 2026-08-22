// Path: goviet247/apps/driver-mobile/services/notificationApi.ts
import { API_BASE_URL } from "../constants/api";
import { getDriverToken } from "./storage";

export type DriverNotificationItem = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  updatedAt?: string | null;
  isActive: boolean;
  audience: "DRIVER" | "RIDER";
  isRead: boolean;
  readAt?: string | null;
};

export type DriverNotificationResponse = {
  items: DriverNotificationItem[];
  unreadCount: number;
};

function buildDriverNotificationUrl(path = "") {
  const base = String(API_BASE_URL || "").replace(/\/+$/, "");

  if (base.endsWith("/api")) {
    return `${base}/driver/profile/notifications${path}`;
  }

  return `${base}/api/driver/profile/notifications${path}`;
}

function normalizeItem(item: any): DriverNotificationItem {
  return {
    id: String(item?.id || ""),
    title: String(item?.title || ""),
    message: String(item?.message || ""),
    createdAt: String(item?.createdAt || ""),
    updatedAt: item?.updatedAt ? String(item.updatedAt) : null,
    isActive: Boolean(item?.isActive),
    audience: item?.audience === "RIDER" ? "RIDER" : "DRIVER",
    isRead: Boolean(item?.isRead),
    readAt: item?.readAt ? String(item.readAt) : null,
  };
}

export async function fetchDriverNotifications(): Promise<DriverNotificationResponse> {
  const token = await getDriverToken();

  if (!token) {
    throw new Error("Thiếu token tài xế");
  }

  const url = buildDriverNotificationUrl();
  const res = await fetch(url, {
    method: "GET",
    headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
  });

  const data = await res.json();

  if (!res.ok || !data?.success) {
    throw new Error(data?.message || "Không lấy được thông báo");
  }

  const items = Array.isArray(data?.items) ? data.items : [];

  return {
    items: items.map(normalizeItem),
    unreadCount: Number(data?.unreadCount || 0),
  };
}

export async function markAllDriverNotificationsAsRead(): Promise<{
  unreadCount: number;
}> {
  const token = await getDriverToken();

  if (!token) {
    throw new Error("Thiếu token tài xế");
  }

  const url = buildDriverNotificationUrl("/mark-all-read");
  const res = await fetch(url, {
    method: "POST",
     headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
  });

  const data = await res.json();

  if (!res.ok || !data?.success) {
    throw new Error(data?.message || "Không thể đánh dấu đã đọc");
  }

  return {
    unreadCount: Number(data?.unreadCount || 0),
  };
}