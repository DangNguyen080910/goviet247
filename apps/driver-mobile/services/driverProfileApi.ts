// Path: goviet247/apps/driver-mobile/services/driverProfileApi.ts
import { Platform } from "react-native";
import type { ImagePickerAsset } from "expo-image-picker";
import { API_BASE_URL } from "../constants/api";

export type DriverDocumentType =
  | "CCCD_FRONT"
  | "CCCD_BACK"
  | "PORTRAIT"
  | "DRIVER_LICENSE"
  | "VEHICLE_REGISTRATION";

export type DriverDocumentStatus = "UPLOADED" | "APPROVED" | "REJECTED";

export type DriverKycStatus =
  | "PENDING"
  | "VERIFIED"
  | "REJECTED"
  | "SUSPENDED";

export type DriverWithdrawStatus =
  | "PENDING"
  | "APPROVED"
  | "PAID"
  | "REJECTED";

export type DriverWalletTxnType =
  | "TOPUP"
  | "COMMISSION_HOLD"
  | "COMMISSION_REFUND"
  | "WITHDRAW_REQUEST"
  | "WITHDRAW_REJECT_REFUND"
  | "WITHDRAW_PAID"
  | "ADJUST_ADD"
  | "ADJUST_SUBTRACT";

export type DriverProfileDocumentItem = {
  id?: string;
  type: DriverDocumentType;
  status?: DriverDocumentStatus;
  fileUrl: string;
  fileKey?: string | null;
  viewUrl?: string | null;
  note?: string | null;
  reviewedAt?: string | null;
  reviewedById?: number | null;
  createdAt?: string;
};

export type DriverProfileData = {
  id: string;
  userId: string;
  fullName?: string | null;
  displayName?: string | null;
  phone?: string | null;
  status: DriverKycStatus;
  balance: number;
  vehicleType?: string | null;
  vehicleBrand?: string | null;
  vehicleModel?: string | null;
  vehicleYear?: number | null;
  plateNumber?: string | null;
  verifiedAt?: string | null;
  rejectReason?: string | null;
  suspendReason?: string | null;
  createdAt: string;
  updatedAt: string;
  documents: DriverProfileDocumentItem[];
};

export type DriverBankAccountSummary = {
  id: string;
  bankName: string;
  accountNumber: string;
  accountNumberMasked: string;
  accountHolderName: string;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type DriverWalletTransactionItem = {
  id: string;
  type: DriverWalletTxnType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  note?: string | null;
  tripId?: string | null;
  withdrawRequestId?: string | null;
  createdAt: string;
};

export type DriverWithdrawRequestItem = {
  id: string;
  amount: number;
  status: DriverWithdrawStatus;
  note?: string | null;
  rejectReason?: string | null;
  settlementWeek?: string | null;
  createdAt: string;
  approvedAt?: string | null;
  paidAt?: string | null;
  bankAccount?: DriverBankAccountSummary | null;
};

export type DriverWalletSummaryData = {
  balance: number;
  defaultBankAccount?: DriverBankAccountSummary | null;
  bankAccounts: DriverBankAccountSummary[];
  recentTransactions: DriverWalletTransactionItem[];
  recentWithdrawRequests: DriverWithdrawRequestItem[];
};

export type DriverContractSubmitPayload = {
  contractAccepted: true;
  contractCode: string;
  contractTitle: string;
  contractVersion: string;
  contractFileUrl?: string;
  contractFileHash?: string;
  contractAppVersion?: string;
};

export type CreateDriverProfilePayload = {
  fullName: string;
  vehicleType: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleYear: number;
  plateNumber: string;
  documents: Record<DriverDocumentType, string>;
} & DriverContractSubmitPayload;

type ApiError = {
  success?: false;
  message?: string;
};

type GetMyDriverProfileResponse = {
  success: true;
  hasDriverProfile: boolean;
  profile: DriverProfileData | null;
};

type WalletSummaryResponse = {
  success: true;
  data: DriverWalletSummaryData | null;
};

type CreateDriverBankAccountPayload = {
  bankName: string;
  accountNumber: string;
  accountHolderName: string;
  isDefault?: boolean;
};

type BankAccountMutationResponse = {
  success: true;
  message?: string;
  item?: DriverBankAccountSummary | null;
  items: DriverBankAccountSummary[];
  defaultBankAccount?: DriverBankAccountSummary | null;
};

type CreateWithdrawRequestPayload = {
  amount: number;
};

type WithdrawMutationResponse = {
  success: true;
  message?: string;
  item?: DriverWithdrawRequestItem | null;
  data?: DriverWalletSummaryData | null;
};

type UploadDriverDocumentResponse = {
  success: true;
  message?: string;
  document: DriverProfileDocumentItem & {
    originalName?: string;
    mimeType?: string;
    size?: number;
    fileName?: string;
  };
};

type CreateDriverProfileResponse = {
  success: true;
  message?: string;
  profile?: DriverProfileData | null;
};

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

function buildAuthHeaders(token: string, appVersion?: string) {
  if (!token) {
    throw new Error("Không tìm thấy token đăng nhập của tài xế.");
  }

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    ...(appVersion ? { "x-app-version": appVersion } : {}),
  };
}

function buildAuthOnlyHeaders(token: string) {
  if (!token) {
    throw new Error("Không tìm thấy token đăng nhập của tài xế.");
  }

  return {
    Authorization: `Bearer ${token}`,
  };
}

function getAssetMimeType(asset: ImagePickerAsset) {
  if (asset.mimeType && String(asset.mimeType).trim()) {
    return asset.mimeType;
  }

  const uri = String(asset.uri || "").toLowerCase();

  if (uri.endsWith(".png")) return "image/png";
  if (uri.endsWith(".heic")) return "image/heic";
  if (uri.endsWith(".heif")) return "image/heif";
  if (uri.endsWith(".webp")) return "image/webp";

  return "image/jpeg";
}

function getAssetFileName(asset: ImagePickerAsset, docType: DriverDocumentType) {
  if (asset.fileName && String(asset.fileName).trim()) {
    return asset.fileName;
  }

  const mimeType = getAssetMimeType(asset);
  const ext =
    mimeType === "image/png"
      ? "png"
      : mimeType === "image/webp"
      ? "webp"
      : mimeType === "image/heic"
      ? "heic"
      : mimeType === "image/heif"
      ? "heif"
      : "jpg";

  return `${docType.toLowerCase()}.${ext}`;
}

const MAX_DRIVER_DOCUMENT_SIZE_BYTES = 5 * 1024 * 1024;

function isAllowedDriverDocumentMimeType(mimeType: string) {
  const normalized = String(mimeType || "").trim().toLowerCase();

  return [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
  ].includes(normalized);
}

function getAssetSize(asset: ImagePickerAsset) {
  const rawSize = (asset as any)?.fileSize ?? (asset as any)?.size;

  if (typeof rawSize === "number" && Number.isFinite(rawSize)) {
    return rawSize;
  }

  const webFile = (asset as any)?.file;
  if (webFile && typeof webFile.size === "number") {
    return webFile.size;
  }

  return null;
}

function validateDriverDocumentAsset(asset: ImagePickerAsset) {
  const mimeType = getAssetMimeType(asset);
  const fileSize = getAssetSize(asset);

  if (!isAllowedDriverDocumentMimeType(mimeType)) {
    throw new Error("Chỉ hỗ trợ file ảnh JPG, JPEG, PNG hoặc WEBP.");
  }

  if (fileSize && fileSize > MAX_DRIVER_DOCUMENT_SIZE_BYTES) {
    throw new Error(
      "Ảnh vượt quá dung lượng tối đa 5MB. Vui lòng chọn ảnh nhỏ hơn hoặc chụp lại rõ hơn."
    );
  }
}

async function appendDriverDocumentFile(
  formData: FormData,
  asset: ImagePickerAsset,
  docType: DriverDocumentType
) {
  const fileName = getAssetFileName(asset, docType);
  const mimeType = getAssetMimeType(asset);

  // Việt: Web ưu tiên File thật nếu expo-image-picker trả về
  if (Platform.OS === "web") {
    const webFile = (asset as any)?.file;

    if (webFile) {
      formData.append("file", webFile);
      return;
    }

    // Việt: Fallback cho web
    if (asset.uri) {
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      formData.append("file", blob, fileName);
      return;
    }
  }

  // Việt: Native mobile
  formData.append(
    "file",
    {
      uri: asset.uri,
      name: fileName,
      type: mimeType,
    } as any
  );
}

export async function uploadDriverDocument(
  token: string,
  docType: DriverDocumentType,
  asset: ImagePickerAsset
): Promise<UploadDriverDocumentResponse> {
  if (!asset?.uri) {
    throw new Error("Không tìm thấy ảnh để tải lên.");
  }

  validateDriverDocumentAsset(asset);

  const formData = new FormData();
  formData.append("type", docType);

  await appendDriverDocumentFile(formData, asset, docType);

  const response = await fetch(`${API_BASE_URL}/api/driver/documents/upload`, {
    method: "POST",
    headers: buildAuthOnlyHeaders(token),
    body: formData,
  });

  const payload = (await parseJsonSafe(response)) as
    | UploadDriverDocumentResponse
    | ApiError
    | null;

  if (!response.ok) {
    throw new Error(
      getErrorMessage(payload as ApiError, "Không thể tải ảnh giấy tờ lên.")
    );
  }

  return payload as UploadDriverDocumentResponse;
}

export async function createDriverProfile(
  token: string,
  body: CreateDriverProfilePayload
): Promise<CreateDriverProfileResponse> {
  const response = await fetch(`${API_BASE_URL}/api/driver/profile`, {
    method: "POST",
    headers: buildAuthHeaders(token, body.contractAppVersion),
    body: JSON.stringify(body),
  });

  const payload = (await parseJsonSafe(response)) as
    | CreateDriverProfileResponse
    | ApiError
    | null;

  if (!response.ok) {
    throw new Error(
      getErrorMessage(payload as ApiError, "Không thể tạo hồ sơ tài xế.")
    );
  }

  return payload as CreateDriverProfileResponse;
}

export async function getMyDriverProfile(token: string) {
  const response = await fetch(`${API_BASE_URL}/api/driver/profile/me`, {
    method: "GET",
    headers: buildAuthHeaders(token),
  });

  const payload = (await parseJsonSafe(response)) as
    | GetMyDriverProfileResponse
    | ApiError
    | null;

  if (!response.ok) {
    throw new Error(
      getErrorMessage(payload as ApiError, "Không thể tải hồ sơ tài xế.")
    );
  }

  return payload as GetMyDriverProfileResponse;
}

export async function getMyDriverWalletSummary(
  token: string
): Promise<WalletSummaryResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/driver/profile/wallet-summary`,
    {
      method: "GET",
      headers: buildAuthHeaders(token),
    }
  );

  const payload = (await parseJsonSafe(response)) as
    | WalletSummaryResponse
    | ApiError
    | null;

  if (!response.ok) {
    throw new Error(
      getErrorMessage(payload as ApiError, "Không thể tải ví tài xế.")
    );
  }

  return payload as WalletSummaryResponse;
}

export async function createMyDriverBankAccount(
  token: string,
  body: CreateDriverBankAccountPayload
): Promise<BankAccountMutationResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/driver/profile/bank-accounts`,
    {
      method: "POST",
      headers: buildAuthHeaders(token),
      body: JSON.stringify(body),
    }
  );

  const payload = (await parseJsonSafe(response)) as
    | BankAccountMutationResponse
    | ApiError
    | null;

  if (!response.ok) {
    throw new Error(
      getErrorMessage(
        payload as ApiError,
        "Không thể thêm tài khoản ngân hàng."
      )
    );
  }

  return payload as BankAccountMutationResponse;
}

export async function setMyDriverDefaultBankAccount(
  token: string,
  bankAccountId: string
): Promise<BankAccountMutationResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/driver/profile/bank-accounts/${bankAccountId}/default`,
    {
      method: "PATCH",
      headers: buildAuthHeaders(token),
    }
  );

  const payload = (await parseJsonSafe(response)) as
    | BankAccountMutationResponse
    | ApiError
    | null;

  if (!response.ok) {
    throw new Error(
      getErrorMessage(
        payload as ApiError,
        "Không thể cập nhật tài khoản mặc định."
      )
    );
  }

  return payload as BankAccountMutationResponse;
}

export async function deleteMyDriverBankAccount(
  token: string,
  bankAccountId: string
): Promise<BankAccountMutationResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/driver/profile/bank-accounts/${bankAccountId}`,
    {
      method: "DELETE",
      headers: buildAuthHeaders(token),
    }
  );

  const payload = (await parseJsonSafe(response)) as
    | BankAccountMutationResponse
    | ApiError
    | null;

  if (!response.ok) {
    throw new Error(
      getErrorMessage(payload as ApiError, "Không thể xoá tài khoản ngân hàng.")
    );
  }

  return payload as BankAccountMutationResponse;
}

export async function createMyDriverWithdrawRequest(
  token: string,
  body: CreateWithdrawRequestPayload
): Promise<WithdrawMutationResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/driver/profile/withdraw-requests`,
    {
      method: "POST",
      headers: buildAuthHeaders(token),
      body: JSON.stringify(body),
    }
  );

  const payload = (await parseJsonSafe(response)) as
    | WithdrawMutationResponse
    | ApiError
    | null;

  if (!response.ok) {
    throw new Error(
      getErrorMessage(payload as ApiError, "Không thể gửi yêu cầu rút tiền.")
    );
  }

  return payload as WithdrawMutationResponse;
}