import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

// Exercise ESM dependency evaluation with the real map module and a fake network.
// No DB, environment file containing real credentials, or external map service is used.
function runBootstrap(order) {
 const folder=mkdtempSync(join(tmpdir(),'goviet247-env-bootstrap-'));
 try {
  const mapSource=readFileSync(new URL('../src/services/mapService.js',import.meta.url),'utf8');
  assert.ok(mapSource.includes('import axios from "axios";'));
  writeFileSync(join(folder,'maps.mjs'),mapSource.replace('import axios from "axios";',
   `const axios={get:async()=>({data:{predictions:[{place_id:'offline',description:'Offline address'}]}})};`));
  writeFileSync(join(folder,'environment.mjs'),`process.env.GOONG_API_KEY='offline-placeholder';process.env.MAP_PROVIDER='goong';`);
  writeFileSync(join(folder,'booking-quotes.mjs'),`import './maps.mjs';`);
  writeFileSync(join(folder,'entry.mjs'),order.map(name=>`import './${name}.mjs';`).join('\n')+
   `\nimport {autocomplete} from './maps.mjs';\ntry{const items=await autocomplete('Saigon');console.log(JSON.stringify({ok:true,count:items.length}));}catch(error){console.log(JSON.stringify({ok:false,message:error.message}));process.exitCode=1;}`);
  const env={...process.env};
  for(const key of ['GOONG_API_KEY','VIETMAP_API_KEY','VIETMAP_SERVICE_KEY','MAP_PROVIDER'])delete env[key];
  const result=spawnSync(process.execPath,[join(folder,'entry.mjs')],{cwd:folder,env,encoding:'utf8'});
  if(result.error)throw result.error;
  return {code:result.status,...JSON.parse(result.stdout.trim())};
 } finally {rmSync(folder,{recursive:true,force:true});}
}
test('reproduces missing map credentials when quote dependency evaluates before environment loader',()=>{
 assert.deepEqual(runBootstrap(['booking-quotes','environment']),{code:1,ok:false,message:'GOONG_API_KEY_MISSING'});
});
test('API entrypoint initializes environment before its new quote/map dependency',()=>{
 const server=readFileSync(new URL('../src/server.js',import.meta.url),'utf8');
 const relevant=[...server.matchAll(/^import\s+(?:[^;\n]+?\s+from\s+)?["']([^"']+)["'];/gm)]
  .map(match=>match[1]).filter(name=>name==='dotenv/config'||name==='./services/bookingQuotes.js')
  .map(name=>name==='dotenv/config'?'environment':'booking-quotes');
 assert.equal(relevant.length,2);
 assert.deepEqual(runBootstrap(relevant),{code:0,ok:true,count:1});
});
