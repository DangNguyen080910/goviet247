import test from "node:test";
import assert from "node:assert/strict";
import { hasActiveTripContact, riderDriverContact, phoneCallUrl } from "../src/shared/tripContact.js";
import { dropoffIsRepresented } from "../src/shared/tripRoute.js";
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
function driverSerializer() {
  const start = controllerSource.indexOf('function serializeDriverTrip(');
  const end = controllerSource.indexOf('\n}', start) + 2;
  const deps = { dropoffIsRepresented, hasActiveTripContact, normalizeDisplayAddress: v => v,
    maskAddress: () => 'Địa chỉ đã ẩn', maskRiderName: () => 'Khách hàng', maskRiderPhone: () => '' };
  return new Function(...Object.keys(deps), controllerSource.slice(start, end) + '; return serializeDriverTrip;')(...Object.values(deps));
}
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
  const serialize = driverSerializer();
  const result=serialize({status:'COMPLETED',riderName:'Tên khách',riderPhone:'+84987654321',stops:[]},'history');
  assert.equal(result.riderName,''); assert.equal(result.riderPhone,'');
});

test('assigned drivers receive the passenger or active assigned coordinator number only during active trips', () => {
  const serialize = driverSerializer();
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

test('active passenger trips preserve names, including names that are phone numbers', () => {
  const serialize = driverSerializer();
  for (const status of ['ACCEPTED', 'CONTACTED', 'IN_PROGRESS']) {
    for (const riderName of ['Nguyễn Hồng', '0901234567']) {
      const result = serialize({ status, riderName, riderPhone: '0901234567' });
      assert.equal(result.riderName, riderName);
      assert.equal(result.riderPhone, '0901234567');
      assert.equal(result.partnerDispatcherName, null);
    }
  }
});

test('coordinator name and phone follow the current assignee rather than the original booker', () => {
  const serialize = driverSerializer();
  const trip = { status: 'ACCEPTED', partnerCompanyId: 'company',
    partnerBookerName: 'Người đặt cũ', partnerBookerPhone: '0901111111',
    partnerManagerName: 'Quản lý', partnerManagerPhone: '0902222222' };
  for (const displayName of ['Điều phối A', 'Điều phối B', '0903333333']) {
    const result = serialize({ ...trip, partnerAssignedTo: { companyId: 'company', isActive: true, displayName, phone: '0903333333' } });
    assert.equal(result.partnerDispatcherName, displayName);
    assert.equal(result.riderPhone, '0903333333');
    for (const field of ['partnerAssignedTo', 'partnerBookerName', 'partnerBookerPhone', 'partnerManagerName', 'partnerManagerPhone']) {
      assert.equal(result[field], undefined);
    }
  }
});

test('coordinator contact is hidden for unavailable assignees, other companies, pending and finished trips', () => {
  const serialize = driverSerializer();
  const partnerAssignedTo = { companyId: 'company', isActive: true, displayName: 'Điều phối', phone: '0903333333' };
  const trip = { status: 'ACCEPTED', partnerCompanyId: 'company', partnerAssignedTo };
  for (const assignee of [null, { ...partnerAssignedTo, isActive: false }, { ...partnerAssignedTo, companyId: 'other' }]) {
    const result = serialize({ ...trip, partnerAssignedTo: assignee });
    assert.equal(result.partnerDispatcherName, null);
    assert.equal(result.riderPhone, '');
  }
  for (const scope of ['available', 'history']) {
    const result = serialize(trip, scope);
    assert.equal(result.partnerDispatcherName, undefined);
    assert.equal(result.riderPhone, '');
  }
  for (const status of ['PENDING', 'COMPLETED', 'CANCELLED']) {
    const result = serialize({ ...trip, status });
    assert.equal(result.partnerDispatcherName, null);
    assert.equal(result.riderPhone, '');
  }
});

test('both assigned-driver APIs load the current coordinator name with the displayed phone', async () => {
  const trip = { id: 'trip', riderId: 'rider', driverId: 'driver', status: 'ACCEPTED', partnerCompanyId: 'company',
    partnerAssignedTo: { companyId: 'company', isActive: true, displayName: 'Điều phối mới', phone: '0903333333' } };
  for (const name of ['listMyTrips', 'getTripById']) {
    let query;
    const prisma = { trip: {
      findMany: async args => { query = args; return [trip]; },
      findUnique: async args => { query = args; return trip; },
    } };
    const start = controllerSource.indexOf(`export async function ${name}(`);
    const end = controllerSource.indexOf('\n}', start) + 2;
    const deps = { prisma, serializeDriverTrip: driverSerializer(), ACTIVE_DRIVER_TRIP_STATUSES: ['ACCEPTED', 'CONTACTED', 'IN_PROGRESS'],
      getVerifiedRiderPhoneVariants: async () => [], phoneVariants: () => [], getPartnerRiderContext: async () => null };
    const action = new Function(...Object.keys(deps), controllerSource.slice(start, end).replace('export ', '') + `; return ${name};`)(...Object.values(deps));
    const res = { status: () => assert.fail('API error'), json(body) { this.body = body; } };
    await action({ user: { id: 'driver' }, params: { id: 'trip' }, query: { scope: 'active' } }, res);
    assert.equal(query.include.partnerAssignedTo.select.displayName, true);
    assert.equal(query.include.partnerAssignedTo.select.phone, true);
    if (name === 'listMyTrips') assert.equal(query.where.driverId, 'driver');
    const result = res.body.data || res.body.items[0];
    assert.equal(result.partnerDispatcherName, 'Điều phối mới');
    assert.equal(result.riderPhone, '0903333333');
  }
});
