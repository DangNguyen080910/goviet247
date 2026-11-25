import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { quotePrice } from '../src/services/pricingService.js';
import { calculateWaitingTime, calculateTieredWaitingCost, validateWaitingRules, validateOvernightWaitingPrice } from '../src/services/waitingPricing.js';
import { createBookingQuoteService } from '../src/services/bookingQuotes.js';

// Reproduce the reported 174.6 km route using the supplied production settings.
// Every dependency below is in memory; these tests never read or write a live DB.
const rules = { freeWaitingMinutes: 60, nightStartHour: 22, nightEndHour: 6, nightMinWaitHours: 5 };
const tiers = [[0,50,8000,60000],[50,75,6000,40000],[75,100,5500,35000],[100,150,5300,30000],
  [150,200,5200,20000],[200,300,5100,15000],[300,null,5000,10000]]
  .map(([from,to,pricePerKm,pricePerWaitHour]) => ({from,to,pricePerKm,pricePerWaitHour}));
const config = { baseFare: 50000, pricePerKm: 10000, pricePerHour: 6900, minFare: 100000,
  overnightFee: 300000, overnightTriggerKm: 600, overnightTriggerHours: 12, gasolineSurchargePercent: 20,
  holidayPeriods: [], kmTiers: tiers, roundTripWaitingConfig: {...rules, overnightPricePerHour: 20000} };
const input = { carType: 'CAR_5', direction: 'ROUND_TRIP', fuelPreference: 'ANY', distanceKm: 174.6,
  pickupTime: '2026-11-27T07:00:00+07:00', returnTime: '2026-11-29T15:00:00+07:00',
  outboundDriveMinutes: 99, driveMinutes: 199, pickupAddress: 'Địa chỉ A', dropoffAddress: 'Địa chỉ B', stops: ['Địa chỉ B'] };
const db = pricing => ({ pricingConfig: { findFirst: async () => pricing },
  tripConfig: { findFirst: async () => ({ regionalPricingConfig: {NORTH:0,CENTRAL:0,SOUTH:0}, destinationServiceConfig: {charterDailyFee:600000} }) } });
async function quote(changes = {}, pricing = config) {
  const result = await quotePrice({...input, ...changes}, db(pricing));
  assert.equal(result.ok, true, result.message);
  return result.data;
}

test('reported route: an extra day adds 16 waiting hours and one night, not a growing tier floor', async () => {
  const first = await quote({returnTime: '2026-11-28T15:00:00+07:00'});
  const second = await quote();
  assert.equal(first.finalPrice, 1870000);
  assert.equal(second.finalPrice, 2490000);
  assert.equal(second.finalPrice-first.finalPrice, 620000);
  assert.deepEqual([first.billableWaitHours, second.billableWaitHours], [22,38]);
  assert.deepEqual([first.overnightCount, second.overnightCount], [1,2]);
  assert.deepEqual([first.overnightCoveredMinutes, second.overnightCoveredMinutes], [480,960]);
  assert.deepEqual([first.waitCost, second.waitCost], [440000,760000]);
  for (const data of [first,second]) {
    assert.equal(data.distanceCost, 1080420);
    assert.equal(data.waitingTierAdjustment, 0);
    assert.equal(data.nightTransitionAdjustment, 0);
    assert.equal(data.pricePerHour, 20000);
    assert.equal(data.waitingPricingMode, 'OVERNIGHT_FLAT');
    assert.equal(data.destinationService.fee, 0);
  }
});

for (const carType of ['CAR_5','CAR_7','CAR_16']) {
  for (const overnightPricePerHour of [undefined,null]) {
    test(`${carType}: missing/null flat rate keeps the legacy price`, async () => {
      const pricing = {...config, roundTripWaitingConfig: {...rules, overnightPricePerHour}};
      const data = await quote({carType}, pricing);
      assert.equal(data.finalPrice, 3330000);
      assert.equal(data.waitingTierAdjustment, 839580);
      assert.equal(data.waitingPricingMode, 'DISTANCE_TIER');
    });
  }
}

test('same-day and short midnight crossings keep the old hourly tiers and floor', async () => {
  for (const returnTime of ['2026-11-27T12:00:00+07:00','2026-11-27T21:00:00+07:00','2026-11-28T02:59:00+07:00']) {
    const old = await quote({distanceKm:50.1,returnTime}, {...config,roundTripWaitingConfig:rules});
    const current = await quote({distanceKm:50.1,returnTime});
    assert.equal(current.overnightCount,0);
    assert.equal(current.finalPrice, old.finalPrice);
    assert.equal(current.waitCost, old.waitCost);
    assert.equal(current.waitingPricingMode, 'DISTANCE_TIER');
  }
});

for (const boundary of [50,75,100,150,200,300]) test(`overnight fares do not drop at ${boundary} km`, async () => {
  for (const returnTime of ['2026-11-28T03:00:00+07:00','2026-11-28T15:00:00+07:00','2026-11-29T15:00:00+07:00']) {
    const amounts = [];
    for (const distanceKm of [boundary-0.1,boundary,boundary+0.1]) amounts.push((await quote({distanceKm,returnTime})).rawTotal);
    assert.ok(amounts[0] <= amounts[1] && amounts[1] <= amounts[2], `${returnTime}: ${amounts}`);
  }
});

test('first-night transition does not discount a trip when return is moved a few minutes later', async () => {
  for (const distanceKm of [1,50,50.1,75.1,100.1,150.1,174.6,200.1,300.1,600]) {
    let previous = -Infinity;
    for (const returnTime of ['2026-11-28T02:58:00+07:00','2026-11-28T02:59:59.999+07:00',
      '2026-11-28T03:00:00+07:00','2026-11-28T03:01:00+07:00','2026-11-28T06:00:00+07:00','2026-11-28T15:00:00+07:00']) {
      const data = await quote({distanceKm,returnTime});
      assert.ok(data.rawTotal >= previous, `${distanceKm} km ${returnTime}: ${data.rawTotal} < ${previous}`);
      previous = data.rawTotal;
    }
  }
  const short = await quote({distanceKm:50,returnTime:'2026-11-28T03:00:00+07:00'});
  assert.ok(short.nightTransitionAdjustment > 0);
  assert.equal(short.waitingTierAdjustment,0);
  const long = await quote({distanceKm:50});
  assert.equal(long.nightTransitionAdjustment,0,'transition protection is exhausted, never multiplied by days');
});

test('flat waiting fares stay nondecreasing throughout three days, including later night thresholds', async () => {
  for (const distanceKm of [50.1,174.6,300.1]) {
    let previous = -Infinity;
    const start = new Date('2026-11-27T09:00:00+07:00').getTime();
    for (let minutes=0;minutes<=72*60;minutes+=30) {
      const data = await quote({distanceKm,returnTime:new Date(start+minutes*60000).toISOString()});
      assert.ok(data.rawTotal >= previous, `${distanceKm} km minute ${minutes}: ${data.rawTotal} < ${previous}`);
      previous = data.rawTotal;
    }
  }
});

test('zero means zero hourly charges; transition protection remains explicit', async () => {
  const data = await quote({}, {...config,roundTripWaitingConfig:{...rules,overnightPricePerHour:0}});
  assert.equal(data.pricePerHour,0);
  assert.equal(data.hourlyWaitCost,0);
  assert.equal(data.waitingTierAdjustment,0);
  assert.ok(Number.isFinite(data.waitCost));
});

test('arrival inside an overnight window qualifies from arrival, not from 22:00', () => {
  const arrival = new Date('2026-11-28T00:30:00+07:00');
  const before = calculateWaitingTime(arrival,new Date('2026-11-28T05:29:59.999+07:00'),rules);
  const after = calculateWaitingTime(arrival,new Date('2026-11-28T05:30:00+07:00'),rules);
  assert.equal(before.firstOvernightAt,null);
  assert.equal(after.firstOvernightAt,'2026-11-27T22:30:00.000Z');
  assert.equal(after.overnightCount,1);
});

test('charter removes its bought hours once; nights and the single free allowance remain intact', async () => {
  const normal = await quote();
  const charter = await quote({destinationServiceDates:['2026-11-28']});
  assert.equal(normal.billableWaitHours-charter.billableWaitHours,8);
  assert.equal(normal.waitCost-charter.waitCost,160000);
  assert.equal(charter.destinationService.fee,600000);
  assert.equal(charter.rawTotal-normal.rawTotal,440000);
  assert.equal(charter.overnightCount,2);
  assert.equal(charter.freeWaitingMinutes,60);
});

test('fuel and holidays still use the same new fare base, and rounding happens once', async () => {
  const holiday = {...config,holidayPeriods:[{id:'test',enabled:true,holidaySurchargePercent:10,
    holidayStartDate:'2026-11-27',holidayEndDate:'2026-11-27',holidayName:'Thử nghiệm'}]};
  const standard = await quote();
  const data = await quote({fuelPreference:'GASOLINE'},holiday);
  assert.equal(data.fuelSurchargeAmount,Math.round(standard.rawTotal*0.2));
  assert.equal(data.holidaySurchargeAmount,Math.round(standard.rawTotal*0.1));
  assert.equal(data.rawTotal,standard.rawTotal+data.fuelSurchargeAmount+data.holidaySurchargeAmount);
  assert.equal(data.finalPrice,Math.round(data.rawTotal/10000)*10000);
});

test('one-way pricing is unchanged even when a flat overnight waiting rate is configured', async () => {
  const changes = {direction:'ONE_WAY',returnTime:null,distanceKm:650};
  const current = await quote(changes);
  const old = await quote(changes,{...config,roundTripWaitingConfig:rules});
  assert.equal(current.finalPrice,old.finalPrice);
  assert.equal(current.waitCost,0);
});

for (const value of [-1,1.5,'20000','',false,{},Infinity,NaN,2147483648]) test(`invalid optional waiting rate: ${JSON.stringify(value)}`, () => {
  assert.ok(validateWaitingRules({...rules,overnightPricePerHour:value}));
});
test('flat rate validation allows absent/null/zero but prevents later nights reducing the fare', () => {
  for (const overnightPricePerHour of [undefined,null,0,20000]) assert.equal(validateWaitingRules({...rules,overnightPricePerHour}),'');
  assert.equal(validateOvernightWaitingPrice({...rules,overnightPricePerHour:20000},300000),'');
  assert.ok(validateOvernightWaitingPrice({...rules,overnightPricePerHour:20000},99999));
  assert.equal(validateOvernightWaitingPrice(rules,0),'');
});

function adminFixture(existing = structuredClone(config)) {
  let written;
  const fake = {pricingConfig:{findUnique:async()=>existing,update:async({data})=>{written=data;return {...existing,...data};}}};
  const ts = createRequire(import.meta.url)('typescript');
  const source = readFileSync(new URL('../src/controllers/pricingController.js',import.meta.url),'utf8');
  const modules = {'@prisma/client':{default:{PrismaClient:function(){return fake;}}},
    '../services/waitingPricing.js':{validateWaitingRules,validateOvernightWaitingPrice},
    '../services/holidaySurcharge.js':{validateHolidayConfig:()=>'',validateHolidayPeriods:()=>''}};
  const context = {exports:{},console,require:name=>modules[name]||{}};
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
  return {async update(body) {
    const res={code:200,status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
    await context.exports.updatePricingConfig({params:{carType:'CAR_5'},body},res);
    return res;
  }, get written(){return written;}};
}
test('older admin saves preserve the configured flat rate; explicit null clears it', async () => {
  const oldClient = adminFixture();
  assert.equal((await oldClient.update({roundTripWaitingConfig:rules})).code,200);
  assert.equal(oldClient.written.roundTripWaitingConfig.overnightPricePerHour,20000);
  const clear = adminFixture();
  assert.equal((await clear.update({roundTripWaitingConfig:{...rules,overnightPricePerHour:null}})).code,200);
  assert.equal(clear.written.roundTripWaitingConfig.overnightPricePerHour,null);
  const untouched = adminFixture();
  assert.equal((await untouched.update({baseFare:60000})).code,200);
  assert.equal(untouched.written.roundTripWaitingConfig,undefined);
});
test('admin rejects unsafe night/rate combinations on edits to either field', async () => {
  const fee = adminFixture();
  assert.equal((await fee.update({overnightFee:99999})).code,400);
  assert.equal(fee.written,undefined);
  const rate = adminFixture();
  assert.equal((await rate.update({roundTripWaitingConfig:{...rules,overnightPricePerHour:100000}})).code,400);
  assert.equal(rate.written,undefined);
});

test('held quotes survive enabling the new rate; released clients can book without any new fields', async () => {
  const records = new Map();
  const pricing = {...config,roundTripWaitingConfig:rules};
  const fake = {...db(pricing),bookingQuote:{create:async({data})=>records.set(data.tokenHash,data),findUnique:async({where})=>records.get(where.tokenHash)}};
  const service = createBookingQuoteService({db:fake,knownPlace:()=>null,
    search:async address=>[{placeId:address==='Địa chỉ A'?'goong|a':'goong|b',fullAddress:address}],
    detail:async id=>({fullAddress:id==='goong|a'?'Địa chỉ A':'Địa chỉ B',lat:id==='goong|a'?10:11,lng:106}),
    route:async()=>({distanceKm:174.6,durationMinutes:199,outboundDurationMinutes:99,returnDurationMinutes:100})});
  const oldData = (await quotePrice(input,fake)).data;
  const verified = await service.verifiedRoute(input);
  const token = await service.issue(input,oldData,verified);
  pricing.roundTripWaitingConfig = {...rules,overnightPricePerHour:20000};
  const held = await service.booking({...input,...token});
  assert.equal(held.pricing.totalPrice,3330000);
  assert.equal(held.pricing.destinationService.tourDisplay.waitCost,1599580);
  const legacy = await service.booking(input);
  assert.equal(legacy.pricing.totalPrice,2490000);
  assert.equal(oldData.finalPrice,3330000);
});

test('flat helper has no growing kilometre-tier adjustment for repeated extra days', () => {
  const cost = km => tiers.reduce((sum,t)=>sum+Math.round(Math.max(0,Math.min(km,t.to??Infinity)-t.from)*t.pricePerKm),0);
  const amounts = [38,54,70].map(hours=>calculateTieredWaitingCost(174.6,hours,tiers,6900,cost,
    {count:(hours-6)/16,pricePerHour:20000,fee:300000,beforeNightHours:18}));
  assert.deepEqual(amounts.map(a=>a.waitCost),[760000,1080000,1400000]);
  assert.ok(amounts.every(a=>a.waitingTierAdjustment===0 && a.nightTransitionAdjustment===0));
});

function webFormFunctions() {
  const ts = createRequire(import.meta.url)('typescript');
  const source = readFileSync(new URL('../../web/src/pages/admin/AdminConfig.jsx',import.meta.url),'utf8');
  const ast = ts.createSourceFile('AdminConfig.jsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);
  const fragments = [];
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && ['buildPayloadFromForm','buildKmTiersPayload','validateKmTiers'].includes(node.name?.text)) fragments.push(node.getText(ast));
    if (ts.isVariableDeclaration(node) && node.name.getText(ast)==='validatePricingItem') fragments.push('const '+node.getText(ast)+';');
    ts.forEachChild(node,visit);
  }
  visit(ast);
  const ctx = {};
  vm.runInNewContext(fragments.join('\n')+'\nthis.build=buildPayloadFromForm;this.validate=validatePricingItem;',ctx);
  return ctx;
}
test('admin form: clearing the field sends null, while explicit zero stays zero', () => {
  const web = webFormFunctions();
  const formConfig = {...config,kmTiers:tiers.map(tier=>({...tier,to:tier.to??''}))};
  for (const [raw,expected] of [['',null],[null,null],['0',0],['20000',20000]]) {
    const item = {...formConfig,roundTripWaitingConfig:{...rules,overnightPricePerHour:raw}};
    assert.equal(web.validate(item),'');
    assert.equal(web.build(item).roundTripWaitingConfig.overnightPricePerHour,expected);
  }
  assert.match(web.validate({...formConfig,overnightFee:99999}),/Phụ phí mỗi đêm/);
});
