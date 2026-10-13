import { useMemo, useState } from "react";
import { View, Text, Modal, Pressable, TextInput, FlatList, StyleSheet } from "react-native";
import provinces from "../../api/src/data/vietnam-provinces.json";
const normalize = (text: string) => text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").toLowerCase();
export default function OperatingProvincePicker({ value, onChange, disabled = false }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const choices = useMemo(() => provinces.filter(p => normalize(p.name).includes(normalize(search.trim()))).sort((a,b) => a.name.localeCompare(b.name, "vi")), [search]);
  return <View>
    <Text style={styles.label}>Tỉnh/thành thường hoạt động</Text>
    <Pressable disabled={disabled} onPress={() => { setSearch(""); setOpen(true); }} style={styles.input}><Text>{provinces.find(p => p.code === value)?.name || "Chọn tỉnh/thành"} ▾</Text></Pressable>
    <Text style={styles.hint}>Chọn tỉnh/thành anh/chị thường có mặt để nhận chuyến. Anh/chị vẫn có thể nhận chuyến ở các khu vực khác.</Text>
    <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
      <View style={styles.backdrop}><View style={styles.panel}>
        <Text style={styles.label}>Chọn tỉnh/thành thường hoạt động</Text>
        <TextInput style={styles.input} value={search} onChangeText={setSearch} placeholder="Tìm tỉnh/thành" autoCorrect={false} />
        <FlatList data={choices} keyExtractor={p => p.code} keyboardShouldPersistTaps="handled" ListEmptyComponent={<Text>Không tìm thấy tỉnh/thành.</Text>} renderItem={({ item }) => <Pressable style={styles.row} onPress={() => { onChange(item.code); setOpen(false); }}><Text>{item.name}{item.code === value ? " ✓" : ""}</Text></Pressable>} />
        <Pressable style={styles.row} onPress={() => setOpen(false)}><Text style={styles.label}>Đóng</Text></Pressable>
      </View></View>
    </Modal>
  </View>;
}
const styles = StyleSheet.create({ label: { fontSize: 16, fontWeight: "700", marginBottom: 8 }, input: { padding: 14, borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 12, backgroundColor: "white", marginBottom: 8 }, hint: { color: "#64748B", marginBottom: 16, lineHeight: 20 }, backdrop: { flex: 1, justifyContent: "center", backgroundColor: "rgba(0,0,0,0.5)", padding: 20 }, panel: { maxHeight: "80%", padding: 20, borderRadius: 20, backgroundColor: "white" }, row: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#E2E8F0" } });
