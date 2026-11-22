import {AUDIENCE_REGIONS} from './audienceFilters.js';

// Use the same province catalogue as trip broadcasting. Do not count a driver's
// default/unconfirmed province as confirmed membership of a region.
export function groupDriverProvinceSummary(rows=[]) {
  const regions=AUDIENCE_REGIONS.filter(region=>region.provinceCodes.length).map(region=>({
    value:region.value,label:region.label,provinces:rows.filter(row=>region.provinceCodes.includes(row.code)),confirmed:0,unconfirmed:0,
  }));
  const unknown=rows.filter(row=>!AUDIENCE_REGIONS.some(region=>region.provinceCodes.includes(row.code)));
  if (unknown.length) regions.push({value:'UNKNOWN',label:'Chưa xác định miền',provinces:unknown,confirmed:0,unconfirmed:0});
  return regions.map(region=>({...region,confirmed:region.provinces.reduce((sum,row)=>sum+Number(row.confirmed||0),0),
    unconfirmed:region.provinces.reduce((sum,row)=>sum+Number(row.unconfirmed||0),0)}));
}
