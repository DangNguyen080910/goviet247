// Path: goviet247/apps/rider-mobile/services/pricingApi.ts
import { API_BASE_URL } from "../constants/api";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { getRiderToken } from "./storage";

type QuotePricePayload = {
  carType: string;
  direction: "ONE_WAY" | "ROUND_TRIP";
  pickupTime: string;
  returnTime: string | null;
  distanceKm: number;
  driveMinutes: number;
  fuelPreference: "ANY" | "ELECTRIC" | "GASOLINE";
  historyContext?: { pickupAddress: string; stops: string[]; customerName: string; customerPhone: string };
};

type QuotePriceResponse = {
  success: boolean;
  data: {
    finalPrice: number;
    [key: string]: any;
  };
  message?: string;
};

type ErrorResponse = {
  success?: false;
  message?: string;
};

export async function quotePrice(payload: QuotePricePayload) {
  let token = "";
  let visitorId = "";
  try {
    token = (await getRiderToken()) || "";
    const key = "gv247_quote_visitor";
    visitorId = (Platform.OS === "web" ? localStorage.getItem(key) : await SecureStore.getItemAsync(key)) || "";
    if (!visitorId) {
      visitorId = `${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
      if (Platform.OS === "web") localStorage.setItem(key, visitorId);
      else await SecureStore.setItemAsync(key, visitorId);
    }
  } catch { /* Tracking must not prevent a quote. */ }
  const res = await fetch(`${API_BASE_URL}/api/pricing/quote`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ ...payload, historyContext: { ...payload.historyContext, visitorId, source: Platform.OS === "ios" ? "IOS" : Platform.OS === "android" ? "ANDROID" : "WEB" } }),
  });

  const data = (await res.json().catch(() => ({}))) as
    | QuotePriceResponse
    | ErrorResponse;

  if (!res.ok || !(data as QuotePriceResponse)?.success) {
    throw new Error((data as ErrorResponse)?.message || "Tính giá thất bại.");
  }

  return (data as QuotePriceResponse).data;
}
