// Path: goviet247/apps/web/src/api/adminCustomers.js
import { getAdminToken } from "../utils/adminAuth";

function getHeaders() {
  const token = getAdminToken();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

function buildQuery(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    if (typeof v === "string" && v.trim() === "") return;
    qs.set(k, String(v));
  });
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export async function fetchCustomers(params = {}) {
  const res = await fetch(`/api/admin/customers` + buildQuery(params), {
    headers: getHeaders(),
  });
  const data = await res.json();
  if (!res.ok || !data?.success) {
    throw new Error(data?.message || "Không tải được danh sách khách hàng.");
  }
  return { items: data.items || data.customers || [], meta: data.meta || null };
}

export async function fetchCustomerDetail(userId) {
  const res = await fetch(`/api/admin/customers/${userId}`, {
    headers: getHeaders(),
  });
  const data = await res.json();
  if (!res.ok || !data?.success) {
    throw new Error(data?.message || "Không tải được chi tiết khách hàng.");
  }
  return data.customer;
}

export async function fetchCustomerLogs(userId) {
  const res = await fetch(`/api/admin/customers/${userId}/logs`, {
    headers: getHeaders(),
  });
  const data = await res.json();
  if (!res.ok || !data?.success) {
    throw new Error(data?.message || "Không tải được lịch sử khách hàng.");
  }
  return { logs: data.items || [] };
}

export async function patchCustomerAccount(userId, { action, reason }) {
  const path =
    action === "SUSPEND"
      ? "suspend"
      : action === "UNSUSPEND"
        ? "unsuspend"
        : null;

  if (!path) throw new Error("Action không hợp lệ.");

  const res = await fetch(`/api/admin/customers/${userId}/${path}`, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify({ reason }),
  });
  const data = await res.json();
  if (!res.ok || !data?.success) {
    throw new Error(data?.message || "Thao tác thất bại.");
  }
  return data;
}