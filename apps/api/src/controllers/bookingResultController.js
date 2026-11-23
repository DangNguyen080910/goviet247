import {prisma} from '../utils/db.js';
import {bookingRequestKey} from '../services/bookingIdentity.js';
export async function getBookingResult(req,res){
  try{
    const requestId=String(req.query.requestId || '');
    if(!requestId || requestId.length>150)return res.status(400).json({success:false,message:'Mã yêu cầu không hợp lệ.'});
    const key=bookingRequestKey({...req,body:{bookingRequestId:requestId}});
    const trip=await prisma.trip.findUnique({where:{bookingRequestKey:key},select:{id:true,status:true}});
    return res.json({success:true,trip});
  }catch(error){return res.status(error.status || 503).json({success:false,message:'Chưa kiểm tra được kết quả đặt chuyến. Vui lòng kiểm tra Hoạt động trước khi đặt lại.'});}
}
