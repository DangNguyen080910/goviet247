// Path: goviet247/apps/web/src/api/publicConfig.js
export async function getPublicTripConfig() {
  const res = await fetch("http://localhost:5050/api/public/trips/config");

  const data = await res.json();

  if (!res.ok || !data?.success) {
    throw new Error(data?.message || "Lấy cấu hình khách hàng thất bại.");
  }

  return data.data;
}