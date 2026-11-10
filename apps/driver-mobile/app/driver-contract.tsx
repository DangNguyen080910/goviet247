import { useEffect, useState } from "react";
import { ScrollView, Text, TouchableOpacity, ActivityIndicator, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { getDriverToken } from "../services/storage";
import { getDriverContract, acceptDriverContract, type DriverContractResponse } from "../services/driverProfileApi";
export default function DriverContractScreen() {
  const [data,setData] = useState<DriverContractResponse | null>(null);
  const [viewHistory,setViewHistory] = useState<string|null>(null);
  const [busy,setBusy] = useState(false); const [error,setError] = useState(""); const [checked,setChecked] = useState(false);
  async function load() {
    setBusy(true);setError("");setChecked(false);setData(null);
    try { const token = await getDriverToken(); if (!token) throw new Error("Vui lòng đăng nhập lại."); setData(await getDriverContract(token)); }
    catch(e:any){setError(e.message || "Không tải được hợp đồng.");}finally{setBusy(false);}
  }
  useEffect(()=>{void load();},[]);
  async function accept() {
    if (!data?.profile || !checked || busy) return;
    setBusy(true);setError("");
    try {const token=await getDriverToken();if(!token)throw new Error("Vui lòng đăng nhập lại.");await acceptDriverContract(token,data.contract,data.profile.updatedAt);await load();}
    catch(e:any){setError((e.message || "Không xác nhận được hợp đồng.")+" Hãy tải lại trước khi thử tiếp.");setChecked(false);}finally{setBusy(false);}
  }
  const missingIdentity=!!data?.release && (!data.profile?.residentialAddress?.trim() || !/^\d{12}$/.test(data.profile?.citizenId||''));
  const p={fontSize:16,lineHeight:24,marginBottom:12,color:"#17202a"};
  return <SafeAreaView style={{flex:1,backgroundColor:"white"}}><ScrollView contentContainerStyle={{padding:20}}>
    <TouchableOpacity onPress={()=>router.back()}><Text style={p}>‹ Quay lại</Text></TouchableOpacity>
    <Text style={[p,{fontSize:22,fontWeight:"700"}]}>Hợp đồng tài xế</Text>
    {busy && <ActivityIndicator/>}{!!error && <Text style={[p,{color:"#b42318"}]}>{error}</Text>}
    <TouchableOpacity disabled={busy} onPress={load}><Text style={[p,{color:"#1676D2"}]}>Tải lại</Text></TouchableOpacity>
    {data && <>
      {data.release && <View><Text style={p}>Cập nhật: {data.release.changeSummary}</Text><Text style={p}>{data.needsAcceptance ? 'Bạn chưa xác nhận phiên bản đang áp dụng.' : 'Bạn đã xác nhận phiên bản đang áp dụng.'}</Text><Text style={p}>{data.release.requireForNewTrips ? 'Thời hạn xác nhận để nhận chuyến mới: '+new Date(data.release.deadline).toLocaleString('vi-VN', { timeZone: "Asia/Ho_Chi_Minh", hour12: false, day: "2-digit", month: "2-digit", year: "numeric" }) : 'Hiện không chặn nhận chuyến nếu chưa xác nhận.'}</Text></View>}
      {(data.history||[]).length>0 && <View><Text style={[p,{fontWeight:'700'}]}>Lịch sử xác nhận của bạn</Text>{data.history!.map(h=><View key={h.id}><TouchableOpacity accessibilityRole="button" onPress={()=>setViewHistory(viewHistory===h.id?null:h.id)}><Text style={[p,{color:'#1676D2'}]}>{h.contractVersion} · {new Date(h.agreedAt).toLocaleString('vi-VN', { timeZone: "Asia/Ho_Chi_Minh", hour12: false, day: "2-digit", month: "2-digit", year: "numeric" })} · {viewHistory===h.id?'Thu gọn':'Xem bản đã xác nhận'}</Text></TouchableOpacity>{viewHistory===h.id&&<View><Text style={p}>{h.evidenceNotice}</Text>{h.contentSnapshot?.identity&&<Text style={p}>Thông tin được lưu khi xác nhận: {Object.values(h.contentSnapshot.identity).filter(v=>typeof v==='string').join(' · ')}</Text>}{h.contentSnapshot?.contentVerified&&h.contentSnapshot.content&&<View><Text style={[p,{fontWeight:'700'}]}>{h.contentSnapshot.content.title}</Text>{h.contentSnapshot.content.company&&<Text style={p}>{Object.values(h.contentSnapshot.content.company).join(' · ')}</Text>}<Text style={p}>{h.contentSnapshot.content.confirmation}</Text></View>}{h.contentSnapshot?.contentVerified&&h.contentSnapshot.content?.sections.map((s,i)=><View key={i}><Text style={[p,{fontWeight:'700'}]}>{s.heading}</Text>{s.paragraphs.map((t,j)=><Text key={j} style={p}>{t}</Text>)}</View>)}</View>}</View>)}</View>}
      {data.acceptance && <View><Text style={p}>Bản ghi xác nhận gần nhất: {data.acceptance.contractVersion} · {new Date(data.acceptance.agreedAt).toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh", hour12: false, day: "2-digit", month: "2-digit", year: "numeric" })}</Text><Text style={p}>{data.acceptance.evidenceNotice}</Text></View>}
      <Text style={p}>Việc xác nhận dưới đây được ghi nhận tại thời điểm thực hiện, không thay đổi bản ghi hoặc ngày đồng ý cũ.</Text>
      <Text style={[p,{fontWeight:"700"}]}>{data.contract.title} · {data.contract.version}</Text>
      {data.profile && <Text style={p}>Thông tin đang xác nhận: {data.profile.fullName} · CCCD {data.profile.citizenId || "Chưa cập nhật"} · {data.profile.residentialAddress || "Chưa cập nhật địa chỉ"} · {data.profile.plateNumber}</Text>}
      {data.contract.company && <Text style={p}>{data.contract.company.name} · MST {data.contract.company.taxCode} · {data.contract.company.address} · Đại diện {data.contract.company.representative}, {data.contract.company.position}</Text>}
      {data.contract.sections.map(section=><View key={section.heading}><Text style={[p,{fontWeight:"700"}]}>{section.heading}</Text>{section.paragraphs.map((t,i)=><Text key={i} style={p}>{t}</Text>)}</View>)}
      {!data.profile && <Text style={p}>Vui lòng tạo hồ sơ tài xế để giao kết hợp đồng.</Text>}
      {missingIdentity&&<View><Text style={[p,{color:'#b42318'}]}>Hồ sơ còn thiếu CCCD hoặc địa chỉ. Vui lòng liên hệ GoViet247 để bổ sung và tải lại hợp đồng trước khi xác nhận.</Text><TouchableOpacity onPress={()=>router.push('/support' as any)}><Text style={[p,{color:'#1676D2'}]}>Liên hệ hỗ trợ</Text></TouchableOpacity></View>}
      {data.profile && data.needsAcceptance !== false && <><TouchableOpacity disabled={busy} accessibilityRole="checkbox" accessibilityState={{checked}} onPress={()=>setChecked(!checked)}><Text style={p}>{checked ? "☑" : "☐"} {data.contract.confirmation}</Text></TouchableOpacity>
      <TouchableOpacity disabled={!checked || busy || missingIdentity} onPress={accept} style={{padding:16,backgroundColor:checked && !busy && !missingIdentity ? "#1676D2":"#aaa",borderRadius:8}}><Text style={{color:"white",textAlign:"center",fontWeight:"700"}}>Xác nhận nội dung đang hiển thị</Text></TouchableOpacity></>}
    </>}
  </ScrollView></SafeAreaView>;
}
