const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'../apps/rider-mobile/app/booking.tsx'),'utf8');
const ast=ts.createSourceFile('booking.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let callback,payloadExpression,confirmation;
function visit(node){
 if(ts.isCallExpression(node)&&node.expression.getText(ast)==='useFocusEffect'&&node.getText(ast).includes('setModeLoading(true)')) callback=node.arguments[0].arguments[0].getText(ast);
 if(ts.isReturnStatement(node)&&node.expression&&ts.isObjectLiteralExpression(node.expression)&&node.expression.properties.some(p=>p.name?.getText(ast)==='bookingCompanyId'))payloadExpression=node.expression.getText(ast);
 if(ts.isIfStatement(node)&&node.expression.getText(ast).includes("bookingMode==='personal'")&&node.expression.getText(ast).includes('bookingCompanies.length'))confirmation=node.expression.getText(ast);
 ts.forEachChild(node,visit);
}visit(ast);assert(callback&&payloadExpression&&confirmation);
function effectHarness({token=null,userId='ordinary',companies=[],saved=null,getCompanies}={}){
 const state={},calls=[],alerts=[];
 const deps={getRiderToken:async()=>{calls.push('token');return token;},getMe:async()=>{calls.push('me');return {user:{id:userId}};},getBookingCompanies:async()=>{calls.push('companies');return getCompanies?getCompanies():companies;},getRiderBookingMode:async id=>{calls.push(['read-preference',id]);return saved;},setRiderBookingMode:async(...args)=>calls.push(['write-preference',...args]),Alert:{alert:(...args)=>alerts.push(args)}};
 for(const key of ['ModeLoading','ModeError','BookingCompanies','ModeUserId','BookingMode'])deps['set'+key]=value=>{state[key]=value;};
 const js=ts.transpileModule(`const effect=${callback};`,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
 const effect=new Function(...Object.keys(deps),js+';return effect;')(...Object.values(deps));
 return {state,calls,alerts,start:effect};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('guest goes directly to personal flow without profile, company lookup or preferences',async()=>{
 const h=effectHarness();h.start();await settle();assert.equal(h.state.BookingMode,'personal');assert.equal(h.state.ModeUserId,'');assert.deepEqual(h.state.BookingCompanies,[]);assert.deepEqual(h.calls,['token']);assert.equal(h.alerts.length,0);
});
test('ordinary logged-in Rider defaults to personal with no Partner alert or extra selection',async()=>{
 const h=effectHarness({token:'normal-session'});h.start();await settle();assert.equal(h.state.BookingMode,'personal');assert.deepEqual(h.state.BookingCompanies,[]);assert.equal(h.alerts.length,0);assert.equal(h.state.ModeLoading,false);
});
test('a late Partner lookup cannot overwrite the ordinary account after switching accounts',async()=>{
 let finish;const h=effectHarness({token:'old-partner',userId:'old-user',getCompanies:()=>new Promise(resolve=>{finish=resolve;})});
 const cancel=h.start();await settle();cancel();finish([{id:'old-company',name:'Old Partner'}]);await settle();assert.equal(h.state.BookingCompanies,undefined);assert.equal(h.state.BookingMode,undefined);
 const normal=effectHarness({token:'new-ordinary',userId:'new-user'});normal.start();await settle();assert.deepEqual(normal.state.BookingCompanies,[]);assert.equal(normal.state.BookingMode,'personal');assert.equal(normal.alerts.length,0);
});
test('Partner keeps remembered personal choice and still has the company list',async()=>{
 const companies=[{id:'ot',name:'OT Travel'}],h=effectHarness({token:'partner',companies,saved:'personal'});h.start();await settle();assert.equal(h.state.BookingMode,'personal');assert.deepEqual(h.state.BookingCompanies,companies);
});
function payload(overrides={}){
 const deps={pickupFullAddress:'A',dropoffAddress:'B',cleanedStops:['B'],pickupTime:'future',returnTime:'',direction:'ONE_WAY',carType:'CAR_5',fuelPreference:'ANY',distanceKm:100,safeTotalDriveMinutes:120,safeOutboundDriveMinutes:120,safeReturnDriveMinutes:0,safeEstimatedDurationMinutes:120,destinationServiceDates:[],serviceAnchor:'B',quote:{totalPrice:500000,raw:{}},selectedCompany:undefined,isCompanyBooking:false,riderName:' Normal customer ',riderPhone:' 0901234567 ',finalNote:null,toIsoFromDatetimeLocal:()=> '2099-01-01T00:00:00Z',...overrides};
 return JSON.parse(JSON.stringify(new Function(...Object.keys(deps),`return (${payloadExpression});`)(...Object.values(deps))));
}
test('ordinary and guest payloads omit company id and preserve entered passenger details',()=>{
 const p=payload();assert.equal(Object.hasOwn(p,'bookingCompanyId'),false);assert.equal(p.riderName,'Normal customer');assert.equal(p.riderPhone,'0901234567');assert.equal(Object.hasOwn(p,'partnerCompanyId'),false);
});
test('company is submitted only when selected; selecting personal retains the ordinary payload',()=>{
 assert.equal(payload({selectedCompany:{id:'ot'},isCompanyBooking:true}).bookingCompanyId,'ot');
 assert.equal(payload({selectedCompany:{id:'ot'},isCompanyBooking:true}).riderName,'');
 assert.equal(Object.hasOwn(payload({selectedCompany:undefined,isCompanyBooking:false}),'bookingCompanyId'),false);
});
test('personal-booking confirmation is skipped for guests and ordinary users',()=>{
 const condition=new Function('bookingMode','bookingCompanies',`return Boolean(${confirmation});`);
 assert.equal(condition('personal',[]),false);assert.equal(condition('personal',[{id:'ot'}]),true);assert.equal(condition('ot',[{id:'ot'}]),false);
});
