import { Alert } from "react-native";
import { router } from "expo-router";
import { API_BASE_URL } from "../constants/api";
import { clearAdminSession, getAdminToken } from "./storage";
import { disconnectAdminSocket } from "./adminSocket";

let isHandlingAuthExpired = false;

function isAuthExpiredResponse(status: number, data: any) {
  const message = String(data?.message || data?.error || "").toLowerCase();

  return (
    status === 401 ||
    message.includes("token") ||
    message.includes("jwt") ||
    message.includes("hết hạn") ||
    message.includes("expired") ||
    message.includes("unauthorized")
  );
}

async function handleAuthExpired() {
  if (isHandlingAuthExpired) return;

  isHandlingAuthExpired = true;

  try {
    disconnectAdminSocket();
    await clearAdminSession();

    Alert.alert(
      "Phiên đăng nhập đã hết hạn",
      "Vui lòng đăng nhập lại để tiếp tục.",
    );

    router.replace("/login");
  } finally {
    setTimeout(() => {
      isHandlingAuthExpired = false;
    }, 1000);
  }
}
export async function adminRequest(path: string, options: RequestInit = {}) {
  const token = await getAdminToken();

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  let data: any = null;

  try {
    data = await res.json();
  } catch {
    // ignore json parse error
  }

  if (!res.ok || data?.success === false) {
    if (isAuthExpiredResponse(res.status, data)) {
      await handleAuthExpired();
    }

    throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
  }

  return data;
}
