// Path: goviet247/apps/driver-mobile/app/rules/index.tsx

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
import { RULE_MENU_ITEMS } from "../../constants/rulesData";

export default function RulesHomeScreen() {
  const handlePress = (key: "OPERATION" | "BEHAVIOR" | "TERMS") => {
    if (key === "OPERATION") {
      router.push("/rules/operation");
      return;
    }

    if (key === "BEHAVIOR") {
      router.push("/rules/behavior");
      return;
    }

    router.push("/rules/terms");
  };

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

          <Text style={styles.headerTitle}>Quy định & quy tắc</Text>

          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.introCard}>
            <Text style={styles.introTitle}>
              Tài liệu dành cho tài xế GoViet247
            </Text>
            <Text style={styles.introText}>
              Vui lòng đọc kỹ để vận hành đúng quy trình, bảo vệ quyền lợi của
              mình và tránh các vi phạm có thể dẫn đến phạt hoặc khoá tài khoản.
            </Text>
          </View>

          <View style={styles.menuList}>
            {RULE_MENU_ITEMS.map((item) => (
              <TouchableOpacity
                key={item.key}
                style={styles.menuCard}
                activeOpacity={0.9}
                onPress={() => handlePress(item.key)}
              >
                <View style={styles.menuCardContent}>
                  <Text style={styles.menuCardTitle}>{item.title}</Text>
                  <Text style={styles.menuCardDescription}>
                    {item.description}
                  </Text>
                </View>

                <Text style={styles.menuArrow}>›</Text>
              </TouchableOpacity>
            ))}
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
    fontSize: 26,
    lineHeight: 26,
    color: "#111827",
    marginTop: -2,
  },
  headerTitle: {
    flex: 1,
    marginLeft: 8,
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 88,
    gap: 16,
  },
  headerSpacer: {
    width: 40,
  },

  introCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  introTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
  },
  introText: {
    fontSize: 14,
    lineHeight: 22,
    color: "#4B5563",
  },
  menuList: {
    gap: 12,
  },
  menuCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  menuCardContent: {
    flex: 1,
  },
  menuCardTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 6,
  },
  menuCardDescription: {
    fontSize: 14,
    lineHeight: 22,
    color: "#6B7280",
  },
  menuArrow: {
    fontSize: 28,
    color: "#9CA3AF",
    marginTop: -2,
  },
});
