import test from "node:test";
import assert from "node:assert/strict";
import { hasActiveTripContact, riderDriverContact, phoneCallUrl } from "../src/shared/tripContact.js";
const driver = {displayName:"Tên tài khoản", phones:[{e164:"+84901234567"}],driverProfile:{fullName:"Nguyễn Văn A"}};
test("active trips return verified driver contact", () => {
  for (const status of ["ACCEPTED","CONTACTED","IN_PROGRESS"]) assert.deepEqual(riderDriverContact({status,driverId:"a"},driver),{name:"Nguyễn Văn A",phone:"+84901234567"});
});
test("pending, completed and cancelled trips return no driver name or phone", () => {
  for (const status of ["PENDING","COMPLETED","CANCELLED",null]) assert.equal(riderDriverContact({status,driverId:"a"},driver),null);
  assert.equal(riderDriverContact({status:"ACCEPTED",driverId:null},driver),null);
});
test("phone links accept dialable numbers and reject control characters and injected URLs", () => {
  assert.equal(phoneCallUrl('+84 901-234-567'), 'tel:+84901234567');
  assert.equal(phoneCallUrl('0901234567'), 'tel:0901234567');
  for (const value of ['',null,'tel:0901234567','javascript:alert(1)','123#','1234;5678']) assert.equal(phoneCallUrl(value),null);
});

import { readFileSync } from 'node:fs';
const controllerSource = readFileSync(new URL('../src/controllers/tripController.js', import.meta.url), 'utf8');
test('customer API omits raw driver data and removes contact from finished trips', async () => {
  const start = controllerSource.indexOf('export async function listMyCustomerTrips(');
  const end = controllerSource.indexOf('\n}',start)+2;
  const body = controllerSource.slice(start,end).replace('export ','');
  const dependencies = {
    prisma:{trip:{findMany:async()=>[
      {id:'active',riderId:'rider',driverId:'driver',status:'ACCEPTED',driver},
      {id:'done',riderId:'rider',driverId:'driver',status:'COMPLETED',driver},
      {id:'cancelled',riderId:'rider',driverId:'driver',status:'CANCELLED',driver},
    ]}},
    getVerifiedRiderPhoneVariants:async()=>[], riderTripAccessWhere:()=>({riderId:'rider'}), riderDriverContact, hasActiveTripContact,
  };
  const list=new Function(...Object.keys(dependencies), body+'; return listMyCustomerTrips;')(...Object.values(dependencies));
  let response;
  await list({user:{id:'rider'}},{json:value=>{response=value;},status:()=>assert.fail('API error')});
  assert.equal(response.items[0].driverContact.phone,"+84901234567");
  assert.equal("driver" in response.items[0],false);
  for(const row of response.items.slice(1)) {
    assert.equal(row.driverContact,null);
    assert.equal('driver' in row,false);
    assert.doesNotMatch(JSON.stringify(row),/Nguyễn Văn A|84901234567/);
  }
});
test('driver history already strips customer name and phone', () => {
  const start=controllerSource.indexOf('function serializeDriverTrip(');
  const end=controllerSource.indexOf('\n}',start)+2;
  const serialize=new Function('maskAddress','maskRiderName','maskRiderPhone',controllerSource.slice(start,end)+'; return serializeDriverTrip;')(()=> 'Địa chỉ đã ẩn',()=> 'Khách hàng',()=> 'Đã ẩn');
  const result=serialize({status:'COMPLETED',riderName:'Tên khách',riderPhone:'+84987654321',stops:[]},'history');
  assert.equal(result.riderName,''); assert.equal(result.riderPhone,'');
});

test('assigned drivers receive the passenger or active assigned coordinator number only during active trips', () => {
  const start = controllerSource.indexOf('function serializeDriverTrip(');
  const end = controllerSource.indexOf('\n}',start)+2;
  const serialize = new Function('hasActiveTripContact','normalizeDisplayAddress','maskAddress','maskRiderName','maskRiderPhone',
    controllerSource.slice(start,end)+'; return serializeDriverTrip;')(hasActiveTripContact,v=>v,()=>'',()=>'',()=>'');
  const trip = {status:'ACCEPTED',riderPhone:'0901234567',stops:[]};
  const partner = {...trip,partnerCompanyId:'p',partnerBookerPhone:'0907777777',partnerAssignedTo:{phone:'0909999999',isActive:true,companyId:'p'}};
  assert.equal(serialize(trip).riderPhone,'0901234567');
  assert.equal(serialize(partner).riderPhone,'0909999999');
  assert.equal('partnerAssignedTo' in serialize(partner),false);
  assert.equal(serialize({...partner,partnerAssignedTo:null}).riderPhone,'');
  assert.equal(serialize({...partner,partnerAssignedTo:{...partner.partnerAssignedTo,companyId:'other'}}).riderPhone,'');
  for (const scope of ['available','history']) assert.equal(serialize(partner,scope).riderPhone,'');
  assert.equal(serialize({...partner,status:'COMPLETED'}).riderPhone,'');
});
