// Path: goviet247/apps/web/src/api/auth.js
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5050";
const API = `${API_BASE}/api/auth`;

// Gửi OTP
export async function requestOtp(phone) {
  const res = await fetch(`${API}/request-otp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      phone,
      appRole: "RIDER",
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error?.message || data?.message || "Không gửi được OTP");
  }

  return data;
}

// Xác minh OTP
export async function verifyOtp(sessionId, code) {
  const res = await fetch(`${API}/verify-otp`, {
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

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error?.message || data?.message || "OTP không hợp lệ");
  }

  return data;
}

// Lấy thông tin user
export async function getMe(token) {
  const res = await fetch(`${API}/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.message || "Không lấy được user");
  }

  return data.user;
}

// Cập nhật hồ sơ khách hàng
export async function updateMe(token, payload) {
  const res = await fetch(`${API}/me`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.message || "Không cập nhật được hồ sơ");
  }

  return data.user;
}