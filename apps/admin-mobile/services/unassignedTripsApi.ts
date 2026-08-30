// Path: admin-mobile/services/unassignedTripsApi.ts
import { adminRequest } from "./adminRequest";

export type UnassignedTripItem = {
  id: string;
  creatorName?: string | null;
  creatorPhone?: string | null;
  riderName: string | null;
  riderPhone: string | null;
  pickupAddress: string;
  dropoffAddress: string;
  carType?: string | null;
  fuelPreference?: string | null;

  distanceKm?: number | null;

  totalDriveMinutes?: number | null;

  estimatedDurationMinutes?: number | null;
  stops: Array<{
    seq?: number;
    address?: string;
  }>;
  createdAt: string | null;
  pickupTime: string | null;
  totalPrice: number | null;
  status: string | null;
  isVerified: boolean;
  cancelledAt: string | null;
  cancelReason: string | null;
  pendingMinutes: number;
  alertCount: number;
  lastAlertAt: string | null;
};

export type UnassignedTripAlertLog = {
  id: string;
  type: string | null;
  level: number | null;
  sentAt: string | null;
  channel: string | null;
  note: string | null;
};

export type UnassignedTripDetail = {
  id: string;
  creatorName?: string | null;
  creatorPhone?: string | null;
  riderName: string | null;
  riderPhone: string | null;
  pickupAddress: string;
  dropoffAddress: string;
  carType?: string | null;
  fuelPreference?: string | null;

  distanceKm?: number | null;

  totalDriveMinutes?: number | null;

  estimatedDurationMinutes?: number | null;
  stops: Array<{
    seq?: number;
    address?: string;
  }>;
  pickupTime: string | null;
  returnTime: string | null;
  createdAt: string | null;
  totalPrice: number | null;
  tripType: string | null;
  status: string | null;
  isVerified: boolean;
  verifiedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  note: string | null;
  driverName: string | null;
  driverPhone: string | null;
  alertCount: number;
  lastAlertAt: string | null;
  pendingMinutes: number;
  alertLogs: UnassignedTripAlertLog[];
};

function toNumber(value: unknown, fallback = 0) {
  if (value == null || value === "") return fallback;

  const cleaned =
    typeof value === "string" ? value.replace(/[^\d.-]/g, "") : value;

  const num = Number(cleaned);
  return Number.isFinite(num) ? num : fallback;
}

function pickTripPrice(item: Record<string, unknown>) {
  const rawValue =
    item.totalPrice ??
    item.finalPrice ??
    item.price ??
    item.totalFare ??
    item.fareEstimate ??
    item.estimatedFare ??
    item.fareAmount ??
    item.estimatedPrice ??
    item.quotePrice ??
    item.customerPrice ??
    item.amount ??
    null;

  if (rawValue == null) return null;

  return toNumber(rawValue, 0);
}

function mapStops(raw: unknown) {
  if (!Array.isArray(raw)) return [];

  return raw.map((stop) => {
    const item = stop as { seq?: unknown; address?: unknown };

    return {
      seq: typeof item?.seq === "number" ? item.seq : toNumber(item?.seq, 0),
      address: typeof item?.address === "string" ? item.address : "",
    };
  });
}

function safeMinutesFromNow(value: string | null | undefined) {
  if (!value) return 0;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;

  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
}

function mapTripItem(raw: unknown): UnassignedTripItem {
  const item = raw as {
    id?: unknown;
    tripId?: unknown;
    creatorName?: unknown;
    creatorPhone?: unknown;
    riderName?: unknown;
    riderPhone?: unknown;
    pickupAddress?: unknown;
    dropoffAddress?: unknown;
    carType?: unknown;
    fuelPreference?: unknown;
    distanceKm?: unknown;
    totalDriveMinutes?: unknown;
    estimatedDurationMinutes?: unknown;
    stops?: unknown;
    createdAt?: unknown;
    pickupTime?: unknown;
    totalPrice?: unknown;
    status?: unknown;
    isVerified?: unknown;
    cancelledAt?: unknown;
    cancelReason?: unknown;
    pendingMinutes?: unknown;
    alertCount?: unknown;
    pendingAlertCount?: unknown;
    lastAlertAt?: unknown;
    pendingAlertAt?: unknown;
  };

  return {
    id: String(item?.id || item?.tripId || ""),
    creatorName:
      typeof item?.creatorName === "string" ? item.creatorName : null,
    creatorPhone:
      typeof item?.creatorPhone === "string" ? item.creatorPhone : null,
    riderName: typeof item?.riderName === "string" ? item.riderName : null,
    riderPhone: typeof item?.riderPhone === "string" ? item.riderPhone : null,
    pickupAddress:
      typeof item?.pickupAddress === "string" ? item.pickupAddress : "",
    dropoffAddress:
      typeof item?.dropoffAddress === "string" ? item.dropoffAddress : "",
    carType: typeof item?.carType === "string" ? item.carType : null,
    fuelPreference:
      typeof item?.fuelPreference === "string" ? item.fuelPreference : "ANY",

    distanceKm: toNumber(item?.distanceKm, 0),

    totalDriveMinutes: toNumber(item?.totalDriveMinutes, 0),

    estimatedDurationMinutes: toNumber(item?.estimatedDurationMinutes, 0),
    stops: mapStops(item?.stops),
    createdAt: typeof item?.createdAt === "string" ? item.createdAt : null,
    pickupTime: typeof item?.pickupTime === "string" ? item.pickupTime : null,
    totalPrice: pickTripPrice(item as Record<string, unknown>),
    status: typeof item?.status === "string" ? item.status : null,
    isVerified: Boolean(item?.isVerified),
    cancelledAt:
      typeof item?.cancelledAt === "string" ? item.cancelledAt : null,
    cancelReason:
      typeof item?.cancelReason === "string" ? item.cancelReason : null,
    pendingMinutes: toNumber(item?.pendingMinutes, 0),
    alertCount: toNumber(item?.alertCount ?? item?.pendingAlertCount, 0),
    lastAlertAt:
      typeof (item?.lastAlertAt ?? item?.pendingAlertAt) === "string"
        ? String(item?.lastAlertAt ?? item?.pendingAlertAt)
        : null,
  };
}

function mapAlertLog(raw: unknown): UnassignedTripAlertLog {
  const item = raw as {
    id?: unknown;
    type?: unknown;
    level?: unknown;
    sentAt?: unknown;
    channel?: unknown;
    note?: unknown;
  };

  return {
    id: String(item?.id || ""),
    type: typeof item?.type === "string" ? item.type : null,
    level: item?.level == null ? null : toNumber(item?.level, 0),
    sentAt: typeof item?.sentAt === "string" ? item.sentAt : null,
    channel: typeof item?.channel === "string" ? item.channel : null,
    note: typeof item?.note === "string" ? item.note : null,
  };
}

function mapTripDetail(raw: unknown): UnassignedTripDetail {
  const item = raw as {
    id?: unknown;
    tripId?: unknown;
    creatorName?: unknown;
    creatorPhone?: unknown;
    riderName?: unknown;
    riderPhone?: unknown;
    rider?: { displayName?: unknown; phone?: unknown } | null;
    driverName?: unknown;
    driverPhone?: unknown;
    driver?: {
      displayName?: unknown;
      phones?: Array<{ e164?: unknown }>;
    } | null;
    pickupAddress?: unknown;
    dropoffAddress?: unknown;
    carType?: unknown;
    fuelPreference?: unknown;
    distanceKm?: unknown;
    totalDriveMinutes?: unknown;
    estimatedDurationMinutes?: unknown;
    stops?: unknown;
    pickupTime?: unknown;
    returnTime?: unknown;
    createdAt?: unknown;
    totalPrice?: unknown;
    tripType?: unknown;
    status?: unknown;
    isVerified?: unknown;
    verifiedAt?: unknown;
    cancelledAt?: unknown;
    cancelReason?: unknown;
    note?: unknown;
    adminNote?: unknown;
    alertLogs?: unknown;
    unassignedTripAlertCount?: unknown;
    pendingTripAlertCount?: unknown;
    unassignedTripAlertAt?: unknown;
    pendingTripAlertAt?: unknown;
  };

  const driverPhone = Array.isArray(item?.driver?.phones)
    ? item.driver?.phones?.[0]?.e164
    : null;

  const isVerified = Boolean(item?.isVerified);
  const alertCount = isVerified
    ? toNumber(item?.unassignedTripAlertCount, 0)
    : toNumber(item?.pendingTripAlertCount, 0);

  const lastAlertAt = isVerified
    ? item?.unassignedTripAlertAt
    : item?.pendingTripAlertAt;

  const createdAt = typeof item?.createdAt === "string" ? item.createdAt : null;

  return {
    id: String(item?.id || item?.tripId || ""),
    creatorName:
      typeof item?.creatorName === "string" ? item.creatorName : null,
    creatorPhone:
      typeof item?.creatorPhone === "string" ? item.creatorPhone : null,
    riderName:
      typeof item?.riderName === "string"
        ? item.riderName
        : typeof item?.rider?.displayName === "string"
          ? item.rider.displayName
          : null,
    riderPhone:
      typeof item?.riderPhone === "string"
        ? item.riderPhone
        : typeof item?.rider?.phone === "string"
          ? item.rider.phone
          : null,
    pickupAddress:
      typeof item?.pickupAddress === "string" ? item.pickupAddress : "",
    dropoffAddress:
      typeof item?.dropoffAddress === "string" ? item.dropoffAddress : "",
    carType: typeof item?.carType === "string" ? item.carType : null,
    fuelPreference:
      typeof item?.fuelPreference === "string" ? item.fuelPreference : "ANY",

    distanceKm: toNumber(item?.distanceKm, 0),

    totalDriveMinutes: toNumber(item?.totalDriveMinutes, 0),

    estimatedDurationMinutes: toNumber(item?.estimatedDurationMinutes, 0),
    stops: mapStops(item?.stops),
    pickupTime: typeof item?.pickupTime === "string" ? item.pickupTime : null,
    returnTime: typeof item?.returnTime === "string" ? item.returnTime : null,
    createdAt,
    totalPrice: pickTripPrice(item as Record<string, unknown>),
    tripType: typeof item?.tripType === "string" ? item.tripType : null,
    status: typeof item?.status === "string" ? item.status : null,
    isVerified,
    verifiedAt: typeof item?.verifiedAt === "string" ? item.verifiedAt : null,
    cancelledAt:
      typeof item?.cancelledAt === "string" ? item.cancelledAt : null,
    cancelReason:
      typeof item?.cancelReason === "string" ? item.cancelReason : null,
    note:
      typeof item?.note === "string"
        ? item.note
        : typeof item?.adminNote === "string"
          ? item.adminNote
          : null,
    driverName:
      typeof item?.driverName === "string"
        ? item.driverName
        : typeof item?.driver?.displayName === "string"
          ? item.driver.displayName
          : null,
    driverPhone: typeof driverPhone === "string" ? driverPhone : null,
    alertCount,
    lastAlertAt: typeof lastAlertAt === "string" ? lastAlertAt : null,
    pendingMinutes: safeMinutesFromNow(createdAt),
    alertLogs: Array.isArray(item?.alertLogs)
      ? item.alertLogs.map(mapAlertLog)
      : [],
  };
}

export async function fetchUnassignedTrips() {
  const data = (await adminRequest("/api/admin/pending-trips", {
    method: "GET",
  })) as {
    items?: unknown[];
    trips?: unknown[];
  };

  const items = Array.isArray(data?.trips)
    ? data.trips
    : Array.isArray(data?.items)
      ? data.items
      : [];

  return items.map(mapTripItem);
}

export async function fetchUnassignedCancelledTrips() {
  const data = (await adminRequest("/api/admin/pending-trips/cancelled", {
    method: "GET",
  })) as {
    items?: unknown[];
    trips?: unknown[];
  };

  const items = Array.isArray(data?.items)
    ? data.items
    : Array.isArray(data?.trips)
      ? data.trips
      : [];

  return items.map(mapTripItem);
}

export async function fetchUnassignedTripDetail(tripId: string) {
  const data = (await adminRequest(`/api/admin/trips/${tripId}`, {
    method: "GET",
  })) as {
    item?: unknown;
    trip?: unknown;
    data?: unknown;
  };

  return mapTripDetail(data?.item || data?.trip || data?.data || data);
}

export async function cancelUnassignedTrip(tripId: string, reason: string) {
  return adminRequest(`/api/admin/trips/${tripId}/cancel`, {
    method: "POST",
    body: JSON.stringify({
      cancel_reason: reason,
    }),
  });
}
