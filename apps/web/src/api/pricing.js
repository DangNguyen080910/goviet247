// Path: goviet247/apps/web/src/api/pricing.js
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5050";

export async function quotePrice(payload) {
  let token = "";
  let visitorId = "";
  try {
    token = localStorage.getItem("gv247_customer_token") || "";
    visitorId = localStorage.getItem("gv247_quote_visitor") || globalThis.crypto.randomUUID();
    localStorage.setItem("gv247_quote_visitor", visitorId);
  } catch { /* Quotes work even if browser storage is disabled. */ }
  const res = await fetch(`${API_BASE}/api/pricing/quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ ...payload, historyContext: { ...payload.historyContext, visitorId, source: "WEB" } }),
  });

  const data = await res.json();

  if (!res.ok || !data?.success) {
    throw new Error(data?.message || "Tính giá thất bại.");
  }

  return data.data;
}
