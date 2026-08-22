// Path: goviet247/apps/rider-mobile/services/riderSocket.ts
import { io, Socket } from "socket.io-client";
import { API_BASE_URL } from "../constants/api";

let riderSocket: Socket | null = null;
let registeredUserId = "";

type SocketHandler = (...args: any[]) => void;

const pendingListeners = new Map<string, Set<SocketHandler>>();

function attachPendingListeners(socket: Socket) {
  pendingListeners.forEach((handlers, eventName) => {
    handlers.forEach((handler) => {
      socket.on(eventName, handler);
    });
  });
}

export function getRiderSocket() {
  return riderSocket;
}

export function connectRiderSocket(userId: string) {
  const normalizedUserId = String(userId || "").trim();

  if (!normalizedUserId) {
    return null;
  }

  if (!riderSocket) {
    riderSocket = io(API_BASE_URL, {
      transports: ["websocket", "polling"],
      autoConnect: true,
    });

    attachPendingListeners(riderSocket);

    riderSocket.on("connect", () => {
      console.log("[RiderSocket] connected:", riderSocket?.id);

      if (registeredUserId) {
        riderSocket?.emit("registerRider", { userId: registeredUserId });
      }
    });

    riderSocket.on("disconnect", (reason) => {
      console.log("[RiderSocket] disconnected:", reason);
    });

    riderSocket.on("connect_error", (error) => {
      console.warn("[RiderSocket] connect_error:", error?.message || error);
    });
  }

  registeredUserId = normalizedUserId;

  if (riderSocket.connected) {
    riderSocket.emit("registerRider", { userId: normalizedUserId });
  }

  return riderSocket;
}

export function disconnectRiderSocket() {
  registeredUserId = "";

  if (!riderSocket) {
    return;
  }

  riderSocket.disconnect();
  riderSocket = null;
}

export function onRiderSocketEvent(eventName: string, handler: SocketHandler) {
  const normalizedEventName = String(eventName || "").trim();

  if (!normalizedEventName || typeof handler !== "function") {
    return () => {};
  }

  if (!pendingListeners.has(normalizedEventName)) {
    pendingListeners.set(normalizedEventName, new Set());
  }

  pendingListeners.get(normalizedEventName)?.add(handler);

  if (riderSocket) {
    riderSocket.on(normalizedEventName, handler);
  }

  return () => {
    pendingListeners.get(normalizedEventName)?.delete(handler);

    if (
      pendingListeners.has(normalizedEventName) &&
      pendingListeners.get(normalizedEventName)?.size === 0
    ) {
      pendingListeners.delete(normalizedEventName);
    }

    riderSocket?.off(normalizedEventName, handler);
  };
}