import { AppState, NativeModules, Platform } from 'react-native';
import Constants from 'expo-constants';
let started = false;
let syncing = false;
// SDK owns first-launch/install deduplication. Never synthesize an install event.
export async function syncMetaAds() {
  if (syncing || Platform.OS === 'web' || !Constants.expoConfig?.extra?.metaAdsEnabled || !NativeModules.FBSettings || AppState.currentState !== 'active') return;
  syncing = true;
  try {
    const { Settings } = await import('react-native-fbsdk-next');
    let allowed = true;
    if (Platform.OS === 'ios') {
      const { getTrackingPermissionsAsync, requestTrackingPermissionsAsync } = await import('expo-tracking-transparency');
      let permission = await getTrackingPermissionsAsync();
      if (permission.status === 'undetermined') permission = await requestTrackingPermissionsAsync();
      allowed = permission.status === 'granted';
      await Settings.setAdvertiserTrackingEnabled(allowed);
    }
    Settings.setAdvertiserIDCollectionEnabled(allowed);
    // Consent-denied iOS still uses SDK privacy-preserving aggregate measurement.
    Settings.setAutoLogAppEventsEnabled(true);
    if (!started) { Settings.initializeSDK(); started = true; }
  } catch (error) { console.warn('[Meta Ads] SDK initialization failed', error); }
  finally { syncing = false; }
}
export function startMetaAds() {
  void syncMetaAds();
  const subscription = AppState.addEventListener('change', state => { if (state === 'active') void syncMetaAds(); });
  return () => subscription.remove();
}
