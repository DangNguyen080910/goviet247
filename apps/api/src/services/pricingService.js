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
  } = input;

  // 1) Lấy config
  const config = await prisma.pricingConfig.findFirst({
    where: { carType, isActive: true },
  });

  if (!config) {
    return {
      ok: false,
      message: "Không tìm thấy cấu hình giá cho loại xe này.",
    };
  }

  // 2) Parse thời gian
  const pickup = pickupTime ? new Date(pickupTime) : null;
  if (!pickup || Number.isNaN(pickup.getTime())) {
    return { ok: false, message: "pickupTime không hợp lệ." };
  }

  // 3) Validate distance
  const km = Number(distanceKm);
  if (!Number.isFinite(km) || km < 0) {
    return { ok: false, message: "distanceKm không hợp lệ." };
  }

  // 4) Load config
  const baseFare = Number(config.baseFare);
  const pricePerKm = Number(config.pricePerKm);
  const pricePerHour = Number(config.pricePerHour);
  const minFare = Number(config.minFare);
  const overnightFee = Number(config.overnightFee);
  const triggerKm = Number(config.overnightTriggerKm);
  const triggerHours = Number(config.overnightTriggerHours);

  const distanceCost = Math.round(km * pricePerKm);

  // 5) time/overnight
  let overnightCount = 0;
  let overnightCost = 0;

  let totalMinutes = 0;
  let waitMinutes = 0;
  let waitCost = 0;

  if (direction === "ROUND_TRIP") {
    // cần returnTime
    const rt = returnTime ? new Date(returnTime) : null;
    if (!rt || Number.isNaN(rt.getTime())) {
      return { ok: false, message: "returnTime không hợp lệ cho chuyến khứ hồi." };
    }
    if (rt.getTime() <= pickup.getTime()) {
      return { ok: false, message: "returnTime phải lớn hơn pickupTime." };
    }

    // overnight theo số đêm (khác ngày theo VN)
    overnightCount = diffCalendarDaysVN(pickup, rt);
    overnightCost = overnightCount * overnightFee;

    // tổng phút giữ xe
    totalMinutes = Math.round((rt.getTime() - pickup.getTime()) / 60000);

    const dm = Number(driveMinutes);
    if (!Number.isFinite(dm) || dm < 0) {
      return { ok: false, message: "driveMinutes không hợp lệ cho chuyến khứ hồi." };
    }

    // waitMinutes luôn tính để debug/hiển thị nội bộ
    waitMinutes = Math.max(0, totalMinutes - dm);

    // ✅ RULE MỚI:
    // - Nếu có qua đêm (overnightCount > 0) => KHÔNG tính waitCost
    // - Nếu không qua đêm => tính waitCost theo pricePerHour như cũ
    if (overnightCount > 0) {
      waitCost = 0;
    } else {
      const waitHours = waitMinutes / 60;
      waitCost = Math.round(waitHours * pricePerHour);
    }
  } else if (direction === "ONE_WAY") {
    // ONE_WAY: overnight kích hoạt theo trigger km hoặc trigger giờ (driveMinutes)
    const dm = driveMinutes == null ? null : Number(driveMinutes);
    const driveHours = dm != null && Number.isFinite(dm) ? dm / 60 : 0;

    const hitKm = km >= triggerKm;
    const hitHours = driveHours >= triggerHours;

    overnightCount = hitKm || hitHours ? 1 : 0;
    overnightCost = overnightCount * overnightFee;
  } else {
    return { ok: false, message: "direction không hợp lệ." };
  }

  // 6) Tổng, min, làm tròn
  let rawTotal = baseFare + distanceCost + waitCost + overnightCost;

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

      // time meta
      totalMinutes,
      waitMinutes,

      overnightCount,

      // breakdown (admin/debug)
      baseFare,
      pricePerKm,
      pricePerHour,
      minFare,
      overnightFee,
      triggerKm,
      triggerHours,

      distanceCost,
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
  });

  if (!result.ok) {
    throw new Error(result.message);
  }

  const d = result.data;

  return {
    distanceKm: d.distanceKm,
    basePricePerKm: d.pricePerKm, // map sang field Trip đang lưu
    holidayFactor: 1, // MVP: không dùng holiday
    directionFactor: 1, // MVP: không dùng factor
    totalPrice: d.finalPrice,
  };
}