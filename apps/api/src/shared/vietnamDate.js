// Display-only helpers. Keep ISO calendar keys unchanged in API payloads and calculations.
const OFFSET=7*60*60*1000;
const calendar=/^(\d{4})-(\d{2})-(\d{2})$/;
function validCalendar(value){const m=calendar.exec(value);if(!m)return false;const d=new Date(value+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;}
function instant(value){if(value===null||value===undefined||value==='')return NaN;let v=value;if(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(v))v+='+07:00';return new Date(v).getTime();}
export function formatVietnamDate(value){
 const s=typeof value==='string'?value:'';
 if(calendar.test(s))return validCalendar(s)?s.slice(8,10)+'/'+s.slice(5,7)+'/'+s.slice(0,4):'—';
 const t=instant(value);if(!Number.isFinite(t))return '—';const day=new Date(t+OFFSET).toISOString().slice(0,10);return day.slice(8,10)+'/'+day.slice(5,7)+'/'+day.slice(0,4);
}
export function formatVietnamDateTime(value){const t=instant(value);if(!Number.isFinite(t))return '—';return formatVietnamDate(t)+' '+new Date(t+OFFSET).toISOString().slice(11,16);}
