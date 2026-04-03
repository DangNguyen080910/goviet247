// Path: goviet247/apps/api/src/services/fareService.js

// Lưu ý: mọi log / message đều dùng tiếng Anh, chỉ comment mới dùng tiếng Việt
import prisma from "../utils/db.js";; // client Prisma (giống chỗ Đ đang dùng trong otpService)

/**
 * Hàm tiện ích: chuyển Decimal (Prisma) -> Number JS bình thường
 * Nếu value null/undefined thì trả về 0.
 */
function toNumber(value) {
  if (value == null) return 0;
  return Number(value);
}

/**
 * Lấy cấu hình giá cước đang áp dụng.
 * - Ưu tiên bản ghi FareConfig mới nhất (activeFrom desc).
 * - Nếu chưa có bản ghi nào trong DB thì fallback về defaultConfig.
 */
export async function getActiveFareConfig() {
  const config = await prisma.fareConfig.findFirst({
    orderBy: { activeFrom: "desc" },
  });

  if (!config) {
    // Fallback: giá cước mặc định khi chưa có config trong DB
    console.warn(
      "[fareService] No FareConfig found, using in-code default values"
    );

    return {
      baseFare: 12000, // VNĐ
      ratePerKm: 6000, // VNĐ/km
      ratePerMinute: 0,
      surchargeMultiplier: 1,
    };
  }

  // Chuyển Decimal -> Number để dễ tính toán
  return {
    baseFare: toNumber(config.baseFare),
    ratePerKm: toNumber(config.ratePerKm),
    ratePerMinute: toNumber(config.ratePerMinute),
    surchargeMultiplier:
      config.surchargeMultiplier != null
        ? toNumber(config.surchargeMultiplier)
        : 1,
  };
}

/**
 * Haversine formula – tính khoảng cách giữa 2 điểm (lat/lng) trên bề mặt Trái Đất.
 * Trả về đơn vị: km.
 */
export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  // Bán kính Trái Đất (km)
  const R = 6371;

  // Đổi độ -> radian
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const rLat1 = (lat1 * Math.PI) / 180;
  const rLat2 = (lat2 * Math.PI) / 180;

  // Công thức Haversine
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) *
      Math.sin(dLon / 2) *
      Math.cos(rLat1) *
      Math.cos(rLat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = R * c; // km

  // Làm tròn 2 chữ số thập phân cho đẹp
  return Math.round(distance * 100) / 100;
}

/**
 * Tính tiền cước dựa trên khoảng cách và cấu hình giá cước hiện tại.
 *
 * @param {number} distanceKm - quãng đường (km)
 * @returns {Promise<{ distanceKm: number, fare: number, breakdown: object }>}
 */
export async function calculateFare(distanceKm) {
  const config = await getActiveFareConfig();

  const baseFare = config.baseFare;
  const perKm = config.ratePerKm;
  const multiplier = config.surchargeMultiplier || 1;

  // Tiền trước khi nhân hệ số
  const rawFare = baseFare + distanceKm * perKm;

  // Áp dụng multiplier (ví dụ giờ cao điểm 1.2x)
  const finalFare = rawFare * multiplier;

  // Làm tròn tới đơn vị VNĐ (0 chữ số thập phân)
  const roundedFare = Math.round(finalFare);

  return {
    distanceKm,
    fare: roundedFare,
    breakdown: {
      baseFare,
      perKm,
      multiplier,
      rawFare,
      finalFare,
    },
  };
}

/**
 * Tính khoảng cách + giá cước dựa trên 4 tọa độ (pickup + dropoff).
 * Dùng cho API /trips/estimate sau này.
 */
export async function estimateFareFromCoordinates(
  pickupLat,
  pickupLng,
  dropoffLat,
  dropoffLng
) {
  const distanceKm = calculateDistanceKm(
    pickupLat,
    pickupLng,
    dropoffLat,
    dropoffLng
  );

  const result = await calculateFare(distanceKm);

  return result; // { distanceKm, fare, breakdown }
}
