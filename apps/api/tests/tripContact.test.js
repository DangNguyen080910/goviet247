import test from "node:test";
import assert from "node:assert/strict";
import { riderDriverContact, phoneCallUrl } from "../src/shared/tripContact.js";
const driver = {displayName:"Tên tài khoản", phones:[{e164:"+84901234567"}],driverProfile:{fullName:"Nguyễn Văn A"}};
test("only active assigned trips expose driver contact, prioritizing profile name", () => {
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
    getVerifiedRiderPhoneVariants:async()=>[], riderTripAccessWhere:()=>({riderId:'rider'}), riderDriverContact,
  };
  const list=new Function(...Object.keys(dependencies), body+'; return listMyCustomerTrips;')(...Object.values(dependencies));
  let response;
  await list({user:{id:'rider'}},{json:value=>{response=value;},status:()=>assert.fail('API error')});
  assert.equal(response.items[0].driverContact.name,'Nguyễn Văn A');
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
