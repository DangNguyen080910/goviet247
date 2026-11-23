import {fetchWithTimeout} from './fetchWithTimeout.js';
export async function reconcileBooking(base,headers,requestId){
  if(!requestId)return null;
  try{
    const response=await fetchWithTimeout(`${base}/api/trips/booking-result?requestId=${encodeURIComponent(requestId)}`,{headers},10000);
    const data=await response.json();
    return response.ok && data?.success && data.trip?.id ? {success:true,trip:data.trip,replayed:true}:null;
  }catch{return null;}
}
