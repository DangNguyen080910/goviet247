import { Platform, Share } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { adminRequest } from './adminRequest';
import { getAdminToken } from './storage';
import { API_BASE_URL } from '../constants/api';
export const vietnamToday=()=>new Date(Date.now()+7*3600000).toISOString().slice(0,10);
export const fetchCommissionDay=(day:string,pendingOnly:boolean)=>adminRequest(`/api/admin/commission-details?day=${encodeURIComponent(day)}&pendingOnly=${pendingOnly}`);
export const fetchCommissionSummary=()=>adminRequest('/api/admin/commission-invoices/summary');
export const confirmCommissionInvoice=(tripId:string,invoiceNumber:string,issuedDay:string)=>adminRequest(`/api/admin/commission-invoices/${encodeURIComponent(tripId)}/confirm`,{method:'POST',body:JSON.stringify({invoiceNumber,issuedDay})});
export async function downloadCommissionDay(day:string,format:'invoice-xlsx'|'xlsx'|'pdf',pendingOnly=true) {
  const token=await getAdminToken();if(!token)throw Error('Vui lòng đăng nhập lại.');
  const invoice=format==='invoice-xlsx';
  const url=`${API_BASE_URL}/api/admin/${invoice?'commission-details':'accounting-report/pdf'}?day=${encodeURIComponent(day)}&pendingOnly=${invoice||pendingOnly}&format=${format}${invoice?'':'&reportType=commission'}`;
  const filename=`${invoice?'hoa_don_hoa_hong':'hoa_hong'}_${day}.${format==='pdf'?'pdf':'xlsx'}`;
  const headers={Authorization:`Bearer ${token}`};
  if(Platform.OS==='web'){
    const res=await fetch(url,{headers});if(!res.ok){const data=await res.json();throw Error(data.message||'Không xuất được file.');}
    const href=URL.createObjectURL(await res.blob());const a=document.createElement('a');a.href=href;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),1000);return;
  }
  if(!FileSystem.cacheDirectory)throw Error('Thiết bị chưa có thư mục tải tạm.');
  const local=`${FileSystem.cacheDirectory}${Date.now()}-${filename}`;
  try{
    const result=await FileSystem.downloadAsync(url,local,{headers});
    if(result.status!==200){
      let message='Không xuất được file.';
      try{const body=JSON.parse(await FileSystem.readAsStringAsync(local));message=[body.message,...(body.issues||[]).slice(0,3).map((i:any)=>`${i.driverName}: ${i.missing.join(', ')}`)].join(' ');}catch{}
      throw Error(message);
    }
    if(Platform.OS==='android'){
      const permission=await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();if(!permission.granted)return;
      const mime=format==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const dest=await FileSystem.StorageAccessFramework.createFileAsync(permission.directoryUri,filename,mime);
      await FileSystem.writeAsStringAsync(dest,await FileSystem.readAsStringAsync(local,{encoding:FileSystem.EncodingType.Base64}),{encoding:FileSystem.EncodingType.Base64});
    }else{await Share.share({url:local,title:filename});}
  }finally{await FileSystem.deleteAsync(local,{idempotent:true}).catch(()=>{});}
}
