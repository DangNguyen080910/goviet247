import React from "react";
import { View, Text, Pressable } from "react-native";
import { destinationConfig, destinationDescription, destinationPackageAvailable, destinationWindows, destinationSummary, destinationQuoteSummary } from "../../../packages/shared/destinationService.js";
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
export default function DestinationService({config,direction,pickup,returnTime,outboundMinutes,mode="STANDARD",wholeTrip=false,onMode}:any) {
 const c = destinationConfig(config);
 const available = wholeTrip ? destinationPackageAvailable(c, direction, pickup, returnTime, outboundMinutes)
   : destinationWindows(c, direction, pickup, returnTime, outboundMinutes).length > 0;
 if (!available) return null;
 return <View style={{padding:14,borderWidth:1,borderColor:"#bfdbfe",borderRadius:12,marginVertical:14,gap:10}}>
  <Text style={{fontWeight:"800",fontSize:17}}>{c.title}</Text>
  <Text>{c.introduction}</Text>
  {(["STANDARD","CHARTER"] as const).map(value=>{
   const charter=value === "CHARTER", name=charter ? c.charterName : c.standardName;
   return <Pressable key={value} accessibilityRole="radio" accessibilityLabel={name}
    accessibilityState={{checked:mode===value}} onPress={()=>onMode(value)}
    style={{padding:12,borderWidth:1,borderColor:mode===value?"#1976d2":"#cbd5e1",borderRadius:10,gap:6}}>
     <Text style={{fontWeight:"700"}}>{mode===value?'◉':'○'} {name}</Text>
     <Text>{destinationDescription(c,charter)}</Text>
     {charter && !wholeTrip && <Text>Gói Bao xe áp dụng theo lịch trình và khung phục vụ của chuyến.</Text>}
   </Pressable>;
  })}
  <Text>{c.outsideNotice}</Text>
 </View>;
}
