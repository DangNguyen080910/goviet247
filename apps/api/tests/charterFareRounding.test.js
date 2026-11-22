import test from 'node:test';
import assert from 'node:assert/strict';
import {quotePrice} from '../src/services/pricingService.js';
import {readFileSync} from 'node:fs';

const pricing={baseFare:0,pricePerKm:10000,pricePerHour:0,minFare:0,overnightFee:0,overnightTriggerKm:10000,overnightTriggerHours:100,gasolineSurchargePercent:20};
const service={charterDailyFee:600000};
const input={carType:'CAR_5',direction:'ROUND_TRIP',pickupTime:'2026-11-23T07:00:00+07:00',returnTime:'2026-11-24T19:00:00+07:00',distanceKm:158,driveMinutes:140,outboundDriveMinutes:70,destinationAnchorAddress:'Mỹ Tho',destinationServiceDates:['2026-11-23','2026-11-24']};
const db=(config=pricing,settings=service)=>({pricingConfig:{findFirst:async()=>config},tripConfig:{findFirst:async()=>({destinationServiceConfig:settings})}});

test('screenshot case rounds the complete 2,644,286 fare to 2,640,000 after adding charter fees',async()=>{
 const result=await quotePrice(input,db());assert.equal(result.ok,true,result.message);
 const d=result.data;assert.deepEqual(d.destinationService.sessions.map(s=>s.fee),[550000,514286]);
 assert.equal(d.destinationService.fee,1064286);assert.equal(d.rawTotal,2644286);assert.equal(d.finalPrice,2640000);assert.equal(d.roundingApplied,true);
 assert.equal(d.destinationService.tourDisplay.charterCost,1064286);
});
test('round once across all charges, preserving raw amounts and applying nearest-10,000 midpoint rounding',async()=>{
 for(const [baseFare,rawTotal,finalPrice] of [[714,2645000,2650000],[3157,2647443,2650000],[5714,2650000,2650000]]) {
  const {ok,data:d,message}=await quotePrice(input,db({...pricing,baseFare}));assert.equal(ok,true,message);
  assert.equal(d.rawTotal,rawTotal);assert.equal(d.finalPrice,finalPrice);assert.equal(d.roundingApplied,rawTotal!==finalPrice);
  assert.equal(d.finalPrice%10000,0);assert.equal(d.destinationService.fee,1064286);
 }
});
test('standard, full-day charter, one-way and free charter retain their normal pricing behavior',async()=>{
 for(const options of [
  {...input,destinationServiceDates:[]},
  {...input,returnTime:'2026-11-24T21:00:00+07:00',destinationServiceDates:['2026-11-24']},
  {...input,direction:'ONE_WAY',returnTime:null,destinationServiceDates:[]},
 ]) {
  const {ok,data:d,message}=await quotePrice(options,db());assert.equal(ok,true,message);assert.equal(d.finalPrice,Math.round(d.rawTotal/10000)*10000);
  if(!options.destinationServiceDates.length)assert.equal(d.destinationService.fee,0);
 }
 const {data:d}=await quotePrice(input,db(pricing,{charterDailyFee:0}));assert.equal(d.destinationService.fee,0);assert.equal(d.finalPrice,1580000);
});
test('fuel and holiday surcharges still exclude charter fees before final rounding',async()=>{
 const config={...pricing,holidaySurchargePercent:15,holidayStartDate:'2026-11-23',holidayEndDate:'2026-11-23',holidayName:'Ngày lễ',holidayNote:''};
 const {ok,data:d,message}=await quotePrice({...input,fuelPreference:'GASOLINE'},db(config));assert.equal(ok,true,message);
 assert.equal(d.fuelSurchargeAmount,316000);assert.equal(d.holidaySurchargeAmount,237000);assert.equal(d.rawTotal,3197286);assert.equal(d.finalPrice,3200000);
});
test('booking wrapper returns the same rounded fare and service signature as the quote',async()=>{
 // Exercise the actual wrapper with the quote engine bound to an in-memory DB.
 const source=readFileSync(new URL('../src/services/pricingService.js',import.meta.url),'utf8');
 const wrapper=source.slice(source.indexOf('export async function calculateTripPrice(')).replace('export async function','async function');
 const calculateTripPrice=new Function('quotePrice',wrapper+';return calculateTripPrice;')(value=>quotePrice(value,db()));
 const quote=await quotePrice(input,db()),booking=await calculateTripPrice(input);
 assert.equal(booking.totalPrice,quote.data.finalPrice);assert.equal(booking.totalPrice,2640000);
 assert.equal(booking.destinationServiceSignature,quote.data.destinationServiceSignature);
 assert.equal(booking.destinationService.fee,1064286);
});
