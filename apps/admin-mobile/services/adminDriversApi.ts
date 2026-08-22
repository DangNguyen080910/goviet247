// Path: goviet247/apps/admin-mobile/services/adminDriversApi.ts
import { adminRequest } from "./adminRequest";

export type DriverListItem = {
  id: string;
  userId: string | null;
  displayName: string | null;
  phone: string | null;
  isPhoneVerified: boolean;
  status: string | null;
  brand: string | null;
  model: string | null;
  vehicleYear: number | null;
  licensePlate: string | null;
  createdAt: string | null;
};

export type DriverListResponse = {
  items: DriverListItem[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  } | null;
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

function toNumberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function pickPhone(raw: any) {
  const candidates = [
    raw?.phone,
    raw?.phoneNumber,
    raw?.mobile,
    raw?.userPhone,
    raw?.driverPhone,
    raw?.user?.phone,
    raw?.user?.phoneNumber,
    raw?.user?.mobile,
    raw?.user?.phones?.[0]?.e164,
    raw?.user?.phones?.find?.((phone: any) => phone?.isVerified)?.e164,
  ];

  const found = candidates.find((value) => {
    return typeof value === "string" && value.trim().length > 0;
  });

  return found ? String(found).trim() : null;
}

function mapDriverItem(raw: any): DriverListItem {
  return {
    id: String(raw?.id || ""),
    userId: raw?.userId ? String(raw.userId) : null,
    displayName:
      typeof raw?.displayName === "string"
        ? raw.displayName
        : typeof raw?.fullName === "string"
          ? raw.fullName
          : null,
    phone: pickPhone(raw),
    isPhoneVerified: Boolean(raw?.isPhoneVerified ?? raw?.user?.isVerified),
    status: typeof raw?.status === "string" ? raw.status : null,
    brand:
      typeof raw?.brand === "string"
        ? raw.brand
        : typeof raw?.vehicleBrand === "string"
          ? raw.vehicleBrand
          : null,
    model:
      typeof raw?.model === "string"
        ? raw.model
        : typeof raw?.vehicleModel === "string"
          ? raw.vehicleModel
          : null,
    vehicleYear: toNumberOrNull(
      raw?.vehicleYear ?? raw?.year ?? raw?.vehicle?.year,
    ),
    licensePlate:
      typeof raw?.licensePlate === "string"
        ? raw.licensePlate
        : typeof raw?.plateNumber === "string"
          ? raw.plateNumber
          : null,
    createdAt: typeof raw?.createdAt === "string" ? raw.createdAt : null,
  };
}

export async function fetchDrivers(
  params: Record<string, unknown> = {},
): Promise<DriverListResponse> {
  const data = await adminRequest(`/api/admin/drivers${buildQuery(params)}`, {
    method: "GET",
  });

  return {
    items: Array.isArray(data?.items)
      ? data.items.map(mapDriverItem)
      : Array.isArray(data?.drivers)
        ? data.drivers.map(mapDriverItem)
        : [],
    meta: data?.meta || null,
  };
}

export async function fetchDriverDetail(id: string) {
  const data = await adminRequest(`/api/admin/drivers/${id}`, {
    method: "GET",
  });

  const raw = data?.driver || data?.data || data || null;

  if (!raw) return null;

  return {
    id: String(raw?.id || ""),
    userId: raw?.userId ? String(raw.userId) : null,
    displayName:
      typeof raw?.displayName === "string"
        ? raw.displayName
        : typeof raw?.fullName === "string"
          ? raw.fullName
          : typeof raw?.user?.displayName === "string"
            ? raw.user.displayName
            : null,
    phone: pickPhone(raw),
    isPhoneVerified: Boolean(
      raw?.isPhoneVerified ?? raw?.user?.isVerified ?? raw?.user?.phoneVerified,
    ),
    status: typeof raw?.status === "string" ? raw.status : null,
    brand:
      typeof raw?.brand === "string"
        ? raw.brand
        : typeof raw?.vehicleBrand === "string"
          ? raw.vehicleBrand
          : null,
    model:
      typeof raw?.model === "string"
        ? raw.model
        : typeof raw?.vehicleModel === "string"
          ? raw.vehicleModel
          : null,
    vehicleYear: toNumberOrNull(
      raw?.vehicleYear ?? raw?.year ?? raw?.vehicle?.year,
    ),
    licensePlate:
      typeof raw?.licensePlate === "string"
        ? raw.licensePlate
        : typeof raw?.plateNumber === "string"
          ? raw.plateNumber
          : null,
    createdAt: typeof raw?.createdAt === "string" ? raw.createdAt : null,
    rejectedReason:
      typeof raw?.rejectedReason === "string"
        ? raw.rejectedReason
        : typeof raw?.rejectReason === "string"
          ? raw.rejectReason
          : null,
    suspendedReason:
      typeof raw?.suspendedReason === "string" ? raw.suspendedReason : null,
    cccdNumber:
      typeof raw?.cccdNumber === "string"
        ? raw.cccdNumber
        : typeof raw?.identityNumber === "string"
          ? raw.identityNumber
          : null,
    completedTripCount: Number(
      raw?.completedTripCount ??
        raw?.totalCompletedTrips ??
        raw?.completedTrips ??
        raw?.tripCompletedCount ??
        raw?.stats?.completedTripCount ??
        raw?.stats?.totalCompletedTrips ??
        0,
    ),
    cancelledTripCount: Number(
      raw?.cancelledTripCount ??
        raw?.totalCancelledTrips ??
        raw?.cancelledTrips ??
        raw?.tripCancelledCount ??
        raw?.stats?.cancelledTripCount ??
        raw?.stats?.totalCancelledTrips ??
        0,
    ),
    documents: Array.isArray(raw?.documents)
      ? raw.documents.map((doc: any) => ({
          id: String(doc?.id || ""),
          type:
            typeof doc?.type === "string"
              ? doc.type
              : typeof doc?.documentType === "string"
                ? doc.documentType
                : "DOCUMENT",
          status: typeof doc?.status === "string" ? doc.status : null,
          note:
            typeof doc?.note === "string"
              ? doc.note
              : typeof doc?.reason === "string"
                ? doc.reason
                : null,
          fileUrl:
            typeof doc?.fileUrl === "string"
              ? doc.fileUrl
              : typeof doc?.fileURL === "string"
                ? doc.fileURL
                : typeof doc?.url === "string"
                  ? doc.url
                  : typeof doc?.imageUrl === "string"
                    ? doc.imageUrl
                    : typeof doc?.publicUrl === "string"
                      ? doc.publicUrl
                      : typeof doc?.publicURL === "string"
                        ? doc.publicURL
                        : typeof doc?.signedUrl === "string"
                          ? doc.signedUrl
                          : typeof doc?.presignedUrl === "string"
                            ? doc.presignedUrl
                            : typeof doc?.downloadUrl === "string"
                              ? doc.downloadUrl
                              : typeof doc?.s3Url === "string"
                                ? doc.s3Url
                                : typeof doc?.key === "string"
                                  ? doc.key
                                  : typeof doc?.s3Key === "string"
                                    ? doc.s3Key
                                    : null,
          viewUrl:
            typeof doc?.viewUrl === "string"
              ? doc.viewUrl
              : typeof doc?.signedUrl === "string"
                ? doc.signedUrl
                : typeof doc?.presignedUrl === "string"
                  ? doc.presignedUrl
                  : typeof doc?.downloadUrl === "string"
                    ? doc.downloadUrl
                    : null,
          createdAt: typeof doc?.createdAt === "string" ? doc.createdAt : null,
        }))
      : [],
  };
}

export async function fetchDriverLogs(id: string) {
  const data = await adminRequest(`/api/admin/drivers/${id}/logs`, {
    method: "GET",
  });

  const rawItems = Array.isArray(data?.items)
    ? data.items
    : Array.isArray(data?.logs)
      ? data.logs
      : Array.isArray(data)
        ? data
        : [];

  return rawItems.map((item: any) => ({
    id: String(item?.id || ""),
    action:
      typeof item?.action === "string"
        ? item.action
        : typeof item?.type === "string"
          ? item.type
          : "LOG",
    note:
      typeof item?.note === "string"
        ? item.note
        : typeof item?.reason === "string"
          ? item.reason
          : typeof item?.message === "string"
            ? item.message
            : null,
    actorUsername:
      typeof item?.actorUsername === "string"
        ? item.actorUsername
        : typeof item?.adminUsername === "string"
          ? item.adminUsername
          : null,
    createdAt: typeof item?.createdAt === "string" ? item.createdAt : null,
  }));
}

export async function patchDriverKyc(
  id: string,
  payload: Record<string, unknown>,
) {
  const data = await adminRequest(`/api/admin/drivers/${id}/kyc`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  return data;
}

export async function patchDriverAccount(
  id: string,
  payload: Record<string, unknown>,
) {
  const data = await adminRequest(`/api/admin/drivers/${id}/account`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  return data;
}
