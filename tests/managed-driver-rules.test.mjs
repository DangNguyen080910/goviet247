import test from 'node:test';
import assert from 'node:assert/strict';
import { rulesTemplate, rulesContentSchema, rulesHash, rulesChanges, assertRulesAcceptance, assertRulesPublish } from '../apps/api/src/services/driverRules.js';
import { makeDriverRulesController } from '../apps/api/src/controllers/driverRulesController.js';
import { mergeDriverRulesStatus } from '../apps/api/src/shared/driverRulesState.js';
const content=structuredClone(rulesTemplate);
const active={id:'release-1',version:1,revision:1,content,contentHash:rulesHash(content),baseVersionId:null,publishedAt:new Date('2026-11-21T10:00:00Z')};
const draft={...active,id:'draft-2',version:2,publishedAt:null,baseVersionId:active.id};
async function call(db,method,params={}) {
  let status=200,payload;
  await makeDriverRulesController(db)[method]({user:{uid:'driver-a'},admin:{username:'admin'},body:{},query:{},params:{},...params},{setHeader(){},status(v){status=v;return this;},json(v){payload=v;return v;}});
  return {status,...payload};
}
const locked=inner=>({...inner,$transaction:async work=>work({...inner,$queryRaw:async()=>[]})});
test('seed contains all four categories, revised 15-minute rules and no login/contract troubleshooting section',()=>{
  assert.deepEqual(content.groups.map(g=>g.id),['GUIDES','OPERATION','BEHAVIOR','TERMS']);
  assert.equal(content.groups.flatMap(g=>g.sections).length,37);
  const text=JSON.stringify(content);
  assert(text.includes('giữ trạng thái đăng nhập'));assert(text.includes('Admin buộc phải huỷ chuyến và ghi nhận phạt'));
  assert(!text.includes('7. Cần đăng nhập lại hoặc xác nhận hợp đồng'));
  assert(text.includes('7. Khi nào cần liên hệ Support?'));
});
test('draft content rejects blank paragraphs, duplicate IDs and HTML-like extra fields',()=>{
  for(const change of [v=>{v.groups[0].sections[0].paragraphs=[''];},v=>{v.groups.push(v.groups[0]);},v=>{v.groups[0].sections.push(v.groups[0].sections[0]);}]) {
    const c=structuredClone(content);change(c);assert.equal(rulesContentSchema.safeParse(c).success,false);
  }
  assert.equal(rulesContentSchema.parse({...content,unsafeMarkup:'ignored'}).unsafeMarkup,undefined);
});
test('canonical content hash detects changes and ignores request key order/whitespace normalization',()=>{
  assert.equal(rulesHash({...content,title:' '+content.title+' '}),rulesHash(content));
  const next=structuredClone(content);next.groups[0].sections[0].paragraphs.push('Additional rule.');assert.notEqual(rulesHash(next),rulesHash(content));
});
test('publishing requires latest saved draft, reviewed flag, matching base and changed content',()=>{
  const changed=structuredClone(content);changed.groups[0].sections[0].title='Changed title';
  const d={...draft,content:changed,contentHash:rulesHash(changed)};
  const good={revision:d.revision,contentHash:d.contentHash,reviewed:true};
  assert.doesNotThrow(()=>assertRulesPublish(d,active,good));
  for(const [row,body] of [[{...d,publishedAt:new Date()},good],[d,{...good,reviewed:false}],[d,{...good,revision:99}],[d,{...good,contentHash:'old'}],[{...d,baseVersionId:'other'},good],[draft,{...good,contentHash:draft.contentHash}]])assert.throws(()=>assertRulesPublish(row,active,body));
});
test('old or incomplete acknowledgements are rejected before any write',()=>{
  const good={versionId:active.id,contentHash:active.contentHash,confirmed:true};
  assert.doesNotThrow(()=>assertRulesAcceptance(active,good));
  for(const value of [{...good,versionId:'old'},{...good,contentHash:'old'},{...good,confirmed:false},{}])assert.throws(()=>assertRulesAcceptance(active,value));
});
test('change badges compare additions, removals and skipped changes to last accepted content',()=>{
  const next=structuredClone(content);next.groups[0].sections.shift();next.groups[1].sections[0].paragraphs.push('Changed');next.groups[1].sections.push({id:'added',title:'Added',summary:'',paragraphs:['New']});
  const changes=rulesChanges(next,content);assert.deepEqual(changes.changedGroupIds,['GUIDES','OPERATION']);assert(changes.changedSectionIds.includes('OPERATION/added'));assert.equal(changes.changedSectionIds.length,2);
  assert.equal(rulesChanges(next,null).changedGroupIds.length,4);
});
test('status cannot regress when older network responses arrive after publication or acknowledgement',()=>{
  const accepted={driverProfileId:'a',release:{id:'v2',version:2},acceptance:{acceptedAt:'today'},needsAcceptance:false};
  assert.equal(mergeDriverRulesStatus(accepted,{...accepted,release:{id:'v1',version:1},acceptance:null,needsAcceptance:true}),accepted);
  assert.equal(mergeDriverRulesStatus(accepted,{...accepted,acceptance:null,needsAcceptance:true}),accepted);
  const newRelease={...accepted,release:{id:'v3',version:3},acceptance:null,needsAcceptance:true};assert.equal(mergeDriverRulesStatus(accepted,newRelease),newRelease);
  const otherDriver={...accepted,driverProfileId:'b',acceptance:null,needsAcceptance:true};assert.equal(mergeDriverRulesStatus(accepted,otherDriver),otherDriver);
});
test('acknowledgement retry returns original receipt without changing timestamp',async()=>{
  const original={id:'receipt',versionId:active.id,contentHash:active.contentHash,confirmation:content.confirmation,acceptedAt:new Date()};
  const db=locked({driverProfile:{findUnique:async()=>({id:'profile-a'})},driverRulesVersion:{findFirst:async()=>active},driverRulesAcceptance:{findUnique:async()=>original,create:async()=>{assert.fail('Duplicate acknowledgement written');}}});
  const r=await call(db,'accept',{body:{versionId:active.id,contentHash:active.contentHash,confirmed:true}});
  assert.equal(r.status,200);assert.equal(r.acceptance.acceptedAt,original.acceptedAt);
});
test('publication while reading causes stale acceptance to fail without creating a receipt',async()=>{
  const latest={...active,id:'release-2'};
  const db=locked({driverProfile:{findUnique:async()=>({id:'profile-a'})},driverRulesVersion:{findFirst:async()=>latest},driverRulesAcceptance:{create:async()=>assert.fail('Stale receipt written')}});
  const r=await call(db,'accept',{body:{versionId:active.id,contentHash:active.contentHash,confirmed:true}});
  assert.equal(r.status,409);
});
test('fresh receipt belongs to authenticated driver and uses server content/confirmation',async()=>{
  let stored;
  const db=locked({driverProfile:{findUnique:async q=>{assert.equal(q.where.userId,'driver-a');return{id:'profile-a'};}},driverRulesVersion:{findFirst:async()=>active},driverRulesAcceptance:{findUnique:async()=>null,create:async({data})=>{stored=data;return{...data,acceptedAt:new Date()};}}});
  const r=await call(db,'accept',{body:{versionId:active.id,contentHash:active.contentHash,confirmed:true,driverProfileId:'victim',confirmation:'forged'}});
  assert.equal(r.status,200);assert.equal(stored.driverProfileId,'profile-a');assert.equal(stored.confirmation,content.confirmation);
});
test('stale saves, including a discarded/replaced draft with the same revision, cannot overwrite draft',async()=>{
  let updated=false;
  const db=locked({driverRulesVersion:{findFirst:async({where})=>where.publishedAt===null?draft:active,update:async()=>{updated=true;}}});
  for(const extra of [{expectedRevision:99,expectedDraftId:draft.id},{expectedRevision:draft.revision,expectedDraftId:'discarded-draft'}]) {
    const r=await call(db,'save',{body:{content,changeSummary:'Edited',...extra}});assert.equal(r.status,409);
  }
  assert.equal(updated,false);
});
test('published content cannot be discarded through draft deletion route',async()=>{
  let deleted=false;
  const db=locked({driverRulesVersion:{findFirst:async()=>draft,delete:async()=>{deleted=true;}}});
  const r=await call(db,'discard',{params:{id:active.id},body:{revision:active.revision}});assert.equal(r.status,409);assert.equal(deleted,false);
});
test('new driver sees all published sections; accepted driver sees no changed markers',async()=>{
  for(const accepted of [null,{versionId:active.id,contentHash:active.contentHash,acceptedAt:new Date(),confirmation:content.confirmation}]) {
    const db=locked({driverProfile:{findUnique:async()=>({id:'profile-a'})},driverRulesVersion:{findFirst:async()=>active},driverRulesAcceptance:{findUnique:async()=>accepted,findFirst:async()=>null}});
    const r=await call(db,'driverCurrent');assert.equal(r.status,200);assert.equal(r.needsAcceptance,!accepted);assert.equal(r.changedGroupIds.length,accepted?0:4);
  }
});

test('a new draft cannot unknowingly replace a version published since the editor loaded',async()=>{
  let created=false;
  const db=locked({driverRulesVersion:{findFirst:async({where})=>where.publishedAt===null?null:active,create:async()=>{created=true;}}});
  const r=await call(db,'save',{body:{content,changeSummary:'From an old editor',expectedRevision:null,expectedDraftId:null,expectedBaseVersionId:null}});
  assert.equal(r.status,409);assert.equal(created,false);
});
