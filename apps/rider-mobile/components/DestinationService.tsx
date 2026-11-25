import React from "react";
import { View, Text, Pressable } from "react-native";
import { destinationConfig, destinationDescription, destinationDays, destinationSummary, destinationQuoteSummary } from "../../../packages/shared/destinationService.js";
export function ServiceSummary({ snapshot, quote = false, config }: { snapshot?: any; quote?: boolean; config?: any }) {
  // Only booked destination-service packages belong in this panel.
  if (snapshot?.eligible !== true && !quote) return null;
  const defaults = destinationConfig(config);
  const notices = [
    snapshot?.allInclusiveNotice || defaults.allInclusiveNotice,
    snapshot?.paymentNotice || defaults.paymentNotice,
  ];
  return (
    <View style={{ padding: 12, marginVertical: 10, backgroundColor: "#eff6ff", borderRadius: 10 }}>
      {(quote ? destinationQuoteSummary(snapshot, config) : destinationSummary(snapshot)).map((line: string, index: number) => (
        <Text key={index} style={{ color: "#1e3a5f", marginBottom: 6, lineHeight: 21, fontWeight: notices.includes(line) ? "700" : "400" }}>
          {line}
        </Text>
      ))}
    </View>
  );
}
export default function DestinationService({config,direction,pickup,returnTime,outboundMinutes,mode="STANDARD",onMode}:any) {
 const c=destinationConfig(config), days=destinationDays(c,direction,pickup,returnTime,outboundMinutes);
 if(!days.length) return null;
 const charterAvailable=days.some(day=>day.charter);
 return <View style={{padding:14,borderWidth:1,borderColor:"#bfdbfe",borderRadius:12,marginVertical:14,gap:10}}>
  <Text style={{fontWeight:"800",fontSize:17}}>{c.title}</Text>
  <Text>Chọn một gói cho toàn bộ thời gian lưu trú tại điểm đến.</Text>
  {(["STANDARD","CHARTER"] as const).map(value=>{
   const charter=value === "CHARTER", disabled=charter && !charterAvailable, name=charter ? c.charterName : c.standardName;
   return <Pressable key={value} disabled={disabled} accessibilityRole="radio" accessibilityLabel={name}
    accessibilityState={{checked:mode===value,disabled}} onPress={()=>onMode(value)}
    style={{padding:12,borderWidth:1,borderColor:mode===value?"#1976d2":"#cbd5e1",borderRadius:10,gap:6,opacity:disabled?0.6:1}}>
     <Text style={{fontWeight:"700"}}>{mode===value?'◉':'○'} {name}</Text>
     <Text>{destinationDescription(c,charter)}</Text>
     {!charter && <Text>Giờ hỗ trợ: {String(c.standardStartHour).padStart(2,"0")}:00–{String(c.standardEndHour).padStart(2,"0")}:00</Text>}
     {disabled && <Text>Chưa có khung phục vụ Bao xe phù hợp với lịch này.</Text>}
   </Pressable>;
  })}
  <Text>{c.outsideNotice}</Text>
 </View>;
}
