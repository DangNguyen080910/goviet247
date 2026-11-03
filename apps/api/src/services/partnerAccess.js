import { canSelfCancelTrip } from '../shared/tripSelfService.js';
import { chatCanSend } from '../shared/tripChat.js';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/db.js';
import { verifyAdminJwtToken } from '../utils/jwt.js';
export const partnerFail = (message, status = 400) => Object.assign(new Error(message), {status});
const secret = () => {
  if (!process.env.JWT_SECRET) throw partnerFail('Chưa cấu hình xác thực.', 503);
  return process.env.JWT_SECRET;
};
const secondsNow=()=>Math.floor(Date.now()/1000);
function boundedSetting(name,fallback,max) {
  const n=Number(process.env[name] || fallback);
  if(!Number.isInteger(n) || n<1 || n>max) throw partnerFail('Cấu hình thời hạn phiên Partner không hợp lệ.',503);
  return n;
}
export function partnerSessionPolicy() {
  return {normalSeconds:boundedSetting('PARTNER_SESSION_HOURS',12,24)*3600,
    rememberSeconds:boundedSetting('PARTNER_REMEMBER_DAYS',30,90)*86400};
}
export function signPartnerToken(member, {rememberUntil}={}) {
  const now=secondsNow(), policy=partnerSessionPolicy();
  const expires=rememberUntil ? Math.min(policy.normalSeconds,rememberUntil-now) : policy.normalSeconds;
  if(expires<=0) throw partnerFail('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',401);
  return jwt.sign({sub:member.id,version:member.sessionVersion,...(rememberUntil?{rememberUntil}:{})},secret(),
    {algorithm:'HS256',audience:'goviet247-partners',issuer:'goviet247',expiresIn:expires});
}
async function activePartnerMember(claims,db) {
  const member=await db.partnerMember.findUnique({where:{id:claims.sub},include:{company:true}});
  if(!member?.isActive || !member.company.isActive || member.sessionVersion!==claims.version) throw partnerFail('Phiên đã bị thu hồi hoặc tài khoản/công ty đã bị khóa. Vui lòng đăng nhập lại.',401);
  return member;
}
export async function verifyPartnerToken(token,db=prisma) {
  let claims;
  try {claims=jwt.verify(token,secret(),{algorithms:['HS256'],audience:'goviet247-partners',issuer:'goviet247'});}
  catch(error) {if(error.status)throw error;throw partnerFail(error.name==='TokenExpiredError'?'Phiên đăng nhập đã hết hạn.':'Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại.',401);}
  return activePartnerMember(claims,db);
}
export const PARTNER_REFRESH_COOKIE='gv247_partner_refresh';
export function partnerRememberUntil(token) {
  const value=jwt.decode(token)?.rememberUntil;
  return Number.isInteger(value) && value>secondsNow() ? value : undefined;
}
export function setPartnerRefreshCookie(res,member,rememberUntil) {
  const options={httpOnly:true,secure:process.env.NODE_ENV!=='development' && process.env.NODE_ENV!=='test',sameSite:'lax',path:'/api/partners'};
  if(!rememberUntil){res.clearCookie(PARTNER_REFRESH_COOKIE,options);return;}
  const remaining=rememberUntil-secondsNow();
  if(remaining<=0) throw partnerFail('Phiên ghi nhớ đã hết hạn.',401);
  const token=jwt.sign({sub:member.id,version:member.sessionVersion,rememberUntil},secret(),{algorithm:'HS256',audience:'goviet247-partners-refresh',issuer:'goviet247',expiresIn:remaining});
  res.cookie(PARTNER_REFRESH_COOKIE,token,{...options,maxAge:remaining*1000});
}
export async function refreshPartnerSession(req,res,db=prisma) {
  const origin=req.get('origin');
  const allowed=(process.env.PARTNER_WEB_ORIGINS || 'https://partners.goviet247.com').split(',').map(value=>value.trim()).filter(Boolean);
  if(req.get('X-Session-Mode')!=='partner-refresh' || (origin && !allowed.includes(origin))) throw partnerFail('Nguồn yêu cầu làm mới phiên không hợp lệ.',403);
  const raw=String(req.headers.cookie || '').split(';').map(value=>value.trim()).find(value=>value.startsWith(PARTNER_REFRESH_COOKIE+'='));
  let claims;
  try {claims=jwt.verify(raw?.slice(PARTNER_REFRESH_COOKIE.length+1) || '',secret(),{algorithms:['HS256'],audience:'goviet247-partners-refresh',issuer:'goviet247'});}
  catch(error){if(error.status)throw error;throw partnerFail('Phiên ghi nhớ đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.',401);}
  if(!Number.isInteger(claims.rememberUntil) || claims.rememberUntil!==claims.exp || claims.rememberUntil<=secondsNow()) throw partnerFail('Phiên ghi nhớ đã hết hạn.',401);
  const member=await activePartnerMember(claims,db);
  const token=signPartnerToken(member,{rememberUntil:claims.rememberUntil});
  setPartnerRefreshCookie(res,member,claims.rememberUntil);
  res.set('Cache-Control','no-store');
  return {token,member};
}
export async function resolvePartnerActor(token) {
  let claims;
  try { claims = verifyAdminJwtToken(token); } catch {}
  if (claims?.role === 'ADMIN') {
    const admin = await prisma.admin_users.findUnique({where:{id:Number(claims.id)}});
    if (!admin?.is_active || admin.role !== 'ADMIN') throw partnerFail('Không có quyền quản lý đối tác.', 403);
    return {superAdmin:true, id:`admin-${admin.id}`, label:`GoViet247 · ${admin.username}`,admin:{id:admin.id,username:admin.username,role:admin.role}};
  }
  const member = await verifyPartnerToken(token);
  return {superAdmin:false, id:`partner-${member.id}`, label:member.displayName, member, companyId:member.companyId};
}
export const partnerWrap = fn => async (req,res) => {
  try { await fn(req,res); }
  catch(e) { console.error('[Partners]', e.code || e.message); res.status(e.status || (e.code === 'P2002' ? 409 : 500)).json({success:false,message:e.status ? e.message : e.code === 'P2002' ? 'Mã công ty, username hoặc số điện thoại nhân viên đã tồn tại.' : 'Chưa xử lý được yêu cầu. Vui lòng thử lại.'}); }
};
export async function partnerAuth(req,res,next) {
  try {
    req.partnerActor = await resolvePartnerActor(String(req.headers.authorization || '').replace(/^Bearer /,''));
    if (req.partnerActor.member?.mustChangePassword && !['/me','/password','/logout'].includes(req.path)) throw partnerFail('Vui lòng đổi mật khẩu ban đầu.',403);
    res.set('Cache-Control','no-store'); next();
  } catch(e) { res.status(e.status || 503).json({success:false,message:e.status ? e.message : 'Chưa kiểm tra được phiên đăng nhập.'}); }
}
export function companyScope(req) {
  const a=req.partnerActor;
  const id=a.superAdmin ? String(req.query.companyId || '') : a.companyId;
  if (!id) throw partnerFail('Vui lòng chọn công ty.');
  return id;
}
export function requireCompanyAdmin(req) {
  if (!req.partnerActor.superAdmin && req.partnerActor.member.role !== 'ADMIN') throw partnerFail('Chỉ Admin công ty được thực hiện.',403);
}
export function requireSuperAdmin(req) {
  if (!req.partnerActor.superAdmin) throw partnerFail('Chỉ GoViet247 được thực hiện.',403);
}
export function publicCompany(c) {
  return {id:c.id, code:c.code, name:c.name, logoUrl:c.logoUrl, greeting:c.greeting, isActive:c.isActive};
}
export function publicMember(m) {
  return {id:m.id, username:m.username, displayName:m.displayName, phone:m.phone, role:m.role, isActive:m.isActive, mustChangePassword:m.mustChangePassword};
}
export function serializePartnerTrip(t) {
  const active=['ACCEPTED','CONTACTED','IN_PROGRESS'].includes(t.status);
  return {id:t.id, status:t.status, isVerified:t.isVerified, verifiedAt:t.verifiedAt, createdAt:t.createdAt, pickupTime:t.pickupTime, returnTime:t.returnTime,
    pickupAddress:t.pickupAddress, dropoffAddress:t.dropoffAddress, stops:t.stops, carType:t.carType, direction:t.direction,
    totalPrice:t.totalPrice, note:t.note, companyName:t.partnerCompanyName,
    createdBy:t.partnerCreatedBy ? publicMember(t.partnerCreatedBy) : null,
    assignedTo:t.partnerAssignedTo ? publicMember(t.partnerAssignedTo) : null,
    vehicle:active && t.driver?.driverProfile ? {brand:t.driver.driverProfile.vehicleBrand, model:t.driver.driverProfile.vehicleModel,
      color:t.driver.driverProfile.vehicleColor, plate:t.driver.driverProfile.plateNumber} : null,
    canChat:chatCanSend(t,{role:'PARTNER'}), canCancel:canSelfCancelTrip(t)};
}
export async function partnerAudit(db,req,companyId,action,targetId,detail) {
  return db.partnerAuditLog.create({data:{companyId,actorId:req.partnerActor.id,actorLabel:req.partnerActor.label,action,targetId,detail}});
}
