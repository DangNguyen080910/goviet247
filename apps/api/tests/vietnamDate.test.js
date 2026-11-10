import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {formatVietnamDate,formatVietnamDateTime} from '../src/shared/vietnamDate.js';
import {destinationSummary} from '../src/shared/destinationService.js';
for(const zone of ['UTC','Asia/Ho_Chi_Minh','America/Los_Angeles','Asia/Tokyo'])test('Vietnam display independent of device timezone '+zone,()=>{const old=process.env.TZ;process.env.TZ=zone;try{
 assert.equal(formatVietnamDate('2026-11-11'),'11/11/2026');
 assert.equal(formatVietnamDate('2026-12-31T18:00:00Z'),'01/01/2027');
 assert.equal(formatVietnamDateTime('2026-11-10T23:15:00Z'),'11/11/2026 06:15');
 assert.equal(formatVietnamDateTime('2026-11-11T00:30'),'11/11/2026 00:30');
 assert.equal(formatVietnamDate('2024-02-29'),'29/02/2024');
 for(const value of ['2026-02-29','2026-13-01','bad','',null,undefined])assert.equal(formatVietnamDate(value),'—');
 }finally{if(old===undefined)delete process.env.TZ;else process.env.TZ=old;}});
test('destination labels are local while snapshot ISO keys remain unchanged',()=>{const s={fee:600000,dailyFee:600000,version:3,eligible:true,title:'T',anchorAddress:'A',standardName:'Tiêu chuẩn',charterName:'Bao xe',standardDescription:'S',charterDescription:'C',standardWindow:'07:00–21:00',sessions:[{date:'2026-11-11',start:'2026-11-11T00:00:00Z',end:'2026-11-11T14:00:00Z',hours:8,fee:600000}],days:[],outsideNotice:'N'};const before=JSON.stringify(s);assert(destinationSummary(s).some(x=>x.startsWith('11/11/2026:')));assert.equal(JSON.stringify(s),before);});
test('native rider date picker uses VN instants and timezone rather than device getters',()=>{const s=readFileSync(new URL('../../rider-mobile/app/booking.tsx',import.meta.url),'utf8');assert.match(s,/timeZoneName="Asia\/Ho_Chi_Minh"/);const helper=s.slice(s.indexOf('function toDatetimeLocalInputValue'),s.indexOf('function formatDateOnlyDisplay'));assert.doesNotMatch(helper,/getFullYear|getMonth|getDate|getHours/);assert.match(s,/new Date\(bookingTimeToIso\(rawValue/);});
