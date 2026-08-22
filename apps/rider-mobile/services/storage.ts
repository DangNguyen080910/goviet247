// Path: goviet247/apps/rider-mobile/services/storage.ts
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const RIDER_TOKEN_KEY = "rider_access_token";

function sanitizeSecureStoreKeyPart(value: string) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "_");
}

function buildRiderTripActivitySeenKey(userId: string) {
  const safeUserId = sanitizeSecureStoreKeyPart(userId);
  return `rider_trip_activity_seen_at_${safeUserId}`;
}

const RIDER_NOTIFICATION_USER_KEY = "rider_notification_user_id";

function buildRiderNotificationReadKey(userId: string) {
  const safeUserId = sanitizeSecureStoreKeyPart(userId);
  return `rider_notification_read_ids_${safeUserId}`;
}

export async function setRiderToken(token: string) {
  if (Platform.OS === "web") {
    localStorage.setItem(RIDER_TOKEN_KEY, token);
    return;
  }

  await SecureStore.setItemAsync(RIDER_TOKEN_KEY, token);
}

export async function getRiderToken() {
  if (Platform.OS === "web") {
    return localStorage.getItem(RIDER_TOKEN_KEY);
  }

  return SecureStore.getItemAsync(RIDER_TOKEN_KEY);
}

export async function removeRiderToken() {
  if (Platform.OS === "web") {
    localStorage.removeItem(RIDER_TOKEN_KEY);
    return;
  }

  await SecureStore.deleteItemAsync(RIDER_TOKEN_KEY);
}

export async function getRiderTripActivitySeenAt(userId: string) {
  const normalizedUserId = String(userId || "").trim();

  if (!normalizedUserId) {
    return "";
  }

  const key = buildRiderTripActivitySeenKey(normalizedUserId);

  if (Platform.OS === "web") {
    return localStorage.getItem(key) || "";
  }

  return (await SecureStore.getItemAsync(key)) || "";
}

export async function saveRiderTripActivitySeenAt(
  userId: string,
  isoValue: string,
) {
  const normalizedUserId = String(userId || "").trim();

  if (!normalizedUserId) {
    return;
  }

  const key = buildRiderTripActivitySeenKey(normalizedUserId);
  const value = String(isoValue || "").trim();

  if (Platform.OS === "web") {
    if (value) {
      localStorage.setItem(key, value);
    } else {
      localStorage.removeItem(key);
    }
    return;
  }

  if (value) {
    await SecureStore.setItemAsync(key, value);
  } else {
    await SecureStore.deleteItemAsync(key);
  }
}

export async function setRiderNotificationUserId(userId: string) {
  const value = String(userId || "").trim();

  if (Platform.OS === "web") {
    if (value) {
      localStorage.setItem(RIDER_NOTIFICATION_USER_KEY, value);
    } else {
      localStorage.removeItem(RIDER_NOTIFICATION_USER_KEY);
    }
    return;
  }

  if (value) {
    await SecureStore.setItemAsync(RIDER_NOTIFICATION_USER_KEY, value);
  } else {
    await SecureStore.deleteItemAsync(RIDER_NOTIFICATION_USER_KEY);
  }
}

export async function getRiderNotificationUserId() {
  if (Platform.OS === "web") {
    return localStorage.getItem(RIDER_NOTIFICATION_USER_KEY);
  }

  return SecureStore.getItemAsync(RIDER_NOTIFICATION_USER_KEY);
}

export async function getRiderNotificationReadIds(userId?: string) {
  const normalizedUserId = String(
    userId || (await getRiderNotificationUserId()) || "",
  ).trim();

  if (!normalizedUserId) {
    return [];
  }

  const key = buildRiderNotificationReadKey(normalizedUserId);

  try {
    if (Platform.OS === "web") {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    }

    const raw = await SecureStore.getItemAsync(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveRiderNotificationReadIds(
  userId: string,
  ids: string[],
) {
  const normalizedUserId = String(userId || "").trim();
  const normalizedIds = Array.from(
    new Set(
      (Array.isArray(ids) ? ids : [])
        .map((item) => String(item || "").trim())
        .filter(Boolean),
    ),
  );

  if (!normalizedUserId) {
    return;
  }

  const key = buildRiderNotificationReadKey(normalizedUserId);
  const raw = JSON.stringify(normalizedIds);

  if (Platform.OS === "web") {
    localStorage.setItem(key, raw);
    return;
  }

  await SecureStore.setItemAsync(key, raw);
}