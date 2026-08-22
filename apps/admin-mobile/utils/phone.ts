// Path: goviet247/apps/admin-mobile/utils/phone.ts
export function formatVietnamesePhone(phone?: string | null) {
  const raw = String(phone || "").trim();

  if (!raw) return "--";

  if (raw.startsWith("+84")) {
    return `0${raw.slice(3)}`;
  }

  return raw;
}

export function normalizeVietnamesePhoneSearch(keyword?: string | null) {
  const raw = String(keyword || "").trim();

  if (!raw) return "";

  if (raw.startsWith("0")) {
    return `+84${raw.slice(1)}`;
  }

  return raw;
}