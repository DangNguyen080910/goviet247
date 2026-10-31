import { View, Text } from 'react-native';
import { tripRoutePoints } from '../../api/src/shared/tripRoute.js';
export default function TripRoute({ trip, masked = false }: { trip: any; masked?: boolean }) {
  return <View style={{ marginVertical: 10, gap: 10 }}>
    {tripRoutePoints(trip, { masked }).map((point: {address: string; label: string}, index: number) => <View key={index} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <Text style={{ color: point.label === 'Quay về điểm đón' ? '#ea580c' : '#2563eb', fontWeight: '800', paddingTop: 2 }}>{index + 1}.</Text>
      <View style={{ flex: 1, minWidth: 0 }}><Text style={{ color: '#64748b', fontSize: 12, fontWeight: '700', marginBottom: 3 }}>{point.label}</Text><Text style={{ color: '#111827', fontSize: 15, fontWeight: '600', lineHeight: 23 }}>{point.address}</Text></View>
    </View>)}
  </View>;
}
