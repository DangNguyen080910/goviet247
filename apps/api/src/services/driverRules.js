import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
const text = max => z.string().trim().min(1).max(max);
const id = text(100).regex(/^[a-zA-Z0-9_-]+$/);
export const rulesContentSchema = z.object({
  title: text(300), confirmation: text(2000),
  groups: z.array(z.object({id, title:text(300), description:z.string().trim().max(3000),
    sections:z.array(z.object({id,title:text(300),summary:z.string().trim().max(3000),paragraphs:z.array(text(12000)).min(1).max(100)})).min(1).max(100)
  })).min(1).max(10)
}).superRefine((v,ctx) => {
  if(new Set(v.groups.map(g=>g.id)).size!==v.groups.length) ctx.addIssue({code:'custom',message:'Mã nhóm bị trùng.'});
  for(const g of v.groups) if(new Set(g.sections.map(s=>s.id)).size!==g.sections.length) ctx.addIssue({code:'custom',message:'Mã mục bị trùng.'});
});
export const rulesTemplate = rulesContentSchema.parse(JSON.parse(readFileSync(new URL('../driver-rules/default.json',import.meta.url),'utf8')));
export const rulesHash = content => createHash('sha256').update(JSON.stringify(rulesContentSchema.parse(content))).digest('hex');
export const rulesError = (message,statusCode=409) => Object.assign(new Error(message),{statusCode});
export async function lockRules(tx) { await tx.$queryRaw`SELECT pg_advisory_xact_lock(247211126)::text`; }
export const currentRules = db => db.driverRulesVersion.findFirst({where:{publishedAt:{not:null}},orderBy:[{publishedAt:'desc'},{version:'desc'}]});
export function rulesChanges(content, previous) {
  const changedSectionIds=[], changedGroupIds=[];
  for(const group of content.groups) {
    const old=previous?.groups.find(g=>g.id===group.id);
    if(JSON.stringify(group)!==JSON.stringify(old)) changedGroupIds.push(group.id);
    for(const s of group.sections) if(JSON.stringify(s)!==JSON.stringify(old?.sections.find(x=>x.id===s.id))) changedSectionIds.push(`${group.id}/${s.id}`);
  }
  return {changedSectionIds,changedGroupIds};
}
export function assertRulesAcceptance(row, body) {
  if(!row || body?.versionId!==row.id || body?.contentHash!==row.contentHash) throw rulesError('Quy định vừa có phiên bản mới. Vui lòng tải lại và đọc trước khi xác nhận.');
  if(body?.confirmed!==true) throw rulesError('Vui lòng xác nhận đã đọc và đồng ý tuân thủ quy định.',400);
}
export function assertRulesPublish(row, active, body) {
  if(!row || row.publishedAt || body?.revision!==row.revision || body?.contentHash!==row.contentHash) throw rulesError('Bản nháp đã thay đổi hoặc đã phát hành. Vui lòng tải lại, lưu và xem trước.');
  if(row.baseVersionId!==(active?.id||null)) throw rulesError('Đã có phiên bản khác được phát hành. Vui lòng tải lại.');
  if(body?.reviewed!==true) throw rulesError('Cần xác nhận đã rà soát nội dung trước khi phát hành.',400);
  if(active?.contentHash===row.contentHash) throw rulesError('Nội dung không thay đổi so với bản đang áp dụng.',400);
  rulesContentSchema.parse(row.content);
}
