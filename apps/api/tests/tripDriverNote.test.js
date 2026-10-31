import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/controllers/tripDriverNoteController.js',import.meta.url),'utf8').replace(/^import.*;\n/gm,'').replace('export async function','async function');
function fixture(status='PENDING') {
  const date=new Date('2026-10-31T00:00:00Z');
  let trip={id:'t1',status,driverId:status==='PENDING'?null:'d1',updatedAt:date,dispatcherNote:'Cũ',note:'Ghi chú khách',verifiedNote:'Nội bộ'};
  const writes=[],logs=[],events=[];
  const tx={trip:{findUnique:async()=>trip,update:async({data})=>{writes.push(data);trip={...trip,...data,updatedAt:new Date('2026-10-31T00:01:00Z')};return trip;}},adminTripActionLog:{create:async({data})=>logs.push(data)}};
  const prisma={$transaction:fn=>fn(tx)};
  const update=new Function('prisma','lockTrip','emitDriverTripEvent',source+'; return updateTripDriverNote;')(prisma,async()=>{},async(io,event,payload)=>events.push({room:'audience',event,payload}));
  const io={to:room=>({emit:(event,payload)=>events.push({room,event,payload})})};
  async function call(text='Mới',expected=date.toISOString()) {
    const res={statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};
    await update({params:{id:'t1'},body:{dispatcherNote:text,expectedUpdatedAt:expected},admin:{id:1,role:'ADMIN',username:'A'},app:{get:()=>io}},res);return res;
  }
  return {call,writes,logs,events,get trip(){return trip;}};
}
test('note is saved separately and refreshes driver audience without including the text in events',async()=>{
  const f=fixture();const res=await f.call('  Gọi khách trước 15 phút  ');
  assert.equal(res.body.success,true);assert.equal(f.trip.dispatcherNote,'Gọi khách trước 15 phút');
  assert.equal(f.trip.note,'Ghi chú khách');assert.equal(f.trip.verifiedNote,'Nội bộ');
  assert.equal(f.logs.length,1);assert.equal(f.events[0].event,'trip:changed');
  assert.equal(f.events[0].payload.silent,true);assert.equal('dispatcherNote' in f.events[0].payload,false);
});
test('accepted driver is refreshed, and deleting the note is supported',async()=>{
  const f=fixture('ACCEPTED');await f.call('');assert.equal(f.trip.dispatcherNote,null);
  assert(f.events.some(e=>e.room==='driver:d1'));
});
test('stale edits and closed trips are rejected without modifying data',async()=>{
  const stale=fixture();assert.equal((await stale.call('Mới','2026-10-30T00:00:00Z')).statusCode,409);assert.equal(stale.writes.length,0);
  for(const status of ['COMPLETED','CANCELLED']){const f=fixture(status);assert.equal((await f.call()).statusCode,409);assert.equal(f.writes.length,0);}
});
test('invalid or oversized note input is rejected',async()=>{
  for(const note of [null,{},'x'.repeat(2001)]){const f=fixture();assert.equal((await f.call(note)).statusCode,400);assert.equal(f.writes.length,0);}
});
test('Rider detail hides dispatcher/internal notes while assigned Driver detail keeps dispatcher instructions only',async()=>{
  const controller=readFileSync(new URL('../src/controllers/tripController.js',import.meta.url),'utf8');
  const start=controller.indexOf('export async function getTripById('),end=controller.indexOf('\n}',start)+2;
  const trip={id:'t1',riderId:'r1',driverId:'d1',dispatcherNote:'Điều hành',verifiedNote:'Chỉ admin',riderPhone:'0901234567'};
  const deps={prisma:{trip:{findUnique:async()=>trip}},getVerifiedRiderPhoneVariants:async()=>[],phoneVariants:()=>[]};
  const get=new Function(...Object.keys(deps),controller.slice(start,end).replace('export ','')+'; return getTripById;')(...Object.values(deps));
  for(const id of ['r1','d1']){
    let data;await get({params:{id:'t1'},user:{id}},{json:body=>{data=body.data;},status:()=>assert.fail('error')});
    assert.equal(data.verifiedNote,undefined);assert.equal(data.dispatcherNote,id==='d1'?'Điều hành':undefined);
  }
});
