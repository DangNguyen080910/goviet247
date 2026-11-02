export const CAR_TYPES = ["CAR_5", "CAR_7", "CAR_16"];
export const CAR_TYPE_UNAVAILABLE_MESSAGE = "Loại xe này đang tạm ngừng nhận đặt. Vui lòng chọn loại xe khác.";

export async function assertCarTypeBookable(db, carType) {
  if (!CAR_TYPES.includes(carType)) throw Object.assign(new Error("Loại xe không hợp lệ."), { status: 400 });
  const config = await db.pricingConfig.findUnique({ where: { carType }, select: { isActive: true } });
  if (!config?.isActive) throw Object.assign(new Error(CAR_TYPE_UNAVAILABLE_MESSAGE), { status: 409 });
}

// Serialize the final booking check with an admin toggle of this pricing row.
// The shared row lock is held through trip creation, so a completed toggle cannot be bypassed by an old quote.
export async function createBookableTrip(db, data) {
  return db.$transaction(async tx => {
    await tx.$queryRawUnsafe('SELECT "carType" FROM "PricingConfig" WHERE "carType"::text = $1 FOR SHARE', data.carType);
    await assertCarTypeBookable(tx, data.carType);
    const {partnerStops, partnerAuditData, partnerSessionVersion, ...tripData} = data;
    if (tripData.partnerCompanyId) {
      await tx.$queryRawUnsafe('SELECT "id" FROM "PartnerCompany" WHERE "id" = $1 FOR SHARE', tripData.partnerCompanyId);
      const company = await tx.partnerCompany.findUnique({where:{id:tripData.partnerCompanyId}});
      if (!company?.isActive) throw Object.assign(new Error("Công ty đã bị khóa."), {status:409});
    }
    if (tripData.partnerCompanyId) {
      const assigned=await tx.partnerMember.findUnique({where:{id:tripData.partnerAssignedToId}});
      if(!assigned?.isActive || assigned.companyId!==tripData.partnerCompanyId) throw Object.assign(new Error("Điều phối viên không còn hoạt động."),{status:409});
      if(tripData.partnerCreatedById) {
        const creator=await tx.partnerMember.findUnique({where:{id:tripData.partnerCreatedById}});
        if(!creator?.isActive || creator.mustChangePassword || creator.sessionVersion!==partnerSessionVersion) throw Object.assign(new Error("Phiên đăng nhập đã thay đổi. Vui lòng đăng nhập lại."),{status:409});
      }
    }
    const trip = await tx.trip.create({data:tripData});
    if (partnerStops) await tx.tripStop.createMany({data:partnerStops.map((address,i)=>({tripId:trip.id,seq:i+1,address}))});
    if (partnerAuditData) await tx.partnerAuditLog.create({data:{...partnerAuditData,targetId:trip.id}});
    return trip;
  });
}
