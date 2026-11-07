// A new assignment starts a new customer/partner conversation; Admin retains the archive.
export function chatVisibleFrom(trip, actor) {
  if (actor.role === 'ADMIN') return null;
  const dates = [trip.chatVisibleFrom, ...(actor.role === 'DRIVER' ? [trip.acceptedAt] : [])].filter(Boolean);
  return dates.length ? new Date(Math.max(...dates.map(value => new Date(value).getTime()))) : null;
}
export function chatMessageInCurrentHistory(trip, actor, message) {
  const since = chatVisibleFrom(trip, actor);
  return !since || new Date(message.historyAt ?? message.createdAt) >= since;
}
