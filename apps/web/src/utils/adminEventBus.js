// Path: goviet247/apps/web/src/utils/adminEventBus.js
export function emitAdminDashboardChanged() {
  try {
    window.dispatchEvent(new Event("admin:dashboard_changed"));
  } catch (err) {
    console.log("[adminEventBus] emit error:", err);
  }
}