// Path: goviet247/apps/web/src/api/systemNotifications.js
import { getAdminToken } from "../utils/adminAuth";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5050";
const BASE_URL = `${API_BASE}/api/admin/system-notifications`;
const PUBLIC_API = `${API_BASE}/api/public/system-notifications`;

async function parseJson(res) {
  const data = await res.json();

  if (!res.ok || !data?.success) {
    throw new Error(
      data?.message || "Có lỗi xảy ra khi gọi API thông báo hệ thống.",
    );
  }

  return data;
}

function buildHeaders() {
  const token = getAdminToken();

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function fetchSystemNotifications(params = {}) {
  const query = new URLSearchParams();

  if (params.audience) query.set("audience", params.audience);
  if (params.active !== undefined && params.active !== null) {
    query.set("active", String(params.active));
  }
  if (params.limit) query.set("limit", String(params.limit));

  const url = query.toString() ? `${BASE_URL}?${query.toString()}` : BASE_URL;

  const res = await fetch(url, {
    method: "GET",
    headers: buildHeaders(),
  });

  const data = await parseJson(res);
  return data.items || [];
}

export async function createSystemNotification(payload) {
  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await parseJson(res);
  return data.item;
}

export async function updateSystemNotification(id, payload) {
  const res = await fetch(`${BASE_URL}/${id}`, {
    method: "PATCH",
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await parseJson(res);
  return data.item;
}

export async function getPublicSystemNotifications(params = {}) {
  const query = new URLSearchParams();

  if (params.audience) {
    query.set("audience", String(params.audience).trim().toUpperCase());
  }

  const url = query.toString()
    ? `${PUBLIC_API}?${query.toString()}`
    : PUBLIC_API;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  const data = await res.json();

  if (!res.ok || !data?.success) {
    throw new Error(data?.message || "Không lấy được thông báo hệ thống.");
  }

  return Array.isArray(data.items) ? data.items : [];
}