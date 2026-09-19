// Path: goviet247/apps/api/src/controllers/adminCustomerController.js

import { summarizeRiderAppUsage } from "../services/riderAppUsage.js";
import { prisma } from "../utils/db.js";

// Helper parse int an toàn
function toInt(v, fallback) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeSmartSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9+]+/g, " ")
    .trim();
}

function matchesCustomerSmartSearch(customer, keyword) {
  const normalizedKeyword = normalizeSmartSearch(keyword);
  if (!normalizedKeyword) return true;

  const phones = (customer?.phones || []).flatMap((item) => {
    const phone = String(item?.e164 || "").trim();
    const localPhone = phone.startsWith("+84") ? `0${phone.slice(3)}` : phone;
    return [phone, localPhone];
  });
  const haystack = normalizeSmartSearch(
    [
      customer?.displayName,
      customer?.riderProfile?.fullName,
      ...phones,
    ]
      .filter(Boolean)
      .join(" "),
  );
  const compactHaystack = haystack.replace(/\s+/g, "");

  return normalizedKeyword.split(/\s+/).every((token) => {
    return haystack.includes(token) || compactHaystack.includes(token);
  });
}

function buildCustomerUserWhere({ q, phoneVerified, status }) {
  const and = [];

  // ✅ Source of truth cho customer:
  // - có RiderProfile
  // - hoặc có role RIDER
  // - hoặc đã từng tạo trip với vai rider
  and.push({
    OR: [
      { riderProfile: { isNot: null } },
      { roles: { some: { role: "RIDER" } } },
      { riderTrips: { some: {} } },
    ],
  });

  if (q) {
    and.push({
      OR: [
        {
          displayName: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          riderProfile: {
            is: {
              fullName: {
                contains: q,
                mode: "insensitive",
              },
            },
          },
        },
        {
          phones: {
            some: {
              e164: {
                contains: q,
              },
            },
          },
        },
      ],
    });
  }

  if (phoneVerified === "true") {
    and.push({
      phones: { some: { isVerified: true } },
    });
  } else if (phoneVerified === "false") {
    and.push({
      OR: [
        { phones: { none: {} } },
        { phones: { some: { isVerified: false } } },
      ],
    });
  }

  if (status === "ACTIVE" || status === "SUSPENDED") {
    and.push({
      riderProfile: {
        is: { status },
      },
    });
  }

  return and.length ? { AND: and } : {};
}

async function findCustomerUserById(userId) {
  if (!userId) return null;

  return prisma.user.findFirst({
    where: {
      id: userId,
      AND: [
        {
          OR: [
            { riderProfile: { isNot: null } },
            { roles: { some: { role: "RIDER" } } },
            { riderTrips: { some: {} } },
          ],
        },
      ],
    },
    select: {
      id: true,
      displayName: true,
      primaryRole: true,
      createdAt: true,
      updatedAt: true,
      phones: {
        select: { e164: true, isVerified: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      riderProfile: {
        select: {
          id: true,
          status: true,
          suspendedAt: true,
          suspendReason: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      roles: {
        select: {
          id: true,
          role: true,
        },
      },
      _count: {
        select: {
          riderTrips: true,
        },
      },
    },
  });
}

// GET /api/admin/customers?q=&status=&phoneVerified=&sort=&page=&pageSize=
// status: all|ACTIVE|SUSPENDED
// phoneVerified: all|true|false
// sort: newest|oldest
export async function getCustomers(req, res) {
  try {
    const q = (req.query.q || "").trim();
    const status = (req.query.status || "all").toUpperCase();
    const phoneVerified = (req.query.phoneVerified || "all").toLowerCase();
    const sort = (req.query.sort || "newest").toLowerCase();

    const page = Math.max(1, toInt(req.query.page, 1));
    const pageSize = Math.min(100, Math.max(1, toInt(req.query.pageSize, 20)));
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const whereUser = buildCustomerUserWhere({
      q: "",
      phoneVerified,
      status,
    });

    const orderBy =
      sort === "oldest" ? { createdAt: "asc" } : { createdAt: "desc" };

    const select = {
        riderAppUsages: { select: { platform: true, firstSeenAt: true, lastSeenAt: true } },
        id: true,
        displayName: true,
        createdAt: true,
        updatedAt: true,
        primaryRole: true,
        phones: {
          select: { e164: true, isVerified: true },
          orderBy: { createdAt: "desc" },
        },
        riderProfile: {
          select: {
            fullName: true,
            status: true,
            suspendedAt: true,
            suspendReason: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        roles: {
          select: {
            id: true,
            role: true,
          },
        },
        _count: {
          select: {
            riderTrips: true,
          },
        },
      };

    const appPlatform = String(req.query.appPlatform || "all");
    const appWhere = appPlatform === "recorded" ? { riderAppUsages: { some: {} } }
      : appPlatform === "unrecorded" ? { riderAppUsages: { none: {} } }
      : ["android", "ios"].includes(appPlatform) ? { riderAppUsages: { some: { platform: appPlatform } } } : {};
    let items, total, appUsageSummary;
    if (q) {
      const candidates = await prisma.user.findMany({ where: whereUser, orderBy, select });
      const matched = candidates.filter(item => matchesCustomerSmartSearch(item, q));
      appUsageSummary = summarizeRiderAppUsage(matched);
      const filtered = matched.filter(item => {
        const platforms = item.riderAppUsages.map(usage => usage.platform);
        if (appPlatform === "recorded") return platforms.length > 0;
        if (appPlatform === "unrecorded") return platforms.length === 0;
        return !["android", "ios"].includes(appPlatform) || platforms.includes(appPlatform);
      });
      total = filtered.length;
      items = filtered.slice(skip, skip + take);
    } else {
      const where = { AND: [whereUser, appWhere] };
      const count = extra => prisma.user.count({ where: { AND: [whereUser, extra] } });
      const [all, recorded, android, ios, both, filteredTotal, pageItems] = await Promise.all([
        count({}), count({ riderAppUsages: { some: {} } }),
        count({ riderAppUsages: { some: { platform: "android" } } }),
        count({ riderAppUsages: { some: { platform: "ios" } } }),
        count({ AND: [{ riderAppUsages: { some: { platform: "android" } } }, { riderAppUsages: { some: { platform: "ios" } } }] }),
        prisma.user.count({ where }), prisma.user.findMany({ where, orderBy, select, skip, take }),
      ]);
      appUsageSummary = { total: all, recorded, unrecorded: all - recorded, android, ios, both };
      total = filteredTotal;
      items = pageItems;
    }

    return res.json({
      success: true,
      items,
      customers: items,
      appUsageSummary,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (err) {
    console.error("getCustomers error:", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy danh sách khách hàng",
    });
  }
}

// PATCH /api/admin/customers/:id/suspend  { reason }
// PATCH /api/admin/customers/:id/unsuspend { reason? }
export async function suspendCustomer(req, res) {
  try {
    const userId = req.params.id;
    const reason = (req.body?.reason || "").trim();

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập lý do khóa khách hàng",
      });
    }

    const user = await findCustomerUserById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy khách hàng",
      });
    }

    const existing = await prisma.riderProfile.findUnique({
      where: { userId },
      select: { id: true, status: true },
    });

    const riderProfile = await prisma.riderProfile.upsert({
      where: { userId },
      create: {
        userId,
        fullName: user.displayName || null,
        status: "SUSPENDED",
        suspendedAt: new Date(),
        suspendReason: reason,
      },
      update: {
        status: "SUSPENDED",
        suspendedAt: new Date(),
        suspendReason: reason,
      },
      select: {
        id: true,
        userId: true,
        status: true,
        suspendedAt: true,
        suspendReason: true,
      },
    });

    const fromStatus = existing?.status || "ACTIVE";
    const toStatus = "SUSPENDED";

    await prisma.adminCustomerActionLog.create({
      data: {
        riderProfileId: riderProfile.id,
        actorId: req.admin?.id ?? null,
        actorUsername: req.admin?.username || "unknown",
        action: "SUSPEND",
        fromStatus,
        toStatus,
        note: reason,
      },
    });

    return res.json({
      success: true,
      message: "Đã khóa khách hàng",
      riderProfile,
    });
  } catch (err) {
    console.error("suspendCustomer error:", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi khóa khách hàng",
    });
  }
}

export async function unsuspendCustomer(req, res) {
  try {
    const userId = req.params.id;
    const reason = (req.body?.reason || "").trim();

    const user = await findCustomerUserById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy khách hàng",
      });
    }

    const existing = await prisma.riderProfile.findUnique({
      where: { userId },
      select: { id: true, status: true },
    });

    const riderProfile = await prisma.riderProfile.upsert({
      where: { userId },
      create: {
        userId,
        fullName: user.displayName || null,
        status: "ACTIVE",
      },
      update: {
        status: "ACTIVE",
        suspendedAt: null,
        suspendReason: reason || null,
      },
      select: {
        id: true,
        userId: true,
        status: true,
        suspendedAt: true,
        suspendReason: true,
      },
    });

    const fromStatus = existing?.status || "SUSPENDED";
    const toStatus = "ACTIVE";

    await prisma.adminCustomerActionLog.create({
      data: {
        riderProfileId: riderProfile.id,
        actorId: req.admin?.id ?? null,
        actorUsername: req.admin?.username || "unknown",
        action: "UNSUSPEND",
        fromStatus,
        toStatus,
        note: reason || null,
      },
    });

    return res.json({
      success: true,
      message: "Đã mở khóa khách hàng",
      riderProfile,
    });
  } catch (err) {
    console.error("unsuspendCustomer error:", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi mở khóa khách hàng",
    });
  }
}

// GET /api/admin/customers/:id/logs
export async function getCustomerLogs(req, res) {
  try {
    const userId = req.params.id;

    const user = await findCustomerUserById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy khách hàng",
      });
    }

    const rp = await prisma.riderProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!rp) {
      return res.json({ success: true, items: [] });
    }

    const items = await prisma.adminCustomerActionLog.findMany({
      where: { riderProfileId: rp.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        action: true,
        fromStatus: true,
        toStatus: true,
        note: true,
        actorId: true,
        actorUsername: true,
        createdAt: true,
      },
    });

    return res.json({ success: true, items });
  } catch (err) {
    console.error("getCustomerLogs error:", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy lịch sử khách hàng",
    });
  }
}

// GET /api/admin/customers/:id
export async function getCustomerDetail(req, res) {
  try {
    const userId = req.params.id;

    const user = await findCustomerUserById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy khách hàng",
      });
    }

    return res.json({
      success: true,
      customer: {
        id: user.id,
        status: user.riderProfile?.status || "ACTIVE",
        suspendedAt: user.riderProfile?.suspendedAt || null,
        suspendReason: user.riderProfile?.suspendReason || null,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        user: {
          id: user.id,
          displayName: user.displayName,
          phones: user.phones,
          roles: user.roles,
        },
        counts: {
          riderTrips: user._count?.riderTrips || 0,
        },
        riderProfile: user.riderProfile,
      },
    });
  } catch (err) {
    console.error("getCustomerDetail error:", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy chi tiết khách hàng",
    });
  }
}
