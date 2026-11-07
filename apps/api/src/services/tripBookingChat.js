export const BOOKING_CHAT_TEXT = {
  RIDER: 'Chuyến của bạn đang chờ GoViet247 duyệt. Mở Liên hệ chuyến để nhắn GoViet247 khi cần bổ sung yêu cầu hoặc hỗ trợ. Bạn chỉ có thể tự hủy khi chuyến còn chờ duyệt; sau khi duyệt, vui lòng nhắn GoViet247 để được hỗ trợ.',
  PARTNER: 'Chuyến của công ty đang chờ GoViet247 duyệt. Mở Liên hệ chuyến để nhắn GoViet247 khi cần bổ sung yêu cầu hoặc hỗ trợ. Chỉ được tự hủy khi chuyến còn chờ duyệt; sau khi duyệt, vui lòng nhắn GoViet247 để được hỗ trợ.',
};
export async function createBookingChatNotice(tx, trip) {
  const audience = trip.partnerCompanyId ? 'PARTNER' : 'RIDER';
  return tx.tripChatMessage.createMany({data:[{tripId:trip.id,senderId:'goviet247-system',senderRole:'SYSTEM',
    senderLabel:'Hệ thống GoViet247',kind:'TEXT',audience,clientId:'booking_created',text:BOOKING_CHAT_TEXT[audience],createdAt:trip.createdAt}],skipDuplicates:true});
}
