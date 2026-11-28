import React from "react";
import { View, Text, Pressable } from "react-native";
import { destinationConfig, destinationDescription, destinationPackageAvailable, destinationWindows, CHARTER_UNAVAILABLE_MESSAGE, destinationSummary, destinationQuoteSummary, INCLUDED_CHARGES_LABEL, TWO_ONE_WAY_TRIPS_NOTICE } from "../../../packages/shared/destinationService.js";
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
      {(quote ? destinationQuoteSummary(snapshot, config) : destinationSummary(snapshot)).map((line: string, index: number) => quote && line === TWO_ONE_WAY_TRIPS_NOTICE ? (
        <Text key={index} style={{ backgroundColor: "#fff4e5", color: "#854d0e", padding: 8, marginTop: 8, borderRadius: 6, lineHeight: 21 }}>
          {line}
        </Text>
      ) : (
        <Text key={index} style={{ color: "#1e3a5f", marginBottom: 6, marginTop: line === INCLUDED_CHARGES_LABEL ? 8 : 0, lineHeight: 21, fontWeight: line === INCLUDED_CHARGES_LABEL || notices.includes(line) ? "700" : "400" }}>
          {line}
        </Text>
      ))}
    </View>
  );
}
export default function DestinationService({config,direction,pickup,returnTime,outboundMinutes,mode="STANDARD",wholeTrip=false,onMode}:any) {
 const c = destinationConfig(config);
 const charterAvailable = destinationWindows(c, direction, pickup, returnTime, outboundMinutes, wholeTrip).length > 0;
 const available = wholeTrip ? destinationPackageAvailable(c, direction, pickup, returnTime, outboundMinutes) : charterAvailable;
 if (!available) return null;
 return <View style={{padding:14,borderWidth:1,borderColor:"#bfdbfe",borderRadius:12,marginVertical:14,gap:10}}>
  <Text style={{fontWeight:"800",fontSize:17}}>{c.title}</Text>
  <Text>{c.introduction}</Text>
  {(["STANDARD","CHARTER"] as const).map(value=>{
   const charter=value === "CHARTER", name=charter ? c.charterName : c.standardName;
   const disabled = charter && !charterAvailable;
   return <View key={value} style={{padding:12,borderWidth:1,borderColor:mode===value?"#1976d2":"#cbd5e1",borderRadius:10,gap:6}}>
    <Pressable accessibilityRole="radio" accessibilityLabel={name} disabled={disabled}
     accessibilityState={{checked:mode===value, disabled}} onPress={()=>onMode(value)} style={{gap:6}}>
      <Text style={{fontWeight:"700", color:disabled ? "#64748b" : undefined}}>{mode===value?'◉':'○'} {name}</Text>
      <Text style={{color:disabled ? "#64748b" : undefined}}>{destinationDescription(c, charter, wholeTrip)}</Text>
      {charter && !wholeTrip && <Text>Gói Bao xe áp dụng theo lịch trình và khung phục vụ của chuyến.</Text>}
    </Pressable>
    {disabled && <Text style={{backgroundColor:"#fff4e5", color:"#854d0e", padding:8, borderRadius:6}}>
      {CHARTER_UNAVAILABLE_MESSAGE}
    </Text>}
   </View>;
  })}
  <Text>{c.outsideNotice}</Text>
 </View>;
}
