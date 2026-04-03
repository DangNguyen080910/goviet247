// Path: goviet247/apps/web/src/api/pricing.js
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5050";

export async function quotePrice(payload) {
  const res = await fetch(`${API_BASE}/api/pricing/quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (!res.ok || !data?.success) {
    throw new Error(data?.message || "Tính giá thất bại.");
  }

  return data.data;
}