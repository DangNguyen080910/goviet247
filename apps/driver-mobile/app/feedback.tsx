// Path: goviet247/apps/driver-mobile/app/feedback.tsx
import { useMemo, useRef, useState } from "react";
import { router } from "expo-router";
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import Toast from "react-native-toast-message";
import { createDriverMenuFeedback } from "../services/feedbackApi";

export default function DriverFeedbackScreen() {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitTouched, setSubmitTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const scrollViewRef = useRef<ScrollView | null>(null);

  const topInset =
    Platform.OS === "android"
      ? Math.max((StatusBar.currentHeight ?? 0) - 6, 8)
      : 0;

  const subjectError = useMemo(() => {
    if (!submitTouched) return "";
    if (!subject.trim()) return "Vui lòng nhập chủ đề góp ý.";
    if (subject.trim().length < 3) return "Chủ đề phải có ít nhất 3 ký tự.";
    return "";
  }, [subject, submitTouched]);

  const messageError = useMemo(() => {
    if (!submitTouched) return "";
    if (!message.trim()) return "Vui lòng nhập nội dung góp ý.";
    if (message.trim().length < 5)
      return "Nội dung góp ý phải có ít nhất 5 ký tự.";
    return "";
  }, [message, submitTouched]);

  const isFormValid = subject.trim().length >= 3 && message.trim().length >= 5;

  const handleGoBack = () => {
    router.back();
  };

  const handleSubmit = async () => {
    setSubmitTouched(true);

    if (!isFormValid || submitting) {
      return;
    }

    try {
      setSubmitting(true);

      await createDriverMenuFeedback({
        subject,
        message,
      });

      setSubject("");
      setMessage("");
      setSubmitTouched(false);

      Toast.show({
        type: "success",
        text1: "Gửi góp ý thành công",
        text2: "Admin GoViet247 sẽ tiếp nhận và xử lý sớm.",
      });
    } catch (error: any) {
      Toast.show({
        type: "error",
        text1: "Không thể gửi góp ý",
        text2: error?.message || "Vui lòng thử lại sau.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 16 : 24}
      >
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
              style={styles.headerBackButton}
              activeOpacity={0.85}
              onPress={handleGoBack}
            >
              <Text style={styles.headerBackIcon}>‹</Text>
            </TouchableOpacity>

            <Text style={styles.headerTitle}>Góp ý</Text>

            <View style={styles.headerRightSpace} />
          </View>

          <ScrollView
            ref={scrollViewRef}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.heroCard}>
              <Text style={styles.heroIcon}>💬</Text>
              <Text style={styles.heroTitle}>Góp ý với GoViet247</Text>
              <Text style={styles.heroText}>
                Góp ý của bạn sẽ được gửi tới admin GoViet247 để xem và xử lý.
              </Text>
            </View>

            <View style={styles.formCard}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Chủ đề</Text>
                <TextInput
                  value={subject}
                  onChangeText={setSubject}
                  placeholder="Ví dụ: Góp ý về..."
                  placeholderTextColor="#9CA3AF"
                  style={[
                    styles.textInput,
                    !!subjectError && styles.textInputError,
                  ]}
                  editable={!submitting}
                  maxLength={120}
                />
                {!!subjectError ? (
                  <Text style={styles.errorText}>{subjectError}</Text>
                ) : (
                  <Text style={styles.helperText}>
                    Nhập ngắn gọn để admin dễ nhận diện góp ý.
                  </Text>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nội dung góp ý</Text>
                <TextInput
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Nhập nội dung góp ý của bạn..."
                  placeholderTextColor="#9CA3AF"
                  style={[
                    styles.textArea,
                    !!messageError && styles.textInputError,
                  ]}
                  editable={!submitting}
                  multiline
                  textAlignVertical="top"
                  maxLength={2000}
                  onFocus={() => {
                    setTimeout(() => {
                      scrollViewRef.current?.scrollToEnd({ animated: true });
                    }, 180);
                  }}
                />
                {!!messageError ? (
                  <Text style={styles.errorText}>{messageError}</Text>
                ) : (
                  <Text style={styles.helperText}>
                    Mô tả càng rõ thì đội ngũ xử lý càng nhanh.
                  </Text>
                )}
              </View>

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  (!isFormValid || submitting) && styles.submitButtonDisabled,
                ]}
                activeOpacity={0.85}
                onPress={handleSubmit}
                disabled={!isFormValid || submitting}
              >
                {submitting ? (
                  <View style={styles.submitLoadingRow}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.submitButtonText}>Đang gửi...</Text>
                  </View>
                ) : (
                  <Text style={styles.submitButtonText}>Gửi góp ý</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: "#EEF2F7",
  },
  container: {
    flex: 1,
    backgroundColor: "#EEF2F7",
  },
  header: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerBackButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
  },
  headerRightSpace: {
    width: 48,
    height: 48,
  },
  headerBackIcon: {
    fontSize: 24,
    lineHeight: 24,
    color: "#111827",
    marginTop: -2,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 88,
    gap: 14,
  },
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 22,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  heroIcon: {
    fontSize: 34,
    marginBottom: 10,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
  },
  heroText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 22,
    color: "#6B7280",
    textAlign: "center",
  },
  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 8,
    fontSize: 15,
    fontWeight: "700",
    color: "#374151",
  },
  textInput: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 15,
    color: "#111827",
    backgroundColor: "#FFFFFF",
  },
  textArea: {
    minHeight: 150,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: "#111827",
    backgroundColor: "#FFFFFF",
  },
  textInputError: {
    borderColor: "#DC2626",
  },
  helperText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    color: "#9CA3AF",
  },
  errorText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    color: "#DC2626",
    fontWeight: "600",
  },
  submitButton: {
    marginTop: 4,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: "#F97316",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  submitLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
});
