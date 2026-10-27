import { buildDestinationSnapshot, destinationSignature } from "./destinationService.js";
import { CAR_TYPE_UNAVAILABLE_MESSAGE } from "./carAvailability.js";
// Path: goviet247/apps/api/src/services/pricingService.js
import pkg from "@prisma/client";
import { parseTripTime } from "../utils/tripTime.js";
import { calculateHolidaySurcharge } from "./holidaySurcharge.js";
import { calculateWaitingTime, calculateTieredWaitingCost } from "./waitingPricing.js";
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

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
      const pricePerWaitHour = item?.pricePerWaitHour == null ? null : Number(item.pricePerWaitHour);

      if (!Number.isFinite(from) || from < 0) return null;
      if (to !== null && (!Number.isFinite(to) || to <= from)) return null;
      if (!Number.isFinite(tierPricePerKm) || tierPricePerKm < 0) return null;
      if (pricePerWaitHour !== null && (!Number.isFinite(pricePerWaitHour) || pricePerWaitHour < 0)) return null;

      return {
        from,
        to,
        pricePerKm: tierPricePerKm,
        pricePerWaitHour,
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
 *   - Hourly waiting uses the total trip distance tier.
 *   - Qualifying night waiting is covered by the overnight fee, not hourly fees.
 */
export async function quotePrice(input, db = prisma) {
  const {
    carType,
    direction,
    pickupTime,
    returnTime,
    distanceKm,
    driveMinutes,
    outboundDriveMinutes,
    fuelPreference = "ANY",
  } = input;

  const config = await db.pricingConfig.findFirst({
    where: { carType, isActive: true },
  });

  if (!config) {
    return {
      ok: false,
      message: CAR_TYPE_UNAVAILABLE_MESSAGE,
      status: 409,
    };
  }

  const pickup = parseTripTime(pickupTime);
  if (!pickup || Number.isNaN(pickup.getTime())) {
    return { ok: false, message: "pickupTime không hợp lệ." };
  }

  const km = Number(distanceKm);
  if (!Number.isFinite(km) || km < 0) {
    return { ok: false, message: "distanceKm không hợp lệ." };
  }

  const baseFare = Number(config.baseFare);
  const pricePerKm = Number(config.pricePerKm);
  let pricePerHour = Number(config.pricePerHour);
  const minFare = Number(config.minFare);
  const overnightFee = Number(config.overnightFee);
  const gasolineSurchargePercent = Number(
    config.gasolineSurchargePercent || 0,
  );
  const triggerKm = Number(config.overnightTriggerKm);
  const triggerHours = Number(config.overnightTriggerHours);

  const { distanceCost, appliedKmTiers, usedTierPricing } =
    calculateTieredDistanceCost(km, config.kmTiers);

  const finalDistanceCost = usedTierPricing
    ? distanceCost
    : Math.round(km * pricePerKm);

  const serviceConfig = db.tripConfig ? await db.tripConfig.findFirst({ orderBy:{id:"asc"} }) : null;
  let destinationService;
  try { destinationService = buildDestinationSnapshot(serviceConfig?.destinationServiceConfig, input); }
  catch (error) { return {ok:false, message:error.message, status:error.status || 400}; }
  let overnightCount = 0;
  let overnightCost = 0;

  let totalMinutes = 0;
  let waitMinutes = 0;
  let freeWaitingMinutes = 0;
  let billableWaitMinutes = 0;
  let waitCost = 0;
  let waitingDetails = {};

  if (direction === "ROUND_TRIP") {
    const rt = parseTripTime(returnTime);
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

    totalMinutes = Math.round((rt.getTime() - pickup.getTime()) / 60000);
    const waitingTime = calculateWaitingTime(
      new Date(estimatedArrivalAtDestinationMs), rt, config.roundTripWaitingConfig, destinationService.sessions,
    );
    const waitingPrice = calculateTieredWaitingCost(
      km, waitingTime.billableWaitHours, normalizeKmTiers(config.kmTiers), pricePerHour,
      distance => {
        const result = calculateTieredDistanceCost(distance, config.kmTiers);
        return result.usedTierPricing ? result.distanceCost : Math.round(distance * pricePerKm);
      },
    );
    ({ waitMinutes, freeWaitingMinutes, billableWaitMinutes, overnightCount } = waitingTime);
    ({ waitCost, pricePerHour } = waitingPrice);
    overnightCost = overnightCount * overnightFee;
    waitingDetails = { ...waitingTime, ...waitingPrice };
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

  const priceBeforeFuelSurcharge = rawTotal;
  const fuelSurchargePercent =
    fuelPreference === "GASOLINE" ? gasolineSurchargePercent : 0;
  const fuelSurchargeAmount = Math.round(
    priceBeforeFuelSurcharge * (fuelSurchargePercent / 100),
  );
  // Both surcharges use the same fare base; never compound one surcharge on another.
  const holidaySurcharge = calculateHolidaySurcharge(config, pickup, priceBeforeFuelSurcharge);
  const holidaySurchargePercent = holidaySurcharge?.percent || 0;
  const holidaySurchargeAmount = holidaySurcharge?.amount || 0;
  rawTotal = priceBeforeFuelSurcharge + fuelSurchargeAmount + holidaySurchargeAmount;

  const roundedTotal = roundTo10k(rawTotal) + destinationService.fee;
  if (!Number.isSafeInteger(roundedTotal) || roundedTotal > 2147483647) return {ok:false,status:400,message:"Giá chuyến vượt giới hạn cho phép. Vui lòng liên hệ GoViet247."};
  rawTotal += destinationService.fee;

  return {
    ok: true,
    message: "Tính giá thành công.",
    data: {
      destinationService,
      destinationServiceSignature: destinationSignature(destinationService),
      carType,
      fuelPreference,
      direction,
      distanceKm: km,

      totalMinutes,
      ...waitingDetails,
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
      priceBeforeFuelSurcharge,
      gasolineSurchargePercent,
      fuelSurchargePercent,
      fuelSurchargeAmount,
      holidaySurcharge,
      holidaySurchargePercent,
      holidaySurchargeAmount,
      holidaySurchargeDescription: holidaySurcharge?.description || "",

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
  fuelPreference = "ANY",
  destinationServiceDates, destinationAnchorAddress,
}) {
  const pickupIso =
    pickupTime instanceof Date ? pickupTime.toISOString() : pickupTime;

  const returnIso =
    returnTime instanceof Date ? returnTime.toISOString() : returnTime;

  const result = await quotePrice({
    destinationServiceDates, destinationAnchorAddress,
    carType,
    direction,
    pickupTime: pickupIso,
    returnTime: returnIso,
    distanceKm,
    driveMinutes,
    outboundDriveMinutes,
    fuelPreference,
  });

  if (!result.ok) {
    throw Object.assign(new Error(result.message), { status: result.status || 400 });
  }

  const d = result.data;

  return {
    destinationService: d.destinationService,
    destinationServiceSignature: d.destinationServiceSignature,
    distanceKm: d.distanceKm,
    basePricePerKm: d.pricePerKm,
    holidayFactor: 1 + d.holidaySurchargePercent / 100,
    holidaySurcharge: d.holidaySurcharge || undefined,
    directionFactor: 1,
    totalPrice: d.finalPrice,
  };
}
