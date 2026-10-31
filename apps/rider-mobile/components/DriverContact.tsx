import { Alert, Linking, Pressable, Text, View } from "react-native";
import { hasActiveTripContact, phoneCallUrl } from "../../api/src/shared/tripContact.js";
export default function DriverContact({ trip }: { trip: {status?: string; driverContact?: {name?: string | null; phone?: string | null} | null} }) {
  const contact = trip.driverContact;
  if (!hasActiveTripContact(trip.status) || !contact) return null;
  const url = phoneCallUrl(contact.phone);
  async function call() {
    if (!url) return;
    try { await Linking.openURL(url); }
    catch { Alert.alert("Không mở được cuộc gọi", `Anh/chị có thể gọi trực tiếp số ${contact?.phone}.`); }
  }
  return <View style={{padding:12, marginVertical:10, borderRadius:10, backgroundColor:"#eff6ff", gap:8}}>
    <Text style={{fontWeight:"700", color:"#1e3a5f"}}>Tài xế: {contact.name || "Tài xế"}</Text>
    {!!contact.phone && <Text selectable style={{color:"#1e3a5f"}}>Số điện thoại: {contact.phone}</Text>}
    {!!url && <Pressable accessibilityRole="button" accessibilityLabel={`Gọi tài xế ${contact.name || ""}`} onPress={call} style={{alignSelf:"flex-start", backgroundColor:"#1976d2", borderRadius:8, padding:10}}><Text style={{color:"white", fontWeight:"700"}}>📞 Gọi tài xế</Text></Pressable>}
  </View>;
}
