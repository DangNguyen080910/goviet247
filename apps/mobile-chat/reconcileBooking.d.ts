export function reconcileBooking(base:string,headers:HeadersInit,requestId?:string):Promise<{success:true;trip:{id:string;status:string};replayed:true}|null>;
