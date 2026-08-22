// Path: goviet247/apps/admin-mobile/services/adminCustomersApi.ts
import { adminRequest } from "./adminRequest";

export type CustomerListItem = {
  id: string;
  displayName: string | null;
  fullName: string | null;
  phone: string | null;
  isPhoneVerified: boolean;
  status: string | null;
  totalTrips: number;
  createdAt: string | null;
  updatedAt: string | null;
  suspendedAt: string | null;
  suspendReason: string | null;
};

export type CustomerListResponse = {
  items: CustomerListItem[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  } | null;
};

export type CustomerDetail = {
  id: string;
  displayName: string | null;
  fullName: string | null;
  phone: string | null;
  isPhoneVerified: boolean;
  status: string | null;
  totalTrips: number;
  createdAt: string | null;
  updatedAt: string | null;
  suspendedAt: string | null;
  suspendReason: string | null;
};

export type CustomerLogItem = {
  id: string;
  action: string | null;
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
  actorId: string | null;
  actorUsername: string | null;
  createdAt: string | null;
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

function getLatestPhone(raw: any) {
  if (typeof raw?.phone === "string") return raw.phone;
  if (typeof raw?.user?.phone === "string") return raw.user.phone;

  if (Array.isArray(raw?.phones) && raw.phones.length > 0) {
    return typeof raw.phones[0]?.e164 === "string" ? raw.phones[0].e164 : null;
  }

  if (Array.isArray(raw?.user?.phones) && raw.user.phones.length > 0) {
    return typeof raw.user.phones[0]?.e164 === "string"
      ? raw.user.phones[0].e164
      : null;
  }

  return null;
}

function getPhoneVerified(raw: any) {
  if (typeof raw?.isPhoneVerified === "boolean") return raw.isPhoneVerified;
  if (typeof raw?.user?.isVerified === "boolean") return raw.user.isVerified;

  if (Array.isArray(raw?.phones) && raw.phones.length > 0) {
    return Boolean(raw.phones[0]?.isVerified);
  }

  if (Array.isArray(raw?.user?.phones) && raw.user.phones.length > 0) {
    return Boolean(raw.user.phones[0]?.isVerified);
  }

  return false;
}

function mapCustomerItem(raw: any): CustomerListItem {
  return {
    id: String(raw?.id || raw?.user?.id || ""),
    displayName:
      typeof raw?.displayName === "string"
        ? raw.displayName
        : typeof raw?.user?.displayName === "string"
          ? raw.user.displayName
          : null,
    fullName:
      typeof raw?.fullName === "string"
        ? raw.fullName
        : typeof raw?.riderProfile?.fullName === "string"
          ? raw.riderProfile.fullName
          : null,
    phone: getLatestPhone(raw),
    isPhoneVerified: getPhoneVerified(raw),
    status:
      typeof raw?.status === "string"
        ? raw.status
        : typeof raw?.riderProfile?.status === "string"
          ? raw.riderProfile.status
          : "ACTIVE",
    totalTrips: Number(raw?._count?.riderTrips || raw?.counts?.riderTrips || 0),
    createdAt: typeof raw?.createdAt === "string" ? raw.createdAt : null,
    updatedAt: typeof raw?.updatedAt === "string" ? raw.updatedAt : null,
    suspendedAt:
      typeof raw?.suspendedAt === "string"
        ? raw.suspendedAt
        : typeof raw?.riderProfile?.suspendedAt === "string"
          ? raw.riderProfile.suspendedAt
          : null,
    suspendReason:
      typeof raw?.suspendReason === "string"
        ? raw.suspendReason
        : typeof raw?.riderProfile?.suspendReason === "string"
          ? raw.riderProfile.suspendReason
          : null,
  };
}

function mapCustomerDetail(raw: any): CustomerDetail | null {
  if (!raw) return null;

  return {
    id: String(raw?.id || raw?.user?.id || ""),
    displayName:
      typeof raw?.displayName === "string"
        ? raw.displayName
        : typeof raw?.user?.displayName === "string"
          ? raw.user.displayName
          : null,
    fullName:
      typeof raw?.fullName === "string"
        ? raw.fullName
        : typeof raw?.riderProfile?.fullName === "string"
          ? raw.riderProfile.fullName
          : null,
    phone: getLatestPhone(raw),
    isPhoneVerified: getPhoneVerified(raw),
    status:
      typeof raw?.status === "string"
        ? raw.status
        : typeof raw?.riderProfile?.status === "string"
          ? raw.riderProfile.status
          : "ACTIVE",
    totalTrips: Number(raw?.counts?.riderTrips || raw?._count?.riderTrips || 0),
    createdAt: typeof raw?.createdAt === "string" ? raw.createdAt : null,
    updatedAt: typeof raw?.updatedAt === "string" ? raw.updatedAt : null,
    suspendedAt:
      typeof raw?.suspendedAt === "string"
        ? raw.suspendedAt
        : typeof raw?.riderProfile?.suspendedAt === "string"
          ? raw.riderProfile.suspendedAt
          : null,
    suspendReason:
      typeof raw?.suspendReason === "string"
        ? raw.suspendReason
        : typeof raw?.riderProfile?.suspendReason === "string"
          ? raw.riderProfile.suspendReason
          : null,
  };
}

function mapCustomerLogItem(raw: any): CustomerLogItem {
  return {
    id: String(raw?.id || ""),
    action: typeof raw?.action === "string" ? raw.action : null,
    fromStatus: typeof raw?.fromStatus === "string" ? raw.fromStatus : null,
    toStatus: typeof raw?.toStatus === "string" ? raw.toStatus : null,
    note: typeof raw?.note === "string" ? raw.note : null,
    actorId: raw?.actorId ? String(raw.actorId) : null,
    actorUsername:
      typeof raw?.actorUsername === "string" ? raw.actorUsername : null,
    createdAt: typeof raw?.createdAt === "string" ? raw.createdAt : null,
  };
}

export async function fetchCustomers(
  params: Record<string, unknown> = {},
): Promise<CustomerListResponse> {
  const data = await adminRequest(`/api/admin/customers${buildQuery(params)}`, {
    method: "GET",
  });

  return {
    items: Array.isArray(data?.items)
      ? data.items.map(mapCustomerItem)
      : Array.isArray(data?.customers)
        ? data.customers.map(mapCustomerItem)
        : [],
    meta: data?.meta || null,
  };
}

export async function fetchCustomerDetail(
  userId: string,
): Promise<CustomerDetail | null> {
  const data = await adminRequest(`/api/admin/customers/${userId}`, {
    method: "GET",
  });

  return mapCustomerDetail(data?.customer || data?.data || data || null);
}

export async function fetchCustomerLogs(
  userId: string,
): Promise<{ logs: CustomerLogItem[] }> {
  const data = await adminRequest(`/api/admin/customers/${userId}/logs`, {
    method: "GET",
  });

  return {
    logs: Array.isArray(data?.items)
      ? data.items.map(mapCustomerLogItem)
      : Array.isArray(data?.logs)
        ? data.logs.map(mapCustomerLogItem)
        : [],
  };
}

export async function patchCustomerAccount(
  userId: string,
  payload: {
    action: "SUSPEND" | "UNSUSPEND";
    reason?: string;
  },
) {
  const path =
    payload.action === "SUSPEND"
      ? "suspend"
      : payload.action === "UNSUSPEND"
        ? "unsuspend"
        : null;

  if (!path) {
    throw new Error("Action không hợp lệ.");
  }

  const data = await adminRequest(`/api/admin/customers/${userId}/${path}`, {
    method: "PATCH",
    body: JSON.stringify({
      reason: payload.reason || "",
    }),
  });

  return data;
}
