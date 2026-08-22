// Path: goviet247/apps/rider-mobile/services/authApi.ts
import { API_BASE_URL } from "../constants/api";

type RequestOtpResponse = {
  success: boolean;
  session_id: string;
  resend_after: string;
};

type VerifyOtpResponse = {
  success: boolean;
  access_token: string;
  user?: {
    id: string;
    displayName: string | null;
    riderName?: string | null;
    driverName?: string | null;
    primaryRole: string | null;
    role: string;
    phone: string | null;
    hasDriverProfile: boolean;
    hasRiderProfile: boolean;
  } | null;
};

type MeResponse = {
  success: boolean;
  user: {
    id: string;
    displayName: string | null;
    riderName?: string | null;
    driverName?: string | null;
    phone: string | null;
    role: string;
    primaryRole?: string | null;
    hasDriverProfile?: boolean;
    hasRiderProfile?: boolean;
    createdAt?: string;
  };
};

type ErrorResponse = {
  success?: false;
  code?: string;
  message?: string;
  error?: {
    code?: string;
    message?: string;
  };
};

export class ApiError extends Error {
  code?: string;
  status?: number;

  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

async function parseJson(res: Response) {
  return res.json().catch(() => ({}));
}

function buildApiError(
  res: Response,
  data: ErrorResponse,
  fallbackMessage: string
) {
  const code = data?.error?.code || data?.code || "API_ERROR";
  const rawMessage =
    data?.error?.message || data?.message || fallbackMessage;

  return new ApiError(rawMessage, code, res.status);
}

export async function requestOtp(phone: string) {
  const res = await fetch(`${API_BASE_URL}/api/auth/request-otp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      phone,
      appRole: "RIDER",
    }),
  });

  const data = (await parseJson(res)) as RequestOtpResponse | ErrorResponse;

  if (!res.ok || !data?.success) {
    throw buildApiError(res, data as ErrorResponse, "Không gửi được OTP.");
  }

  return data;
}

export async function verifyOtp(sessionId: string, code: string) {
  const res = await fetch(`${API_BASE_URL}/api/auth/verify-otp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      session_id: sessionId,
      otp: code,
      appRole: "RIDER",
    }),
  });

  const data = (await parseJson(res)) as VerifyOtpResponse | ErrorResponse;

  if (!res.ok || !data?.success) {
    throw buildApiError(
      res,
      data as ErrorResponse,
      "Xác minh OTP thất bại."
    );
  }

  return data;
}

export async function getMe(token: string) {
  const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = (await parseJson(res)) as MeResponse | ErrorResponse;

  if (!res.ok || !data?.success) {
    throw buildApiError(
      res,
      data as ErrorResponse,
      "Không lấy được thông tin tài khoản."
    );
  }

  return data;
}

export async function updateMe(token: string, payload: { displayName: string }) {
  const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = (await parseJson(res)) as MeResponse | ErrorResponse;

  if (!res.ok || !data?.success) {
    throw buildApiError(
      res,
      data as ErrorResponse,
      "Không cập nhật được tài khoản."
    );
  }

  return data;
}

export async function deleteMe(token: string) {
  const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = (await parseJson(res)) as
    | { success: boolean; message?: string }
    | ErrorResponse;

  if (!res.ok || !data?.success) {
    throw buildApiError(
      res,
      data as ErrorResponse,
      "Không xóa được tài khoản.",
    );
  }

  return data;
}