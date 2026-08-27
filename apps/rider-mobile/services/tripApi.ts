// Path: goviet247/apps/rider-mobile/services/tripApi.ts
import { API_BASE_URL } from "../constants/api";
import { getRiderToken } from "./storage";

type CreateTripPayload = {
  pickupAddress: string;
  dropoffAddress: string;
  stops: string[];
  pickupTime: string;
  returnTime: string | null;
  direction: "ONE_WAY" | "ROUND_TRIP";
  carType: string;
  distanceKm: number;
  fareEstimate: number;
  riderName: string;
  riderPhone: string;
  note: string | null;
};

type CreateTripResponse = {
  success: boolean;
  message?: string;
  trip?: {
    id: string;
    [key: string]: any;
  };
  [key: string]: any;
};

type ErrorResponse = {
  success?: false;
  message?: string;
};

export type RiderPublicTripConfig = {
  maxStops: number;
  minDistanceKm: number;
  maxDistanceKm: number;
  quoteExpireSeconds: number;
  riderBookingNotePlaceholder?: string | null;
};

export async function getRiderPublicTripConfig(): Promise<RiderPublicTripConfig> {
  const res = await fetch(`${API_BASE_URL}/api/public/trips/config`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  const data = (await res.json().catch(() => ({}))) as any;

  if (!res.ok || !data?.success || !data?.data?.tripConfig) {
    throw new Error(data?.message || "Không tải được cấu hình chuyến đi.");
  }

  return data.data.tripConfig as RiderPublicTripConfig;
}

export async function createTrip(payload: CreateTripPayload) {
  const token = await getRiderToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}/api/trips`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const data = (await res.json().catch(() => ({}))) as
    | CreateTripResponse
    | ErrorResponse;

  if (!res.ok || !(data as CreateTripResponse)?.success) {
    throw new Error((data as ErrorResponse)?.message || "Tạo chuyến thất bại.");
  }

  return data as CreateTripResponse;
}

type RiderTripItem = {
  id: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupTime: string;
  returnTime?: string | null;
  createdAt: string;
  updatedAt?: string;
  totalPrice?: number | string | null;
  fareEstimate?: number | string | null;
  status: string;
  direction?: "ONE_WAY" | "ROUND_TRIP" | string | null;
  carType?: string | null;
  riderName?: string | null;
  riderPhone?: string | null;
  note?: string | null;
  driverVehicle?: {
    vehicleBrand?: string | null;
    vehicleModel?: string | null;
    plateNumber?: string | null;
  } | null;
  stops?: Array<{
    id: string;
    seq: number;
    address: string;
  }>;
};

type ListMyTripsResponse = {
  success: boolean;
  items?: RiderTripItem[];
  message?: string;
};

export async function getMyTrips() {
  const token = await getRiderToken();

  if (!token) {
    throw new Error("Bạn cần đăng nhập để xem hoạt động.");
  }

  const res = await fetch(`${API_BASE_URL}/api/trips/my`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const data = (await res.json().catch(() => ({}))) as
    | ListMyTripsResponse
    | ErrorResponse;

  if (!res.ok || !(data as ListMyTripsResponse)?.success) {
    throw new Error(
      (data as ErrorResponse)?.message || "Không tải được danh sách chuyến."
    );
  }

  return (data as ListMyTripsResponse)?.items || [];
}

export async function cancelTripByRider(
  tripId: string,
  payload?: { cancelReason?: string }
) {
  const token = await getRiderToken();

  if (!token) {
    throw new Error("Bạn cần đăng nhập để huỷ chuyến.");
  }

  const res = await fetch(`${API_BASE_URL}/api/trips/${tripId}/cancel-by-rider`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      cancelReason:
        payload?.cancelReason || "Khách hàng tự huỷ khi còn chờ duyệt",
    }),
  });

  const data = (await res.json().catch(() => ({}))) as
    | {
        success?: boolean;
        message?: string;
        trip?: any;
      }
    | ErrorResponse;

  if (!res.ok || !data?.success) {
    throw new Error(data?.message || "Không thể huỷ chuyến lúc này.");
  }

  return data;
}

export type RiderPublicSystemConfig = {
  supportPhoneRider?: string | null;
  supportEmailRider?: string | null;
  brandName?: string | null;
  brandLogoUrl?: string | null;
  riderMobileBackgroundImageUrl?: string | null;
};

export async function getRiderPublicSystemConfig(): Promise<RiderPublicSystemConfig> {
  const res = await fetch(`${API_BASE_URL}/api/public/system-config`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  const data = (await res.json().catch(() => ({}))) as
    | {
        success?: boolean;
        data?: RiderPublicSystemConfig;
        message?: string;
      }
    | ErrorResponse;

  if (!res.ok || !data?.success) {
    throw new Error(
      data?.message || "Không tải được cấu hình public hệ thống."
    );
  }

  return data?.data || {};
}

export type RiderSupportConfig = {
  supportPhoneRider?: string | null;
  supportEmailRider?: string | null;
};

export async function getRiderSupportConfig(): Promise<RiderSupportConfig> {
  const data = await getRiderPublicSystemConfig();

  return {
    supportPhoneRider: data?.supportPhoneRider || "",
    supportEmailRider: data?.supportEmailRider || "",
  };
}
