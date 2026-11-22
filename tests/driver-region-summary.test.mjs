import test from 'node:test';
import assert from 'node:assert/strict';
import {PROVINCES,driverProvinceSummary} from '../apps/api/src/services/driverOperatingProvince.js';
import {groupDriverProvinceSummary} from '../apps/api/src/shared/driverRegionSummary.js';
import {driverAudienceRegion} from '../apps/api/src/shared/audienceFilters.js';

test('all 34 provinces appear exactly once and match the existing trip broadcast regions',()=>{
  const rows=driverProvinceSummary(PROVINCES.map(p=>({operatingProvinceCode:p.code,operatingProvinceConfirmedAt:'2026-11-22'})));
  const groups=groupDriverProvinceSummary(rows);
  assert.deepEqual(groups.map(g=>g.label),['Miền Bắc','Miền Trung','Miền Nam']);
  assert.equal(groups.flatMap(g=>g.provinces).length,34);
  assert.equal(new Set(groups.flatMap(g=>g.provinces.map(p=>p.code))).size,34);
  for(const group of groups) for(const province of group.provinces) assert.equal(driverAudienceRegion({operatingProvinceCode:province.code,operatingProvinceConfirmedAt:'now'}),group.value);
});
test('confirmed counts exclude default/unconfirmed province profiles and preserve separate totals',()=>{
  const rows=driverProvinceSummary([{operatingProvinceCode:'01',operatingProvinceConfirmedAt:'now'},{operatingProvinceCode:'48',operatingProvinceConfirmedAt:'now'},{operatingProvinceCode:'79',operatingProvinceConfirmedAt:'now'},{operatingProvinceCode:'79'},{}, {operatingProvinceCode:'01'}]);
  const before=JSON.stringify(rows),groups=groupDriverProvinceSummary(rows);
  assert.deepEqual(groups.map(g=>g.confirmed),[1,1,1]);assert.deepEqual(groups.map(g=>g.unconfirmed),[1,0,2]);assert.equal(JSON.stringify(rows),before);
});
test('empty/loading data is safe; unknown catalogue entries are kept separate from the three regions',()=>{
  assert.deepEqual(groupDriverProvinceSummary().map(g=>g.confirmed),[0,0,0]);
  const groups=groupDriverProvinceSummary([{code:'unknown',name:'Chưa xác định',confirmed:2,unconfirmed:1}]);
  assert.equal(groups.at(-1).value,'UNKNOWN');assert.equal(groups.at(-1).confirmed,2);assert.equal(groups[2].confirmed,0);
});
