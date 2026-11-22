import * as Clipboard from 'expo-clipboard';
import {useEffect,useState} from 'react';
import {Alert, Pressable, Text} from 'react-native';

// Always copy the full ID, even where the card displays a shortened code.
export default function CopyTripIdButton({tripId}:{tripId?:string|null}) {
  const [copied,setCopied]=useState(false);
  const value=String(tripId || '').trim();
  useEffect(()=>setCopied(false),[value]);
  if (!value || value==='-' || value==='--') return null;
  return <Pressable accessibilityRole="button" accessibilityLabel={`Sao chép mã chuyến ${value}`}
    hitSlop={4} style={{alignSelf:'flex-start',minHeight:36,justifyContent:'center',paddingHorizontal:10,paddingVertical:6,borderRadius:8,backgroundColor:'#eff6ff',borderColor:'#bfdbfe',borderWidth:1}}
    onPress={async event=>{
      event.stopPropagation();
      try {if (await Clipboard.setStringAsync(value)===false) throw new Error('Clipboard unavailable');setCopied(true);Alert.alert('Đã sao chép',`Mã chuyến: ${value}`);}
      catch {setCopied(false);Alert.alert('Không thể sao chép','Vui lòng thử lại.');}
    }}><Text style={{color:'#1d4ed8',fontSize:12,fontWeight:'700'}}>{copied?'Copy ✓':'Copy'}</Text></Pressable>;
}
