// Path: goviet247/apps/admin-mobile/services/storage.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

const ADMIN_TOKEN_KEY = "admin_token";
const ADMIN_USER_KEY = "admin_user";

export type AdminSessionUser = {
  id: string;
  username: string;
  role: string;
};

export async function getAdminToken() {
  return (await AsyncStorage.getItem(ADMIN_TOKEN_KEY)) || "";
}

export async function getAdminUser(): Promise<AdminSessionUser | null> {
  try {
    const raw = await AsyncStorage.getItem(ADMIN_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function setAdminSession(params: {
  token: string;
  user: AdminSessionUser;
}) {
  await AsyncStorage.setItem(ADMIN_TOKEN_KEY, params.token);
  await AsyncStorage.setItem(ADMIN_USER_KEY, JSON.stringify(params.user));
}

export async function clearAdminSession() {
  await AsyncStorage.removeItem(ADMIN_TOKEN_KEY);
  await AsyncStorage.removeItem(ADMIN_USER_KEY);
}