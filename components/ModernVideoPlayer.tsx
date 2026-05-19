import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Dimensions,
  Platform,
  StatusBar,
  Animated,
  PanResponder,
  BackHandler,
  Easing,
  Dimensions as RNDimensions,
  NativeModules,
  GestureResponderEvent,
  PanResponderGestureState,
  TouchableWithoutFeedback,
  useWindowDimensions,
  Image,
  ScrollView,
  AppState,
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  UIManager,
} from "react-native";
import ReAnimated, { SlideInRight, SlideOutRight } from "react-native-reanimated";
import * as SystemUI from "expo-system-ui";
import * as Network from "expo-network";
import { useIsFocused } from "@react-navigation/native";
import { Modal as RNModal } from "react-native";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import * as ScreenOrientation from "expo-screen-orientation";
import * as NavigationBar from "expo-navigation-bar";
import * as Haptics from "expo-haptics";
import * as Brightness from "expo-brightness";
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { useKeepAwake } from "expo-keep-awake";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Movie, Series } from "@/constants/movieData";
import { useUser } from "@/app/context/UserContext";
import { useRouter } from "expo-router";
import { useDownloads } from "@/app/context/DownloadContext";
// and causes a Hermes "Platform already declared" error when required at module scope.
// Use a lazy getter so the require only executes at runtime, not at parse time.
let _castModule: any = undefined;
function getCastModule() {
  if (_castModule === undefined) {
    try {
      _castModule = Platform.OS !== 'web' ? require('react-native-google-cast') : null;
    } catch {
      _castModule = null;
    }
  }
  return _castModule;
}
const GoogleCast = null; // Cast is resolved at runtime via getCastModule()
const CastButton: React.ComponentType<any> = () => null;
const useCastSession: () => any = () => null;

const BlurViewOptimized = Platform.OS === 'android' ? ({ style, ...props }: any) => <View style={[{ backgroundColor: 'rgba(15,15,20,0.85)' }, style]} /> : BlurView;

function useOptionalKeepAwake() {
  if (Platform.OS !== 'web') {
    useKeepAwake();
  }
}

// ─── Native Media Controls ───────────────────────────────────────

// ─── Google Cast Safety Guard ───
const CAN_CAST = (!!NativeModules.RNGCCastContext || !!NativeModules.RNGCastContext) && Platform.OS !== 'web';

// ─── AirPlay Button via iOS native MPVolumeView ───────────────────────────
// MPVolumeView is the standard iOS media route picker — it renders the
// AirPlay icon natively and requires no additional npm packages.
import { requireNativeComponent, ViewStyle } from 'react-native';
let _AirPlayNative: React.ComponentType<{ style?: ViewStyle }> | null = null;
if (Platform.OS === 'ios') {
  try {
    _AirPlayNative = UIManager.getViewManagerConfig('AirPlayButton')
      ? requireNativeComponent('AirPlayButton') as any
      : null;
  } catch {
    // Fallback: use a plain TouchableOpacity that opens the system route picker
    _AirPlayNative = null;
  }
}
const AirPlayNative = _AirPlayNative;

const getPipModule = () => {
  const modules = NativeModules as any;
  return modules.PipModule || modules.PIPModule || modules.RNPipModule || null;
};

interface ModernVideoPlayerProps {
  playerMode: 'closed' | 'full' | 'mini';
  setPlayerMode: (m: 'closed' | 'full' | 'mini') => void;
  videoUrl?: string;
  title: string;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
  nextPartName?: string;
  episodes?: any[];
  activeEpisodeId?: string;
  onSelectEpisode?: (ep: any) => void;
  relatedSeries?: Series[];
  onSelectRelated?: (series: Series) => void;
  seriesVj?: string;
  seriesEpisodeDuration?: string;
  playerPos: Animated.ValueXY;
  playerSize: Animated.Value;
  movieId?: string;
  episodeId?: string;
  playingNow?: Movie | Series | null;
  setPlayingNow?: (m: Movie | Series | null) => void;
  isPreview?: boolean;
  subtitles?: { id: string; label: string; url: string }[];
}

export default function ModernVideoPlayer({
  playerMode,
  setPlayerMode,
  videoUrl,
  title,
  onClose,
  onNext,
  onPrev,
  hasNext,
  hasPrev,
  nextPartName,
  episodes = [],
  activeEpisodeId,
  onSelectEpisode,
  relatedSeries = [],
  onSelectRelated,
  seriesVj,
  seriesEpisodeDuration,
  playerPos,
  playerSize,
  movieId,
  episodeId,
  playingNow,
  setPlayingNow,
  isPreview,
  subtitles = [],
}: ModernVideoPlayerProps) {
  const { width: SCREEN_W, height: SCREEN_H } = useWindowDimensions();
  const shouldLockOrientation = Math.min(SCREEN_W, SCREEN_H) < 600;
  const { savePlaybackProgress, getPlaybackProgress, incrementCompletion, profile } = useUser();
  const insets = useSafeAreaInsets();

  // Smart Title Logic: Handles "Title - Title By Vj HD EP 1" redundancy
  const { processedTitle, processedSubTitle, processedNextPartName } = useMemo(() => {
    // If we have episodes and an active ID, derive title from the actual episode data
    // This prevents stale titles when switching episodes
    let rawTitle = title;
    if (episodes && episodes.length > 0 && activeEpisodeId) {
      const activeEp = episodes.find(e => e.id === activeEpisodeId);
      if (activeEp) {
        rawTitle = activeEp.title;
      }
    }

    if (!rawTitle) return { processedTitle: "", processedSubTitle: seriesVj || "" };

    let displayTitle = rawTitle;
    let displaySubTitle = seriesVj || "";

    // 1. Handle "Movie Name - Movie Name Part 1" redundancy
    // Regex matches "Something - Something" and checks if the parts are identical
    const dashMatch = title.match(/^(.+?)\s*-\s*(.+)$/);
    if (dashMatch) {
      const mainName = dashMatch[1].trim();
      const partName = dashMatch[2].trim();
      
      // If the second part starts with the first part, strip the redundant first part
      if (partName.toLowerCase().startsWith(mainName.toLowerCase())) {
        displayTitle = partName;
      }
    }

    // 2. Extract "By Vj ..." from title if it exists
    // We want to extract the VJ part but keep any EP info in the title if possible
    // Example: "The King's Face By Vj HD EP 1" -> Title: "The King's Face EP 1", Sub: "By Vj HD"
    const vjRegex = /\s+(By\s+Vj\s+.*?(?:\s+HD)?)(?:\s+|$)/i;
    const vjMatch = displayTitle.match(vjRegex);
    
    if (vjMatch) {
      const vjPart = vjMatch[1].trim();
      displaySubTitle = vjPart;
      // Remove the VJ part from the main title
      displayTitle = displayTitle.replace(vjRegex, ' ').replace(/\s+/g, ' ').trim();
    }

    // 3. Clean up trailing dashes or extra spaces
    displayTitle = displayTitle.replace(/\s*-\s*$/, '').trim();

    // 4. Process Next Part Name similarly
    let nextTitle = nextPartName || "";
    if (nextTitle) {
       // Strip redundant main title if present
       const mainTitlePrefix = (playingNow?.title || "").toLowerCase() + " - ";
       if (nextTitle.toLowerCase().startsWith(mainTitlePrefix)) {
          nextTitle = nextTitle.substring(mainTitlePrefix.length);
       }
       // Strip VJ info
       nextTitle = nextTitle.replace(vjRegex, ' ').replace(/\s+/g, ' ').trim();
       // Clean trailing dashes
       nextTitle = nextTitle.replace(/\s*-\s*$/, '').trim();
    }

    return { 
      processedTitle: displayTitle, 
      processedSubTitle: displaySubTitle,
      processedNextPartName: nextTitle
    };
  }, [title, seriesVj, episodes, activeEpisodeId, nextPartName, playingNow]);
  const router = useRouter();
  const { downloadedMovies, episodeDownloads } = useDownloads();
  useOptionalKeepAwake();
  
  const scrubbingTimeout = useRef<any>(null);
  const hidingTimeoutsRef = useRef<any[]>([]);

  const formatTime = (ms: number) => {
    if (!ms || ms < 0) return "0:00";
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const safeSetNavigationBar = async (visibility: 'visible' | 'hidden') => {
    if (Platform.OS !== 'android') return;

    hidingTimeoutsRef.current.forEach(t => clearTimeout(t));
    hidingTimeoutsRef.current = [];

    try {
      const apiLevel = Platform.Version;
      
      if (visibility === 'hidden') {
        // Modern sticky-immersive is the standard for video apps
        await NavigationBar.setBehaviorAsync('sticky-immersive' as any).catch(() => {});
        await NavigationBar.setVisibilityAsync('hidden').catch(() => {});
        
        // Android 15+ (API 35) handles this via system, but we reinforce once for older devices
        if (typeof apiLevel === 'number' && apiLevel < 35) {
          const t1 = setTimeout(async () => {
            await NavigationBar.setVisibilityAsync('hidden').catch(() => {});
          }, 300);
          hidingTimeoutsRef.current.push(t1);
        }
      } else {
        await NavigationBar.setBehaviorAsync('inset-touch').catch(() => {});
        await NavigationBar.setVisibilityAsync('visible').catch(() => {});
        
        // Use semi-transparent instead of pure transparent to satisfy some legacy edge-to-edge edge cases
        if (typeof apiLevel === 'number' && apiLevel < 35) {
          await NavigationBar.setBackgroundColorAsync('#00000001').catch(() => {});
          await NavigationBar.setButtonStyleAsync('light').catch(() => {});
        }
        StatusBar.setHidden(false);
      }
    } catch (e) {
      console.warn("Navigation Bar Error:", e);
    }
  };
  
  const isFocused = useIsFocused();
  const [appState, setAppState] = useState(AppState.currentState);
  const [isPiPActive, setIsPiPActive] = useState(false);
  const appStateRef = useRef(AppState.currentState);
  const isPiPActiveRef = useRef(false);
  const pipRequestedRef = useRef(false);

  useEffect(() => {
    const appSubscription = AppState.addEventListener('change', nextAppState => {
      if (appStateRef.current.match(/active/) && nextAppState.match(/inactive|background/)) {
        // App backgrounded: Pause if not in PiP
        if (!isPiPActiveRef.current && !pipRequestedRef.current && videoRef.current) {
          videoRef.current.pauseAsync().catch(() => {});
        }
      }
      appStateRef.current = nextAppState;
      setAppState(nextAppState);
    });

    // PiP Event Listener. MainActivity emits this through DeviceEventEmitter; the
    // native module emitter path is kept for builds that expose PipModule directly.
    let pipListener: any = null;
    const handlePipModeChange = (event: { isInPictureInPictureMode: boolean }) => {
      const isActive = !!event.isInPictureInPictureMode;
      isPiPActiveRef.current = isActive;
      pipRequestedRef.current = isActive;
      setIsPiPActive(isActive);
      if (isActive) {
        setShowControls(false);
        showControlsRef.current = false;
        setIsControlsMounted(false);
        controlsOpacity.setValue(0);
      } else {
        setIsControlsMounted(true);
        setShowControls(true);
        showControlsRef.current = true;
        controlsOpacity.setValue(1);
      }
    };

    const devicePipListener = Platform.OS === 'android'
      ? DeviceEventEmitter.addListener('onPictureInPictureModeChanged', handlePipModeChange)
      : null;

    const pipModule = getPipModule();
    if (Platform.OS === 'android' && pipModule) {
      try {
        const { NativeEventEmitter } = require('react-native');
        const eventEmitter = new NativeEventEmitter(pipModule);
        pipListener = eventEmitter.addListener('onPictureInPictureModeChanged', handlePipModeChange);
      } catch (e) {
        console.warn("Failed to initialize PipModule listener:", e);
      }
    }

    return () => {
      appSubscription.remove();
      devicePipListener?.remove();
      if (pipListener) pipListener.remove();
    };
  }, []);

  const videoRef = useRef<Video>(null);
  const [status, setStatus] = useState<AVPlaybackStatus>({} as AVPlaybackStatus);
  const statusRef = useRef<AVPlaybackStatus>({} as AVPlaybackStatus);
  
  // UI States
  const [showControls, setShowControls] = useState(true);
  const [isControlsMounted, setIsControlsMounted] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [showNextSuggestion, setShowNextSuggestion] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const playbackSpeedRef = useRef(1.0);
  const volumeSliderWidthRef = useRef(90);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubPosition, setScrubPosition] = useState(0);
  const [videoResizeMode, setVideoResizeMode] = useState<ResizeMode>(ResizeMode.CONTAIN);
  const [isAirPlaying, setIsAirPlaying] = useState(false);
  // Ambient Mode removed to optimize playback performance
  
  const [currentVolume, setCurrentVolume] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  
  // Overlays
  const [isBufferingDelayed, setIsBufferingDelayed] = useState(false);
  const bufferTimeoutRef = useRef(null);
  const [showEpisodesOverlay, setShowEpisodesOverlay] = useState(false);
  const [showSpeedOverlay, setShowSpeedOverlay] = useState(false);
  const [showSubtitleOverlay, setShowSubtitleOverlay] = useState(false);
  const [selectedSubtitleId, setSelectedSubtitleId] = useState<string | null>(null);
  const [showTimerOptions, setShowTimerOptions] = useState(false);
  const [sleepTimerMs, setSleepTimerMs] = useState(0);
  const [selectedTimerMins, setSelectedTimerMins] = useState(0); 
  const [timelineWidthState, setTimelineWidthState] = useState(SCREEN_W - 100); // Initial guess 

  // Modern Gesture States
  const [isAdjustingBrightness, setIsAdjustingBrightness] = useState(false);
  const [currentBrightness, setCurrentBrightness] = useState(1);
  const [isAdjustingVolume, setIsAdjustingVolume] = useState(false);
  
  // Animations
  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const lockPulseAnim = useRef(new Animated.Value(1)).current;
  const progressBarGlow = useRef(new Animated.Value(1)).current;
  const bufferedAnimPct = useRef(new Animated.Value(0)).current;
  const skipIntroOpacity = useRef(new Animated.Value(0)).current;
  const lastTapRef = useRef<number>(0);
  // Animated values for smooth knob/fill (no React re-render during drag)
  const scrubAnimPct = useRef(new Animated.Value(0)).current;   // 0..1
  const volumeAnimPct = useRef(new Animated.Value(1)).current;  // 0..1
  const nextPulseAnim = useRef(new Animated.Value(1)).current;
  // Single stable display anim — controls what the slider actually shows
  const volumeDisplayAnim = useRef(new Animated.Value(1)).current;
  const currentVolumeRef = useRef(1);

  // Refs for logic consistency
  const showControlsRef = useRef(true);
  const controlsTimeout = useRef<any>(null);
  const progressBarWidth = useRef(0);
  const scrubPositionRef = useRef(0);
  const statusUpdateRef = useRef<any>(null);
  const isInteractingRef = useRef(false); // Global lock to prevent main swipe from stealing control touches
  const fullPlayerAnim = useRef(new Animated.Value(0)).current; // For smooth entry
  const lastStateUpdateRef = useRef(0);
  const lastPushedStateRef = useRef<AVPlaybackStatus>({} as AVPlaybackStatus);

  const BufferingDots = useCallback(() => {
    const dot1 = useRef(new Animated.Value(0.3)).current;
    const dot2 = useRef(new Animated.Value(0.3)).current;
    const dot3 = useRef(new Animated.Value(0.3)).current;
    
    useEffect(() => {
      const createPulse = (val: Animated.Value, delay: number) => {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(val, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.timing(val, { toValue: 0.3, duration: 400, useNativeDriver: true }),
          ])
        );
      };
      
      const a1 = createPulse(dot1, 0);
      const a2 = createPulse(dot2, 200);
      const a3 = createPulse(dot3, 400);
      
      a1.start(); a2.start(); a3.start();
      
      return () => { a1.stop(); a2.stop(); a3.stop(); };
    }, []);

    return (
      <View style={styles.bufferingDotsContainer}>
        <Text style={styles.bufferingText}>LOADING</Text>
        <Animated.View style={[styles.bufferingDot, { opacity: dot1, transform: [{ scale: dot1 }] }]} />
        <Animated.View style={[styles.bufferingDot, { opacity: dot2, transform: [{ scale: dot2 }] }]} />
        <Animated.View style={[styles.bufferingDot, { opacity: dot3, transform: [{ scale: dot3 }] }]} />
      </View>
    );
  }, []);

  const [isClosing, setIsClosing] = useState(false);
  const playerModeRef = useRef(playerMode);
  const rotationTimeoutRef = useRef<any>(null);

  useEffect(() => {
    playerModeRef.current = playerMode;
  }, [playerMode]);

  // Handle dismissal with animation
  const handleDismiss = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);

    // 1. Stop audio immediately and save progress
    if (videoRef.current && statusRef.current.isLoaded) {
      videoRef.current.pauseAsync().catch(() => {});
      if (movieId) {
        savePlaybackProgress(movieId, statusRef.current.positionMillis, episodeId);
      }
    }

    // 2. Animate out to the right while keeping the device orientation fixed.
    Animated.parallel([
      Animated.timing(fullPlayerAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(playerPos, {
        toValue: { x: SCREEN_W * 1.5, y: 0 },
        tension: 50,
        friction: 14,
        useNativeDriver: true,
      })
    ]).start(() => {
      // Call onClose immediately so the UI is freed
      onClose();
      // Restore orientation ONLY after the player is fully off-screen in the background
      if (Platform.OS !== "web" && shouldLockOrientation) {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      } else if (Platform.OS !== "web") {
        ScreenOrientation.unlockAsync().catch(() => {});
      }
      // Keep isClosing true for an extra moment to ensure unmount finishes without flicker
      setTimeout(() => setIsClosing(false), 100);
    });
  }, [onClose, SCREEN_H, isClosing, isPreview]);

  // Orientation & Status Bar
  useEffect(() => {
    const manageLayout = () => {
      if (playerMode === 'full') {
        StatusBar.setHidden(true, 'fade');
        safeSetNavigationBar('hidden').catch(() => {});

        playerPos.setValue({ x: -SCREEN_W * 1.15, y: 0 });
        fullPlayerAnim.setValue(1);

        Animated.spring(playerPos, {
          toValue: { x: 0, y: 0 },
          tension: 80,
          friction: 14,
          useNativeDriver: true,
        }).start();

        // Keep the in-app player portrait. Users can still use the resize control without rotating the app.
        if (Platform.OS !== "web" && shouldLockOrientation) {
          ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
        } else if (Platform.OS !== "web") {
          ScreenOrientation.unlockAsync().catch(() => {});
        }
      } else {
        StatusBar.setHidden(false, 'fade');
        if (Platform.OS !== "web" && shouldLockOrientation) {
           ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
        } else if (Platform.OS !== "web") {
           ScreenOrientation.unlockAsync().catch(() => {});
        }
        safeSetNavigationBar('visible').catch(() => {});
        fullPlayerAnim.setValue(0);
      }
    };

    manageLayout();
    if (playerMode !== 'closed') resetControlsTimer();

    // Hiding Lockdown Burst
    let hideInterval: any;
    if (playerMode === 'full') {
      const forceHide = async () => {
        if (Platform.OS === 'android') {
          await NavigationBar.setBehaviorAsync('sticky-immersive' as any).catch(() => {});
          await NavigationBar.setVisibilityAsync('hidden').catch(() => {});
          await NavigationBar.setBackgroundColorAsync('transparent').catch(() => {});
          StatusBar.setHidden(true);
        }
      };
      
      forceHide();
      hideInterval = setInterval(forceHide, 5000); // Increased interval to 5s to reduce CPU load while still ensuring immersive mode
    }

    return () => { 
      if (controlsTimeout.current) clearTimeout(controlsTimeout.current); 
      if (rotationTimeoutRef.current) clearTimeout(rotationTimeoutRef.current);
      if (hideInterval) clearInterval(hideInterval);
      
      // Failsafe: Ensure orientation and UI are restored when player unmounts
      if (Platform.OS !== 'web' && shouldLockOrientation) {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      } else if (Platform.OS !== 'web') {
        ScreenOrientation.unlockAsync().catch(() => {});
      }
      if (Platform.OS !== 'web') {
        StatusBar.setHidden(false, 'fade');
        safeSetNavigationBar('visible').catch(() => {});
      }
    };
  }, [playerMode, shouldLockOrientation]);

  // Handle hardware back button
  useEffect(() => {
    if (playerMode === 'full') {
      const handleBackPress = () => {
        handleDismiss();
        return true;
      };
      const subscription = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
      return () => subscription.remove();
    }
  }, [playerMode, handleDismiss]);

  // Load Video Effect - Enhanced with progress saving on switch
  useEffect(() => {
    if (!videoUrl || playerMode === 'closed' || !videoRef.current) return;

    // Reset PiP params when starting a new video
    const pipModule = getPipModule();
    if (Platform.OS === 'android' && pipModule?.updatePipParams) {
      pipModule.updatePipParams(16, 9, true);
    }

    const loadNewSource = async () => {
      try {
        // Save progress of current video before switching
        if (statusRef.current.isLoaded && movieId) {
          savePlaybackProgress(movieId, statusRef.current.positionMillis, episodeId);
        }

        setIsBuffering(true);
        const source = { uri: videoUrl };
        console.log("[ModernVideoPlayer] Initiating load for:", videoUrl);
        
        await videoRef.current?.unloadAsync();
        const isMovie = playingNow?.type === 'Movie' || !episodeId;
        const result = await videoRef.current?.loadAsync(
          source,
          { 
            shouldPlay: true, 
            progressUpdateIntervalMillis: 1000,
            rate: playbackSpeedRef.current,
            shouldCorrectPitch: true,
            // Android-specific optimizations for high-bitrate movies
            ...(Platform.OS === 'android' ? {
              androidImplementation: 'ExoPlayer',
              bufferConfig: isMovie ? {
                minBufferMs: 45000,
                maxBufferMs: 150000,
                bufferForPlaybackMs: 3000,
                bufferForPlaybackAfterRebufferMs: 8000,
              } : {
                minBufferMs: 45000,
                maxBufferMs: 120000,
                bufferForPlaybackMs: 3000,
                bufferForPlaybackAfterRebufferMs: 6000,
              }
            } : {})
          },
          false
        );
        
        if (result && (result as any).isLoaded) {
          setStatus(result as any);
          statusRef.current = result as any;
          setError(null); // Clear any previous error
          console.log("[ModernVideoPlayer] Video loaded successfully:", videoUrl);
        } else {
           console.warn("[ModernVideoPlayer] Result not loaded:", result);
           setError("Failed to initialize video player. Please try again.");
        }
      } catch (e: any) {
        console.error("[ModernVideoPlayer] CRITICAL Load error:", {
          url: videoUrl,
          error: e?.message || e,
          stack: e?.stack
        });
        
        let userMessage = "Failed to load video.";
        if (e?.message?.includes("404")) {
          userMessage = "Video not found (404). The link may be broken or expired.";
        } else if (e?.message?.includes("network") || e?.message?.includes("connection")) {
          userMessage = "Network error. Please check your internet connection.";
        } else {
          userMessage = `Playback Error: ${e?.message || "Unknown error"}`;
        }
        
        setError(userMessage);
      } finally {
        // Slight delay before hiding loading indicator to ensure first frame is ready
        setTimeout(() => {
          setIsBuffering(false);
        }, 500);
      }
    };

    loadNewSource();
  }, [videoUrl, playerMode === 'closed', retryCount]);

  // Lock Animation
  useEffect(() => {
    if (isLocked) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(lockPulseAnim, { toValue: 1.15, duration: 1000, useNativeDriver: true }),
          Animated.timing(lockPulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
      ).start();
    } else {
      lockPulseAnim.setValue(1);
      // Ensure bars are re-hidden when controls disappear
      if (showControls === false && playerMode === 'full') {
        safeSetNavigationBar('hidden');
      }
    }
  }, [isLocked, showControls, playerMode]);

  // Re-hide on App State change (e.g. returning from background)
  useEffect(() => {
    if (playerMode === 'full' && appState === 'active') {
       safeSetNavigationBar('hidden');
    }
  }, [appState, playerMode]);
  // Resume from saved progress
  useEffect(() => {
    if (playerMode !== 'closed' && movieId && videoUrl && status.isLoaded && !status.isPlaying) {
      const saved = getPlaybackProgress(movieId, episodeId);
      // Only resume if we haven't already sought (check positionMillis is near 0)
      if (saved && saved.position > 3000 && status.positionMillis < 2000) { 
        console.log(`[Mobile] Resuming ${movieId} at ${saved.position}ms`);
        videoRef.current?.setPositionAsync(saved.position);
      }
    }
  }, [movieId, episodeId, videoUrl, playerMode, status.isLoaded]);

  // Periodic Progress Save
  useEffect(() => {
    const loadedStatus = status as AVPlaybackStatus & { isPlaying?: boolean };
    if (playerMode !== 'closed' && loadedStatus.isLoaded && loadedStatus.isPlaying && movieId) {
      const interval = setInterval(() => {
        savePlaybackProgress(movieId, (statusRef.current as any).positionMillis || 0, episodeId);
      }, 20000); // Increased to 20s to reduce UI thread load and Firestore writes during movies
      return () => clearInterval(interval);
    }
  }, [status, playerMode, movieId, episodeId]);

  // ─── Cast Sync Logic ───
  // Monitor Network for Offline Mode
  useEffect(() => {
    if (playerMode === 'closed') {
      setIsOffline(false);
      return;
    }

    const checkNetwork = async () => {
      try {
        const state = await Network.getNetworkStateAsync();
        setIsOffline(!state.isConnected);
      } catch (err) {
        console.log("Network check failed:", err);
      }
    };
    
    checkNetwork();
    const interval = setInterval(checkNetwork, 15000);
    return () => clearInterval(interval);
  }, [playerMode]);

  // Check for local version when offline
  const localMatch = useMemo(() => {
    if (!playingNow || !isOffline) return null;
    // Check if it's an episode first
    if (episodeId && episodeDownloads[episodeId]) {
      return { localUri: episodeDownloads[episodeId], isEpisode: true };
    }
    // Check if it's a movie
    const movie = downloadedMovies.find(m => m.id === movieId);
    if (movie && movie.localUri) {
      return { localUri: movie.localUri, isEpisode: false };
    }
    return null;
  }, [downloadedMovies, episodeDownloads, movieId, episodeId, isOffline, playingNow]);

  // Setup Cast Session and Listeners
  const castSession = useCastSession();
  useEffect(() => {
    if (CAN_CAST && castSession && videoUrl && playingNow) {
      castSession.client.loadMedia({
        mediaInfo: {
          contentUrl: videoUrl,
          metadata: {
            type: 'movie',
            title: title || playingNow.title,
            images: playingNow.poster ? [{ url: playingNow.poster }] : [],
          }
        },
        autoplay: true,
      });
      // Pause local video if casting
      videoRef.current?.pauseAsync();
    }
  }, [castSession, videoUrl, playingNow]);

  // Sync volumeDisplayAnim whenever mute state or volume changes
  useEffect(() => {
    volumeDisplayAnim.setValue(isMuted ? 0 : currentVolumeRef.current);
  }, [isMuted]);

  // Sleep Timer
  useEffect(() => {
    let interval: any;
    if (sleepTimerMs > 0) {
      interval = setInterval(() => {
        setSleepTimerMs(prev => {
          if (prev <= 1000) {
            clearInterval(interval);
            onClose();
            return 0;
          }
          return prev - 1000;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [sleepTimerMs]);

  // Glowing progress bar animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(progressBarGlow, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(progressBarGlow, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Controls Visibility Logic
  const resetControlsTimer = () => {
    if (playerMode === 'full') {
      safeSetNavigationBar('hidden');
    }
    setShowControls(true);
    showControlsRef.current = true;
    setIsControlsMounted(true);
    Animated.timing(controlsOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    controlsTimeout.current = setTimeout(() => {
      if (!isScrubbing) {
        setShowControls(false);
        showControlsRef.current = false;
        Animated.timing(controlsOpacity, { toValue: 0, duration: 500, useNativeDriver: true }).start(({ finished }) => {
            if (finished && !showControlsRef.current) setIsControlsMounted(false);
        });
        if (playerMode === 'full') {
          safeSetNavigationBar('hidden');
        }
      }
    }, 4000);
  };

  const handleToggleControls = () => {
    if (showControlsRef.current) {
      setShowControls(false);
      showControlsRef.current = false;
      Animated.timing(controlsOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(({ finished }) => {
          if (finished && !showControlsRef.current) setIsControlsMounted(false);
      });
      if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
      
      // If we are hiding controls, force-hide the nav bar again (reinforcement)
      if (playerMode === 'full') {
        safeSetNavigationBar('hidden');
      }
    } else {
      resetControlsTimer();
    }
  };



  // Modern Playback Actions
  const handleTogglePlay = () => {
    if (isLocked) return;
    if (status.isLoaded) {
      status.isPlaying ? videoRef.current?.pauseAsync() : videoRef.current?.playAsync();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    resetControlsTimer();
  };

  const handleSeek = async (offsetMs: number) => {
    if (status.isLoaded) {
      const currentPos = status.positionMillis || 0;
      const newPos = Math.max(0, Math.min(status.durationMillis || 0, currentPos + offsetMs));
      await videoRef.current?.setPositionAsync(newPos);
      resetControlsTimer();
    }
  };

  const handleDoubleTap = (event: GestureResponderEvent) => {
    const { locationX } = event.nativeEvent;
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      if (locationX < SCREEN_W / 2) {
        handleSeek(-10000);
      } else {
        handleSeek(10000);
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    lastTapRef.current = now;
  };

  const openAirPlayPicker = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await videoRef.current?.presentFullscreenPlayer();
    } catch (e) {
      Alert.alert(
        "AirPlay Unavailable",
        "AirPlay needs the iOS native route picker in the installed app build."
      );
    }
  }, []);

  const restoreControlsAfterFailedPip = useCallback(() => {
    pipRequestedRef.current = false;
    setIsControlsMounted(true);
    setShowControls(true);
    showControlsRef.current = true;
    controlsOpacity.setValue(1);
  }, [controlsOpacity]);

  const enterAndroidPip = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const pipModule = getPipModule();

    if (pipModule?.enterPipAndGoHome || pipModule?.enterPipMode) {
      pipRequestedRef.current = true;
      pipModule.updatePipParams?.(16, 9, true);
      setShowControls(false);
      showControlsRef.current = false;
      setIsControlsMounted(false);
      controlsOpacity.setValue(0);

      try {
        if (pipModule.enterPipAndGoHome) {
          await pipModule.enterPipAndGoHome();
        } else {
          await pipModule.enterPipMode();
        }
      } catch (e) {
        restoreControlsAfterFailedPip();
        Alert.alert(
          "PiP Unavailable",
          "Android refused to start Picture-in-Picture. Please try again after the video starts playing."
        );
        return;
      }

      setTimeout(() => {
        if (!isPiPActiveRef.current && appStateRef.current === 'active') {
          restoreControlsAfterFailedPip();
        }
      }, 1200);
      return;
    }

    Alert.alert(
      "App Update Required",
      "System Picture-in-Picture needs the latest native app build. Install the new APK, then this button will open video on the phone home screen."
    );
  }, [controlsOpacity, restoreControlsAfterFailedPip]);

  // Gesture Handling (Brightness/Volume/Scrub)
  const gestureStartXRef = useRef(0);
  const gestureStartYRef = useRef(0);
  const gestureStartValueRef = useRef(0);
  const gestureTypeRef = useRef<'brightness' | 'volume' | 'scrub' | 'close' | null>(null);

  const isScrubbingRef = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      // Don't steal touches if timeline/volume is already interacting
      onStartShouldSetPanResponder: (evt) => {
        if (playerMode !== 'full' || isLocked || isInteractingRef.current) return false;
        
        // Exclude bottom controls area (approx bottom 100px)
        const { pageY } = evt.nativeEvent;
        const { height: screenH } = Dimensions.get('window');
        if (pageY > screenH - 110) return false;
        
        return true;
      },
      onMoveShouldSetPanResponder: (_, g) => {
        if (isLocked || isInteractingRef.current) return false;
        return (Math.abs(g.dx) > 20 || Math.abs(g.dy) > 20);
      },
      onPanResponderGrant: (evt, g) => {
        if (isInteractingRef.current) return;
        isInteractingRef.current = true; // Block other responders while this one is active
        const { locationX, pageX, pageY } = evt.nativeEvent;
        gestureStartXRef.current = pageX;
        gestureStartYRef.current = pageY;
        
        const { width: currentW } = Dimensions.get('window');
        // Swapped axis check for rotated player: deltaY is horizontal movement in player view
        if (Math.abs(g.dy) > Math.abs(g.dx)) {
          gestureTypeRef.current = 'scrub';
          if (statusRef.current.isLoaded) {
            scrubPositionRef.current = statusRef.current.positionMillis;
          }
        } else if (g.dy > 0 && Math.abs(g.dy) > Math.abs(g.dx) && playerMode === 'full') {
          // Detect swipe down to close
          gestureTypeRef.current = 'close';
        } else {
          if (pageX < currentW / 2) {
            gestureTypeRef.current = 'brightness';
            Brightness.getBrightnessAsync().then(val => {
              gestureStartValueRef.current = val;
              setCurrentBrightness(val);
              setIsAdjustingBrightness(true);
            });
          } else {
            gestureTypeRef.current = 'volume';
            // Current volume is harder to get instantly, assuming state-based tracker
            gestureStartValueRef.current = currentVolume;
            setIsAdjustingVolume(true);
          }
        }
        resetControlsTimer();
      },
      onPanResponderMove: async (_, g) => {
        if (isLocked) return;
        
        if (gestureTypeRef.current === 'scrub') {
          setIsScrubbing(true);
          const currentStatus = statusRef.current;
          if (currentStatus.isLoaded && currentStatus.durationMillis && progressBarWidth.current > 0) {
            const sensitivity = 0.8;
            // Swapped axis for rotation: dy is scrubbing
            const delta = (g.dy / progressBarWidth.current) * currentStatus.durationMillis * sensitivity;
            const newPos = Math.max(0, Math.min(currentStatus.durationMillis, (scrubPositionRef.current || 0) + delta));
            setScrubPosition(newPos);
          }
        } else if (gestureTypeRef.current === 'brightness') {
          const { width: currentW } = Dimensions.get('window');
          // Swapped axis for rotation: volume/brightness were vertical (Y), now horizontal (X)
          const delta = (g.dx / (currentW * 0.5)); 
          const newValue = Math.max(0, Math.min(1, gestureStartValueRef.current + delta));
          setCurrentBrightness(newValue);
          Brightness.setBrightnessAsync(newValue);
        } else if (gestureTypeRef.current === 'volume') {
          const { width: currentW } = Dimensions.get('window');
          const delta = (g.dx / (currentW * 0.5));
          const newValue = Math.max(0, Math.min(1, gestureStartValueRef.current + delta));
          setCurrentVolume(newValue);
          videoRef.current?.setVolumeAsync(newValue);
        } else if (gestureTypeRef.current === 'close') {
          playerPos.setValue({ x: 0, y: Math.max(0, g.dy) });
        }
        resetControlsTimer();
      },
      onPanResponderRelease: (_, g) => {
        if (gestureTypeRef.current === 'scrub') {
          videoRef.current?.setPositionAsync(scrubPosition);
          setIsScrubbing(false);
        } else if (gestureTypeRef.current === 'close') {
          if (g.dy > 150 || g.vy > 0.5) {
            onClose();
          } else {
            Animated.spring(playerPos, {
              toValue: { x: 0, y: 0 },
              useNativeDriver: false,
            }).start();
          }
        }
        setIsAdjustingBrightness(false);
        setIsAdjustingVolume(false);
        gestureTypeRef.current = null;
        isScrubbingRef.current = false;
        isInteractingRef.current = false;
        resetControlsTimer();
      }
    })
  ).current;


  // Measure-based offsets for absolute precision
  const timelineRef = useRef<View>(null);
  const volumeSliderRef = useRef<View>(null);
  const timelineWidthRef = useRef(1);
  const timelineOffsetXRef = useRef(0);
  const volumeOffsetXRef = useRef(0);

  const measureTimeline = () => {
    timelineRef.current?.measure((x, y, width, height, pageX, pageY) => {
      // In 90deg rotated mode, the bar is vertical on the screen.
      // So pageY is the start offset and height is the length.
      timelineOffsetXRef.current = pageY;
      timelineWidthRef.current = Math.max(1, height);
      setTimelineWidthState(Math.max(1, height));
    });
  };

  const getTimelinePctFromTouch = (
    event: GestureResponderEvent,
    gestureState?: PanResponderGestureState
  ) => {
    const w = Math.max(1, timelineWidthRef.current);
    const { pageX, pageY, locationX, locationY } = event.nativeEvent;
    
    // In 90deg rotated mode, X-axis of player maps to Y-axis of screen.
    const absolutePos = (gestureState && Number.isFinite(gestureState.moveY) && gestureState.moveY !== 0)
      ? gestureState.moveY
      : pageY;

    const touchPos = (Number.isFinite(absolutePos) && timelineOffsetXRef.current > 0)
      ? absolutePos - timelineOffsetXRef.current
      : locationY;

    return Math.max(0, Math.min(1, touchPos / w));
  };

  const updateTimelineScrub = (
    event: GestureResponderEvent,
    gestureState?: PanResponderGestureState,
    shouldUpdateText = false
  ) => {
    const currentStatus = statusRef.current;
    const dur = currentStatus?.isLoaded ? currentStatus.durationMillis || 1 : 1;
    const pct = getTimelinePctFromTouch(event, gestureState);
    const newPos = pct * dur;

    scrubAnimPct.setValue(pct);
    scrubPositionRef.current = newPos;

    // Throttle React state updates to ~60fps to keep JS thread responsive while scrubbing
    const now = Date.now();
    if (shouldUpdateText || now - (lastStateUpdateRef.current || 0) > 16) {
      lastStateUpdateRef.current = now;
      setScrubPosition(newPos);
    }

    return newPos;
  };

  // Apply playback speed persistence
  useEffect(() => {
    if (status.isLoaded && !isScrubbing) {
       videoRef.current?.setRateAsync(playbackSpeed, true).catch(() => {});
    }
  }, [status.isLoaded, playbackSpeed, videoUrl]);

  const timelinePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e, g) => {
        isInteractingRef.current = true;
        isScrubbingRef.current = true;
        setIsScrubbing(true);

        measureTimeline();
        updateTimelineScrub(e, g, true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        resetControlsTimer();
      },
      onPanResponderMove: (e, g) => {
        updateTimelineScrub(e, g);
        resetControlsTimer();
      },
      onPanResponderRelease: (e, g) => {
        const finalPos = updateTimelineScrub(e, g, true);
        setScrubPosition(finalPos);
        videoRef.current?.setPositionAsync(finalPos);
        setIsScrubbing(false);
        isScrubbingRef.current = false;
        isInteractingRef.current = false;
        resetControlsTimer();
      },
      onPanResponderTerminate: () => {
        setIsScrubbing(false);
        isScrubbingRef.current = false;
        isInteractingRef.current = false;
        resetControlsTimer();
      },
      onPanResponderTerminationRequest: () => false,
    })
  ).current;

  const volumePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e, g) => {
        isInteractingRef.current = true;
        // Swapped axis for rotation: use pageY
        const touchY = e.nativeEvent.pageY - volumeOffsetXRef.current;
        const h = volumeSliderWidthRef.current || 90;
        const vol = Math.max(0, Math.min(1, touchY / h));
        volumeDisplayAnim.setValue(vol);
        volumeAnimPct.setValue(vol);
        currentVolumeRef.current = vol;
        if (vol > 0 && isMuted) setIsMuted(false);
      },
      onPanResponderMove: (e, g) => {
        const touchY = e.nativeEvent.pageY - volumeOffsetXRef.current;
        const h = volumeSliderWidthRef.current || 90;
        const vol = Math.max(0, Math.min(1, touchY / h));
        volumeDisplayAnim.setValue(vol);
        currentVolumeRef.current = vol;
        resetControlsTimer();
      },
      onPanResponderRelease: (e, g) => {
        const touchY = e.nativeEvent.pageY - volumeOffsetXRef.current;
        const h = volumeSliderWidthRef.current || 90;
        const vol = Math.max(0, Math.min(1, touchY / h));
        volumeDisplayAnim.setValue(vol);
        currentVolumeRef.current = vol;
        setCurrentVolume(vol);
        if (vol > 0) setIsMuted(false);
        videoRef.current?.setVolumeAsync(vol).catch(() => {});
        isInteractingRef.current = false;
        resetControlsTimer();
      },
      onPanResponderTerminate: () => {
        isInteractingRef.current = false;
        resetControlsTimer();
      },
      onPanResponderTerminationRequest: () => false,
    })
  ).current;

  // Formatting helpers
  const onPlaybackStatusUpdate = React.useCallback((s: AVPlaybackStatus) => {
    statusRef.current = s;
    // Optimized status update: Only update UI-intensive animated values if controls are visible
    if (s.isLoaded && s.durationMillis) {
      if (showControlsRef.current) {
        const bPct = (s.playableDurationMillis || 0) / s.durationMillis;
        bufferedAnimPct.setValue(bPct);
        
        // Update progress bar knob if not scrubbing
        if (!isScrubbingRef.current && s.durationMillis && s.durationMillis > 0) {
          const pct = s.positionMillis / s.durationMillis;
          if (!isNaN(pct)) {
            scrubAnimPct.setValue(pct);
          }
        }
      }
    }

    // Buffering overlay logic optimized to only show on real stalls
    if (s.isLoaded && s.isPlaying && s.isBuffering) {
      if (!isBufferingDelayed && !bufferTimeoutRef.current) {
        (bufferTimeoutRef as any).current = setTimeout(() => {
          setIsBufferingDelayed(true);
        }, 2000); // 2 second delay: only show if the network is really struggling
      }
    } else {
      if (bufferTimeoutRef.current) {
        clearTimeout(bufferTimeoutRef.current);
        (bufferTimeoutRef as any).current = null;
      }
      if (isBufferingDelayed) setIsBufferingDelayed(false);
    }

    // Track AirPlay/external playback state
    if (s.isLoaded && Platform.OS === 'ios') {
      const isExternal = !!(s as any).isExternalPlaybackActive;
      setIsAirPlaying(isExternal);
    }

    // 40-second cutoff for previews (all users as requested)
    if (isPreview && s.isLoaded && s.positionMillis >= 40000) {
      videoRef.current?.pauseAsync();
      return;
    }

    if (s.isLoaded && s.didJustFinish) {
      if (hasNext && onNext) {
        onNext();
      } else if (!isPreview) {
        // Standalone movie or last part finished - track completion
        incrementCompletion().then(count => {
          // Trigger rating modal after the first completed full video if they haven't rated yet.
          if (count >= 1 && !profile.hasRatedApp) {
            DeviceEventEmitter.emit("triggerRating");
          }
        });
      }
    }

    // Memoized showNextSuggestion state update
    if (s.isLoaded && s.durationMillis && hasNext) {
      const remaining = s.durationMillis - s.positionMillis;
      const isNearEnd = remaining < 30000 && remaining > 0;
      if (isNearEnd !== showNextSuggestion) {
        setShowNextSuggestion(isNearEnd);
      }
    } else if (showNextSuggestion) {
      setShowNextSuggestion(false);
    }

    // Error handling
    if (!s.isLoaded && (s as any).error) {
      setError((s as any).error || "An error occurred while loading the video.");
    } else if (s.isLoaded && error) {
      setError(null);
    }

    // Performance Throttle: Only update React state every 1000ms unless critical state changed
    const now = Date.now();
    const prev = lastPushedStateRef.current;

    let forceUpdate = false;
    if (!prev.isLoaded && s.isLoaded) forceUpdate = true;
    else if (prev.isLoaded && s.isLoaded) {
       if (prev.isPlaying !== s.isPlaying) forceUpdate = true;
       if (prev.isBuffering !== s.isBuffering) forceUpdate = true;
       if (prev.durationMillis !== s.durationMillis) forceUpdate = true;
       if (s.didJustFinish) forceUpdate = true;
    } else if (prev.isLoaded !== s.isLoaded) forceUpdate = true;

    if (forceUpdate || now - lastStateUpdateRef.current >= 1000) {
       setStatus(s);
       lastPushedStateRef.current = s;
       lastStateUpdateRef.current = now;
    }
  }, [isPreview, hasNext, onNext, showNextSuggestion, error]);

  // Handle pulse animation for Next Suggestion
  useEffect(() => {
    if (showNextSuggestion) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(nextPulseAnim, {
            toValue: 1.5,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(nextPulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      nextPulseAnim.setValue(1);
    }
  }, [showNextSuggestion]);

  if (playerMode === 'closed') return null;
  const isMini = false; // Forced full-screen in-app as per user request

  // Rendering
  const playerContent = (
    <TouchableWithoutFeedback 
      onPress={isMini ? () => setPlayerMode('full') : handleToggleControls}
      onLongPress={() => {
        if (!isLocked && !isMini) {
          setPlaybackSpeed(2.0);
          videoRef.current?.setRateAsync(2.0, true);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        }
      }}
      onPressOut={() => {
        if (playbackSpeed === 2.0 && playbackSpeedRef.current !== 2.0) {
          setPlaybackSpeed(playbackSpeedRef.current);
          videoRef.current?.setRateAsync(playbackSpeedRef.current, true);
        }
      }}
      onPressIn={!isMini ? handleDoubleTap : undefined}
    >
        {/* Content Container */}
        <View style={styles.contentContainer} {...(!isMini ? panResponder.panHandlers : {})} onLayout={(e) => progressBarWidth.current = e.nativeEvent.layout.width}>
          
          <Video
          ref={videoRef}
          // source={{ uri: videoUrl || "" }} // Removed to prevent double-loading (handled by loadAsync)
          style={styles.absFill}
          resizeMode={videoResizeMode}
          shouldPlay={(playerMode as any) !== 'closed' && (isFocused || isPiPActive)}
          useNativeControls={false}
          {...({ allowsPictureInPicture: true } as any)}
          allowsExternalPlaybackIOS={true}
          staysActiveInBackground={true}
          isMuted={isMuted}
          volume={isMuted ? 0 : currentVolume}
          isLooping={isPreview && !!videoUrl?.includes('b-cdn.net') && videoUrl?.includes('preview.mp4')}
          progressUpdateIntervalMillis={1000}
          {...(Platform.OS === 'android' ? {
            androidImplementation: 'ExoPlayer',
            bufferConfig: {
              minBufferMs: 60000,     // Cache at least 60s
              maxBufferMs: 300000,    // Cache up to 5 mins ahead
              bufferForPlaybackMs: 5000,
              bufferForPlaybackAfterRebufferMs: 10000,
            }
          } : {})}
          onPlaybackStatusUpdate={onPlaybackStatusUpdate}
          rate={playbackSpeed}
          shouldCorrectPitch={true}
        />
        
        {/* Error UI */}
        {error && (
          <View style={[styles.absFill, styles.overlayBackdrop, { zIndex: 200 }]}>
            <BlurViewOptimized intensity={90} tint="dark" style={styles.absFill} />
            <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
            <Text style={styles.errorTitle}>Playback Error</Text>
            <Text style={styles.errorText}>{error}</Text>
             <TouchableOpacity 
              style={styles.retryBtn} 
              onPress={() => {
                setError(null);
                setRetryCount(prev => prev + 1);
              }}
            >
              <Text style={styles.retryBtnText}>TRY AGAIN</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={{ marginTop: 20 }}>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontWeight: '600' }}>GO BACK</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* Offline Indicator Pill */}
        {isOffline && (
          <TouchableOpacity 
            style={styles.offlinePill}
            activeOpacity={0.8}
            onPress={() => {
              // If we have a local match and it's not what's currently playing, we could offer to switch
              // but for now, navigating to downloads is the requested behavior.
              handleDismiss();
              router.push({
                pathname: '/(tabs)/menu',
                params: { section: '5' }
              });
            }}
          >
             <Ionicons name="cloud-offline" size={14} color="#fff" />
             <Text style={styles.offlineText}>
               {localMatch ? "WATCH OFFLINE" : "OFFLINE MODE • BROWSE"}
             </Text>
          </TouchableOpacity>
        )}

        {/* Simple Black Loading Indicator - only for initial load */}
        {(!status.isLoaded) && (playerMode as any) !== 'closed' && (
          <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#000', zIndex: 100 }]}>
            <ActivityIndicator size="large" color="#818cf8" />
            <Text style={{ color: '#fff', marginTop: 10, fontSize: 12, fontWeight: 'bold' }}>LOADING MEDIA...</Text>
          </View>
        )}

        {/* Top-edge Loading Dots (Buffering) - Only shows on actual network stalls */}
        {((isBufferingDelayed && status.isLoaded && (status as any).isPlaying && (status as any).isBuffering) || isBuffering) && (playerMode as any) !== 'closed' && (
           <BufferingDots />
        )}


          {/* Immersive Overlay Components */}
          {!isMini && !isPiPActive && isControlsMounted && (
            <Animated.View style={[styles.absFill, { opacity: controlsOpacity }]} pointerEvents={showControls ? "auto" : "none"}>
              
              {/* Glassmorphic Header */}
              {!isLocked && (
                <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
                  <BlurViewOptimized intensity={25} tint="dark" style={styles.glassHeaderBg} />
                  <TouchableOpacity onPress={handleDismiss} style={styles.backBtn}>
                    <Ionicons name="chevron-down" size={28} color="#fff" />
                  </TouchableOpacity>
                   <View style={styles.titleArea}>
                    <Text style={styles.playerTitle} numberOfLines={1}>{processedTitle}</Text>
                    {processedSubTitle ? <Text style={styles.playerSubTitle}>{processedSubTitle}</Text> : null}
                  </View>
                  <View style={styles.headerActions}>
                    {/* Cast/AirPlay & Timer Group */}
                    <View style={styles.headerActionsGroup}>

                      {/* Google Cast Button (Android) */}
                      {CAN_CAST && Platform.OS === 'android' && (
                        <TouchableOpacity 
                          onPress={() => {
                            const gc = getCastModule();
                            const CastModule = gc?.default || gc;
                            if (CastModule?.CastContext?.showCastPicker) CastModule.CastContext.showCastPicker();
                            else if (CastModule?.showCastPicker) CastModule.showCastPicker();
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          }} 
                          style={styles.headerActionIcon}
                        >
                          <MaterialCommunityIcons 
                            name="cast" 
                            size={26} 
                            color={castSession ? '#818cf8' : '#fff'} 
                          />
                        </TouchableOpacity>
                      )}

                      {/* AirPlay Button (iOS) */}
                      {Platform.OS === 'ios' && (
                        <View style={styles.headerActionIcon}>
                          {AirPlayNative ? (
                            <AirPlayNative style={styles.airPlayHeaderBtn} />
                          ) : (
                            <TouchableOpacity
                              onPress={openAirPlayPicker}
                              style={styles.absFillCenter}
                            >
                              <MaterialCommunityIcons
                                name="cast-audio-variant"
                                size={26}
                                color={isAirPlaying ? '#818cf8' : '#fff'}
                              />
                            </TouchableOpacity>
                          )}
                        </View>
                      )}

                      <TouchableOpacity onPress={() => setShowTimerOptions(true)} style={styles.timerAction}>
                        <Ionicons 
                          name="alarm-outline" 
                          size={26} 
                          color={sleepTimerMs > 0 ? '#818cf8' : '#fff'} 
                        />
                        {sleepTimerMs > 0 && (
                          <View style={styles.timerBadge}>
                            <Text style={styles.timerBadgeText}>
                              {Math.floor(sleepTimerMs / 60000) > 0
                                ? `${Math.floor(sleepTimerMs / 60000)}m`
                                : `${Math.floor(sleepTimerMs / 1000)}s`
                              }
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
                      
                      <View style={styles.headerDivider} />

                      <View style={styles.brandingGroup}>
                         <Image 
                           source={require("@/assets/images/movie_zone_logo_new.png")} 
                           style={styles.headerLogo} 
                           resizeMode="contain"
                         />
                         <View style={styles.brandingTextCol}>
                           <Text style={styles.brandingBrand}>TMZ</Text>
                           <Text style={styles.brandingTag}>24/7</Text>
                         </View>
                      </View>
                    </View>
                  </View>
                </View>
              )}
              
              {/* Central Premium Controls */}
              <View style={styles.centerControls}>
                {!isLocked ? (
                  <>
                    {/* Side Navigation Pills */}
                    <View style={styles.sidePillsContainer}>
                      {hasPrev && onPrev && (
                        <TouchableOpacity onPress={onPrev} style={styles.sidePill}>
                          <BlurViewOptimized intensity={50} tint="dark" style={styles.absFill} />
                          <Ionicons name="play-skip-back" size={14} color="#fff" style={{ marginRight: 6 }} />
                          <Text style={styles.sidePillText}>Prev Episode</Text>
                        </TouchableOpacity>
                      )}
                      <View style={{ flex: 1 }} />
                      {hasNext && onNext && (!status.isLoaded || !status.isPlaying || (status.durationMillis || 0) - status.positionMillis > 45000) && (
                        <TouchableOpacity onPress={onNext} style={styles.sidePill}>
                          <BlurViewOptimized intensity={50} tint="dark" style={styles.absFill} />
                          <Text style={styles.sidePillText}>Next Episode</Text>
                          <Ionicons name="play-skip-forward" size={14} color="#fff" style={{ marginLeft: 6 }} />
                        </TouchableOpacity>
                      )}
                    </View>

                    <View style={styles.controlCapsule}>
                    
                    <TouchableOpacity onPress={() => handleSeek(-10000)} style={styles.seekAction}>
                      <MaterialIcons name="replay-10" size={32} color="#fff" />
                    </TouchableOpacity>
                    
                    <TouchableOpacity onPress={handleTogglePlay} style={styles.playAction}>
                      <View style={styles.playBtnInner}>
                        <Ionicons 
                          name={status.isLoaded && status.isPlaying ? "pause" : "play"} 
                          size={44} 
                          color="#fff" 
                        />
                      </View>
                    </TouchableOpacity>
                    
                    <TouchableOpacity onPress={() => handleSeek(10000)} style={styles.seekAction}>
                      <MaterialIcons name="forward-10" size={32} color="#fff" />
                    </TouchableOpacity>

                  </View>
                  </>
                ) : (
                  <Animated.View style={{ transform: [{ scale: lockPulseAnim }] }}>
                     <TouchableOpacity onPress={() => setIsLocked(false)} style={styles.lockBtnLarge}>
                        <BlurViewOptimized intensity={60} tint="dark" style={styles.glassCircleBg} />
                        <Ionicons name="lock-closed" size={36} color="#fff" />
                     </TouchableOpacity>
                  </Animated.View>
                )}
              </View>

              {/* Skip Intro / Play Next Floating Pill - Only show if suggestion box IS NOT showing to avoid clutter */}
              {status.isLoaded && status.isPlaying && hasNext && onNext && !showNextSuggestion && (status.durationMillis || 0) - status.positionMillis <= 45000 && (
                <View style={styles.nextPillArea}>
                  <TouchableOpacity onPress={onNext} style={styles.nextPill}>
                    <BlurViewOptimized intensity={50} tint="dark" style={styles.absFill} />
                    <Text style={styles.nextPillText}>Next: {processedNextPartName || "Next Episode"}</Text>
                    <Ionicons name="play-skip-forward" size={16} color="#fff" style={{ marginLeft: 8 }} />
                  </TouchableOpacity>
                </View>
              )}

              {/* Modern Footer */}
              <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
                
                {/* Glowing Progress Bar */}
                {!isLocked && (
                  <View style={styles.progressArea}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8 }}>
                       <Image 
                         source={require("@/assets/images/movie_zone_logo_new.png")} 
                         style={{ width: 18, height: 18, borderRadius: 4, opacity: 0.8 }} 
                         resizeMode="contain"
                       />
                    </View>
                    <Text style={styles.timeText}>{formatTime(isScrubbing ? scrubPosition : (status.isLoaded ? status.positionMillis : 0))}</Text>
                    <View style={{ flex: 1, justifyContent: 'center', paddingVertical: 15 }}>
                      <View pointerEvents="none" style={{ justifyContent: 'center' }}>
                        <View style={styles.progressTrack}>
                          {/* Buffered Progress (YouTube Style) */}
                          <Animated.View 
                            style={[
                              styles.bufferedFill, 
                              { 
                                width: bufferedAnimPct.interpolate({ 
                                  inputRange: [0, 1], 
                                  outputRange: ['0%', '100%'],
                                  extrapolate: 'clamp'
                                }) 
                              }
                            ]} 
                          />
                          
                          <Animated.View style={[styles.progressBase, {
                            width: scrubAnimPct.interpolate({ 
                              inputRange: [0, 1], 
                              outputRange: ['0%', '100%'],
                              extrapolate: 'clamp'
                            })
                          }]}>
                            <LinearGradient
                              colors={["#6366f1", "#818cf8"] as any}
                              start={{ x: 0, y: 0.5 }}
                              end={{ x: 1, y: 0.5 }}
                              style={styles.progressFill}
                            />
                            <Animated.View style={[styles.progressGlow, { opacity: progressBarGlow }]} />
                          </Animated.View>
                        </View>
                        {/* Visual Knob - driven by Animated.Value, zero re-renders */}
                        <Animated.View 
                          style={[
                            styles.progressKnob,
                            { transform: [
                                { translateX: scrubAnimPct.interpolate({ 
                                    inputRange: [0, 1], 
                                    outputRange: [0, timelineWidthState || 1],
                                    extrapolate: 'clamp'
                                  }) 
                                },
                                { translateX: -8 } // Center knob (width 16 / 2)
                              ]
                            }
                          ]} 
                        />
                      </View>
                      {/* INVISIBLE TOUCH TARGET WITH NO CHILDREN */}
                      <View 
                        ref={timelineRef}
                        style={styles.timelineContainer} 
                        {...timelinePanResponder.panHandlers}
                        onLayout={() => {
                          measureTimeline();
                        }}
                      />
                    </View>
                    <Text style={styles.timeText}>{formatTime(status.isLoaded ? status.durationMillis || 0 : 0)}</Text>
                  </View>
                )}

                {/* Bottom Actions Row */}
                {!isLocked && (
                  <View style={styles.bottomRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <TouchableOpacity 
                        onPress={() => setIsMuted(prev => !prev)} 
                        style={[styles.footerAction, { marginRight: 8 }]}
                      >
                        <Ionicons name={isMuted || currentVolume === 0 ? "volume-mute" : "volume-high"} size={22} color={isMuted ? 'rgba(255,255,255,0.4)' : '#fff'} />
                      </TouchableOpacity>
                      
                      {/* Horizontal Volume Slider — smooth Animated, no re-renders during drag */}
                      <View 
                        ref={volumeSliderRef}
                        style={styles.miniVolumeSlider} 
                        {...volumePanResponder.panHandlers}
                        onLayout={() => {
                          volumeSliderRef.current?.measure((x, y, width, height, pageX, pageY) => {
                            volumeOffsetXRef.current = pageY;
                            volumeSliderWidthRef.current = height;
                          });
                        }}
                      >
                        <View style={styles.miniVolumeTrack}>
                          <Animated.View style={[styles.miniVolumeFill, {
                            width: volumeDisplayAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: ['0%', '100%'],
                              extrapolate: 'clamp',
                            })
                          }]} />
                        </View>
                        <Animated.View style={[styles.miniVolumeKnob, {
                          left: volumeDisplayAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0%', '100%'],
                            extrapolate: 'clamp',
                          })
                        }]} />
                      </View>
                    </View>

                    <TouchableOpacity onPress={() => setIsLocked(true)} style={styles.footerAction}>
                      <Ionicons name="lock-open-outline" size={22} color="#fff" />
                    </TouchableOpacity>

                    <View style={styles.footerDivider} />

                    {((playingNow && ('seasons' in playingNow || playingNow.type === 'Series')) || !!episodeId || (episodes && episodes.length > 1)) && (
                      <TouchableOpacity onPress={() => setShowEpisodesOverlay(true)} style={styles.footerBadge}>
                        <Text style={styles.badgeText}>Episodes</Text>
                      </TouchableOpacity>
                    )}



                    <View style={{ flex: 1 }} />

                    {/* Circular Action Buttons Group */}
                    <View style={styles.actionsGroup}>
                      {/* PiP Button */}
                      {Platform.OS === 'android' && (
                        <TouchableOpacity 
                          onPress={enterAndroidPip} 
                          style={[styles.circleBtn, isPiPActive && styles.activeCircleBtn]}
                        >
                          <MaterialCommunityIcons 
                            name={isPiPActive ? "picture-in-picture-top-right" : "picture-in-picture-bottom-right"} 
                            size={22} 
                            color={isPiPActive ? "#818cf8" : "#fff"} 
                          />
                        </TouchableOpacity>
                      )}

                      {/* RATIO Button */}
                      <TouchableOpacity 
                        onPress={() => {
                          if (videoResizeMode === ResizeMode.CONTAIN) setVideoResizeMode(ResizeMode.COVER);
                          else if (videoResizeMode === ResizeMode.COVER) setVideoResizeMode(ResizeMode.STRETCH);
                          else setVideoResizeMode(ResizeMode.CONTAIN);
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }} 
                        style={styles.circleBtn}
                      >
                        <MaterialIcons name="aspect-ratio" size={24} color="#fff" />
                      </TouchableOpacity>

                      {/* SPEED Button */}
                      <TouchableOpacity 
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setShowSpeedOverlay(true);
                        }} 
                        style={styles.circleBtn}
                      >
                        <MaterialIcons name="speed" size={24} color="#fff" />
                      </TouchableOpacity>

                      {/* GO BACK Button (1st in corner) */}
                      <TouchableOpacity 
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          onClose();
                        }} 
                        style={[styles.circleBtn, { width: 'auto', paddingHorizontal: 16, flexDirection: 'row', gap: 6 }]}
                      >
                        <Ionicons name="arrow-back" size={20} color="#fff" />
                        <Text style={[styles.badgeText, { fontSize: 13 }]}>Go Back</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>

            {/* Next Episode Suggestion Overlay */}
            {showNextSuggestion && !isLocked && (
              <Animated.View style={styles.nextSuggestionOverlay}>
                <BlurViewOptimized intensity={90} tint="dark" style={styles.nextSuggestionBlur}>
                  <View style={styles.nextSuggestionHeader}>
                    <View style={styles.nextSuggestionBranding}>
                      <Image 
                        source={require("@/assets/images/movie_zone_logo_new.png")} 
                        style={styles.nextSuggestionLogo} 
                        resizeMode="contain"
                      />
                      <Text style={styles.nextSuggestionTitle}>UP NEXT</Text>
                    </View>
                    <TouchableOpacity onPress={() => setShowNextSuggestion(false)} style={styles.nextSuggestionClose}>
                      <Ionicons name="close" size={18} color="rgba(255,255,255,0.4)" />
                    </TouchableOpacity>
                  </View>
                  
                  <View style={styles.nextSuggestionContent}>
                    <View style={styles.nextSuggestionInfo}>
                       <Text style={styles.nextEpisodeName} numberOfLines={1}>
                         {processedNextPartName || "Next Part"}
                       </Text>
                       <View style={styles.nextEpisodeCountdownRow}>
                         <Animated.View style={[
                           styles.countdownPulseDot,
                           { 
                             transform: [{ scale: nextPulseAnim }],
                             opacity: nextPulseAnim.interpolate({
                               inputRange: [1, 1.5],
                               outputRange: [1, 0.6]
                             })
                           }
                         ]} />
                         <Text style={styles.nextEpisodeCountdown}>
                           Starting in {status.isLoaded && status.durationMillis ? Math.ceil((status.durationMillis - status.positionMillis) / 1000) : 0}s
                         </Text>
                       </View>
                    </View>
                    
                    <TouchableOpacity 
                      style={styles.nextPlayBtn} 
                      activeOpacity={0.8}
                      onPress={() => { 
                        setShowNextSuggestion(false); 
                        if (onNext) onNext(); 
                      }}
                    >
                      <LinearGradient
                        colors={["#ef4444", "#dc2626"] as any}
                        style={StyleSheet.absoluteFill}
                      />
                      <Ionicons name="play" size={24} color="#fff" style={{ marginLeft: 3 }} />
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity 
                    style={styles.nextCancelBtn}
                    onPress={() => setShowNextSuggestion(false)}
                  >
                    <Text style={styles.nextCancelText}>CANCEL</Text>
                  </TouchableOpacity>
                </BlurViewOptimized>
              </Animated.View>
            )}
          </Animated.View>
          )}

            {/* Interaction Indicators */}
          {!isPiPActive && isAdjustingBrightness && (
            <View style={styles.verticalIndicatorLeft}>
               <BlurViewOptimized intensity={60} tint="dark" style={styles.indicatorBg} />
               <Ionicons name="sunny" size={20} color="#fff" />
               <View style={styles.indicatorTrack}>
                 <View style={[styles.indicatorFill, { height: `${currentBrightness * 100}%` }]} />
               </View>
            </View>
          )}
          
          {!isPiPActive && isAdjustingVolume && (
            <View style={styles.verticalIndicatorRight}>
               <BlurViewOptimized intensity={60} tint="dark" style={styles.indicatorBg} />
               <Ionicons name="volume-high" size={20} color="#fff" />
               <View style={styles.indicatorTrack}>
                 <View style={[styles.indicatorFill, { height: `${currentVolume * 100}%` }]} />
               </View>
            </View>
          )}

          {/* Premium Episode Sidebar Overlay */}
          {showEpisodesOverlay && episodes.length > 0 && (
            <View style={styles.sidebarOverlay}>
              <TouchableOpacity 
                style={styles.sidebarBackdrop}
                activeOpacity={1}
                onPress={() => setShowEpisodesOverlay(false)}
              >
                <BlurViewOptimized intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
              </TouchableOpacity>

              <ReAnimated.View 
                entering={SlideInRight.springify().damping(20)}
                exiting={SlideOutRight}
                style={styles.sidebarContent}
              >
                <BlurViewOptimized intensity={95} tint="dark" style={StyleSheet.absoluteFill} />
                
                {/* Header */}
                <View style={styles.sidebarHeader}>
                  <View>
                    <Text style={styles.sidebarBrand}>UP NEXT</Text>
                    <Text style={styles.sidebarTitle} numberOfLines={1}>{title}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setShowEpisodesOverlay(false)} style={styles.sidebarClose}>
                    <Ionicons name="close" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>

                <ScrollView 
                  contentContainerStyle={styles.sidebarList} 
                  showsVerticalScrollIndicator={false}
                >
                  {episodes.map((ep, idx) => {
                    const isActive = activeEpisodeId === ep.id;
                    return (
                      <TouchableOpacity 
                        key={ep.id} 
                        style={[
                          styles.epRow, 
                          isActive && styles.epRowActive
                        ]}
                        onPress={() => { 
                          onSelectEpisode?.(ep); 
                          setShowEpisodesOverlay(false); 
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={styles.epRowThumbContainer}>
                          <Image 
                            source={{ uri: ep.poster || (playingNow?.poster) || "" }} 
                            style={styles.epRowThumb} 
                          />
                          {isActive ? (
                            <View style={styles.epRowPlayingOverlay}>
                              <BlurViewOptimized intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
                              <View style={styles.playingIndicator}>
                                <View style={[styles.playingBar, { height: '60%' }]} />
                                <View style={[styles.playingBar, { height: '100%' }]} />
                                <View style={[styles.playingBar, { height: '40%' }]} />
                              </View>
                            </View>
                          ) : (
                            <View style={styles.epRowPlayIcon}>
                              <Ionicons name="play-circle" size={32} color="rgba(255,255,255,0.8)" />
                            </View>
                          )}
                        </View>

                        <View style={styles.epRowInfo}>
                          <Text style={[styles.epRowTitle, isActive && { color: '#818cf8' }]} numberOfLines={2}>
                            {ep.title}
                          </Text>
                          <View style={styles.epRowMeta}>
                            <Text style={styles.epRowDuration}>{ep.duration || "Episode " + (idx + 1)}</Text>
                            {isActive && <View style={styles.activeDot} />}
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </ReAnimated.View>
            </View>
          )}



          {showSpeedOverlay && (
            <TouchableOpacity 
              style={[styles.overlayBackdrop]}
              activeOpacity={1}
              onPress={() => setShowSpeedOverlay(false)}
            >
              <BlurViewOptimized intensity={80} tint="dark" style={styles.absFill} />
              <View style={[styles.overlayContent, { width: '40%' }]}>
                <View style={styles.overlayHeader}>
                  <Text style={styles.overlayTitle}>Playback Speed</Text>
                </View>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 10 }}>
                  {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map(rate => (
                    <TouchableOpacity 
                      key={rate} 
                      style={[styles.speedOption, playbackSpeed === rate && styles.speedOptionActive]}
                      onPress={() => {
                        playbackSpeedRef.current = rate;
                        setPlaybackSpeed(rate);
                        videoRef.current?.setRateAsync(rate, true).catch(() => {});
                        setShowSpeedOverlay(false);
                      }}
                    >
                      <Text style={[styles.speedOptionText, playbackSpeed === rate && { color: '#818cf8' }]}>{rate}x</Text>
                      {playbackSpeed === rate && <Ionicons name="checkmark" size={20} color="#818cf8" />}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </TouchableOpacity>
          )}

          {showTimerOptions && (
            <TouchableOpacity 
              style={[styles.overlayBackdrop]}
              activeOpacity={1}
              onPress={() => setShowTimerOptions(false)}
            >
              <BlurViewOptimized intensity={80} tint="dark" style={styles.absFill} />
              <View style={[styles.overlayContent, { width: '40%' }]}>
                <View style={[styles.overlayHeader, { flexDirection: 'column', alignItems: 'flex-start', gap: 4 }]}>
                  <Text style={styles.overlayTitle}>Sleep Timer</Text>
                  {sleepTimerMs > 0 && (
                    <Text style={styles.timerCountdownLabel}>
                      ⏱ {Math.floor(sleepTimerMs / 60000)}m {Math.floor((sleepTimerMs % 60000) / 1000)}s remaining
                    </Text>
                  )}
                </View>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 10 }}>
                  {[0, 5, 15, 30, 45, 60].map(mins => (
                    <TouchableOpacity 
                      key={mins} 
                      style={[
                        styles.speedOption,
                        selectedTimerMins === mins && mins > 0 && styles.speedOptionActive,
                        selectedTimerMins === mins && mins === 0 && sleepTimerMs === 0 && styles.speedOptionActive,
                      ]}
                      onPress={() => {
                        setSelectedTimerMins(mins);
                        setSleepTimerMs(mins * 60 * 1000);
                        setShowTimerOptions(false);
                      }}
                    >
                      <Text style={[
                        styles.speedOptionText,
                        selectedTimerMins === mins && { color: '#818cf8' }
                      ]}>
                        {mins === 0 ? 'Off' : `${mins} min`}
                      </Text>
                      {selectedTimerMins === mins && (
                        <Ionicons name="checkmark" size={20} color="#818cf8" />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </TouchableOpacity>
          )}

          {showSubtitleOverlay && (
            <TouchableOpacity 
              style={[styles.overlayBackdrop]}
              activeOpacity={1}
              onPress={() => setShowSubtitleOverlay(false)}
            >
              <BlurViewOptimized intensity={80} tint="dark" style={styles.absFill} />
              <View style={[styles.overlayContent, { width: '40%' }]}>
                <View style={styles.overlayHeader}>
                  <Text style={styles.overlayTitle}>Subtitles</Text>
                </View>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 10 }}>
                  <TouchableOpacity 
                    style={[styles.speedOption, selectedSubtitleId === null && styles.speedOptionActive]}
                    onPress={() => {
                      setSelectedSubtitleId(null);
                      setShowSubtitleOverlay(false);
                    }}
                  >
                    <Text style={[styles.speedOptionText, selectedSubtitleId === null && { color: '#818cf8' }]}>Off</Text>
                    {selectedSubtitleId === null && <Ionicons name="checkmark" size={20} color="#818cf8" />}
                  </TouchableOpacity>
                  {subtitles.map(sub => (
                    <TouchableOpacity 
                      key={sub.id} 
                      style={[styles.speedOption, selectedSubtitleId === sub.id && styles.speedOptionActive]}
                      onPress={() => {
                        setSelectedSubtitleId(sub.id);
                        setShowSubtitleOverlay(false);
                      }}
                    >
                      <Text style={[styles.speedOptionText, selectedSubtitleId === sub.id && { color: '#818cf8' }]}>{sub.label}</Text>
                      {selectedSubtitleId === sub.id && <Ionicons name="checkmark" size={20} color="#818cf8" />}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </TouchableOpacity>
          )}
        </View>
    </TouchableWithoutFeedback>
  );

  const renderPlayer = () => {
    const containerStyle: any = {
      ...StyleSheet.absoluteFillObject,
      zIndex: 10000,
      backgroundColor: '#000',
    };

    return (
      <View style={containerStyle}>
        <ExpoStatusBar hidden={true} translucent />
        <Animated.View style={[styles.fullContainer, { elevation: 10000, zIndex: 10000 }]}>
          <View style={styles.virtualLandscapeStage}>
            <View
              style={[
                styles.virtualLandscapeSurface,
                {
                  width: SCREEN_H,
                  height: SCREEN_W,
                  transform: [{ rotate: '90deg' }],
                },
              ]}
            >
              {playerContent}
            </View>
          </View>
        </Animated.View>
      </View>
    );
  };

  if ((playerMode as any) === 'closed') {
    return (
      <View style={{ position: 'absolute', opacity: 0, height: 0, width: 0 }} pointerEvents="none">
        <ExpoStatusBar hidden={false} translucent style="light" />
      </View>
    );
  }

  if (playerMode === 'full' || isClosing) {
    return (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0a0a0f', zIndex: 2147483647, elevation: 1000 }]}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: fullPlayerAnim,
              transform: [
                { translateX: playerPos.x },
                { translateY: playerPos.y },
                { 
                  scale: fullPlayerAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.95, 1]
                  }) 
                }
              ]
            }
          ]}
        >
          <ExpoStatusBar hidden={true} translucent />
          <View style={{ flex: 1, backgroundColor: '#000' }}>
             {renderPlayer()}
          </View>
        </Animated.View>
      </View>
    );
  }


  // The mini-player (in-app floating window) has been removed as per user request.
  // The app now uses System PiP (pop-out to home screen) via staysActiveInBackground.
  return renderPlayer();

  return null;
}

const styles = StyleSheet.create({
  absFill: { ...StyleSheet.absoluteFillObject },
  fullContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
    zIndex: 9999,
  },
  virtualLandscapeStage: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  virtualLandscapeSurface: {
    backgroundColor: "#000",
  },
  miniContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    zIndex: 9999,
    backgroundColor: '#000',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 90,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    zIndex: 10,
  },
  glassHeaderBg: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.8,
  },
  backBtn: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleArea: {
    flex: 1,
    marginLeft: 12,
  },
  playerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  playerSubTitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 16,
  },
  iconAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerControls: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  controlCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 50,
    overflow: 'hidden',
    gap: 30,
  },
  glassCapsuleBg: {
    ...StyleSheet.absoluteFillObject,
  },
  playAction: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playBtnInner: {
    marginLeft: 4,
  },
  seekAction: {
    opacity: 0.8,
  },
  navAction: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  lockBtnLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  glassCircleBg: { ...StyleSheet.absoluteFillObject },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    zIndex: 10,
  },
  progressArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  timeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    width: 45,
    textAlign: 'center',
    opacity: 0.8,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBase: {
    height: '100%',
    position: 'relative',
  },
  progressFill: {
    ...StyleSheet.absoluteFillObject,
  },
  progressGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#818cf8',
    opacity: 0.3,
  },
  timelineContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    zIndex: 20,
  },
  progressKnob: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#818cf8',
    borderWidth: 2,
    borderColor: '#fff',
    transform: [{ translateX: -8 }],
    elevation: 6,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  bufferingDotsContainer: {
    position: 'absolute',
    top: 20,
    left: 0,
    right: 0,
    height: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    gap: 8,
  },
  bufferingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#818cf8',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  bufferingText: {
    color: '#818cf8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginRight: 8,
    opacity: 0.8,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    height: 50,
  },
  footerAction: {
    opacity: 0.8,
  },
  footerDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  footerBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  speedBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  speedText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },
  miniBtn: {
    padding: 8,
  },
  actionsGroup: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  btnWithLabel: {
    alignItems: 'center',
    gap: 4,
  },
  circleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeCircleBtn: {
    backgroundColor: 'rgba(129,140,248,0.22)',
    borderColor: 'rgba(129,140,248,0.55)',
  },
  actionLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 6,
    letterSpacing: 0.5,
  },

  ratioShortText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  speedShortText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  verticalIndicatorLeft: {
    position: 'absolute',
    left: 40,
    top: '25%',
    bottom: '25%',
    width: 40,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    paddingVertical: 15,
    justifyContent: 'space-between',
  },
  verticalIndicatorRight: {
    position: 'absolute',
    right: 40,
    top: '25%',
    bottom: '25%',
    width: 40,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    paddingVertical: 15,
    justifyContent: 'space-between',
  },
  indicatorBg: { ...StyleSheet.absoluteFillObject },
  indicatorTrack: {
    width: 4,
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    marginVertical: 10,
    justifyContent: 'flex-end',
  },
  indicatorFill: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  sidePillsContainer: {
    position: 'absolute',
    left: 40,
    right: 40,
    marginTop: 60,
    flexDirection: 'row',
    alignItems: 'center',
    pointerEvents: 'box-none',
    zIndex: 5,
  },
  sidePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    minWidth: 120,
    justifyContent: 'center',
  },
  sidePillText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  nextPillArea: {
    position: 'absolute',
    bottom: 120,
    right: 40,
    zIndex: 20,
  },
  nextPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  nextPillText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  navButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 40,
    marginBottom: 8,
  },
  navTextBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 120,
    alignItems: 'center',
  },
  navBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  navTextBtnPlaceholder: {
    width: 120,
  },
  overlayBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  overlayContent: {
    width: '60%',
    maxHeight: '85%',
    backgroundColor: 'rgba(15, 15, 20, 0.95)',
    borderRadius: 20,
    overflow: 'hidden',
    padding: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  overlayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  overlayTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  errorTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 16,
  },
  errorText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
  },
  retryBtn: {
    marginTop: 30,
    paddingHorizontal: 32,
    paddingVertical: 14,
    backgroundColor: '#ef4444',
    borderRadius: 30,
    elevation: 4,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  retryBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  // ─── Premium Sidebar Styles ──────────────────────────────────────
  sidebarOverlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    zIndex: 200,
  },
  sidebarBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sidebarContent: {
    width: '38%',
    height: '100%',
    backgroundColor: 'rgba(10, 10, 15, 0.85)',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.1)',
    paddingTop: 30,
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  sidebarBrand: {
    color: '#818cf8',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 4,
  },
  sidebarTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    width: 200,
  },
  sidebarClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sidebarList: {
    paddingHorizontal: 16,
    paddingBottom: 60,
  },
  epRow: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
  },
  epRowActive: {
    backgroundColor: 'rgba(129, 140, 248, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.3)',
  },
  epRowThumbContainer: {
    width: 120,
    height: 68,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#1a1a24',
  },
  epRowThumb: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  epRowPlayingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playingIndicator: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 16,
  },
  playingBar: {
    width: 3,
    backgroundColor: '#818cf8',
    borderRadius: 1,
  },
  epRowPlayIcon: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0, // Shown on hover/press in real app, hidden here for clean look
  },
  epRowInfo: {
    flex: 1,
    marginLeft: 16,
  },
  epRowTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
    marginBottom: 4,
  },
  epRowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  epRowDuration: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '600',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#818cf8',
  },
  relatedCard: {
    width: 120,
  },
  relatedPoster: {
    width: 120,
    height: 180,
    borderRadius: 12,
    backgroundColor: '#111',
  },
  relatedTitle: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
  },
  speedOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  speedOptionActive: {
    backgroundColor: 'rgba(99,102,241,0.12)',
    borderLeftWidth: 3,
    borderLeftColor: '#6366f1',
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  speedOptionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // ─── Inline Volume Slider ─────────────────────────────────────────
  miniVolumeSlider: {
    width: 90,
    height: 32,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  miniVolumeTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
  },
  miniVolumeFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#6366f1',
  },
  miniVolumeKnob: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#818cf8',
    borderWidth: 2,
    borderColor: '#fff',
    marginLeft: -7,
    top: '50%',
    marginTop: -7,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 5,
  },
  // ─── Sleep Timer Badge & Countdown ────────────────────────────────
  timerBadge: {
    marginTop: 3,
    backgroundColor: '#6366f1',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 26,
    alignItems: 'center',
  },
  timerBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  timerCountdownLabel: {
    color: '#818cf8',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  speedOptionActiveIndigo: {
    backgroundColor: 'rgba(99,102,241,0.15)',
    borderLeftWidth: 3,
    borderLeftColor: '#6366f1',
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  airPlayNativeBtn: {
    width: 24,
    height: 24,
  },
  nextSuggestionOverlay: {
    position: 'absolute',
    bottom: 140,
    right: 24,
    width: 230,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.6,
    shadowRadius: 25,
  },
  nextSuggestionBlur: {
    padding: 14,
  },
  nextSuggestionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  nextSuggestionBranding: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nextSuggestionLogo: {
    width: 14,
    height: 14,
    borderRadius: 3,
  },
  nextSuggestionTitle: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  nextSuggestionClose: {
    padding: 2,
  },
  nextSuggestionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  nextSuggestionInfo: {
    flex: 1,
  },
  nextEpisodeName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  nextEpisodeCountdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  countdownPulseDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#6366f1',
  },
  nextEpisodeCountdown: {
    color: '#818cf8',
    fontSize: 11,
    fontWeight: '700',
  },
  nextPlayBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    elevation: 8,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  nextCancelBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  nextCancelText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  // ── Header Actions ──────────────────────────────────────────────
  headerActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.15)',
    gap: 6,
  },
  timerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerActionIcon: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  airPlayHeaderBtn: {
    width: 26,
    height: 26,
  },
  absFillCenter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerDivider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  brandingGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerLogo: {
    width: 22,
    height: 22,
    borderRadius: 6,
  },
  brandingTextCol: {
    flexDirection: 'column',
  },
  brandingBrand: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
    lineHeight: 10,
  },
  brandingTag: {
    color: '#818cf8',
    fontSize: 7,
    fontWeight: '700',
    marginTop: -1,
  },
  bufferedFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
  },
  offlinePill: {
    position: 'absolute',
    top: 100,
    alignSelf: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.85)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 1000,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  offlineText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
});
