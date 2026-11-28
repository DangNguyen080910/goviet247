import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {buildDestinationSnapshot,destinationSignature} from '../src/services/destinationService.js';
import {quotePrice} from '../src/services/pricingService.js';
import {createBookingQuoteService,quoteRequestHash} from '../src/services/bookingQuotes.js';
import {destinationConfig,destinationSummary,destinationQuoteSummary,destinationPackageLabel} from '../src/shared/destinationService.js';
import {driverTourSummary} from '../src/shared/driverTourSummary.js';
import {riderPackageLines} from '../src/shared/riderTripPricing.js';

const c=destinationConfig({charterDailyFee:600000,charterName:'Bao xe'});
const request={pickupAddress:'A',dropoffAddress:'B',stops:['B'],carType:'CAR_5',direction:'ROUND_TRIP',fuelPreference:'ANY',
 pickupTime:'2099-01-01T07:00:00+07:00',returnTime:'2099-01-03T15:00:00+07:00',outboundDriveMinutes:99,driveMinutes:199,distanceKm:174.6,destinationAnchorAddress:'B'};
const pricing={baseFare:50000,pricePerKm:5000,pricePerHour:10000,minFare:100000,overnightFee:200000,overnightTriggerKm:600,overnightTriggerHours:12,gasolineSurchargePercent:20,
 roundTripWaitingConfig:{freeWaitingMinutes:60,nightStartHour:22,nightEndHour:6,nightMinWaitHours:5,overnightPricePerHour:20000}};
const db={pricingConfig:{findFirst:async()=>pricing},tripConfig:{findFirst:async()=>({destinationServiceConfig:c,regionalPricingConfig:{NORTH:0,CENTRAL:0,SOUTH:0}})}};

test('whole-trip charter derives every service date and ignores stale/partial client date selections',()=>{
 const snapshot=buildDestinationSnapshot(c,{...request,destinationServiceMode:'CHARTER',destinationServiceDates:['2099-01-02']});
 assert.equal(snapshot.version,5);assert.equal(snapshot.selectionMode,'CHARTER');
 assert.deepEqual(snapshot.sessions.map(s=>s.date),['2099-01-01','2099-01-02','2099-01-03']);
 assert.equal(snapshot.fee, 2471429);
 const longer=buildDestinationSnapshot(c,{...request,returnTime:'2099-01-04T15:00:00+07:00',destinationServiceMode:'CHARTER'});
 assert.equal(longer.sessions.length,4);
 assert.equal(longer.sessions.at(-1).date,'2099-01-04');
 const standard=buildDestinationSnapshot(c,{...request,destinationServiceMode:'STANDARD',destinationServiceDates:['2099-01-02']});
 assert.equal(standard.sessions.length,0);assert.equal(standard.fee,0);
});

test('new Bao xe charges for all elapsed minutes and keeps overnight costs separate', async () => {
 const input = { ...request, pickupTime: '2099-01-01T14:00:00+07:00',
   returnTime: '2099-01-02T19:00:00+07:00', outboundDriveMinutes: 60,
   returnDriveMinutes: 60, driveMinutes: 120 };
 const standard = await quotePrice({...input,destinationServiceMode:'STANDARD'},db);
 const charter = await quotePrice({...input,destinationServiceMode:'CHARTER'},db);
 for (const result of [standard,charter]) {
   assert.equal(result.ok,true);
   assert.equal(result.data.waitCost,0);
   assert.equal(result.data.overnightCount,1);
   assert.equal(result.data.overnightCost,200000);
 }
 assert.equal(standard.data.destinationService.fee,0);
 assert.equal(charter.data.destinationService.fee,1285714);
 assert.equal(charter.data.rawTotal-standard.data.rawTotal,1285714);
});

for(const mode of [null,'all','',true,{},['CHARTER']])test(`reject invalid mode ${JSON.stringify(mode)}`,()=>{
 assert.throws(()=>buildDestinationSnapshot(c,{...request,destinationServiceMode:mode}),{status:400});
});
test('same-day Bao xe includes the drive home after 21:00; one-way and disabled service reject it',()=>{
 const sameDay = {...request, pickupTime:'2099-01-01T14:00:00+07:00',returnTime:'2099-01-01T22:00:00+07:00',
   outboundDriveMinutes:60,returnDriveMinutes:60,driveMinutes:120,destinationServiceMode:'CHARTER'};
 assert.equal(buildDestinationSnapshot(c,sameDay).fee,385714);
 assert.throws(()=>buildDestinationSnapshot(c,{...sameDay,direction:'ONE_WAY',returnTime:null}),{status:400});
 assert.throws(()=>buildDestinationSnapshot({...c,enabled:false},sameDay),{status:400});
});

test('charter pricing uses the configured span and charges an itinerary entirely outside those hours', () => {
 const input = {...request, pickupTime:'2099-01-01T01:00:00+07:00', returnTime:'2099-01-01T04:00:00+07:00',
   outboundDriveMinutes:60, returnDriveMinutes:60, driveMinutes:120, destinationServiceMode:'CHARTER'};
 const snapshot = buildDestinationSnapshot(c, input);
 assert.equal(snapshot.eligible, true);
 assert.equal(snapshot.fee, 171429);
 assert.equal(buildDestinationSnapshot({...c, charterStartHour:8, charterEndHour:20}, input).fee, 200000);
 assert.equal(buildDestinationSnapshot({...c, charterHoursPerDay:2}, input).fee, snapshot.fee);
 assert.throws(() => buildDestinationSnapshot({...c, charterStartHour:21, charterEndHour:21}, input), /Mốc giờ quy đổi/);
});

test('days outside the configured service window do not become invented charter sessions',()=>{
 const snapshot=buildDestinationSnapshot(c,{...request,pickupTime:'2099-01-01T22:00:00+07:00',outboundDriveMinutes:60,returnTime:'2099-01-03T06:00:00+07:00',destinationServiceMode:'CHARTER'});
 assert.deepEqual(snapshot.days.map(d=>d.date),['2099-01-01','2099-01-02','2099-01-03']);
 assert.deepEqual(snapshot.sessions.map(s=>s.date),['2099-01-02']);
 assert.equal(destinationPackageLabel(snapshot),'Bao xe');
});

test('legacy date contracts and golden request hash stay byte-compatible',()=>{
 const snapshot=buildDestinationSnapshot(c,{...request,destinationServiceDates:['2099-01-02']});
 assert.equal(snapshot.version,3);assert.equal(snapshot.selectionMode,undefined);
 assert.deepEqual(snapshot.sessions.map(s=>s.date),['2099-01-02']);
 assert.equal(quoteRequestHash({...request,destinationServiceDates:['2099-01-02']}),'a874ed1af0d8458302d72b20179a81c0a8565733ec5065bd2ab0ba75bc79c850');
});

test('new held quotes bind to package mode and schedule; ignored client dates cannot lower the package',async()=>{
 const records=new Map();const fake={...db,bookingQuote:{create:async({data})=>records.set(data.tokenHash,data),findUnique:async({where})=>records.get(where.tokenHash)}};
 const service=createBookingQuoteService({db:fake,price:()=>{throw Error('held quote must not reprice');}});
 const input={...request,destinationServiceMode:'CHARTER'};
 const priced=await quotePrice(input,db);assert.equal(priced.ok,true);
 const held=await service.issue(input,priced.data,{distanceKm:174.6});
 assert.equal((await service.booking({...input,...held,destinationServiceDates:[]})).pricing.totalPrice,priced.data.finalPrice);
 for(const change of [{destinationServiceMode:'STANDARD'},{returnTime:'2099-01-04T15:00:00+07:00'},{carType:'CAR_7'}]){
  await assert.rejects(service.booking({...input,...held,...change}),{status:409});
 }
});

test('an unexpired whole-trip quote issued with the 24-hour divisor preserves its price', async () => {
 const records = new Map();
 const fake = {...db, bookingQuote:{
  create: async ({data}) => records.set(data.tokenHash, data),
  findUnique: async ({where}) => records.get(where.tokenHash),
 }};
 const service = createBookingQuoteService({db:fake, price:() => {throw Error('held quote must not reprice');}});
 const input = {...request, destinationServiceMode:'CHARTER'};
 const fresh = (await quotePrice(input, db)).data;
 const previousFee = 1441667;
 const previousSnapshot = {...fresh.destinationService, fee:previousFee};
 const previousPrice = Math.round((fresh.rawTotal - fresh.destinationService.fee + previousFee) / 10000) * 10000;
 const token = await service.issue(input, {...fresh, finalPrice:previousPrice,
  destinationService:previousSnapshot, destinationServiceSignature:destinationSignature(previousSnapshot)}, {distanceKm:174.6});
 const booked = await service.booking({...input, ...token});
 assert.ok(previousPrice < fresh.finalPrice);
 assert.equal(booked.pricing.totalPrice, previousPrice);
 assert.equal(booked.pricing.destinationService.fee, previousFee);
});

test('old held partial-day quotes still book without silently expanding their contract',async()=>{
 const records=new Map();const fake={...db,bookingQuote:{create:async({data})=>records.set(data.tokenHash,data),findUnique:async({where})=>records.get(where.tokenHash)}};
 const service=createBookingQuoteService({db:fake,price:()=>{throw Error('old held quote must not reprice');}});
 const input={...request,destinationServiceDates:['2099-01-02']};
 const priced=await quotePrice(input,db);const token=await service.issue(input,priced.data,{distanceKm:174.6});
 const saved=await service.booking({...input,...token});
 assert.equal(saved.pricing.totalPrice,priced.data.finalPrice);
 assert.deepEqual(saved.pricing.destinationService.sessions.map(s=>s.date),['2099-01-02']);
 assert.equal(saved.pricing.destinationService.selectionMode,undefined);
});

for(const destinationServiceMode of ['STANDARD','CHARTER'])test(`${destinationServiceMode}: customer and driver show only the selected package and itemized fees`,async()=>{
 const result=await quotePrice({...request,destinationServiceMode},db);assert.equal(result.ok,true);
 const snapshot=result.data.destinationService,before=JSON.stringify(snapshot);
 const customer=destinationQuoteSummary(snapshot,c),driver=driverTourSummary(snapshot,{hidePaymentAndScope:true});
 const label=destinationServiceMode==='CHARTER'?c.charterName:c.standardName;
 assert.deepEqual(riderPackageLines(snapshot),[label]);assert.ok(customer.includes(label));assert.ok(driver.includes(label));
 assert.doesNotMatch(customer.join('\n'),/Phụ phí|600[.,]000|\+\d|Đã bao gồm trong giá|2099-|\d{2}\/\d{2}\/2099|ngày chọn Bao xe/);
 assert.doesNotMatch(driver.join('\n'),/Lịch phục vụ:|2099-|\d{2}\/\d{2}\/2099|Đã bao gồm trong giá/);
 for (const lines of [customer,driver]) {
   assert.equal(lines.filter(line=>line.startsWith('Ăn nghỉ tài xế')).length,1);
   assert.equal(lines.filter(line=>line.startsWith('Phí Bao xe')).length,destinationServiceMode==='CHARTER'?1:0);
 }
 assert.ok(customer.includes(destinationServiceMode==='CHARTER'?snapshot.charterDescription:snapshot.standardDescription));
 assert.equal(JSON.stringify(snapshot),before);
 const edited=structuredClone(snapshot);edited.tourDisplay.total+=1;
 assert.equal(destinationSignature(edited),destinationSignature(snapshot));
});

test('historical mixed schedules are compact without claiming all dates are chartered or changing stored data',()=>{
 const snapshot=buildDestinationSnapshot(c,{...request,destinationServiceDates:['2099-01-02']});const before=JSON.stringify(snapshot);
 assert.deepEqual(riderPackageLines(snapshot),['Bao xe theo lịch đã xác nhận']);
 assert.ok(destinationSummary(snapshot).includes(snapshot.standardDescription));
 assert.ok(destinationSummary(snapshot).includes(snapshot.charterDescription));
 assert.equal(JSON.stringify(snapshot),before);
});

test('Web package control has exactly two radio choices and no per-day/price UI',()=>{
 const require=createRequire(new URL('../../web/package.json',import.meta.url));
 const ts=require('typescript');
 const source=readFileSync(new URL('../../web/src/components/customer/DestinationService.jsx',import.meta.url),'utf8');
 const context={exports:{},require:name=>name==='@mui/material'?require(name):name==='react/jsx-runtime'?require(name):name.includes('driverTourSummary')?{driverTourSummary}:name.includes('destinationService')?{destinationConfig,destinationSummary,destinationQuoteSummary,...require('../api/src/shared/destinationService.js')}:require(name)};
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
 for(const mode of ['STANDARD','CHARTER']){
  let changed;
  const tree=context.exports.default({config:c,direction:'ROUND_TRIP',pickup:request.pickupTime,returnTime:request.returnTime,outboundMinutes:99,mode,onMode:value=>{changed=value;}});
  const nodes=[],texts=[];
  function visit(value){if(Array.isArray(value)){value.forEach(visit);return;}if(typeof value==='string'){texts.push(value);return;}if(!value?.props)return;nodes.push(value);visit(value.props.children);}
  visit(tree);
  const group=nodes.find(node=>node.props.name==='destination-service-mode');
  assert.equal(group.props.value,mode);
  const options=nodes.filter(node=>node.props.control&&['STANDARD','CHARTER'].includes(node.props.value));
  assert.equal(options.length,2);
  group.props.onChange({target:{value:mode==='STANDARD'?'CHARTER':'STANDARD'}});
  assert.equal(changed,mode==='STANDARD'?'CHARTER':'STANDARD');
  assert.doesNotMatch(texts.join(' '),/Phụ phí Bao xe|600[.,]000|Đã bao gồm trong giá|Chọn ngày|01\/01\/2099/);
 }
});
