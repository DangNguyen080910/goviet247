import { adminRequest } from "./adminRequest";
export type AdminAlert = { id:string; tripId:string; alertType:string; level:number; message:string; sentAt:string; readAt:string|null; readBy:string|null };
export async function fetchAdminAlerts(read: "all"|"unread"|"read") {
  const result = await adminRequest(`/api/admin/alerts?read=${read}&limit=200`);
  return (Array.isArray(result?.alerts) ? result.alerts : []) as AdminAlert[];
}
export async function markAdminAlertRead(id:string) {
  const result = await adminRequest(`/api/admin/alerts/${encodeURIComponent(id)}/read`, {method:"PATCH"});
  if (!result?.success || !result?.alert?.readAt) throw new Error(result?.message || "Chưa đánh dấu được cảnh báo.");
}
export function blockedAlertDriverId(alert:AdminAlert) {
  if (alert.alertType !== "BLOCKED_TRIP_ACCEPT_ATTEMPT") return null;
  return alert.message.match(/\(mã tài xế: ([A-Za-z0-9_-]+)\)/)?.[1] || null;
}
