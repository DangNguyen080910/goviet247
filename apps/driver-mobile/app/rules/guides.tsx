import { useState } from "react";
import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DRIVER_GUIDES } from "../../constants/driverGuides";

export default function DriverGuidesScreen() {
  const [open, setOpen] = useState<string | null>(null);
  return <SafeAreaView style={styles.safe}>
    <View style={styles.header}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Quay lại" onPress={() => router.back()} style={styles.back}><Text style={styles.arrow}>‹</Text></TouchableOpacity>
      <Text style={styles.title}>Hướng dẫn & lưu ý</Text>
    </View>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.intro}>
        <Text style={styles.introTitle}>Hướng dẫn nhận chuyến & lưu ý</Text>
        <Text style={styles.summary}>Các hướng dẫn được lưu để tài xế dễ tra cứu. Chọn từng mục để đọc nội dung.</Text>
      </View>
      {DRIVER_GUIDES.map(article => <View key={article.id} style={styles.card}>
        <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: open === article.id }} style={styles.articleHeader} onPress={() => setOpen(open === article.id ? null : article.id)}>
          <View style={styles.heading}><Text style={styles.articleTitle}>{article.title}</Text><Text style={styles.summary}>{article.summary}</Text></View>
          <Text style={styles.chevron}>{open === article.id ? '−' : '+'}</Text>
        </TouchableOpacity>
        {open === article.id && <View style={styles.body}>{article.sections.map(section => <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {section.paragraphs.map((paragraph, index) => <Text selectable key={index} style={styles.paragraph}>{paragraph}</Text>)}
        </View>)}</View>}
      </View>)}
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex:1, backgroundColor:'#EEF2F7' },
  header: { flexDirection:'row', alignItems:'center', backgroundColor:'white', paddingHorizontal:12, minHeight:64 },
  back: { padding:12 }, arrow: { fontSize:32, color:'#111827' },
  title: { flex:1, fontSize:21, fontWeight:'800', color:'#111827', paddingVertical:12 },
  content: { padding:16, paddingBottom:80, gap:12 },
  intro: { backgroundColor:'#EFF6FF', borderRadius:16, padding:18 },
  introTitle: { fontSize:19, fontWeight:'800', color:'#1D4ED8', marginBottom:8 },
  card: { backgroundColor:'white', borderRadius:16, overflow:'hidden' },
  articleHeader: { flexDirection:'row', padding:18, alignItems:'center', gap:12 },
  heading: { flex:1 }, articleTitle: { fontSize:17, fontWeight:'700', color:'#111827', marginBottom:6 },
  summary: { fontSize:14, lineHeight:22, color:'#4B5563' },
  chevron: { fontSize:25, color:'#2563EB' }, body: { padding:18, paddingTop:0, gap:18 },
  section: { gap:10 }, sectionTitle: { fontSize:16, lineHeight:24, fontWeight:'700', color:'#1D4ED8' },
  paragraph: { fontSize:15, lineHeight:25, color:'#374151' },
});
