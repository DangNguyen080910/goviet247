const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const root=path.resolve(__dirname,'..');
function api(){const calls=[],exports={};
 const source=fs.readFileSync(path.join(root,'apps/admin-mobile/services/quoteHistoryApi.ts'),'utf8');
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText,
  {exports,URLSearchParams,require:()=>({adminRequest:async(...args)=>{calls.push(args);return {success:true,enabled:false,items:[],stats:{total:0},totalPages:0};}})});
 return {methods:exports,calls};
}
test('mobile quote history sends the same date/search/source/car filters and page as Web',async()=>{
 const {methods,calls}=api();
 const result=await methods.fetchQuoteHistory({from:'2026-11-22',to:'2026-11-22',q:'Nguyễn & 090',source:'IOS',carType:'CAR_7'},2);
 const url=new URL(calls[0][0],'https://api.invalid');
 assert.equal(url.pathname,'/api/admin/quote-history');
 assert.deepEqual(Object.fromEntries(url.searchParams),{page:'2',from:'2026-11-22',to:'2026-11-22',q:'Nguyễn & 090',source:'IOS',carType:'CAR_7'});
 assert.equal(calls[0][1].cache,'no-store');assert.equal(result.stats.total,0);
});
test('empty filters are omitted, and recording settings use the existing shared admin endpoints',async()=>{
 const {methods,calls}=api();await methods.fetchQuoteHistory({from:'2026-11-22',to:'2026-11-22',q:'',source:'',carType:''});
 assert.equal(new URL(calls[0][0],'https://api.invalid').searchParams.has('q'),false);
 await methods.fetchQuoteHistorySettings();assert.equal(calls[1][0],'/api/admin/quote-history/settings');
 await methods.setQuoteHistoryEnabled(false);assert.equal(calls[2][1].method,'PATCH');assert.deepEqual(JSON.parse(calls[2][1].body),{enabled:false});
});
