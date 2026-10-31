import { chatAccess } from './tripChatService.js';
import { chatCanSend } from '../shared/tripChat.js';
import { sendAdminPushNotification } from './notificationService.js';

export const CHAT_CONTACT_ALERT = 'CHAT_CONTACT_BLOCKED';
const COOLDOWN_MS = 30_000;

// Persist rejected attempts separately: blocked text never becomes a chat message.
export async function recordBlockedChatContact(db, tripId, actor, body, {io, notify = sendAdminPushNotification} = {}) {
  const alert = await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "Trip" WHERE "id" = ${tripId} FOR UPDATE`;
    const trip = await chatAccess(tx, tripId, actor);
    if (!chatCanSend(trip, actor)) throw Object.assign(new Error('Hội thoại chỉ đọc.'), {status:403});
    const marker = `[${actor.role}:${actor.id}]`;
    // The trip lock makes this cooldown consistent across API processes.
    const recent = await tx.adminAlertLog.findFirst({where:{
      tripId, alertType:CHAT_CONTACT_ALERT, message:{startsWith:marker},
      sentAt:{gte:new Date(Date.now()-COOLDOWN_MS)}
    }});
    if (recent) return null;
    const content = String(body.kind === 'LOCATION' ? body.locationLabel : body.text).trim().slice(0,2000);
    return tx.adminAlertLog.create({data:{
      tripId, alertType:CHAT_CONTACT_ALERT, level:1, sentTo:'admins', success:true,
      message:`${marker} ${actor.label || 'Thành viên'} đã thử gửi số điện thoại trong ${body.kind === 'LOCATION' ? 'nhãn vị trí' : 'tin nhắn'}. Nội dung đã bị chặn, chưa gửi cho người nhận. Nội dung để Admin kiểm tra: ${content}`
    }});
  });
  if (!alert) return null;
  // Alert history remains available if realtime/push delivery fails.
  try { io?.to('admins').emit('admin:dashboard_changed', {source:'chat_contact_alert',alertId:alert.id,tripId}); }
  catch(error) { console.error('[ChatContactAlert] realtime unavailable',error.message); }
  try { await notify({
    title:'Đã chặn gửi số điện thoại trong hội thoại',
    body:`Có thành viên thử gửi số điện thoại trong chuyến #${tripId.slice(-8).toUpperCase()}. Mở Cảnh báo để kiểm tra.`,
    data:{type:CHAT_CONTACT_ALERT,alertId:alert.id,tripId}
  }); } catch(error) { console.error('[ChatContactAlert] push unavailable',error.message); }
  return alert;
}
