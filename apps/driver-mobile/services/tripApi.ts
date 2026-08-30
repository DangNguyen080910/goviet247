// Path: goviet247/apps/driver-mobile/services/tripApi.ts
import { API_BASE_URL } from "../constants/api";
import { getDriverToken } from "./storage";

export type DriverTripDirection = "ONE_WAY" | "ROUND_TRIP";
export type DriverCarType = "CAR_5" | "CAR_7" | "CAR_16";
export type DriverFuelPreference = "ANY" | "ELECTRIC" | "GASOLINE";
export type DriverTripStatus =
  | "PENDING"
  | "ACCEPTED"
  | "CONTACTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type DriverTripScope = "active" | "history";

export type DriverSupportConfig = {
  supportPhoneDriver?: string | null;
  supportEmailDriver?: string | null;
  timezone?: string | null;

  driverTopupBankName?: string | null;
  driverTopupAccountNumber?: string | null;
  driverTopupAccountHolderName?: string | null;
  driverTopupTransferPrefix?: string | null;
  driverTopupQrImageUrl?: string | null;
  driverTopupNote?: string | null;
};

export type DriverTripStop = {
  id: string;
  seq: number;
  address: string;
  addressMasked?: string;
};

export type AvailableTripItem = {
  id: string;
  pickupAddress: string;
  pickupAddressMasked?: string;
  dropoffAddress: string;
  dropoffAddressMasked?: string;
  stops?: DriverTripStop[];
  distanceKm: number;
  pickupTime: string;
  returnTime?: string | null;
  totalPrice: number;
  carType: DriverCarType;
  fuelPreference: DriverFuelPreference;
  direction: DriverTripDirection;
  note?: string | null;
  riderName: string;
  riderPhone: string;
  riderNameMasked?: string;
  riderPhoneMasked?: string;
  status: DriverTripStatus;
  commissionPercent: number;
  commissionAmount: number;
  driverReceive: number;
  driverAcceptOpenAt?: string | null;
  createdAt: string;
  updatedAt: string;
  requiredWalletAmount?: number;
};

export type MyTripItem = {
  id: string;
  pickupAddress: string;
  pickupAddressMasked?: string;
  dropoffAddress: string;
  dropoffAddressMasked?: string;
  stops?: DriverTripStop[];
  distanceKm: number;
  pickupTime: string;
  returnTime?: string | null;
  totalPrice: number;
  carType: DriverCarType;
  fuelPreference: DriverFuelPreference;
  direction: DriverTripDirection;
  note?: string | null;
  riderName: string;
  riderPhone: string;
  riderNameMasked?: string;
  riderPhoneMasked?: string;
  status: DriverTripStatus;
  commissionPercentSnapshot?: number | null;
  commissionAmountSnapshot?: number | null;
  driverVatAmountSnapshot?: number | null;
  driverPitAmountSnapshot?: number | null;
  driverTaxTotalSnapshot?: number | null;
  requiredWalletAmountSnapshot?: number | null;
  driverReceiveSnapshot?: number | null;
  acceptedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DriverCancelledTripItem = {
  id: string;
  tripId: string;
  penaltyAmount: number;
  status: string;
  cancelledAt?: string | null;
  createdAt?: string | null;
  approvedAt?: string | null;
  tripStatusSnapshot?: string | null;

  pickupAddress: string;
  dropoffAddress: string;
  pickupTime?: string | null;
  carType?: DriverCarType | null;
  direction?: DriverTripDirection | null;
  totalPrice: number;
  cancelReason?: string | null;
  stops?: DriverTripStop[];
};

type ApiListSuccess<T> = {
  success: true;
  items: T[];
  message?: string;
};

type ApiTripSuccess<T> = {
  success: true;
  trip?: T;
  message?: string;
  wallet?: {
    balanceBefore: number;
    balanceAfter: number;
    commissionPercent: number;
    commissionRequired: number;
    driverReceive: number;
  };
};

type ApiSystemConfigSuccess = {
  success: true;
  data?: DriverSupportConfig | null;
  message?: string;
};

type ApiError = {
  success?: false;
  message?: string;
  code?: string;
  data?: unknown;
};

async function buildAuthHeaders() {
  const token = await getDriverToken();

  if (!token) {
    throw new Error("Không tìm thấy token đăng nhập của tài xế.");
  }

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function parseJsonSafe(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function getErrorMessage(payload: ApiError | null, fallback: string) {
  if (payload?.message && String(payload.message).trim()) {
    return String(payload.message);
  }

  return fallback;
}

export async function getAvailableTrips(): Promise<AvailableTripItem[]> {
  const headers = await buildAuthHeaders();

  const response = await fetch(`${API_BASE_URL}/api/trips/driver/available`, {
    method: "GET",
    headers,
  });

  const payload = (await parseJsonSafe(response)) as
    | ApiListSuccess<AvailableTripItem>
    | ApiError
    | null;

  if (!response.ok) {
    throw new Error(
      getErrorMessage(payload as ApiError, "Không thể tải danh sách chuyến.")
    );
  }

  const successPayload = payload as ApiListSuccess<AvailableTripItem> | null;
  return Array.isArray(successPayload?.items) ? successPayload.items : [];
}

export async function acceptDriverTrip(tripId: string) {
  const headers = await buildAuthHeaders();

  const response = await fetch(`${API_BASE_URL}/api/trips/driver/accept`, {
    method: "POST",
    headers,
    body: JSON.stringify({ tripId }),
  });

  const payload = (await parseJsonSafe(response)) as
    | ApiTripSuccess<MyTripItem>
    | ApiError
    | null;

  if (!response.ok) {
    const error = new Error(
      getErrorMessage(payload as ApiError, "Không thể nhận chuyến.")
    ) as Error & {
      code?: string;
      data?: unknown;
    };

    error.code = (payload as ApiError)?.code;
    error.data = (payload as ApiError)?.data;

    throw error;
  }

  return payload as ApiTripSuccess<MyTripItem> | null;
}

export async function getMyTrips(options?: {
  scope?: DriverTripScope;
  status?: DriverTripStatus | "";
}): Promise<MyTripItem[]> {
  const headers = await buildAuthHeaders();

  const params = new URLSearchParams();

  if (options?.scope) {
    params.set("scope", options.scope);
  }

  if (options?.status) {
    params.set("status", options.status);
  }

  const query = params.toString();
  const url = `${API_BASE_URL}/api/trips/driver/my${query ? `?${query}` : ""}`;

  const response = await fetch(url, {
    method: "GET",
    headers,
  });

  const payload = (await parseJsonSafe(response)) as
    | ApiListSuccess<MyTripItem>
    | ApiError
    | null;

  if (!response.ok) {
    throw new Error(
      getErrorMessage(payload as ApiError, "Không thể tải đơn của tôi.")
    );
  }

  const successPayload = payload as ApiListSuccess<MyTripItem> | null;
  return Array.isArray(successPayload?.items) ? successPayload.items : [];
}

export async function getDriverTripHistory(
  status?: Extract<DriverTripStatus, "COMPLETED" | "CANCELLED"> | ""
): Promise<MyTripItem[]> {
  return getMyTrips({
    scope: "history",
    status: status || "",
  });
}

export async function getDriverCancelHistory(): Promise<
  DriverCancelledTripItem[]
> {
  const headers = await buildAuthHeaders();

  const response = await fetch(`${API_BASE_URL}/api/trips/driver/cancel-history`, {
    method: "GET",
    headers,
  });

  const payload = (await parseJsonSafe(response)) as
    | ApiListSuccess<DriverCancelledTripItem>
    | ApiError
    | null;

  if (!response.ok) {
    throw new Error(
      getErrorMessage(
        payload as ApiError,
        "Không thể tải lịch sử huỷ chuyến.",
      ),
    );
  }

  const successPayload = payload as ApiListSuccess<DriverCancelledTripItem> | null;
  return Array.isArray(successPayload?.items) ? successPayload.items : [];
}

export async function changeDriverTripStatus(
  tripId: string,
  newStatus: DriverTripStatus
) {
  const headers = await buildAuthHeaders();

  const response = await fetch(`${API_BASE_URL}/api/trips/driver/change-status`, {
    method: "POST",
    headers,
    body: JSON.stringify({ tripId, newStatus }),
  });

  const payload = (await parseJsonSafe(response)) as
    | ApiTripSuccess<MyTripItem>
    | ApiError
    | null;

  if (!response.ok) {
    throw new Error(
      getErrorMessage(
        payload as ApiError,
        "Không thể cập nhật trạng thái chuyến."
      )
    );
  }

  return payload as ApiTripSuccess<MyTripItem> | null;
}

export async function cancelDriverTrip(tripId: string) {
  const token = await getDriverToken();

  const res = await fetch(`${API_BASE_URL}/api/trips/driver/cancel`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ tripId }),
  });

  const data = await res.json();

  if (!res.ok || data?.success === false) {
    throw new Error(data?.message || "Huỷ chuyến thất bại");
  }

  return data;
}

export async function getDriverSupportConfig(): Promise<DriverSupportConfig | null> {
  const response = await fetch(`${API_BASE_URL}/api/public/system-config`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  const payload = (await parseJsonSafe(response)) as
    | ApiSystemConfigSuccess
    | ApiError
    | null;

  if (!response.ok) {
    throw new Error(
      getErrorMessage(payload as ApiError, "Không thể tải cấu hình hệ thống.")
    );
  }

  const successPayload = payload as ApiSystemConfigSuccess | null;
  return successPayload?.data ?? null;
}
