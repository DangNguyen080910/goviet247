import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { prisma } from '../utils/db.js';
import { uploadToS3 } from '../services/s3Service.js';

const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const reasonOf = value => {
  if (typeof value !== 'string' || !value.trim() || value.length > 500) throw fail('Nhập lý do chỉnh sửa từ 1 đến 500 ký tự.');
  return value.trim();
};
async function lockProfile(tx, id) {
  await tx.$queryRaw`SELECT "id" FROM "DriverProfile" WHERE "id" = ${id} FOR UPDATE`;
  const profile = await tx.driverProfile.findUnique({ where: { id } });
  if (!profile) throw fail('Không tìm thấy tài xế.', 404);
  return profile;
}
async function logEdit(tx, req, profile, note) {
  await tx.adminDriverActionLog.create({ data: { driverProfileId: profile.id,
    actorId: req.admin?.id ?? null, actorUsername: req.admin?.username || 'ADMIN',
    action: 'EDIT_PROFILE', fromStatus: profile.status, toStatus: profile.status, note } });
  await tx.driverProfile.update({ where: { id: profile.id }, data: { updatedAt: new Date() } });
}
function respondError(res, error) {
  if (!error.statusCode) console.error('Admin driver asset update failed:', error.code || error.name);
  return res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Không lưu được thay đổi. Vui lòng tải lại hồ sơ.' });
}
export async function saveAdminDriverBankAccount(req, res) {
  try {
    const body = req.body || {};
    const reason = reasonOf(body.reason);
    const data = {};
    for (const key of ['bankName', 'accountNumber', 'accountHolderName']) {
      if (typeof body[key] !== 'string' || !body[key].trim() || body[key].length > 100) throw fail('Nhập đủ tên ngân hàng, số tài khoản và tên chủ tài khoản.');
      data[key] = body[key].trim().replace(/\s+/g, ' ');
    }
    data.accountNumber = data.accountNumber.replace(/\s+/g, '');
    if (!/^[A-Za-z0-9]{6,40}$/.test(data.accountNumber)) throw fail('Số tài khoản không hợp lệ (6–40 ký tự chữ hoặc số).');
    if (typeof body.isDefault !== 'boolean') throw fail('Trạng thái tài khoản mặc định không hợp lệ.');
    const result = await prisma.$transaction(async tx => {
      const profile = await lockProfile(tx, req.params.id);
      const existing = body.bankAccountId ? await tx.driverBankAccount.findFirst({ where: { id: body.bankAccountId, driverProfileId: profile.id, archivedAt: null } }) : null;
      if (body.bankAccountId && !existing) throw fail('Tài khoản không thuộc hồ sơ này hoặc đã được thay thế.', 409);
      if (existing && String(existing.updatedAt.toISOString()) !== body.expectedUpdatedAt) throw fail('Tài khoản ngân hàng vừa thay đổi. Hãy mở lại cửa sổ sửa.', 409);
      const active = await tx.driverBankAccount.findMany({ where: { driverProfileId: profile.id, archivedAt: null } });
      const duplicate = active.find(account => account.id !== existing?.id && account.bankName.trim().toLocaleLowerCase('vi') === data.bankName.toLocaleLowerCase('vi') && account.accountNumber.replace(/\s+/g, '') === data.accountNumber);
      if (duplicate) throw fail('Tài khoản này đã có trong hồ sơ.', 409);
      const detailsChanged = !existing || Object.keys(data).some(key => data[key] !== existing[key]);
      const usage = existing && detailsChanged ? await tx.driverWithdrawRequest.count({ where: { bankAccountId: existing.id } }) : 0;
      const pendingCount = usage ? await tx.driverWithdrawRequest.count({ where: { bankAccountId: existing.id, status: { in: ['PENDING', 'APPROVED'] } } }) : 0;
      const otherDefault = active.some(account => account.id !== existing?.id && account.isDefault);
      const isDefault = body.isDefault || (!otherDefault && !!existing?.isDefault) || active.length === 0;
      if (isDefault) await tx.driverBankAccount.updateMany({ where: { driverProfileId: profile.id, isDefault: true }, data: { isDefault: false } });
      if (usage) await tx.driverBankAccount.update({ where: { id: existing.id }, data: { archivedAt: new Date(), isDefault: false } });
      const saved = existing && !usage
        ? await tx.driverBankAccount.update({ where: { id: existing.id }, data: { ...data, isDefault } })
        : await tx.driverBankAccount.create({ data: { ...data, isDefault, driverProfileId: profile.id } });
      const masked = value => value ? '••••' + value.slice(-4) : 'chưa có';
      await logEdit(tx, req, profile, reason + '\n' + JSON.stringify({
        bankAccountId: saved.id, previousBankAccountId: existing?.id || null,
        before: existing ? { bankName: existing.bankName, accountNumber: masked(existing.accountNumber), accountHolderName: existing.accountHolderName, isDefault: existing.isDefault } : null,
        after: { bankName: data.bankName, accountNumber: masked(data.accountNumber), accountHolderName: data.accountHolderName, isDefault },
        preservedWithdrawalHistory: !!usage,
      }));
      return { id: saved.id, pendingCount, versioned: !!usage };
    });
    return res.json({ success: true, ...result, message: result.pendingCount ? `Đã lưu tài khoản mới. ${result.pendingCount} yêu cầu rút tiền đang xử lý vẫn dùng tài khoản cũ; cần kiểm tra riêng trước khi chi.` : 'Đã lưu tài khoản ngân hàng.' });
  } catch (error) { return respondError(res, error); }
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024, files: 1 },
  fileFilter: (_, file, cb) => ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype) ? cb(null, true) : cb(fail('Chọn ảnh JPG, PNG hoặc WebP.')) }).single('file');
export function adminDocumentUpload(req, res, next) {
  upload(req, res, error => error ? res.status(400).json({ success: false, message: error.code === 'LIMIT_FILE_SIZE' ? 'Ảnh tối đa 20MB.' : error.statusCode ? error.message : 'Không nhận được ảnh. Chọn một ảnh JPG, PNG hoặc WebP.' }) : next());
}
export async function saveAdminDriverDocument(req, res) {
  try {
    const reason = reasonOf(req.body?.reason);
    const type = req.body?.type;
    if (!['CCCD_FRONT', 'CCCD_BACK', 'PORTRAIT', 'DRIVER_LICENSE', 'VEHICLE_REGISTRATION'].includes(type)) throw fail('Loại giấy tờ không hợp lệ.');
    const file = req.file;
    if (!file) throw fail('Vui lòng chọn ảnh giấy tờ.');
    const jpg = file.buffer[0] === 255 && file.buffer[1] === 216 && file.buffer[2] === 255;
    const png = file.buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const webp = file.buffer.subarray(0,4).toString() === 'RIFF' && file.buffer.subarray(8,12).toString() === 'WEBP';
    if (!({ 'image/jpeg': jpg, 'image/png': png, 'image/webp': webp }[file.mimetype])) throw fail('Nội dung file không khớp định dạng ảnh.');
    const profile = await prisma.driverProfile.findUnique({ where: { id: req.params.id } });
    if (!profile) throw fail('Không tìm thấy tài xế.', 404);
    const documentId = req.body?.documentId;
    const original = documentId ? await prisma.driverDocument.findFirst({ where: { id: documentId, driverId: profile.id, type } }) : null;
    if (documentId && !original) throw fail('Giấy tờ không thuộc hồ sơ này.', 409);
    if (original && req.body.expectedFileUrl !== original.fileUrl) throw fail('Ảnh vừa thay đổi. Vui lòng mở lại hồ sơ.', 409);
    const uploaded = await uploadToS3({ file, folder: `driver-documents/${profile.userId}/${type}/admin-${randomUUID()}` });
    await prisma.$transaction(async tx => {
      const locked = await lockProfile(tx, profile.id);
      if (original) {
        const current = await tx.driverDocument.findFirst({ where: { id: original.id, driverId: profile.id } });
        if (!current || current.fileUrl !== original.fileUrl) throw fail('Ảnh vừa thay đổi. Vui lòng tải lại hồ sơ.', 409);
        await tx.driverDocument.update({ where: { id: original.id }, data: { fileUrl: uploaded.key, status: 'UPLOADED', reviewedAt: null, reviewedById: null, note: reason } });
      } else {
        if (await tx.driverDocument.findFirst({ where: { driverId: profile.id, type } })) throw fail('Đã có giấy tờ loại này. Hãy mở lại và dùng Thay ảnh.', 409);
        await tx.driverDocument.create({ data: { driverId: profile.id, type, fileUrl: uploaded.key, status: 'UPLOADED', note: reason } });
      }
      await logEdit(tx, req, locked, reason + '\n' + JSON.stringify({ documentType: type, oldFile: original?.fileUrl || null, newFile: uploaded.key, status: 'UPLOADED' }));
    });
    // Retain the old object; the audit entry points to it for later review.
    return res.json({ success: true, message: 'Đã lưu ảnh mới; giấy tờ cần được kiểm tra lại.' });
  } catch (error) { return respondError(res, error); }
}
