// Path: goviet247/apps/admin-mobile/services/adminWalletsApi.ts
import { adminRequest } from "./adminRequest";

export type DriverWalletListItem = {
  id: string;
  userId: string | null;
  displayName: string | null;
  fullName: string | null;
  phone: string | null;
  isPhoneVerified: boolean;
  status: string | null;
  licensePlate: string | null;
  balance: number;
  createdAt: string | null;
};

export type DriverWalletTransactionItem = {
  id: string;
  type: string | null;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  note: string | null;
  createdAt: string | null;
  withdrawRequestId: string | null;
  tripId: string | null;
};

export type DriverWithdrawRequestItem = {
  id: string;
  status: string | null;
  amount: number;
  createdAt: string | null;
  approvedAt: string | null;
  paidAt: string | null;
  rejectReason: string | null;
  settlementWeek: string | null;
  bankAccount: {
    id: string;
    bankName: string | null;
    accountNumber: string | null;
    accountHolderName: string | null;
  } | null;
  driverProfile: {
    id: string;
    balance: number;
    user: {
      id: string;
      displayName: string | null;
      phone: string | null;
      isPhoneVerified: boolean;
    } | null;
  } | null;
};

export type DriverTripPenaltyItem = {
  id: string;
  status: string | null;
  amount: number;
  reason: string | null;
  note: string | null;
  createdAt: string | null;
  approvedAt: string | null;
  trip: {
    id: string;
    pickupAddress: string | null;
    dropoffAddress: string | null;
  } | null;
  driverProfile: {
    id: string;
    user: {
      id: string;
      displayName: string | null;
      phone: string | null;
      isPhoneVerified: boolean;
    } | null;
  } | null;
};

export type LedgerTransactionItem = {
  id: string;
  type: string | null;
  amount: number;
  note: string | null;
  createdAt: string | null;
  balanceBefore: number;
  balanceAfter: number;
  driverProfileId: string | null;
  withdrawRequestId: string | null;
  tripId: string | null;
  driverProfile: {
    id: string;
    user: {
      id: string;
      displayName: string | null;
      phone: string | null;
      isPhoneVerified: boolean;
    } | null;
  } | null;
};

type ListMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
} | null;

type DriverWalletListResponse = {
  items: DriverWalletListItem[];
  meta: ListMeta;
};

type WalletTransactionsResponse = {
  items: DriverWalletTransactionItem[];
};

type WithdrawRequestsResponse = {
  items: DriverWithdrawRequestItem[];
  meta: ListMeta;
};

type DriverTripPenaltiesResponse = {
  items: DriverTripPenaltyItem[];
  meta: ListMeta;
};

type LedgerTransactionsResponse = {
  items: LedgerTransactionItem[];
  meta: ListMeta;
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

function toNumber(value: unknown) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
}

function mapDriverWalletItem(raw: any): DriverWalletListItem {
  const latestPhone = Array.isArray(raw?.user?.phones)
    ? raw.user.phones[0]
    : null;

  return {
    id: String(raw?.id || ""),
    userId: raw?.userId ? String(raw.userId) : null,
    displayName:
      typeof raw?.displayName === "string"
        ? raw.displayName
        : typeof raw?.user?.displayName === "string"
          ? raw.user.displayName
          : null,
    fullName:
      typeof raw?.fullName === "string"
        ? raw.fullName
        : typeof raw?.driverProfile?.fullName === "string"
          ? raw.driverProfile.fullName
          : null,
    phone:
      typeof latestPhone?.e164 === "string"
        ? latestPhone.e164
        : typeof raw?.phone === "string"
          ? raw.phone
          : null,
    isPhoneVerified: Boolean(
      latestPhone?.isVerified ?? raw?.isPhoneVerified ?? raw?.user?.isVerified,
    ),
    status: typeof raw?.status === "string" ? raw.status : null,
    licensePlate:
      typeof raw?.licensePlate === "string"
        ? raw.licensePlate
        : typeof raw?.plateNumber === "string"
          ? raw.plateNumber
          : null,
    balance: toNumber(raw?.balance),
    createdAt: typeof raw?.createdAt === "string" ? raw.createdAt : null,
  };
}

function mapDriverWalletTransactionItem(raw: any): DriverWalletTransactionItem {
  return {
    id: String(raw?.id || ""),
    type: typeof raw?.type === "string" ? raw.type : null,
    amount: toNumber(raw?.amount),
    balanceBefore: toNumber(raw?.balanceBefore),
    balanceAfter: toNumber(raw?.balanceAfter),
    note: typeof raw?.note === "string" ? raw.note : null,
    createdAt: typeof raw?.createdAt === "string" ? raw.createdAt : null,
    withdrawRequestId: raw?.withdrawRequestId
      ? String(raw.withdrawRequestId)
      : null,
    tripId: raw?.tripId ? String(raw.tripId) : null,
  };
}

function mapDriverUser(raw: any) {
  const latestPhone = Array.isArray(raw?.phones) ? raw.phones[0] : null;

  return {
    id: String(raw?.id || ""),
    displayName: typeof raw?.displayName === "string" ? raw.displayName : null,
    phone: typeof latestPhone?.e164 === "string" ? latestPhone.e164 : null,
    isPhoneVerified: Boolean(latestPhone?.isVerified),
  };
}

function mapWithdrawRequestItem(raw: any): DriverWithdrawRequestItem {
  return {
    id: String(raw?.id || ""),
    status: typeof raw?.status === "string" ? raw.status : null,
    amount: toNumber(raw?.amount),
    createdAt: typeof raw?.createdAt === "string" ? raw.createdAt : null,
    approvedAt: typeof raw?.approvedAt === "string" ? raw.approvedAt : null,
    paidAt: typeof raw?.paidAt === "string" ? raw.paidAt : null,
    rejectReason:
      typeof raw?.rejectReason === "string" ? raw.rejectReason : null,
    settlementWeek:
      typeof raw?.settlementWeek === "string" ? raw.settlementWeek : null,
    bankAccount: raw?.bankAccount
      ? {
          id: String(raw.bankAccount?.id || ""),
          bankName:
            typeof raw.bankAccount?.bankName === "string"
              ? raw.bankAccount.bankName
              : null,
          accountNumber:
            typeof raw.bankAccount?.accountNumber === "string"
              ? raw.bankAccount.accountNumber
              : null,
          accountHolderName:
            typeof raw.bankAccount?.accountHolderName === "string"
              ? raw.bankAccount.accountHolderName
              : null,
        }
      : null,
    driverProfile: raw?.driverProfile
      ? {
          id: String(raw.driverProfile?.id || ""),
          balance: toNumber(raw.driverProfile?.balance),
          user: raw.driverProfile?.user
            ? mapDriverUser(raw.driverProfile.user)
            : null,
        }
      : null,
  };
}

function mapDriverTripPenaltyItem(raw: any): DriverTripPenaltyItem {
  return {
    id: String(raw?.id || ""),
    status: typeof raw?.status === "string" ? raw.status : null,
    amount: toNumber(raw?.amount),
    reason: typeof raw?.reason === "string" ? raw.reason : null,
    note: typeof raw?.note === "string" ? raw.note : null,
    createdAt: typeof raw?.createdAt === "string" ? raw.createdAt : null,
    approvedAt: typeof raw?.approvedAt === "string" ? raw.approvedAt : null,
    trip: raw?.trip
      ? {
          id: String(raw.trip?.id || ""),
          pickupAddress:
            typeof raw.trip?.pickupAddress === "string"
              ? raw.trip.pickupAddress
              : null,
          dropoffAddress:
            typeof raw.trip?.dropoffAddress === "string"
              ? raw.trip.dropoffAddress
              : null,
        }
      : null,
    driverProfile: raw?.driverProfile
      ? {
          id: String(raw.driverProfile?.id || ""),
          user: raw.driverProfile?.user
            ? mapDriverUser(raw.driverProfile.user)
            : null,
        }
      : null,
  };
}

function mapLedgerTransactionItem(raw: any): LedgerTransactionItem {
  return {
    id: String(raw?.id || ""),
    type: typeof raw?.type === "string" ? raw.type : null,
    amount: toNumber(raw?.amount),
    note: typeof raw?.note === "string" ? raw.note : null,
    createdAt: typeof raw?.createdAt === "string" ? raw.createdAt : null,
    balanceBefore: toNumber(raw?.balanceBefore),
    balanceAfter: toNumber(raw?.balanceAfter),
    driverProfileId: raw?.driverProfileId ? String(raw.driverProfileId) : null,
    withdrawRequestId: raw?.withdrawRequestId
      ? String(raw.withdrawRequestId)
      : null,
    tripId: raw?.tripId ? String(raw.tripId) : null,
    driverProfile: raw?.driverProfile
      ? {
          id: String(raw.driverProfile?.id || ""),
          user: raw.driverProfile?.user
            ? mapDriverUser(raw.driverProfile.user)
            : null,
        }
      : null,
  };
}

export async function fetchDriverWallets(
  params: Record<string, unknown> = {},
): Promise<DriverWalletListResponse> {
  const data = await adminRequest(`/api/admin/drivers${buildQuery(params)}`, {
    method: "GET",
  });

  return {
    items: Array.isArray(data?.items)
      ? data.items.map(mapDriverWalletItem)
      : Array.isArray(data?.drivers)
        ? data.drivers.map(mapDriverWalletItem)
        : [],
    meta: data?.meta || null,
  };
}

export async function fetchDriverWalletTransactions(
  driverId: string,
  params: Record<string, unknown> = {},
): Promise<WalletTransactionsResponse> {
  const data = await adminRequest(
    `/api/admin/drivers/${driverId}/wallet-transactions${buildQuery(params)}`,
    {
      method: "GET",
    },
  );

  return {
    items: Array.isArray(data?.items)
      ? data.items.map(mapDriverWalletTransactionItem)
      : [],
  };
}

export async function topupDriverWallet(
  driverId: string,
  payload: { amount: number | string; note?: string },
) {
  return adminRequest(`/api/admin/drivers/${driverId}/wallet/topup`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function adjustAddDriverWallet(
  driverId: string,
  payload: { amount: number | string; note?: string },
) {
  return adminRequest(`/api/admin/drivers/${driverId}/wallet/adjust-add`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function subtractDriverWallet(
  driverId: string,
  payload: { amount: number | string; note?: string },
) {
  return adminRequest(`/api/admin/drivers/${driverId}/wallet/adjust-subtract`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchWithdrawRequests(
  params: Record<string, unknown> = {},
): Promise<WithdrawRequestsResponse> {
  const data = await adminRequest(
    `/api/admin/withdraw-requests${buildQuery(params)}`,
    {
      method: "GET",
    },
  );

  return {
    items: Array.isArray(data?.items)
      ? data.items.map(mapWithdrawRequestItem)
      : [],
    meta: data?.meta || null,
  };
}

export async function approveWithdrawRequest(id: string) {
  return adminRequest(`/api/admin/withdraw-requests/${id}/approve`, {
    method: "POST",
  });
}

export async function rejectWithdrawRequest(
  id: string,
  payload: { reason: string },
) {
  return adminRequest(`/api/admin/withdraw-requests/${id}/reject`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function markWithdrawRequestPaid(id: string) {
  return adminRequest(`/api/admin/withdraw-requests/${id}/paid`, {
    method: "POST",
  });
}

export async function fetchDriverTripPenalties(
  params: Record<string, unknown> = {},
): Promise<DriverTripPenaltiesResponse> {
  const data = await adminRequest(
    `/api/admin/driver-trip-penalties${buildQuery(params)}`,
    {
      method: "GET",
    },
  );

  return {
    items: Array.isArray(data?.items)
      ? data.items.map(mapDriverTripPenaltyItem)
      : [],
    meta: data?.meta || null,
  };
}

export async function approveDriverTripPenalty(id: string) {
  return adminRequest(`/api/admin/driver-trip-penalties/${id}/approve`, {
    method: "POST",
  });
}

export async function fetchLedgerTransactions(
  params: Record<string, unknown> = {},
): Promise<LedgerTransactionsResponse> {
  const data = await adminRequest(
    `/api/admin/ledger/transactions${buildQuery(params)}`,
    {
      method: "GET",
    },
  );

  return {
    items: Array.isArray(data?.items)
      ? data.items.map(mapLedgerTransactionItem)
      : [],
    meta: data?.meta || null,
  };
}
