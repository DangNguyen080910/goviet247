// Path: goviet247/apps/web/src/api/publicConfig.js
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5050";

export async function getPublicTripConfig() {
  const res = await fetch(`${API_BASE}/api/public/trips/config`);

  const data = await res.json();

  if (!res.ok || !data?.success) {
    throw new Error(data?.message || "Lấy cấu hình khách hàng thất bại.");
  }

  return data.data;
}