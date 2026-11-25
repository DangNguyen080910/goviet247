import { fetchWithTimeout } from "../../../mobile-chat/fetchWithTimeout.js";
// Path: goviet247/apps/web/src/api/systemNotificationsPublic.js
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5050";
const API = `${API_BASE}/api/public/system-notifications`;

export async function getPublicSystemNotifications(params = {}) {
  const query = new URLSearchParams();

  if (params.audience) {
    query.set("audience", String(params.audience).trim().toUpperCase());
  }

  const token = localStorage.getItem("gv247_customer_token");
  const base = token && (!params.audience || params.audience === "RIDER") ? `${API_BASE}/api/public/rider-notifications` : API;
  const url = query.toString() ? `${base}?${query.toString()}` : base;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const data = await res.json();

  if (!res.ok || !data?.success) {
    throw new Error(data?.message || "Không lấy được thông báo hệ thống.");
  }

  return Array.isArray(data.items) ? data.items : [];
}
export async function updateNotificationPreference(id, changes) {
  const token = localStorage.getItem("gv247_customer_token");
  if (!token) throw new Error("Bạn cần đăng nhập.");
  const response = await fetchWithTimeout(`${API}/${encodeURIComponent(id)}/preferences`, {
    method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ...changes, audience: "RIDER" }),
  });
  const data = await response.json();
  if (!response.ok || !data?.success) throw new Error(data?.message || "Chưa lưu được lựa chọn thông báo.");
  return data.item;
}
