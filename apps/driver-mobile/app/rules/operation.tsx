// Path: goviet247/apps/driver-mobile/app/rules/operation.tsx

import { router } from "expo-router";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  StatusBar,
  Platform,
} from "react-native";
import { OPERATION_DOCUMENT } from "../../constants/rulesData";

export default function OperationRulesScreen() {
  const topInset =
    Platform.OS === "android"
      ? Math.max((StatusBar.currentHeight ?? 0) - 6, 8)
      : 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View
          style={[
            styles.header,
            {
              height: 68 + topInset,
              paddingTop: topInset,
            },
          ]}
        >
          <TouchableOpacity
            style={styles.backButton}
            activeOpacity={0.85}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>‹</Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Quy chế hoạt động</Text>

          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroCard}>
            <Text style={styles.heroTitle}>{OPERATION_DOCUMENT.title}</Text>
            <Text style={styles.heroSubtitle}>
              {OPERATION_DOCUMENT.subtitle}
            </Text>
            <Text style={styles.heroIntro}>{OPERATION_DOCUMENT.intro}</Text>
          </View>

          {OPERATION_DOCUMENT.sections.map((section) => (
            <View key={section.id} style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>{section.title}</Text>

              <View style={styles.bulletList}>
                {section.bullets.map((bullet, index) => (
                  <View key={`${section.id}-${index}`} style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.bulletText}>{bullet.text}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}

          <View style={styles.footerNoteCard}>
            <Text style={styles.footerNoteText}>
              Tài liệu này là bản hướng dẫn rút gọn dành cho tài xế GoViet247.
              Khi có thay đổi về chính sách vận hành, công ty có thể cập nhật
              nội dung để phù hợp với thực tế hoạt động.
            </Text>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#EEF2F7",
  },
  container: {
    flex: 1,
    backgroundColor: "#EEF2F7",
  },
  header: {
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  backButtonText: {
    fontSize: 24,
    lineHeight: 24,
    color: "#374151",
    marginTop: -2,
    fontWeight: "700",
  },
  headerTitle: {
    flex: 1,
    marginLeft: 10,
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
  },
  headerSpacer: {
    width: 48,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 96,
    gap: 14,
  },
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#F97316",
    marginBottom: 10,
  },
  heroIntro: {
    fontSize: 14,
    lineHeight: 22,
    color: "#4B5563",
  },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 12,
    lineHeight: 24,
  },
  bulletList: {
    gap: 10,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  bulletDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#F97316",
    marginTop: 7,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    color: "#4B5563",
  },
  footerNoteCard: {
    backgroundColor: "#FFF7ED",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#FED7AA",
  },
  footerNoteText: {
    fontSize: 14,
    lineHeight: 22,
    color: "#9A3412",
    fontWeight: "600",
  },
});
