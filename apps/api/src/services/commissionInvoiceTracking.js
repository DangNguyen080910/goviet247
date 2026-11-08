import { getAccountingPeriod } from './accountingQuarter.js';

export const INVOICE_ALERT_TYPE = 'COMMISSION_INVOICE_DAILY';
export function vietnamDay(now = new Date()) {
  return new Date(now.getTime() + 7 * 3600000).toISOString().slice(0, 10);
}
export function invoiceDayPeriod(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day))) throw new Error('Ngày không hợp lệ. Dùng YYYY-MM-DD.');
  const start = new Date(`${day}T00:00:00+07:00`);
  if (!Number.isFinite(+start) || vietnamDay(start) !== day || Number(day.slice(0,4)) < 2000 || Number(day.slice(0,4)) > 2100) throw new Error('Ngày không hợp lệ.');
  return { day, year: Number(day.slice(0,4)), quarter: Math.ceil(Number(day.slice(5,7))/3), month: Number(day.slice(5,7)), start, end: new Date(+start+86400000-1), periodKey: `N${day}` };
}
export function getCommissionPeriod(query) {
  if (query.day != null) return invoiceDayPeriod(query.day);
  const {year,quarter,month}=query;
  if (!Number.isInteger(Number(year)) || Number(year)<2000 || Number(year)>2100 ||
      (month == null && ![1,2,3,4].includes(Number(quarter))) ||
      (month != null && (!Number.isInteger(Number(month)) || Number(month)<1 || Number(month)>12))) throw new Error('Kỳ kế toán không hợp lệ.');
  return getAccountingPeriod(year,quarter,month);
}
export function pendingInvoiceWhere(end) {
  return { issuedAt: null, recognizedAt: { lte: end }, trip: { status: 'COMPLETED', OR: [{commissionAmountSnapshot:{gt:0}},{commissionAmountSnapshot:null}] } };
}
export async function commissionInvoiceSummary(db, day = vietnamDay()) {
  const period=invoiceDayPeriod(day);
  const trip={status:'COMPLETED',OR:[{commissionAmountSnapshot:{gt:0}},{commissionAmountSnapshot:null}]};
  const [todayTotal, confirmedToday, pendingToday, earlierPending]=await Promise.all([
    db.commissionInvoiceState.count({where:{trip,recognizedAt:{gte:period.start,lte:period.end}}}),
    db.commissionInvoiceState.count({where:{trip,recognizedAt:{gte:period.start,lte:period.end},issuedAt:{not:null}}}),
    db.commissionInvoiceState.count({where:{trip,recognizedAt:{gte:period.start,lte:period.end},issuedAt:null}}),
    db.commissionInvoiceState.count({where:{trip,recognizedAt:{lt:period.start},issuedAt:null}}),
  ]);
  return {day,todayTotal,confirmedToday,pendingToday,earlierPending,totalPending:pendingToday+earlierPending,reminderHour:21};
}

// Persistent alert + transaction advisory lock deduplicate across restarts and API replicas.
export async function runCommissionInvoiceReminder({db,io,notify,now=new Date()}) {
  const local=new Date(+now+7*3600000);
  if (local.getUTCHours()<21) return null;
  const period=invoiceDayPeriod(vietnamDay(now));
  const alert=await db.$transaction(async tx=>{
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(2470316)::text`;
    if (await tx.adminAlertLog.findFirst({where:{alertType:INVOICE_ALERT_TYPE,sentAt:{gte:period.start,lte:period.end}}})) return null;
    const summary=await commissionInvoiceSummary(tx,period.day);
    if (!summary.totalPending) return null;
    const anchor=await tx.commissionInvoiceState.findFirst({where:pendingInvoiceWhere(now),orderBy:[{recognizedAt:'asc'},{tripId:'asc'}],select:{tripId:true}});
    if (!anchor) return null;
    return tx.adminAlertLog.create({data:{tripId:anchor.tripId,alertType:INVOICE_ALERT_TYPE,level:1,sentTo:'ADMIN',success:true,sentAt:now,
      message:`[INVOICE_DAY:${period.day}] Nhắc lập hóa đơn hoa hồng: hôm nay ${summary.todayTotal} chuyến cần kiểm tra hóa đơn, còn ${summary.pendingToday} chưa xác nhận phát hành; kỳ trước còn ${summary.earlierPending}. Tổng cần kiểm tra ${summary.totalPending}. Mở Hoa Hồng để đối chiếu. Tải Excel hoặc đánh dấu đã xem không có nghĩa đã phát hành hóa đơn. Chuyến phát sinh sau giờ nhắc tiếp tục nằm trong danh sách chưa xác nhận.`}});
  });
  if (!alert) return null;
  try {io?.to('admins').emit('admin:dashboard_changed',{source:'commission_invoice_reminder',alertId:alert.id});} catch(e){console.error('[InvoiceReminder] realtime',e.message);}
  try {await notify?.({title:'Nhắc hóa đơn hoa hồng lúc 21:00',body:alert.message.replace(/^\[[^\]]+\] /,''),data:{type:INVOICE_ALERT_TYPE,day:period.day,alertId:alert.id},roles:['ADMIN','admin']});} catch(e){console.error('[InvoiceReminder] push',e.message);}
  return alert;
}
export function startCommissionInvoiceReminder(options) {
  let running=false;
  const run=async()=>{if(running)return;running=true;try{await runCommissionInvoiceReminder(options);}catch(e){console.error('[InvoiceReminder]',e.message);}finally{running=false;}};
  const timer=setInterval(()=>{void run();},60000);timer.unref();void run();return timer;
}
