// Path: goviet247/apps/api/src/controllers/driverNotificationController.js
import { prisma } from "../utils/db.js";

function getUserIdFromRequest(req) {
  return req?.user?.uid || req?.user?.id || req?.user?.userId || req?.user?.sub || null;
}

function mapNotificationItem(item) {
  const read =
    Array.isArray(item.reads) && item.reads.length > 0 ? item.reads[0] : null;

  return {
    id: item.id,
    title: item.title,
    message: item.message,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    isActive: Boolean(item.isActive),
    audience: item.audience,
    isRead: Boolean(read),
    readAt: read?.readAt || null,
  };
}

export async function getMyDriverNotifications(req, res) {
  try {
    const userId = getUserIdFromRequest(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Không xác định được tài khoản tài xế.",
      });
    }

    const items = await prisma.systemNotification.findMany({
      where: {
        audience: "DRIVER",
        isActive: true,
        OR: [
          {
            targetType: "ALL",
          },
          {
            targetType: "USER",
            targetUserId: userId,
          },
        ],
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
      include: {
        reads: {
          where: { userId },
          select: {
            id: true,
            readAt: true,
          },
          orderBy: {
            readAt: "desc",
          },
          take: 1,
        },
      },
    });

    const mappedItems = items.map(mapNotificationItem);
    const unreadCount = mappedItems.filter((item) => !item.isRead).length;

    return res.json({
      success: true,
      items: mappedItems,
      unreadCount,
    });
  } catch (err) {
    console.error("[DriverNotifications] getMyDriverNotifications error:", err);
    return res.status(500).json({
      success: false,
      message: "Không lấy được danh sách thông báo tài xế.",
    });
  }
}

export async function markAllDriverNotificationsAsRead(req, res) {
  try {
    const userId = getUserIdFromRequest(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Không xác định được tài khoản tài xế.",
      });
    }

    const unreadItems = await prisma.systemNotification.findMany({
      where: {
        audience: "DRIVER",
        isActive: true,
        OR: [
          {
            targetType: "ALL",
          },
          {
            targetType: "USER",
            targetUserId: userId,
          },
        ],
        reads: {
          none: {
            userId,
          },
        },
      },
      select: {
        id: true,
      },
    });

    if (unreadItems.length > 0) {
      const readAt = new Date();

      await prisma.systemNotificationRead.createMany({
        data: unreadItems.map((item) => ({
          notificationId: item.id,
          userId,
          readAt,
        })),
        skipDuplicates: true,
      });
    }

    return res.json({
      success: true,
      message: "Đã đánh dấu đọc tất cả thông báo tài xế.",
      unreadCount: 0,
    });
  } catch (err) {
    console.error(
      "[DriverNotifications] markAllDriverNotificationsAsRead error:",
      err,
    );
    return res.status(500).json({
      success: false,
      message: "Không thể cập nhật trạng thái đã đọc.",
    });
  }
}