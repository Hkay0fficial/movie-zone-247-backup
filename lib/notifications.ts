import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Detect if we're in Expo Go on Android where SDK 53+ crashes on expo-notifications
const isExpoGo = Constants.appOwnership === 'expo';
const isAndroid = Platform.OS === 'android';
const shouldSkip = isExpoGo && isAndroid;

// Gracefully handle notifications module
let Notifications: any = null;
if (!shouldSkip) {
  try {
    // Only require/import when not in Expo Go on Android
    Notifications = require('expo-notifications');
  } catch (e) {
    console.error('Failed to load expo-notifications:', e);
  }
}

export const initNotifications = () => {
  if (shouldSkip || !Notifications) {
    if (isAndroid && isExpoGo) {
       console.log('Push notifications disabled: Expo Go SDK 53+ does not support remote notifications on Android. Use a development build.');
    }
    return;
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
};

export async function registerForPushNotificationsAsync() {
  if (shouldSkip || !Notifications) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      return;
    }
  }
}

export const addNotificationListener = (callback: (n: any) => void) => {
  if (shouldSkip || !Notifications) return { remove: () => {} };
  return Notifications.addNotificationReceivedListener(callback);
};

export const addNotificationResponseListener = (callback: (r: any) => void) => {
  if (shouldSkip || !Notifications) return { remove: () => {} };
  return Notifications.addNotificationResponseReceivedListener(callback);
};
