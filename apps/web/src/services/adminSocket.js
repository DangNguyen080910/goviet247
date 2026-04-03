// Path: goviet247/apps/web/src/services/adminSocket.js
import { io } from "socket.io-client";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5050";

let adminSocket = null;
let daKhoiTao = false;

function banSuKienLenWindow(eventName, payload) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent(eventName, {
      detail: payload || {},
    })
  );
}

export function initializeAdminSocketBridge() {
  if (typeof window === "undefined") return null;
  if (daKhoiTao && adminSocket) return adminSocket;

  daKhoiTao = true;

  adminSocket = io(API_BASE, {
    transports: ["websocket", "polling"],
    withCredentials: true,
    autoConnect: true,
  });

  adminSocket.on("connect", () => {
    console.log("[Admin Socket] Đã kết nối:", adminSocket.id);

    adminSocket.emit("registerAdmin", {
      username: "admin-web",
    });
  });

  adminSocket.on("disconnect", (reason) => {
    console.log("[Admin Socket] Mất kết nối:", reason);
  });

  adminSocket.on("connect_error", (error) => {
    console.error("[Admin Socket] Lỗi kết nối:", error?.message || error);
  });

  adminSocket.on("admin:new_trip", (payload) => {
    console.log("[Admin Socket] Nhận admin:new_trip", payload);
    banSuKienLenWindow("admin:new_trip", payload);
  });

  adminSocket.on("admin:trip_accepted", (payload) => {
    console.log("[Admin Socket] Nhận admin:trip_accepted", payload);
    banSuKienLenWindow("admin:trip_accepted", payload);
  });

  adminSocket.on("admin:trip_status_changed", (payload) => {
    console.log("[Admin Socket] Nhận admin:trip_status_changed", payload);
    banSuKienLenWindow("admin:trip_status_changed", payload);
  });

  adminSocket.on("admin:trip_cancelled", (payload) => {
    console.log("[Admin Socket] Nhận admin:trip_cancelled", payload);
    banSuKienLenWindow("admin:trip_cancelled", payload);
  });

  adminSocket.on("admin:dashboard_changed", (payload) => {
    console.log("[Admin Socket] Nhận admin:dashboard_changed", payload);
    banSuKienLenWindow("admin:dashboard_changed", payload);
  });

  window.__goviet247AdminSocket = adminSocket;

  return adminSocket;
}

export function getAdminSocket() {
  return adminSocket;
}