const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const root=path.resolve(__dirname,'..');
function load(file,mocks){
 const code=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,allowJs:true}}).outputText;
 const exports={};vm.runInNewContext(code,{exports,require:id=>{assert.ok(id in mocks,'missing mock '+id);return mocks[id];},console,Buffer,Date,Map,setInterval,clearInterval,process},{filename:file});return exports;
}
function chatModule(){return load('apps/api/src/services/tripChatService.js',{
 '../shared/chatStoragePolicy.js':{},'../shared/tripChatVisibility.js':{},'./tripAcceptanceChat.js':{},
 './partnerRiderAccess.js':{getPartnerRiderContext:async()=>null},
 './partnerAccess.js':{},jsonwebtoken:{default:{}},'node:crypto':require('node:crypto'),
 '@aws-sdk/client-s3':{S3Client:class{}},'@aws-sdk/s3-request-presigner':{},'../utils/db.js':{prisma:{}},'./userSessions.js':{},'../utils/jwt.js':{},
 './riderTripAccess.js':{getVerifiedRiderPhoneVariants:async()=>[],phoneVariants:()=>[],riderTripAccessWhere:()=>({})},
 '../shared/tripChat.js':{isRiderChatEnded:s=>['COMPLETED','CANCELLED'].includes(s),RIDER_CHAT_ENDED_NOTICE:'ended'},'./driverPushAccess.js':{}
});}
function chatDb(member,trip){return {trip:{findUnique:async()=>trip},partnerMember:{findUnique:async()=>member},driverProfile:{findUnique:async()=>({status:'VERIFIED'})}};}
const trip={id:'t1',partnerCompanyId:'c1',partnerAssignedToId:'m1',driverId:'d1',status:'ACCEPTED'};
const member={id:'m1',companyId:'c1',role:'DISPATCHER',isActive:true,company:{isActive:true}};
test('partner chat is restricted to same company and assigned dispatcher',async()=>{
 const {chatAccess}=chatModule(),actor={id:'partner-m1',memberId:'m1',role:'PARTNER'};
 assert.equal((await chatAccess(chatDb(member,trip),'t1',actor)).id,'t1');
 for(const m of [{...member,companyId:'c2'},{...member,id:'m2'},{...member,isActive:false},{...member,mustChangePassword:true},{...member,company:{isActive:false}}]){
  await assert.rejects(chatAccess(chatDb(m,trip),'t1',actor),{status:403});
 }
});
test('company admin can support other dispatchers; reassignment removes prior dispatcher access',async()=>{
 const {chatAccess}=chatModule(),actor={id:'partner-m1',memberId:'m1',role:'PARTNER'};
 assert.equal((await chatAccess(chatDb({...member,id:'m2',role:'ADMIN'},trip),'t1',actor)).id,'t1');
 await assert.rejects(chatAccess(chatDb(member,{...trip,partnerAssignedToId:'m2'}),'t1',actor),{status:403});
});
test('partner chat closes after cancellation and unrelated riders cannot read it',async()=>{
 const {chatAccess}=chatModule();
 for(const status of ['COMPLETED','CANCELLED'])await assert.rejects(chatAccess(chatDb(member,{...trip,status}),'t1',{id:'partner-m1',memberId:'m1',role:'PARTNER'}),{code:'RIDER_CHAT_ENDED'});
 await assert.rejects(chatAccess(chatDb(member,trip),'t1',{id:'rider1',role:'RIDER'}),{status:403});
 assert.equal((await chatAccess(chatDb(member,trip),'t1',{id:'d1',role:'RIDER'})).id,'t1');
});
function routes(){
 const handlers={},db={};let booking;
 const fakeRouter={use(){},get(p,h){handlers['GET '+p]=h;},post(p,h){handlers['POST '+p]=h;},patch(p,h){handlers['PATCH '+p]=h;}};
 const fail=(m,status=400)=>Object.assign(new Error(m),{status});
 const access={partnerAuth(){},partnerWrap:fn=>fn,partnerFail:fail,companyScope:req=>req.partnerActor.superAdmin?req.query.companyId:req.partnerActor.member.companyId,
  requireCompanyAdmin:req=>{if(!req.partnerActor.superAdmin&&req.partnerActor.member.role!=='ADMIN')throw fail('denied',403);},requireSuperAdmin(){},publicMember:m=>m,publicCompany:c=>c,serializePartnerTrip:t=>t,partnerAudit:async()=>{}};
 load('apps/api/src/routes/partners.js',{'../services/partnerRiderAccess.js':load('apps/api/src/services/partnerRiderAccess.js',{}),'../shared/tripSelfService.js':load('apps/api/src/shared/tripSelfService.js',{}),'../shared/tripChatVisibility.js':{},express:{Router:()=>fakeRouter},bcryptjs:{default:{hash:async()=> 'hash'}},sharp:{default:()=>{}},'../utils/db.js':{prisma:db},'../services/partnerAccess.js':access,
  './trips.js':{createTripHandler:async req=>{booking=req;}},'../controllers/pricingController.js':{quote(){}},'../shared/tripChat.js':{assertNoContactNumber(){}},'../services/tripAudience.js':{emitDriverTripEvent(){}}});
 const res={json:d=>d,status(){return this;}};db.$transaction=fn=>fn(db);db.$queryRawUnsafe=async()=>[];db.partnerAuditLog={create:async()=>{}};
 return{handlers,db,res,booking:()=>booking};
}
const actor={id:'partner-m1',label:'Lan',member:{...member,sessionVersion:1}};
test('partner booking replaces passenger identity and ignores spoofed company/user fields',async()=>{
 const {handlers,db,res,booking}=routes();
 db.partnerCompany={findUnique:async()=>({id:'c1',name:'OT Travel',isActive:true,greeting:''})};
 db.partnerMember={findFirst:async()=>member};
 const req={partnerActor:actor,query:{companyId:'c2'},body:{riderId:'fake',riderName:'Customer',riderPhone:'secret',partnerCompanyId:'c2',assignedToId:'fake',stops:['Destination']}};
 await handlers['POST /trips'](req,res);
 assert.equal(booking().body.riderName,'');assert.equal(booking().body.riderPhone,'');assert.equal(booking().user,undefined);
 assert.equal(booking().partnerTripData.partnerCompanyId,'c1');assert.equal(booking().partnerTripData.partnerAssignedToId,'m1');
 assert.equal(booking().partnerTripData.partnerCompanyName,'OT Travel');
});
test('only own assigned trip or company admin can transfer/cancel; accepting trips cannot be cancelled',async()=>{
 const {handlers,db,res}=routes();let updated=false;
 db.trip={findFirst:async()=>({...trip,status:'PENDING',driverId:null}),update:async()=>{updated=true;return trip;}};
 db.partnerMember={findFirst:async()=>member};
 const req={partnerActor:{...actor,member:{...member,id:'m2'}},query:{},params:{id:'t1'},body:{assignedToId:'m1'},app:{get:()=>null}};
 await assert.rejects(handlers['PATCH /trips/:id/assignment'](req,res),{status:403});
 await assert.rejects(handlers['POST /trips/:id/cancel'](req,res),{status:403});assert.equal(updated,false);
 req.partnerActor=actor;db.trip.findFirst=async()=>trip;
 await assert.rejects(handlers['POST /trips/:id/cancel'](req,res),{status:409});assert.equal(updated,false);
});
test('member changes preserve last company admin and require moving active assignments before disabling',async()=>{
 const {handlers,db,res}=routes();let updated=false;
 db.partnerMember={findFirst:async()=>({...member,role:'ADMIN'}),count:async()=>0,update:async()=>{updated=true;}};
 db.trip={count:async()=>1};
 const req={partnerActor:{...actor,member:{...member,role:'ADMIN'}},params:{id:'m1'},query:{},body:{isActive:false}};
 await assert.rejects(handlers['PATCH /members/:id'](req,res),{status:400});assert.equal(updated,false);
 db.partnerMember.findFirst=async()=>member;
 await assert.rejects(handlers['PATCH /members/:id'](req,res),{status:400});assert.equal(updated,false);
});

test('read-only trip access can open ended trips without reopening their chat or crossing company scope',async()=>{
 const {chatAccess}=chatModule(),ended={...trip,status:'CANCELLED'};
 const actor={id:'partner-m1',memberId:'m1',role:'PARTNER'};
 await assert.rejects(chatAccess(chatDb(member,ended),'t1',{...actor}),{code:'RIDER_CHAT_ENDED'});
 assert.equal((await chatAccess(chatDb(member,ended),'t1',{...actor},{allowEnded:true})).id,'t1');
 await assert.rejects(chatAccess(chatDb({...member,companyId:'other'},ended),'t1',{...actor},{allowEnded:true}),{status:403});
 const riderTrip={...ended,partnerCompanyId:null,riderId:'r1',riderPhone:''};
 assert.equal((await chatAccess(chatDb(member,riderTrip),'t1',{id:'r1',role:'RIDER'},{allowEnded:true})).id,'t1');
 await assert.rejects(chatAccess(chatDb(member,riderTrip),'t1',{id:'r1',role:'RIDER'}),{code:'RIDER_CHAT_ENDED'});
 await assert.rejects(chatAccess(chatDb(member,riderTrip),'t1',{id:'outsider',role:'RIDER'},{allowEnded:true}),{status:403});
});
