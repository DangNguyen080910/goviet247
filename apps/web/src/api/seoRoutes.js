const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5050";

export async function getSeoRouteByPath(path, { signal } = {}) {
  const res = await fetch(
    `${API_BASE}/api/public/seo-routes/${encodeURIComponent(path)}`,
    { signal },
  );
  const data = await res.json();

  if (!res.ok || !data?.success) {
    const error = new Error(data?.message || "Không tải được tuyến xe");
    error.status = res.status;
    throw error;
  }

  return data.data;
}
