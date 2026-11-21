import { API_BASE_URL } from '../constants/api';
import { getDriverToken } from './storage';
export type RulesSection = { id:string; title:string; summary:string; paragraphs:string[] };
export type RulesGroup = { id:string; title:string; description:string; sections:RulesSection[] };
export type RulesContent = { title:string; confirmation:string; groups:RulesGroup[] };
export type RulesStatus = { driverProfileId?:string; release:{id:string;version:number;contentHash:string;changeSummary:string;publishedAt:string}|null;needsAcceptance:boolean;acceptance:{versionId:string;contentHash:string;acceptedAt:string;confirmation:string}|null };
export type RulesDocument = RulesStatus & {content:RulesContent;changedGroupIds:string[];changedSectionIds:string[]};
export async function driverRulesRequest<T>(path='',body?:unknown):Promise<T> {
  const token=await getDriverToken();
  if(!token)throw new Error('Chưa tải được quy định. Vui lòng thử lại khi ứng dụng đã sẵn sàng.');
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);
  try {
    const base=String(API_BASE_URL).replace(/\/+$/,'');
    const response=await fetch(`${base.endsWith('/api')?base:base+'/api'}/driver/profile/rules${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:controller.signal});
    const data=await response.json().catch(()=>({}));
    if(!response.ok||!data.success)throw new Error(data.message||'Chưa tải được quy định. Vui lòng kiểm tra mạng và thử lại.');
    return data;
  } finally{clearTimeout(timer);}
}
