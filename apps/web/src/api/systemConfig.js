// Path: goviet247/apps/web/src/api/systemConfig.js
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5050";

export async function getPublicSystemConfig() {
  const res = await fetch(`${API_BASE}/api/public/system-config`);

  const data = await res.json();

  if (!res.ok || !data?.success) {
    throw new Error(data?.message || "Không lấy được system config");
  }

  return data.data;
}