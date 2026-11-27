export const QUOTE_HISTORY_SOURCES = {
  WEB: "Web",
  ANDROID: "Android",
  IOS: "iOS",
  PARTNER: "Đối tác",
  UNKNOWN: "Chưa xác định",
};

function addresses(values) {
  return Array.isArray(values) ? values.filter(value => typeof value === "string" && value.trim()) : [];
}

// Existing quotes stored only the destination array. The API still returns that array to old apps.
export function encodeQuoteHistoryRoute(stops, additionalPickups) {
  return additionalPickups.length ? { additionalPickups, stops } : stops;
}

export function decodeQuoteHistoryRoute(value) {
  return Array.isArray(value) ? { stops: addresses(value), additionalPickups: [] }
    : { stops: addresses(value?.stops), additionalPickups: addresses(value?.additionalPickups) };
}

export function quoteHistoryPickupAddresses(row) {
  return addresses([row?.pickupAddress, ...addresses(row?.additionalPickups)]);
}
