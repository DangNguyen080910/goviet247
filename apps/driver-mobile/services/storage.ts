// Path: goviet247/apps/driver-mobile/services/storage.ts
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const DRIVER_TOKEN_KEY = "driver_access_token";

export async function setDriverToken(token: string) {
  if (Platform.OS === "web") {
    localStorage.setItem(DRIVER_TOKEN_KEY, token);
    return;
  }

  await SecureStore.setItemAsync(DRIVER_TOKEN_KEY, token);
}

export async function getDriverToken() {
  if (Platform.OS === "web") {
    return localStorage.getItem(DRIVER_TOKEN_KEY);
  }

  return SecureStore.getItemAsync(DRIVER_TOKEN_KEY);
}

export async function removeDriverToken() {
  if (Platform.OS === "web") {
    localStorage.removeItem(DRIVER_TOKEN_KEY);
    return;
  }

  await SecureStore.deleteItemAsync(DRIVER_TOKEN_KEY);
}

export async function clearDriverToken() {
  return removeDriverToken();
}