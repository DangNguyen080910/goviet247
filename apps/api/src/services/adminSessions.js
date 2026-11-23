import { createHash } from 'node:crypto';
import { prisma } from '../utils/db.js';
import { verifyAdminJwtToken } from '../utils/jwt.js';

export const adminTokenVersion = row => createHash('sha256')
  .update(JSON.stringify([row.id, row.password_hash, row.role, row.is_active, row.authVersion || 0])).digest('hex');
const denied = () => Object.assign(new Error('Phiên Admin đã thay đổi. Vui lòng đăng nhập lại.'), {status:401});
export function createAdminSessionVerifier(db, verify = verifyAdminJwtToken) {
  return async token => {
    let claims;
    try { claims = verify(token); } catch { throw denied(); }
    if (!Number.isInteger(Number(claims.id)) || !['ADMIN','STAFF'].includes(claims.role)) throw denied();
    const row = await db.admin_users.findUnique({where:{id:Number(claims.id)}});
    if (!row?.is_active || row.role !== claims.role || !claims.av || claims.av !== adminTokenVersion(row)) throw denied();
    return {...claims, username:row.username, role:row.role};
  };
}
export const verifyAdminSession = createAdminSessionVerifier(prisma);
