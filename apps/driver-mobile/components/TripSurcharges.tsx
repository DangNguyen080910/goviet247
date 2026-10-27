import React from 'react';
import { View, Text } from 'react-native';
import { driverSurchargeLines } from '../../api/src/shared/driverSurcharges.js';
export default function TripSurcharges({ trip }: { trip: any }) {
  const lines = driverSurchargeLines(trip);
  if (!lines.length) return null;
  return <View style={{ marginVertical: 8 }}>{lines.map((line: string) => <Text key={line} style={{ color: '#475569', fontSize: 13, fontWeight: '600', lineHeight: 20 }}>{line}</Text>)}</View>;
}
