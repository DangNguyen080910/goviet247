import { prisma } from "../utils/db.js";

const DEFAULT_TRIP_CONFIG = {
  maxStops: 10,
  minDistanceKm: 10,
  maxDistanceKm: 2000,
  quoteExpireSeconds: 120,
};

export async function getEffectiveTripConfig() {
  return (
    (await prisma.tripConfig.findFirst({ orderBy: { id: "asc" } })) ||
    DEFAULT_TRIP_CONFIG
  );
}

export async function validateTripDistance(distanceKm) {
  const value = Number(distanceKm);
  const config = await getEffectiveTripConfig();

  if (!Number.isFinite(value)) {
    return { ok: false, config, message: "Quãng đường không hợp lệ." };
  }

  if (value < Number(config.minDistanceKm)) {
    return {
      ok: false,
      config,
      message: `Quãng đường phải tối thiểu ${config.minDistanceKm} km.`,
    };
  }

  if (value > Number(config.maxDistanceKm)) {
    return {
      ok: false,
      config,
      message: `Quãng đường không được vượt quá ${config.maxDistanceKm} km.`,
    };
  }

  return { ok: true, config };
}
