import React, { useState, useRef, useEffect, useMemo } from "react";
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
} from "react-native";
import * as SystemUI from "expo-system-ui";
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
// react-native-google-cast uses requireNativeComponent which crashes on web export
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

// Static dimensions for fallback, but we primarily use useWindowDimensions hook inside component
const { width: STATIC_W, height: STATIC_H } = Dimensions.get("window");

// ─── Google Cast Safety Guard ───
const CAN_CAST = (!!NativeModules.RNGCCastContext || !!NativeModules.RNGCastContext) && Platform.OS !== 'web';

// ─── AirPlay Button via iOS native MPVolumeView ───────────────────────────
// MPVolumeView is the standard iOS media route picker — it renders the
// AirPlay icon natively and requires no additional npm packages.
import { requireNativeComponent, ViewStyle } from 'react-native';
let _AirPlayNative: React.ComponentType<{ style?: ViewStyle }> | null = null;
if (Platform.OS === 'ios') {
  try {
    _AirPlayNative = requireNativeComponent('AirPlayButton') as any;
  } catch {
    // Fallback: use a plain TouchableOpacity that opens the system route picker
    _AirPlayNative = null;
  }
}
const AirPlayNative = _AirPlayNative;

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
  isPreview
}: ModernVideoPlayerProps) {
  const { width: SCREEN_W, height: SCREEN_H } = useWindowDimensions();
  const { savePlaybackProgress, getPlaybackProgress } = useUser();
  const insets = useSafeAreaInsets();
  useKeepAwake();
  
  const scrubbingTimeout = useRef<any>(null);
  const hidingTimeoutsRef = useRef<any[]>([]);

  const safeSetNavigationBar = async (visibility: 'visible' | 'hidden') => {
    if (Platform.OS !== 'android') return;

    // Clear any pending hiding attempts immediately if we want to show it
    if (visibility === 'visible') {
      hidingTimeoutsRef.current.forEach(t => clearTimeout(t));
      hidingTimeoutsRef.current = [];
    }

    try {
      if (visibility === 'hidden') {
        await NavigationBar.setBehaviorAsync('sticky-immersive').catch(() => {});
        await NavigationBar.setVisibilityAsync('hidden').catch(() => {});
        
        const t1 = setTimeout(async () => {
          await NavigationBar.setVisibilityAsync('hidden').catch(() => {});
          await NavigationBar.setBackgroundColorAsync('transparent').catch(() => {});
        }, 300);

        const t2 = setTimeout(async () => {
          await NavigationBar.setVisibilityAsync('hidden').catch(() => {});
        }, 1000);

        hidingTimeoutsRef.current.push(t1, t2);
      } else {
        // Atomic Transition: Shift behavior first
        await NavigationBar.setBehaviorAsync('inset-touch').catch(() => {});
        await NavigationBar.setVisibilityAsync('visible').catch(() => {});
        
        // Transparency Lock Burst: Ensuring the OS doesn't force a solid background
        const restorationInterval = setInterval(async () => {
          await NavigationBar.setVisibilityAsync('visible').catch(() => {});
          await NavigationBar.setBackgroundColorAsync('transparent').catch(() => {});
          await NavigationBar.setButtonStyleAsync('light').catch(() => {});
          StatusBar.setHidden(false);
        }, 300);

        // Kill the lock after 2 seconds
        setTimeout(() => {
          clearInterval(restorationInterval);
        }, 2100);

        setTimeout(async () => {
          await NavigationBar.setVisibilityAsync('visible').catch(() => {});
          await NavigationBar.setBehaviorAsync('inset-touch').catch(() => {});
          await NavigationBar.setBackgroundColorAsync('transparent').catch(() => {});
        }, 100);
      }
    } catch (e) {
      console.warn("Navigation Bar Error:", e);
    }
  };
  
  const isFocused = useIsFocused();
  const [appState, setAppState] = useState(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      setAppState(nextAppState);
    });
    return () => subscription.remove();
  }, []);

  const videoRef = useRef<Video>(null);
  const [status, setStatus] = useState<AVPlaybackStatus>({} as AVPlaybackStatus);
  const statusRef = useRef<AVPlaybackStatus>({} as AVPlaybackStatus);
  
  // UI States
  const [showControls, setShowControls] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const playbackSpeedRef = useRef(1.0);
  const volumeSliderWidthRef = useRef(90);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubPosition, setScrubPosition] = useState(0);
  const [videoResizeMode, setVideoResizeMode] = useState<ResizeMode>(ResizeMode.CONTAIN); // CONTAIN (Fit), COVER (Fill), STRETCH (Stretch)
  const [isAirPlaying, setIsAirPlaying] = useState(false);
  
  // Overlays
  const [isBufferingDelayed, setIsBufferingDelayed] = useState(false);
  const bufferTimeoutRef = useRef<any>(null);
  const [showEpisodesOverlay, setShowEpisodesOverlay] = useState(false);
  const [showSpeedOverlay, setShowSpeedOverlay] = useState(false);
  const [showTimerOptions, setShowTimerOptions] = useState(false);
  const [sleepTimerMs, setSleepTimerMs] = useState(0);
  const [selectedTimerMins, setSelectedTimerMins] = useState(0); 

  // Modern Gesture States
  const [isAdjustingBrightness, setIsAdjustingBrightness] = useState(false);
  const [currentBrightness, setCurrentBrightness] = useState(1);
  const [isAdjustingVolume, setIsAdjustingVolume] = useState(false);
  const [currentVolume, setCurrentVolume] = useState(1);
  
  // Animations
  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const lockPulseAnim = useRef(new Animated.Value(1)).current;
  const progressBarGlow = useRef(new Animated.Value(0)).current;
  const skipIntroOpacity = useRef(new Animated.Value(0)).current;
  const lastTapRef = useRef<number>(0);
  // Animated values for smooth knob/fill (no React re-render during drag)
  const scrubAnimPct = useRef(new Animated.Value(0)).current;   // 0..1
  const volumeAnimPct = useRef(new Animated.Value(1)).current;  // 0..1
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

  // Orientation & Status Bar
  useEffect(() => {
    const manageLayout = async () => {
      if (playerMode === 'full') {
        StatusBar.setHidden(true, 'fade');
        if (Platform.OS !== "web") {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        }
        await safeSetNavigationBar('hidden');
      } else {
        StatusBar.setHidden(false, 'fade');
        if (Platform.OS !== "web") {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        }
        await safeSetNavigationBar('visible');
      }
    };
    manageLayout();
    if (playerMode !== 'closed') resetControlsTimer();

    // Auto-animate PIP size/position
    if (playerMode === 'mini') {
      Animated.parallel([
        Animated.spring(playerSize, {
          toValue: 160,
          useNativeDriver: false,
        }),
        Animated.spring(playerPos, {
          toValue: { x: SCREEN_W - 180, y: SCREEN_H - 140 },
          useNativeDriver: false,
        })
      ]).start();
    } else if (playerMode === 'full') {
      Animated.parallel([
        Animated.spring(playerSize, {
          toValue: SCREEN_W,
          useNativeDriver: false,
        }),
        Animated.spring(playerPos, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: false,
        })
      ]).start();
    }

    // Hiding Lockdown Burst: Specifically for the full-screen isolated window
    let hideInterval: any;
    if (playerMode === 'full') {
      const forceHide = async () => {
        if (Platform.OS === 'android') {
          await NavigationBar.setBehaviorAsync('sticky-immersive').catch(() => {});
          await NavigationBar.setVisibilityAsync('hidden').catch(() => {});
          await NavigationBar.setBackgroundColorAsync('transparent').catch(() => {});
          StatusBar.setHidden(true);
        }
      };
      
      forceHide();
      hideInterval = setInterval(forceHide, 500);
      setTimeout(() => clearInterval(hideInterval), 3000);
    }

    return () => { 
      if (controlsTimeout.current) clearTimeout(controlsTimeout.current); 
      if (hideInterval) clearInterval(hideInterval);
    };
  }, [playerMode]);

  // Handle hardware back button
  useEffect(() => {
    if (playerMode === 'full') {
      const handleBackPress = () => {
        onClose();
        return true;
      };
      const subscription = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
      return () => subscription.remove();
    }
  }, [playerMode, onClose]);

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
    if (playerMode !== 'closed' && status.isLoaded && status.isPlaying && movieId) {
      const interval = setInterval(() => {
        savePlaybackProgress(movieId, status.positionMillis, episodeId);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [status.isLoaded, status.isPlaying, movieId, episodeId]);

  // ─── Cast Sync Logic ───
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
    setShowControls(true);
    showControlsRef.current = true;
    Animated.timing(controlsOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    controlsTimeout.current = setTimeout(() => {
      if (!isScrubbing) {
        setShowControls(false);
        showControlsRef.current = false;
        Animated.timing(controlsOpacity, { toValue: 0, duration: 500, useNativeDriver: true }).start();
      }
    }, 4000);
  };

  const handleToggleControls = () => {
    if (showControlsRef.current) {
      setShowControls(false);
      showControlsRef.current = false;
      Animated.timing(controlsOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start();
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

  // Gesture Handling (Brightness/Volume/Scrub)
  const gestureStartXRef = useRef(0);
  const gestureStartYRef = useRef(0);
  const gestureStartValueRef = useRef(0);
  const gestureTypeRef = useRef<'brightness' | 'volume' | 'scrub' | null>(null);

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
        if (Math.abs(g.dx) > Math.abs(g.dy)) {
          gestureTypeRef.current = 'scrub';
          if (statusRef.current.isLoaded) {
            scrubPositionRef.current = statusRef.current.positionMillis;
          }
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
            const delta = (g.dx / progressBarWidth.current) * currentStatus.durationMillis * sensitivity;
            const newPos = Math.max(0, Math.min(currentStatus.durationMillis, (scrubPositionRef.current || 0) + delta));
            setScrubPosition(newPos);
          }
        } else if (gestureTypeRef.current === 'brightness') {
          const { height: currentH } = Dimensions.get('window');
          const delta = -(g.dy / (currentH * 0.5));
          const newValue = Math.max(0, Math.min(1, gestureStartValueRef.current + delta));
          setCurrentBrightness(newValue);
          Brightness.setBrightnessAsync(newValue);
        } else if (gestureTypeRef.current === 'volume') {
          const { height: currentH } = Dimensions.get('window');
          const delta = -(g.dy / (currentH * 0.5));
          const newValue = Math.max(0, Math.min(1, gestureStartValueRef.current + delta));
          setCurrentVolume(newValue);
          videoRef.current?.setVolumeAsync(newValue);
        }
      },
      onPanResponderRelease: () => {
        if (gestureTypeRef.current === 'scrub') {
          videoRef.current?.setPositionAsync(scrubPosition);
          setIsScrubbing(false);
        }
        setIsAdjustingBrightness(false);
        setIsAdjustingVolume(false);
        gestureTypeRef.current = null;
        isScrubbingRef.current = false;
        isInteractingRef.current = false;
      }
    })
  ).current;

  // Timeline specific PanResponder for direct dragging and tapping
  const timelineWidthRef = useRef(1);
  const timelinePanResponder = useRef(
    PanResponder.create({
      // CAPTURE handlers = highest priority, beats any parent responder
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        isInteractingRef.current = true;
        isScrubbingRef.current = true;
        setIsScrubbing(true);
        const touchX = e.nativeEvent.locationX;
        const w = Math.max(1, timelineWidthRef.current);
        const dur = statusRef.current?.durationMillis || 1;
        const pct = Math.max(0, Math.min(1, touchX / w));
        const newPos = pct * dur;
        // Update animated value instantly — no setState, no re-render
        scrubAnimPct.setValue(pct);
        scrubPositionRef.current = newPos;
        setScrubPosition(newPos); // only for time text
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },
      onPanResponderMove: (e) => {
        const touchX = e.nativeEvent.locationX;
        const w = Math.max(1, timelineWidthRef.current);
        const dur = statusRef.current?.durationMillis || 1;
        const pct = Math.max(0, Math.min(1, touchX / w));
        // Only animated value update — zero React renders
        scrubAnimPct.setValue(pct);
        scrubPositionRef.current = pct * dur;
        // Throttle the time-display state update to every ~4 frames
        if (Math.abs(scrubPositionRef.current - (scrubPositionRef as any)._lastDisplayed || 0) > (dur / 200)) {
          (scrubPositionRef as any)._lastDisplayed = scrubPositionRef.current;
          setScrubPosition(scrubPositionRef.current);
        }
      },
      onPanResponderRelease: (e) => {
        const touchX = e.nativeEvent.locationX;
        const w = Math.max(1, timelineWidthRef.current);
        const dur = statusRef.current?.durationMillis || 1;
        const pct = Math.max(0, Math.min(1, touchX / w));
        const finalPos = pct * dur;
        scrubAnimPct.setValue(pct);
        setScrubPosition(finalPos);
        videoRef.current?.setPositionAsync(finalPos);
        setIsScrubbing(false);
        isScrubbingRef.current = false;
        isInteractingRef.current = false;
      },
      onPanResponderTerminate: () => {
        setIsScrubbing(false);
        isScrubbingRef.current = false;
        isInteractingRef.current = false;
      },
      onPanResponderTerminationRequest: () => false,
    })
  ).current;

  // Volume PanResponder — capture priority, zero setState during drag
  const volumePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        isInteractingRef.current = true;
        const touchX = e.nativeEvent.locationX;
        const w = volumeSliderWidthRef.current || 90;
        const vol = Math.max(0, Math.min(1, touchX / w));
        // Only update animated values — NO setState, NO re-render
        volumeDisplayAnim.setValue(vol);
        volumeAnimPct.setValue(vol);
        currentVolumeRef.current = vol;
        // Unmute visually if dragging above 0
        if (vol > 0 && isMuted) setIsMuted(false);
      },
      onPanResponderMove: (e) => {
        const touchX = e.nativeEvent.locationX;
        const w = volumeSliderWidthRef.current || 90;
        const vol = Math.max(0, Math.min(1, touchX / w));
        // Pure Animated update — completely skips React render cycle
        volumeDisplayAnim.setValue(vol);
        currentVolumeRef.current = vol;
      },
      onPanResponderRelease: (e) => {
        const touchX = e.nativeEvent.locationX;
        const w = volumeSliderWidthRef.current || 90;
        const vol = Math.max(0, Math.min(1, touchX / w));
        volumeDisplayAnim.setValue(vol);
        currentVolumeRef.current = vol;
        // Only NOW commit to React state and actual audio
        setCurrentVolume(vol);
        if (vol > 0) setIsMuted(false);
        videoRef.current?.setVolumeAsync(vol).catch(() => {});
        isInteractingRef.current = false;
      },
      onPanResponderTerminate: () => {
        isInteractingRef.current = false;
      },
      onPanResponderTerminationRequest: () => false,
    })
  ).current;

  // Formatting helpers
  const formatTime = (ms: number) => {
    if (!ms || ms < 0) return "0:00";
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

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
        if (playbackSpeed === 2.0) {
          setPlaybackSpeed(1.0);
          videoRef.current?.setRateAsync(1.0, true);
        }
      }}
      onPressIn={!isMini ? handleDoubleTap : undefined}
    >
      <View style={styles.contentContainer} {...(!isMini ? panResponder.panHandlers : {})} onLayout={(e) => progressBarWidth.current = e.nativeEvent.layout.width}>
        
        <Video
          ref={videoRef}
          source={{ uri: videoUrl || "" }}
          style={styles.absFill}
          resizeMode={videoResizeMode}
          shouldPlay={playerMode !== 'closed' && isFocused}
          useNativeControls={false}
          allowsPictureInPicture={true}
          allowsExternalPlaybackIOS={true}
          staysActiveInBackground={true}
          isMuted={isMuted}
          volume={isMuted ? 0 : currentVolume}
          isLooping={isPreview && !!videoUrl?.includes('b-cdn.net') && videoUrl?.includes('preview.mp4')}
          onPlaybackStatusUpdate={s => {
            setStatus(s);
            statusRef.current = s;

            // --- Buffering Delay Logic ---
            if (s.isLoaded && s.isBuffering) {
              if (!bufferTimeoutRef.current) {
                bufferTimeoutRef.current = setTimeout(() => {
                  setIsBufferingDelayed(true);
                }, 1500); // 1.5s delay before showing overlay
              }
            } else {
              if (bufferTimeoutRef.current) {
                clearTimeout(bufferTimeoutRef.current);
                bufferTimeoutRef.current = null;
              }
              setIsBufferingDelayed(false);
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

            if (s.isLoaded && s.isPlaying && s.didJustFinish && hasNext && onNext) {
              onNext();
            }
          }}
        />
        
        {/* Premium Loading Indicator */}
        {((!status.isLoaded && playerMode !== 'closed') || (status.isLoaded && isBufferingDelayed)) && (
          <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100 }]}>
            <ActivityIndicator size="large" color="#5B5FEF" />
            <Text style={{ color: 'rgba(255,255,255,0.7)', marginTop: 12, fontSize: 13, fontWeight: '700', letterSpacing: 1 }}>
              {status.isLoaded ? "BUFFERING..." : "FETCHING STREAM..."}
            </Text>
          </View>
        )}


          {/* Immersive Overlay Components */}
          {!isMini && (
            <Animated.View style={[styles.absFill, { opacity: controlsOpacity }]} pointerEvents={showControls ? "auto" : "none"}>
              
              {/* Glassmorphic Header */}
              {!isLocked && (
                <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
                  <BlurView intensity={25} tint="dark" style={styles.glassHeaderBg} />
                  <TouchableOpacity onPress={onClose} style={styles.backBtn}>
                    <Ionicons name="chevron-down" size={28} color="#fff" />
                  </TouchableOpacity>
                  <View style={styles.titleArea}>
                    <Text style={styles.playerTitle} numberOfLines={1}>{title}</Text>
                    {seriesVj && <Text style={styles.playerSubTitle}>{seriesVj}</Text>}
                  </View>
                  <View style={styles.headerActions}>
                    <TouchableOpacity onPress={() => setShowTimerOptions(true)} style={[styles.iconAction, { alignItems: 'center' }]}>
                      <Ionicons 
                        name="alarm-outline" 
                        size={22} 
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

                  </View>
                </View>
              )}
              
              {/* Central Premium Controls */}
              <View style={styles.centerControls}>
                {!isLocked ? (
                  <View style={styles.controlCapsule}>
                    <BlurView intensity={40} tint="dark" style={styles.glassCapsuleBg} />
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
                ) : (
                  <Animated.View style={{ transform: [{ scale: lockPulseAnim }] }}>
                     <TouchableOpacity onPress={() => setIsLocked(false)} style={styles.lockBtnLarge}>
                        <BlurView intensity={60} tint="dark" style={styles.glassCircleBg} />
                        <Ionicons name="lock-closed" size={36} color="#fff" />
                     </TouchableOpacity>
                  </Animated.View>
                )}
              </View>

              {/* Skip Intro / Play Next Floating Pill */}
              {status.isLoaded && status.isPlaying && hasNext && onNext && (status.durationMillis || 0) - status.positionMillis <= 45000 && (
                <View style={styles.nextPillArea}>
                  <TouchableOpacity onPress={onNext} style={styles.nextPill}>
                    <BlurView intensity={50} tint="dark" style={styles.absFill} />
                    <Text style={styles.nextPillText}>Next: {nextPartName || "Next Episode"}</Text>
                    <Ionicons name="play-skip-forward" size={16} color="#fff" style={{ marginLeft: 8 }} />
                  </TouchableOpacity>
                </View>
              )}

              {/* Modern Footer */}
              <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
                
                {/* Glowing Progress Bar */}
                {!isLocked && (
                  <View style={styles.progressArea}>
                    <Text style={styles.timeText}>{formatTime(isScrubbing ? scrubPosition : (status.isLoaded ? status.positionMillis : 0))}</Text>
                    <View style={{ flex: 1, justifyContent: 'center', paddingVertical: 15 }}>
                      <View pointerEvents="none" style={{ justifyContent: 'center' }}>
                        <View style={styles.progressTrack}>
                          <Animated.View style={[styles.progressBase, {
                            width: (isScrubbing
                              ? scrubAnimPct
                              : new Animated.Value(
                                  status.isLoaded && status.durationMillis
                                    ? status.positionMillis / status.durationMillis
                                    : 0
                                )
                            ).interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
                          }]}>
                            <LinearGradient
                              colors={["#6366f1", "#818cf8"]}
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
                            { left: (isScrubbing ? scrubAnimPct : 
                                new Animated.Value(
                                  status.isLoaded && status.durationMillis 
                                    ? (status.positionMillis / status.durationMillis) 
                                    : 0
                                )
                              ).interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
                            }
                          ]} 
                        />
                      </View>
                      {/* INVISIBLE TOUCH TARGET WITH NO CHILDREN */}
                      <View 
                         style={StyleSheet.absoluteFillObject}
                         {...timelinePanResponder.panHandlers}
                         onLayout={(e) => timelineWidthRef.current = e.nativeEvent.layout.width}
                      />
                    </View>
                    <Text style={styles.timeText}>{formatTime(status.isLoaded ? status.durationMillis : 0)}</Text>
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
                        style={styles.miniVolumeSlider}
                        onLayout={(e) => { volumeSliderWidthRef.current = e.nativeEvent.layout.width; }}
                        {...volumePanResponder.panHandlers}
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
                      <TouchableOpacity onPress={() => setShowSpeedOverlay(true)} style={styles.circleBtn}>
                        <MaterialIcons name="speed" size={24} color="#fff" />
                      </TouchableOpacity>

                      {/* AirPlay Button — iOS only, renders native MPVolumeView route picker */}
                      {Platform.OS === 'ios' && (
                        <View style={[
                          styles.circleBtn,
                          isAirPlaying && { backgroundColor: 'rgba(99,102,241,0.35)', borderColor: '#818cf8' }
                        ]}>
                          {AirPlayNative ? (
                            <AirPlayNative
                              style={styles.airPlayNativeBtn}
                            />
                          ) : (
                            // Graceful fallback: tapping the icon opens AV routes via
                            // the system's built-in picker (works on Expo Go too)
                            <TouchableOpacity
                              onPress={() => {
                                // On iOS, showing AirPlay picker is handled by
                                // allowsExternalPlaybackIOS on the Video component;
                                // long-pressing the system volume brings up routes.
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              }}
                              style={{ justifyContent: 'center', alignItems: 'center', flex: 1 }}
                            >
                              <MaterialCommunityIcons
                                name="cast-audio-variant"
                                size={22}
                                color={isAirPlaying ? '#818cf8' : '#fff'}
                              />
                            </TouchableOpacity>
                          )}
                        </View>
                      )}

                      {/* Expand Button */}
                      <TouchableOpacity 
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }} 
                        style={styles.circleBtn}
                      >
                        <MaterialCommunityIcons name="fullscreen" size={24} color="#fff" />
                      </TouchableOpacity>

                    </View>
                  </View>
                )}
              </View>

            </Animated.View>
          )}

          {/* Interaction Indicators */}
          {isAdjustingBrightness && (
            <View style={styles.verticalIndicatorLeft}>
               <BlurView intensity={60} tint="dark" style={styles.indicatorBg} />
               <Ionicons name="sunny" size={20} color="#fff" />
               <View style={styles.indicatorTrack}>
                 <View style={[styles.indicatorFill, { height: `${currentBrightness * 100}%` }]} />
               </View>
            </View>
          )}
          
          {isAdjustingVolume && (
            <View style={styles.verticalIndicatorRight}>
               <BlurView intensity={60} tint="dark" style={styles.indicatorBg} />
               <Ionicons name="volume-high" size={20} color="#fff" />
               <View style={styles.indicatorTrack}>
                 <View style={[styles.indicatorFill, { height: `${currentVolume * 100}%` }]} />
               </View>
            </View>
          )}

          {/* Overlays */}
          {showEpisodesOverlay && episodes.length > 0 && (
            <TouchableOpacity 
              style={[styles.overlayBackdrop]}
              activeOpacity={1}
              onPress={() => setShowEpisodesOverlay(false)}
            >
              <BlurView intensity={80} tint="dark" style={styles.absFill} />
              <View style={styles.overlayContent}>
                <View style={styles.overlayHeader}>
                  <Text style={styles.overlayTitle}>Episodes</Text>
                  <TouchableOpacity onPress={() => setShowEpisodesOverlay(false)} style={styles.overlayClose}>
                    <Ionicons name="close" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>
                <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                  {episodes.map((ep, idx) => (
                    <TouchableOpacity 
                      key={ep.id} 
                      style={[styles.epItem, activeEpisodeId === ep.id && styles.epItemActive]}
                      onPress={() => { onSelectEpisode?.(ep); setShowEpisodesOverlay(false); }}
                    >
                      <Image source={{ uri: ep.poster || "" }} style={styles.epThumb} />
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[styles.epTitle, activeEpisodeId === ep.id && { color: '#818cf8' }]} numberOfLines={1}>{ep.title}</Text>
                        <Text style={styles.epSub}>{ep.duration || "..."}</Text>
                      </View>
                      {activeEpisodeId === ep.id && <Ionicons name="play-circle" size={20} color="#818cf8" />}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </TouchableOpacity>
          )}



          {showSpeedOverlay && (
            <TouchableOpacity 
              style={[styles.overlayBackdrop]}
              activeOpacity={1}
              onPress={() => setShowSpeedOverlay(false)}
            >
              <BlurView intensity={80} tint="dark" style={styles.absFill} />
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
              <BlurView intensity={80} tint="dark" style={styles.absFill} />
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
        </View>
    </TouchableWithoutFeedback>
  );

  const renderPlayer = () => {
    const containerStyle: any = {
      position: 'absolute',
      top: 0,
      left: 0,
      width: SCREEN_W,
      height: SCREEN_H,
      zIndex: 10000,
      backgroundColor: '#000',
    };

    return (
      <View style={containerStyle}>
        <ExpoStatusBar hidden={true} translucent />
        <Animated.View style={[styles.fullContainer, { elevation: 10000, zIndex: 10000 }]}>
          {playerContent}
        </Animated.View>
      </View>
    );
  };

  if (playerMode === 'closed') {
    return (
      <View style={{ position: 'absolute', opacity: 0, height: 0, width: 0 }} pointerEvents="none">
        <ExpoStatusBar hidden={false} translucent style="light" />
      </View>
    );
  }

  if (playerMode === 'full') {
    return (
      <RNModal
        visible={true}
        transparent={false}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => onClose()}
      >
        <View 
          style={[
            StyleSheet.absoluteFill, 
            { 
              backgroundColor: '#000', 
              zIndex: 2147483647, 
              elevation: 1000 
            }
          ]}
          onLayout={() => {
            if (Platform.OS === 'android') {
              NavigationBar.setVisibilityAsync('hidden').catch(() => {});
              NavigationBar.setBehaviorAsync('sticky-immersive').catch(() => {});
              StatusBar.setHidden(true);
            }
          }}
        >
          <ExpoStatusBar hidden={true} translucent />
          {renderPlayer()}
        </View>
      </RNModal>
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
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  playBtnInner: {
    marginLeft: 4,
  },
  seekAction: {
    opacity: 0.8,
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
    fontSize: 22,
    fontWeight: '800',
  },
  overlayClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  epItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  epItemActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginVertical: 4,
    borderBottomWidth: 0,
  },
  epThumb: {
    width: 100,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#111',
  },
  epTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  epSub: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    marginTop: 2,
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
});

