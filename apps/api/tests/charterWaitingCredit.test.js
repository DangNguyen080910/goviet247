import test from 'node:test';
import assert from 'node:assert/strict';
import {quotePrice} from '../src/services/pricingService.js';
import {calculateCharterWaitingCredit} from '../src/services/charterWaitingCredit.js';
import {destinationWindows,destinationConfig} from '../src/shared/destinationService.js';
import {createBookingQuoteService} from '../src/services/bookingQuotes.js';

const rules={freeWaitingMinutes:60,nightStartHour:22,nightEndHour:6,nightMinWaitHours:5,overnightPricePerHour:20000};
const tiers=[[0,50,8000,60000],[50,75,6000,40000],[75,100,5500,35000],[100,150,5300,30000],[150,200,5200,20000],[200,300,5100,15000],[300,null,5000,10000]];
const config=carType=>({baseFare:carType==='CAR_5'?50000:carType==='CAR_7'?60000:100000,
 pricePerKm:10000,pricePerHour:6900,minFare:carType==='CAR_5'?100000:carType==='CAR_7'?120000:400000,
 overnightFee:carType==='CAR_16'?500000:200000,overnightTriggerKm:600,overnightTriggerHours:12,
 gasolineSurchargePercent:20,roundTripWaitingConfig:{...rules,overnightPricePerHour:carType==='CAR_16'?10000:20000},holidayPeriods:[],
 kmTiers:tiers.map(([from,to,pricePerKm,pricePerWaitHour])=>({from,to,pricePerKm:pricePerKm+(carType==='CAR_7'?1000:carType==='CAR_16'?7000:0),pricePerWaitHour}))});
const input={carType:'CAR_5',direction:'ROUND_TRIP',fuelPreference:'ANY',distanceKm:49.2,
 pickupTime:'2026-11-28T12:00:00+07:00',returnTime:'2026-11-29T15:00:00+07:00',outboundDriveMinutes:34,driveMinutes:68,
 pickupAddress:'Địa chỉ A',dropoffAddress:'Địa chỉ B',stops:['Địa chỉ B'],destinationServiceDates:[]};
const settings={charterDailyFee:600000};
function db(pricing,service=settings){return{pricingConfig:{findFirst:async()=>pricing},tripConfig:{findFirst:async()=>({destinationServiceConfig:service,regionalPricingConfig:{NORTH:0,CENTRAL:0,SOUTH:0}})}};}
async function quote(changes={},pricing=config(changes.carType||'CAR_5'),service=settings){
 const result=await quotePrice({...input,...changes},db(pricing,service));
 assert.equal(result.ok,true,result.message);return result.data;
}

test('49.2 km screenshot: selecting either or both days preserves the Standard transition amount',async()=>{
 const cases=[[[],1280000,0],[['2026-11-28'],1490000,160000],[['2026-11-29'],1470000,160000],[['2026-11-28','2026-11-29'],1670000,320000]];
 const standard=await quote();
 assert.equal(standard.nightTransitionAdjustment,280000);
 for(const [destinationServiceDates,expected,credit] of cases){
  const data=await quote({destinationServiceDates});
  assert.equal(data.finalPrice,expected);
  assert.equal(data.nightTransitionAdjustment,standard.nightTransitionAdjustment);
  assert.equal(data.waitingTierAdjustment,standard.waitingTierAdjustment);
  assert.equal(data.waitCost,standard.waitCost-credit);
  if(destinationServiceDates.length){
   assert.equal(data.charterWaitingCredit,credit);
   assert.equal(data.standardWaitCost,640000);
   assert.equal(data.destinationService.tourDisplay.charterWaitingCredit,credit);
  }
 }
});

for(const carType of ['CAR_5','CAR_7','CAR_16'])test(`${carType}: every subset of three charter dates is nondecreasing when a day is added`,async()=>{
 const dates=['2026-11-28','2026-11-29','2026-11-30'];
 for(const distanceKm of [5,49.2,50.1,75.1,100.1,150.1,174.6,300.1,600])for(const fuelPreference of ['ANY','GASOLINE']){
  const amounts=[];
  for(let mask=0;mask<8;mask++){
   const data=await quote({carType,distanceKm,fuelPreference,returnTime:'2026-11-30T15:00:00+07:00',destinationServiceDates:dates.filter((_,i)=>mask&(1<<i))});
   amounts.push(data.rawTotal);
  }
  for(let mask=0;mask<8;mask++)for(let day=0;day<3;day++){
   assert.ok(amounts[mask|(1<<day)]>=amounts[mask],`${distanceKm} ${fuelPreference} ${mask} + ${day}: ${amounts}`);
  }
 }
});

for(const carType of ['CAR_5','CAR_7','CAR_16'])test(`${carType}: one-minute charter and cheap/free packages cannot undercut Standard`,async()=>{
 for(const charterDailyFee of [0,1,100,20000,600000])for(const fuelPreference of ['ANY','GASOLINE']){
  const pricing={...config(carType),holidayPeriods:[{id:'fixture',enabled:true,holidayStartDate:'2026-11-28',holidayEndDate:'2026-11-28',holidaySurchargePercent:30}]};
  const changes={carType,fuelPreference,pickupTime:'2026-11-28T20:25:00+07:00',returnTime:'2026-11-29T07:01:00+07:00'};
  const service={charterDailyFee};
  const standard=await quote(changes,pricing,service);
  const amounts=[];
  for(const destinationServiceDates of [[],['2026-11-28'],['2026-11-29'],['2026-11-28','2026-11-29']]){
   const data=await quote({...changes,destinationServiceDates},pricing,service);
   assert.ok(data.rawTotal>=standard.rawTotal);
   assert.ok(data.waitCost>=0);
   amounts.push(data.rawTotal);
   if(destinationServiceDates.length)assert.equal(data.nightTransitionAdjustment,standard.nightTransitionAdjustment);
  }
  assert.ok(amounts[3]>=amounts[1]&&amounts[3]>=amounts[2]);
 }
});

test('credit uses covered minutes, not an extra full hour for a one-minute service day',async()=>{
 const changes={pickupTime:'2026-11-28T20:25:00+07:00',returnTime:'2026-11-29T15:00:00+07:00',destinationServiceDates:['2026-11-28']};
 const data=await quote(changes);
 assert.equal(data.charterWaitingCredits[0].coveredMinutes,1);
 assert.equal(data.charterWaitingCredit,333);
 assert.equal(data.destinationService.fee,714);
});

test('minimum fare limits discount, free waiting is applied once and zero hourly rate stays zero',async()=>{
 for(const rate of [0,20000]){
  const pricing={...config('CAR_5'),minFare:5000000,roundTripWaitingConfig:{...rules,overnightPricePerHour:rate}};
  const data=await quote({destinationServiceDates:['2026-11-28','2026-11-29']},pricing);
  assert.equal(data.priceBeforeFuelSurcharge,5000000);
  assert.equal(data.freeWaitingMinutes,60);
  assert.ok(data.minApplied);
  assert.ok(data.waitCost>=0);
  if(!rate)assert.equal(data.charterWaitingCredit,0);
  assert.equal(data.rawTotal,5000000+data.destinationService.fee);
 }
});

test('legacy distance-tier waiting also keeps its Standard tier adjustment when selecting charter',async()=>{
 const pricing={...config('CAR_7'),roundTripWaitingConfig:{...rules,overnightPricePerHour:null}};
 const standard=await quote({carType:'CAR_7'},pricing);
 const charter=await quote({carType:'CAR_7',destinationServiceDates:['2026-11-28']},pricing);
 assert.equal(charter.waitingPricingMode,'DISTANCE_TIER');
 assert.equal(charter.waitingTierAdjustment,standard.waitingTierAdjustment);
 assert.ok(charter.rawTotal>=standard.rawTotal);
});

test('fuel and holiday amounts use the discounted fare base; charter fees remain outside surcharges',async()=>{
 const pricing={...config('CAR_5'),holidayPeriods:[{id:'fixture',enabled:true,holidayStartDate:'2026-11-28',holidayEndDate:'2026-11-28',holidaySurchargePercent:30}]};
 const standard=await quote({fuelPreference:'GASOLINE'},pricing);
 const charter=await quote({fuelPreference:'GASOLINE',destinationServiceDates:['2026-11-28','2026-11-29']},pricing);
 assert.equal(charter.fuelSurchargeAmount,Math.round(charter.priceBeforeFuelSurcharge*0.2));
 assert.equal(charter.holidaySurchargeAmount,Math.round(charter.priceBeforeFuelSurcharge*0.3));
 assert.equal(charter.rawTotal,charter.priceBeforeFuelSurcharge+charter.fuelSurchargeAmount+charter.holidaySurchargeAmount+charter.destinationService.fee);
 assert.ok(charter.rawTotal>=standard.rawTotal);
 assert.equal(charter.finalPrice,Math.round(charter.rawTotal/10000)*10000);
});

test('per-day discount budgets cover percentage rounding for all bases, including regional uplift',()=>{
 const taxed=(base,percents)=>base+percents.reduce((sum,p)=>sum+Math.round(base*p/100),0);
 for(const percents of [[],[20],[20,30,10],[12.5,7.25,3.33],[100,100,100]])for(const fee of [0,1,2,7,100,714,10000]){
  const result=calculateCharterWaitingCredit(1000000,60000,[{date:'day',coveredMinutes:480,fee}],percents);
  assert.ok(result.credit>=0&&result.credit<=1000000);
  for(const base of [1,2,3,7,99,1001,1000001]){
   const before=taxed(base,percents),after=taxed(Math.max(0,base-result.credit),percents)+fee;
   assert.ok(after>=before,`${percents} fee=${fee} base=${base} credit=${result.credit}`);
  }
 }
});

test('overlapping night/service hours are excluded from service credit rather than discounted twice',async()=>{
 const service={charterDailyFee:600000,charterStartHour:20,charterEndHour:24,charterHoursPerDay:4};
 const changes={pickupTime:'2026-11-28T18:26:00+07:00',returnTime:'2026-11-29T15:00:00+07:00',destinationServiceDates:['2026-11-28']};
 const data=await quote(changes,config('CAR_5'),service);
 assert.equal(data.charterWaitingCredits[0].coveredMinutes,120,'22:00–24:00 is already covered by the overnight fee');
 assert.equal(data.charterWaitingCredit,40000);
 assert.equal(data.overnightCount,1);
});

test('prices do not fall as return time moves through the charter window with fixed selected dates',async()=>{
 for(const carType of ['CAR_5','CAR_7','CAR_16'])for(const destinationServiceDates of [['2026-11-28'],['2026-11-29'],['2026-11-28','2026-11-29']]){
  let previous=-Infinity;
  for(let minute=7*60+1;minute<=21*60;minute+=7){
   const returnTime=new Date(Date.parse('2026-11-29T00:00:00+07:00')+minute*60000).toISOString();
   const data=await quote({carType,returnTime,destinationServiceDates});
   assert.ok(data.rawTotal>=previous,`${carType} ${destinationServiceDates} ${returnTime}: ${data.rawTotal}<${previous}`);
   previous=data.rawTotal;
  }
 }
});

test('held pre-fix charter quotes retain their original fare and snapshot through deployment',async()=>{
 const pricing=config('CAR_5'),fake=db(pricing),records=new Map();
 fake.bookingQuote={create:async({data})=>records.set(data.tokenHash,data),findUnique:async({where})=>records.get(where.tokenHash)};
 const service=createBookingQuoteService({db:fake,price:()=>{throw Error('held quote must not reprice');}});
 const old=await quote({destinationServiceDates:['2026-11-28']});
 old.finalPrice=1210000;
 old.destinationService.tourDisplay.waitCost=200000;
 const request={...input,destinationServiceDates:['2026-11-28']};
 const token=await service.issue(request,old,{distanceKm:49.2});
 const held=await service.booking({...request,...token});
 assert.equal(held.pricing.totalPrice,1210000);
 assert.equal(held.pricing.destinationService.tourDisplay.waitCost,200000);
 assert.equal((await quote({destinationServiceDates:['2026-11-28']})).finalPrice,1490000);
});

test('bounded total credit never draws from a transition/tier amount when hourly waiting is exhausted',()=>{
 const result=calculateCharterWaitingCredit(10000,20000,[{date:'a',coveredMinutes:480,fee:600000},{date:'b',coveredMinutes:480,fee:600000}],[]);
 assert.equal(result.credit,10000);
 assert.equal(result.days.reduce((sum,day)=>sum+day.credit,0),10000);
 assert.ok(result.days.every(day=>day.credit>=0));
});
