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
  if (!Notifications) return;

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
  if (!Notifications) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'General Notifications',
      importance: Notifications.AndroidImportance.DEFAULT,
    });

    await Notifications.setNotificationChannelAsync('movie_updates_v2', {
      name: 'New Movie Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#5B5FEF',
      showBadge: true,
      enableVibrate: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }

  // Register Interactive Categories (Awaited inside effect)
  await Notifications.setNotificationCategoryAsync('new_release', [
    {
      identifier: 'watch_now',
      buttonTitle: '🎬 WATCH NOW',
      options: { opensAppToForeground: true },
    },
    {
      identifier: 'add_to_list',
      buttonTitle: '➕ MY LIST',
      options: { opensAppToForeground: true },
    },
  ]);

  await Notifications.setNotificationCategoryAsync('general_alert', [
    {
      identifier: 'view_details',
      buttonTitle: '🔍 VIEW DETAILS',
      options: { opensAppToForeground: true },
    },
    {
      identifier: 'dismiss',
      buttonTitle: 'Dismiss',
      options: { isDestructive: true, opensAppToForeground: false },
    },
  ]);

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      return null;
    }
    
    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
      
      // On Android, use getDevicePushTokenAsync for native FCM tokens which support images much better
      if (Platform.OS === 'android') {
        const deviceToken = (await Notifications.getDevicePushTokenAsync()).data;
        console.log('Registered Native FCM Token:', deviceToken);
        return deviceToken;
      }

      const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      return token;
    } catch (e) {
      console.error('Failed to get push token:', e);
      return null;
    }
  } else {
    console.log('Must use physical device for Push Notifications');
    return null;
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
