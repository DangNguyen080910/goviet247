import {prisma} from '../utils/db.js';
import {AUTO_APPROVAL_FIELDS} from '../services/tripAutoApprovalPolicy.js';

export function createTripAutoApprovalConfigController(db=prisma) {
  const item = config => ({autoApproveNewTrips:config.autoApproveNewTrips === true,
    autoApproveRequeuedTrips:config.autoApproveRequeuedTrips === true,updatedAt:new Date(config.updatedAt).toISOString()});
  async function current() { return await db.tripConfig.findFirst({orderBy:{id:'asc'}}) || db.tripConfig.create({data:{}}); }
  return {
    async get(req,res) {
      try {res.setHeader('Cache-Control','no-store');return res.json({success:true,item:item(await current())});}
      catch {return res.status(503).json({success:false,message:'Chưa tải được cấu hình tự duyệt. Vui lòng kiểm tra cập nhật API và migration.'});}
    },
    async patch(req,res) {
      const body=req.body || {}, fields=AUTO_APPROVAL_FIELDS.filter(field=>Object.hasOwn(body,field));
      if(fields.length !== 1 || typeof body[fields[0]] !== 'boolean' || typeof body.expectedUpdatedAt !== 'string' ||
        Object.keys(body).some(key=>key !== 'expectedUpdatedAt' && !fields.includes(key))) return res.status(400).json({success:false,message:'Chỉ cập nhật một công tắc bằng giá trị bật/tắt hợp lệ.'});
      try {
        const config=await current();
        if(body.expectedUpdatedAt !== new Date(config.updatedAt).toISOString()) return res.status(409).json({success:false,message:'Cấu hình vừa thay đổi. Vui lòng tải lại trước khi bật/tắt.'});
        const updated=await db.tripConfig.update({where:{id:config.id,updatedAt:config.updatedAt},data:{[fields[0]]:body[fields[0]]}});
        res.setHeader('Cache-Control','no-store');
        return res.json({success:true,item:item(updated)});
      } catch(error) {return res.status(error.code === 'P2025' ? 409 : 503).json({success:false,message:error.code === 'P2025' ? 'Cấu hình vừa thay đổi. Vui lòng tải lại.' : 'Chưa xác nhận được thay đổi. Vui lòng tải lại để kiểm tra trạng thái.'});}
    },
  };
}
export const tripAutoApprovalConfig = createTripAutoApprovalConfigController();
