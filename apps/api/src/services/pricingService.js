// Path: goviet247/apps/api/src/services/pricingService.js
import pkg from "@prisma/client";
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

/**
 * Lấy YYYY-MM-DD theo timezone Asia/Ho_Chi_Minh để tính "khác ngày" chuẩn VN
 */
function getYmdInVN(date) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(date);
}

/**
 * Tính số ngày chênh theo lịch (calendar days) dựa trên VN timezone
 * Ví dụ: 2026-03-01 -> 2026-03-03 = 2
 */
function diffCalendarDaysVN(startDate, endDate) {
  const s = getYmdInVN(startDate);
  const e = getYmdInVN(endDate);

  const [sy, sm, sd] = s.split("-").map(Number);
  const [ey, em, ed] = e.split("-").map(Number);

  const sUtc = Date.UTC(sy, sm - 1, sd);
  const eUtc = Date.UTC(ey, em - 1, ed);

  const diffMs = eUtc - sUtc;
  return Math.max(0, Math.floor(diffMs / 86400000));
}

function roundTo10k(vnd) {
  return Math.round(vnd / 10000) * 10000;
}

function normalizeKmTiers(rawKmTiers) {
  if (!Array.isArray(rawKmTiers)) return [];

  return rawKmTiers
    .map((item) => {
      const from = Number(item?.from);
      const to = item?.to == null || item?.to === "" ? null : Number(item?.to);
      const tierPricePerKm = Number(item?.pricePerKm);

      if (!Number.isFinite(from) || from < 0) return null;
      if (to !== null && (!Number.isFinite(to) || to <= from)) return null;
      if (!Number.isFinite(tierPricePerKm) || tierPricePerKm < 0) return null;

      return {
        from,
        to,
        pricePerKm: tierPricePerKm,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.from - b.from);
}

function calculateTieredDistanceCost(distanceKm, rawKmTiers) {
  const km = Number(distanceKm);
  if (!Number.isFinite(km) || km <= 0) {
    return {
      distanceCost: 0,
      appliedKmTiers: [],
      usedTierPricing: false,
    };
  }

  const kmTiers = normalizeKmTiers(rawKmTiers);
  if (!kmTiers.length) {
    return {
      distanceCost: 0,
      appliedKmTiers: [],
      usedTierPricing: false,
    };
  }

  let totalCost = 0;
  const appliedKmTiers = [];

  for (const tier of kmTiers) {
    const tierStart = tier.from;
    const tierEnd = tier.to == null ? Infinity : tier.to;

    if (km <= tierStart) {
      continue;
    }

    const usedKm = Math.max(0, Math.min(km, tierEnd) - tierStart);
    if (usedKm <= 0) {
      continue;
    }

    const tierCost = Math.round(usedKm * tier.pricePerKm);
    totalCost += tierCost;

    appliedKmTiers.push({
      from: tier.from,
      to: tier.to,
      pricePerKm: tier.pricePerKm,
      usedKm,
      tierCost,
    });
  }

  return {
    distanceCost: totalCost,
    appliedKmTiers,
    usedTierPricing: appliedKmTiers.length > 0,
  };
}

/**
 * Quote giá theo PricingConfig (DB là nguồn sự thật)
 * - ONE_WAY: base + km*perKm + overnight (nếu vượt trigger)
 * - ROUND_TRIP:
 *   - nếu KHÔNG qua đêm: base + km*perKm + wait*perHour
 *   - nếu CÓ qua đêm: base + km*perKm + overnightFee (KHÔNG tính waitCost)
 */
export async function quotePrice(input) {
  const {
    carType,
    direction,
    pickupTime,
    returnTime,
    distanceKm,
    driveMinutes,
    outboundDriveMinutes,
  } = input;

  const config = await prisma.pricingConfig.findFirst({
    where: { carType, isActive: true },
  });

  if (!config) {
    return {
      ok: false,
      message: "Không tìm thấy cấu hình giá cho loại xe này.",
    };
  }

  const pickup = pickupTime ? new Date(pickupTime) : null;
  if (!pickup || Number.isNaN(pickup.getTime())) {
    return { ok: false, message: "pickupTime không hợp lệ." };
  }

  const km = Number(distanceKm);
  if (!Number.isFinite(km) || km < 0) {
    return { ok: false, message: "distanceKm không hợp lệ." };
  }

  const baseFare = Number(config.baseFare);
  const pricePerKm = Number(config.pricePerKm);
  const pricePerHour = Number(config.pricePerHour);
  const minFare = Number(config.minFare);
  const overnightFee = Number(config.overnightFee);
  const triggerKm = Number(config.overnightTriggerKm);
  const triggerHours = Number(config.overnightTriggerHours);

  const { distanceCost, appliedKmTiers, usedTierPricing } =
    calculateTieredDistanceCost(km, config.kmTiers);

  const finalDistanceCost = usedTierPricing
    ? distanceCost
    : Math.round(km * pricePerKm);

  let overnightCount = 0;
  let overnightCost = 0;

  let totalMinutes = 0;
  let waitMinutes = 0;
  let freeWaitingMinutes = 0;
  let billableWaitMinutes = 0;
  let waitCost = 0;

  if (direction === "ROUND_TRIP") {
    const rt = returnTime ? new Date(returnTime) : null;
    if (!rt || Number.isNaN(rt.getTime())) {
      return {
        ok: false,
        message: "returnTime không hợp lệ cho chuyến khứ hồi.",
      };
    }
    if (rt.getTime() <= pickup.getTime()) {
      return { ok: false, message: "returnTime phải lớn hơn pickupTime." };
    }

    const outboundMinutes = Number(outboundDriveMinutes);
    if (!Number.isFinite(outboundMinutes) || outboundMinutes < 0) {
      return {
        ok: false,
        message: "outboundDriveMinutes không hợp lệ cho chuyến khứ hồi.",
      };
    }

    const totalDriveMinutes = Number(driveMinutes);
    if (!Number.isFinite(totalDriveMinutes) || totalDriveMinutes < 0) {
      return {
        ok: false,
        message: "driveMinutes không hợp lệ cho chuyến khứ hồi.",
      };
    }

    const estimatedArrivalAtDestinationMs =
      pickup.getTime() + outboundMinutes * 60000;

    if (rt.getTime() < estimatedArrivalAtDestinationMs) {
      return {
        ok: false,
        message:
          "Giờ quay về không hợp lệ. Vui lòng chọn giờ quay về sau khi xe dự kiến đã tới điểm cuối.",
      };
    }

    overnightCount = diffCalendarDaysVN(pickup, rt);
    overnightCost = overnightCount * overnightFee;

    totalMinutes = Math.round((rt.getTime() - pickup.getTime()) / 60000);

    waitMinutes = Math.max(
      0,
      Math.round((rt.getTime() - estimatedArrivalAtDestinationMs) / 60000),
    );

    if (overnightCount > 0) {
      freeWaitingMinutes = 0;
      billableWaitMinutes = 0;
      waitCost = 0;
    } else {
      freeWaitingMinutes = 60;
      billableWaitMinutes = Math.max(0, waitMinutes - freeWaitingMinutes);

      const waitHours = Math.ceil(billableWaitMinutes / 60);
      waitCost = waitHours * pricePerHour;
    }
  } else if (direction === "ONE_WAY") {
    const dm = driveMinutes == null ? null : Number(driveMinutes);
    const driveHours = dm != null && Number.isFinite(dm) ? dm / 60 : 0;

    const hitKm = km >= triggerKm;
    const hitHours = driveHours >= triggerHours;

    overnightCount = hitKm || hitHours ? 1 : 0;
    overnightCost = overnightCount * overnightFee;
  } else {
    return { ok: false, message: "direction không hợp lệ." };
  }

  let rawTotal = baseFare + finalDistanceCost + waitCost + overnightCost;

  let minApplied = false;
  if (rawTotal < minFare) {
    rawTotal = minFare;
    minApplied = true;
  }

  const roundedTotal = roundTo10k(rawTotal);

  return {
    ok: true,
    message: "Tính giá thành công.",
    data: {
      carType,
      direction,
      distanceKm: km,

      totalMinutes,
      waitMinutes,
      freeWaitingMinutes,
      billableWaitMinutes,

      overnightCount,

      baseFare,
      pricePerKm,
      pricePerHour,
      minFare,
      overnightFee,
      triggerKm,
      triggerHours,

      distanceCost: finalDistanceCost,
      appliedKmTiers,
      usedTierPricing,
      waitCost,
      overnightCost,

      minApplied,
      roundingApplied: roundedTotal !== rawTotal,

      rawTotal,
      finalPrice: roundedTotal,
    },
  };
}

/**
 * ✅ Wrapper tương thích cho flow cũ (tripPublicController.js)
 * Giờ calculateTripPrice sẽ dựa trên quotePrice (engine mới).
 *
 * Trả về đúng shape mà tripPublicController đang cần:
 * - totalPrice
 * - basePricePerKm
 * - holidayFactor
 * - directionFactor
 */
export async function calculateTripPrice({
  carType,
  direction,
  distanceKm,
  pickupTime,
  returnTime,
  driveMinutes,
  outboundDriveMinutes,
}) {
  const pickupIso =
    pickupTime instanceof Date ? pickupTime.toISOString() : pickupTime;

  const returnIso =
    returnTime instanceof Date ? returnTime.toISOString() : returnTime;

  const result = await quotePrice({
    carType,
    direction,
    pickupTime: pickupIso,
    returnTime: returnIso,
    distanceKm,
    driveMinutes,
    outboundDriveMinutes,
  });

  if (!result.ok) {
    throw new Error(result.message);
  }

  const d = result.data;

  return {
    distanceKm: d.distanceKm,
    basePricePerKm: d.pricePerKm,
    holidayFactor: 1,
    directionFactor: 1,
    totalPrice: d.finalPrice,
  };
}
