// Path: goviet247/apps/web/src/api/trips.js

const API_BASE = "http://localhost:5050";
const CUSTOMER_TOKEN_KEY = "gv247_customer_token";

/**
 * Tạo chuyến
 * - Guest: gửi như bình thường
 * - Logged-in customer: tự gắn Authorization Bearer token
 */
export async function createTrip(payload) {
  const token = localStorage.getItem(CUSTOMER_TOKEN_KEY);

  const headers = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}/api/trips`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data?.success) {
    throw new Error(data?.message || "Tạo chuyến thất bại.");
  }

  return data; // { success: true, trip, message }
}

/**
 * Lấy lịch sử chuyến của customer đang đăng nhập
 */
export async function getMyTrips(token) {
  const res = await fetch(`${API_BASE}/api/trips/my`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data?.success) {
    throw new Error(data?.message || "Không lấy được lịch sử chuyến đi.");
  }

  return data.items || [];
}