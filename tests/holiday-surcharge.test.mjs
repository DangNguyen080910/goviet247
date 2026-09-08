import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { calculateHolidaySurcharge, validateHolidayConfig, isCalendarDate } from "../apps/api/src/services/holidaySurcharge.js";
import { quotePrice } from "../apps/api/src/services/pricingService.js";
const require = createRequire(import.meta.url);
const ts = require("typescript");
const config = {
  baseFare: 0, pricePerKm: 5000, pricePerHour: 10000, minFare: 350000,
  overnightFee: 100000, overnightTriggerKm: 600, overnightTriggerHours: 12,
  gasolineSurchargePercent: 20, holidaySurchargePercent: 20,
  holidayStartDate: "2026-09-01", holidayEndDate: "2026-09-02",
  holidayName: "Quốc khánh", holidayNote: "Hỗ trợ tài xế phục vụ ngày lễ.",
};
const db = c => ({pricingConfig:{findFirst:async()=>c}});
const input = {
  carType:"CAR_5", direction:"ONE_WAY", distanceKm:100, driveMinutes:120,
  pickupTime:"2026-09-01T08:00:00+07:00", fuelPreference:"ANY",
};
for (const [time,applied] of [
  ["2026-08-31T16:59:59.999Z", false],
  ["2026-08-31T17:00:00.000Z", true],
  ["2026-09-02T16:59:59.999Z", true],
  ["2026-09-02T17:00:00.000Z", false],
]) test(`Vietnam calendar boundary ${time}`,()=>{
  assert.equal(Boolean(calculateHolidaySurcharge(config,new Date(time),500000)),applied);
});
test("0% hides surcharge even on a holiday; legacy config stays unchanged",async()=>{
  assert.equal(calculateHolidaySurcharge({...config,holidaySurchargePercent:0},new Date(input.pickupTime),500000),null);
  const legacy={...config};for(const k of Object.keys(legacy))if(k.startsWith("holiday"))delete legacy[k];
  const result=await quotePrice(input,db(legacy));assert.equal(result.data.finalPrice,500000);assert.equal(result.data.holidaySurchargePercent,0);
});
for(const fuel of ["ANY","ELECTRIC","GASOLINE"]) test(`holiday and ${fuel} are additive on the same fare base`,async()=>{
  const {data}=await quotePrice({...input,fuelPreference:fuel},db(config));
  assert.equal(data.holidaySurchargeAmount,100000);
  assert.equal(data.fuelSurchargeAmount,fuel==="GASOLINE"?100000:0);
  assert.equal(data.finalPrice,fuel==="GASOLINE"?700000:600000);
});
test("minimum fare is applied before surcharges; final rounding happens once",async()=>{
  const {data}=await quotePrice({...input,distanceKm:1,fuelPreference:"GASOLINE"},db({...config,minFare:351234}));
  assert.equal(data.holidaySurchargeAmount,70247);assert.equal(data.fuelSurchargeAmount,70247);
  assert.equal(data.rawTotal,491728);assert.equal(data.finalPrice,490000);
});
test("round trip uses outbound departure, not its return date",async()=>{
  const round={...input,direction:"ROUND_TRIP",pickupTime:"2026-08-31T08:00:00+07:00",returnTime:"2026-09-01T08:00:00+07:00",outboundDriveMinutes:60};
  assert.equal((await quotePrice(round,db(config))).data.holidaySurchargeAmount,0);
  round.pickupTime="2026-09-02T08:00:00+07:00";round.returnTime="2026-09-03T08:00:00+07:00";
  assert.ok((await quotePrice(round,db(config))).data.holidaySurchargeAmount>0);
});
test("single-day and cross-year ranges work, dates do not recur every year",()=>{
  const single={...config,holidayEndDate:"2026-09-01"};
  assert.ok(calculateHolidaySurcharge(single,new Date("2026-09-01T23:59:59+07:00"),1));
  const cross={...config,holidayStartDate:"2026-12-31",holidayEndDate:"2027-01-02"};
  assert.ok(calculateHolidaySurcharge(cross,new Date("2027-01-01T12:00:00+07:00"),1));
  assert.equal(calculateHolidaySurcharge(cross,new Date("2028-01-01T12:00:00+07:00"),1),null);
});
test("description follows configured dates; quote snapshot is independent of later edits",()=>{
  const copy={...config}; const result=calculateHolidaySurcharge(copy,new Date(input.pickupTime),500000);
  assert.match(result.description,/01\/09\/2026 đến hết 02\/09\/2026 nhân dịp Quốc khánh/);
  assert.match(result.description,/Hỗ trợ tài xế/);
  copy.holidayName="Tết";copy.holidaySurchargePercent=30;
  assert.equal(result.percent,20);assert.equal(result.name,"Quốc khánh");
});
for(const patch of [
  {holidayStartDate:"2026-02-30"},{holidayStartDate:0},{holidayStartDate:null},
  {holidayEndDate:"2026-08-31"},{holidaySurchargePercent:-1},
  {holidaySurchargePercent:101},{holidaySurchargePercent:NaN},{holidaySurchargePercent:0.001},
  {holidayName:"x".repeat(101)},{holidayNote:42},
]) test(`invalid config rejected: ${JSON.stringify(patch)}`,()=>assert.ok(validateHolidayConfig({...config,...patch})));
test("calendar validates leap dates and allows disabling without any dates",()=>{
  assert.equal(isCalendarDate("2028-02-29"),true);assert.equal(isCalendarDate("2026-02-29"),false);
  assert.equal(validateHolidayConfig({holidaySurchargePercent:0}),"");
});
function adminController(existing) {
  let written;
  const fakePrisma={pricingConfig:{findUnique:async()=>existing, update:async({data})=>{written=data;return {...existing,...data};}}};
  const mocks={"@prisma/client":{default:{PrismaClient:function(){return fakePrisma;}}},
    "../services/holidaySurcharge.js":{validateHolidayConfig},
    "../services/pricingService.js":{quotePrice},"../services/tripConfigService.js":{}};
  const source=readFileSync(new URL("../apps/api/src/controllers/pricingController.js",import.meta.url),"utf8");
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,allowJs:true}}).outputText;
  const ctx={exports:{},console,require:key=>mocks[key]};vm.runInNewContext(js,ctx);
  return {async update(body){const res={code:200,status(code){this.code=code;return this;},json(value){this.body=value;return this;}};
    await ctx.exports.updatePricingConfig({params:{carType:"CAR_5"},body},res);return res;},get written(){return written;}};
}
test("admin PATCH validates merged config and preserves holiday values on old-client edits",async()=>{
  const api=adminController(config);assert.equal((await api.update({baseFare:1000})).code,200);
  assert.equal(api.written.holidaySurchargePercent,undefined);
  assert.equal((await api.update({holidayStartDate:"2026-09-03"})).code,400);
});
test("admin saves decimal percentage, calendar dates, and editable text",async()=>{
  const api=adminController(config);assert.equal((await api.update({holidaySurchargePercent:12.5,holidayName:"  Tết  ",holidayNote:"Ghi chú mới"})).code,200);
  assert.equal(api.written.holidayName,"Tết");assert.equal(api.written.holidaySurchargePercent,12.5);
});
