// Fail closed for old unbound devices: drivers re-register on their next app launch.
export async function activeDriverDevices(db, devices, { requireVerified = false } = {}) {
  const now = new Date();
  // A persistent upgrade keeps the same session key. The device may still carry
  // the old JWT expiry, so a tracked session is the authority for expiry/revocation.
  const candidates = devices.filter(d => d.pushSessionId);
  if (!candidates.length) return [];
  const sessions = await db.session.findMany({ where: { id: { in: [...new Set(candidates.map(d => d.pushSessionId))] } }, select: { id: true, userId: true, expiresAt: true } });
  const byId = new Map(sessions.map(s => [s.id, s]));
  const verified = requireVerified ? new Set((await db.driverProfile.findMany({ where: { userId: { in: [...new Set(candidates.map(d => d.userId))] }, status: "VERIFIED" }, select: { userId: true } })).map(p => p.userId)) : null;
  return candidates.filter(d => {
    const session = byId.get(d.pushSessionId);
    // Legacy JWTs may have no session row until logout; they still have a hard token expiry.
    const valid = session ? session.userId === d.userId && (!session.expiresAt || session.expiresAt > now) : d.pushSessionId.startsWith("legacy_") && d.pushExpiresAt && d.pushExpiresAt > now;
    return valid && (!verified || verified.has(d.userId));
  });
}
