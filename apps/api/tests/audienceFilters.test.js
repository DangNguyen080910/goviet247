import test from 'node:test';
import assert from 'node:assert/strict';
import {audienceFilterIds,matchesAudienceFilters} from '../src/shared/audienceFilters.js';
const drivers=[
  {userId:'5g',carType:'CAR_5',vehicleFuelType:'GASOLINE'},
  {userId:'5e',carType:'CAR_5',vehicleFuelType:'ELECTRIC'},
  {userId:'7g',carType:'CAR_7',vehicleFuelType:'GASOLINE'},
  {userId:'7e',carType:'CAR_7',vehicleFuelType:'ELECTRIC'},
  {userId:'7unknown',carType:'CAR_7',vehicleFuelType:null},
];
test('seat and fuel filters intersect rather than replace one another',()=>{
  assert.deepEqual(audienceFilterIds(drivers,'CAR_5','GASOLINE'),['5g']);
  assert.deepEqual(audienceFilterIds(drivers,'CAR_7','GASOLINE'),['7g']);
  assert.deepEqual(audienceFilterIds(drivers,'CAR_7','ELECTRIC'),['7e']);
});
test('single filters still work, and clearing filters returns to manual selection',()=>{
  assert.deepEqual(audienceFilterIds(drivers,'','GASOLINE'),['5g','7g']);
  assert.deepEqual(audienceFilterIds(drivers,'CAR_7',''),['7g','7e','7unknown']);
  assert.deepEqual(audienceFilterIds(drivers,'',''),[]);
  assert.equal(drivers.filter(d=>matchesAudienceFilters(d,'CAR_7','GASOLINE')).length,1);
  assert.deepEqual(audienceFilterIds(drivers,'CAR_16','GASOLINE'),[]);
});
