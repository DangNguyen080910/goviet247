import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Keyboard, Linking, PanResponder, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from '../constants/api';
import { ChatInboxBadge } from '../services/tripChat';
import { CONTACT_DOCK_WIDTH, CONTACT_DOCK_HEIGHT, constrainContactDock } from '../utils/contactDock';
const BUTTON_SIZE = 64;
const STORAGE_KEY = 'rider_contact_dock_position_v1';
function normalizePhoneForZalo(phone: string) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.startsWith('0') ? `84${digits.slice(1)}` : digits;
}
export default function GlobalSupportButton() {
  const insets = useSafeAreaInsets(),
    {
      width,
      height
    } = useWindowDimensions(),
    path = usePathname();
  const [supportPhone, setSupportPhone] = useState(''),
    [showTooltip, setShowTooltip] = useState(true),
    [keyboardOpen, setKeyboardOpen] = useState(false);
  const [dockHeight, setDockHeight] = useState(CONTACT_DOCK_HEIGHT);
  const initial = constrainContactDock(null, width, height, insets.top, insets.bottom);
  const [position, setPosition] = useState(initial);
  const point = useRef(initial),
    origin = useRef(initial),
    moved = useRef(false);
  const bounds = useRef({
    width,
    height,
    top: insets.top,
    bottom: insets.bottom,
    dockHeight
  });
  bounds.current = {
    width,
    height,
    top: insets.top,
    bottom: insets.bottom,
    dockHeight
  };
  const pan = useRef(new Animated.ValueXY(initial)).current;
  const clamp = (value: any, snap = false) => {
    const b = bounds.current;
    return constrainContactDock(value, b.width, b.height, b.top, b.bottom, snap, b.dockHeight);
  };
  useEffect(() => {
    let alive = true;
    void fetch(`${API_BASE_URL}/api/public/system-config`).then(r => r.json()).then(r => {
      if (alive) setSupportPhone(String(r?.data?.supportPhoneRider || '').trim());
    }).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        const legacy = saved ? null : await AsyncStorage.getItem('support_button_position');
        let next = saved ? JSON.parse(saved) : null;
        if (!next && legacy) {
          const old = JSON.parse(legacy);
          next = {
            x: old.x - (CONTACT_DOCK_WIDTH - BUTTON_SIZE),
            y: old.y - 60
          };
        }
        if (alive && !moved.current) {
          const value = clamp(next, true);
          point.current = value;
          setPosition(value);
          pan.setValue(value);
        }
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, [pan]);
  useEffect(() => {
    const next = clamp(point.current, true);
    point.current = next;
    setPosition(next);
    pan.setValue(next);
  }, [width, height, insets.top, insets.bottom, dockHeight, pan]);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    const timer = setTimeout(() => setShowTooltip(false), 4500);
    return () => {
      show.remove();
      hide.remove();
      clearTimeout(timer);
    };
  }, []);
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, g) => Math.hypot(g.dx, g.dy) > 6,
    onMoveShouldSetPanResponderCapture: (_, g) => Math.hypot(g.dx, g.dy) > 6,
    onPanResponderGrant: () => {
      moved.current = true;
      origin.current = point.current;
      setShowTooltip(false);
    },
    onPanResponderMove: (_, g) => {
      const next = clamp({
        x: origin.current.x + g.dx,
        y: origin.current.y + g.dy
      });
      point.current = next;
      pan.setValue(next);
    },
    onPanResponderRelease: () => {
      const next = clamp(point.current, true);
      point.current = next;
      setPosition(next);
      pan.setValue(next);
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
    },
    onPanResponderTerminate: () => {
      const next = clamp(point.current, true);
      point.current = next;
      setPosition(next);
      pan.setValue(next);
    },
    onPanResponderTerminationRequest: () => false
  }), [pan]);
  async function handleOpenSupport() {
    try {
      const zaloPhone = normalizePhoneForZalo(supportPhone);
      if (!zaloPhone) {
        Alert.alert("Thiếu số hỗ trợ", "Hiện chưa có số điện thoại hỗ trợ khách hàng.");
        return;
      }
      const zaloWebUrl = `https://zalo.me/${zaloPhone}`;
      console.log("[GlobalSupportButton] opening zalo:", zaloWebUrl);
      try {
        await Linking.openURL(zaloWebUrl);
        return;
      } catch (_webError) {
        Alert.alert("Không mở được Zalo", "Thiết bị hiện không mở được Zalo. Vui lòng gọi hotline để được hỗ trợ nhanh.", [{
          text: "Đóng",
          style: "cancel"
        }, {
          text: "Gọi hotline",
          onPress: () => {
            void Linking.openURL(`tel:${supportPhone}`);
          }
        }]);
      }
    } catch (error) {
      console.error("[GlobalSupportButton] open zalo error:", error);
      Alert.alert("Không mở được Zalo", "Có lỗi xảy ra khi mở Zalo. Vui lòng gọi hotline để được hỗ trợ nhanh.", [{
        text: "Đóng",
        style: "cancel"
      }, {
        text: "Gọi hotline",
        onPress: () => {
          void Linking.openURL(`tel:${supportPhone}`);
        }
      }]);
    }
  }
  if (keyboardOpen || path.includes('trip-chat')) return null;
  const onLeft = position.x + CONTACT_DOCK_WIDTH / 2 < width / 2;
  return <Animated.View pointerEvents="box-none" onLayout={event => {const next=event.nativeEvent.layout.height;if(next>0 && Math.abs(next-dockHeight)>1)setDockHeight(next);}} style={[styles.wrapper, {
    transform: pan.getTranslateTransform(),
    alignItems: onLeft ? 'flex-start' : 'flex-end'
  }]} {...responder.panHandlers}>
  <View pointerEvents="box-none" style={{
      width: CONTACT_DOCK_WIDTH,
      minHeight: 48,
      marginBottom: 12
    }}><ChatInboxBadge inline /></View>
  <View>
   {showTooltip && <View pointerEvents="none" style={[styles.tooltip, onLeft ? {
        left: BUTTON_SIZE + 10
      } : {
        right: BUTTON_SIZE + 10
      }]}><Text style={styles.tooltipText}>Bạn cần hỗ trợ?</Text></View>}
   <Pressable accessibilityRole="button" accessibilityLabel="Hỗ trợ GoViet247, có thể kéo để di chuyển" onPress={handleOpenSupport} style={({
        pressed
      }) => [styles.button, {
        opacity: pressed ? 0.85 : 1
      }]}><Ionicons name="headset-outline" size={25} color="white" /><Text maxFontSizeMultiplier={1.3} style={{color:"white",fontSize:11,lineHeight:14,fontWeight:"800"}}>Hỗ trợ</Text></Pressable>
  </View>
 </Animated.View>;
}
const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: CONTACT_DOCK_WIDTH,
    zIndex: 1000
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: 32,
    backgroundColor: '#0068ff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 4
    }
  },
  tooltip: {
    position: 'absolute',
    bottom: 12,
    backgroundColor: '#111827',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 120
  },
  tooltipText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700'
  }
});
