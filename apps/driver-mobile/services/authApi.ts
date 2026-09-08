// Path: goviet247/apps/driver-mobile/services/authApi.ts
import { getDriverToken, setDriverToken, removeDriverToken } from "./storage";
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
    driverName?: string | null;
    riderName?: string | null;
    primaryRole: string | null;
    role: string;
    phone: string | null;
    hasDriverProfile: boolean;
    hasRiderProfile: boolean;
  } | null;
};

type MeResponse = {
  access_token?: string;
  success: boolean;
  user: {
    id: string;
    displayName: string | null;
    driverName?: string | null;
    riderName?: string | null;
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
      appRole: "DRIVER",
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
      "X-Session-Mode": "persistent-v1",
    },
    body: JSON.stringify({
      session_id: sessionId,
      otp: code,
      appRole: "DRIVER",
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
      "X-Session-Mode": "persistent-v1",
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

  if ("access_token" in data && data.access_token) {
    const replacement = data.access_token;
    await mutateSession(async () => {
      if (await getDriverToken() === token) await setDriverToken(replacement);
    });
  }
  return data;
}
// Serialize token replacement and logout so a late response cannot restore a logged-out session.
let sessionMutation: Promise<unknown> = Promise.resolve();
function mutateSession<T>(action: () => Promise<T>): Promise<T> {
  const result = sessionMutation.then(action, action);
  sessionMutation = result.catch(() => undefined);
  return result;
}
export async function logoutSession() {
  return mutateSession(async () => {
    const token = await getDriverToken();
    if (!token) return;
    const res = await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: "POST", headers: { Authorization: `Bearer ${token}` },
    });
    const data = await parseJson(res);
    if (res.status !== 401 && (!res.ok || !data?.success)) {
      throw new Error("Chưa thể đăng xuất. Vui lòng kiểm tra kết nối và thử lại.");
    }
    if (await getDriverToken() === token) await removeDriverToken();
  });
}
