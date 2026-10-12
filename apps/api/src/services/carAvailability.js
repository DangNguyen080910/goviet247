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
    return tx.trip.create({ data });
  });
}
