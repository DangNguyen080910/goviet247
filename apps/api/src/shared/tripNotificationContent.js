// In-app and push notifications share wording, including bookings on behalf of others.
export function tripNotificationContent(trip, reason='') {
  const status=String(trip?.status||'').trim().toUpperCase();
  const code=String(trip?.id||'').slice(-8).toUpperCase();
  let title='Cập nhật chuyến đi', message='Chuyến vừa được cập nhật. Mở chi tiết chuyến để kiểm tra.';
  if(status==='PENDING' && ['DRIVER_CANCEL_TRIP','ADMIN_DRIVER_CANCEL_TO_REVIEW'].includes(String(reason).trim().toUpperCase())) {
    title='Đang tìm tài xế thay thế';message='Tài xế trước không thể tiếp tục chuyến. GoViet247 đang xử lý để tìm tài xế khác và sẽ thông báo khi có người nhận.';
  } else if(String(reason).trim().toUpperCase()==='ADMIN_VERIFY_TRIP') {
    title='Chuyến đã được duyệt';message='GoViet247 đang tìm tài xế phù hợp. Theo dõi thông báo và mục Liên hệ chuyến.';
  } else if(String(reason).trim().toUpperCase()==='DRIVER_ACCEPT_TRIP'||status==='ACCEPTED') {
    title='Đã có tài xế nhận chuyến';message='Mở Liên hệ chuyến để xác nhận lịch đón và trao đổi với tài xế.';
  } else if(status==='CONTACTED') {
    title='Đã xác nhận liên hệ';message='Tài xế đã xác nhận liên hệ. Mở Liên hệ chuyến nếu cần bổ sung thông tin đón khách.';
  } else if(status==='IN_PROGRESS') {
    title='Chuyến đi đã bắt đầu';message='Tài xế đã xác nhận đón khách. Chúc quý khách có hành trình an toàn.';
  } else if(status==='COMPLETED') {
    title='Chuyến đi đã hoàn thành';message='Cảm ơn quý khách đã đồng hành cùng GoViet247.';
  } else if(['CANCELLED','CANCELED'].includes(status)) {
    title='Chuyến đã hủy';message='Mở chi tiết chuyến để xem thông tin hủy. Liên hệ GoViet247 nếu cần hỗ trợ.';
  }
  return {title,message:`${code?'#'+code+' · ':''}${message}`};
}
