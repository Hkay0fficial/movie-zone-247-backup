import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { SubscriptionProvider } from '@/app/context/SubscriptionContext';
import { MovieProvider } from '@/app/context/MovieContext';
import { UserProvider } from '@/app/context/UserContext';
import { initNotifications, registerForPushNotificationsAsync, addNotificationListener, addNotificationResponseListener } from '../lib/notifications';
import InAppNotification, { LocalNotification } from '../components/InAppNotification';
import GlobalDownloadBar from '../components/GlobalDownloadBar';

export const unstable_settings = {
  anchor: '(tabs)',
};

// Bootstrap notification settings
initNotifications();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [activeNotification, setActiveNotification] = useState<LocalNotification | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    }
    if (Platform.OS === 'android') {
      SystemUI.setBackgroundColorAsync('#0a0a0f').catch(() => {});
    }
    registerForPushNotificationsAsync();

    // Listen for notifications while app is foregrounded
    const subscription = addNotificationListener(notification => {
      console.log('Notification received:', notification);
      
      const content = notification.request.content;
      setActiveNotification({
        title: content.title || 'Notification',
        body: content.body || '',
        imageUrl: content.data?.imageUrl || (content.attachments?.[0]?.url),
        data: content.data
      });
    });

    // Listen for notification clicks (background/killed state)
    const responseSubscription = addNotificationResponseListener(response => {
      const data = response.notification.request.content.data;
      if (data?.movieId) {
        router.push({
          pathname: '/(tabs)',
          params: { movieId: String(data.movieId), autoplay: 'true' }
        });
      }
    });

    return () => {
      subscription.remove();
      responseSubscription.remove();
    };
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <UserProvider>
        <SubscriptionProvider>
          <MovieProvider>
            <View style={{ flex: 1 }}>
              <Stack>
                <Stack.Screen name="index" options={{ headerShown: false, animation: 'fade' }} />
                <Stack.Screen name="login" options={{ headerShown: false, animation: 'fade' }} />
                <Stack.Screen name="signup" options={{ headerShown: false, animation: 'fade' }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: 'fade' }} />
                <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
              </Stack>
              <InAppNotification 
                notification={activeNotification} 
                onClose={() => setActiveNotification(null)} 
              />
              <GlobalDownloadBar />
            </View>
            <StatusBar style="auto" />
          </MovieProvider>
        </SubscriptionProvider>
      </UserProvider>
    </ThemeProvider>
  );
}
