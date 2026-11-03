import { CHAT_ACTIVE_STATUSES, isRiderChatEnded } from '../shared/tripChat.js';
import { chatAudienceVisible } from '../shared/tripChatVisibility.js';
import { getTripRiderRecipientUserIds } from './riderTripAccess.js';

export const ACCEPTANCE_CHAT_TEXT = {
  RIDER: 'Tài xế đã nhận chuyến của bạn. Tài xế sẽ nhắn tại đây để xác nhận lịch đón và thông tin chuyến. Bạn vui lòng theo dõi và phản hồi nhé.',
  PARTNER: 'Tài xế đã nhận chuyến của công ty. Vui lòng trao đổi tại đây để xác nhận lịch đón và yêu cầu phục vụ khách.',
  DRIVER_RIDER: 'Bạn đã nhận chuyến thành công. Vui lòng nhắn tại đây ngay để xác nhận lịch đón và thông tin chuyến với người đặt.',
  DRIVER_PARTNER: 'Bạn đã nhận chuyến đối tác thành công. Vui lòng nhắn xác nhận với điều phối viên tại đây ngay. Điều phối viên sẽ trực tiếp liên hệ khách.',
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
  const admins = await db.admin_users.findMany({where: {is_active: true, role: {in: ['ADMIN', 'STAFF']}}, select: {id: true}});
  const actors = admins.map(a => ({id: `admin-${a.id}`, role: 'ADMIN'}));
  if (!isRiderChatEnded(trip.status)) {
    const riders = await getTripRiderRecipientUserIds(db, trip);
    actors.push(...riders.map(id => ({id, role: trip.partnerCompanyId ? 'PARTNER' : 'RIDER'})));
    if (trip.partnerCompanyId) {
      const members = await db.partnerMember.findMany({where: {companyId: trip.partnerCompanyId, isActive: true,
        mustChangePassword: false, company: {isActive: true}, OR: [{role: 'ADMIN'}, {id: trip.partnerAssignedToId || '__none__'}]}, select: {id: true}});
      actors.push(...members.map(m => ({id: `partner-${m.id}`, role: 'PARTNER'})));
    }
  }
  if (trip.driverId && (!trip.acceptedAt || new Date(message.createdAt) >= new Date(trip.acceptedAt))) {
    actors.push({id: trip.driverId, role: 'DRIVER'});
  }
  return [...new Set(actors.filter(a => a.id !== message.senderId && chatAudienceVisible(message, a)).map(a => a.id))];
}
