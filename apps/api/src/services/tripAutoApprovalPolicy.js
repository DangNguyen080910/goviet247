import {AUDIENCE_REGIONS} from '../shared/audienceFilters.js';

export const AUTO_APPROVAL_FIELDS = ['autoApproveNewTrips', 'autoApproveRequeuedTrips'];
export const autoApprovalField = source => source === 'NEW' ? AUTO_APPROVAL_FIELDS[0] : source === 'REQUEUE' ? AUTO_APPROVAL_FIELDS[1] : null;
const normalize = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().replace(/\s+/g,' ').trim();
export const approvalRegion = provinceCode => AUDIENCE_REGIONS.find(region => region.provinceCodes.includes(provinceCode)) || null;

// This screens specificity, not whether a house actually exists. Only canonical
// addresses returned by the server's map resolver can reach this policy.
export function addressSpecificity(address, evidence) {
  if (!evidence || normalize(evidence.address) !== normalize(address) || !approvalRegion(evidence.provinceCode) ||
      evidence.lat == null || evidence.lng == null || !Number.isFinite(Number(evidence.lat)) || !Number.isFinite(Number(evidence.lng)) ||
      Math.abs(Number(evidence.lat)) > 90 || Math.abs(Number(evidence.lng)) > 180) return {ok:false,reason:'Chưa xác minh được địa điểm và tỉnh/thành trên bản đồ.'};
  const text = normalize(address), first = text.split(',')[0].trim();
  if (/^(?:(?:tinh|thanh pho|tp\.?|quan|huyen|thi xa|phuong|xa|thi tran)\s|viet nam$)/.test(first)) {
    return {ok:false,reason:'Địa chỉ mới có tên khu vực, chưa có điểm đón/đến cụ thể.'};
  }
  if (/^\d+\s+thang\s+\d+\b/.test(first)) return {ok:false,reason:'Tên đường có dạng ngày/tháng nhưng chưa có số nhà hoặc địa điểm cụ thể.'};
  if (/^(?:so\s+)?\d+[a-z]?(?:[/.\-]\d+[a-z]?)*\s+[a-z]/.test(first)) return {ok:true,kind:'NUMBERED_ADDRESS'};
  if (/^(?:ap|thon|ban|buon|lang|xom|soc)\s+\S/.test(first) && /(?:^|,)\s*xa\s+\S/.test(text)) return {ok:true,kind:'RURAL_LOCALITY'};
  // A named map landmark works without a street number, including rural areas.
  // A road, commune or city alone is deliberately not treated as a landmark.
  const landmark = /\b(?:benh vien|phong kham|khach san|resort|san bay|ben xe|nha ga|chua|nha tho|truong|cong ty|khu cong nghiep|cho|sieu thi|cua hang|cay xang|uy ban|ubnd|toa nha|chung cu|nha hang|cong vien|khu du lich|cafe|coffee|homestay|hotel)\b/;
  if (evidence.name && landmark.test(first) && !/^(?:duong|quoc lo|tinh lo|ql\s*\d|dt\s*\d)\b/.test(first)) return {ok:true,kind:'NAMED_PLACE'};
  return {ok:false,reason:'Chưa đủ thông tin địa chỉ: cần số nhà, địa điểm cụ thể hoặc ấp/thôn kèm xã ở vùng quê.'};
}

export function assessAutoApproval(trip, evidence, now = new Date()) {
  if (!Number.isFinite(new Date(trip.pickupTime).getTime()) || new Date(trip.pickupTime) <= now) return {ok:false,reason:'Giờ đón đã tới hoặc không hợp lệ; cần điều hành kiểm tra.'};
  const stops = trip.stops?.length ? trip.stops : [trip.dropoffAddress];
  const hasExtraPickups = stops.some(stop => Number(stop?.seq) < 0);
  let pickupNumber = 1;
  let destinationNumber = 0;
  const points = [
    { address: trip.pickupAddress, label: hasExtraPickups ? 'Điểm đón 1' : 'Điểm đón' },
    ...stops.map(stop => ({
      address: typeof stop === 'string' ? stop : stop?.address,
      label: Number(stop?.seq) < 0 ? `Điểm đón ${++pickupNumber}` : `Điểm đến ${++destinationNumber}`,
    })),
  ];
  if (!Array.isArray(evidence) || evidence.length !== points.length) return {ok:false,reason:'Chưa xác minh đầy đủ điểm đón và các điểm đến.'};
  for (const [index, point] of points.entries()) {
    const result = addressSpecificity(point.address, evidence[index]);
    if (!result.ok) return {ok:false,reason:`${point.label}: ${result.reason}`};
  }
  const region = approvalRegion(evidence[0].provinceCode);
  return {ok:true,region:region.value,provinceCode:evidence[0].provinceCode};
}
