import { useCallback, useEffect, useRef } from 'react';
import { InteractionManager, Platform } from 'react-native';
import { router } from 'expo-router';

// Never push a route underneath an open native Modal.
// iOS waits for onDismiss; Android waits for the invisible modal commit.
export function useTripChatNavigation(closeDetail: () => void | boolean | Promise<void | boolean>) {
  const pending = useRef('');
  const task = useRef<ReturnType<typeof InteractionManager.runAfterInteractions> | null>(null);
  const frames = useRef<number[]>([]);
  const onChatDetailDismiss = useCallback(() => {
    const tripId = pending.current;
    pending.current = '';
    if (tripId) router.push(`/trip-chat?tripId=${encodeURIComponent(tripId)}` as any);
  }, []);
  const openChatFromDetail = useCallback(async (tripId: string) => {
    if (!tripId || pending.current) return;
    pending.current = tripId;
    try {if(await closeDetail()===false){pending.current="";return;}}catch{pending.current="";return;}
    if (Platform.OS !== 'ios') {
      task.current = InteractionManager.runAfterInteractions(() => {
        frames.current.push(requestAnimationFrame(() => {
          frames.current.push(requestAnimationFrame(onChatDetailDismiss));
        }));
      });
    }
  }, [closeDetail, onChatDetailDismiss]);
  useEffect(() => () => {
    pending.current = '';
    task.current?.cancel();
    frames.current.forEach(cancelAnimationFrame);
  }, []);
  return {openChatFromDetail, onChatDetailDismiss};
}
