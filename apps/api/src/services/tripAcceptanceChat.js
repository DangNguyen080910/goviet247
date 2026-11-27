import {chatMessageAlertsAdmin} from '../shared/chatAlerts.js';
import { chatMessageInCurrentHistory } from '../shared/chatAssignmentHistory.js';
import { CHAT_ACTIVE_STATUSES, isRiderChatEnded } from '../shared/tripChat.js';
import { chatAudienceVisible } from '../shared/tripChatVisibility.js';
import { getTripRiderRecipientUserIds } from './riderTripAccess.js';

function driverAcceptanceText(contact) {
  return [
    "Bạn đã nhận chuyến. Vui lòng đọc kỹ ghi chú khách hàng và thực hiện các bước sau.",
    `1. ${contact}`,
    "2. Tại điểm đón, điểm đến và điểm trả khách, mỗi lần gửi định vị GPS và 1 ảnh xe tại chỗ ngay trong cuộc trò chuyện này. Ảnh và định vị chỉ dùng để xác nhận chuyến và hỗ trợ xử lý tranh chấp.",
    "3. Giá trọn gói đã gồm phí cầu đường, cao tốc và ăn nghỉ của tài xế. Không thu thêm. Đi đúng lộ trình đã thống nhất, gồm cao tốc nếu khách yêu cầu. Không tự đổi xe, đổi tài xế hoặc nhận khách ngoài GoViet247.",
    "4. Khách muốn đi tiếp hoặc đặt chuyến về, báo GoViet247 để tạo chuyến qua hệ thống.",
    "Vi phạm có thể bị hạn chế nhận chuyến hoặc khóa tài khoản.",
  ].join("\n\n");
}

export const ACCEPTANCE_CHAT_TEXT = {
  RIDER: 'Tài xế đã nhận chuyến và sẽ sớm liên hệ với bạn. Bạn cũng có thể liên hệ tài xế tại đây.',
  PARTNER: 'Tài xế đã nhận chuyến của công ty và sẽ sớm liên hệ điều phối viên phụ trách. Điều phối viên cũng có thể liên hệ tài xế tại đây.',
  DRIVER_RIDER: driverAcceptanceText('Gọi khách ngay sau khi nhận chuyến, chậm nhất trong 15 phút. Giới thiệu là tài xế GoViet247, xác nhận giờ và điểm đón, trao đổi lịch sự.'),
  DRIVER_PARTNER: driverAcceptanceText('Liên hệ điều phối viên ngay tại đây, chậm nhất trong 15 phút, để xác nhận giờ đón, điểm đón và yêu cầu phục vụ. Điều phối viên sẽ liên hệ khách.'),
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
