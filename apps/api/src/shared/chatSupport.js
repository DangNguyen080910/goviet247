export async function chatSupportUrl(base, role='RIDER') {
  const response=await fetch(`${String(base).replace(/\/api\/?$/, '').replace(/\/$/,'')}/api/public/system-config`);
  if(!response.ok)throw new Error('Chưa tải được liên hệ hỗ trợ. Vui lòng thử lại.');
  const payload=await response.json();
  const digits=String(payload.data?.[role==='DRIVER'?'supportPhoneDriver':'supportPhoneRider']||'').replace(/\D/g,'');
  if(!digits)throw new Error('Chưa có số hỗ trợ. Vui lòng kiểm tra mục Liên hệ GoViet247.');
  return `https://zalo.me/${digits.startsWith('0')?'84'+digits.slice(1):digits}`;
}
