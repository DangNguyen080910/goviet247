import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
process.env.JWT_SECRET='partner-session-unit-only';
process.env.NODE_ENV='test';
const {signPartnerToken,verifyPartnerToken,refreshPartnerSession,setPartnerRefreshCookie,PARTNER_REFRESH_COOKIE}=await import('../apps/api/src/services/partnerAccess.js');
const member={id:'member-1',sessionVersion:2,isActive:true,company:{isActive:true}};
const db={partnerMember:{findUnique:async()=>member}};
function response(){return {cookies:[],cookie(...args){this.cookies.push(args);},clearCookie(...args){this.cleared=args;},set(){}};}
function request(token,origin='https://partners.goviet247.com',mode='partner-refresh'){return {headers:{cookie:`${PARTNER_REFRESH_COOKIE}=${token}`},get:key=>key.toLowerCase()==='origin'?origin:mode};}
function refreshToken(until,version=2){return jwt.sign({sub:member.id,version,rememberUntil:until},process.env.JWT_SECRET,{algorithm:'HS256',audience:'goviet247-partners-refresh',issuer:'goviet247',expiresIn:until-Math.floor(Date.now()/1000)});}
test('normal access lasts twelve hours; remembered access remains bounded by absolute deadline',()=>{
 const normal=jwt.decode(signPartnerToken(member));assert.equal(normal.exp-normal.iat,43200);assert.equal(normal.rememberUntil,undefined);
 const until=Math.floor(Date.now()/1000)+120;
 const access=jwt.decode(signPartnerToken(member,{rememberUntil:until}));assert.equal(access.exp,until);
});
test('refresh uses separate audience, HttpOnly cookie and preserves original thirty-day deadline',async()=>{
 const until=Math.floor(Date.now()/1000)+30*86400,res=response();
 const refresh=refreshToken(until);const result=await refreshPartnerSession(request(refresh),res,db);
 assert.equal(jwt.decode(result.token).rememberUntil,until);assert.equal(jwt.decode(res.cookies[0][1]).exp,until);
 assert.equal(res.cookies[0][2].httpOnly,true);assert.equal(res.cookies[0][2].sameSite,'lax');assert.equal(res.cookies[0][2].path,'/api/partners');
 await assert.rejects(verifyPartnerToken(refresh,db),{status:401});
 await assert.rejects(refreshPartnerSession(request(result.token),response(),db),{status:401});
});
test('expired refresh, revoked version, disabled member and company cannot renew',async()=>{
 const now=Math.floor(Date.now()/1000);
 await assert.rejects(refreshPartnerSession(request(refreshToken(now-1)),response(),db),{status:401});
 await assert.rejects(refreshPartnerSession(request(refreshToken(now+100,1)),response(),db),{status:401});
 for(const value of [{...member,isActive:false},{...member,company:{isActive:false}}]) await assert.rejects(refreshPartnerSession(request(refreshToken(now+100)),response(),{partnerMember:{findUnique:async()=>value}}),{status:401});
});
test('foreign origins, missing custom header and normal access cannot renew a session',async()=>{
 const token=refreshToken(Math.floor(Date.now()/1000)+100);
 await assert.rejects(refreshPartnerSession(request(token,'https://evil.example'),response(),db),{status:403});
 await assert.rejects(refreshPartnerSession(request(token,undefined,''),response(),db),{status:403});
});
test('logout cookie clear matches refresh cookie scope and production cookies require HTTPS',()=>{
 const res=response();setPartnerRefreshCookie(res,null);assert.equal(res.cleared[0],PARTNER_REFRESH_COOKIE);assert.equal(res.cleared[1].path,'/api/partners');
 const before=process.env.NODE_ENV;process.env.NODE_ENV='production';
 try {setPartnerRefreshCookie(res,member,Math.floor(Date.now()/1000)+100);assert.equal(res.cookies[0][2].secure,true);}finally{process.env.NODE_ENV=before;}
});
