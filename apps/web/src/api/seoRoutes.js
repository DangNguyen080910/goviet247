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

export async function getLegacySeoRoutes({ signal, limit = 25000, keys = [] } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (keys.length) params.set("keys", keys.join(","));
  const res = await fetch(`${API_BASE}/api/public/seo-routes?${params}`, {
    signal,
  });
  const data = await res.json();

  if (!res.ok || !data?.success) {
    throw new Error(data?.message || "Không tải được danh sách tuyến xe");
  }

  return data.data?.routes || [];
}
