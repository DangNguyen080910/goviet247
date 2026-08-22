// Path: goviet247/apps/driver-mobile/services/systemConfigApi.ts
import { API_BASE_URL } from "../constants/api";

function buildPublicSystemConfigUrl() {
  const base = String(API_BASE_URL || "").replace(/\/+$/, "");

  return base.endsWith("/api")
    ? `${base}/public/system-config`
    : `${base}/api/public/system-config`;
}

export async function getPublicSystemConfig() {
  try {
    const url = buildPublicSystemConfigUrl();

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const json = await res.json().catch(() => ({}));

    return json?.data || json || {};
  } catch (err) {
    console.warn("getPublicSystemConfig error:", err);
    return {};
  }
}

export async function getDriverSupportPhone() {
  try {
    const data = await getPublicSystemConfig();

    return data?.supportPhoneDriver || "";
  } catch (err) {
    console.warn("getDriverSupportPhone error:", err);
    return "";
  }
}