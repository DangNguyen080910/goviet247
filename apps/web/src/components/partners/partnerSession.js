export const partnerTokenKey='gv247_partner_token';
let enabled=false, generation=0, pending=null;
export function enablePartnerSessionRefresh(){enabled=true;}
export function notifyPartnerStorageChange(){generation++;}
export function storePartnerToken(token){generation++;localStorage.setItem(partnerTokenKey,token);window.dispatchEvent(new Event('partner-session-changed'));}
export function clearPartnerToken(){generation++;localStorage.removeItem(partnerTokenKey);window.dispatchEvent(new Event('partner-session-changed'));}
function claims(token){try{return JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));}catch{return {};}}
export async function refreshPartnerToken(base) {
  if(pending)return pending;
  const revision=generation;
  const task=(async()=>{
    const res=await fetch(`${base}/api/partners/refresh`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json','X-Session-Mode':'partner-refresh'}});
    const data=await res.json();
    if(revision!==generation){const latest=localStorage.getItem(partnerTokenKey);if(latest)return latest;throw Object.assign(new Error('Phiên đã kết thúc.'),{status:401});}
    if(!res.ok || !data.success){if(res.status===401)clearPartnerToken();throw Object.assign(new Error(data.message || 'Chưa làm mới được phiên. Vui lòng thử lại.'),{status:res.status});}
    localStorage.setItem(partnerTokenKey,data.token);window.dispatchEvent(new Event('partner-session-changed'));
    return data.token;
  })();
  pending=task;
  try{return await task;}finally{if(pending===task)pending=null;}
}
export async function partnerFetch(base,url,options={}) {
  if(!enabled)return fetch(url,options);
  let token=localStorage.getItem(partnerTokenKey);
  if(!token)throw Object.assign(new Error('Vui lòng đăng nhập lại.'),{status:401});
  const session=claims(token),now=Date.now()/1000;
  if(session.rememberUntil && session.exp<=now+300 && (session.exp<session.rememberUntil || session.exp<=now))token=await refreshPartnerToken(base);
  const send=t=>fetch(url,{...options,headers:{...options.headers,Authorization:`Bearer ${t}`}});
  let res=await send(token);
  if(res.status===401 && claims(token).rememberUntil){
    const latest=localStorage.getItem(partnerTokenKey);
    token=latest && latest!==token ? latest : await refreshPartnerToken(base);
    res=await send(token);
  }
  return res;
}
