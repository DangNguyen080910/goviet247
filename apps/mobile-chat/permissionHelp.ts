import {Alert, Linking} from 'react-native';
export function showPermissionSettings(title: string, message: string) {
  Alert.alert(title, message, [
    {text:'Để sau',style:'cancel'},
    {text:'Mở Cài đặt',onPress:()=>{void Linking.openSettings().catch(()=>Alert.alert('Mở Cài đặt','Vui lòng mở Cài đặt trên điện thoại, chọn GoViet247 và bật quyền cần dùng.'));}}
  ]);
}
