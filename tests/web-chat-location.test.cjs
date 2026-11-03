const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../apps/web/src/components/TripChatHub.jsx'),'utf8');
const body=source.slice(source.indexOf('  async function currentLocation()'),source.indexOf('  const mapUrl'));
function harness(gps){const calls=[],activeRequest={current:1};let options;
 const fn=new Function('navigator','activeRequest','post','tripId','makeId','load',body+';return currentLocation;')({geolocation:{getCurrentPosition:(success,error,value)=>{options=value;gps(success,error);}}},activeRequest,async(...args)=>calls.push(args),'full-trip-id',()=> 'gps-client-id',async()=>{});
 return {fn,calls,activeRequest,options:()=>options};}
test('web sends only freshly requested device coordinates as a location message',async()=>{
 const h=harness(success=>success({coords:{latitude:10.123,longitude:106.456}}));await h.fn();
 assert.equal(h.options().maximumAge,0);assert.equal(h.options().enableHighAccuracy,true);assert.equal(h.calls.length,1);
 assert.equal(h.calls[0][0],'/full-trip-id/messages');assert.equal(h.calls[0][1].latitude,10.123);assert.equal(h.calls[0][1].longitude,106.456);assert.equal(h.calls[0][1].locationLabel,'Định vị hiện tại');
});
test('denied location permission sends nothing and explains how to allow GPS',async()=>{
 const h=harness((success,error)=>error({code:1}));await assert.rejects(h.fn(),/cho phép vị trí/);assert.equal(h.calls.length,0);
});
test('switching chats while GPS is pending prevents sending to the old trip',async()=>{
 let finish;const h=harness(success=>{finish=success;});const work=h.fn();h.activeRequest.current++;finish({coords:{latitude:10,longitude:106}});await work;assert.equal(h.calls.length,0);
});
