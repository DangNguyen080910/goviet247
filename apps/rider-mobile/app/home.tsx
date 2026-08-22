// Path: goviet247/apps/rider-mobile/app/home.tsx
import { router } from "expo-router";
import {
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useEffect, useMemo, useState } from "react";
import AppBrandHeader from "../components/AppBrandHeader";
import { getRiderPublicSystemConfig } from "../services/tripApi";

const fallbackHomeBackground = require("../assets/images/home-hero1.png");

export default function RiderHomeScreen() {
  const insets = useSafeAreaInsets();
  const [backgroundUrl, setBackgroundUrl] = useState("");

  useEffect(() => {
    async function loadConfig() {
      try {
        const data = await getRiderPublicSystemConfig();
        setBackgroundUrl(
          String(data?.riderMobileBackgroundImageUrl || "").trim(),
        );
      } catch (err) {
        console.warn("load rider mobile background error", err);
      }
    }

    void loadConfig();
  }, []);

  const backgroundSource = useMemo(() => {
    if (backgroundUrl) {
      return { uri: backgroundUrl };
    }

    return fallbackHomeBackground;
  }, [backgroundUrl]);

  return (
    <SafeAreaView edges={[]} style={styles.safeArea}>
      <ImageBackground
        source={backgroundSource}
        style={styles.background}
        imageStyle={styles.backgroundImage}
        resizeMode="cover"
      >
        <View style={styles.overlay} />

        <View
          style={[
            styles.content,
            {
              paddingTop: Math.max(insets.top, 10),
              paddingBottom: 12,
            },
          ]}
        >
          <View style={styles.heroCard}>
            <AppBrandHeader
              title="Sẵn sàng cho chuyến đi mới ✨"
              subtitle="Đi đường dài, đi chơi hay đi công việc, GoViet247 luôn sẵn sàng cùng bạn."
            />

            <Pressable
              style={styles.primaryButton}
              onPress={() => {
                router.navigate("/booking");
              }}
            >
              <Text style={styles.primaryButtonText}>🚗 Đặt xe ngay</Text>
            </Pressable>
          </View>

          <View style={styles.bottomContent}>
            <View style={styles.highlightCard}>
              <Text style={styles.highlightTitle}>Đi đường dài thật thoải mái</Text>
              <Text style={styles.highlightText}>
                Đặt xe nhanh, giá rõ ràng, theo dõi chuyến dễ dàng và luôn chủ
                động cho mọi hành trình của bạn.
              </Text>
            </View>
          </View>
        </View>
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F4F7FB",
  },
  background: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  backgroundImage: {
    opacity: 0.98,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.32)",
  },
  content: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  heroCard: {
    backgroundColor: "rgba(255,255,255,0.94)",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  primaryButton: {
    backgroundColor: "#F97316",
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
  bottomContent: {
    gap: 12,
  },
  highlightCard: {
    backgroundColor: "rgba(17, 24, 39, 0.42)",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  highlightTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 6,
  },
  highlightText: {
    fontSize: 14,
    lineHeight: 22,
    color: "rgba(255,255,255,0.9)",
  },
});
