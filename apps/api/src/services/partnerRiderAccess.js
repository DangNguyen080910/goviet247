// Only verified Rider phone variants are passed to these authorization predicates.
export function normalizePartnerPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (/^0[35789]\d{8}$/.test(digits)) return `+84${digits.slice(1)}`;
  if (/^84[35789]\d{8}$/.test(digits)) return `+${digits}`;
  return null;
}
export function partnerRiderAccessWhere(phones = []) {
  const canonical = [...new Set(phones.map(normalizePartnerPhone).filter(Boolean))];
  if (!canonical.length) return {id:'__no_partner_rider_access__'};
  const activeMember = {isActive:true,phone:{in:canonical}};
  return {partnerCompanyId:{not:null},partnerCompany:{isActive:true},OR:[
    {partnerCompany:{isActive:true,managementPhone:{in:canonical}}},
    {partnerCreatedBy:activeMember},
    {partnerCreatedById:null,partnerAssignedTo:activeMember},
  ]};
}
export async function getPartnerRiderContext(db, trip, phones) {
  if (!trip?.partnerCompanyId) return null;
  return db.trip.findFirst({where:{id:trip.id,...partnerRiderAccessWhere(phones)},include:{partnerCompany:true,partnerCreatedBy:true,partnerAssignedTo:true}});
}
export async function partnerParticipantPhones(db, trip) {
  const company=await db.partnerCompany.findUnique({where:{id:trip.partnerCompanyId}});
  if (!company?.isActive) return [];
  const memberId=trip.partnerCreatedById || trip.partnerAssignedToId;
  const member=memberId ? await db.partnerMember.findUnique({where:{id:memberId}}) : null;
  return [...new Set([normalizePartnerPhone(company.managementPhone),member?.isActive && member.companyId===company.id ? normalizePartnerPhone(member.phone):null].filter(Boolean))];
}
