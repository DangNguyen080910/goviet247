// Path: goviet247/apps/api/src/controllers/adminCustomerController.js

import { prisma } from "../utils/db.js";

// Helper parse int an toàn
function toInt(v, fallback) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
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
        { displayName: { contains: q, mode: "insensitive" } },
        {
          phones: {
            some: {
              e164: { contains: q },
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
      q,
      phoneVerified,
      status,
    });

    const orderBy =
      sort === "oldest" ? { createdAt: "asc" } : { createdAt: "desc" };

    const total = await prisma.user.count({
      where: whereUser,
    });

    const items = await prisma.user.findMany({
      where: whereUser,
      orderBy,
      skip,
      take,
      select: {
        id: true,
        displayName: true,
        createdAt: true,
        updatedAt: true,
        primaryRole: true,
        phones: {
          select: { e164: true, isVerified: true },
          orderBy: { createdAt: "desc" },
          take: 1,
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
      },
    });

    return res.json({
      success: true,
      items,
      customers: items,
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
