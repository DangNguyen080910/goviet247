// Notification data contains identifiers only; the API rechecks chat access.
export function chatNotificationRoute(data) {
  if (!['TRIP_CHAT', 'TRIP_CALL_MISSED'].includes(String(data?.type || '').toUpperCase()) || !data?.tripId) return null;
  const query = [`tripId=${encodeURIComponent(String(data.tripId))}`];
  if (data.messageId) query.push(`messageId=${encodeURIComponent(String(data.messageId))}`);
  if (data.callId) query.push(`callId=${encodeURIComponent(String(data.callId))}`);
  return `/trip-chat?${query.join('&')}`;
}
const handled = new Map();
export function claimNotificationResponse(response, now = Date.now()) {
  const id = response?.notification?.request?.identifier;
  if (!id) return false;
  const key = `${id}:${response.actionIdentifier}`;
  const previous = handled.get(key);
  if (previous !== undefined && now - previous < 3000) return false;
  handled.set(key, now);
  if (handled.size > 100) handled.delete(handled.keys().next().value);
  return true;
}
