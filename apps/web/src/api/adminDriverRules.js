import { getAdminToken } from '../utils/adminAuth';
const base = `${String(import.meta.env.VITE_API_BASE || 'http://localhost:5050').replace(/\/+$/, '')}/api/admin/driver-rules`;
export async function driverRulesRequest(path='',method='GET',body) {
  const response=await fetch(base+path,{method,headers:{Authorization:`Bearer ${getAdminToken()}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data.success) throw new Error(data.message||'Không xử lý được quy định tài xế.');
  return data;
}
