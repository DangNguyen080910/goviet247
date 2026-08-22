// Path: goviet247/apps/rider-mobile/components/GlobalSupportButton.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Linking,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { API_BASE_URL } from "../constants/api";

const BUTTON_SIZE = 64;
const STORAGE_KEY = "support_button_position";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SCREEN_HEIGHT = Dimensions.get("window").height;

function normalizePhoneForZalo(phone: string) {
  let cleaned = String(phone || "").replace(/\D/g, "");

  if (!cleaned) {
    return "";
  }

  if (cleaned.startsWith("0")) {
    cleaned = `84${cleaned.slice(1)}`;
  }

  return cleaned;
}

export default function GlobalSupportButton() {
  const insets = useSafeAreaInsets();

  const [supportPhone, setSupportPhone] = useState("");
  const [showTooltip, setShowTooltip] = useState(true);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  const pan = useRef(
    new Animated.ValueXY({
      x: SCREEN_WIDTH - 92,
      y: SCREEN_HEIGHT - 260,
    }),
  ).current;

  useEffect(() => {
    async function loadSupportPhone() {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/public/system-config`,
        );

        const res = await response.json();

        console.log(
          "[GlobalSupportButton] system config response:",
          JSON.stringify(res),
        );

        const phone = String(res?.data?.supportPhoneRider || "").trim();

        console.log("[GlobalSupportButton] support phone:", phone);

        if (!phone) {
          return;
        }

        setSupportPhone(phone);
      } catch (error) {
        console.warn("[GlobalSupportButton] load config error:", error);
      }
    }

    void loadSupportPhone();
  }, []);

  useEffect(() => {
    async function restorePosition() {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);

        if (!saved) {
          return;
        }

        const parsed = JSON.parse(saved);

        if (typeof parsed?.x === "number" && typeof parsed?.y === "number") {
          pan.setValue({
            x: parsed.x,
            y: parsed.y,
          });
        }
      } catch (error) {
        console.warn("[GlobalSupportButton] restore position error:", error);
      }
    }

    void restorePosition();
  }, [pan]);

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.06,
          duration: 900,
          useNativeDriver: true,
        }),

        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );

    pulseLoop.start();

    return () => {
      pulseLoop.stop();
    };
  }, [pulseAnim]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowTooltip(false);
    }, 4500);

    return () => clearTimeout(timer);
  }, []);

  async function persistPosition(x: number, y: number) {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          x,
          y,
        }),
      );
    } catch (error) {
      console.warn("[GlobalSupportButton] persist position error:", error);
    }
  }

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,

        onMoveShouldSetPanResponder: (_, gestureState) => {
          return Math.abs(gestureState.dx) > 6 || Math.abs(gestureState.dy) > 6;
        },

        onPanResponderGrant: () => {
          pan.extractOffset();
        },

        onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
          useNativeDriver: false,
        }),

        onPanResponderRelease: async () => {
          pan.flattenOffset();

          const currentX = (pan.x as any)._value || 0;

          const currentY = (pan.y as any)._value || 0;

          const snapLeft = currentX < SCREEN_WIDTH / 2;

          const finalX = snapLeft ? 16 : SCREEN_WIDTH - BUTTON_SIZE - 16;

          const minY = insets.top + 80;

          const maxY =
            SCREEN_HEIGHT - BUTTON_SIZE - 120 - Math.max(insets.bottom, 16);

          const finalY = Math.min(Math.max(currentY, minY), maxY);

          Animated.spring(pan, {
            toValue: {
              x: finalX,
              y: finalY,
            },
            useNativeDriver: false,
          }).start();

          await persistPosition(finalX, finalY);
        },
      }),
    [insets.bottom, insets.top, pan],
  );

  async function handleOpenSupport() {
    try {
      const zaloPhone = normalizePhoneForZalo(supportPhone);

      if (!zaloPhone) {
        Alert.alert(
          "Thiếu số hỗ trợ",
          "Hiện chưa có số điện thoại hỗ trợ khách hàng.",
        );

        return;
      }

      const zaloWebUrl = `https://zalo.me/${zaloPhone}`;

      console.log("[GlobalSupportButton] opening zalo:", zaloWebUrl);

      try {
        await Linking.openURL(zaloWebUrl);
        return;
      } catch (_webError) {
        Alert.alert(
          "Không mở được Zalo",
          "Thiết bị hiện không mở được Zalo. Vui lòng gọi hotline để được hỗ trợ nhanh.",
          [
            {
              text: "Đóng",
              style: "cancel",
            },

            {
              text: "Gọi hotline",
              onPress: () => {
                void Linking.openURL(`tel:${supportPhone}`);
              },
            },
          ],
        );
      }
    } catch (error) {
      console.error("[GlobalSupportButton] open zalo error:", error);

      Alert.alert(
        "Không mở được Zalo",
        "Có lỗi xảy ra khi mở Zalo. Vui lòng gọi hotline để được hỗ trợ nhanh.",
        [
          {
            text: "Đóng",
            style: "cancel",
          },

          {
            text: "Gọi hotline",
            onPress: () => {
              void Linking.openURL(`tel:${supportPhone}`);
            },
          },
        ],
      );
    }
  }

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          transform: [
            ...pan.getTranslateTransform(),
            {
              scale: pulseAnim,
            },
          ],
        },
      ]}
      {...panResponder.panHandlers}
    >
      {showTooltip ? (
        <View style={styles.tooltip}>
          <Text style={styles.tooltipText}>Cần hỗ trợ?</Text>
        </View>
      ) : null}

      <Pressable
        onPress={handleOpenSupport}
        style={({ pressed }) => [
          styles.button,
          pressed && {
            opacity: 0.85,
          },
        ]}
      >
        <Ionicons name="chatbubble-ellipses" size={30} color="#FFFFFF" />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    zIndex: 99999,
  },

  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    backgroundColor: "#0068FF",

    alignItems: "center",
    justifyContent: "center",

    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 5,
    },

    elevation: 10,
  },

  tooltip: {
    position: "absolute",
    bottom: 74,
    right: -6,

    backgroundColor: "#111827",

    paddingHorizontal: 12,
    paddingVertical: 8,

    borderRadius: 999,

    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 2,
    },

    elevation: 6,
  },

  tooltipText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});
