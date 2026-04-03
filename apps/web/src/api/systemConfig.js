// Path: goviet247/apps/web/src/api/systemConfig.js
export async function getPublicSystemConfig() {
  const res = await fetch("http://localhost:5050/api/public/system-config");

  const data = await res.json();

  if (!res.ok || !data?.success) {
    throw new Error(data?.message || "Không lấy được system config");
  }

  return data.data;
}