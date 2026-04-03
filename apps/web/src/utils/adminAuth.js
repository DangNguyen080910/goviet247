// Path: goviet247/apps/web/src/utils/adminAuth.js
const TOKEN_KEY = "admin_token";
const USER_KEY = "admin_user";

export function getAdminToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function getAdminUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setAdminSession({ token, user }) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}


export function clearAdminSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isAdminLoggedIn() {
  return !!getAdminToken();
}
