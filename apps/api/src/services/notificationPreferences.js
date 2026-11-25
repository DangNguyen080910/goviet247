import { getVerifiedRiderPhoneVariants } from './riderTripAccess.js';
import { sortNotifications } from '../shared/notificationPresentation.js';

export async function riderNotificationScope(db, userId) {
  const phones = await getVerifiedRiderPhoneVariants(db, userId);
  const trips = phones.length ? await db.trip.findMany({ where: { riderPhone: { in: phones } }, select: { id: true } }) : [];
  return { isActive: true, audience: 'RIDER', OR: [
    { targetType: 'ALL' }, { targetType: 'USER', targetUserId: userId },
    ...(trips.length ? [{ targetType: 'USER', OR: trips.map(({ id }) => ({ message: { contains: `[tripId:${id}]` } })) }] : []),
  ] };
}

export function driverNotificationScope(userId) {
  return { isActive: true, audience: 'DRIVER', OR: [{ targetType: 'ALL' }, { targetType: 'USER', targetUserId: userId }] };
}

export function notificationPreferences(item) {
  const pref = item.preferences?.[0];
  return { isPinnedByDefault: Boolean(item.isPinnedByDefault),
    isPinned: pref?.isPinned ?? Boolean(item.isPinnedByDefault), isCollapsed: pref?.isCollapsed ?? true };
}

export async function notificationFeed(db, where, userId, notificationId = '') {
  const include = userId ? { preferences: { where: { userId } }, reads: { where: { userId }, take: 1 } } : undefined;
  const scoped = notificationId ? { AND: [where, { id: notificationId }] } : where;
  const latest = await db.systemNotification.findMany({ where: scoped, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], take: 50, ...(include ? { include } : {}) });
  // Query pins separately: old important announcements must survive the newest-50 window.
  const pins = notificationId ? [] : await db.systemNotification.findMany({
    where: { AND: [where, { OR: [
      { isPinnedByDefault: true, ...(userId ? { preferences: { none: { userId, isPinned: false } } } : {}) },
      ...(userId ? [{ preferences: { some: { userId, isPinned: true } } }] : []),
    ] }] }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], ...(include ? { include } : {}),
  });
  return sortNotifications([...new Map([...pins, ...latest].map(item => {
    const { preferences, ...safe } = item;
    return [item.id, { ...safe, ...notificationPreferences(item) }];
  })).values()]);
}

export function createNotificationPreferenceHandler(db) {
  return async (req, res) => {
    try {
      const userId = String(req.user?.uid || req.user?.id || '').trim();
      if (!userId) return res.status(401).json({ success: false, message: 'Bạn cần đăng nhập.' });
      const audience = req.body?.audience;
      if (!['DRIVER', 'RIDER'].includes(audience)) return res.status(400).json({ success: false, message: 'Đối tượng thông báo không hợp lệ.' });
      const data = {};
      for (const key of ['isPinned', 'isCollapsed']) {
        if (!Object.hasOwn(req.body, key)) continue;
        if (typeof req.body[key] !== 'boolean') return res.status(400).json({ success: false, message: 'Trạng thái ghim và thu gọn phải là true hoặc false.' });
        data[key] = req.body[key];
      }
      if (!Object.keys(data).length) return res.status(400).json({ success: false, message: 'Chưa có thay đổi cần lưu.' });
      const scope = audience === 'DRIVER' ? driverNotificationScope(userId) : await riderNotificationScope(db, userId);
      const item = await db.systemNotification.findFirst({ where: { AND: [scope, { id: req.params.id }] }, select: { id: true, isPinnedByDefault: true } });
      if (!item) return res.status(404).json({ success: false, message: 'Không tìm thấy thông báo.' });
      const preference = await db.systemNotificationPreference.upsert({
        where: { notificationId_userId: { notificationId: item.id, userId } },
        create: { notificationId: item.id, userId, ...data }, update: data,
      });
      // Preference changes never mark read and never create notifications or push jobs.
      return res.json({ success: true, item: { id: item.id, ...notificationPreferences({ ...item, preferences: [preference] }) } });
    } catch (error) {
      console.error('[Notification preferences]', error);
      return res.status(500).json({ success: false, message: 'Chưa lưu được lựa chọn thông báo. Vui lòng thử lại.' });
    }
  };
}
