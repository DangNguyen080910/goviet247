// JSON API requests only. Buffer a cloned body so the deadline covers response.json(), too.
// Never retry a mutation here: a lost response does not mean the write failed.
export async function fetchWithTimeout(input,options={},timeoutMs=25000){
  const controller=new AbortController(),caller=options.signal;
  const mutation=!['GET','HEAD'].includes(String(options.method || 'GET').toUpperCase());
  let timer,onAbort;
  const failure=()=>Object.assign(new Error(mutation
    ?'Chưa xác nhận được kết quả. Thao tác có thể đã được lưu; vui lòng kiểm tra trạng thái trước khi thử lại.'
    :'Chưa tải được dữ liệu. Vui lòng kiểm tra kết nối và thử lại.'),{code:mutation?'REQUEST_UNCONFIRMED':'REQUEST_TIMEOUT'});
  const interrupted=new Promise((_,reject)=>{
    onAbort=()=>{controller.abort();reject(Object.assign(new Error('Request cancelled'),{name:'AbortError'}));};
    if(caller?.aborted)onAbort();else caller?.addEventListener('abort',onAbort,{once:true});
    timer=setTimeout(()=>{controller.abort();reject(failure());},timeoutMs);
  });
  try{
    return await Promise.race([interrupted,(async()=>{
      try{
        const response=await fetch(input,{...options,signal:controller.signal});
        if(typeof response.clone==='function')await response.clone().text();
        return response;
      }catch(error){if(caller?.aborted)throw Object.assign(new Error('Request cancelled'),{name:'AbortError'});throw failure();}
    })()]);
  }finally{clearTimeout(timer);caller?.removeEventListener('abort',onAbort);}
}
