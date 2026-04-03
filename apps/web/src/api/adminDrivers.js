// Path: goviet247/apps/web/src/api/adminDrivers.js
import { getAdminToken } from "../utils/adminAuth";

const BASE_URL = "/api/admin";

function getHeaders() {
  const token = getAdminToken();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

function buildQuery(params) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (
      v === undefined ||
      v === null ||
      v === "" ||
      v === "ALL" ||
      v === "all"
    )
      return;
    qs.set(k, String(v));
  });
  const s = qs.toString();
  return s ? `?${s}` : "";
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

export async function fetchDrivers(params = {}) {
  const res = await fetch(`${BASE_URL}/drivers` + buildQuery(params), {
    headers: getHeaders(),
  });

  const data = await safeJson(res);

  if (!res.ok || data?.success === false) {
    throw new Error(data?.message || "Không tải được danh sách tài xế.");
  }

  return {
    items: data.items || data.drivers || [],
    meta: data.meta || null,
  };
}

export async function fetchDriverDetail(id) {
  const res = await fetch(`${BASE_URL}/drivers/${id}`, {
    headers: getHeaders(),
  });

  const data = await safeJson(res);

  if (!res.ok || data?.success === false) {
    throw new Error(data?.message || "Không tải được chi tiết tài xế.");
  }

  return data.driver || data.data || data;
}

export async function fetchDriverLogs(id) {
  const res = await fetch(`${BASE_URL}/drivers/${id}/logs`, {
    headers: getHeaders(),
  });

  const data = await safeJson(res);

  if (!res.ok || data?.success === false) {
    throw new Error(data?.message || "Không tải được lịch sử tài xế.");
  }

  return data;
}

export async function fetchDriverWalletTransactions(id, params = {}) {
  const res = await fetch(
    `${BASE_URL}/drivers/${id}/wallet-transactions` + buildQuery(params),
    {
      headers: getHeaders(),
    },
  );

  const data = await safeJson(res);

  if (!res.ok || data?.success === false) {
    throw new Error(data?.message || "Không tải được lịch sử ví tài xế.");
  }

  return {
    items: data.items || [],
  };
}

export async function topupDriverWallet(id, payload) {
  const res = await fetch(`${BASE_URL}/drivers/${id}/wallet/topup`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await safeJson(res);

  if (!res.ok || data?.success === false) {
    throw new Error(data?.message || "Không nạp được tiền vào ví tài xế.");
  }

  return data;
}

export async function adjustAddDriverWallet(id, payload) {
  const res = await fetch(`${BASE_URL}/drivers/${id}/wallet/adjust-add`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await safeJson(res);

  if (!res.ok || data?.success === false) {
    throw new Error(data?.message || "Không điều chỉnh cộng được ví tài xế.");
  }

  return data;
}

export async function subtractDriverWallet(id, payload) {
  const res = await fetch(`${BASE_URL}/drivers/${id}/wallet/adjust-subtract`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await safeJson(res);

  if (!res.ok || data?.success === false) {
    throw new Error(data?.message || "Không điều chỉnh trừ được ví tài xế.");
  }

  return data;
}

export async function patchDriverKyc(id, payload) {
  const res = await fetch(`${BASE_URL}/drivers/${id}/kyc`, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await safeJson(res);

  if (!res.ok || data?.success === false) {
    throw new Error(data?.message || "Không cập nhật được KYC tài xế");
  }

  return data;
}

export async function patchDriverAccount(id, payload) {
  const res = await fetch(`${BASE_URL}/drivers/${id}/account`, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await safeJson(res);

  if (!res.ok || data?.success === false) {
    throw new Error(data?.message || "Không cập nhật được trạng thái tài xế");
  }

  return data;
}
