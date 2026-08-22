// Path: goviet247/apps/admin-mobile/app/login.tsx
import { router } from "expo-router";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { loginAdmin } from "../services/authApi";
import { setAdminSession } from "../services/storage";
import { registerAdminPushToken } from "../services/adminDeviceApi";

export default function LoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin() {
    if (submitting) return;

    if (!username.trim() || !password.trim()) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập username và password.");
      return;
    }

    try {
      setSubmitting(true);

      const data = await loginAdmin(username.trim(), password);

      await setAdminSession({
        token: data.token,
        user: data.user,
      });

      registerAdminPushToken().catch((error) => {
        console.log("[LoginScreen] register admin push token error:", error);
      });

      router.replace("/home");
    } catch (error: any) {
      Alert.alert(
        "Đăng nhập thất bại",
        error?.message || "Không thể đăng nhập. Vui lòng thử lại.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <Text style={styles.brand}>GoViet247 Admin</Text>
            <Text style={styles.title}>Đăng nhập quản trị</Text>

            <View style={styles.form}>
              <Text style={styles.label}>Username</Text>
              <TextInput
                value={username}
                onChangeText={setUsername}
                placeholder="Nhập username"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!submitting}
                style={styles.input}
                returnKeyType="next"
              />

              <Text style={styles.label}>Password</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Nhập password"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={!submitting}
                style={styles.input}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />

              <Pressable
                style={[styles.button, submitting && styles.buttonDisabled]}
                onPress={handleLogin}
              >
                <Text style={styles.buttonText}>
                  {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f7f8fa",
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 28,
    justifyContent: "center",
  },
  content: {
    width: "100%",
  },
  brand: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1565c0",
    textAlign: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    color: "#222",
    marginBottom: 28,
  },
  form: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d0d7de",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  button: {
    marginTop: 20,
    backgroundColor: "#1565c0",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
