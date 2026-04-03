// Path: goviet247/apps/api/src/services/pendingWatcher.js
/* eslint-disable no-console */
import { sendSms } from "./smsService.js";

const watcherRuntime = {
  io: null,
  prisma: null,
  logger: console,
  timer: null,
  running: false,
  intervalSec: 60,
};

function getEnvInt(name, def) {
  const raw = process.env[name];
  const n = raw ? parseInt(raw, 10) : def;
  return Number.isFinite(n) ? n : def;
}

function parsePhoneCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, arr) => arr.indexOf(item) === index);
}

async function getAlertConfig(prisma) {
  let config = await prisma.alertConfig.findFirst({
    orderBy: { id: "asc" },
  });

  if (!config) {
    config = await prisma.alertConfig.create({
      data: {
        pendingWatcherEnabled: true,

        pendingTripEnabled: true,
        pendingTripStartMinutes: 1,
        pendingTripRepeatMinutes: 5,
        pendingTripPhones: "",

        unassignedTripEnabled: true,
        unassignedTripStartMinutes: 15,
        unassignedTripRepeatMinutes: 15,
        unassignedTripPhones: "",
      },
    });
  }

  return config;
}

function buildPendingTripText(trip, level, minutes) {
  return (
    `[GoViet247] Cảnh báo CHUYẾN CHỜ DUYỆT lần ${level}: ` +
    `Trip chưa được duyệt sau ${minutes} phút. ` +
    `${trip.pickupAddress} → ${trip.dropoffAddress} | ` +
    `Giá=${trip.totalPrice ?? "?"} | ID=${trip.id}`
  );
}

function buildUnassignedTripText(trip, level, minutes) {
  return (
    `[GoViet247] Cảnh báo CHƯA CÓ TÀI XẾ lần ${level}: ` +
    `Trip đã duyệt nhưng chưa có tài xế nhận sau ${minutes} phút. ` +
    `${trip.pickupAddress} → ${trip.dropoffAddress} | ` +
    `Giá=${trip.totalPrice ?? "?"} | ID=${trip.id}`
  );
}

async function sendSmsToPhones({ phones, text, logger }) {
  let ok = true;

  for (const phone of phones) {
    try {
      const result = await sendSms({ to: phone, text });
      ok = ok && !!result?.ok;
    } catch (error) {
      ok = false;
      logger.error?.("[pendingWatcher] SMS error:", error);
    }
  }

  return ok;
}

async function sendPendingTripAlert(trip, config) {
  const { prisma, io, logger } = watcherRuntime;

  const phones = parsePhoneCsv(config.pendingTripPhones);
  if (!phones.length) {
    logger.warn?.("[pendingWatcher] skip pending trip alert: no phones");
    return;
  }

  const nextLevel = Number(trip.pendingTripAlertCount || 0) + 1;
  const baseTime = new Date(trip.createdAt).getTime();
  const elapsedMinutes = Math.max(1, Math.floor((Date.now() - baseTime) / 60000));

  const text = buildPendingTripText(trip, nextLevel, elapsedMinutes);
  const ok = await sendSmsToPhones({ phones, text, logger });

  await prisma.adminAlertLog.create({
    data: {
      tripId: trip.id,
      alertType: "PENDING_TRIP",
      level: nextLevel,
      message: text,
      sentTo: phones.join(","),
      success: ok,
    },
  });

  if (!ok) {
    logger.warn?.(
      `[pendingWatcher] pending trip alert send failed for trip ${trip.id}`,
    );
    return;
  }

  await prisma.trip.update({
    where: { id: trip.id },
    data: {
      pendingTripAlertAt: new Date(),
      pendingTripAlertCount: { increment: 1 },
    },
  });

  io?.to("admins").emit("admin:alert", {
    alertType: "PENDING_TRIP",
    type: "PENDING_TRIP",
    level: nextLevel,
    minutes: elapsedMinutes,
    tripId: trip.id,
    pickupAddress: trip.pickupAddress,
    dropoffAddress: trip.dropoffAddress,
    createdAt: trip.createdAt,
  });

  logger.info?.(
    `[pendingWatcher] PENDING_TRIP level ${nextLevel} sent for trip ${trip.id}`,
  );
}

async function sendUnassignedTripAlert(trip, config) {
  const { prisma, io, logger } = watcherRuntime;

  const phones = parsePhoneCsv(config.unassignedTripPhones);
  if (!phones.length) {
    logger.warn?.("[pendingWatcher] skip unassigned trip alert: no phones");
    return;
  }

  const nextLevel = Number(trip.unassignedTripAlertCount || 0) + 1;
  const baseTime = new Date(trip.verifiedAt || trip.createdAt).getTime();
  const elapsedMinutes = Math.max(1, Math.floor((Date.now() - baseTime) / 60000));

  const text = buildUnassignedTripText(trip, nextLevel, elapsedMinutes);
  const ok = await sendSmsToPhones({ phones, text, logger });

  await prisma.adminAlertLog.create({
    data: {
      tripId: trip.id,
      alertType: "UNASSIGNED_TRIP",
      level: nextLevel,
      message: text,
      sentTo: phones.join(","),
      success: ok,
    },
  });

  if (!ok) {
    logger.warn?.(
      `[pendingWatcher] unassigned trip alert send failed for trip ${trip.id}`,
    );
    return;
  }

  await prisma.trip.update({
    where: { id: trip.id },
    data: {
      unassignedTripAlertAt: new Date(),
      unassignedTripAlertCount: { increment: 1 },
    },
  });

  io?.to("admins").emit("admin:alert", {
    alertType: "UNASSIGNED_TRIP",
    type: "UNASSIGNED_TRIP",
    level: nextLevel,
    minutes: elapsedMinutes,
    tripId: trip.id,
    pickupAddress: trip.pickupAddress,
    dropoffAddress: trip.dropoffAddress,
    createdAt: trip.createdAt,
    verifiedAt: trip.verifiedAt || null,
  });

  watcherRuntime.logger.info?.(
    `[pendingWatcher] UNASSIGNED_TRIP level ${nextLevel} sent for trip ${trip.id}`,
  );
}

async function runPendingTripAlerts(config) {
  const { prisma, logger } = watcherRuntime;

  if (!config.pendingTripEnabled) {
    logger.debug?.("[pendingWatcher] pending trip alert disabled");
    return;
  }

  const phones = parsePhoneCsv(config.pendingTripPhones);
  if (!phones.length) {
    logger.debug?.("[pendingWatcher] pending trip alert skipped: empty phones");
    return;
  }

  const startMinutes = Number(config.pendingTripStartMinutes || 0);
  const repeatMinutes = Number(config.pendingTripRepeatMinutes || 5);

  const now = Date.now();
  const dueFromCreatedAt = new Date(now - startMinutes * 60 * 1000);
  const dueFromLastAlert = new Date(now - repeatMinutes * 60 * 1000);

  const candidates = await prisma.trip.findMany({
    where: {
      status: "PENDING",
      isVerified: false,
      cancelledAt: null,
      OR: [
        {
          pendingTripAlertCount: 0,
          createdAt: { lte: dueFromCreatedAt },
        },
        {
          pendingTripAlertCount: { gt: 0 },
          pendingTripAlertAt: { not: null, lte: dueFromLastAlert },
        },
      ],
    },
    select: {
      id: true,
      pickupAddress: true,
      dropoffAddress: true,
      createdAt: true,
      totalPrice: true,
      pendingTripAlertAt: true,
      pendingTripAlertCount: true,
    },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  if (!candidates.length) {
    logger.debug?.("[pendingWatcher] no pending-trip alerts due");
    return;
  }

  logger.warn?.(`[pendingWatcher] found ${candidates.length} PENDING_TRIP due`);

  for (const trip of candidates) {
    await sendPendingTripAlert(trip, config);
  }
}

async function runUnassignedTripAlerts(config) {
  const { prisma, logger } = watcherRuntime;

  if (!config.unassignedTripEnabled) {
    logger.debug?.("[pendingWatcher] unassigned trip alert disabled");
    return;
  }

  const phones = parsePhoneCsv(config.unassignedTripPhones);
  if (!phones.length) {
    logger.debug?.("[pendingWatcher] unassigned trip alert skipped: empty phones");
    return;
  }

  const startMinutes = Number(config.unassignedTripStartMinutes || 15);
  const repeatMinutes = Number(config.unassignedTripRepeatMinutes || 15);

  const now = Date.now();
  const dueFromVerifiedAt = new Date(now - startMinutes * 60 * 1000);
  const dueFromLastAlert = new Date(now - repeatMinutes * 60 * 1000);

  const candidates = await prisma.trip.findMany({
    where: {
      status: "PENDING",
      isVerified: true,
      driverId: null,
      cancelledAt: null,
      OR: [
        {
          unassignedTripAlertCount: 0,
          verifiedAt: { not: null, lte: dueFromVerifiedAt },
        },
        {
          unassignedTripAlertCount: 0,
          verifiedAt: null,
          createdAt: { lte: dueFromVerifiedAt },
        },
        {
          unassignedTripAlertCount: { gt: 0 },
          unassignedTripAlertAt: { not: null, lte: dueFromLastAlert },
        },
      ],
    },
    select: {
      id: true,
      pickupAddress: true,
      dropoffAddress: true,
      createdAt: true,
      verifiedAt: true,
      totalPrice: true,
      unassignedTripAlertAt: true,
      unassignedTripAlertCount: true,
    },
    orderBy: [{ verifiedAt: "asc" }, { createdAt: "asc" }],
    take: 100,
  });

  if (!candidates.length) {
    logger.debug?.("[pendingWatcher] no unassigned-trip alerts due");
    return;
  }

  logger.warn?.(
    `[pendingWatcher] found ${candidates.length} UNASSIGNED_TRIP due`,
  );

  for (const trip of candidates) {
    await sendUnassignedTripAlert(trip, config);
  }
}

async function runOnceInternal() {
  const { prisma, logger, running } = watcherRuntime;

  if (!prisma) {
    logger.warn?.("[pendingWatcher] skip runOnce: prisma chưa sẵn sàng");
    return;
  }

  if (running) return;
  watcherRuntime.running = true;

  try {
    const config = await getAlertConfig(prisma);

    if (!config.pendingWatcherEnabled) {
      logger.info?.("[pendingWatcher] watcher đang OFF, bỏ qua lần quét này");
      return;
    }

    await runPendingTripAlerts(config);
    await runUnassignedTripAlerts(config);
  } catch (err) {
    logger.error?.("[pendingWatcher] runOnce error:", err);
  } finally {
    watcherRuntime.running = false;
  }
}

function startWatcherTimer() {
  const { logger, intervalSec, timer } = watcherRuntime;

  if (timer) {
    logger.info?.("[pendingWatcher] watcher đã chạy rồi, bỏ qua start");
    return false;
  }

  watcherRuntime.timer = setInterval(() => {
    void runOnceInternal();
  }, intervalSec * 1000);

  logger.info?.(`[pendingWatcher] watcher started → every ${intervalSec}s`);
  return true;
}

function stopWatcherTimer() {
  const { logger, timer } = watcherRuntime;

  if (!timer) {
    logger.info?.("[pendingWatcher] watcher đã dừng sẵn");
    return false;
  }

  clearInterval(timer);
  watcherRuntime.timer = null;
  logger.info?.("[pendingWatcher] watcher stopped");
  return true;
}

export async function applyPendingWatcherEnabledChange({ enabled, prisma }) {
  if (prisma) {
    watcherRuntime.prisma = prisma;
  }

  if (enabled) {
    startWatcherTimer();
    await runOnceInternal();
    return {
      enabled: true,
      running: Boolean(watcherRuntime.timer),
    };
  }

  stopWatcherTimer();
  return {
    enabled: false,
    running: false,
  };
}

export function initPendingWatcher({ io, prisma, logger = console }) {
  watcherRuntime.io = io;
  watcherRuntime.prisma = prisma;
  watcherRuntime.logger = logger;
  watcherRuntime.intervalSec = getEnvInt("ALERT_INTERVAL_SECONDS", 60);

  logger.info?.(
    `[pendingWatcher] init runtime → every ${watcherRuntime.intervalSec}s`,
  );

  void (async () => {
    try {
      const config = await getAlertConfig(prisma);

      if (config.pendingWatcherEnabled) {
        await applyPendingWatcherEnabledChange({
          enabled: true,
          prisma,
        });
      } else {
        await applyPendingWatcherEnabledChange({
          enabled: false,
          prisma,
        });
      }
    } catch (err) {
      logger.error?.("[pendingWatcher] init error:", err);
    }
  })();

  return {
    runOnce: runOnceInternal,
    start: async () =>
      applyPendingWatcherEnabledChange({
        enabled: true,
        prisma: watcherRuntime.prisma,
      }),
    stop: async () =>
      applyPendingWatcherEnabledChange({
        enabled: false,
        prisma: watcherRuntime.prisma,
      }),
    isRunning: () => Boolean(watcherRuntime.timer),
  };
}