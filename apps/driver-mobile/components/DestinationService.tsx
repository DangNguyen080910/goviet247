import { driverTourSummary } from "../../api/src/shared/driverTourSummary.js";
import React from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { destinationConfig, destinationDescription, destinationWindows, vnTime } from "../../../packages/shared/destinationService.js";
export function ServiceSummary({ snapshot }: { snapshot?: any }) {
  const defaults = destinationConfig();
  const notices = [
    snapshot?.allInclusiveNotice || defaults.allInclusiveNotice,
    snapshot?.paymentNotice || defaults.paymentNotice,
  ];
  return (
    <View style={{ padding: 12, marginVertical: 10, backgroundColor: "#eff6ff", borderRadius: 10 }}>
      {driverTourSummary(snapshot).map((line: string, index: number) => (
        <Text key={index} style={{ color: "#1e3a5f", marginBottom: 6, lineHeight: 21, fontWeight: notices.includes(line) || line.startsWith("Phụ phí phục vụ tour:") ? "700" : "400" }}>
          {line}
        </Text>
      ))}
    </View>
  );
}
export default function DestinationService({config,direction,pickup,returnTime,outboundMinutes,anchor,onAnchor,dates,onDates}:any) {
 const c=destinationConfig(config), windows=destinationWindows(c,direction,pickup,returnTime,outboundMinutes);
 if(!windows.length) return null;
 return <View style={{padding:14,borderWidth:1,borderColor:"#bfdbfe",borderRadius:12,marginVertical:14,gap:10}}>
 <Text style={{fontWeight:"800",fontSize:17}}>{c.title}</Text><Text>{c.introduction}</Text>
 <Text>Nơi lưu trú làm mốc phục vụ</Text><TextInput accessibilityLabel="Nơi lưu trú làm mốc phục vụ" value={anchor} onChangeText={onAnchor} placeholder="Khách sạn/nơi lưu trú tại điểm đến" style={{borderWidth:1,borderColor:"#cbd5e1",padding:12,borderRadius:8}}/>
 <Pressable accessibilityRole="radio" accessibilityState={{checked:!dates.length}} onPress={()=>onDates([])}><Text style={{fontWeight:"700"}}>{!dates.length?"◉":"○"} {c.standardName} — Đã bao gồm trong giá</Text></Pressable><Text>{destinationDescription(c)}</Text><Text>Giờ hỗ trợ: {c.standardStartHour}:00–{c.standardEndHour}:00</Text>
 <Pressable accessibilityRole="radio" accessibilityState={{checked:!!dates.length}} onPress={()=>{if(!dates.length)onDates([windows[0].date]);}}><Text style={{fontWeight:"700"}}>{dates.length?"◉":"○"} {c.charterName} — +{c.charterDailyFee.toLocaleString("vi-VN")}đ/ngày phục vụ</Text></Pressable><Text>{destinationDescription(c,true)}</Text>
 <Text>Chọn ngày dùng Bao xe. Ngày không chọn áp dụng Tiêu chuẩn. Ngày đến/về chỉ phục vụ trong khoảng giờ bên dưới; mỗi ngày chọn tính đủ một ngày phí.</Text>
 {windows.map(w=><Pressable key={w.date} accessibilityRole="checkbox" accessibilityState={{checked:dates.includes(w.date)}} onPress={()=>onDates(dates.includes(w.date)?dates.filter((d:string)=>d!==w.date):[...dates,w.date])} style={{padding:12,backgroundColor:dates.includes(w.date)?"#dbeafe":"#f1f5f9",borderRadius:8}}><Text>{dates.includes(w.date)?"☑":"☐"} {w.date}: {vnTime(w.start)}–{vnTime(w.end)} ({w.hours} giờ)</Text></Pressable>)}
 <Text style={{fontWeight:"700"}}>Phụ phí Bao xe: {(dates.length*c.charterDailyFee).toLocaleString("vi-VN")}đ ({dates.length} ngày)</Text><Text>{c.outsideNotice}</Text>
 </View>;
}
