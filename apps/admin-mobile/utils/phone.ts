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

export function normalizeSmartSearch(value?: string | null) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9+]+/g, " ")
    .trim();
}
