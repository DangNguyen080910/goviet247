// Path: goviet247/apps/web/src/api/pricing.js

export async function quotePrice(payload) {
  const res = await fetch("http://localhost:5050/api/pricing/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok || !data?.success) {
    throw new Error(data?.message || "Tính giá thất bại.");
  }
  return data.data; // chính là object { finalPrice, ... }
}