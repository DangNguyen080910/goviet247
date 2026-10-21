import { isProvinceCode } from '../services/driverOperatingProvince.js';
import { prisma } from '../utils/db.js';

const labels = { fullName: 'Họ tên', displayName: 'Tên hiển thị', phone: 'SĐT', operatingProvinceCode: 'Khu vực hoạt động', provinceConfirmed: 'Xác nhận khu vực', vehicleType: 'Loại xe', vehicleBrand: 'Hãng xe', vehicleModel: 'Model xe', vehicleYear: 'Đời xe', plateNumber: 'Biển số' };
const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const plateKey = value => String(value || '').toUpperCase().replace(/[\s.-]+/g, '');
const phoneNumber = value => {
  const raw = String(value || '').trim().replace(/[\s().-]/g, '');
  if (/^0\d{9}$/.test(raw)) return '+84' + raw.slice(1);
  if (/^84\d{9}$/.test(raw)) return '+' + raw;
  return raw;
};
const safeLogValue = (key, value) => key === 'phone' && value ? '••••' + String(value).slice(-4) : value;

export async function updateAdminDriverProfile(req, res) {
  try {
    const body = req.body || {};
    const allowed = new Set([...Object.keys(labels), 'expectedUpdatedAt', 'expectedPhone', 'reason']);
    if (Object.keys(body).some(key => !allowed.has(key))) throw fail('Có trường không được phép sửa trong thông tin hồ sơ.');
    if (typeof body.reason !== 'string' || !body.reason.trim() || body.reason.length > 500) throw fail('Nhập lý do chỉnh sửa từ 1 đến 500 ký tự.');
    const expected = new Date(body.expectedUpdatedAt);
    if (!body.expectedUpdatedAt || !Number.isFinite(expected.getTime())) throw fail('Thiếu phiên bản hồ sơ. Hãy tải lại chi tiết tài xế.');
    const values = {};
    for (const key of Object.keys(labels)) {
      if (!Object.prototype.hasOwnProperty.call(body, key)) continue;
      const raw = body[key];
      if (key === 'provinceConfirmed') {
        if (typeof raw !== 'boolean') throw fail('Xác nhận khu vực không hợp lệ.');
        values[key] = raw; continue;
      }
      if (key === 'vehicleYear') {
        const year = Number(raw);
        if (raw === '' || raw == null || !Number.isInteger(year) || year < 1980 || year > new Date().getUTCFullYear() + 1) throw fail('Đời xe không hợp lệ.');
        values[key] = year; continue;
      }
      if (typeof raw !== 'string') throw fail(labels[key] + ' không hợp lệ.');
      let value = raw.trim();
      if (!value || value.length > (key === 'plateNumber' ? 30 : 100)) throw fail(labels[key] + ' không được trống hoặc quá dài.');
      if (key === 'phone') {
        value = phoneNumber(value);
        if (!/^\+84[35789]\d{8}$/.test(value)) throw fail('SĐT di động Việt Nam không hợp lệ.');
      }
      if (key === 'operatingProvinceCode' && !isProvinceCode(value)) throw fail('Tỉnh/thành không hợp lệ.');
      if (key === 'vehicleType' && !['CAR_5', 'CAR_7', 'CAR_16'].includes(value)) throw fail('Chọn xe 5, 7 hoặc 16 chỗ.');
      if (key === 'plateNumber') {
        value = plateKey(value);
        if (!/^[A-Z0-9]{5,12}$/.test(value)) throw fail('Biển số không hợp lệ.');
      }
      values[key] = value;
    }
    if (!Object.keys(values).length) throw fail('Chưa có thông tin cần cập nhật.');
    const result = await prisma.$transaction(async tx => {
      const id = req.params.id;
      await tx.$queryRaw`SELECT "id" FROM "DriverProfile" WHERE "id" = ${id} FOR UPDATE`;
      const current = await tx.driverProfile.findUnique({ where: { id }, include: { user: { include: { phones: { orderBy: { createdAt: 'desc' } } } } } });
      if (!current) throw fail('Không tìm thấy tài xế.', 404);
      if (current.updatedAt.getTime() !== expected.getTime()) throw fail('Hồ sơ vừa thay đổi. Đóng cửa sổ sửa và mở lại trước khi lưu.', 409);
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${current.userId} FOR UPDATE`;
      const user = await tx.user.findUnique({ where: { id: current.userId } });
      const phone = current.user.phones[0];
      const changes = [];
      const data = {};
      for (const [key, value] of Object.entries(values)) {
        const before = key === 'phone' ? phone?.e164 ?? null : key === 'displayName' ? user.displayName : key === 'provinceConfirmed' ? !!current.operatingProvinceConfirmedAt : current[key];
        if (before === value) continue;
        changes.push({ field: labels[key], before: safeLogValue(key, before), after: safeLogValue(key, value) });
        if (!['phone', 'displayName', 'provinceConfirmed'].includes(key)) data[key] = value;
      }
      if (!changes.length) return { changed: false, phoneChanged: false };
      if (data.plateNumber) {
        // Serialize plate corrections, including differently formatted legacy plates.
        const key = data.plateNumber;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
        const others = await tx.driverProfile.findMany({ where: { id: { not: id }, plateNumber: { not: null }, status: { in: ['PENDING', 'VERIFIED'] } }, select: { plateNumber: true } });
        if (others.some(other => plateKey(other.plateNumber) === key)) throw fail('Biển số đang có trong hồ sơ chờ duyệt hoặc đã duyệt của tài xế khác.', 409);
      }
      const phoneChanged = values.phone !== undefined && values.phone !== phone?.e164;
      if (phoneChanged) {
        if ((body.expectedPhone?.id ?? null) !== (phone?.id ?? null) || (body.expectedPhone?.e164 ?? null) !== (phone?.e164 ?? null)) throw fail('SĐT vừa thay đổi. Vui lòng mở lại cửa sổ sửa.', 409);
        const duplicate = await tx.phone.findUnique({ where: { e164: values.phone } });
        if (duplicate && duplicate.id !== phone?.id) throw fail('SĐT đã tồn tại trong hệ thống. Không thể gộp tài khoản bằng thao tác này.', 409);
        if (phone) {
          await tx.phone.update({ where: { id: phone.id }, data: { e164: values.phone, isVerified: false } });
          await tx.otpSession.updateMany({ where: { phoneId: phone.id, status: 'pending' }, data: { status: 'expired', expiresAt: new Date() } });
        } else await tx.phone.create({ data: { userId: current.userId, e164: values.phone, isVerified: false } });
      }
      if (values.displayName !== undefined && values.displayName !== user.displayName) await tx.user.update({ where: { id: current.userId }, data: { displayName: values.displayName } });
      if (values.operatingProvinceCode !== undefined && values.operatingProvinceCode !== current.operatingProvinceCode && values.provinceConfirmed === undefined) data.operatingProvinceConfirmedAt = null;
      if (values.provinceConfirmed !== undefined) data.operatingProvinceConfirmedAt = values.provinceConfirmed ? (data.operatingProvinceCode ? new Date() : current.operatingProvinceConfirmedAt || new Date()) : null;
      await tx.driverProfile.update({ where: { id }, data: { ...data, updatedAt: new Date() } });
      await tx.adminDriverActionLog.create({ data: {
        driverProfileId: id, actorId: req.admin?.id ?? null, actorUsername: req.admin?.username || 'ADMIN',
        action: 'EDIT_PROFILE', fromStatus: current.status, toStatus: current.status,
        note: body.reason.trim() + '\n' + JSON.stringify(changes),
      } });
      return { changed: true, phoneChanged };
    });
    if (result.changed) {
      const event = { source: 'driver_profile_updated', driverProfileId: req.params.id };
      req.app?.get?.('io')?.to('admins').emit('admin:dashboard_changed', event);
    }
    return res.json({ success: true, ...result, message: result.changed ? 'Đã cập nhật thông tin tài xế.' : 'Thông tin không thay đổi.' });
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ success: false, message: 'Thông tin bị trùng. Vui lòng kiểm tra SĐT và biển số.' });
    if (error.code === 'P2025') return res.status(409).json({ success: false, message: 'Hồ sơ vừa thay đổi. Vui lòng tải lại.' });
    if (!error.statusCode) console.error('updateAdminDriverProfile failed:', error.code || error.name);
    return res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Không cập nhật được hồ sơ tài xế.' });
  }
}
