// Read-only in-memory audit. Settings were read from Admin on 25/11/2026. No API, OTP, push or database writes.
import {quotePrice} from '../apps/api/src/services/pricingService.js';
import {destinationWindows,destinationConfig} from '../apps/api/src/shared/destinationService.js';
const rules={freeWaitingMinutes:60,nightStartHour:22,nightEndHour:6,nightMinWaitHours:5,overnightPricePerHour:20000};
const periods=[['newyear','2027-01-01','2027-01-01',20],['before','2027-02-02','2027-02-04',20],['tet','2027-02-05','2027-02-09',30],['after','2027-02-10','2027-02-14',20]].map(([id,holidayStartDate,holidayEndDate,holidaySurchargePercent])=>({id,holidayStartDate,holidayEndDate,holidaySurchargePercent,enabled:true}));
const rows=[[0,50,8000,60000],[50,75,6000,40000],[75,100,5500,35000],[100,150,5300,30000],[150,200,5200,20000],[200,300,5100,15000],[300,null,5000,10000]];
const configs=Object.fromEntries(['CAR_5','CAR_7','CAR_16'].map(carType=>{
 const large=carType==='CAR_16';
 const carRows=large?[[0,50,19000,80000],[50,75,18000,60000],[75,100,15000,40000],[100,150,14000,30000],[150,200,13000,20000],[200,null,11000,10000]]:rows;
 return [carType,{baseFare:large?100000:carType==='CAR_5'?50000:60000,pricePerKm:large?15000:carType==='CAR_5'?10000:12000,pricePerHour:6900,minFare:large?400000:carType==='CAR_5'?100000:120000,overnightFee:large?500000:200000,overnightTriggerKm:600,overnightTriggerHours:12,gasolineSurchargePercent:large?0:20,roundTripWaitingConfig:{...rules,overnightPricePerHour:large?10000:20000},holidayPeriods:periods,kmTiers:carRows.map(([from,to,pricePerKm,pricePerWaitHour])=>({from,to,pricePerKm:pricePerKm+(!large&&carType==='CAR_7'?1000:0),pricePerWaitHour}))}];
}));
const service=destinationConfig({charterDailyFee:600000});
const db={pricingConfig:{findFirst:async({where})=>configs[where.carType]},tripConfig:{findFirst:async()=>({regionalPricingConfig:{NORTH:0,CENTRAL:0,SOUTH:0},destinationServiceConfig:service})}};
const base={carType:'CAR_5',direction:'ROUND_TRIP',fuelPreference:'ANY',pickupTime:'2026-11-27T07:00:00+07:00',returnTime:'2026-11-29T15:00:00+07:00',distanceKm:174.6,outboundDriveMinutes:99,driveMinutes:199,dropoffAddress:'Điểm đến',destinationServiceDates:[]};
let count=0;const issues={},examples={};
function note(kind,data){issues[kind]=(issues[kind]||0)+1;if((examples[kind]||=[]).length<30)examples[kind].push(data);}
async function q(changes){count++;const r=await quotePrice({...base,...changes},db);if(!r.ok)throw Error(JSON.stringify(r));const d=r.data;if(!Number.isSafeInteger(d.finalPrice)||d.finalPrice<0)throw Error('invalid fare');return d;}
const kmCases=[5,5.1,10,20,49.9,50,50.1,74.9,75,75.1,99.9,100,100.1,149.9,150,150.1,174.6,199.9,200,200.1,299.9,300,300.1,599.9,600,600.1,1000,2000,3000];
for(const carType of ['CAR_5','CAR_7','CAR_16'])for(const direction of ['ONE_WAY','ROUND_TRIP'])for(const fuelPreference of ['ANY','ELECTRIC','GASOLINE'])for(const days of [0,1,2,7]){
 if(direction==='ONE_WAY'&&days)continue;
 const returnTime=new Date(Date.parse('2026-11-27T15:00:00+07:00')+days*86400000).toISOString();let previous;
 for(const distanceKm of kmCases){const d=await q({carType,direction,fuelPreference,distanceKm,returnTime:direction==='ONE_WAY'?null:returnTime});
  if(previous&&d.rawTotal<previous.rawTotal)note('km_drop',{carType,direction,fuelPreference,days,distanceKm,from:previous.rawTotal,to:d.rawTotal});previous=d;
 }
}
for(const carType of ['CAR_5','CAR_7','CAR_16'])for(const distanceKm of [5,50,50.1,75.1,100.1,150.1,174.6,200.1,300.1,600,3000])for(const arrivalHour of [0,4,8,15,21,23]){
 const arrival=Date.parse(`2026-11-27T${String(arrivalHour).padStart(2,'0')}:00:00+07:00`),pickupTime=new Date(arrival-99*60000).toISOString();let previous;
 for(let h=0;h<=72;h+=0.5){const returnTime=new Date(arrival+h*3600000).toISOString();const d=await q({carType,distanceKm,pickupTime,returnTime});
  if(previous&&d.rawTotal<previous.rawTotal)note('time_drop',{carType,distanceKm,arrivalHour,h,from:previous.rawTotal,to:d.rawTotal});previous=d;
 }
}
for(const direction of ['ONE_WAY','ROUND_TRIP'])for(const distanceKm of kmCases){const a=await q({direction,distanceKm,carType:'CAR_5'}),b=await q({direction,distanceKm,carType:'CAR_7'});if(b.finalPrice<a.finalPrice)note('seven_cheaper',{direction,distanceKm,five:a.finalPrice,seven:b.finalPrice});}
for(const carType of ['CAR_5','CAR_7','CAR_16'])for(const distanceKm of [5,50,50.1,100.1,174.6,300.1,1000])for(const arrivalHour of [6,8,12,18,20,23])for(const days of [1,2,3])for(const fuelPreference of ['ANY','GASOLINE']){
 const arrival=Date.parse(`2026-11-27T${String(arrivalHour).padStart(2,'0')}:00:00+07:00`),pickupTime=new Date(arrival-99*60000).toISOString();
 const returnTime=new Date(Date.parse('2026-11-27T15:00:00+07:00')+days*86400000).toISOString();
 const data={carType,distanceKm,pickupTime,returnTime,fuelPreference};const standard=await q(data);
 const windows=destinationWindows(service,'ROUND_TRIP',pickupTime,returnTime,99);
 for(const w of windows){const charter=await q({...data,destinationServiceDates:[w.date]});if(charter.finalPrice<standard.finalPrice)note('charter_cheaper',{...data,date:w.date,standard:standard.finalPrice,charter:charter.finalPrice,fee:charter.destinationService.fee,standardWait:standard.waitCost,charterWait:charter.waitCost,transition:charter.nightTransitionAdjustment});}
}
const details={};
for(const carType of ['CAR_5','CAR_7','CAR_16']){
 details[carType]={};
 for(const [name,changes] of Object.entries({base:{},oneNight:{returnTime:'2026-11-28T15:00:00+07:00'},below600:{direction:'ONE_WAY',distanceKm:599.9,driveMinutes:600},at600:{direction:'ONE_WAY',distanceKm:600,driveMinutes:600},below12h:{direction:'ONE_WAY',distanceKm:500,driveMinutes:719.9},at12h:{direction:'ONE_WAY',distanceKm:500,driveMinutes:720},dayShortWait:{distanceKm:300,pickupTime:'2026-11-27T04:00:00+07:00',outboundDriveMinutes:180,returnTime:'2026-11-27T18:00:00+07:00'}})){
 const d=await q({carType,...changes});details[carType][name]=Object.fromEntries(['distanceKm','finalPrice','distanceCost','waitCost','hourlyWaitCost','waitingTierAdjustment','nightTransitionAdjustment','overnightCount','overnightCost','billableWaitHours','pricePerHour'].map(k=>[k,d[k]]));
 }
}

const holidayDays=[['2026-12-31',0],['2027-01-01',20],['2027-01-02',0],['2027-02-01',0],['2027-02-02',20],['2027-02-04',20],['2027-02-05',30],['2027-02-09',30],['2027-02-10',20],['2027-02-14',20],['2027-02-15',0]];
for(const carType of ['CAR_5','CAR_7','CAR_16'])for(const [day,expectedPercent] of holidayDays)for(const fuelPreference of ['ANY','ELECTRIC','GASOLINE']){
 const d=await q({carType,direction:'ONE_WAY',distanceKm:174.6,pickupTime:day+'T07:00:00+07:00',returnTime:null,fuelPreference});
 if(d.holidaySurchargePercent!==expectedPercent||d.holidaySurchargeAmount!==Math.round(d.priceBeforeFuelSurcharge*expectedPercent/100))note('holiday_error',{carType,day,fuelPreference,expectedPercent,actual:d.holidaySurchargePercent});
 const expectedFuel=fuelPreference==='GASOLINE'?Math.round(d.priceBeforeFuelSurcharge*configs[carType].gasolineSurchargePercent/100):0;
 if(d.fuelSurchargeAmount!==expectedFuel)note('fuel_error',{carType,day,fuelPreference});
 if(d.rawTotal!==d.priceBeforeFuelSurcharge+d.holidaySurchargeAmount+expectedFuel)note('compounded_surcharge',{carType,day,fuelPreference});
}
console.log(JSON.stringify({count,issues,examples,details},null,2));


if (Object.keys(issues).length) process.exitCode=1;
