import { driverTourSummary } from "../../api/src/shared/driverTourSummary.js";
import React from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { destinationConfig, destinationDescription, destinationWindows, destinationDays, destinationDayText, destinationSelectedFee, vnTime } from "../../../packages/shared/destinationService.js";
export function ServiceSummary({ snapshot }: { snapshot?: any }) {
  const defaults = destinationConfig();
  const notices = [
    snapshot?.allInclusiveNotice || defaults.allInclusiveNotice,
  ];
  return (
    <View style={{ padding: 12, marginVertical: 10, backgroundColor: "#eff6ff", borderRadius: 10 }}>
      {driverTourSummary(snapshot, { hidePaymentAndScope: true }).map((line: string, index: number) => (
        <Text key={index} style={{ color: "#1e3a5f", marginBottom: 6, lineHeight: 21, fontWeight: notices.includes(line) || line.startsWith("Phụ phí phục vụ tour:") ? "700" : "400" }}>
          {line}
        </Text>
      ))}
    </View>
  );
}
export default function DestinationService({config,direction,pickup,returnTime,outboundMinutes,anchor,onAnchor,dates,onDates}:any) {
 const c=destinationConfig(config), windows=destinationDays(c,direction,pickup,returnTime,outboundMinutes);
 if(!windows.length) return null;
 return <View style={{padding:14,borderWidth:1,borderColor:"#bfdbfe",borderRadius:12,marginVertical:14,gap:10}}>
 <Text style={{fontWeight:"800",fontSize:17}}>{c.title}</Text><Text>{c.introduction}</Text>
 <Text>Nơi lưu trú làm mốc phục vụ</Text><TextInput accessibilityLabel="Nơi lưu trú làm mốc phục vụ" value={anchor} onChangeText={onAnchor} placeholder="Khách sạn/nơi lưu trú tại điểm đến" style={{borderWidth:1,borderColor:"#cbd5e1",padding:12,borderRadius:8}}/>
 <Text style={{fontWeight:"700"}}>{c.standardName} — Đã bao gồm trong giá</Text><Text>{destinationDescription(c)}</Text><Text>Giờ hỗ trợ: {c.standardStartHour}:00–{c.standardEndHour}:00</Text>
 <Text style={{fontWeight:"700"}}>{c.charterName} — +{c.charterDailyFee.toLocaleString("vi-VN")}đ/khung ngày {c.charterStartHour}:00–{c.charterEndHour}:00</Text><Text>{destinationDescription(c,true)}</Text>

 {windows.map(w=><View key={w.date} style={{padding:12,backgroundColor:'#f1f5f9',borderRadius:8,gap:8}}>
   <Text style={{fontWeight:'700'}}>{w.date}</Text>
   <Pressable accessibilityRole="radio" accessibilityState={{checked:!dates.includes(w.date)}} onPress={()=>onDates(dates.filter((d:string)=>d!==w.date))}><Text>{!dates.includes(w.date)?'◉':'○'} {c.standardName} — Đã bao gồm trong giá</Text></Pressable>
   <Pressable disabled={!w.charter} accessibilityRole="radio" accessibilityState={{checked:dates.includes(w.date),disabled:!w.charter}} onPress={()=>onDates([...dates.filter((d:string)=>d!==w.date),w.date])}><Text>{dates.includes(w.date)?'◉':'○'} {c.charterName} — +{(w.charter?.fee || 0).toLocaleString('vi-VN')}đ</Text></Pressable>
   <Text>{destinationDayText(w,dates.includes(w.date),c)}</Text>
   {!w.charter && <Text>Không còn khung giờ Bao xe phù hợp trong ngày này.</Text>}
 </View>)}
 <Text style={{fontWeight:"700"}}>Phụ phí Bao xe: {destinationSelectedFee(windows,dates).toLocaleString("vi-VN")}đ ({dates.length} ngày)</Text><Text>{c.outsideNotice}</Text>
 </View>;
}
