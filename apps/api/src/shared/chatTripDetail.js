import {tripRoutePoints} from './tripRoute.js';
// Deliberately allowlisted: no rider/Partner phone, internal notes, driver contact or payment secrets.
export function chatTripSummary(trip,stops=[]) {
  return {id:trip.id,status:trip.status,isVerified:Boolean(trip.isVerified || trip.verifiedAt),
    pickupAddress:trip.pickupAddress,dropoffAddress:trip.dropoffAddress,stops:stops.map(stop=>({address:stop.address})),
    pickupTime:trip.pickupTime,returnTime:trip.returnTime,direction:trip.direction,carType:trip.carType,
    distanceKm:trip.distanceKm,totalPrice:trip.totalPrice,partnerCompanyName:trip.partnerCompanyName || null};
}
export function chatTripDetailRows(trip) {
  const statuses={PENDING:trip.isVerified?'Chờ tài xế nhận':'Chờ duyệt',ACCEPTED:'Tài xế đã nhận',CONTACTED:'Đã liên hệ',IN_PROGRESS:'Đang thực hiện',COMPLETED:'Hoàn thành',CANCELLED:'Đã hủy'};
  const time=value=>value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}) : '—';
  const rows=[['Mã chuyến',String(trip.id)],['Trạng thái',statuses[trip.status] || trip.status],['Giờ đón',time(trip.pickupTime)],['Loại chuyến',trip.direction==='ROUND_TRIP'?'Khứ hồi':'Một chiều'],['Loại xe',({CAR_5:'Xe 5 chỗ',CAR_7:'Xe 7 chỗ',CAR_16:'Xe 16 chỗ'})[trip.carType] || trip.carType || '—']];
  if(trip.returnTime)rows.push(['Giờ về',time(trip.returnTime)]);
  if(trip.partnerCompanyName)rows.push(['Đối tác',trip.partnerCompanyName]);
  for(const point of tripRoutePoints(trip)) rows.push([point.label,point.address]);
  if(trip.distanceKm!=null)rows.push(['Quãng đường',`${Number(trip.distanceKm).toLocaleString('vi-VN')} km`]);
  if(trip.totalPrice!=null)rows.push(['Giá chuyến',`${Number(trip.totalPrice).toLocaleString('vi-VN')} đ`]);
  return rows;
}

export function chatConversationRoute(conversation) {
  const pickup=String(conversation?.pickupAddress || '').trim();
  const dropoff=String(conversation?.dropoffAddress || '').trim();
  return pickup && dropoff ? `${pickup} → ${dropoff}` : pickup || dropoff;
}
