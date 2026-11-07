import {registerDriverNoteDraft,flushDriverNoteDraft} from "../../mobile-chat/driverNoteDrafts.js";
import { useEffect, useRef, useState } from "react";
import { Alert, Platform, Text, TextInput, Pressable, View } from "react-native";
import { adminRequest } from "../services/adminRequest";
export default function TripDriverNoteEditor({tripId,visible=true}:{tripId:string;visible?:boolean}) {
  const baseline=useRef("");
  const [text,setText]=useState("");const [version,setVersion]=useState("");const [status,setStatus]=useState("");
  const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [saved,setSaved]=useState(false);
  async function load(){setBusy(true);setError("");setSaved(false);try{const data=await adminRequest(`/api/admin/trips/${encodeURIComponent(tripId)}`);baseline.current=data.trip.dispatcherNote||"";setText(baseline.current);setVersion(data.trip.updatedAt);setStatus(data.trip.status);}catch(e:any){setError(e.message);}finally{setBusy(false);}}
  useEffect(()=>{if(visible&&tripId)void load();},[tripId,visible]);
  async function save(){if(busy||!version)throw new Error("Ghi chú đang tải hoặc đang lưu. Vui lòng thử lại.");setBusy(true);setError("");setSaved(false);try{const data=await adminRequest(`/api/admin/trips/${encodeURIComponent(tripId)}/driver-note`,{method:"PATCH",body:JSON.stringify({dispatcherNote:text,expectedUpdatedAt:version})});if(!data.success)throw new Error(data.message||"Chưa lưu được.");baseline.current=data.dispatcherNote||"";setText(baseline.current);setVersion(data.updatedAt);setSaved(true);}catch(e:any){setError(e.message);throw e;}finally{setBusy(false);}}
  function reload(){
    if(text===baseline.current){void load();return;}
    const message="Bạn có ghi chú chưa lưu. Tải lại sẽ bỏ nội dung đang nhập.";
    if(Platform.OS==="web"){if(window.confirm(message))void load();return;}
    Alert.alert("Tải lại ghi chú?",message,[{text:"Giữ bản nháp",style:"cancel"},{text:"Bỏ và tải lại",style:"destructive",onPress:()=>{void load();}}]);
  }
  const ended=["COMPLETED","CANCELLED"].includes(status);
  useEffect(()=>registerDriverNoteDraft(tripId,async()=>{if(text!==baseline.current)await save();}),[tripId,text,version,busy]);
  return <View style={{padding:12,marginVertical:12,borderWidth:1,borderColor:"#f59e0b",borderRadius:10,backgroundColor:"#fffbeb",gap:8}}>
    <Text style={{fontWeight:"800",color:"#78350f"}}>Ghi chú điều hành — gửi tài xế</Text>
    <Text style={{color:"#78350f"}}>Tài xế sẽ thấy nội dung này. Không hiển thị cho khách; khác với ghi chú xác nhận nội bộ.</Text>
    <TextInput accessibilityLabel="Ghi chú điều hành gửi tài xế" multiline maxLength={2000} editable={!busy&&!ended} value={text} onChangeText={value=>{setText(value);setSaved(false);}} style={{minHeight:85,padding:12,borderWidth:1,borderColor:"#cbd5e1",borderRadius:8,backgroundColor:"white",textAlignVertical:"top",color:"#1f2937"}}/>
    {!!error&&<Text style={{color:"#b91c1c"}}>{error}</Text>}{saved&&<Text style={{color:"#15803d"}}>Đã lưu ghi chú gửi tài xế.</Text>}
    <Pressable accessibilityRole="button" disabled={busy||ended||!version} onPress={()=>{void flushDriverNoteDraft(tripId).catch(()=>{});}} style={{padding:12,borderRadius:8,backgroundColor:busy||ended||!version?"#94a3b8":"#1976d2"}}><Text style={{fontWeight:"700",color:"white"}}>{busy?"Đang xử lý…":"Lưu ghi chú gửi tài xế"}</Text></Pressable>
    <Pressable disabled={busy} onPress={reload}><Text style={{padding:8,color:"#1976d2"}}>Tải lại ghi chú</Text></Pressable>
  </View>;
}
