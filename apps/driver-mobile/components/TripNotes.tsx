import { Text, View } from "react-native";
import { driverTripNotes } from "../utils/tripPresentation";
import TripDispatcherNote from "./TripDispatcherNote";

export default function TripNotes({ trip }: { trip: { dispatcherNote?: string | null; note?: string | null } }) {
  return <>{driverTripNotes(trip).map(note => note.kind === "dispatcher"
    ? <TripDispatcherNote key={note.kind} note={note.text} />
    : <View key={note.kind} style={{ padding: 12, marginVertical: 10, backgroundColor: "#f3f4f6", borderRadius: 8 }}>
      <Text style={{ fontWeight: "800", color: "#374151", marginBottom: 5 }}>{note.label}</Text>
      <Text style={{ color: "#374151", fontSize: 14, lineHeight: 22 }}>{note.text}</Text>
    </View>)}</>;
}
