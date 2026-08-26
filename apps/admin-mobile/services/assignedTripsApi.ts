// Path: goviet247/apps/admin-mobile/services/assignedTripsApi.ts
import { adminRequest } from "./adminRequest";

export type AssignedTripsTabStatus =
  | "ACCEPTED"
  | "CONTACTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type AssignedTripItem = {
  id: string;
  status: AssignedTripsTabStatus | string;

  carType?: string | null;
  distanceKm?: number | null;
  totalDriveMinutes?: number | null;
  estimatedDurationMinutes?: number | null;

  pickupAddress: string;
  dropoffAddress: string;
  pickupTime: string | null;
  updatedAt: string | null;
  returnTime: string | null;
  cancelReason: string | null;
  cancelledAt: string | null;
  riderName: string | null;
  riderPhone: string | null;
  driverName: string | null;
  driverPhone: string | null;
  totalPrice: number | null;

  stops: Array<{
    id?: string;
    seq?: number;
    address?: string;
  }>;
};

export type AssignedTripDetail = {
  id: string;
  status: string | null;

  carType?: string | null;
  distanceKm?: number | null;
  totalDriveMinutes?: number | null;
  estimatedDurationMinutes?: number | null;

  pickupAddress: string;
  dropoffAddress: string;
  pickupTime: string | null;
  returnTime: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;

  riderName: string | null;
  riderPhone: string | null;

  driverName: string | null;
  driverPhone: string | null;

  totalPrice: number | null;
  tripType: string | null;
  note: string | null;

  stops: Array<{
    id?: string;
    seq?: number;
    address?: string;
  }>;
};

function toNumber(value: unknown, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function mapStops(raw: unknown) {
  if (!Array.isArray(raw)) return [];

  return raw.map((stop) => {
    const item = stop as {
      id?: unknown;
      seq?: unknown;
      address?: unknown;
    };

    return {
      id: typeof item?.id === "string" ? item.id : undefined,
      seq: typeof item?.seq === "number" ? item.seq : toNumber(item?.seq, 0),
      address: typeof item?.address === "string" ? item.address : "",
    };
  });
}

function pickPhone(user: unknown) {
  const item = user as
    | {
        phones?: Array<{
          e164?: unknown;
        }>;
      }
    | null
    | undefined;

  const phone = Array.isArray(item?.phones) ? item?.phones?.[0]?.e164 : null;
  return typeof phone === "string" ? phone : null;
}

function mapAssignedTripItem(raw: unknown): AssignedTripItem {
  const item = raw as {
    id?: unknown;
    status?: unknown;

    carType?: unknown;
    distanceKm?: unknown;
    totalDriveMinutes?: unknown;
    estimatedDurationMinutes?: unknown;

    pickupAddress?: unknown;
    dropoffAddress?: unknown;
    pickupTime?: unknown;
    totalPrice?: unknown;
    updatedAt?: unknown;
    returnTime?: unknown;
    cancelReason?: unknown;
    cancelledAt?: unknown;

    riderName?: unknown;
    riderPhone?: unknown;

    driverName?: unknown;
    driverPhone?: unknown;

    rider?: {
      displayName?: unknown;
      phones?: Array<{ e164?: unknown }>;
    } | null;

    driver?: {
      displayName?: unknown;
      phones?: Array<{ e164?: unknown }>;
    } | null;

    stops?: unknown;
  };

  return {
    id: typeof item?.id === "string" ? item.id : "",
    status: typeof item?.status === "string" ? item.status : "",
    carType: typeof item?.carType === "string" ? item.carType : null,

    distanceKm: item?.distanceKm == null ? null : toNumber(item.distanceKm, 0),

    totalDriveMinutes:
      item?.totalDriveMinutes == null
        ? null
        : toNumber(item.totalDriveMinutes, 0),

    estimatedDurationMinutes:
      item?.estimatedDurationMinutes == null
        ? null
        : toNumber(item.estimatedDurationMinutes, 0),
    pickupAddress:
      typeof item?.pickupAddress === "string" ? item.pickupAddress : "",
    dropoffAddress:
      typeof item?.dropoffAddress === "string" ? item.dropoffAddress : "",
    pickupTime:
      typeof item?.pickupTime === "string" ? item.pickupTime : null,
    totalPrice:
      item?.totalPrice == null ? null : toNumber(item.totalPrice, 0),
    updatedAt: typeof item?.updatedAt === "string" ? item.updatedAt : null,
    returnTime: typeof item?.returnTime === "string" ? item.returnTime : null,
    cancelReason:
      typeof item?.cancelReason === "string" ? item.cancelReason : null,
    cancelledAt:
      typeof item?.cancelledAt === "string" ? item.cancelledAt : null,
    riderName:
      typeof item?.riderName === "string"
        ? item.riderName
        : typeof item?.rider?.displayName === "string"
          ? item.rider.displayName
          : null,
    riderPhone:
      typeof item?.riderPhone === "string"
        ? item.riderPhone
        : pickPhone(item?.rider),
    driverName:
      typeof item?.driverName === "string"
        ? item.driverName
        : typeof item?.driver?.displayName === "string"
          ? item.driver.displayName
          : null,
    driverPhone:
      typeof item?.driverPhone === "string"
        ? item.driverPhone
        : pickPhone(item?.driver),
    stops: mapStops(item?.stops),
  };
}

function mapAssignedTripDetail(raw: unknown): AssignedTripDetail {
  const item = raw as {
    id?: unknown;
    status?: unknown;

    carType?: unknown;
    distanceKm?: unknown;
    totalDriveMinutes?: unknown;
    estimatedDurationMinutes?: unknown;

    pickupAddress?: unknown;
    dropoffAddress?: unknown;
    pickupTime?: unknown;
    returnTime?: unknown;
    createdAt?: unknown;
    updatedAt?: unknown;
    cancelledAt?: unknown;
    cancelReason?: unknown;

    riderName?: unknown;
    riderPhone?: unknown;

    driverName?: unknown;
    driverPhone?: unknown;

    totalPrice?: unknown;
    tripType?: unknown;
    note?: unknown;
    adminNote?: unknown;

    rider?: {
      displayName?: unknown;
      phone?: unknown;
      phones?: Array<{ e164?: unknown }>;
    } | null;

    driver?: {
      displayName?: unknown;
      phone?: unknown;
      phones?: Array<{ e164?: unknown }>;
    } | null;

    stops?: unknown;
  };

  const riderPhone =
    typeof item?.riderPhone === "string"
      ? item.riderPhone
      : typeof item?.rider?.phone === "string"
        ? item.rider.phone
        : pickPhone(item?.rider);

  const driverPhone =
    typeof item?.driverPhone === "string"
      ? item.driverPhone
      : typeof item?.driver?.phone === "string"
        ? item.driver.phone
        : pickPhone(item?.driver);

  return {
    id: typeof item?.id === "string" ? item.id : "",
    status: typeof item?.status === "string" ? item.status : null,
    carType: typeof item?.carType === "string" ? item.carType : null,

    distanceKm: item?.distanceKm == null ? null : toNumber(item.distanceKm, 0),

    totalDriveMinutes:
      item?.totalDriveMinutes == null
        ? null
        : toNumber(item.totalDriveMinutes, 0),

    estimatedDurationMinutes:
      item?.estimatedDurationMinutes == null
        ? null
        : toNumber(item.estimatedDurationMinutes, 0),
    pickupAddress:
      typeof item?.pickupAddress === "string" ? item.pickupAddress : "",
    dropoffAddress:
      typeof item?.dropoffAddress === "string" ? item.dropoffAddress : "",
    pickupTime: typeof item?.pickupTime === "string" ? item.pickupTime : null,
    returnTime: typeof item?.returnTime === "string" ? item.returnTime : null,
    createdAt: typeof item?.createdAt === "string" ? item.createdAt : null,
    updatedAt: typeof item?.updatedAt === "string" ? item.updatedAt : null,
    cancelledAt:
      typeof item?.cancelledAt === "string" ? item.cancelledAt : null,
    cancelReason:
      typeof item?.cancelReason === "string" ? item.cancelReason : null,
    riderName:
      typeof item?.riderName === "string"
        ? item.riderName
        : typeof item?.rider?.displayName === "string"
          ? item.rider.displayName
          : null,
    riderPhone,
    driverName:
      typeof item?.driverName === "string"
        ? item.driverName
        : typeof item?.driver?.displayName === "string"
          ? item.driver.displayName
          : null,
    driverPhone,
    totalPrice: item?.totalPrice == null ? null : toNumber(item?.totalPrice, 0),
    tripType: typeof item?.tripType === "string" ? item.tripType : null,
    note:
      typeof item?.note === "string"
        ? item.note
        : typeof item?.adminNote === "string"
          ? item.adminNote
          : null,
    stops: mapStops(item?.stops),
  };
}

export async function fetchAssignedTrips(status: AssignedTripsTabStatus) {
  const qs = new URLSearchParams({ status }).toString();

  const data = (await adminRequest(`/api/trips/admin/trips/assigned?${qs}`, {
    method: "GET",
  })) as {
    trips?: unknown[];
    items?: unknown[];
  };

  const items = Array.isArray(data?.trips)
    ? data.trips
    : Array.isArray(data?.items)
      ? data.items
      : [];

  return items.map(mapAssignedTripItem);
}

export async function fetchAssignedTripDetail(tripId: string) {
  const data = (await adminRequest(`/api/admin/trips/${tripId}`, {
    method: "GET",
  })) as {
    item?: unknown;
    trip?: unknown;
    data?: unknown;
  };

  return mapAssignedTripDetail(data?.item || data?.trip || data?.data || data);
}

export async function changeAssignedTripStatus(
  tripId: string,
  toStatus: "CONTACTED" | "IN_PROGRESS" | "COMPLETED",
  note: string,
) {
  return adminRequest(`/api/trips/admin/trips/${tripId}/change-status`, {
    method: "POST",
    body: JSON.stringify({
      toStatus,
      note,
    }),
  });
}

export async function cancelAssignedTrip(tripId: string, reason: string) {
  return adminRequest(`/api/admin/trips/${tripId}/cancel`, {
    method: "POST",
    body: JSON.stringify({
      cancel_reason: reason,
    }),
  });
}

export async function updateAssignedTripSchedule(
  tripId: string,
  pickupTime: string,
  returnTime: string | null,
) {
  return adminRequest(`/api/admin/trips/${tripId}/schedule`, {
    method: "PATCH",
    body: JSON.stringify({ pickupTime, returnTime }),
  });
}
