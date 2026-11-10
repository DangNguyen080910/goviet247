import {getAdminToken} from '../utils/adminAuth';
const base=(import.meta.env.VITE_API_BASE||'http://localhost:5050')+'/api/admin/contracts';
export async function contractRequest(path='',method='GET',body){const res=await fetch(base+path,{method,headers:{Authorization:`Bearer ${getAdminToken()}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const data=await res.json();if(!res.ok||!data.success)throw Error(data.message||'Không tải được hợp đồng.');return data;}
