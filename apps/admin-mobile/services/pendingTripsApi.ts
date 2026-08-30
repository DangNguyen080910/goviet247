// Path: goviet247/apps/admin-mobile/services/pendingTripsApi.ts
import { adminRequest } from "./adminRequest";

export type PendingTripItem = {
  id: string;
  creatorName?: string | null;
  creatorPhone?: string | null;
  riderName: string | null;
  riderPhone: string | null;

  pickupAddress: string;
  dropoffAddress: string;

  carType?: string | null;
  fuelPreference?: string | null;

  direction?: string | null;
  returnTime?: string | null;

  distanceKm?: number | null;

  totalDriveMinutes?: number | null;

  estimatedDurationMinutes?: number | null;

  stops?: Array<{
    seq?: number;
    address?: string;
  }>;

  pickupTime: string | null;

  totalPrice: number | null;

  cancelReason?: string | null;
  cancelledAt?: string | null;

  isVerified?: boolean;
  status?: string | null;
  createdAt?: string | null;
};

function mapTripItem(raw: any): PendingTripItem {
  return {
    id: String(raw?.id || raw?.tripId || ""),
    creatorName: raw?.creatorName || null,
    creatorPhone: raw?.creatorPhone || null,
    riderName: raw?.riderName || null,
    riderPhone: raw?.riderPhone || null,
    pickupAddress: String(raw?.pickupAddress || ""),
    dropoffAddress: String(raw?.dropoffAddress || ""),
    carType: raw?.carType || null,
    fuelPreference: raw?.fuelPreference || "ANY",
    direction: raw?.direction || raw?.tripType || null,
    returnTime: raw?.returnTime || null,

    distanceKm:
      typeof raw?.distanceKm === "number"
        ? raw.distanceKm
        : Number(raw?.distanceKm || 0),

    totalDriveMinutes:
      typeof raw?.totalDriveMinutes === "number"
        ? raw.totalDriveMinutes
        : Number(raw?.totalDriveMinutes || 0),

    estimatedDurationMinutes:
      typeof raw?.estimatedDurationMinutes === "number"
        ? raw.estimatedDurationMinutes
        : Number(raw?.estimatedDurationMinutes || 0),
    stops: Array.isArray(raw?.stops) ? raw.stops : [],
    pickupTime: raw?.pickupTime || null,
    totalPrice:
      typeof raw?.totalPrice === "number"
        ? raw.totalPrice
        : Number(raw?.totalPrice || 0),
    cancelReason: raw?.cancelReason || null,
    cancelledAt: raw?.cancelledAt || null,
    isVerified: Boolean(raw?.isVerified),
    status: raw?.status || null,
    createdAt: raw?.createdAt || null,
  };
}

export async function fetchPendingVerifyTrips() {
  const data = await adminRequest("/api/trips/admin/trips/unverified", {
    method: "GET",
  });

  const items = Array.isArray(data?.items) ? data.items : [];
  return items.map(mapTripItem);
}

export async function fetchPendingVerifyCancelledTrips() {
  const data = await adminRequest("/api/admin/trips/unverified-cancelled", {
    method: "GET",
  });

  const items = Array.isArray(data?.items) ? data.items : [];
  return items.map(mapTripItem);
}

export type PendingTripDetail = {
  id: string;

  creatorName?: string | null;
  creatorPhone?: string | null;

  riderName: string | null;
  riderPhone: string | null;

  pickupAddress: string;
  dropoffAddress: string;

  carType?: string | null;
  fuelPreference?: string | null;

  direction?: string | null;

  distanceKm?: number | null;

  totalDriveMinutes?: number | null;

  estimatedDurationMinutes?: number | null;

  stops: Array<{
    seq?: number;
    address?: string;
  }>;

  pickupTime: string | null;
  returnTime: string | null;

  totalPrice: number | null;

  tripType: string | null;
  status: string | null;

  isVerified: boolean;
  verifiedAt: string | null;

  cancelledAt: string | null;
  cancelReason: string | null;

  note: string | null;
  createdAt: string | null;

  driverName: string | null;
  driverPhone: string | null;
};

export type ManualAdjustTripStopPayload = {
  id?: string;
  seq?: number;
  address: string;
};

export type ManualAdjustTripPayload = {
  pickupAddress: string;
  note: string;
  dropoffAddress: string;
  carType: string;
  direction: string;
  pickupTime: string;
  returnTime: string | null;
  stops: ManualAdjustTripStopPayload[];
  distanceKm: number;
  fareEstimate: number;
  totalPrice: number;
  estimatedDurationMinutes: number;
  outboundDriveMinutes: number;
  returnDriveMinutes: number;
  totalDriveMinutes: number;
  verifiedNote: string;
};

export async function manualAdjustPendingTrip(
  tripId: string,
  payload: ManualAdjustTripPayload,
) {
  const data = await adminRequest(`/api/admin/trips/${tripId}/manual-adjust`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  return data;
}

function mapTripDetail(raw: any): PendingTripDetail {
  const rider =
    raw?.rider || raw?.customer || raw?.user || raw?.tripUser || null;

  const driver = raw?.driver || raw?.driverUser || raw?.assignedDriver || null;

  return {
    id: String(raw?.id || raw?.tripId || ""),
    creatorName: raw?.creatorName || rider?.displayName || null,
    creatorPhone: raw?.creatorPhone || rider?.phone || null,
    riderName: raw?.riderName || rider?.displayName || rider?.name || null,
    riderPhone: raw?.riderPhone || rider?.phone || null,
    pickupAddress: String(raw?.pickupAddress || ""),
    dropoffAddress: String(raw?.dropoffAddress || ""),
    carType: raw?.carType || null,
    fuelPreference: raw?.fuelPreference || "ANY",
    direction: raw?.direction || raw?.tripType || null,

    distanceKm:
      typeof raw?.distanceKm === "number"
        ? raw.distanceKm
        : Number(raw?.distanceKm || 0),

    totalDriveMinutes:
      typeof raw?.totalDriveMinutes === "number"
        ? raw.totalDriveMinutes
        : Number(raw?.totalDriveMinutes || 0),

    estimatedDurationMinutes:
      typeof raw?.estimatedDurationMinutes === "number"
        ? raw.estimatedDurationMinutes
        : Number(raw?.estimatedDurationMinutes || 0),
    stops: Array.isArray(raw?.stops) ? raw.stops : [],
    pickupTime: raw?.pickupTime || null,
    returnTime: raw?.returnTime || null,
    totalPrice:
      typeof raw?.totalPrice === "number"
        ? raw.totalPrice
        : Number(raw?.totalPrice || 0),
    tripType: raw?.tripType || null,
    status: raw?.status || null,
    isVerified: Boolean(raw?.isVerified),
    verifiedAt: raw?.verifiedAt || null,
    cancelledAt: raw?.cancelledAt || null,
    cancelReason: raw?.cancelReason || null,
    note: raw?.note || raw?.adminNote || null,
    createdAt: raw?.createdAt || null,
    driverName: raw?.driverName || driver?.displayName || driver?.name || null,
    driverPhone: raw?.driverPhone || driver?.phone || null,
  };
}

export async function fetchPendingTripDetail(tripId: string) {
  const data = await adminRequest(`/api/admin/trips/${tripId}`, {
    method: "GET",
  });

  return mapTripDetail(data?.item || data?.trip || data?.data || data);
}

export async function verifyPendingTrip(tripId: string) {
  const data = await adminRequest(`/api/trips/admin/trips/${tripId}/verify`, {
    method: "POST",
  });

  return data;
}

export async function cancelPendingTrip(tripId: string, reason: string) {
  const data = await adminRequest(`/api/admin/trips/${tripId}/cancel`, {
    method: "POST",
    body: JSON.stringify({
      cancel_reason: reason,
    }),
  });

  return data;
}
