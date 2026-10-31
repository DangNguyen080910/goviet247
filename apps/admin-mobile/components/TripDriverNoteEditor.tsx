import { useEffect, useState } from "react";
import { Text, TextInput, Pressable, View } from "react-native";
import { adminRequest } from "../services/adminRequest";
export default function TripDriverNoteEditor({tripId,visible=true}:{tripId:string;visible?:boolean}) {
  const [text,setText]=useState("");const [version,setVersion]=useState("");const [status,setStatus]=useState("");
  const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [saved,setSaved]=useState(false);
  async function load(){setBusy(true);setError("");setSaved(false);try{const data=await adminRequest(`/api/admin/trips/${encodeURIComponent(tripId)}`);setText(data.trip.dispatcherNote||"");setVersion(data.trip.updatedAt);setStatus(data.trip.status);}catch(e:any){setError(e.message);}finally{setBusy(false);}}
  useEffect(()=>{if(visible&&tripId)void load();},[tripId,visible]);
  async function save(){setBusy(true);setError("");setSaved(false);try{const data=await adminRequest(`/api/admin/trips/${encodeURIComponent(tripId)}/driver-note`,{method:"PATCH",body:JSON.stringify({dispatcherNote:text,expectedUpdatedAt:version})});if(!data.success)throw new Error(data.message||"Chưa lưu được.");setText(data.dispatcherNote||"");setVersion(data.updatedAt);setSaved(true);}catch(e:any){setError(e.message);}finally{setBusy(false);}}
  const ended=["COMPLETED","CANCELLED"].includes(status);
  return <View style={{padding:12,marginVertical:12,borderWidth:1,borderColor:"#f59e0b",borderRadius:10,backgroundColor:"#fffbeb",gap:8}}>
    <Text style={{fontWeight:"800",color:"#78350f"}}>Ghi chú điều hành — gửi tài xế</Text>
    <Text style={{color:"#78350f"}}>Tài xế sẽ thấy nội dung này. Không hiển thị cho khách; khác với ghi chú xác nhận nội bộ.</Text>
    <TextInput accessibilityLabel="Ghi chú điều hành gửi tài xế" multiline maxLength={2000} editable={!busy&&!ended} value={text} onChangeText={value=>{setText(value);setSaved(false);}} style={{minHeight:85,padding:12,borderWidth:1,borderColor:"#cbd5e1",borderRadius:8,backgroundColor:"white",textAlignVertical:"top",color:"#1f2937"}}/>
    {!!error&&<Text style={{color:"#b91c1c"}}>{error}</Text>}{saved&&<Text style={{color:"#15803d"}}>Đã lưu ghi chú gửi tài xế.</Text>}
    <Pressable accessibilityRole="button" disabled={busy||ended||!version} onPress={save} style={{padding:12,borderRadius:8,backgroundColor:busy||ended||!version?"#94a3b8":"#1976d2"}}><Text style={{fontWeight:"700",color:"white"}}>{busy?"Đang xử lý…":"Lưu ghi chú gửi tài xế"}</Text></Pressable>
    <Pressable disabled={busy} onPress={load}><Text style={{padding:8,color:"#1976d2"}}>Tải lại ghi chú</Text></Pressable>
  </View>;
}
