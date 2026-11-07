import { AppState } from 'react-native';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { createChatAlertGate } from '../api/src/shared/chatAlerts.js';
const claim = createChatAlertGate();
let recordingActive = false;
let callActive = false;
export function setChatCallActive(value: boolean) { callActive = value; }
export function setChatRecordingActive(value: boolean) { recordingActive = value; }
export async function chatPushShouldPlaySound(data: Record<string, unknown>) {
  if (!['TRIP_CHAT','TRIP_CALL_MISSED'].includes(String(data?.type))) return true;
  const messageId = String(data.messageId || '');
  if (AppState.currentState === 'active') {
    // Push and polling share one gate: one short sound and haptic per message.
    await playChatAlert(messageId);
    return false;
  }
  return claim(messageId);
}
export async function playChatAlert(messageId: string) {
  if (AppState.currentState !== 'active' || recordingActive || callActive || !claim(messageId)) return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  let sound: Audio.Sound | undefined;
  try {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, shouldDuckAndroid: true });
    if (recordingActive || callActive || AppState.currentState !== 'active') return;
    const result = await Audio.Sound.createAsync(require('./assets/chat_notice.wav'), { shouldPlay: true, volume: 0.75 });
    sound = result.sound;
    if (recordingActive || callActive) { await sound.unloadAsync(); return; }
    sound.setOnPlaybackStatusUpdate(status => { if (status.isLoaded && status.didJustFinish) void sound?.unloadAsync().catch(() => {}); });
  } catch { await sound?.unloadAsync().catch(() => {}); }
}
