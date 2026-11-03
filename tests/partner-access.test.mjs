import {test} from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
globalThis.__prisma__ = {};
const {signPartnerToken,verifyPartnerToken,companyScope,requireCompanyAdmin,requireSuperAdmin,serializePartnerTrip,publicCompany} = await import('../apps/api/src/services/partnerAccess.js');
const {createSessionService} = await import('../apps/api/src/services/userSessions.js');
import {getTripRiderRecipientUserIds,riderTripAccessWhere} from '../apps/api/src/services/riderTripAccess.js';
process.env.JWT_SECRET='test-partners-only-not-production';
const member={id:'m1',companyId:'c1',sessionVersion:3,isActive:true,company:{id:'c1',isActive:true}};
const db={partnerMember:{findUnique:async()=>member}};
test('partner tokens are bounded and scoped to partner audience',async()=>{
 const token=signPartnerToken(member),claims=jwt.decode(token);
 assert.equal(claims.aud,'goviet247-partners');assert.equal(claims.exp-claims.iat,43200);
 assert.equal((await verifyPartnerToken(token,db)).id,'m1');
 await assert.rejects(verifyPartnerToken(jwt.sign({sub:'m1',version:3},process.env.JWT_SECRET),db),{status:401});
});
test('password reset/logout version and disabled accounts revoke partner access',async()=>{
 const token=signPartnerToken(member);
 for(const value of [{...member,sessionVersion:4},{...member,isActive:false},{...member,company:{isActive:false}},null]) {
  await assert.rejects(verifyPartnerToken(token,{partnerMember:{findUnique:async()=>value}}),{status:401});
 }
});
test('partner token cannot authenticate on generic rider/driver sessions',async()=>{
 let queried=false;
 const service=createSessionService({session:{findUnique:async()=>{queried=true;}}});
 await assert.rejects(service.verify(signPartnerToken(member)),{status:401});assert.equal(queried,false);
});
test('tenant scope ignores supplied company IDs for partner users',()=>{
 assert.equal(companyScope({partnerActor:{companyId:'c1'},query:{companyId:'c2'}}),'c1');
 assert.equal(companyScope({partnerActor:{superAdmin:true},query:{companyId:'c2'}}),'c2');
 assert.throws(()=>companyScope({partnerActor:{superAdmin:true},query:{}}),{status:400});
});
test('only company admins can manage members; only GoViet247 can manage companies',()=>{
 assert.throws(()=>requireCompanyAdmin({partnerActor:{member:{role:'DISPATCHER'}}}),{status:403});
 requireCompanyAdmin({partnerActor:{member:{role:'ADMIN'}}});
 assert.throws(()=>requireSuperAdmin({partnerActor:{member:{role:'ADMIN'}}}),{status:403});
 requireSuperAdmin({partnerActor:{superAdmin:true}});
});
test('partner trip response hides driver identity/contact and terminal vehicle data',()=>{
 const t={id:'t1',partnerCompanyName:'OT Travel',riderPhone:'private',driverId:'d1',driver:{phones:[{e164:'private'}],driverProfile:{vehicleBrand:'Toyota',plateNumber:'51A-12345'}}};
 for(const status of ['PENDING','COMPLETED','CANCELLED']){
  const out=serializePartnerTrip({...t,status});assert.equal(out.vehicle,null);assert.equal(out.canChat,status==='PENDING');
  assert.ok(!JSON.stringify(out).includes('private'));assert.ok(!JSON.stringify(out).includes('51A-12345'));assert.equal(out.driverId,undefined);
 }
 const active=serializePartnerTrip({...t,status:'ACCEPTED'});assert.equal(active.vehicle.plate,'51A-12345');assert.equal(active.canChat,true);
});
test('management contact never appears in public company profile',()=>{
 const c=publicCompany({id:'c1',name:'OT',managementName:'Founder',managementPhone:'secret'});
 assert.equal(c.managementPhone,undefined);assert.equal(c.managementName,undefined);
});
test('partner mobile access never falls back to generic passenger phone fields',async()=>{
 const db={partnerCompany:{findUnique:async()=>({id:'c1',isActive:false})},phone:{findMany:()=>{throw Error('must not query phone for disabled company');}}};
 const recipients=await getTripRiderRecipientUserIds(db,{partnerCompanyId:'c1',riderId:'u1',riderPhone:'0901234567'});
 assert.deepEqual(recipients,[]);
 const where=riderTripAccessWhere('u1',['0901234567']);assert.equal(where.OR[0].partnerCompanyId,null);assert.equal(where.OR[1].partnerCompany.isActive,true);
});
