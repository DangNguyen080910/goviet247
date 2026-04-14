// Path: goviet247/apps/web/src/api/adminTrips.js
import { getAdminToken } from "../utils/adminAuth";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5050";

async function request(path, options = {}) {
  const token = getAdminToken();

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // ignore
  }

  if (!res.ok) {
    const msg = data?.message || data?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return data;
}

export async function fetchAdminDashboard() {
  const data = await request("/api/admin/dashboard", { method: "GET" });
  return data?.data || null;
}

// ✅ Danh sách chuyến chờ duyệt (PENDING + isVerified=false)
export async function fetchUnverifiedTrips() {
  const data = await request("/api/trips/admin/trips/unverified", {
    method: "GET",
  });
  return data?.items || [];
}

// ✅ Duyệt chuyến (set isVerified=true)
export async function verifyTrip(tripId, note) {
  const data = await request(`/api/trips/admin/trips/${tripId}/verify`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
  return data?.trip;
}

// ✅ Assigned trips (ACCEPTED / IN_PROGRESS / COMPLETED)
export async function fetchAssignedTrips(status) {
  const qs = new URLSearchParams({ status }).toString();
  const data = await request(`/api/trips/admin/trips/assigned?${qs}`, {
    method: "GET",
  });
  return data?.trips || [];
}

export async function changeAssignedTripStatus(tripId, toStatus, note) {
  const data = await request(`/api/trips/admin/trips/${tripId}/change-status`, {
    method: "POST",
    body: JSON.stringify({ toStatus, note }),
  });
  return data;
}

export function normalizeDisplayAddress(address) {
  if (!address || typeof address !== "string") {
    return "";
  }

  let raw = address.trim();
  if (!raw) {
    return "";
  }

  raw = raw
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\bTP\.\s*HCM\b/gi, "Hồ Chí Minh")
    .replace(/\bTP HCM\b/gi, "Hồ Chí Minh")
    .replace(/\bTP\.?\s*Hồ Chí Minh\b/gi, "Hồ Chí Minh")
    .replace(/\bHCM\b/gi, "Hồ Chí Minh")
    .replace(/\bTP\.\s*/gi, "Thành phố ")
    .trim();

  // Ví dụ: "4 Hẻm 33 Đặng Văn Ngữ" -> "33/4 Đặng Văn Ngữ"
  raw = raw.replace(
    /\b(\d+)\s*hẻm\s+(\d+(?:\/\d+)?)\b/gi,
    (_, hemSo, duongSo) => `${duongSo}/${hemSo}`,
  );

  return raw;
}

export async function fetchPendingCancelledTrips() {
  const data = await request("/api/admin/pending-trips/cancelled", {
    method: "GET",
  });
  return data?.items || data?.trips || [];
}
