import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as SystemUI from 'expo-system-ui';
import React, { useEffect, useState, useCallback } from 'react';
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
import NotificationManager from '../components/NotificationManager';
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

  const handleClose = useCallback(() => {
    try {
      const isLocal = selectedVideoUrl && (selectedVideoUrl.startsWith('file://') || !selectedVideoUrl.startsWith('http'));
      _safeSetPlayerMode('closed');
      _safeSetPlayingNow(null);
      _safeSetPlayingEpisodeId(null);
      _safeSetPlayingEpisodes([]);
      _safeSetIsPreview(false);

      if (isLocal && playerMode === 'full') {
        router.push({
          pathname: '/(tabs)/menu',
          params: { section: '5' }
        });
      }
    } catch (e) {}
  }, [selectedVideoUrl, playerMode, router, _safeSetPlayerMode, _safeSetPlayingNow, _safeSetPlayingEpisodeId, _safeSetPlayingEpisodes, _safeSetIsPreview]);

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
      onClose={handleClose}
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
            const apiLevel = Platform.Version;
            
            // In modern Android (API 35+ / Android 15), edge-to-edge is mandatory.
            // We focus on semantic visibility rather than forcing deprecated background colors.
            await NavigationBar.setBehaviorAsync('inset-touch').catch(() => {});
            await NavigationBar.setVisibilityAsync('visible').catch(() => {});
            
            // On older versions, we still ensure transparency for consistent "thin-line" aesthetic.
            if (typeof apiLevel === 'number' && apiLevel < 35) {
              await NavigationBar.setBackgroundColorAsync('#00000001').catch(() => {});
              await NavigationBar.setButtonStyleAsync('light').catch(() => {});
            }
          } catch (e) {}
        }
      };
      resetUI();
      // Reduced frequency of reinforcement to respect modern system constraints
      const interval = setInterval(resetUI, 1000);
      const timeout = setTimeout(() => clearInterval(interval), 3000);
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
    const initOrientation = async () => {
      if (Platform.OS !== 'web') {
        // Unlock orientation for large screen devices (tablets/foldables) to satisfy Play Store requirements.
        // Only lock to portrait for standard handsets.
        const { isDevice } = await import('expo-device');
        const deviceType = await import('expo-device').then(d => d.getDeviceTypeAsync());
        
        // DeviceType.PHONE = 1, DeviceType.TABLET = 2
        if (deviceType === 1) {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        } else {
          await ScreenOrientation.unlockAsync();
        }
      }
    };

    initOrientation();
    
    if (Platform.OS === 'android') {
      SystemUI.setBackgroundColorAsync('#0a0a0f').catch(() => {});
    }
    registerForPushNotificationsAsync();
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
                <NotificationManager />

                <ModernVideoPlayerWrapper />
                <SystemUIGuard />

                <VersionLockGuard />
                <OTAUpdateGuard />
              </View>
              <StatusBar style="light" translucent />
            </DownloadProvider>
          </MovieProvider>
        </SubscriptionProvider>
      </UserProvider>
    </SafeAreaProvider>
  );
}
