import { z } from 'zod';
import { rulesContentSchema, rulesTemplate, rulesHash, rulesError, lockRules, currentRules, rulesChanges, assertRulesAcceptance, assertRulesPublish } from '../services/driverRules.js';
const saveSchema=z.object({content:rulesContentSchema,changeSummary:z.string().trim().min(1).max(3000),expectedRevision:z.number().int().positive().nullable().optional(),expectedDraftId:z.string().max(100).nullable().optional(),expectedBaseVersionId:z.string().max(100).nullable().optional()});
const actor=req=>String(req.admin?.username||req.admin?.id||'ADMIN');
const metadata=row=>row?{id:row.id,version:row.version,revision:row.revision,contentHash:row.contentHash,changeSummary:row.changeSummary,publishedAt:row.publishedAt,publishedBy:row.publishedBy,createdAt:row.createdAt}:null;
const receipt=row=>row?{versionId:row.versionId,contentHash:row.contentHash,acceptedAt:row.acceptedAt,confirmation:row.confirmation}:null;
function fail(res,error) {
  if(!error.statusCode && error.name!=='ZodError') console.error('[DriverRules]',error);
  return res.status(error.statusCode||(error.name==='ZodError'?400:500)).json({success:false,message:error.statusCode?error.message:error.name==='ZodError'?'Vui lòng nhập đầy đủ tiêu đề, nội dung, tóm tắt thay đổi; không để trùng mã mục.':'Chưa xử lý được quy định. Vui lòng thử lại.'});
}
async function profileFor(db,req) {
  const p=await db.driverProfile.findUnique({where:{userId:req.user.uid},select:{id:true}});
  if(!p) throw rulesError('Chưa tìm thấy hồ sơ tài xế.',403);
  return p;
}
export function makeDriverRulesController(db) {return {
  async adminList(req,res) {
    try {
      const [current,draft,history]=await Promise.all([
        currentRules(db),db.driverRulesVersion.findFirst({where:{publishedAt:null}}),
        db.driverRulesVersion.findMany({where:{publishedAt:{not:null}},orderBy:{version:'desc'},take:50,select:{id:true,version:true,changeSummary:true,publishedAt:true,publishedBy:true,contentHash:true}})
      ]);
      res.setHeader('Cache-Control','no-store');
      return res.json({success:true,current,draft,history,template:rulesTemplate});
    } catch(e){return fail(res,e);}
  },
  async save(req,res) {
    try {
      const body=saveSchema.parse(req.body);
      const item=await db.$transaction(async tx=>{
        await lockRules(tx);
        const [active,draft]=await Promise.all([currentRules(tx),tx.driverRulesVersion.findFirst({where:{publishedAt:null}})]);
        if((draft && (body.expectedRevision!==draft.revision || body.expectedDraftId!==draft.id)) || (!draft && (body.expectedRevision!=null || body.expectedDraftId!=null))) throw rulesError('Bản nháp đã thay đổi. Vui lòng tải lại trước khi sửa.');
        if((body.expectedBaseVersionId??null)!==(active?.id||null)) throw rulesError('Đã có bản mới được phát hành trong lúc soạn. Vui lòng tải lại để tránh ghi đè nội dung mới.');
        const data={content:body.content,contentHash:rulesHash(body.content),changeSummary:body.changeSummary};
        if(draft) return tx.driverRulesVersion.update({where:{id:draft.id},data:{...data,revision:{increment:1}}});
        return tx.driverRulesVersion.create({data:{...data,createdBy:actor(req),baseVersionId:active?.id||null}});
      });
      return res.json({success:true,item});
    } catch(e){return fail(res,e);}
  },
  async discard(req,res) {
    try {
      await db.$transaction(async tx=>{
        await lockRules(tx);
        const draft=await tx.driverRulesVersion.findFirst({where:{publishedAt:null}});
        if(!draft || draft.id!==req.params.id || draft.revision!==req.body?.revision) throw rulesError('Bản nháp đã thay đổi hoặc không còn tồn tại. Vui lòng tải lại.');
        await tx.driverRulesVersion.delete({where:{id:draft.id}});
      });
      return res.json({success:true});
    } catch(e){return fail(res,e);}
  },
  async publish(req,res) {
    try {
      const item=await db.$transaction(async tx=>{
        await lockRules(tx);
        const row=await tx.driverRulesVersion.findUnique({where:{id:req.params.id}});
        const active=await currentRules(tx);
        assertRulesPublish(row,active,req.body);
        return tx.driverRulesVersion.update({where:{id:row.id},data:{publishedAt:new Date(),publishedBy:actor(req)}});
      });
      return res.json({success:true,item});
    } catch(e){return fail(res,e);}
  },
  async evidence(req,res) {
    try {
      const version=await db.driverRulesVersion.findUnique({where:{id:req.params.id}});
      if(!version?.publishedAt) throw rulesError('Không tìm thấy bản đã phát hành.',404);
      const pending=req.query.pending==='true';
      const page=Math.min(100000,Math.max(1,parseInt(req.query.page)||1));
      const filter={rulesAcceptances:{[pending?'none':'some']:{versionId:version.id}}};
      const [total,accepted,count,profiles]=await Promise.all([
        db.driverProfile.count(),db.driverRulesAcceptance.count({where:{versionId:version.id}}),db.driverProfile.count({where:filter}),
        db.driverProfile.findMany({where:filter,orderBy:{id:'asc'},skip:(page-1)*50,take:50,select:{id:true,fullName:true,status:true,rulesAcceptances:{where:{versionId:version.id},select:{acceptedAt:true,contentHash:true,confirmation:true}}}})
      ]);
      return res.json({success:true,version:metadata(version),content:version.content,total,accepted,pending:total-accepted,count,page,items:profiles.map(p=>({id:p.id,fullName:p.fullName,status:p.status,acceptance:receipt(p.rulesAcceptances[0]?{...p.rulesAcceptances[0],versionId:version.id}:null)}))});
    } catch(e){return fail(res,e);}
  },
  async driverStatus(req,res) {
    try {
      const profile=await profileFor(db,req);
      const active=await db.driverRulesVersion.findFirst({where:{publishedAt:{not:null}},orderBy:[{publishedAt:'desc'},{version:'desc'}],select:{id:true,version:true,revision:true,contentHash:true,changeSummary:true,publishedAt:true,publishedBy:true,createdAt:true}});
      const accepted=active?await db.driverRulesAcceptance.findUnique({where:{driverProfileId_versionId:{driverProfileId:profile.id,versionId:active.id}}}):null;
      res.setHeader('Cache-Control','no-store');
      return res.json({success:true,driverProfileId:profile.id,release:metadata(active),needsAcceptance:!!active&&!accepted,acceptance:receipt(accepted)});
    } catch(e){return fail(res,e);}
  },
  async driverCurrent(req,res) {
    try {
      const profile=await profileFor(db,req);
      // One snapshot prevents the content and its receipt being read across a publication.
      const result=await db.$transaction(async tx=>{
        await lockRules(tx);
        const active=await currentRules(tx);
        if(!active) return {content:rulesTemplate,release:null,needsAcceptance:false,acceptance:null,changedGroupIds:[],changedSectionIds:[]};
        const accepted=await tx.driverRulesAcceptance.findUnique({where:{driverProfileId_versionId:{driverProfileId:profile.id,versionId:active.id}}});
        const previous=accepted?null:await tx.driverRulesAcceptance.findFirst({where:{driverProfileId:profile.id},orderBy:{acceptedAt:'desc'},include:{version:{select:{content:true}}}});
        return {content:active.content,release:metadata(active),needsAcceptance:!accepted,acceptance:receipt(accepted),...(accepted?{changedGroupIds:[],changedSectionIds:[]}:rulesChanges(active.content,previous?.version.content))};
      });
      res.setHeader('Cache-Control','no-store');
      return res.json({success:true,driverProfileId:profile.id,...result});
    } catch(e){return fail(res,e);}
  },
  async accept(req,res) {
    try {
      const profile=await profileFor(db,req);
      const item=await db.$transaction(async tx=>{
        await lockRules(tx);
        const active=await currentRules(tx);
        assertRulesAcceptance(active,req.body);
        const key={driverProfileId:profile.id,versionId:active.id};
        const found=await tx.driverRulesAcceptance.findUnique({where:{driverProfileId_versionId:key}});
        if(found)return found;
        return tx.driverRulesAcceptance.create({data:{...key,contentHash:active.contentHash,confirmation:active.content.confirmation}});
      });
      return res.json({success:true,acceptance:receipt(item)});
    } catch(e){return fail(res,e);}
  }
};}
