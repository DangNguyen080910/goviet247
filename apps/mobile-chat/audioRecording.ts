import {showPermissionSettings} from './permissionHelp';
import { AppState } from 'react-native';
import { Audio } from 'expo-av';

const pause = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
// Permission dialogs can resolve before iOS has foregrounded its audio module.
export async function waitForRecordingForeground(isCurrent: () => boolean) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (!isCurrent()) throw new Error('Đã rời hội thoại. Vui lòng mở lại để ghi âm.');
    if (AppState.currentState === 'active') {
      await pause(300);
      if (AppState.currentState === 'active' && isCurrent()) return;
    } else await pause(100);
  }
  throw new Error('Vui lòng mở lại GoViet247 rồi bấm Ghi âm.');
}
export async function createChatRecording(isCurrent: () => boolean) {
  const permission = await Audio.requestPermissionsAsync();
  if (!permission.granted) {
    showPermissionSettings('Cho phép dùng micro','Bật Micro cho GoViet247 để ghi âm và gửi tin nhắn thoại.');
    throw new Error('Chưa có quyền micro. Bấm Mở Cài đặt để bật.');
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    await waitForRecordingForeground(isCurrent);
    const recording = new Audio.Recording();
    try {
      await Audio.setIsEnabledAsync(true);
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true, staysActiveInBackground: false, shouldDuckAndroid: true });
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      if (!isCurrent() || AppState.currentState !== 'active') throw new Error('Vui lòng giữ app mở khi ghi âm.');
      await recording.startAsync();
      return recording;
    } catch (error: any) {
      await recording.stopAndUnloadAsync().catch(() => {});
      const transient = /background|audio session.*activat/i.test(error?.message || '');
      if (attempt === 0 && transient && isCurrent()) { await pause(400); continue; }
      throw new Error(transient ? 'Micro chưa sẵn sàng. Vui lòng giữ app mở và bấm Ghi âm lại.' : error?.message || 'Không mở được micro. Vui lòng thử lại.');
    }
  }
  throw new Error('Không mở được micro. Vui lòng thử lại.');
}
