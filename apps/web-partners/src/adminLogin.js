// Reuse the existing GoViet247 Admin authentication endpoint and credentials.
export async function loginGoVietAdmin(base, username, password) {
  const response=await fetch(`${base}/api/admin/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',body:JSON.stringify({username,password})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok || !data.success || !data.token) throw new Error('Không đăng nhập được. Vui lòng kiểm tra tài khoản Admin GoViet247.');
  if(data.user?.role!=='ADMIN') throw new Error('Chỉ tài khoản Admin GoViet247 được hỗ trợ tất cả đối tác.');
  return data;
}
