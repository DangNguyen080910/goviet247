const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const root=path.resolve(__dirname,'..');
function load(file,modules={}){
  const exports={};
  const source=fs.readFileSync(path.join(root,file),'utf8');
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,
    {exports,URLSearchParams,console,require:id=>{assert.ok(id in modules,'missing mock '+id);return modules[id];}});
  return exports;
}
const vehicle=load('apps/admin-mobile/utils/tripVehicle.ts');
const profile={vehicleType:'Xe 7 chỗ',vehicleBrand:'Toyota',vehicleModel:'Innova',vehicleColor:'Trắng',vehicleFuelType:'GASOLINE',vehicleYear:2024,plateNumber:'51H-12345'};
const raw={id:'trip-1',driverId:'driver-1',carType:'CAR_5',fuelPreference:'ELECTRIC',driverName:'Tài xế thử',driver:{id:'driver-1',driverProfile:profile}};
const plain=value=>JSON.parse(JSON.stringify(value));
test('vehicle summary keeps requested seats/fuel separate from the assigned driver actual vehicle',()=>{
  const info=vehicle.tripVehicleRows(raw),rows=Object.fromEntries(info.rows);
  assert.equal(info.request,'Xe 5 chỗ · Xe điện');assert.equal(info.hasDriver,true);
  assert.equal(rows['Loại xe tài xế'],'Xe 7 chỗ');assert.equal(rows['Nhiên liệu xe tài xế'],'Xe xăng');
  assert.equal(rows['Hãng / Dòng xe'],'Toyota · Innova');assert.equal(rows['Màu xe'],'Trắng');
  assert.equal(rows['Đời xe'],'2024');assert.equal(rows['Biển số'],'51H-12345');
});
test('no driver or incomplete legacy profile never borrows the customer request as actual vehicle details',()=>{
  const request={carType:'CAR_16',fuelPreference:'ELECTRIC'};
  assert.equal(vehicle.tripVehicleRows(request).hasDriver,false);
  const missing=vehicle.tripVehicleRows({...request,driver:{id:'driver-1'}});
  assert.equal(missing.hasDriver,true);assert.equal(missing.rows.length,0);
  const rows=Object.fromEntries(vehicle.tripVehicleRows({...request,driver:{id:'driver-1',driverProfile:{vehicleColor:'Đỏ',vehicleYear:'bad'}}}).rows);
  assert.equal(rows['Loại xe tài xế'],'Chưa cập nhật');assert.equal(rows['Nhiên liệu xe tài xế'],'Chưa cập nhật');
  assert.equal(rows['Đời xe'],'Chưa cập nhật');assert.equal(rows['Màu xe'],'Đỏ');
  assert.equal(vehicle.vehicleTypeLabel('CAR_16'),'Xe 16 chỗ');
});
const route=require('../apps/api/src/shared/tripRoute.js');
function api(file,body){return load('apps/admin-mobile/services/'+file,{
  '../utils/tripVehicle':vehicle,'../../api/src/shared/tripRoute.js':route,
  './adminRequest':{adminRequest:async()=>body},
});}
test('all Admin Mobile detail adapters and assigned list preserve all vehicle fields returned by API',async()=>{
  const assigned=api('assignedTripsApi.ts',{success:true,trips:[raw],trip:raw});
  const items=await assigned.fetchAssignedTrips('ACCEPTED');const detail=await assigned.fetchAssignedTripDetail(raw.id);
  const pending=await api('pendingTripsApi.ts',{trip:raw}).fetchPendingTripDetail(raw.id);
  const unassigned=await api('unassignedTripsApi.ts',{trip:raw}).fetchUnassignedTripDetail(raw.id);
  for(const result of [items[0],detail,pending,unassigned]){
    assert.deepEqual(plain(result.driverVehicle),profile);assert.equal(result.driverId,'driver-1');
    assert.equal(result.carType,'CAR_5');assert.equal(result.fuelPreference,'ELECTRIC');
  }
});
test('assigned-trips API selects vehicle fields in its existing query for every status, without per-driver queries',async()=>{
  const source=fs.readFileSync(path.join(root,'apps/api/src/controllers/tripController.js'),'utf8');
  const a=source.indexOf('export async function getAssignedTrips('),b=source.indexOf('\n}',a)+2;
  let queries=0;
  const prisma={tripConfig:{findFirst:async()=>({})},trip:{findMany:async({select})=>{
    queries++;for(const key of Object.keys(profile))assert.equal(select.driver.select.driverProfile.select[key],true,key);
    return[raw];
  }}};
  const controller=new Function('prisma','adminTripMoney',source.slice(a,b).replace('export ','')+';return getAssignedTrips;')(prisma,()=>({}));
  for(const status of ['ACCEPTED','CONTACTED','IN_PROGRESS','COMPLETED','CANCELLED']){
    let body;await controller({query:{status}},{json:data=>{body=data;},status:()=>assert.fail('API failed')});
    assert.equal(body.success,true);assert.deepEqual(body.trips[0].driver.driverProfile,profile);
  }
  assert.equal(queries,5);
});

const jsx={jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props}),Fragment:'Fragment'};
const hosts={ActivityIndicator:'Spinner',Modal:'Modal',Pressable:'Button',ScrollView:'Scroll',StyleSheet:{create:x=>x},Text:'Text',View:'View'};
function nodes(tree){if(!tree||typeof tree!=='object')return[];if(Array.isArray(tree))return tree.flatMap(nodes);return[tree,...nodes(tree.props?.children)];}
function text(tree){if(tree==null||typeof tree==='boolean')return'';if(Array.isArray(tree))return tree.map(text).join(' ');if(typeof tree!=='object')return String(tree);return text(tree.props?.children);}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function buttonHarness(fetch){
  const state=[],effects=[];let cursor=0,effectIndex=0,pending=[];
  const react={useState(initial){const id=cursor++;if(!(id in state))state[id]=initial;return[state[id],value=>{state[id]=typeof value==='function'?value(state[id]):value;}];},
    useEffect(fn,deps){const id=effectIndex++;const previous=effects[id];if(!previous||deps.some((d,i)=>d!==previous.deps[i]))pending.push(()=>{previous?.cleanup?.();effects[id]={deps,cleanup:fn()};});}};
  const Button=load('apps/admin-mobile/components/TripVehicleButton.tsx',{
    react,'react/jsx-runtime':jsx,'react-native':hosts,'react-native-safe-area-context':{SafeAreaView:'SafeArea'},
    './TripCode':{default:'TripCode'},'./TripVehicleInfo':{default:'VehicleInfo'},
    '../services/assignedTripsApi':{fetchAssignedTripDetail:fetch},
  }).default;
  return {render(tripId='trip-1'){cursor=0;effectIndex=0;pending=[];const tree=Button({tripId});for(const fn of pending)fn();return tree;},
    press(tree,label){const target=nodes(tree).find(n=>n.type==='Button'&&text(n)===label);assert.ok(target,label);target.props.onPress({stopPropagation(){}});}};
}
test('trip vehicle button is lazy, uses one request when opened and rejects a late response for another trip',async()=>{
  const pending=[];const h=buttonHarness(id=>new Promise(resolve=>pending.push({id,resolve})));
  let tree=h.render();assert.equal(pending.length,0);
  h.press(tree,'Thông tin xe');tree=h.render();assert.equal(pending.length,1);
  h.render('trip-2');assert.equal(pending.length,2);
  pending[0].resolve({...raw,driverName:'OLD DRIVER'});await flush();tree=h.render('trip-2');
  assert.equal(text(tree).includes('OLD DRIVER'),false);
  pending[1].resolve({...raw,id:'trip-2',driverName:'CURRENT DRIVER',driverVehicle:profile});await flush();tree=h.render('trip-2');
  assert.ok(text(tree).includes('CURRENT DRIVER'));
  h.press(tree,'Đóng');tree=h.render('trip-2');assert.equal(nodes(tree).some(n=>n.type==='Modal'),false);
});
test('wrong-trip response is shown as an error rather than another driver vehicle',async()=>{
  const h=buttonHarness(async()=>({...raw,id:'wrong-trip',driverName:'WRONG DRIVER'}));
  let tree=h.render();h.press(tree,'Thông tin xe');h.render();await flush();tree=h.render();
  assert.ok(text(tree).includes('Thông tin chuyến chưa khớp'));assert.equal(text(tree).includes('WRONG DRIVER'),false);
});
