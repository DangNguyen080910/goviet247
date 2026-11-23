import {adminTokenVersion} from './adminSessions.js';
export async function activeAdminDevices(db,devices){
  const now=new Date();
  const candidates=devices.filter(d=>/^admin-\d+$/.test(d.userId) && ['admin','staff'].includes(String(d.role).toLowerCase()) && d.pushExpiresAt && new Date(d.pushExpiresAt)>now);
  const ids=[...new Set(candidates.map(d=>Number(d.userId.slice(6))))];
  if(!ids.length)return [];
  const rows=await db.admin_users.findMany({where:{id:{in:ids},is_active:true}});
  return candidates.filter(d=>rows.some(a=>a.is_active && a.id===Number(d.userId.slice(6)) && a.role.toLowerCase()===d.role.toLowerCase() && d.adminAuthVersion===adminTokenVersion(a)));
}
