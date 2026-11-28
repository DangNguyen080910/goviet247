import test from 'node:test';
import assert from 'node:assert/strict';
import { driverTourSummary } from '../src/shared/driverTourSummary.js';
import { quotePrice } from '../src/services/pricingService.js';
import { destinationConfig, destinationQuoteSummary } from '../src/shared/destinationService.js';
import { assertDestinationQuote, buildDestinationSnapshot } from '../src/services/destinationService.js';
const config = destinationConfig({ charterDailyFee: 600000 });
const input = { carType: 'CAR_5', direction: 'ROUND_TRIP', pickupTime: '2026-11-01T07:00:00+07:00', returnTime: '2026-11-05T18:00:00+07:00', outboundDriveMinutes: 240, driveMinutes: 480, distanceKm: 600, destinationAnchorAddress: 'Khách sạn A' };
const db = { pricingConfig: { findFirst: async () => ({ baseFare: 50000, pricePerKm: 4800, pricePerHour: 10000, minFare: 100000, overnightFee: 350000, overnightTriggerKm: 600, overnightTriggerHours: 12, gasolineSurchargePercent: 20 }) }, tripConfig: { findFirst: async () => ({ destinationServiceConfig: config }) } };
for (const dates of [[], ['2026-11-03']]) test(`five-day driver schedule: ${dates.length} charter days`, async () => {
 const request = { ...input, destinationServiceDates: dates };
 const result = await quotePrice(request, db);
 assert.equal(result.ok, true);
 const data = result.data, s = data.destinationService;
 assert.equal(s.tourDisplay.total, data.waitCost + data.overnightCost + s.fee);
 assert.equal(s.tourDisplay.overnightCount, 4);
 const lines = driverTourSummary(s);
 assert.equal(lines.filter(line => /^0[1-5]\/11\/2026:/.test(line)).length, 0);
 assert.ok(lines.includes(s.standardDescription));
 if (dates.length) assert.ok(lines.includes(`${s.charterName} theo lịch đã xác nhận`));
 assert.equal(lines.filter(line => line.startsWith('Phụ phí phục vụ tour:')).length, 1);
 assert.equal(lines.some(line => line.startsWith('Phụ phí:')), false);
 assert.ok(lines.includes(config.allInclusiveNotice));
 assertDestinationQuote({ destinationServiceSignature: data.destinationServiceSignature }, buildDestinationSnapshot(config, request));
});
test('legacy trips do not invent combined fees or a service schedule', () => {
 assert.equal(driverTourSummary(null).some(line => line.startsWith('Phụ phí phục vụ tour:')), false);
 const old = buildDestinationSnapshot(config, { ...input, destinationServiceDates: ['2026-11-03'] });
 const lines = driverTourSummary(old);
 assert.equal(lines.some(line => line.startsWith('Phụ phí phục vụ tour:')), false);
 assert.ok(lines.includes(`Phí Bao xe đã xác nhận: ${old.fee.toLocaleString('vi-VN')}đ`));
});

test('all-charter two-day trip omits the standard block and retains booked terms and fees', async () => {
 const request = { ...input, returnTime: '2026-11-02T15:00:00+07:00', destinationServiceDates: ['2026-11-01', '2026-11-02'] };
 const result = await quotePrice(request, db);
 assert.equal(result.ok, true);
 const snapshot = result.data.destinationService;
 const before = JSON.stringify(snapshot);
 for (const hidePaymentAndScope of [false, true]) {
  const lines = driverTourSummary(snapshot, { hidePaymentAndScope });
  assert.equal(lines.includes(snapshot.standardDescription), false);
  assert.equal(lines.includes(`${snapshot.standardName} — Đã bao gồm trong giá`), false);
  assert.equal(lines.some(line => line.startsWith('Giờ hỗ trợ Tiêu chuẩn:')), false);
  assert.ok(lines.includes(snapshot.charterDescription));
  assert.equal(lines.filter(line => /^0[12]\/11\/2026:/.test(line)).length, 0);
  assert.ok(lines.includes(snapshot.charterName));
  assert.ok(lines.includes(snapshot.allInclusiveNotice));
  assert.equal(lines.filter(line => line.startsWith('Phụ phí phục vụ tour:')).length, 1);
  assert.equal(lines.includes(snapshot.paymentNotice), !hidePaymentAndScope);
  assert.equal(lines.includes(snapshot.scopeNotice), !hidePaymentAndScope);
 }
 assert.equal(JSON.stringify(snapshot), before);
});
test('standard-only and mixed schedules retain only applicable descriptions', async () => {
 for (const dates of [[], ['2026-11-02']]) {
  const result = await quotePrice({ ...input, destinationServiceDates: dates }, db);
  const snapshot = result.data.destinationService;
  const lines = driverTourSummary(snapshot, { hidePaymentAndScope: true });
  assert.ok(lines.includes(snapshot.standardDescription));
  assert.equal(lines.includes(snapshot.charterDescription), dates.length > 0);
 }
});

test('two-day Bao xe shows only saved service dates and combines the two amounts for the driver', () => {
 const snapshot = {
  version: 5, eligible: true, selectionMode: 'CHARTER', fee: 985714,
  sessions: [
   { date: '2026-11-30', start: '2026-11-30T00:00:00Z', end: '2026-11-30T14:00:00Z' },
   { date: '2026-12-01', start: '2026-12-01T00:00:00Z', end: '2026-12-01T09:00:00Z' },
  ],
  tourDisplay: { overnightCount: 1, overnightCost: 300000, returnTime: '2026-12-01T09:00:00Z', total: 1285714 },
 };
 assert.deepEqual(destinationQuoteSummary(snapshot).slice(-3), [
  'Giá trên đã bao gồm',
  'Phí Bao xe từ 30/11/2026 đến 01/12/2026: 985.714đ',
  'Phí Ăn nghỉ tài xế · 1 đêm: 300.000đ',
 ]);
 assert.deepEqual(driverTourSummary(snapshot).filter(line => line.startsWith('Phí ')),
  ['Phí Bao xe và Ăn nghỉ tài xế từ 30/11/2026 đến 01/12/2026: 1.285.714đ']);
 assert.equal(driverTourSummary({...snapshot, sessions: [snapshot.sessions[0]], tourDisplay: null}).at(-1),
  'Phí Bao xe ngày 30/11/2026: 985.714đ');
 assert.equal(driverTourSummary({...snapshot, selectionMode: 'STANDARD', sessions: []}).at(-1),
  'Phí Ăn nghỉ tài xế · 1 đêm: 300.000đ');
});
