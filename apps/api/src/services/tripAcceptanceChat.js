import {chatMessageAlertsAdmin} from '../shared/chatAlerts.js';
import { chatMessageInCurrentHistory } from '../shared/chatAssignmentHistory.js';
import { CHAT_ACTIVE_STATUSES, isRiderChatEnded } from '../shared/tripChat.js';
import { chatAudienceVisible } from '../shared/tripChatVisibility.js';
import { getTripRiderRecipientUserIds } from './riderTripAccess.js';

export const ACCEPTANCE_CHAT_TEXT = {
  RIDER: 'Tài xế đã nhận chuyến. Mở Liên hệ chuyến để nhắn tin xác nhận lịch đón. Người trực tiếp đi có thể bấm Gọi tài xế để trao đổi qua Internet.',
  PARTNER: 'Chuyến của công ty đã có tài xế nhận. Mở Liên hệ chuyến để xác nhận lịch đón và yêu cầu phục vụ. Điều phối viên phụ trách có thể nhắn tin hoặc bấm Gọi tài xế.',
  DRIVER_RIDER: 'Bạn đã nhận chuyến thành công. Mở Liên hệ chuyến để nhắn tin xác nhận lịch đón với khách; dùng nút Gọi khách khi cần trao đổi với người trực tiếp đi.',
  DRIVER_PARTNER: 'Bạn đã nhận chuyến đối tác. Mở Liên hệ chuyến để nhắn tin hoặc bấm Gọi điều phối, xác nhận lịch đón và yêu cầu phục vụ. Điều phối viên sẽ liên hệ khách.',
};

// Called only inside the successful acceptance transaction, while the trip row is locked.
// Stable keys make retries idempotent; a subsequent acceptance gets its own pair of notices.
export async function createAcceptanceChatNotices(tx, trip) {
  if (!trip.driverId || !trip.acceptedAt || trip.status !== 'ACCEPTED') throw new Error('Chuyến chưa được nhận thành công.');
  const acceptedAt = new Date(trip.acceptedAt);
  if (!Number.isFinite(acceptedAt.getTime())) throw new Error('Thời điểm nhận chuyến không hợp lệ.');
  const key = `accept_${trip.version}_${acceptedAt.getTime()}`;
  const audience = trip.partnerCompanyId ? 'PARTNER' : 'RIDER';
  const common = { tripId: trip.id, senderId: 'goviet247-system', senderRole: 'SYSTEM',
    senderLabel: 'Hệ thống GoViet247', kind: 'TEXT', createdAt: acceptedAt };
  return tx.tripChatMessage.createMany({data: [
    { ...common, clientId: `${key}_${audience}`, audience, text: ACCEPTANCE_CHAT_TEXT[audience] },
    { ...common, clientId: `${key}_DRIVER`, audience: 'DRIVER', recipientId: trip.driverId,
      text: ACCEPTANCE_CHAT_TEXT[trip.partnerCompanyId ? 'DRIVER_PARTNER' : 'DRIVER_RIDER'] },
  ], skipDuplicates: true });
}

// Resolve recipients before looking up devices: private notices never notify the opposite side.
export async function chatPushRecipientIds(db, trip, message) {
  if (message.senderRole === 'SYSTEM' && message.clientId?.startsWith('accept_') &&
    (!trip.driverId || !CHAT_ACTIVE_STATUSES.includes(trip.status) || !trip.acceptedAt ||
      new Date(message.createdAt).getTime() !== new Date(trip.acceptedAt).getTime())) return [];
  if (message.senderRole === 'SYSTEM' && message.clientId === 'booking_created') return [];
  if (message.senderRole === 'SYSTEM' && message.clientId?.startsWith('accept_')) {
    // Customer/Admin already receive the status push for this same acceptance.
    if (message.audience === 'RIDER') return [];
    if (message.audience === 'DRIVER') return CHAT_ACTIVE_STATUSES.includes(trip.status) && trip.driverId === message.recipientId ? [trip.driverId] : [];
  }
  const admins = chatMessageAlertsAdmin(message) ? await db.admin_users.findMany({where: {is_active: true, role: {in: message.recordingCallId ? ['ADMIN'] : ['ADMIN', 'STAFF']}}, select: {id: true}}) : [];
  const actors = admins.map(a => ({id: `admin-${a.id}`, role: 'ADMIN'}));
  if (!isRiderChatEnded(trip.status) && chatMessageInCurrentHistory(trip, {role:'RIDER'}, message)) {
    const riders = await getTripRiderRecipientUserIds(db, trip);
    actors.push(...riders.map(id => ({id, role: trip.partnerCompanyId ? 'PARTNER' : 'RIDER'})));
    if (trip.partnerCompanyId) {
      const members = await db.partnerMember.findMany({where: {companyId: trip.partnerCompanyId, isActive: true,
        mustChangePassword: false, company: {isActive: true}, OR: [{role: 'ADMIN'}, {id: trip.partnerAssignedToId || '__none__'}]}, select: {id: true}});
      actors.push(...members.map(m => ({id: `partner-${m.id}`, role: 'PARTNER'})));
    }
  }
  if (CHAT_ACTIVE_STATUSES.includes(trip.status) && trip.driverId && (!trip.acceptedAt || new Date(message.historyAt ?? message.createdAt) >= new Date(trip.acceptedAt))) {
    actors.push({id: trip.driverId, role: 'DRIVER'});
  }
  if (message.senderId === 'system-call' && message.clientId?.startsWith('call_')) {
    const call = await db.tripCall.findUnique({where:{id:message.clientId.slice(5)}});
    return [...new Set(actors.filter(a => a.role === 'ADMIN' || (call?.status === 'MISSED' && call.calleeAliases.includes(a.id))).map(a => a.id))];
  }
  const recipients = message.senderRole === 'SYSTEM' && message.clientId?.startsWith('accept_') ? actors.filter(a => a.id.startsWith('partner-')) : actors;
  return [...new Set(recipients.filter(a => a.id !== message.senderId && chatAudienceVisible(message, a)).map(a => a.id))];
}
