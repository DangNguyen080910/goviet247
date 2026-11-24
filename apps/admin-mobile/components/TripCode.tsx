import { StyleSheet, Text, View } from 'react-native';
import CopyTripIdButton from './CopyTripIdButton';

export default function TripCode({tripId,label}: {tripId?:string|null;label?:string}) {
  const value=String(tripId || '').trim();
  if (!value || value==='-' || value==='--') return null;
  return <View style={styles.row}>
    <Text selectable style={styles.code}>{label}{value}</Text>
    <CopyTripIdButton tripId={value}/>
  </View>;
}
const styles=StyleSheet.create({
  row:{flexDirection:'row',alignItems:'center',gap:6,maxWidth:'100%',flexShrink:1},
  code:{minWidth:0,flexShrink:1,fontSize:13,fontWeight:'700',color:'#334155'},
});
