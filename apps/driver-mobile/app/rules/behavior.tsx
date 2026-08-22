// Path: goviet247/apps/driver-mobile/app/rules/behavior.tsx

import { useState } from "react";
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
import {
  BEHAVIOR_RULE_GROUPS,
  type RuleSeverity,
} from "../../constants/rulesData";

function getSeverityColors(severity?: RuleSeverity) {
  switch (severity) {
    case "DANGER":
      return {
        backgroundColor: "#FEF2F2",
        borderColor: "#FECACA",
        titleColor: "#B91C1C",
        badgeBackground: "#DC2626",
      };
    case "WARNING":
      return {
        backgroundColor: "#FFF7ED",
        borderColor: "#FED7AA",
        titleColor: "#C2410C",
        badgeBackground: "#F97316",
      };
    case "INFO":
    default:
      return {
        backgroundColor: "#EFF6FF",
        borderColor: "#BFDBFE",
        titleColor: "#1D4ED8",
        badgeBackground: "#2563EB",
      };
  }
}

function getSeverityLabel(severity?: RuleSeverity) {
  switch (severity) {
    case "DANGER":
      return "Nghiêm trọng";
    case "WARNING":
      return "Cần lưu ý";
    case "INFO":
    default:
      return "Hướng dẫn";
  }
}

export default function BehaviorRulesScreen() {
  const [openIds, setOpenIds] = useState<string[]>([
    BEHAVIOR_RULE_GROUPS[0]?.id || "",
  ]);

  const toggleGroup = (id: string) => {
    setOpenIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
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

          <Text style={styles.headerTitle}>Quy tắc ứng xử</Text>

          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.introCard}>
            <Text style={styles.introTitle}>Luật cần nhớ khi chạy app</Text>
            <Text style={styles.introText}>
              Đây là phần quan trọng nhất. Tài xế cần đọc kỹ để tránh các lỗi dễ
              bị nhắc nhở, phạt tiền, tạm ngưng hoặc khoá tài khoản.
            </Text>
          </View>

          {BEHAVIOR_RULE_GROUPS.map((group) => {
            const isOpen = openIds.includes(group.id);
            const colors = getSeverityColors(group.severity);

            return (
              <View
                key={group.id}
                style={[
                  styles.groupCard,
                  {
                    backgroundColor: "#FFFFFF",
                    borderColor: colors.borderColor,
                  },
                ]}
              >
                <TouchableOpacity
                  style={styles.groupHeader}
                  activeOpacity={0.88}
                  onPress={() => toggleGroup(group.id)}
                >
                  <View style={styles.groupHeaderContent}>
                    <View
                      style={[
                        styles.groupBadge,
                        { backgroundColor: colors.badgeBackground },
                      ]}
                    >
                      <Text style={styles.groupBadgeText}>
                        {getSeverityLabel(group.severity)}
                      </Text>
                    </View>

                    <Text
                      style={[styles.groupTitle, { color: colors.titleColor }]}
                    >
                      {group.title}
                    </Text>

                    <Text style={styles.groupSummary}>{group.summary}</Text>
                  </View>

                  <Text style={styles.groupArrow}>{isOpen ? "⌃" : "⌄"}</Text>
                </TouchableOpacity>

                {isOpen ? (
                  <View style={styles.groupBody}>
                    {group.sections.map((section) => (
                      <View key={section.id} style={styles.sectionCard}>
                        <Text style={styles.sectionTitle}>{section.title}</Text>

                        <View style={styles.bulletList}>
                          {section.bullets.map((bullet, index) => {
                            const bulletColors = getSeverityColors(
                              bullet.severity,
                            );

                            return (
                              <View
                                key={`${section.id}-${index}`}
                                style={styles.bulletRow}
                              >
                                <View
                                  style={[
                                    styles.bulletDot,
                                    {
                                      backgroundColor:
                                        bulletColors.badgeBackground,
                                    },
                                  ]}
                                />
                                <Text style={styles.bulletText}>
                                  {bullet.text}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
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
  groupCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 16,
    gap: 12,
  },
  groupHeaderContent: {
    flex: 1,
  },
  groupBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 10,
  },
  groupBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  groupTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 6,
    lineHeight: 24,
  },
  groupSummary: {
    fontSize: 14,
    lineHeight: 22,
    color: "#6B7280",
  },
  groupArrow: {
    fontSize: 22,
    color: "#6B7280",
    marginTop: 2,
  },
  groupBody: {
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    padding: 16,
    gap: 12,
    backgroundColor: "#FAFAFA",
  },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 10,
    lineHeight: 22,
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
    marginTop: 7,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    color: "#4B5563",
  },
});
