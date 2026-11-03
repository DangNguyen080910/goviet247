import { normalizePartnerPhone } from './partnerRiderAccess.js';
import { getVerifiedRiderPhoneVariants } from './riderTripAccess.js';

export async function riderBookingCompanies(db, userId) {
  const phones=[...new Set((await getVerifiedRiderPhoneVariants(db,userId)).map(normalizePartnerPhone).filter(Boolean))];
  if (!phones.length) return [];
  return db.partnerCompany.findMany({where:{isActive:true,OR:[{managementPhone:{in:phones}},{members:{some:{isActive:true,phone:{in:phones}}}}]},orderBy:[{name:'asc'},{id:'asc'}],select:{id:true,name:true}});
}
export async function resolveRiderCompanyBooking(db,userId,companyId) {
  const phones=[...new Set((await getVerifiedRiderPhoneVariants(db,userId)).map(normalizePartnerPhone).filter(Boolean))];
  const company=phones.length ? await db.partnerCompany.findFirst({where:{id:companyId,isActive:true,OR:[{managementPhone:{in:phones}},{members:{some:{isActive:true,phone:{in:phones}}}}]}}):null;
  if(!company) throw Object.assign(new Error('Quyền công ty đã thay đổi. Vui lòng chọn lại hình thức đặt chuyến.'),{status:409});
  const member=await db.partnerMember.findFirst({where:{companyId,isActive:true,phone:{in:phones}},orderBy:{id:'asc'}});
  const assigned=member;
  if(!assigned) throw Object.assign(new Error('Vui lòng cập nhật số di động của tài khoản Admin công ty trùng với số quản lý trước khi đặt trên Rider.'),{status:409});
  return {company,member,assigned,bookerName:member?.displayName || company.managementName,bookerPhone:member?.phone || company.managementPhone};
}
