// Path: goviet247/apps/api/src/controllers/feedbackController.js
import { prisma } from "../utils/db.js";

const FEEDBACK_SOURCES = [
  "RIDER_PROFILE",
  "RIDER_TRIP_HISTORY",
  "DRIVER_MENU",
  "DRIVER_TRIP_HISTORY",
];

const FEEDBACK_STATUSES = ["NEW", "IN_REVIEW", "RESOLVED", "CLOSED"];

function normalizeText(value) {
  return String(value || "").trim();
}

function getActorRoleFromSource(source) {
  if (source === "RIDER_PROFILE" || source === "RIDER_TRIP_HISTORY") {
    return "RIDER";
  }

  if (source === "DRIVER_MENU" || source === "DRIVER_TRIP_HISTORY") {
    return "DRIVER";
  }

  return null;
}

function parseStatusQuery(statusValue) {
  const raw = String(statusValue || "").trim().toUpperCase();
  if (!raw) return [];

  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => FEEDBACK_STATUSES.includes(item));
}

export async function createFeedback(req, res) {
  try {
    const userId = req.user?.uid || req.user?.id || null;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Bạn cần đăng nhập để gửi góp ý.",
      });
    }

    const source = normalizeText(req.body?.source).toUpperCase();
    const subject = normalizeText(req.body?.subject) || null;
    const message = normalizeText(req.body?.message);
    const senderNameInput = normalizeText(req.body?.senderName) || null;
    const senderPhoneInput = normalizeText(req.body?.senderPhone) || null;
    const tripId = normalizeText(req.body?.tripId) || null;

    if (!FEEDBACK_SOURCES.includes(source)) {
      return res.status(400).json({
        success: false,
        message: "Nguồn gửi góp ý không hợp lệ.",
      });
    }

    if (!message || message.length < 5) {
      return res.status(400).json({
        success: false,
        message: "Nội dung góp ý phải có ít nhất 5 ký tự.",
      });
    }

    const actorRole = getActorRoleFromSource(source);

    if (!actorRole) {
      return res.status(400).json({
        success: false,
        message: "Không xác định được loại người gửi góp ý.",
      });
    }

    if (
      (source === "RIDER_TRIP_HISTORY" || source === "DRIVER_TRIP_HISTORY") &&
      !tripId
    ) {
      return res.status(400).json({
        success: false,
        message: "Góp ý từ lịch sử chuyến đi cần có tripId.",
      });
    }

    if (tripId) {
      const trip = await prisma.trip.findUnique({
        where: { id: tripId },
        select: {
          id: true,
          riderId: true,
          driverId: true,
        },
      });

      if (!trip) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy chuyến đi để gắn góp ý.",
        });
      }

      if (actorRole === "RIDER" && trip.riderId !== userId) {
        return res.status(403).json({
          success: false,
          message: "Bạn không có quyền góp ý cho chuyến này với vai trò khách hàng.",
        });
      }

      if (actorRole === "DRIVER" && trip.driverId !== userId) {
        return res.status(403).json({
          success: false,
          message: "Bạn không có quyền góp ý cho chuyến này với vai trò tài xế.",
        });
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        displayName: true,
        phones: {
          orderBy: { createdAt: "asc" },
          select: {
            e164: true,
            isVerified: true,
          },
        },
      },
    });

    const verifiedPhone =
      user?.phones?.find((item) => item.isVerified)?.e164 || null;
    const anyPhone = user?.phones?.[0]?.e164 || null;

    const feedback = await prisma.feedback.create({
      data: {
        userId,
        tripId,
        actorRole,
        source,
        subject,
        message,
        senderName: senderNameInput || user?.displayName || null,
        senderPhone: senderPhoneInput || verifiedPhone || anyPhone || null,
      },
    });

    return res.status(201).json({
      success: true,
      feedback,
      message: "Gửi góp ý thành công.",
    });
  } catch (error) {
    console.error("[Feedback] createFeedback error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể gửi góp ý lúc này.",
    });
  }
}

export async function listFeedbacks(req, res) {
  try {
    const q = normalizeText(req.query?.q);
    const actorRole = normalizeText(req.query?.actorRole).toUpperCase();
    const statusList = parseStatusQuery(req.query?.status);
    const source = normalizeText(req.query?.source).toUpperCase();

    const page = Math.max(1, Number(req.query?.page) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, Number(req.query?.pageSize) || 20)
    );

    const where = {};

    if (actorRole) {
      where.actorRole = actorRole;
    }

    if (statusList.length === 1) {
      where.status = statusList[0];
    } else if (statusList.length > 1) {
      where.status = { in: statusList };
    }

    if (source) {
      where.source = source;
    }

    if (q) {
      where.OR = [
        { subject: { contains: q, mode: "insensitive" } },
        { message: { contains: q, mode: "insensitive" } },
        { senderName: { contains: q, mode: "insensitive" } },
        { senderPhone: { contains: q, mode: "insensitive" } },
        { id: { contains: q, mode: "insensitive" } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.feedback.count({ where }),
      prisma.feedback.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          trip: {
            select: {
              id: true,
              pickupAddress: true,
              dropoffAddress: true,
              pickupTime: true,
              status: true,
              riderName: true,
              riderPhone: true,
              carType: true,
              direction: true,
            },
          },
          user: {
            select: {
              id: true,
              displayName: true,
              primaryRole: true,
            },
          },
          resolvedBy: {
            select: {
              id: true,
              username: true,
              role: true,
            },
          },
        },
      }),
    ]);

    return res.json({
      success: true,
      items,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("[Feedback] listFeedbacks error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể tải danh sách góp ý.",
    });
  }
}

export async function getFeedbackDetail(req, res) {
  try {
    const id = normalizeText(req.params?.id);

    const feedback = await prisma.feedback.findUnique({
      where: { id },
      include: {
        trip: {
          include: {
            stops: {
              orderBy: { seq: "asc" },
            },
          },
        },
        user: {
          select: {
            id: true,
            displayName: true,
            primaryRole: true,
            phones: {
              orderBy: { createdAt: "asc" },
              select: {
                e164: true,
                isVerified: true,
              },
            },
          },
        },
        resolvedBy: {
          select: {
            id: true,
            username: true,
            role: true,
          },
        },
      },
    });

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy góp ý.",
      });
    }

    return res.json({
      success: true,
      feedback,
    });
  } catch (error) {
    console.error("[Feedback] getFeedbackDetail error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể tải chi tiết góp ý.",
    });
  }
}

export async function updateFeedback(req, res) {
  try {
    const id = normalizeText(req.params?.id);
    const status = normalizeText(req.body?.status).toUpperCase();
    const adminNoteRaw = req.body?.adminNote;
    const adminNote =
      adminNoteRaw == null ? undefined : normalizeText(adminNoteRaw) || null;

    if (!status || !FEEDBACK_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Trạng thái góp ý không hợp lệ.",
      });
    }

    const existing = await prisma.feedback.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
      },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy góp ý.",
      });
    }

    const isResolvedStatus = status === "RESOLVED" || status === "CLOSED";

    const updated = await prisma.feedback.update({
      where: { id },
      data: {
        status,
        ...(adminNote !== undefined ? { adminNote } : {}),
        resolvedAt: isResolvedStatus ? new Date() : null,
        resolvedByAdminId: isResolvedStatus ? req.admin?.id || null : null,
      },
      include: {
        resolvedBy: {
          select: {
            id: true,
            username: true,
            role: true,
          },
        },
      },
    });

    return res.json({
      success: true,
      feedback: updated,
      message: "Cập nhật góp ý thành công.",
    });
  } catch (error) {
    console.error("[Feedback] updateFeedback error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể cập nhật góp ý.",
    });
  }
}