import * as Notifications from 'expo-notifications';
import {Alert, Linking, Platform} from 'react-native';
export function showPermissionSettings(title: string, message: string) {
  Alert.alert(title, message, [
    {text:'Để sau',style:'cancel'},
    {text:'Mở Cài đặt',onPress:()=>{void Linking.openSettings().catch(()=>Alert.alert('Mở Cài đặt','Vui lòng mở Cài đặt trên điện thoại, chọn GoViet247 và bật quyền cần dùng.'));}}
  ]);
}

export async function requestNotificationPermission() {
  if (Platform.OS === 'web') return false;
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && permission.canAskAgain) {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Mặc định',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#F97316',
        sound: 'default',
        enableVibrate: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }
    permission = await Notifications.requestPermissionsAsync();
  }
  if (!permission.granted && !permission.canAskAgain) {
    showPermissionSettings('Thông báo', 'Bật quyền Thông báo cho GoViet247 trong Cài đặt.');
  }
  return permission.granted;
}
