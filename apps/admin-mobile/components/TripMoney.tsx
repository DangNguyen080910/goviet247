import React from 'react';
import { View, Text } from 'react-native';
import { driverSurchargeLines } from '../../api/src/shared/driverSurcharges.js';
export default function TripMoney({ trip }: { trip: any }) {
 return <View style={{ marginVertical: 8 }}>
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
   <View style={{flex:1}}><Text>Giá chuyến</Text><Text style={{fontWeight:'700'}}>{Number(trip?.totalPrice || 0).toLocaleString('vi-VN')}đ</Text></View>
   <View style={{flex:1}}><Text>Tài xế thực nhận{trip?.driverReceiveEstimated ? ' (dự kiến)' : ''}</Text><Text style={{fontWeight:'700',color:'#15803d'}}>{trip?.driverReceive == null ? 'Chưa có dữ liệu' : Number(trip.driverReceive).toLocaleString('vi-VN')+'đ'}</Text></View>
  </View>
  {driverSurchargeLines(trip).map((line: string) => <Text key={line} style={{fontSize:12,color:'#475569',marginTop:5}}>{line}</Text>)}
 </View>;
}
