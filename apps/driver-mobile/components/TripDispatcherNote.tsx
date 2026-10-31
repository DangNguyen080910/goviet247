import { Text, View } from "react-native";
export default function TripDispatcherNote({note}:{note?:string|null}) {
  if(!note?.trim())return null;
  return <View style={{padding:12,marginVertical:10,borderLeftWidth:3,borderLeftColor:"#f59e0b",backgroundColor:"#fffbeb",borderRadius:8}}><Text style={{fontWeight:"800",color:"#92400e",marginBottom:5}}>Ghi chú từ điều hành GoViet247</Text><Text style={{color:"#78350f",fontSize:14,lineHeight:22}}>{note}</Text></View>;
}
