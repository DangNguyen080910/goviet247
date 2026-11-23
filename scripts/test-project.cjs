// Unit/HTTP-mock suite only. Explicitly isolate it from live DB and AWS credentials.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
function walk(folder){return fs.readdirSync(folder,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(folder,entry.name)):/\.test\.(?:js|mjs|cjs)$/.test(entry.name)?[path.join(folder,entry.name)]:[]);}
const files=['tests','apps/api/tests','apps/mobile-chat/tests'].flatMap(p=>walk(path.join(root,p))).sort();
const env={...process.env,NODE_ENV:'test',DATABASE_URL:'postgresql://audit:audit@127.0.0.1:1/disposable_audit_only',
 AWS_EC2_METADATA_DISABLED:'true',AWS_S3_BUCKET:'audit-placeholder-no-network',S3_BUCKET_NAME:'audit-placeholder-no-network',
 AWS_REGION:'ap-southeast-1',AWS_ACCESS_KEY_ID:'audit-placeholder',AWS_SECRET_ACCESS_KEY:'audit-placeholder'};
for(const key of ['TEST_DATABASE_URL','DRIVER_RULES_TEST_DATABASE_URL','DRIVER_RULES_TEST_CLIENT','NOTIFICATION_TEST_DB_URL','NOTIFICATION_TEST_CLIENT','ADMIN_PUSH_RECOVERY_DB_URL'])delete env[key];
const result=spawnSync(process.execPath,['--test','--test-concurrency=3',...files],{cwd:root,env,stdio:'inherit'});
if(result.error)throw result.error;
process.exitCode=result.status ?? 1;
