import { Alert } from "react-native";
import { router } from "expo-router";
import { API_BASE_URL } from "../constants/api";
import { clearAdminSession, getAdminToken } from "./storage";
import { disconnectAdminSocket } from "./adminSocket";

let isHandlingAuthExpired = false;

function isAuthExpiredResponse(status: number, _data: any) {
  return status === 401;
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
const inFlightMutations = new Map<string, Promise<any>>();
export async function adminRequest(path: string, options: RequestInit = {}) {
  const token = await getAdminToken();
  const method = String(options.method || "GET").toUpperCase();
  const isMutation = method !== "GET" && method !== "HEAD";
  if (!isMutation) return performRequest(path, options, token);
  const key = JSON.stringify([token, method, path, options.body || null, options.headers || null]);
  const existing = inFlightMutations.get(key);
  if (existing) return existing;
  const pending = performRequest(path, options, token);
  inFlightMutations.set(key, pending);
  try { return await pending; }
  finally { if (inFlightMutations.get(key) === pending) inFlightMutations.delete(key); }
}

async function performRequest(path: string, options: RequestInit, token: string) {

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    });
  } catch {
    const mutation = !["GET", "HEAD"].includes(String(options.method || "GET").toUpperCase());
    throw new Error(mutation
      ? "Chưa nhận được phản hồi từ máy chủ. Thao tác có thể đã được lưu; hãy kiểm tra trạng thái trước khi thực hiện lại."
      : "Không tải được dữ liệu. Vui lòng kiểm tra kết nối và tải lại.");
  }

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

    throw Object.assign(new Error(data?.message || data?.error || `HTTP ${res.status}`), { status: res.status });
  }

  if (data === null && res.status !== 204) {
    throw new Error("Máy chủ chưa trả về kết quả hợp lệ. Vui lòng kiểm tra lại trước khi thao tác tiếp.");
  }
  return data;
}
