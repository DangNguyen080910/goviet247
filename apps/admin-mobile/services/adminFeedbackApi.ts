// Path: goviet247/apps/admin-mobile/services/adminFeedbackApi.ts
import { adminRequest } from "./adminRequest";

export type FeedbackStatus = "NEW" | "IN_REVIEW" | "RESOLVED" | "CLOSED";
export type FeedbackActorRole = "RIDER" | "DRIVER";

export type FeedbackSource =
  | "RIDER_PROFILE"
  | "RIDER_TRIP_HISTORY"
  | "DRIVER_MENU"
  | "DRIVER_TRIP_HISTORY";

export type FeedbackTripSummary = {
  id: string;
  pickupAddress: string | null;
  dropoffAddress: string | null;
  pickupTime: string | null;
  status: string | null;
  riderName: string | null;
  riderPhone: string | null;
  carType: string | null;
  direction: string | null;
};

export type FeedbackUserSummary = {
  id: string;
  displayName: string | null;
  primaryRole: string | null;
};

export type FeedbackResolvedBySummary = {
  id: string;
  username: string | null;
  role: string | null;
};

export type FeedbackItem = {
  id: string;
  userId: string | null;
  tripId: string | null;
  actorRole: FeedbackActorRole | null;
  source: FeedbackSource | null;
  subject: string | null;
  message: string | null;
  senderName: string | null;
  senderPhone: string | null;
  status: FeedbackStatus | null;
  adminNote: string | null;
  resolvedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  trip?: FeedbackTripSummary | null;
  user?: FeedbackUserSummary | null;
  resolvedBy?: FeedbackResolvedBySummary | null;
};

export type FeedbackListResponse = {
  items: FeedbackItem[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  } | null;
};

export type FetchAdminFeedbacksParams = {
  q?: string;
  actorRole?: FeedbackActorRole | "ALL";
  status?: string;
  page?: number;
  pageSize?: number;
};

function buildQuery(params: Record<string, unknown> = {}) {
  const qs = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (
      value === undefined ||
      value === null ||
      value === "" ||
      value === "ALL" ||
      value === "all"
    ) {
      return;
    }

    qs.set(key, String(value));
  });

  const query = qs.toString();
  return query ? `?${query}` : "";
}

function mapFeedbackItem(raw: any): FeedbackItem {
  return {
    id: String(raw?.id || ""),
    userId: raw?.userId ? String(raw.userId) : null,
    tripId: raw?.tripId ? String(raw.tripId) : null,
    actorRole:
      raw?.actorRole === "RIDER" || raw?.actorRole === "DRIVER"
        ? raw.actorRole
        : null,
    source: typeof raw?.source === "string" ? raw.source : null,
    subject: typeof raw?.subject === "string" ? raw.subject : null,
    message: typeof raw?.message === "string" ? raw.message : null,
    senderName: typeof raw?.senderName === "string" ? raw.senderName : null,
    senderPhone: typeof raw?.senderPhone === "string" ? raw.senderPhone : null,
    status: typeof raw?.status === "string" ? raw.status : null,
    adminNote: typeof raw?.adminNote === "string" ? raw.adminNote : null,
    resolvedAt: typeof raw?.resolvedAt === "string" ? raw.resolvedAt : null,
    createdAt: typeof raw?.createdAt === "string" ? raw.createdAt : null,
    updatedAt: typeof raw?.updatedAt === "string" ? raw.updatedAt : null,
    trip: raw?.trip
      ? {
          id: String(raw.trip.id || ""),
          pickupAddress:
            typeof raw.trip.pickupAddress === "string"
              ? raw.trip.pickupAddress
              : null,
          dropoffAddress:
            typeof raw.trip.dropoffAddress === "string"
              ? raw.trip.dropoffAddress
              : null,
          pickupTime:
            typeof raw.trip.pickupTime === "string" ? raw.trip.pickupTime : null,
          status: typeof raw.trip.status === "string" ? raw.trip.status : null,
          riderName:
            typeof raw.trip.riderName === "string" ? raw.trip.riderName : null,
          riderPhone:
            typeof raw.trip.riderPhone === "string"
              ? raw.trip.riderPhone
              : null,
          carType: typeof raw.trip.carType === "string" ? raw.trip.carType : null,
          direction:
            typeof raw.trip.direction === "string" ? raw.trip.direction : null,
        }
      : null,
    user: raw?.user
      ? {
          id: String(raw.user.id || ""),
          displayName:
            typeof raw.user.displayName === "string"
              ? raw.user.displayName
              : null,
          primaryRole:
            typeof raw.user.primaryRole === "string"
              ? raw.user.primaryRole
              : null,
        }
      : null,
    resolvedBy: raw?.resolvedBy
      ? {
          id: String(raw.resolvedBy.id || ""),
          username:
            typeof raw.resolvedBy.username === "string"
              ? raw.resolvedBy.username
              : null,
          role:
            typeof raw.resolvedBy.role === "string" ? raw.resolvedBy.role : null,
        }
      : null,
  };
}

export async function fetchAdminFeedbacks(
  params: FetchAdminFeedbacksParams = {},
): Promise<FeedbackListResponse> {
  const query = buildQuery(params);
  const data = await adminRequest(`/api/admin/feedbacks${query}`, {
    method: "GET",
  });

  return {
    items: Array.isArray(data?.items) ? data.items.map(mapFeedbackItem) : [],
    meta: data?.meta || null,
  };
}

export async function fetchAdminFeedbackDetail(
  id: string,
): Promise<FeedbackItem | null> {
  const data = await adminRequest(`/api/admin/feedbacks/${id}`, {
    method: "GET",
  });

  const raw = data?.feedback || data?.item || data || null;
  if (!raw) return null;

  return mapFeedbackItem(raw);
}

export async function updateAdminFeedback(
  id: string,
  payload: {
    status?: FeedbackStatus;
    adminNote?: string;
  },
) {
  return adminRequest(`/api/admin/feedbacks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}