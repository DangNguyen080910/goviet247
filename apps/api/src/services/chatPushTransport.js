// Tokens are opaque: devices belonging to different Expo projects can share a user.
// Expo rejects a mixed-project batch before sending any notifications. Split only
// that rejected batch, preserving normal batching and avoiding a new app build.
const safeCode = value => /^[A-Za-z0-9_]+$/.test(String(value || '')) ? String(value) : 'UNKNOWN';
export async function sendChatPushBatch(batch, { fetchImpl = fetch, removeDevice, onAccepted = async () => {} }) {
  if (!batch.length) return;
  const response = await fetchImpl('https://exp.host/--/api/v2/push/send', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify(batch), signal: AbortSignal.timeout(15000),
  });
  const result = await response.json();
  const errors = Array.isArray(result.errors) ? result.errors : [];
  if (batch.length > 1 && errors.some(e => e.code === 'PUSH_TOO_MANY_EXPERIENCE_IDS')) {
    const failures = [];
    // Continue to the other devices even when one project's credentials fail.
    for (const item of batch) {
      try { await sendChatPushBatch([item], {fetchImpl, removeDevice, onAccepted}); }
      catch (error) { failures.push(error.message); }
    }
    if (failures.length) throw new Error(`Expo split: ${[...new Set(failures)].join(', ')}`);
    return;
  }
  if (!response.ok || errors.length) {
    throw new Error(`Expo HTTP ${response.status}: ${errors.map(e => safeCode(e.code)).join(',') || 'REQUEST_REJECTED'}`);
  }
  const tickets = Array.isArray(result.data) ? result.data : [result.data];
  if (tickets.length !== batch.length || tickets.some(t => !t || !['ok','error'].includes(t.status))) {
    throw new Error('Expo INVALID_TICKETS');
  }
  const failures = [];
  for (let i=0; i<tickets.length; i++) {
    const ticket=tickets[i];
    if (ticket.status === 'ok') {
      try { await onAccepted(batch[i].to); } catch { failures.push('RECEIPT_NOT_SAVED'); }
      continue;
    }
    const code=safeCode(ticket.details?.error);
    if (code === 'DeviceNotRegistered') await removeDevice(batch[i].to);
    else failures.push(code);
  }
  if (failures.length) throw new Error(`Expo tickets: ${[...new Set(failures)].join(',')}`);
}
