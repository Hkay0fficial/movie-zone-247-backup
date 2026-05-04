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
import * as Network from 'expo-network';
import { useDownloads } from '@/app/context/DownloadContext';

export const unstable_settings = {
  anchor: '(tabs)',
};

// Bootstrap notification settings
initNotifications();

function ModernVideoPlayerWrapper() {
  const subscription = useSubscription();
  const router = useRouter();

  // Hermes-safe property extraction
  let _safeSetPlayerMode = (m: any) => {};
  let _safeSetPlayingNow = (m: any) => {};
  let _safeSetPlayingEpisodeId = (m: any) => {};
  let _safeSetPlayingEpisodes = (m: any) => {};
  let _safeSetIsPreview = (m: any) => {};
  let _safeSetSelectedVideoUrl = (m: any) => {};

  try {
    if (subscription.setPlayerMode) _safeSetPlayerMode = subscription.setPlayerMode;
    if (subscription.setPlayingNow) _safeSetPlayingNow = subscription.setPlayingNow;
    if (subscription.setPlayingEpisodeId) _safeSetPlayingEpisodeId = subscription.setPlayingEpisodeId;
    if (subscription.setPlayingEpisodes) _safeSetPlayingEpisodes = subscription.setPlayingEpisodes;
    if (subscription.setIsPreview) _safeSetIsPreview = subscription.setIsPreview;
    if (subscription.setSelectedVideoUrl) _safeSetSelectedVideoUrl = subscription.setSelectedVideoUrl;
  } catch (e) {
    console.warn("[ModernVideoPlayerWrapper] Context extraction error:", e);
  }

  const { downloadedMovies, episodeDownloads } = useDownloads();

  const { 
    playerMode, playerTitle, selectedVideoUrl,
    playingNow, playingEpisodeId, playingEpisodes,
    playerPos, playerSize, isPreview,
  } = subscription;

  const currentIdx = playingEpisodes ? playingEpisodes.findIndex(e => e.id === playingEpisodeId) : -1;
  const hasNext = !!playingEpisodes && currentIdx !== -1 && currentIdx < playingEpisodes.length - 1;
  const hasPrev = !!playingEpisodes && currentIdx > 0;

  const [activeUrl, setActiveUrl] = useState(selectedVideoUrl);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const checkNet = async () => {
      const state = await Network.getNetworkStateAsync();
      setIsOffline(!state.isConnected);
    };
    checkNet();
    const interval = setInterval(checkNet, 5000);
    return () => clearInterval(interval);
  }, []);

  // Sync activeUrl with local source if offline
  useEffect(() => {
    if (isOffline && playingNow) {
      // Check for local version
      if (playingEpisodeId && episodeDownloads[playingEpisodeId]) {
        setActiveUrl(episodeDownloads[playingEpisodeId]);
      } else {
        const movie = downloadedMovies.find(m => m.id === playingNow.id);
        if (movie && movie.localUri) {
          setActiveUrl(movie.localUri);
        } else {
          setActiveUrl(selectedVideoUrl);
        }
      }
    } else {
      setActiveUrl(selectedVideoUrl);
    }
  }, [isOffline, selectedVideoUrl, playingNow, playingEpisodeId, downloadedMovies, episodeDownloads]);

  return (
    <ModernVideoPlayer
      playerMode={playerMode}
      setPlayerMode={_safeSetPlayerMode}
      videoUrl={resolveCDNUrl(activeUrl)}
      title={playerTitle}
      playingNow={playingNow}
      setPlayingNow={_safeSetPlayingNow}
      playerPos={playerPos}
      playerSize={playerSize}
      isPreview={isPreview}
      movieId={playingNow?.id}
      episodes={playingEpisodes}
      activeEpisodeId={playingEpisodeId || undefined}
      onSelectEpisode={(ep) => {
        try {
          _safeSetPlayingEpisodeId(ep.id);
          _safeSetSelectedVideoUrl(ep.videoUrl);
        } catch (e) {}
      }}
      hasNext={hasNext}
      hasPrev={hasPrev}
      nextPartName={(() => {
        if (hasNext) {
          return playingEpisodes[currentIdx + 1].title;
        }
        return undefined;
      })()}
      onNext={() => {
        if (hasNext) {
          try {
            const nextEp = playingEpisodes[currentIdx + 1];
            _safeSetPlayingEpisodeId(nextEp.id);
            _safeSetSelectedVideoUrl(nextEp.videoUrl);
          } catch (e) {}
        }
      }}
      onPrev={() => {
        if (hasPrev) {
          try {
            const prevEp = playingEpisodes[currentIdx - 1];
            _safeSetPlayingEpisodeId(prevEp.id);
            _safeSetSelectedVideoUrl(prevEp.videoUrl);
          } catch (e) {}
        }
      }}
      onClose={() => {
        try {
          // Detect if we are playing a local download
          const isLocal = selectedVideoUrl && (selectedVideoUrl.startsWith('file://') || !selectedVideoUrl.startsWith('http'));
          _safeSetPlayerMode('closed');
          _safeSetPlayingNow(null);
          _safeSetPlayingEpisodeId(null);
          _safeSetPlayingEpisodes([]);
          _safeSetIsPreview(false);

          if (isLocal && playerMode === 'full') {
            // Auto-restore logic: Navigate to menu tab with section param for instant open
            router.push({
              pathname: '/(tabs)/menu',
              params: { section: '5' }
            });
          }
        } catch (e) {}
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
