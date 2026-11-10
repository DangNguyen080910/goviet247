import { registrationDriverContract, driverContractReconsentEnabled, activeDriverContract, buildContractAcceptance, acceptanceEvidence, renderContractEvidence, currentDriverContract, lockContractPublication } from '../services/driverContract.js';
const replyError = (res, error) => {
  if (!error.statusCode) console.error('[DriverContract]', error);
  return res.status(error.statusCode || 500).json({success:false, message:error.statusCode ? error.message : 'Không xử lý được hợp đồng. Vui lòng thử lại.'});
};
export function makeDriverContractController(db, env = process.env) {
  return {
    async current(req,res) {
      try {
        const profile = await db.driverProfile.findUnique({where:{userId:req.user.uid},include:{user:{include:{phones:{orderBy:{createdAt:'desc'},take:1}}}}});
        const {contract,release} = await (profile ? currentDriverContract(db,env) : registrationDriverContract(db,env));
        const latest = profile ? await db.driverContractAcceptance.findFirst({where:{driverProfileId:profile.id,isActive:true},orderBy:[{agreedAt:'desc'},{id:'desc'}]}) : null;
        const history=profile?await db.driverContractAcceptance.findMany({where:{driverProfileId:profile.id},orderBy:[{agreedAt:'desc'},{id:'desc'}]}):[];
        res.setHeader('Cache-Control','no-store');
        return res.json({success:true,contract,release,reconsentEnabled:driverContractReconsentEnabled(env),needsAcceptance:driverContractReconsentEnabled(env) && !!profile && !(latest?.contractVersion===contract.version && latest?.contractFileHash===contract.contentHash),history:history.map(acceptanceEvidence),profile:profile ? {id:profile.id,fullName:profile.fullName,citizenId:profile.citizenId,residentialAddress:profile.residentialAddress,plateNumber:profile.plateNumber,phone:profile.user?.phones?.[0]?.e164 || null,updatedAt:profile.updatedAt} : null,acceptance:latest ? acceptanceEvidence(latest) : null});
      } catch(error){return replyError(res,error);}
    },
    async accept(req,res) {
      try {
        if (!driverContractReconsentEnabled(env)) throw Object.assign(new Error('Tính năng xác nhận lại hợp đồng đang tạm dừng. Bạn vẫn có thể sử dụng ứng dụng.'),{statusCode:409});
        const result = await db.$transaction(async tx => {
          await lockContractPublication(tx);
          const {contract}=await currentDriverContract(tx,env);
          const found = await tx.driverProfile.findUnique({where:{userId:req.user.uid},select:{id:true}});
          if (!found) throw Object.assign(new Error('Chưa có hồ sơ tài xế.'),{statusCode:404});
          await tx.$queryRaw`SELECT id FROM "DriverProfile" WHERE id = ${found.id} FOR UPDATE`;
          const profile = await tx.driverProfile.findUnique({where:{id:found.id},include:{user:{include:{phones:{orderBy:{createdAt:'desc'},take:1}}}}});
          if (req.body?.expectedUpdatedAt !== profile.updatedAt.toISOString()) throw Object.assign(new Error('Thông tin hồ sơ vừa thay đổi. Vui lòng tải lại để kiểm tra trước khi xác nhận.'),{statusCode:409});
          // New explicit acceptance always requires a hash, including v1.
          if (!req.body?.contractFileHash) throw Object.assign(new Error('Vui lòng tải và đọc nội dung hợp đồng.'),{statusCode:400});
          const data = buildContractAcceptance(req.body, profile, {ipAddress:req.ip || req.socket?.remoteAddress || null,deviceInfo:String(req.headers['user-agent'] || '').slice(0,1000) || null,appVersion:String(req.headers['x-app-version'] || '').slice(0,50) || null,phoneE164:profile.user?.phones?.[0]?.e164 || null},env,contract);
          const existing = await tx.driverContractAcceptance.findFirst({where:{driverProfileId:profile.id,isActive:true,contractVersion:data.contractVersion,contractFileHash:data.contractFileHash},orderBy:{agreedAt:'desc'}});
          if (existing && JSON.stringify(existing.contentSnapshot?.identity) === JSON.stringify(data.contentSnapshot.identity)) return existing;
          await tx.driverContractAcceptance.updateMany({where:{driverProfileId:profile.id,isActive:true},data:{isActive:false}});
          return tx.driverContractAcceptance.create({data});
        });
        return res.json({success:true,acceptance:acceptanceEvidence(result)});
      }catch(error){return replyError(res,error);}
    },
    async exportEvidence(req,res) {
      try {
        const profile = await db.driverProfile.findUnique({where:{id:req.params.id},select:{id:true,fullName:true,citizenId:true,residentialAddress:true,updatedAt:true}});
        if (!profile) return res.status(404).json({success:false,message:'Không tìm thấy tài xế.'});
        const records = await db.driverContractAcceptance.findMany({where:{driverProfileId:profile.id},orderBy:[{agreedAt:'asc'},{id:'asc'}]});
        const asHtml = req.query?.format === 'html';
        const file = `driver-contract-evidence-${profile.id.replace(/[^a-zA-Z0-9_-]/g,'')}.${asHtml ? 'html' : 'json'}`;
        if (asHtml) {
          res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Content-Disposition',`attachment; filename="${file}"`);
          return res.send(renderContractEvidence(profile,records));
        }
        res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Content-Disposition',`attachment; filename="${file}"`);
        return res.send(JSON.stringify({exportedAt:new Date().toISOString(),currentProfile:profile,notice:'currentProfile là thông tin hiện tại, không phải xác nhận thông tin tại ngày giao kết cũ. Chỉ contentSnapshot đã xác minh mới chứng minh nội dung được lưu; không coi mọi bản ghi là đã đồng ý v2.',records:records.map(acceptanceEvidence)},null,2));
      }catch(error){return replyError(res,error);}
    }
  };
}
