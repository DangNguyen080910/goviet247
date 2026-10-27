import React from 'react';
import { View, Text } from 'react-native';
import { driverTourSummary } from '../../api/src/shared/driverTourSummary.js';
export default function TourServiceSummary({ snapshot }: { snapshot?: any }) {
  return <View style={{ padding: 14, marginVertical: 10, backgroundColor: '#eff6ff', borderRadius: 12 }}>
    <Text style={{ fontSize: 16, fontWeight: '700', color: '#1e3a5f', marginBottom: 8 }}>Phục vụ tại điểm đến / Phụ phí tour</Text>
    {driverTourSummary(snapshot).map((line: string, index: number) => <Text key={index} style={{ color: '#1e3a5f', lineHeight: 21, marginBottom: 6, fontWeight: line.startsWith('Phụ phí phục vụ tour:') ? '700' : '400' }}>{line}</Text>)}
  </View>;
}
