export const CHAT_ACTIVE_STATUSES = ['ACCEPTED', 'CONTACTED', 'IN_PROGRESS'];
export const CHAT_QUICK_REPLIES = {
  DRIVER: ['Tôi xác nhận nhận chuyến và sẽ đón đúng lịch đã đặt.', 'Tôi đã đến điểm đón.', 'Anh/chị vui lòng gửi vị trí.', 'Tôi sẽ phản hồi khi dừng xe an toàn.'],
  RIDER: ['Tôi xác nhận chuyến và sẽ có mặt tại điểm đón đúng giờ đã đặt.', 'Tôi đang ra.', 'Tôi đang ở điểm đón đã gửi.', 'Tôi cần hỗ trợ tìm xe.'],
  ADMIN: ['GoViet247 đang kiểm tra.', 'Anh/chị vui lòng xác nhận điểm đón.', 'Thông tin chuyến đã được cập nhật.']
};
export const CHAT_BOOKING_NOTICE = 'Vui lòng bật thông báo và mở mục Liên hệ chuyến trên GoViet247 để nhận tin nhắn, ghi âm và vị trí từ tài xế. Không liên hệ được, vui lòng nhờ GoViet247 hỗ trợ.';
export function chatCanSend(trip, actor) {
  return actor.role === 'ADMIN' || Boolean(trip.driverId) && CHAT_ACTIVE_STATUSES.includes(trip.status);
}
export function validateChatPayload(body) {
  const clientId = String(body.clientId || '');
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(clientId)) throw new Error('Mã tin nhắn không hợp lệ.');
  const kind = String(body.kind || 'TEXT');
  if (kind === 'TEXT') {
    const text = String(body.text || '').trim();
    if (!text || text.length > 2000) throw new Error('Tin nhắn cần từ 1 đến 2.000 ký tự.');
    assertNoContactNumber(text);
    return {
      clientId,
      kind,
      text
    };
  }
  if (kind === 'LOCATION') {
    const latitude = body.latitude,
      longitude = body.longitude;
    if (typeof latitude !== 'number' || typeof longitude !== 'number' || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new Error('Vị trí không hợp lệ.');
    assertNoContactNumber(body.locationLabel);
    return {
      clientId,
      kind,
      latitude,
      longitude,
      locationLabel: String(body.locationLabel || 'Vị trí được gửi').trim().slice(0, 300)
    };
  }
  throw new Error('Loại tin nhắn không hợp lệ.');
}

// Reject common phone-number formats without treating ordinary fares/times as phone numbers.
export function containsContactNumber(value) {
  const normalized = String(value || '').normalize('NFKC').replace(/[\u200b-\u200d\ufeff]/g, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  const candidates = normalized.match(/\+?\d(?:[\d\s()._\-–—/]*\d)?/g) || [];
  if (candidates.some(candidate => {
    const digits = candidate.replace(/\D/g, '');
    return /^(?:0[35789]\d{8}|02\d{9}|84[35789]\d{8}|842\d{9}|0084[35789]\d{8})$/.test(digits);
  })) return true;
  const words = {
    'khong': '0',
    'mot': '1',
    'hai': '2',
    'ba': '3',
    'bon': '4',
    'tu': '4',
    'nam': '5',
    'lam': '5',
    'sau': '6',
    'bay': '7',
    'tam': '8',
    'chin': '9'
  };
  const wordSequence = normalized.match(/(?:\b(?:khong|mot|hai|ba|bon|tu|nam|lam|sau|bay|tam|chin)\b[\s,._-]*){9,15}/g) || [];
  return wordSequence.some(sequence => {
    const digits = (sequence.match(/[a-z]+/g) || []).map(w => words[w] || '').join('');
    return /^(?:0[35789]\d{8}|84[35789]\d{8})$/.test(digits);
  });
}
export function assertNoContactNumber(value) {
  if (containsContactNumber(value)) throw Object.assign(new Error('Không được gửi số điện thoại cá nhân. Vui lòng liên hệ trong GoViet247 hoặc nhờ hỗ trợ.'), {code:'CHAT_CONTACT_BLOCKED'});
}

export const RIDER_CHAT_ENDED_NOTICE = 'Chuyến đã kết thúc hoặc đã huỷ. Nếu cần hỗ trợ, vui lòng liên hệ GoViet247 qua mục Hỗ trợ hoặc Góp ý.';
export function isRiderChatEnded(status) { return ['COMPLETED', 'CANCELLED'].includes(String(status || '').trim().toUpperCase()); }

// Older installed clients treat unknown kinds as locations; never send them IMAGE.
export function chatMessageForClient(message, supportsImages) {
  if (!message || message.kind !== 'IMAGE' || supportsImages) return message;
  return {...message, kind:'TEXT', text:message.deletedAt ? null : 'Hình ảnh trong chuyến. Vui lòng cập nhật ứng dụng hoặc mở GoViet247 trên Web để xem.'};
}
