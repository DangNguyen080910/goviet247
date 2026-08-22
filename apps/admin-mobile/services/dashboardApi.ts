// Path: goviet247/apps/admin-mobile/services/dashboardApi.ts
import { adminRequest } from "./adminRequest";

export async function fetchAdminDashboard() {
  const data = await adminRequest("/api/admin/dashboard", {
    method: "GET",
  });

  return data?.data || null;
}