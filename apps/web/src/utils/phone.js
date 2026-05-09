// Path: goviet247/apps/web/src/utils/phone.js
export function formatVietnamesePhone(phone) {
  const value = String(phone || "").trim();

  if (!value) return "";

  if (value.startsWith("+84")) {
    return `0${value.slice(3)}`;
  }

  return value;
}