import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useState } from 'react';
import { Platform, View, DeviceEventEmitter } from 'react-native';
import 'react-native-reanimated';
import { useFonts } from 'expo-font';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync().catch(() => {});

import { useColorScheme } from '@/hooks/use-color-scheme';
import { SubscriptionProvider } from '@/app/context/SubscriptionContext';
import { MovieProvider } from '@/app/context/MovieContext';
import { UserProvider } from '@/app/context/UserContext';
import { DownloadProvider } from '@/app/context/DownloadContext';
import { initNotifications, registerForPushNotificationsAsync, addNotificationListener, addNotificationResponseListener, useLastNotificationResponse } from '../lib/notifications';
import InAppNotification, { LocalNotification } from '../components/InAppNotification';
import VersionLockGuard from '../components/VersionLockGuard';
import OTAUpdateGuard from '../components/OTAUpdateGuard';
import ModernVideoPlayer from '../components/ModernVideoPlayer';
import { useSubscription } from '@/app/context/SubscriptionContext';
import { resolveCDNUrl } from '@/constants/bunnyConfig';
import * as NavigationBar from 'expo-navigation-bar';

export const unstable_settings = {
  anchor: '(tabs)',
};

// Bootstrap notification settings
initNotifications();

function ModernVideoPlayerWrapper() {
  const { 
    playerMode, setPlayerMode, 
    playerTitle, selectedVideoUrl,
    setPlayingNow, playingNow,
    playerPos, playerSize, isPreview,
    setIsPreview, playingEpisodeId,
    setPlayingEpisodeId,
    playingEpisodes,
    setPlayingEpisodes,
    setSelectedVideoUrl,
  } = useSubscription();
  const router = useRouter();

  return (
    <ModernVideoPlayer
      playerMode={playerMode}
      setPlayerMode={setPlayerMode}
      videoUrl={resolveCDNUrl(selectedVideoUrl)}
      title={playerTitle}
      playingNow={playingNow}
      setPlayingNow={setPlayingNow}
      playerPos={playerPos}
      playerSize={playerSize}
      isPreview={isPreview}
      movieId={playingNow?.id}
      episodes={playingEpisodes}
      activeEpisodeId={playingEpisodeId || undefined}
      onSelectEpisode={(ep) => {
        setPlayingEpisodeId(ep.id);
        setSelectedVideoUrl(ep.videoUrl);
      }}
      hasNext={!!playingEpisodes && !!playingEpisodeId && playingEpisodes.findIndex(e => e.id === playingEpisodeId) < playingEpisodes.length - 1}
      nextPartName={(() => {
        const idx = playingEpisodes.findIndex(e => e.id === playingEpisodeId);
        if (idx !== -1 && idx < playingEpisodes.length - 1) {
          return playingEpisodes[idx + 1].title;
        }
        return undefined;
      })()}
      onNext={() => {
        const idx = playingEpisodes.findIndex(e => e.id === playingEpisodeId);
        if (idx !== -1 && idx < playingEpisodes.length - 1) {
          const nextEp = playingEpisodes[idx + 1];
          setPlayingEpisodeId(nextEp.id);
          setSelectedVideoUrl(nextEp.videoUrl);
        }
      }}
      onClose={() => {
        // Detect if we are playing a local download
        const isLocal = selectedVideoUrl && (selectedVideoUrl.startsWith('file://') || !selectedVideoUrl.startsWith('http'));
        setPlayerMode('closed');
        setPlayingNow(null);
        setPlayingEpisodeId(null);
        setPlayingEpisodes([]);
        setIsPreview(false);

        if (isLocal && playerMode === 'full') {
          // Auto-restore logic: Navigate to menu tab with section param for instant open
          router.push({
            pathname: '/(tabs)/menu',
            params: { section: '5' }
          });
        }
      }}
    />
  );
}

function SystemUIGuard() {
  const { playerMode } = useSubscription();
  
  useEffect(() => {
    if (playerMode === 'closed' || playerMode === 'mini') {
      const resetUI = async () => {
        if (Platform.OS === 'android') {
          try {
            await NavigationBar.setBehaviorAsync('inset-touch').catch(() => {});
            await NavigationBar.setVisibilityAsync('visible').catch(() => {});
            await NavigationBar.setBackgroundColorAsync('transparent').catch(() => {});
            await NavigationBar.setButtonStyleAsync('light').catch(() => {});
          } catch (e) {}
        }
      };
      resetUI();
      const interval = setInterval(resetUI, 500);
      const timeout = setTimeout(() => clearInterval(interval), 2500);
      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [playerMode]);

  return null;
}

import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [activeNotification, setActiveNotification] = useState<LocalNotification | null>(null);
  const lastNotificationResponse = useLastNotificationResponse();

  useEffect(() => {
    if (lastNotificationResponse) {
      const data = lastNotificationResponse.notification.request.content.data;
      const actionId = lastNotificationResponse.actionIdentifier;
      
      if (data?.movieId) {
        // Wait a brief moment to ensure navigation stack is ready before pushing
        setTimeout(() => {
          router.push({
            pathname: '/(tabs)',
            params: { movieId: String(data.movieId), autoplay: actionId === 'watch_now' ? 'true' : 'false' }
          });
        }, 500);
      }
    }
  }, [lastNotificationResponse]);

  const [fontsLoaded, fontError] = useFonts({
    ...MaterialIcons.font,
    ...Ionicons.font,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

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

      // Ignore download progress notifications for the in-app banner
      // as they update frequently and cause the banner to stay stuck.
      if (content.data?.type === 'download') return;

      setActiveNotification({
        title: content.title || 'Notification',
        body: content.body || '',
        imageUrl: content.data?.imageUrl || content.data?.image || (content.attachments?.[0]?.url),
        data: content.data
      });
    });

    // Listen for notification clicks (background/killed state)
    const responseSubscription = addNotificationResponseListener(response => {
      const data = response.notification.request.content.data;
      const actionId = response.actionIdentifier;

      if (data?.movieId) {
        // If it's a 'New Release' or 'Alert', open the details page
        // Standard tapping (DefaultIdentifier) or specific buttons (watch_now, view_details)
        setTimeout(() => {
          router.push({
            pathname: '/(tabs)',
            params: { movieId: String(data.movieId), autoplay: actionId === 'watch_now' ? 'true' : 'false' }
          });
        }, 500);
      }
    });

    // Manual trigger for in-app notification banner
    const localNotifSub = DeviceEventEmitter.addListener("showLocalNotification", (notif: LocalNotification) => {
      setActiveNotification(notif);
    });

    return () => {
      subscription.remove();
      responseSubscription.remove();
      localNotifSub.remove();
    };
  }, []);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <UserProvider>
        <SubscriptionProvider>
          <MovieProvider>
            <DownloadProvider>
              <View style={{ flex: 1 }}>
                <Stack screenOptions={{ gestureEnabled: false }}>
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

                <ModernVideoPlayerWrapper />
                <SystemUIGuard />

                <VersionLockGuard />
                <OTAUpdateGuard />
              </View>
              <StatusBar style="light" translucent backgroundColor="transparent" />
            </DownloadProvider>
          </MovieProvider>
        </SubscriptionProvider>
      </UserProvider>
    </SafeAreaProvider>
  );
}
