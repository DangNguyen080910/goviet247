import { configureChat } from '../../mobile-chat/TripChat';
import { API_BASE_URL } from '../constants/api';
import { getDriverToken } from './storage';
configureChat({base:API_BASE_URL,getToken:getDriverToken,role:'DRIVER'});
export { default, ChatInboxBadge, TripChatButton, isChatVisible } from '../../mobile-chat/TripChat';

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
if (Platform.OS === 'android') {
  void Notifications.setNotificationChannelAsync('trip_chat_default_v1',{name:'Tin nhắn chuyến',importance:Notifications.AndroidImportance.HIGH,sound:'default',enableVibrate:true,lockscreenVisibility:Notifications.AndroidNotificationVisibility.PRIVATE}).catch(()=>{});
  void Notifications.setNotificationChannelAsync('trip_chat_v1',{name:'Tin nhắn khách và hỗ trợ',importance:Notifications.AndroidImportance.HIGH,sound:'new_trip.wav',enableVibrate:true,vibrationPattern:[0,400,200,400],lockscreenVisibility:Notifications.AndroidNotificationVisibility.PRIVATE}).catch(()=>{});
}
