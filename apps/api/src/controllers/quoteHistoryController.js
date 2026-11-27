import { decodeQuoteHistoryRoute, QUOTE_HISTORY_SOURCES } from "../shared/quoteHistoryRoute.js";
import pkg from "@prisma/client";
import { prisma } from "../utils/db.js";
import { historyCutoff } from "../services/quoteHistoryService.js";
const { Prisma } = pkg;

export async function getQuoteHistorySettings(req, res) {
  try {
    const setting = await prisma.quoteHistorySetting.findUnique({ where: { id: 1 } });
    return res.json({ success: true, enabled: setting?.enabled ?? true, retentionDays: 90 });
  } catch { return res.status(503).json({ success: false, message: "Chưa tải được cấu hình lịch sử tính giá." }); }
}

export async function updateQuoteHistorySettings(req, res) {
  if (typeof req.body?.enabled !== "boolean") return res.status(400).json({ success: false, message: "Trạng thái bật/tắt không hợp lệ." });
  try {
    const data = { enabled: req.body.enabled, updatedBy: String(req.admin?.username || req.admin?.id || "ADMIN") };
    const setting = await prisma.quoteHistorySetting.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
    return res.json({ success: true, enabled: setting.enabled });
  } catch { return res.status(503).json({ success: false, message: "Chưa lưu được cấu hình. Vui lòng thử lại." }); }
}

function localDay(value, end = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Ngày lọc không hợp lệ.");
  const date = new Date(`${value}T00:00:00+07:00`);
  if (!Number.isFinite(date.getTime()) || new Date(date.getTime() + 7 * 3600000).toISOString().slice(0, 10) !== value) throw new Error("Ngày lọc không hợp lệ.");
  return end ? new Date(date.getTime() + 86400000) : date;
}

export async function listQuoteHistory(req, res) {
  let from, to;
  try {
    from = req.query.from ? localDay(String(req.query.from)) : historyCutoff();
    to = req.query.to ? localDay(String(req.query.to), true) : new Date();
    if (from >= to) throw new Error("Khoảng ngày lọc không hợp lệ.");
  } catch (error) { return res.status(400).json({ success: false, message: error.message }); }
  from = new Date(Math.max(from.getTime(), historyCutoff().getTime()));
  const q = String(req.query.q || "").trim().slice(0, 150);
  const escapedQ = q.replace(/[\\%_]/g, "\\$&");
  const carType = String(req.query.carType || "");
  const source = String(req.query.source || "");
  if ((carType && !["CAR_5", "CAR_7", "CAR_16"].includes(carType)) ||
      (source && !Object.hasOwn(QUOTE_HISTORY_SOURCES, source))) {
    return res.status(400).json({ success: false, message: "Bộ lọc không hợp lệ." });
  }
  const page = Math.max(1, Math.min(10000, Number.parseInt(req.query.page, 10) || 1));
  const pageSize = 25;
  const conditions = [Prisma.sql`"createdAt" >= ${from}`, Prisma.sql`"createdAt" < ${to}`];
  if (carType) conditions.push(Prisma.sql`"carType" = ${carType}`);
  if (source) conditions.push(Prisma.sql`"source" = ${source}`);
  if (q) {
    const pattern = `%${escapedQ}%`;
    conditions.push(Prisma.sql`(
      "customerName" ILIKE ${pattern} OR "customerPhone" ILIKE ${pattern}
      OR "pickupAddress" ILIKE ${pattern} OR "tripId" ILIKE ${pattern}
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(
          CASE WHEN jsonb_typeof("stops"->'additionalPickups') = 'array'
            THEN "stops"->'additionalPickups' ELSE '[]'::jsonb END
        ) AS pickup(address)
        WHERE pickup.address ILIKE ${pattern}
      )
    )`);
  }
  const filter = Prisma.join(conditions, " AND ");
  const vnToday = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  try {
    const [items, aggregate] = await Promise.all([
      prisma.$queryRaw(Prisma.sql`SELECT "id", "createdAt", "userId", "customerName", "customerPhone", "identityVerified",
        "source", "pickupAddress", "stops", "pickupTime", "returnTime", "carType", "direction", "fuelPreference",
        "distanceKm", "driveMinutes", "finalPrice", "tripId", "bookedAt"
        FROM "QuoteHistory" WHERE ${filter}
        ORDER BY "createdAt" DESC, "id" DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`),
      prisma.$queryRaw(Prisma.sql`SELECT COUNT(*)::int AS "total", COUNT(DISTINCT "customerKey")::int AS "uniqueCustomers",
        COUNT(DISTINCT "userId")::int AS "loggedInCustomers",
        COUNT(*) FILTER (WHERE "customerKey" IS NULL)::int AS "unidentifiedQuotes",
        COUNT(*) FILTER (WHERE "tripId" IS NOT NULL)::int AS "bookedQuotes",
        COUNT(*) FILTER (WHERE "createdAt" >= ${localDay(vnToday)})::int AS "todayQuotes"
        FROM "QuoteHistory" WHERE ${filter}`),
    ]);
    const stats = aggregate[0];
    return res.json({ success: true, items: items.map(item => ({ ...item, ...decodeQuoteHistoryRoute(item.stops) })), stats, page, pageSize, totalPages: Math.ceil(stats.total / pageSize) });
  } catch (error) {
    console.error("[QuoteHistory] Admin list unavailable:", error?.code || "ERROR");
    return res.status(503).json({ success: false, message: "Chưa tải được lịch sử tính giá. Kiểm tra migration và thử lại." });
  }
}
