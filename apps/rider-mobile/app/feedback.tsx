// Path: goviet247/apps/rider-mobile/app/feedback.tsx
import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AppBrandHeader from "../components/AppBrandHeader";
import { submitFeedback } from "../services/feedbackApi";

export default function RiderFeedbackScreen() {
  const params = useLocalSearchParams<{ tripId?: string }>();
  const tripId = String(params?.tripId || "").trim();

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    const normalizedMessage = String(message || "").trim();

    if (normalizedMessage.length < 5) {
      if (Platform.OS === "web") {
        window.alert("Nội dung góp ý phải có ít nhất 5 ký tự.");
        return;
      }

      Alert.alert("Thiếu nội dung", "Nội dung góp ý phải có ít nhất 5 ký tự.");
      return;
    }

    try {
      setLoading(true);

      await submitFeedback({
        message: normalizedMessage,
        tripId: tripId || null,
      });

      setMessage("");

      if (Platform.OS === "web") {
        window.alert("Cảm ơn bạn đã gửi góp ý.");
        router.back();
        return;
      }

      Alert.alert("Thành công", "Cảm ơn bạn đã gửi góp ý.", [
        {
          text: "OK",
          onPress: () => {
            router.back();
          },
        },
      ]);
    } catch (error: any) {
      console.error("submit feedback error:", error);

      if (Platform.OS === "web") {
        window.alert(error?.message || "Không thể gửi góp ý lúc này.");
        return;
      }

      Alert.alert("Lỗi", error?.message || "Không thể gửi góp ý lúc này.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <AppBrandHeader
          title="Góp ý"
          subtitle="Chia sẻ ý kiến của bạn để GoViet247 phục vụ tốt hơn."
        />

        {tripId ? (
          <View style={styles.tripBox}>
            <Text style={styles.tripText}>
              Bạn đang góp ý cho chuyến #{tripId.slice(-8).toUpperCase()}
            </Text>
          </View>
        ) : null}

        <TextInput
          style={styles.input}
          placeholder="Nhập nội dung góp ý..."
          placeholderTextColor="#9CA3AF"
          multiline
          value={message}
          onChangeText={setMessage}
          editable={!loading}
          textAlignVertical="top"
        />

        <Pressable
          style={[
            styles.submitButton,
            loading ? styles.submitButtonDisabled : null,
          ]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitText}>Gửi góp ý</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F4F7FB",
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  tripBox: {
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FDBA74",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  tripText: {
    color: "#C2410C",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 22,
  },
  input: {
    minHeight: 140,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: "#111827",
    marginBottom: 14,
  },
  submitButton: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: "#F97316",
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
});
