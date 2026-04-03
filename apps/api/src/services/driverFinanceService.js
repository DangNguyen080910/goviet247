// Path: goviet247/apps/api/src/services/driverFinanceService.js

/**
 * ===============================
 * DRIVER FINANCE SERVICE
 * ===============================
 * Tính toán toàn bộ snapshot tài chính cho 1 chuyến:
 * - commission
 * - VAT
 * - PIT
 * - tổng thuế
 * - số tiền cần giữ trong ví
 * - số tiền tài xế thực nhận
 *
 * NOTE:
 * - Tất cả số tiền đều làm tròn lên (ceil) để tránh thiếu tiền
 * - Input/Output đều là Number (VNĐ)
 */

// ===============================
// ENUM LOCAL (để tránh typo)
// ===============================
export const TAX_BASE_MODE = {
  GROSS_TRIP_AMOUNT: "GROSS_TRIP_AMOUNT",
  NET_AFTER_PLATFORM_COMMISSION: "NET_AFTER_PLATFORM_COMMISSION",
};

// ===============================
// HELPER
// ===============================

function toSafeNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return n;
}

function ceilMoney(value) {
  return Math.ceil(toSafeNumber(value));
}

function clampNonNegative(value) {
  return Math.max(0, toSafeNumber(value));
}

// ===============================
// CORE CALCULATION
// ===============================

export function calculateDriverFinanceSnapshot({
  totalPrice,
  commissionPercent,
  driverVatPercent,
  driverPitPercent,
  driverVatBaseMode,
  driverPitBaseMode,
}) {
  // ===== Normalize input =====
  const price = clampNonNegative(totalPrice);

  const commissionPct = toSafeNumber(commissionPercent);
  const vatPct = toSafeNumber(driverVatPercent);
  const pitPct = toSafeNumber(driverPitPercent);

  const vatMode =
    driverVatBaseMode || TAX_BASE_MODE.GROSS_TRIP_AMOUNT;

  const pitMode =
    driverPitBaseMode || TAX_BASE_MODE.GROSS_TRIP_AMOUNT;

  // ===== 1. Commission =====
  const commissionAmount = ceilMoney((price * commissionPct) / 100);

  // ===== 2. VAT BASE =====
  let vatBase = 0;

  if (vatMode === TAX_BASE_MODE.NET_AFTER_PLATFORM_COMMISSION) {
    vatBase = clampNonNegative(price - commissionAmount);
  } else {
    vatBase = price;
  }

  // ===== 3. PIT BASE =====
  let pitBase = 0;

  if (pitMode === TAX_BASE_MODE.NET_AFTER_PLATFORM_COMMISSION) {
    pitBase = clampNonNegative(price - commissionAmount);
  } else {
    pitBase = price;
  }

  // ===== 4. TAX =====
  const driverVatAmount = ceilMoney((vatBase * vatPct) / 100);
  const driverPitAmount = ceilMoney((pitBase * pitPct) / 100);

  const driverTaxTotal = driverVatAmount + driverPitAmount;

  // ===== 5. WALLET HOLD =====
  const requiredWalletAmount = commissionAmount + driverTaxTotal;

  // ===== 6. DRIVER RECEIVE =====
  const driverReceiveAmount = clampNonNegative(
    price - requiredWalletAmount
  );

  // ===== RETURN SNAPSHOT =====
  return {
    // base info
    totalPrice: price,

    // commission
    commissionPercent: commissionPct,
    commissionAmount,

    // VAT
    driverVatPercent: vatPct,
    driverVatBaseMode: vatMode,
    driverVatBaseAmount: vatBase,
    driverVatAmount,

    // PIT
    driverPitPercent: pitPct,
    driverPitBaseMode: pitMode,
    driverPitBaseAmount: pitBase,
    driverPitAmount,

    // tax total
    driverTaxTotal,

    // wallet
    requiredWalletAmount,

    // driver receive
    driverReceiveAmount,
  };
}