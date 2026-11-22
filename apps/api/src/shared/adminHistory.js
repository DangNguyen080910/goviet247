export const historySources = {RECORDED:'Lưu tại thời điểm thực hiện',WALLET:'Đối chiếu giao dịch ví',PENALTY:'Đối chiếu phạt huỷ',ARCHIVE:'Đối chiếu log phân công',CURRENT_TRIP:'Dữ liệu chuyến hiện tại',ADMIN_LOG:'Log xử lý cũ',PARTNER_LOG:'Nhật ký đối tác'};
export const tripEventTitles = {CREATED:'Tạo chuyến',APPROVED:'Duyệt và phát chuyến',RESENT:'Phát lại chuyến',RETURNED_TO_REVIEW:'Chuyển về chờ duyệt',STATUS_CHANGED:'Đổi trạng thái chuyến',TRIP_UPDATED:'Điều chỉnh thông tin chuyến',SCHEDULE_UPDATED:'Cập nhật giờ đón/giờ về',DISPATCHER_NOTE_UPDATED:'Cập nhật ghi chú gửi tài xế',WALLET_UPDATED:'Giao dịch ví liên quan chuyến',PARTNER_UPDATED:'Đối tác cập nhật chuyến',CANCELLED:'Huỷ chuyến',ACCEPTED:'Tài xế nhận chuyến',DRIVER_CANCELLED:'Huỷ do tài xế',CUSTOMER_CANCELLED:'Huỷ do khách hàng/đối tác',ADMIN_CANCELLED:'Admin xử lý huỷ chuyến',RELEASED:'Kết thúc lượt tài xế (log cũ)',PENALTY_RECORDED:'Ghi nhận phạt huỷ'};
const statuses={PENDING:'Chờ duyệt / chờ tài xế',ACCEPTED:'Chưa liên hệ khách',CONTACTED:'Chưa đón khách',IN_PROGRESS:'Đang hành trình',COMPLETED:'Hoàn thành',CANCELLED:'Đã huỷ'};
export function historyStatus(value){return statuses[value] || value || '—';}
export function historyActor(item){
  const role={ADMIN:'Admin',STAFF:'Nhân viên',DRIVER:'Tài xế',RIDER:'Khách hàng',CUSTOMER:'Khách hàng',PARTNER:'Đối tác',SYSTEM:'Hệ thống'}[item.actorRole];
  return role ? `${role}${item.actorName ? ` · ${item.actorName}` : ''}` : 'Dữ liệu cũ chưa lưu người thực hiện';
}
export function historyValue(value){
  if(value == null || value === '')return '—';
  if(Array.isArray(value))return value.length?value.map(historyValue).join('\n'):'—';
  if(typeof value==='object')return JSON.stringify(value);
  if(typeof value==='boolean')return value?'Có':'Không';
  if(typeof value==='string' && /^\d{4}-\d{2}-\d{2}T/.test(value))return historyTime(value);
  const labels={CAR_5:'Xe 5 chỗ',CAR_7:'Xe 7 chỗ',CAR_16:'Xe 16 chỗ',ONE_WAY:'Một chiều',ROUND_TRIP:'Khứ hồi',ANY:'Không yêu cầu',ELECTRIC:'Xe điện',GASOLINE:'Xe xăng'};
  return labels[value] || String(value);
}
export const historyResolutions = {PENALTY_AND_REVIEW:'Ghi phạt · Chuyển về chờ duyệt',REFUND_AND_REVIEW:'Hoàn ví · Chuyển về chờ duyệt',PENALTY_AND_CANCEL:'Ghi phạt · Huỷ chuyến',CUSTOMER_CANCEL_AND_REFUND:'Khách huỷ · Xử lý hoàn ví',CANCEL:'Huỷ chuyến'};
export function historyTime(value) {
  if (!value || !Number.isFinite(new Date(value).getTime())) return '—';
  return new Date(value).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit',day:'2-digit',month:'2-digit',year:'numeric'});
}
export function vietnamDay(offset = 0, now = Date.now()) {
  return new Date(now + 7*3600000 + offset*86400000).toISOString().slice(0,10);
}
export function historyDateInput(value) {return value.split('-').reverse().join('/');}
export function parseHistoryDateInput(value) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) throw new Error('Nhập ngày theo dạng dd/mm/yyyy.');
  const iso = `${match[3]}-${match[2]}-${match[1]}`;
  const date = new Date(`${iso}T00:00:00+07:00`);
  if (!Number.isFinite(date.getTime()) || vietnamDay(0,date.getTime()) !== iso) throw new Error('Ngày lọc không hợp lệ.');
  return iso;
}

export function historyEventColor(item){
  if(item.kind==='ACCEPTED' || item.toStatus==='COMPLETED')return '#15803d';
  if(['CANCELLED','DRIVER_CANCELLED','CUSTOMER_CANCELLED','ADMIN_CANCELLED','RELEASED'].includes(item.kind))return '#dc2626';
  if(['PENALTY_RECORDED','WALLET_UPDATED'].includes(item.kind))return '#b45309';
  return '#1976d2';
}
