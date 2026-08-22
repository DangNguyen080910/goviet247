// Path: goviet247/apps/admin-mobile/services/adminSocket.ts
import { io, Socket } from "socket.io-client";
import { API_BASE_URL } from "../constants/api";
import { getAdminToken } from "./storage";

type AdminRealtimeEvent =
  | "admin:new_trip"
  | "admin:dashboard_changed"
  | "admin:trip_accepted"
  | "admin:trip_status_changed"
  | "admin:trip_cancelled";

let socket: Socket | null = null;

export async function connectAdminSocket() {
  if (socket?.connected) {
    return socket;
  }

  const token = await getAdminToken();

  socket = io(API_BASE_URL, {
    transports: ["websocket", "polling"],
    autoConnect: true,
    forceNew: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    auth: token ? { token } : undefined,
    extraHeaders: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
  });

  socket.on("connect", () => {
    socket?.emit("registerAdmin");
  });

  return socket;
}

export function getAdminSocket() {
  return socket;
}

export function onAdminRealtimeEvent(
  eventName: AdminRealtimeEvent,
  handler: (payload?: any) => void
) {
  socket?.on(eventName, handler);
}

export function offAdminRealtimeEvent(
  eventName: AdminRealtimeEvent,
  handler: (payload?: any) => void
) {
  socket?.off(eventName, handler);
}

export function disconnectAdminSocket() {
  if (!socket) {
    return;
  }

  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}