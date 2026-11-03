import test from 'node:test';
import assert from 'node:assert/strict';
import {loginGoVietAdmin} from '../apps/web-partners/src/adminLogin.js';
test('portal Admin login reuses existing Admin endpoint without a company code or Partner refresh credentials',async t=>{
 let request;
 t.mock.method(globalThis,'fetch',async(url,options)=>{request={url,options};return {ok:true,json:async()=>({success:true,token:'admin-token',user:{id:1,role:'ADMIN',username:'owner'}})};});
 const result=await loginGoVietAdmin('https://api.example','owner','private-test-password');
 assert.equal(result.user.role,'ADMIN');assert.equal(request.url,'https://api.example/api/admin/auth/login');
 assert.deepEqual(JSON.parse(request.options.body),{username:'owner',password:'private-test-password'});assert.equal(request.options.credentials,'omit');
});
test('portal rejects Staff accounts before accepting a session',async t=>{
 t.mock.method(globalThis,'fetch',async()=>({ok:true,json:async()=>({success:true,token:'staff-token',user:{role:'STAFF'}})}));
 await assert.rejects(loginGoVietAdmin('https://api.example','staff','secret'),/Chỉ tài khoản Admin/);
});
test('failed credentials and malformed login responses cannot create an Admin session',async t=>{
 const mocked=t.mock.method(globalThis,'fetch',async()=>({ok:false,json:async()=>({success:false})}));
 await assert.rejects(loginGoVietAdmin('https://api.example','owner','wrong'),/Không đăng nhập được/);
 mocked.mock.mockImplementation(async()=>({ok:true,json:async()=>({success:true})}));
 await assert.rejects(loginGoVietAdmin('https://api.example','owner','wrong'),/Không đăng nhập được/);
});
