import {createCallPush} from '../services/tripCallPush.js';
import {registerCallDevice,unregisterCallDevice,deliverCallInvites} from '../services/tripCallDevices.js';
import {Router} from 'express';
import {chatAuth} from '../services/tripChatService.js';
import {prisma} from '../utils/db.js';
import {createCallAws} from '../services/tripCallAws.js';
import {createTripCallService} from '../services/tripCallService.js';
const router=Router();
let service,apns;
export function tripCalls() {
 if(process.env.TRIP_CALL_ENABLED!=='true')return null;
 return service ||= createTripCallService(prisma,createCallAws());
}
router.use(chatAuth);
router.use((req,res,next)=>{res.set('Cache-Control','no-store');if(!tripCalls())return res.status(503).json({success:false,code:'CALL_NOT_ENABLED',message:'Tính năng gọi chưa được mở.'});next();});
const wrap=fn=>async(req,res)=>{try{await fn(req,res);}catch(e){console.error('[TripCall]',e.name);res.status(e.status || 503).json({success:false,code:e.code,message:e.status?e.message:'Không xử lý được cuộc gọi. Vui lòng thử lại.'});}};
router.post('/devices',wrap(async(req,res)=>res.json(await registerCallDevice(prisma,req.chatActor,req.chatCallSession,req.body))));
router.delete('/devices/:deviceId',wrap(async(req,res)=>res.json(await unregisterCallDevice(prisma,req.chatActor,req.chatCallSession,req.params.deviceId))));
router.get('/incoming',wrap(async(req,res)=>res.json({success:true,items:await tripCalls().incoming(req.chatActor,req.query.deviceId)})));
router.get('/trip/:id',wrap(async(req,res)=>res.json({success:true,...await tripCalls().eligibility(req.params.id,req.chatActor)})));
router.post('/trip/:id',wrap(async(req,res)=>res.status(201).json({success:true,call:await tripCalls().start(req.params.id,req.chatActor,req.body)})));
router.post('/:id/accept',wrap(async(req,res)=>res.json(await tripCalls().accept(req.params.id,req.chatActor,req.body))));
router.get('/:id/session',wrap(async(req,res)=>res.json({success:true,call:await tripCalls().session(req.params.id,req.chatActor,req.query.deviceId)})));
router.post('/:id/heartbeat',wrap(async(req,res)=>res.json({success:true,call:await tripCalls().heartbeat(req.params.id,req.chatActor,req.body)})));
router.post('/:id/end',wrap(async(req,res)=>res.json({success:true,call:await tripCalls().end(req.params.id,req.chatActor,req.body)})));
router.get('/:id/recording',wrap(async(req,res)=>res.json({success:true,...await tripCalls().recording(req.params.id,req.chatActor)})));
let sweeping=false;
export async function sweepTripCalls(){if(sweeping || process.env.TRIP_CALL_ENABLED!=='true')return;sweeping=true;try{await tripCalls().sweep();}catch(e){console.error('[TripCall] worker',e.name);}finally{sweeping=false;}}
let pushing=false;
export async function deliverTripCallInvites(){
 if(pushing || process.env.TRIP_CALL_ENABLED!=='true' || process.env.TRIP_CALL_VOIP_PUSH_ENABLED!=='true')return;
 pushing=true;try{apns ||= createCallPush();await deliverCallInvites(prisma,apns);}catch(e){console.error('[TripCall] push worker',e.name);}finally{pushing=false;}
}
export default router;
