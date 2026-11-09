import { buildAccountingExcel } from './accountingExcel.js';

// VIN-HOADON Hoadon_FileMau.xlsx: preserve all 27 headers and their order.
export const invoiceHeaders = ['Mã hóa đơn', 'Mã số thuế', 'Mã QHNSNN', 'Tên đơn vị, tổ chức', 'Người mua hàng', 'Số CCCD', 'Số hộ chiếu', 'Địa chỉ', 'Số điện thoại', 'Email', 'Mã tiền tệ', 'Tỷ giá', 'Hình thức thanh toán', 'Số tài khoản ngân hàng', 'Tên ngân hàng', 'Tiền chiết khấu', 'Ghi chú', 'Loại hàng hóa', 'Tên hàng hóa', 'Đơn vị tính', 'Số lượng', 'Đơn giá', 'Thành tiền', 'VAT', 'Tổng tiền hàng', 'Tổng tiền thuế', 'Tổng tiền thanh toán'];

// Verified by a basic-template import on VIN-HOADON (2026-11-09):
// code 20 renders TM/CK/Bù trừ. Code 5 renders Không thu tiền;
// the legacy spreadsheet comment is not the current lookup mapping.
export const invoicePaymentMethod = Object.freeze({ code: 20, label: 'TM/CK/Bù trừ' });

// Keep canonical E.164 phones in profiles; VIN's basic importer needs domestic text.
export function normalizeInvoicePhone(value) {
  const phone = String(value ?? '').trim().replace(/[\s().-]/g, '');
  if (!phone) return '';
  const domestic = phone.startsWith('+84') ? `0${phone.slice(3)}`
    : phone.startsWith('0084') ? `0${phone.slice(4)}`
    : /^84\d{9,10}$/.test(phone) ? `0${phone.slice(2)}` : phone;
  return /^(?:0[35789]\d{8}|02\d{9})$/.test(domestic) ? domestic : null;
}

export function invoiceIssues(items) {
  return items.flatMap(i => {
    const missing = [];
    if (!i.driverId || !i.driverName || i.driverName === 'Chưa cập nhật') missing.push('họ tên tài xế');
    if (!/^\d{12}$/.test(i.citizenId || '')) missing.push('CCCD 12 số');
    if (!i.residentialAddress?.trim()) missing.push('địa chỉ cư trú');
    if (normalizeInvoicePhone(i.driverPhone) === null) missing.push('SĐT Việt Nam hợp lệ để nhập VIN-HOADON');
    if (i.note || !Number.isFinite(i.commissionGross) || i.commissionGross <= 0) missing.push('phí hoa hồng hợp lệ');
    return missing.length ? [{ tripId: i.tripId, driverName: i.driverName, missing }] : [];
  });
}

export async function buildCommissionInvoiceExcel(items) {
  if (invoiceIssues(items).length) throw new Error('Thiếu thông tin lập hóa đơn');
  return buildAccountingExcel([invoiceHeaders, ...items.map(i => [
    `GV247-${i.tripId}`, i.citizenId, '', i.driverName, i.driverName, i.citizenId, '', i.residentialAddress,
    normalizeInvoicePhone(i.driverPhone), '', 'VND', 1, invoicePaymentMethod.code, '', '', 0, `Hoa hồng chuyến ${i.tripId}`,
    1, `Phí dịch vụ kết nối chuyến ${i.tripId}`, 'Chuyến', 1, i.commissionNet,
    i.commissionNet, i.vatRate, i.commissionNet, i.commissionVat, i.commissionGross,
  ])], { title: 'File mẫu', numericColumns: [11, 12, 15, 17, 20, 21, 22, 23, 24, 25, 26] });
}
