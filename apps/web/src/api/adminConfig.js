// Path: goviet247/apps/web/src/api/adminConfig.js
import { getAdminToken } from "../utils/adminAuth";

const PRICING_BASE_URL = "http://localhost:5050/api/admin/pricing-configs";
const TRIP_CONFIG_BASE_URL = "http://localhost:5050/api/admin/trip-config";
const DRIVER_CONFIG_BASE_URL = "http://localhost:5050/api/admin/driver-config";
const ALERT_CONFIG_BASE_URL = "http://localhost:5050/api/admin/alert-config";
const SYSTEM_CONFIG_BASE_URL = "http://localhost:5050/api/admin/system-config";

/**
 * Lấy toàn bộ pricing config cho admin
 */
export async function fetchPricingConfigs() {
  const token = getAdminToken();

  const res = await fetch(PRICING_BASE_URL, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json();

  if (!res.ok || !data?.success) {
    throw new Error(data?.message || "Không thể tải cấu hình giá cước.");
  }

  return data.items || [];
}

/**
 * Partial update pricing config theo carType
 */
export async function patchPricingConfig(carType, payload) {
  const token = getAdminToken();

  const res = await fetch(`${PRICING_BASE_URL}/${carType}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (!res.ok || !data?.success) {
    throw new Error(data?.message || "Cập nhật cấu hình giá cước thất bại.");
  }

  return data.item;
}

/**
 * Lấy cấu hình chuyến đi
 */
export async function fetchTripConfig() {
  const token = getAdminToken();

  const res = await fetch(TRIP_CONFIG_BASE_URL, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json();

  if (!res.ok || !data?.success) {
    throw new Error(data?.message || "Không thể tải cấu hình chuyến đi.");
  }

  return data.item;
}

/**
 * Cập nhật cấu hình chuyến đi
 */
export async function patchTripConfig(payload) {
  const token = getAdminToken();

  const res = await fetch(TRIP_CONFIG_BASE_URL, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (!res.ok || !data?.success) {
    throw new Error(data?.message || "Cập nhật cấu hình chuyến đi thất bại.");
  }

  return data.item;
}

/**
 * Lấy cấu hình tài xế
 */
export async function fetchDriverConfig() {
  const token = getAdminToken();

  const res = await fetch(DRIVER_CONFIG_BASE_URL, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json();

  if (!res.ok || !data?.success) {
    throw new Error(data?.message || "Không thể tải cấu hình tài xế.");
  }

  return data.item;
}

/**
 * Cập nhật cấu hình tài xế
 */
export async function patchDriverConfig(payload) {
  const token = getAdminToken();

  const res = await fetch(DRIVER_CONFIG_BASE_URL, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (!res.ok || !data?.success) {
    throw new Error(data?.message || "Cập nhật cấu hình tài xế thất bại.");
  }

  return data.item;
}

/**
 * Lấy cấu hình cảnh báo
 */
export async function fetchAlertConfig() {
  const token = getAdminToken();

  const res = await fetch(ALERT_CONFIG_BASE_URL, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json();

  if (!res.ok || !data?.success) {
    throw new Error(data?.message || "Không thể tải cấu hình cảnh báo.");
  }

  return data.item;
}

/**
 * Cập nhật cấu hình cảnh báo
 */
export async function patchAlertConfig(payload) {
  const token = getAdminToken();

  const res = await fetch(ALERT_CONFIG_BASE_URL, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (!res.ok || !data?.success) {
    throw new Error(data?.message || "Cập nhật cấu hình cảnh báo thất bại.");
  }

  return data.item;
}

/**
 * Lấy cấu hình hệ thống
 */
export async function fetchSystemConfig() {
  const token = getAdminToken();

  const res = await fetch(SYSTEM_CONFIG_BASE_URL, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json();

  if (!res.ok || !data?.success) {
    throw new Error(data?.message || "Không thể tải cấu hình hệ thống.");
  }

  return data.item;
}

/**
 * Cập nhật cấu hình hệ thống
 */
export async function patchSystemConfig(payload) {
  const token = getAdminToken();

  const res = await fetch(SYSTEM_CONFIG_BASE_URL, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (!res.ok || !data?.success) {
    throw new Error(data?.message || "Cập nhật cấu hình hệ thống thất bại.");
  }

  return data.item;
}