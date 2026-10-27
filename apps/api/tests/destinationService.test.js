import test from "node:test";
import assert from "node:assert/strict";
import { destinationConfig, destinationWindows, destinationDescription, destinationSummary } from "../../../packages/shared/destinationService.js";
import { buildDestinationSnapshot, destinationSignature, assertDestinationQuote, validateDestinationConfig } from "../src/services/destinationService.js";
import { quotePrice } from "../src/services/pricingService.js";
import { calculateWaitingTime } from "../src/services/waitingPricing.js";
const c = destinationConfig();
const input = {carType:"CAR_7", direction:"ROUND_TRIP",pickupTime:"2026-11-01T07:00:00+07:00",returnTime:"2026-11-03T12:00:00+07:00",outboundDriveMinutes:240,driveMinutes:480,distanceKm:600,destinationAnchorAddress:"Khách sạn Đà Lạt"};
const pricing={baseFare:0,pricePerKm:5000,pricePerHour:10000,minFare:100000,overnightFee:350000,overnightTriggerKm:600,overnightTriggerHours:12,gasolineSurchargePercent:20};
const db=(settings=c)=>({pricingConfig:{findFirst:async()=>pricing},tripConfig:{findFirst:async()=>({destinationServiceConfig:settings})}});
test("Vietnam arrival/return windows clip partial days and only selected days are charged",()=>{
 const windows=destinationWindows(c,input.direction,input.pickupTime,input.returnTime,input.outboundDriveMinutes);
 assert.equal(windows.length,3);assert.equal(windows[0].hours,8);assert.equal(windows[2].hours,5);
 assert.equal(windows[0].start,"2026-11-01T04:00:00.000Z");
 const s=buildDestinationSnapshot(c,{...input,destinationServiceDates:["2026-11-02"]});
 assert.equal(s.fee,800000);assert.equal(s.sessions.length,1);assert.equal(s.anchorAddress,input.destinationAnchorAddress);
 assert.match(s.standardDescription,/5 km/);assert.match(s.charterDescription,/30 km/);
 assert.ok(destinationSummary(s).includes(c.allInclusiveNotice));
});
test("one-way and same-day return trips always retain inclusive notice and cannot buy charter",async()=>{
 for(const i of [{...input,direction:"ONE_WAY",returnTime:null},{...input,returnTime:"2026-11-01T20:00:00+07:00"}]){
  const s=buildDestinationSnapshot(c,i);assert.equal(s.eligible,false);assert.equal(s.fee,0);assert.equal(s.allInclusiveNotice,c.allInclusiveNotice);
  assert.throws(()=>buildDestinationSnapshot(c,{...i,destinationServiceDates:["2026-11-01"]}),{status:400});
 }
});
test("reject duplicate, outside, malformed dates and disabled charter",()=>{
 for(const dates of [["2026-11-02","2026-11-02"],["2026-11-04"],[123],"2026-11-02",["2026-02-30"]]) assert.throws(()=>buildDestinationSnapshot(c,{...input,destinationServiceDates:dates}),{status:400});
 assert.throws(()=>buildDestinationSnapshot({...c,enabled:false},{...input,destinationServiceDates:["2026-11-02"]}),{status:400});
});
test("remove exactly the bought daytime interval, preserve nights and free waiting allowance",()=>{
 const arrival=new Date("2026-11-01T11:00:00+07:00"),end=new Date(input.returnTime);
 const normal=calculateWaitingTime(arrival,end);
 const session={start:"2026-11-02T07:00:00+07:00",end:"2026-11-02T15:00:00+07:00"};
 const charter=calculateWaitingTime(arrival,end,undefined,[session]);
 assert.equal(charter.overnightCount,normal.overnightCount);assert.equal(charter.serviceCoveredMinutes,480);
 assert.equal(charter.billableWaitMinutes,normal.billableWaitMinutes-480);
 const overlap=calculateWaitingTime(arrival,end,undefined,[{start:"2026-11-01T22:00:00+07:00",end:"2026-11-02T06:00:00+07:00"}]);
 assert.equal(overlap.serviceCoveredMinutes,0);assert.equal(overlap.billableWaitMinutes,normal.billableWaitMinutes);
});
test("fee is added to final fare once, no fuel uplift, with purchased waiting hours removed",async()=>{
 const standard=await quotePrice({...input,fuelPreference:"GASOLINE"},db());
 const charter=await quotePrice({...input,fuelPreference:"GASOLINE",destinationServiceDates:["2026-11-02"]},db());
 assert.equal(standard.ok,true);assert.equal(charter.ok,true);
 assert.equal(standard.data.waitCost-charter.data.waitCost,80000);
 assert.equal(charter.data.rawTotal,standard.data.rawTotal-96000+800000);
 assert.equal(charter.data.finalPrice,Math.round((charter.data.rawTotal-800000)/10000)*10000+800000);
 assert.equal(charter.data.destinationService.fee,800000);
});
test("configuration changes update templates, old snapshots persist and old quotes require refresh",()=>{
 const selected={...input,destinationServiceDates:["2026-11-02"]};
 const old=buildDestinationSnapshot(c,selected);const signature=destinationSignature(old);
 const edited={...c,standardRadiusKm:7,charterDailyFee:900000,title:"Phục vụ xe"};
 assert.match(destinationDescription(edited),/7 km/);
 assert.equal(old.fee,800000);assert.equal(old.standardDescription.includes("5 km"),true);
 assertDestinationQuote({destinationServiceSignature:signature},old);
 assert.throws(()=>assertDestinationQuote({destinationServiceSignature:signature},buildDestinationSnapshot(edited,selected)),{status:409});
 assert.throws(()=>assertDestinationQuote({},old),{status:409});
});
test("admin validates ranges, money, required content and unsupported fields",()=>{
 assert.equal(validateDestinationConfig(c),"");
 for(const change of [{charterDailyFee:-1},{charterDailyFee:1.5},{standardRadiusKm:0},{charterStartHour:22,charterEndHour:7},{charterHoursPerDay:20},{allInclusiveNotice:""},{enabled:"yes"},{unknownField:1}]) assert.ok(validateDestinationConfig({...c,...change}));
});


test("old trips show both reassurance notices without inventing a service package", () => {
  for (const snapshot of [null, { allInclusiveNotice: c.allInclusiveNotice, scopeNotice: c.scopeNotice }]) {
    const lines = destinationSummary(snapshot);
    assert.equal(lines.filter(line => line === c.allInclusiveNotice).length, 1);
    assert.equal(lines.filter(line => line === c.paymentNotice).length, 1);
    assert.equal(lines.some(line => line.includes("Mốc phục vụ:") || line.includes("Phụ phí:")), false);
  }
});

test("trip payment instructions remain the booked instructions after admin edits", () => {
  const booked = buildDestinationSnapshot(c, { ...input, destinationServiceDates: ["2026-11-02"] });
  const later = buildDestinationSnapshot({ ...c, paymentNotice: "Hướng dẫn mới" }, input);
  assert.equal(later.paymentNotice, "Hướng dẫn mới");
  const lines = destinationSummary(booked);
  assert.ok(lines.includes("Thanh toán trực tiếp cho tài xế sau khi hoàn thành chuyến đi"));
  assert.ok(lines.some(line => line.includes("2026-11-02") && line.includes("07:00–21:00")));
  assert.ok(lines.some(line => line.includes("800.000đ")));
  assert.equal(lines.includes(later.paymentNotice), false);
});

test('arrival day charter offers dinner and return day remains explicitly standard', () => {
 const cfg = destinationConfig({ charterDailyFee: 600000 });
 const i = { ...input, pickupTime: '2026-10-31T07:00:00+07:00', returnTime: '2026-11-01T12:00:00+07:00', outboundDriveMinutes: 94, destinationServiceDates: ['2026-10-31'] };
 const snapshot = buildDestinationSnapshot(cfg, i);
 assert.equal(snapshot.sessions[0].start, '2026-10-31T01:34:00.000Z');
 assert.equal(snapshot.sessions[0].end, '2026-10-31T14:00:00.000Z');
 assert.equal(snapshot.sessions[0].hours, 8);
 assert.equal(snapshot.fee, 532857);
 assert.ok(destinationSummary(snapshot).some(line => line.includes('2026-11-01: Tiêu chuẩn') && line.includes('07:00–12:00')));
 const waiting = calculateWaitingTime(new Date('2026-10-31T08:34:00+07:00'), new Date(i.returnTime), undefined, snapshot.sessions);
 assert.equal(waiting.serviceCoveredMinutes, 480);
 assert.equal(waiting.overnightCount, 1);
 const legacy = { ...snapshot.sessions[0], flexible: false, end: '2026-10-31T09:34:00.000Z' };
 assert.equal(calculateWaitingTime(new Date('2026-10-31T08:34:00+07:00'), new Date(i.returnTime), undefined, [legacy]).serviceCoveredMinutes, 480);
});
test('short return-day charter waives only available hours, even with night overlap', () => {
 const snapshot = buildDestinationSnapshot(c, { ...input, destinationServiceDates: ['2026-11-03'] });
 assert.equal(snapshot.sessions[0].hours, 5);
 const waiting = calculateWaitingTime(new Date('2026-11-01T11:00:00+07:00'), new Date(input.returnTime), undefined, snapshot.sessions);
 assert.equal(waiting.serviceCoveredMinutes, 300);
 const overlapping = { start: '2026-11-02T20:00:00+07:00', end: '2026-11-03T08:00:00+07:00', hours: 8, flexible: true };
 const w = calculateWaitingTime(new Date('2026-11-02T20:00:00+07:00'), new Date('2026-11-03T08:00:00+07:00'), undefined, [overlapping]);
 assert.equal(w.overnightCoveredMinutes, 480);
 assert.equal(w.serviceCoveredMinutes, 240);
 assert.equal(w.billableWaitMinutes, 0);
});

test('prorated charter uses full configured window, not eight-hour service limit', () => {
 const cfg = destinationConfig({ charterDailyFee: 600000, charterStartHour: 7, charterEndHour: 21, charterHoursPerDay: 8 });
 const base = { ...input, pickupTime: '2026-10-31T07:00:00+07:00', returnTime: '2026-11-02T12:00:00+07:00', outboundDriveMinutes: 420 };
 const s = buildDestinationSnapshot(cfg, { ...base, destinationServiceDates: ['2026-10-31','2026-11-01','2026-11-02'] });
 assert.deepEqual(s.sessions.map(i => i.fee), [300000,600000,214286]);
 assert.deepEqual(s.sessions.map(i => i.hours), [7,8,5]);
 assert.equal(s.fee, 1114286);
 assert.equal(buildDestinationSnapshot({ ...cfg, charterHoursPerDay: 4 }, { ...base, destinationServiceDates: ['2026-11-02'] }).fee, 214286);
 const changed = buildDestinationSnapshot({ ...cfg, charterStartHour: 8, charterEndHour: 20 }, { ...base, destinationServiceDates: ['2026-11-02'] });
 assert.equal(changed.fee, 200000);
});
test('frontend selected total equals backend snapshot and descriptions come from config', async () => {
 const { destinationDays, destinationSelectedFee, destinationDayText } = await import('../src/shared/destinationService.js');
 const cfg = destinationConfig({ charterDailyFee: 600000, standardName: 'Gói A', charterName: 'Gói B', standardDescription: 'A {radius}', charterDescription: 'B {radius} {hours} {start} {end}' });
 const i = { ...input, destinationServiceDates: ['2026-11-03'] };
 const s = buildDestinationSnapshot(cfg,i);
 const days = destinationDays(cfg,i.direction,i.pickupTime,i.returnTime,i.outboundDriveMinutes);
 assert.equal(destinationSelectedFee(days,i.destinationServiceDates), s.fee);
 assert.equal(s.fee, 214286);
 assert.equal(s.standardDescription,'A 5');
 assert.equal(s.charterDescription,'B 30 8 07:00 21:00');
 assert.equal(destinationDayText(days[2],true,cfg),'07:00–12:00 · Tối đa 5 giờ');
 assert.ok(!destinationSummary(s).some(line => line.includes('1 ngày ×')));
});
