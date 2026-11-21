import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { makeDriverRulesController } from '../apps/api/src/controllers/driverRulesController.js';
import { rulesTemplate, rulesHash, rulesChanges } from '../apps/api/src/services/driverRules.js';
const url=process.env.DRIVER_RULES_TEST_DATABASE_URL;
const clientPath=process.env.DRIVER_RULES_TEST_CLIENT;
const enabled=!!url&&!!clientPath;
if(enabled && (new URL(url).hostname!=='127.0.0.1'||new URL(url).pathname!=='/rules_test'))throw Error('This integration test requires a disposable local rules_test database.');
test('managed driver rules: real PostgreSQL publication and acknowledgements',{skip:!enabled},async t=>{
  const {PrismaClient}=createRequire(import.meta.url)(clientPath);
  const db=new PrismaClient({datasources:{db:{url}}});
  const c=makeDriverRulesController(db);
  async function call(method,{uid,body={},params={},query={}}={}) {
    let status=200,result;
    const res={setHeader(){},status(v){status=v;return this;},json(v){result=v;return v;}};
    await c[method]({user:{uid},admin:{username:'test-admin'},body,params,query},res);
    return {status,...result};
  }
  try {
    const a=await db.user.create({data:{primaryRole:'DRIVER',driverProfile:{create:{fullName:'Driver A',status:'VERIFIED'}}},include:{driverProfile:true}});
    const b=await db.user.create({data:{primaryRole:'DRIVER',driverProfile:{create:{fullName:'Driver B',status:'VERIFIED'}}},include:{driverProfile:true}});
    let draft,first,second,firstReceipt;
    await t.test('before first publication the template is readable without inventing consent',async()=>{
      const r=await call('driverCurrent',{uid:a.id});assert.equal(r.status,200);assert.equal(r.release,null);assert.equal(r.needsAcceptance,false);assert.deepEqual(r.content,rulesTemplate);
    });
    await t.test('rejects missing driver identity',async()=>{assert.equal((await call('driverCurrent',{uid:'unknown'})).status,403);});
    await t.test('validates duplicate section IDs before persisting',async()=>{
      const content=structuredClone(rulesTemplate);content.groups[0].sections.push(content.groups[0].sections[0]);
      assert.equal((await call('save',{body:{content,changeSummary:'Bad draft'}})).status,400);assert.equal(await db.driverRulesVersion.count(),0);
    });
    await t.test('saving draft does not notify drivers; concurrent draft saves are rejected',async()=>{
      const r=await call('save',{body:{content:rulesTemplate,changeSummary:'Initial publication'}});assert.equal(r.status,200);draft=r.item;
      assert.equal((await call('driverStatus',{uid:a.id})).needsAcceptance,false);
      assert.equal((await call('save',{body:{content:rulesTemplate,changeSummary:'Stale edit',expectedRevision:null}})).status,409);
    });
    await t.test('requires reviewed and matching draft revision/hash',async()=>{
      for(const body of [{reviewed:false,revision:draft.revision,contentHash:draft.contentHash},{reviewed:true,revision:99,contentHash:draft.contentHash},{reviewed:true,revision:draft.revision,contentHash:'bad'}])assert.notEqual((await call('publish',{params:{id:draft.id},body})).status,200);
    });
    await t.test('publishes and marks all initial sections for reading',async()=>{
      const r=await call('publish',{params:{id:draft.id},body:{reviewed:true,revision:draft.revision,contentHash:draft.contentHash}});assert.equal(r.status,200);first=r.item;
      const d=await call('driverCurrent',{uid:a.id});assert.equal(d.needsAcceptance,true);assert.equal(d.changedSectionIds.length,rulesTemplate.groups.reduce((n,g)=>n+g.sections.length,0));
    });
    await t.test('requires explicit acknowledgement of the exact published content',async()=>{
      assert.equal((await call('accept',{uid:a.id,body:{versionId:first.id,contentHash:first.contentHash,confirmed:false}})).status,400);
      assert.equal((await call('accept',{uid:a.id,body:{versionId:first.id,contentHash:'bad',confirmed:true}})).status,409);
      assert.equal(await db.driverRulesAcceptance.count(),0);
    });
    await t.test('acknowledgement is idempotent, timestamp is preserved and another driver stays pending',async()=>{
      const body={versionId:first.id,contentHash:first.contentHash,confirmed:true};
      const results=await Promise.all([call('accept',{uid:a.id,body}),call('accept',{uid:a.id,body})]);
      assert(results.every(r=>r.status===200));assert.equal(await db.driverRulesAcceptance.count(),1);firstReceipt=results[0].acceptance;
      assert.deepEqual(results[1].acceptance,firstReceipt);assert.equal((await call('driverStatus',{uid:a.id})).needsAcceptance,false);assert.equal((await call('driverStatus',{uid:b.id})).needsAcceptance,true);
    });
    await t.test('published versions cannot be edited, discarded or published twice',async()=>{
      assert.equal((await call('discard',{params:{id:first.id},body:{revision:first.revision}})).status,409);
      assert.equal((await call('publish',{params:{id:first.id},body:{reviewed:true,revision:first.revision,contentHash:first.contentHash}})).status,409);
      assert.deepEqual((await db.driverRulesVersion.findUnique({where:{id:first.id}})).content,rulesTemplate);
    });
    await t.test('create/edit/delete/reorder rules remains a draft until published',async()=>{
      const content=structuredClone(rulesTemplate),g=content.groups[0];
      g.sections[0].paragraphs.push('A changed policy for testing.');g.sections.splice(1,1);g.sections.reverse();g.sections.push({id:'new-section',title:'New rule',summary:'',paragraphs:['New content.']});
      let r=await call('save',{body:{content,changeSummary:'Add, edit, delete and reorder',expectedBaseVersionId:first.id}});assert.equal(r.status,200);draft=r.item;
      assert.equal((await call('driverStatus',{uid:a.id})).needsAcceptance,false);
      const revisions=await Promise.all([call('save',{body:{content,changeSummary:'Edit A',expectedRevision:draft.revision,expectedDraftId:draft.id,expectedBaseVersionId:first.id}}),call('save',{body:{content,changeSummary:'Edit B',expectedRevision:draft.revision,expectedDraftId:draft.id,expectedBaseVersionId:first.id}})]);
      assert.deepEqual(revisions.map(x=>x.status).sort(),[200,409]);draft=revisions.find(x=>x.status===200).item;
      const pub=await call('publish',{params:{id:draft.id},body:{reviewed:true,revision:draft.revision,contentHash:draft.contentHash}});assert.equal(pub.status,200);second=pub.item;
    });
    await t.test('new release reopens badge and highlights changes against last accepted version',async()=>{
      const d=await call('driverCurrent',{uid:a.id});assert.equal(d.needsAcceptance,true);assert.equal(d.release.id,second.id);assert.equal(d.acceptance,null);
      assert(d.changedSectionIds.includes('GUIDES/new-section'));assert(d.changedSectionIds.includes('GUIDES/accept-troubleshooting'));assert(d.changedGroupIds.includes('GUIDES'));assert(!d.changedGroupIds.includes('OPERATION'));
      assert.deepEqual((await db.driverRulesVersion.findUnique({where:{id:first.id}})).content,rulesTemplate);
    });
    await t.test('a driver cannot acknowledge an old screen across a publication',async()=>{
      const r=await call('accept',{uid:b.id,body:{versionId:first.id,contentHash:first.contentHash,confirmed:true}});assert.equal(r.status,409);
      assert.equal(await db.driverRulesAcceptance.count({where:{driverProfileId:b.driverProfile.id}}),0);
    });
    await t.test('admin sees pending/accepted drivers and historical immutable evidence',async()=>{
      const old=await call('evidence',{params:{id:first.id}});assert.equal(old.accepted,1);assert.equal(old.pending,1);assert.equal(old.items[0].id,a.driverProfile.id);assert.deepEqual(old.content,rulesTemplate);assert.equal(old.items[0].acceptance.acceptedAt.getTime(),firstReceipt.acceptedAt.getTime());
      const pending=await call('evidence',{params:{id:second.id},query:{pending:'true'}});assert.equal(pending.count,2);assert.equal(pending.items.length,2);
    });
    await t.test('accepting current version clears only current pending state and preserves history',async()=>{
      assert.equal((await call('accept',{uid:a.id,body:{versionId:second.id,contentHash:second.contentHash,confirmed:true}})).status,200);
      assert.equal(await db.driverRulesAcceptance.count({where:{driverProfileId:a.driverProfile.id}}),2);
      const d=await call('driverCurrent',{uid:a.id});assert.equal(d.needsAcceptance,false);assert.deepEqual(d.changedSectionIds,[]);
      const old=await db.driverRulesAcceptance.findUnique({where:{driverProfileId_versionId:{driverProfileId:a.driverProfile.id,versionId:first.id}}});assert.equal(old.acceptedAt.getTime(),firstReceipt.acceptedAt.getTime());
    });
    await t.test('unchanged content cannot generate another reconsent release; draft can be discarded',async()=>{
      const r=await call('save',{body:{content:second.content,changeSummary:'No change',expectedBaseVersionId:second.id}});assert.equal(r.status,200);
      assert.equal((await call('publish',{params:{id:r.item.id},body:{reviewed:true,revision:r.item.revision,contentHash:r.item.contentHash}})).status,400);
      assert.equal((await call('discard',{params:{id:r.item.id},body:{revision:r.item.revision}})).status,200);
      assert.equal((await call('driverCurrent',{uid:a.id})).release.id,second.id);
    });
    await t.test('database prevents a second draft even outside controller',async()=>{
      const data={content:rulesTemplate,contentHash:rulesHash(rulesTemplate),changeSummary:'Constraint',createdBy:'test'};
      await db.driverRulesVersion.create({data});await assert.rejects(db.driverRulesVersion.create({data}),e=>e.code==='P2002');
    });
  }finally{await db.$disconnect();}
});
test('deletions, skipped releases and renames are compared to the driver’s actual accepted content',()=>{
  const old=structuredClone(rulesTemplate),next=structuredClone(old);next.groups[0].sections.splice(0,1);
  const diff=rulesChanges(next,old);assert(diff.changedGroupIds.includes('GUIDES'));assert(!diff.changedSectionIds.includes('GUIDES/accept-troubleshooting'));
  const first=rulesChanges(next,null);assert.equal(first.changedGroupIds.length,next.groups.length);
});
