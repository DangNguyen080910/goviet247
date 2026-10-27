// Use the same completed-trip period as the accounting income report.
export async function getDriverAccountingIdentityRows(prisma, { start, end }) {
  const trips = await prisma.trip.findMany({
    where: { status: 'COMPLETED', updatedAt: { gte: start, lte: end }, driverId: { not: null } },
    select: { driverId: true }, distinct: ['driverId'],
  });
  const ids = [...new Set(trips.map(item => item.driverId).filter(Boolean))];
  const profiles = ids.length ? await prisma.driverProfile.findMany({
    where: { userId: { in: ids } },
    select: { id: true, userId: true, fullName: true, citizenId: true,
      user: { select: { displayName: true, phones: { select: { e164: true }, orderBy: { createdAt: 'desc' }, take: 1 } } } },
  }) : [];
  const byUser = new Map(profiles.map(item => [item.userId, item]));
  const rows = ids.sort().map(id => {
    const profile = byUser.get(id);
    const citizenId = profile?.citizenId || '';
    return [id, profile?.id || '', profile?.fullName || profile?.user?.displayName || 'Chưa cập nhật',
      citizenId || 'Chưa cập nhật', profile?.user?.phones?.[0]?.e164 || 'Chưa cập nhật',
      /^\d{12}$/.test(citizenId) ? 'Cần đối chiếu đăng ký thuế' : 'Thiếu hoặc sai CCCD - cần bổ sung'];
  });
  return [['Mã tài khoản tài xế', 'Mã hồ sơ', 'Họ tên', 'CCCD / số định danh', 'SĐT', 'Ghi chú đối chiếu'], ...rows];
}
