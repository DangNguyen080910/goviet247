import {adminRequest} from './adminRequest';
export type QuoteFilters = {from:string;to:string;q:string;source:string;carType:string};
export function fetchQuoteHistory(filters:QuoteFilters,page=1) {
  const query=new URLSearchParams({page:String(page)});
  Object.entries(filters).forEach(([key,value])=>{if(value)query.set(key,value);});
  return adminRequest(`/api/admin/quote-history?${query}`,{cache:'no-store'});
}
export function fetchQuoteHistorySettings(){return adminRequest('/api/admin/quote-history/settings',{cache:'no-store'});}
export function setQuoteHistoryEnabled(enabled:boolean){return adminRequest('/api/admin/quote-history/settings',{method:'PATCH',body:JSON.stringify({enabled})});}
