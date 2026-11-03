import test from 'node:test';
import assert from 'node:assert/strict';
import {riderBookingCompanies,resolveRiderCompanyBooking} from '../apps/api/src/services/partnerRiderBooking.js';

function fixture({verified=true,active=true,member=true}={}) {
  const calls=[];
  const company={id:'company-a',name:'OT',managementPhone:'+84901234567',managementName:'Manager'};
  const staff={id:'staff-a',companyId:company.id,displayName:'Dispatcher',phone:'+84901234567',mustChangePassword:true};
  const db={phone:{findMany:async query=>{calls.push(query);assert.deepEqual(query.where,{userId:'rider-a',isVerified:true});return verified?[{e164:'+84901234567'}]:[];}},
    partnerCompany:{findMany:async query=>{calls.push(query);return [company];},findFirst:async query=>{calls.push(query);return active?company:null;}},
    partnerMember:{findFirst:async query=>{calls.push(query);return member?staff:null;}}};
  return {db,calls,company,staff};
}
test('company choices use only verified phones and require an active company or active matching member',async()=>{
  const {db,calls}=fixture();assert.equal((await riderBookingCompanies(db,'rider-a'))[0].id,'company-a');
  assert.deepEqual(calls[1].where,{isActive:true,OR:[{managementPhone:{in:['+84901234567']}},{members:{some:{isActive:true,phone:{in:['+84901234567']}}}}]});
});
test('unverified phones cannot list or book a company',async()=>{
  const {db}=fixture({verified:false});assert.deepEqual(await riderBookingCompanies(db,'rider-a'),[]);
  await assert.rejects(resolveRiderCompanyBooking(db,'rider-a','company-a'),error=>error.status===409);
});
test('OTP booking resolves actual employee and does not depend on portal password-change state',async()=>{
  const {db,staff,calls}=fixture();const context=await resolveRiderCompanyBooking(db,'rider-a','company-a');
  assert.equal(context.member.id,staff.id);assert.equal(context.bookerPhone,staff.phone);
  assert.equal(calls[1].where.id,'company-a');assert.equal(calls[1].where.isActive,true);
  assert.deepEqual(calls[2].where,{companyId:'company-a',isActive:true,phone:{in:['+84901234567']}});
});
test('revoked company and missing dispatch identity fail explicitly instead of falling back to personal or another employee',async()=>{
  await assert.rejects(resolveRiderCompanyBooking(fixture({active:false}).db,'rider-a','company-a'),error=>error.status===409);
  await assert.rejects(resolveRiderCompanyBooking(fixture({member:false}).db,'rider-a','company-a'),error=>error.status===409);
});
