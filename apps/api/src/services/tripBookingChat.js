export const BOOKING_CHAT_TEXT = {
  RIDER: 'Chuyến của bạn đang chờ GoViet247 duyệt. Bạn vui lòng đợi trong giây lát nhé. Nếu cần bổ sung yêu cầu hoặc hỗ trợ về chuyến, hãy nhắn ngay tại đây. Bạn chỉ có thể tự hủy khi chuyến còn chờ duyệt; sau khi duyệt, vui lòng nhắn GoViet247 để được hỗ trợ.',
  PARTNER: 'Chuyến của công ty đang chờ GoViet247 duyệt. Anh/chị vui lòng đợi trong giây lát nhé. Nếu cần bổ sung yêu cầu hoặc hỗ trợ về chuyến, hãy nhắn ngay tại đây. Chỉ được tự hủy khi chuyến còn chờ duyệt; sau khi duyệt, vui lòng nhắn GoViet247 để được hỗ trợ.',
};
export async function createBookingChatNotice(tx, trip) {
  const audience = trip.partnerCompanyId ? 'PARTNER' : 'RIDER';
  return tx.tripChatMessage.createMany({data:[{tripId:trip.id,senderId:'goviet247-system',senderRole:'SYSTEM',
    senderLabel:'Hệ thống GoViet247',kind:'TEXT',audience,clientId:'booking_created',text:BOOKING_CHAT_TEXT[audience],createdAt:trip.createdAt}],skipDuplicates:true});
}
