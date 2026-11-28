import { driverTourSummary } from "../../api/src/shared/driverTourSummary.js";
import React from "react";
import { View, Text, Pressable } from "react-native";
import { destinationConfig, destinationDescription, destinationDays, destinationChargeLines } from "../../../packages/shared/destinationService.js";
export function ServiceSummary({ snapshot }: { snapshot?: any }) {
  const lines = snapshot?.eligible === true
    ? driverTourSummary(snapshot, { hidePaymentAndScope: true })
    : destinationChargeLines(snapshot, { combineCharterAndOvernight: true });
  if (!lines.length) return null;
  const defaults = destinationConfig();
  const notices = [
    snapshot?.allInclusiveNotice || defaults.allInclusiveNotice,
  ];
  return (
    <View style={{ padding: 12, marginVertical: 10, backgroundColor: "#eff6ff", borderRadius: 10 }}>
      {lines.map((line: string, index: number) => (
        <Text key={index} style={{ color: "#1e3a5f", marginBottom: 6, lineHeight: 21, fontWeight: notices.includes(line) || line.startsWith("Phụ phí phục vụ tour:") || line.startsWith("Phí Bao xe") ? "700" : "400" }}>
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
  <Text>{c.introduction}</Text>
  {(["STANDARD","CHARTER"] as const).map(value=>{
   const charter=value === "CHARTER", disabled=charter && !charterAvailable, name=charter ? c.charterName : c.standardName;
   return <Pressable key={value} disabled={disabled} accessibilityRole="radio" accessibilityLabel={name}
    accessibilityState={{checked:mode===value,disabled}} onPress={()=>onMode(value)}
    style={{padding:12,borderWidth:1,borderColor:mode===value?"#1976d2":"#cbd5e1",borderRadius:10,gap:6,opacity:disabled?0.6:1}}>
     <Text style={{fontWeight:"700"}}>{mode===value?'◉':'○'} {name}</Text>
     <Text>{destinationDescription(c,charter)}</Text>
     {disabled && <Text>Chưa có khung phục vụ Bao xe phù hợp với lịch này.</Text>}
   </Pressable>;
  })}
  <Text>{c.outsideNotice}</Text>
 </View>;
}
