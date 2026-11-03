import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizePartnerPhone,partnerRiderAccessWhere,partnerParticipantPhones} from '../apps/api/src/services/partnerRiderAccess.js';
import {getTripRiderRecipientUserIds,riderTripAccessWhere} from '../apps/api/src/services/riderTripAccess.js';
test('Vietnam mobile phone formats normalize to one Rider identity',()=>{
 for(const value of ['0901234567','+84901234567','84 901 234 567'])assert.equal(normalizePartnerPhone(value),'+84901234567');
 for(const value of ['',null,'abc','02123456789','123'])assert.equal(normalizePartnerPhone(value),null);
});
test('partner mobile scope requires active company and current creator phone or management phone',()=>{
 const where=partnerRiderAccessWhere(['0901234567','+84901234567']);assert.equal(where.partnerCompany.isActive,true);assert.equal(where.partnerCompanyId.not,null);
 assert.deepEqual(where.OR[0].partnerCompany.managementPhone.in,['+84901234567']);assert.equal(where.OR[1].partnerCreatedBy.isActive,true);
 assert.deepEqual(partnerRiderAccessWhere([]),{id:'__no_partner_rider_access__'});
 const scope=riderTripAccessWhere('u1',['0901234567']);assert.equal(scope.OR[0].partnerCompanyId,null);assert.equal(scope.OR[1].partnerCompany.isActive,true);
});
function db({active=true,memberActive=true,same=false}={}){return {
 partnerCompany:{findUnique:async()=>({id:'c',isActive:active,managementPhone:'0901234567'})},
 partnerMember:{findUnique:async()=>({id:'m',companyId:'c',isActive:memberActive,phone:same?'0901234567':'0901234568'})},
 phone:{findMany:async({where})=>{assert.equal(where.isVerified,true);return where.e164.in.map((n,i)=>({userId:i?'employee':'manager'}));}},
};}
const trip={id:'t',partnerCompanyId:'c',partnerCreatedById:'m',riderPhone:'0909999999',riderId:'unrelated'};
test('only current management and active creator receive Partner Rider notifications',async()=>{
 assert.deepEqual(await getTripRiderRecipientUserIds(db(),trip),['manager','employee']);
 assert.deepEqual(await getTripRiderRecipientUserIds(db({memberActive:false}),trip),['manager']);
 assert.deepEqual(await getTripRiderRecipientUserIds(db({active:false}),trip),[]);
});
test('manager booking deduplicates phone and notification recipient',async()=>{
 assert.deepEqual(await partnerParticipantPhones(db({same:true}),trip),['+84901234567']);assert.deepEqual(await getTripRiderRecipientUserIds(db({same:true}),trip),['manager']);
});
