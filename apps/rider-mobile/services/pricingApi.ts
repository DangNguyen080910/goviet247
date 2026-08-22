// Path: goviet247/apps/rider-mobile/services/pricingApi.ts
import { API_BASE_URL } from "../constants/api";

type QuotePricePayload = {
  carType: string;
  direction: "ONE_WAY" | "ROUND_TRIP";
  pickupTime: string;
  returnTime: string | null;
  distanceKm: number;
  driveMinutes: number;
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
  const res = await fetch(`${API_BASE_URL}/api/pricing/quote`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = (await res.json().catch(() => ({}))) as
    | QuotePriceResponse
    | ErrorResponse;

  if (!res.ok || !(data as QuotePriceResponse)?.success) {
    throw new Error((data as ErrorResponse)?.message || "Tính giá thất bại.");
  }

  return (data as QuotePriceResponse).data;
}