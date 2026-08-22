// Path: goviet247/apps/driver-mobile/app/rules/terms.tsx

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
import { TERMS_DOCUMENT } from "../../constants/rulesData";

export default function TermsRulesScreen() {
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

          <Text style={styles.headerTitle}>Điều khoản sử dụng</Text>

          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroCard}>
            <Text style={styles.heroTitle}>{TERMS_DOCUMENT.title}</Text>
            <Text style={styles.heroSubtitle}>{TERMS_DOCUMENT.subtitle}</Text>
            <Text style={styles.heroIntro}>{TERMS_DOCUMENT.intro}</Text>
          </View>

          {TERMS_DOCUMENT.sections.map((section) => (
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
              Việc tiếp tục sử dụng ứng dụng được hiểu là tài xế đồng ý với các
              điều kiện sử dụng và các cập nhật hợp lý từ GoViet247 trong từng
              giai đoạn vận hành.
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
    color: "#2563EB",
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
    backgroundColor: "#2563EB",
    marginTop: 7,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    color: "#4B5563",
  },
  footerNoteCard: {
    backgroundColor: "#EFF6FF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  footerNoteText: {
    fontSize: 14,
    lineHeight: 22,
    color: "#1D4ED8",
    fontWeight: "600",
  },
});
