// Path: goviet247/apps/admin-mobile/services/authApi.ts
import { API_BASE_URL } from "../constants/api";

export type AdminUser = {
  id: string;
  username: string;
  role: string;
};

type LoginResponse = {
  success: boolean;
  token: string;
  user: AdminUser;
  message?: string;
};

export async function loginAdmin(username: string, password: string) {
  const res = await fetch(`${API_BASE_URL}/api/admin/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username,
      password,
    }),
  });

  const data: LoginResponse = await res.json();

  if (!res.ok || !data?.success || !data?.token || !data?.user) {
    throw new Error(data?.message || "Đăng nhập thất bại");
  }

  return data;
}