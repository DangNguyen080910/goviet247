import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { audienceRegionsForApproval, tripAudienceLabel } from '../src/shared/tripAudienceLabel.js';
import { AUDIENCE_REGIONS } from '../src/shared/audienceFilters.js';
import { audienceWhere } from '../src/services/tripAudiencePolicy.js';
const ALL=AUDIENCE_REGIONS.map(region=>region.value);
test('display follows the saved scope, in consistent North/Central/South order',()=>{
  for(const [regions,label] of [
    [['SOUTH'],'Miền Nam'],[['SOUTH','CENTRAL'],'Miền Trung · Miền Nam'],
    [['CENTRAL','NORTH'],'Miền Bắc · Miền Trung'],[['NORTH','CENTRAL','SOUTH'],'Toàn quốc'],[ALL,'Toàn quốc'],
    [['UNCONFIRMED'],'Tài xế chỉ định'],[['SOUTH','UNCONFIRMED'],'Tài xế chỉ định'],
  ])assert.equal(tripAudienceLabel({audienceRegions:regions,audienceDriverIds:['driver']}),label);
});
test('older or manual private approvals never guess scope from addresses or driver profiles',()=>{
  assert.equal(tripAudienceLabel({audienceDriverIds:['d'],pickupAddress:'TP.HCM',dropoffAddress:'Đắk Lắk'}),'Tài xế chỉ định');
  assert.equal(tripAudienceLabel({audienceDriverIds:[]}),'Toàn quốc');
  assert.equal(tripAudienceLabel({}),'Tài xế chỉ định');
  assert.equal(tripAudienceLabel({audienceDriverIds:['d'],audienceRegions:['BOGUS']}),'Tài xế chỉ định');
});
test('approval intent survives resend, and new approvals replace earlier geographic scope',()=>{
  assert.deepEqual(audienceRegionsForApproval('AUDIENCE_FILTER',['SOUTH','CENTRAL','SOUTH'],true),['CENTRAL','SOUTH']);
  assert.deepEqual(audienceRegionsForApproval('SELECTED',[],true),[]);
  assert.deepEqual(audienceRegionsForApproval(undefined,[],true),[]);
  for(const mode of ['ALL','QUICK_CAR_TYPE','CAR_TYPE','FUEL_TYPE','VEHICLE_FILTER',undefined]){
    assert.deepEqual(audienceRegionsForApproval(mode,[],false),ALL);
  }
});
test('available-trips API returns the label without exposing recipient IDs and keeps visibility filtering',async()=>{
  const rows=[
    {id:'regional',audienceRegions:['CENTRAL','SOUTH'],audienceDriverIds:['d']},
    {id:'all',audienceRegions:ALL,audienceDriverIds:['d','other']},
    {id:'manual',audienceRegions:[],audienceDriverIds:['d']},
    {id:'legacy-public',audienceDriverIds:[]},
  ].map(t=>({...t,verifiedAt:new Date(0),totalPrice:100000}));
  let where;
  const source=readFileSync(new URL('../src/controllers/tripController.js',import.meta.url),'utf8');
  const start=source.indexOf('export async function listAvailableTrips('),end=source.indexOf('\n}',start)+2;
  const deps={
    prisma:{trip:{findMany:async args=>{where=args.where;return rows;}}},
    getDriverConfigSnapshot:async()=>({newTripAcceptDelaySeconds:0}),
    calculateDriverFinanceSnapshot:()=>({}),serializeDriverTrip:t=>t,
    audienceWhere,tripAudienceLabel,console,
  };
  const list=new Function(...Object.keys(deps),source.slice(start,end).replace('export ','')+';return listAvailableTrips;')(...Object.values(deps));
  const res={statusCode:200,set(){},status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};
  await list({user:{id:'d'}},res);
  assert.equal(res.statusCode,200);assert.deepEqual(where.OR,audienceWhere('d').OR);
  assert.deepEqual(res.body.items.map(t=>t.audienceLabel),['Miền Trung · Miền Nam','Toàn quốc','Tài xế chỉ định','Toàn quốc']);
  for(const item of res.body.items){assert.equal(item.audienceDriverIds,undefined);assert.equal(item.audienceRegions,undefined);}
});
