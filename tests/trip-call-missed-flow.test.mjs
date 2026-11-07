import test from 'node:test';
import assert from 'node:assert/strict';
import {ringingEndStatus} from '../apps/api/src/services/tripCallService.js';
test('unanswered calls are missed when caller hangs up or ringing expires; explicit rejection stays rejection',()=>{
 const call={createdAt:new Date(1000)};
 assert.equal(ringingEndStatus(call,'caller',2000),'MISSED');
 assert.equal(ringingEndStatus(call,'callee',45999),'REJECTED');
 assert.equal(ringingEndStatus(call,'callee',46000),'MISSED');
});
