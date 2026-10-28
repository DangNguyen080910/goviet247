import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { driverSurchargeLines } from '../../api/src/shared/driverSurcharges.js';
import { riderPackageLines } from '../../api/src/shared/riderTripPricing.js';
import { ServiceSummary } from './DestinationService';
export default function TripPricingSummary({ trip }: { trip: any }) {
 const [expanded,setExpanded] = useState(false);
 const packages = riderPackageLines(trip?.destinationService);
 const surcharges = driverSurchargeLines(trip);
 if (!packages.length && !surcharges.length) return null;
 return <View style={{marginVertical:8,padding:12,borderRadius:10,backgroundColor:'#eff6ff'}}>
  {surcharges.map((line:string) => <Text key={line} style={{color:'#1e3a5f',fontWeight:'700',lineHeight:21}}>{line}</Text>)}
  {packages.map((line:string,index:number) => <Text key={index} style={{color:'#1e3a5f',lineHeight:21}}>{line}</Text>)}
  {!!packages.length && <Pressable accessibilityRole="button" accessibilityState={{expanded}} onPress={()=>setExpanded(value=>!value)} style={{paddingVertical:10}}><Text style={{color:'#2563eb',fontWeight:'700'}}>{expanded?'Ẩn chi tiết phục vụ':'Chi tiết phục vụ'}</Text></Pressable>}
  {expanded && <ServiceSummary snapshot={trip.destinationService} />}
 </View>;
}
