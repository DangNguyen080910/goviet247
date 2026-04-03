// goviet247/apps/api/prisma/seed.mjs
import pkg from "@prisma/client";
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

async function main() {
  // Upsert để chạy nhiều lần không bị duplicate
  await prisma.pricingConfig.upsert({
    where: { carType: "CAR_5" },
    update: {
      baseFare: 150000,
      pricePerKm: 12000,
      pricePerHour: 30000,
      minFare: 300000,
      overnightFee: 300000,
      overnightTriggerKm: 600,
      overnightTriggerHours: 12,
      isActive: true,
    },
    create: {
      carType: "CAR_5",
      baseFare: 150000,
      pricePerKm: 12000,
      pricePerHour: 30000,
      minFare: 300000,
      overnightFee: 300000,
      overnightTriggerKm: 600,
      overnightTriggerHours: 12,
      isActive: true,
    },
  });

  await prisma.pricingConfig.upsert({
    where: { carType: "CAR_7" },
    update: {
      baseFare: 200000,
      pricePerKm: 14000,
      pricePerHour: 40000,
      minFare: 400000,
      overnightFee: 400000,
      overnightTriggerKm: 600,
      overnightTriggerHours: 12,
      isActive: true,
    },
    create: {
      carType: "CAR_7",
      baseFare: 200000,
      pricePerKm: 14000,
      pricePerHour: 40000,
      minFare: 400000,
      overnightFee: 400000,
      overnightTriggerKm: 600,
      overnightTriggerHours: 12,
      isActive: true,
    },
  });

  await prisma.pricingConfig.upsert({
    where: { carType: "CAR_16" },
    update: {
      baseFare: 350000,
      pricePerKm: 18000,
      pricePerHour: 50000,
      minFare: 700000,
      overnightFee: 600000,
      overnightTriggerKm: 600,
      overnightTriggerHours: 12,
      isActive: true,
    },
    create: {
      carType: "CAR_16",
      baseFare: 350000,
      pricePerKm: 18000,
      pricePerHour: 50000,
      minFare: 700000,
      overnightFee: 600000,
      overnightTriggerKm: 600,
      overnightTriggerHours: 12,
      isActive: true,
    },
  });

  console.log("✅ Seed PricingConfig done");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
