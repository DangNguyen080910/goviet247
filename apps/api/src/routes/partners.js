import { partnerSessionPolicy, setPartnerRefreshCookie, refreshPartnerSession, partnerRememberUntil } from '../services/partnerAccess.js';
import { normalizePartnerPhone } from '../services/partnerRiderAccess.js';
import { canSelfCancelTrip } from '../shared/tripSelfService.js';
import { chatAudienceWhere } from '../shared/tripChatVisibility.js';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import sharp from 'sharp';
import { emitDriverTripEvent } from '../services/tripAudience.js';
import { prisma } from '../utils/db.js';
import { partnerAuth, partnerWrap as wrap, partnerFail as fail, signPartnerToken, companyScope, requireCompanyAdmin,
  requireSuperAdmin, publicCompany, publicMember, serializePartnerTrip, partnerAudit } from '../services/partnerAccess.js';
import { createTripHandler } from './trips.js';
import { quote } from '../controllers/pricingController.js';
import { assertNoContactNumber } from '../shared/tripChat.js';
const router=Router();
const username = value => {
  const s=String(value || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,49}$/.test(s)) throw fail('Mã công ty và username cần 3–50 ký tự: chữ thường, số, dấu chấm, gạch ngang hoặc gạch dưới.');
  return s;
};
const text=(value,max=150)=>String(value || '').trim().slice(0,max);
const password = value => { if (typeof value !== 'string' || value.length < 10 || Buffer.byteLength(value,'utf8') > 72) throw fail('Mật khẩu cần ít nhất 10 ký tự, tối đa 72 byte.'); return value; };
const memberSelect={id:true,username:true,displayName:true,phone:true,role:true,isActive:true,mustChangePassword:true};
const attempts=new Map();
// Bounded login throttling, in addition to the deployment's gateway rate limit.
router.post('/login',wrap(async(req,res)=>{
  const key=req.ip, now=Date.now();
  for (const [k,v] of attempts) if (v.until < now) attempts.delete(k);
  if (attempts.size > 10000 && !attempts.has(key)) throw fail('Vui lòng thử lại sau.',429);
  const state=attempts.get(key) || {count:0,until:now+900000};
  state.count++; attempts.set(key,state);
  if(state.count>20) throw fail('Đăng nhập quá nhiều lần. Vui lòng thử lại sau 15 phút.',429);
  const companyCode=username(req.body.companyCode), name=username(req.body.username);
  const company=await prisma.partnerCompany.findUnique({where:{code:companyCode}});
  const m=company && await prisma.partnerMember.findUnique({where:{companyId_username:{companyId:company.id,username:name}}});
  const raw=typeof req.body.password === 'string' ? req.body.password : '';
  if(!company?.isActive || !m?.isActive || !await bcrypt.compare(raw,m.passwordHash)) throw fail('Thông tin đăng nhập không đúng hoặc tài khoản đã bị khóa.',401);
  attempts.delete(key);
  const rememberUntil=req.body.rememberMe===true ? Math.floor(Date.now()/1000)+partnerSessionPolicy().rememberSeconds : undefined;
  setPartnerRefreshCookie(res,m,rememberUntil);
  res.set('Cache-Control','no-store');
  res.json({success:true,token:signPartnerToken(m,{rememberUntil}),member:publicMember(m),company:publicCompany(company)});
}));
router.post('/refresh',wrap(async(req,res)=>{
  const {token}=await refreshPartnerSession(req,res);
  res.json({success:true,token});
}));
router.use(partnerAuth);
router.get('/me',wrap(async(req,res)=>{
  const a=req.partnerActor;
  res.json({success:true,superAdmin:a.superAdmin,admin:a.admin || null,member:a.member ? publicMember(a.member):null,company:a.member ? publicCompany(a.member.company):null});
}));
router.post('/logout',wrap(async(req,res)=>{
  if(req.partnerActor.member) await prisma.partnerMember.update({where:{id:req.partnerActor.member.id},data:{sessionVersion:{increment:1}}});
  setPartnerRefreshCookie(res,null);
  res.json({success:true});
}));
router.post('/password',wrap(async(req,res)=>{
  const m=req.partnerActor.member;
  if(!m) throw fail('Tài khoản GoViet247 đổi mật khẩu qua hệ thống Admin.');
  const old=typeof req.body.currentPassword === 'string' ? req.body.currentPassword : '';
  if(!await bcrypt.compare(old,m.passwordHash)) throw fail('Mật khẩu hiện tại không đúng.');
  const next=password(req.body.newPassword);
  if(next===old) throw fail('Vui lòng chọn mật khẩu mới.');
  const hash=await bcrypt.hash(next,12);
  const updated=await prisma.$transaction(async tx=>{
    const saved=await tx.partnerMember.update({where:{id:m.id,sessionVersion:m.sessionVersion,passwordHash:m.passwordHash,isActive:true},data:{passwordHash:hash,mustChangePassword:false,sessionVersion:{increment:1}}});
    await partnerAudit(tx,req,m.companyId,'CHANGE_PASSWORD',m.id); return saved;
  });
  const rememberUntil=partnerRememberUntil(String(req.headers.authorization || '').replace(/^Bearer /,''));
  setPartnerRefreshCookie(res,updated,rememberUntil);
  res.set('Cache-Control','no-store');
  res.json({success:true,token:signPartnerToken(updated,{rememberUntil})});
}));
router.get('/companies',wrap(async(req,res)=>{
  requireSuperAdmin(req);
  const items=await prisma.partnerCompany.findMany({orderBy:{createdAt:'desc'},take:500});
  res.json({success:true,items});
}));
router.post('/companies',wrap(async(req,res)=>{
  requireSuperAdmin(req);
  const b=req.body,code=username(b.code),name=text(b.name),managementName=text(b.managementName),managementPhone=normalizePartnerPhone(b.managementPhone);
  if(!name || !managementName || !/^\+?[0-9(). -]{8,25}$/.test(managementPhone)) throw fail('Cần tên công ty, người liên hệ quản lý và số điện thoại hợp lệ.');
  const adminUsername=username(b.adminUsername), hash=await bcrypt.hash(password(b.password),12);
  const company=await prisma.$transaction(async tx=>{
    const c=await tx.partnerCompany.create({data:{code,name,managementName,managementPhone,greeting:text(b.greeting,500),members:{create:{username:adminUsername,displayName:text(b.adminName)||managementName,phone:managementPhone,passwordHash:hash,role:'ADMIN'}}}});
    await partnerAudit(tx,req,c.id,'CREATE_COMPANY',c.id); return c;
  });
  res.status(201).json({success:true,company});
}));
router.get('/company',wrap(async(req,res)=>{
  const c=await prisma.partnerCompany.findUnique({where:{id:companyScope(req)}});
  if(!c) throw fail('Không tìm thấy công ty.',404);
  res.json({success:true,company:req.partnerActor.superAdmin ? c:publicCompany(c)});
}));
router.patch('/company',wrap(async(req,res)=>{
  requireCompanyAdmin(req);
  const id=companyScope(req),b=req.body,data={};
  if(b.logoUrl !== undefined) {
    const logo=text(b.logoUrl,3000000);
    // Store a raster data URL: no public bucket or external tracking URL needed.
    if(logo && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(logo)) throw fail('Logo cần là ảnh PNG, JPEG hoặc WebP.');
    if(logo) {
      const image=sharp(Buffer.from(logo.split(',')[1],'base64'),{limitInputPixels:16000000});
      try {data.logoUrl='data:image/webp;base64,'+(await image.resize({width:512,height:256,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer()).toString('base64');}
      catch {throw fail('Không đọc được ảnh logo.');}
    } else data.logoUrl=null;
  }
  if(req.partnerActor.superAdmin) {
    for(const field of ['name','managementName','managementPhone','greeting']) if(b[field]!==undefined) data[field]=text(b[field],field==='greeting'?500:150);
    if(data.name==='' || data.managementName==='') throw fail('Tên công ty và người quản lý không được để trống.');
    if(data.managementPhone!==undefined) {data.managementPhone=normalizePartnerPhone(data.managementPhone);if(!data.managementPhone) throw fail('Cần số di động Việt Nam hợp lệ để quản lý đăng nhập Rider.');}
    if(typeof b.isActive==='boolean') data.isActive=b.isActive;
  }
  const c=await prisma.$transaction(async tx=>{
    const c=await tx.partnerCompany.update({where:{id},data});
    if(data.isActive===false) await tx.partnerMember.updateMany({where:{companyId:id},data:{sessionVersion:{increment:1}}});
    await partnerAudit(tx,req,id,'UPDATE_COMPANY',id,{fields:Object.keys(data)}); return c;
  });
  res.json({success:true,company:req.partnerActor.superAdmin ? c:publicCompany(c)});
}));
router.get('/members',wrap(async(req,res)=>{
  res.json({success:true,items:await prisma.partnerMember.findMany({where:{companyId:companyScope(req)},select:memberSelect,orderBy:{createdAt:'asc'}})});
}));
router.post('/members',wrap(async(req,res)=>{
  requireCompanyAdmin(req);
  const companyId=companyScope(req),b=req.body,name=username(b.username),displayName=text(b.displayName);
  if(!displayName || !['ADMIN','DISPATCHER'].includes(b.role)) throw fail('Cần họ tên và vai trò hợp lệ.');
  const phone=normalizePartnerPhone(b.phone);if(!phone) throw fail('Cần số di động nhân viên để liên kết app Rider.');
  const passwordHash=await bcrypt.hash(password(b.password),12);
  const m=await prisma.$transaction(async tx=>{
    const m=await tx.partnerMember.create({data:{companyId,username:name,displayName,phone,role:b.role,passwordHash}});
    await partnerAudit(tx,req,companyId,'CREATE_MEMBER',m.id);return m;
  });
  res.status(201).json({success:true,member:publicMember(m)});
}));
router.patch('/members/:id',wrap(async(req,res)=>{
  requireCompanyAdmin(req);
  const companyId=companyScope(req),b=req.body;
  const hash=b.password ? await bcrypt.hash(password(b.password),12):null;
  const result=await prisma.$transaction(async tx=>{
    await tx.$queryRawUnsafe('SELECT "id" FROM "PartnerCompany" WHERE "id" = $1 FOR UPDATE',companyId);
    const m=await tx.partnerMember.findFirst({where:{id:req.params.id,companyId}});
    if(!m) throw fail('Không tìm thấy nhân viên.',404);
    const data={sessionVersion:{increment:1}};
    if(b.role!==undefined) {if(!['ADMIN','DISPATCHER'].includes(b.role)) throw fail('Vai trò không hợp lệ.');data.role=b.role;}
    if(typeof b.isActive==='boolean') data.isActive=b.isActive;
    if(b.displayName!==undefined) {data.displayName=text(b.displayName);if(!data.displayName) throw fail('Họ tên không được để trống.');}
    if(b.phone!==undefined) {data.phone=normalizePartnerPhone(b.phone);if(!data.phone) throw fail("Số điện thoại nhân viên không hợp lệ.");}
    if(hash) Object.assign(data,{passwordHash:hash,mustChangePassword:true});
    if(m.role==='ADMIN' && m.isActive && (data.role==='DISPATCHER'||data.isActive===false)) {
      const others=await tx.partnerMember.count({where:{companyId,role:'ADMIN',isActive:true,id:{not:m.id}}});
      if(!others) throw fail('Cần giữ ít nhất một Admin đang hoạt động.');
    }
    if(data.isActive===false && await tx.trip.count({where:{partnerCompanyId:companyId,partnerAssignedToId:m.id,status:{in:['PENDING','ACCEPTED','CONTACTED','IN_PROGRESS']}}})) throw fail('Hãy chuyển các chuyến đang phụ trách trước khi khóa nhân viên.');
    const updated=await tx.partnerMember.update({where:{id:m.id},data});
    if(data.phone && !m.phone) await tx.trip.updateMany({where:{partnerCompanyId:companyId,partnerBookerPhone:null,OR:[{partnerCreatedById:m.id},{partnerCreatedById:null,partnerAssignedToId:m.id}]},data:{partnerBookerPhone:data.phone,partnerBookerName:updated.displayName}});
    await partnerAudit(tx,req,companyId,'UPDATE_MEMBER',m.id,{fields:Object.keys(data).filter(k=>k!=='passwordHash')});return updated;
  });
  res.json({success:true,member:publicMember(result)});
}));
router.post('/quote',wrap(async(req,res)=>{
  const company=await prisma.partnerCompany.findUnique({where:{id:companyScope(req)}});
  if(!company?.isActive) throw fail('Công ty đã bị khóa.',403);
  req.body.historyContext={...req.body.historyContext,customerName:company.name,customerPhone:'',source:'PARTNER'};
  await quote(req,res);
}));
router.post('/trips',wrap(async(req,res)=>{
  const companyId=companyScope(req),a=req.partnerActor;
  const company=await prisma.partnerCompany.findUnique({where:{id:companyId}});
  if(!company?.isActive) throw fail('Công ty đã bị khóa.',403);
  const assigneeId=a.superAdmin ? text(req.body.assignedToId):a.member.id;
  const member=await prisma.partnerMember.findFirst({where:{id:assigneeId,companyId,isActive:true}});
  if(!member) throw fail('Cần điều phối viên đang hoạt động.');
  try {assertNoContactNumber(req.body.note);} catch(e) {throw fail(e.message);}
  req.user=undefined;
  req.body={...req.body,riderName:'',riderPhone:''};
  req.partnerTripData={partnerCompanyId:companyId,partnerCompanyName:company.name,
    partnerGreeting:company.greeting || `Em là tài xế đón khách của ${company.name}.`,
    partnerCreatedById:a.member?.id || null,partnerAssignedToId:member.id,partnerSessionVersion:a.member?.sessionVersion,
    partnerStops:Array.isArray(req.body.stops)?req.body.stops.map(s=>String(s || '').trim()).filter(Boolean):[],
    partnerAuditData:{companyId,actorId:a.id,actorLabel:a.label,action:'CREATE_TRIP'}};
  await createTripHandler(req,res);
}));
const tripInclude={stops:{orderBy:{seq:'asc'}},partnerCreatedBy:{select:memberSelect},partnerAssignedTo:{select:memberSelect},driver:{select:{driverProfile:{select:{vehicleBrand:true,vehicleModel:true,vehicleColor:true,plateNumber:true}}}}};
router.get('/trips',wrap(async(req,res)=>{
  const companyId=companyScope(req),page=Math.max(1,Math.min(100000,Math.floor(Number(req.query.page)||1))),where={partnerCompanyId:companyId};
  if(['PENDING_REVIEW','PENDING_DRIVER'].includes(req.query.status)) {
    where.status='PENDING';
    if(req.query.status==='PENDING_REVIEW') Object.assign(where,{isVerified:false,verifiedAt:null});
    else where.OR=[{isVerified:true},{verifiedAt:{not:null}}];
  } else if(req.query.status) {
    if(!['PENDING','ACCEPTED','CONTACTED','IN_PROGRESS','COMPLETED','CANCELLED'].includes(req.query.status)) throw fail('Trạng thái không hợp lệ.');
    where.status=req.query.status;
  }
  if(req.query.date) {
    const day=String(req.query.date);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(day))) throw fail('Ngày không hợp lệ.');
    const start=new Date(`${day}T00:00:00+07:00`);where.pickupTime={gte:start,lt:new Date(start.getTime()+86400000)};
  }
  if(req.query.search) where.id={contains:text(req.query.search,100),mode:'insensitive'};
  const [rows,total]=await Promise.all([prisma.trip.findMany({where,include:tripInclude,orderBy:[{pickupTime:'desc'},{id:'desc'}],skip:(page-1)*50,take:50}),prisma.trip.count({where})]);
  const actor=req.partnerActor,actorId=actor.id;
  const items=await Promise.all(rows.map(async t=>{
    const item=serializePartnerTrip(t);
    item.canReassign=actor.superAdmin || actor.member.role==='ADMIN' || t.partnerAssignedToId===actor.member.id;
    item.canCancel=item.canCancel && item.canReassign;
    item.canChat=actor.superAdmin || (item.canChat && (actor.member.role==='ADMIN' || t.partnerAssignedToId===actor.member.id));
    if(item.canChat) {
      const read=await prisma.tripChatRead.findUnique({where:{tripId_actorId:{tripId:t.id,actorId}}});
      item.unread=await prisma.tripChatMessage.count({where:{tripId:t.id,AND:[chatAudienceWhere({id:actorId,role:actor.superAdmin?'ADMIN':'PARTNER'})],senderId:{not:actorId},OR:[{createdAt:{gt:read?.readAt || new Date(0)}},{createdAt:read?.readAt || new Date(0),id:{gt:read?.messageId || ''}}]}});
    }
    return item;
  }));
  res.json({success:true,items,total,page});
}));
router.get('/trips/:id',wrap(async(req,res)=>{
  const trip=await prisma.trip.findFirst({where:{id:req.params.id,partnerCompanyId:companyScope(req)},include:tripInclude});
  if(!trip) throw fail('Không tìm thấy chuyến.',404);
  const item=serializePartnerTrip(trip),actor=req.partnerActor;
  item.canReassign=actor.superAdmin || actor.member.role==='ADMIN' || trip.partnerAssignedToId===actor.member.id;
  item.canCancel=item.canCancel && item.canReassign;
  item.canChat=actor.superAdmin || (item.canChat && (actor.member.role==='ADMIN' || trip.partnerAssignedToId===actor.member.id));
  res.json({success:true,trip:item});
}));
router.patch('/trips/:id/assignment',wrap(async(req,res)=>{
  const companyId=companyScope(req),assigneeId=text(req.body.assignedToId);
  await prisma.$transaction(async tx=>{
    await tx.$queryRawUnsafe('SELECT "id" FROM "PartnerCompany" WHERE "id" = $1 FOR UPDATE',companyId);
    await tx.$queryRawUnsafe('SELECT "id" FROM "Trip" WHERE "id" = $1 FOR UPDATE',req.params.id);
    const t=await tx.trip.findFirst({where:{id:req.params.id,partnerCompanyId:companyId}});
    if(!t) throw fail('Không tìm thấy chuyến.',404);
    if(!req.partnerActor.superAdmin && req.partnerActor.member.role!=='ADMIN' && t.partnerAssignedToId!==req.partnerActor.member.id) throw fail('Chỉ người phụ trách hoặc Admin được chuyển điều phối.',403);
    const m=await tx.partnerMember.findFirst({where:{id:assigneeId,companyId,isActive:true}});
    if(!m) throw fail('Điều phối viên không hợp lệ.');
    if(['COMPLETED','CANCELLED'].includes(t.status)) throw fail('Chuyến đã kết thúc.');
    await tx.trip.update({where:{id:t.id},data:{partnerAssignedToId:m.id}});
    await partnerAudit(tx,req,companyId,'ASSIGN_TRIP',t.id,{from:t.partnerAssignedToId,to:m.id});
  });
  res.json({success:true});
}));
router.post('/trips/:id/cancel',wrap(async(req,res)=>{
  const companyId=companyScope(req);
  const trip=await prisma.$transaction(async tx=>{
    await tx.$queryRawUnsafe('SELECT "id" FROM "Trip" WHERE "id" = $1 FOR UPDATE',req.params.id);
    const t=await tx.trip.findFirst({where:{id:req.params.id,partnerCompanyId:companyId}});
    if(!t) throw fail('Không tìm thấy chuyến.',404);
    const actor=req.partnerActor;
    if(!actor.superAdmin && actor.member.role!=='ADMIN' && t.partnerAssignedToId!==actor.member.id) throw fail('Chỉ người phụ trách hoặc Admin được hủy chuyến.',403);
    if(!canSelfCancelTrip(t)) throw fail('Chỉ được tự hủy chuyến khi còn chờ duyệt. Chuyến đã duyệt, vui lòng nhắn GoViet247 để được hỗ trợ.',409);
    const updated=await tx.trip.update({where:{id:t.id},data:{status:'CANCELLED',cancelledAt:new Date(),cancelReason:'Đối tác hủy chuyến chờ duyệt'}});
    await partnerAudit(tx,req,companyId,'CANCEL_TRIP',t.id);return updated;
  });
  const io=req.app.get('io');
  try {
    if(io) {
      io.to('admins').emit('admin:dashboard_changed',{tripId:trip.id,source:'partner_cancel',status:trip.status});
      await emitDriverTripEvent(io,'trip:changed',{tripId:trip.id,status:trip.status});
    }
  } catch (socketError) {
    console.error("[partnerCancelTrip] saved; realtime delivery failed:", socketError);
  }
  res.json({success:true});
}));
router.get('/audit',wrap(async(req,res)=>{
  requireCompanyAdmin(req);
  res.json({success:true,items:await prisma.partnerAuditLog.findMany({where:{companyId:companyScope(req)},orderBy:{createdAt:'desc'},take:100})});
}));
export default router;
