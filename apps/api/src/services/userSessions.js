import { createHash, randomUUID } from "node:crypto";
import { prisma } from "../utils/db.js";
import { signPersistentToken, signToken, verifyJwtToken } from "../utils/jwt.js";

const hash = value => createHash("sha256").update(value).digest("hex");
const legacyId = token => `legacy_${hash(token)}`;
const denied = () => Object.assign(new Error("SESSION_INVALID"), { status: 401 });
const expired = session => session.expiresAt && session.expiresAt.getTime() <= Date.now();
export const persistentEnabled = () => process.env.JWT_EXPIRES === "never";
export const supportsPersistent = req => req.headers["x-session-mode"] === "persistent-v1";

// Database injection also lets tests exercise revocation and concurrent upgrades.
export function createSessionService(db) {
  async function verify(token) {
    let claims;
    try { claims = verifyJwtToken(token); } catch { throw denied(); }
    if (!(claims.uid || claims.id) || (!claims.sid && !Number.isFinite(claims.exp))) throw denied();
    const session = await db.session.findUnique({ where: { id: claims.sid || legacyId(token) } });
    if (claims.sid && (!session || session.refreshTokenHash !== hash(token) || session.userId !== (claims.uid || claims.id))) throw denied();
    if (session && expired(session)) throw denied();
    return claims;
  }

  async function issue(claims, oldToken) {
    // Stable legacy id + iat makes upgrades idempotent, including concurrent app requests.
    const id = oldToken ? legacyId(oldToken) : randomUUID();
    const token = signPersistentToken({
      uid: claims.uid || claims.id, id: claims.uid || claims.id,
      role: claims.role, appRole: claims.appRole, phone: claims.phone,
      sid: id, iat: oldToken ? claims.iat : Math.floor(Date.now() / 1000),
    });
    const data = { id, userId: claims.uid || claims.id, refreshTokenHash: hash(token), expiresAt: null };
    try { await db.session.create({ data }); }
    catch (error) {
      if (error.code !== "P2002" || !oldToken) throw error;
      const existing = await db.session.findUnique({ where: { id } });
      if (!existing || expired(existing) || existing.refreshTokenHash !== data.refreshTokenHash) throw denied();
    }
    return token;
  }

  async function revoke(token, claims) {
    const id = claims.sid || legacyId(token);
    // Upsert never resurrects a revoked session; racing upgrades see the expired record.
    await db.session.upsert({ where: { id },
      create: { id, userId: claims.uid || claims.id, refreshTokenHash: hash(token), expiresAt: new Date(0) },
      update: { expiresAt: new Date(0) },
    });
  }
  return { verify, issue, revoke };
}
export const userSessions = createSessionService(prisma);
export async function issueUserToken(claims, req) {
  return persistentEnabled() && supportsPersistent(req) ? userSessions.issue(claims) : signToken(claims);
}
