// Use the authenticated app role, never the user's primary role or client input.
export function accountExitRole(claims) {
  const role = String(claims?.appRole || claims?.role || '').toUpperCase();
  return ['DRIVER', 'RIDER'].includes(role) ? role : null;
}
export async function recordAccountExit(db, userId, appRole, now = new Date()) {
  if (!userId || !accountExitRole({ appRole })) throw new Error('INVALID_ACCOUNT_EXIT_ROLE');
  return db.accountExitRequest.upsert({
    where: { userId_appRole: { userId, appRole } },
    create: { userId, appRole, requestedAt: now },
    update: { requestedAt: now, returnedAt: null, requestCount: { increment: 1 } },
  });
}
export async function recordAccountReturn(db, userId, appRole, now = new Date()) {
  if (!userId || !accountExitRole({ appRole })) return;
  // Only the first successful login after the latest request; other app roles do not clear it.
  return db.accountExitRequest.updateMany({
    where: { userId, appRole, returnedAt: null, requestedAt: { lte: now } },
    data: { returnedAt: now },
  });
}
