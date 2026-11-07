export function newUnreadConversations(previous, items, actorId) {
  return items.filter(c => c.unread > 0 && c.last && !c.last.deletedAt && c.last.senderId !== actorId && previous.get(c.tripId) !== c.last.id);
}
export function createChatAlertGate(now = Date.now) {
  const seen = new Set(); let last = -Infinity;
  return id => {
    if (id && seen.has(id)) return false;
    if (id) { seen.add(id); if (seen.size > 500) seen.delete(seen.values().next().value); }
    const time = now(); if (time - last < 1500) return false;
    last = time; return true;
  };
}

// Instructional system chat remains readable, but is not an Admin alert.
// Call summaries/recordings keep their operational notifications.
export function chatMessageAlertsAdmin(message) {
  return message?.senderRole !== 'SYSTEM' || message?.senderId === 'system-call' || Boolean(message?.recordingCallId);
}
export function chatAlertMessageWhere(where, actor) {
  if (!['ADMIN', 'STAFF'].includes(String(actor?.role || '').toUpperCase())) return where;
  return {AND: [where, {OR: [
    {senderRole: {not: 'SYSTEM'}}, {senderId: 'system-call'}, {recordingCallId: {not: null}},
  ]}]};
}
