import React, { useRef, useState, useCallback, useEffect, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Image,
  TouchableOpacity,
  FlatList,
  Dimensions,
  Platform,
  StatusBar,
  PanResponder,
  TextInput,
  KeyboardAvoidingView,
  Animated,
  Modal,
  SafeAreaView,
  TouchableWithoutFeedback,
  RefreshControl,
  DeviceEventEmitter,
  Keyboard,
  Alert,
  Linking,
  Share,
  Easing,
  BackHandler,
  AppState,
  LayoutAnimation,
  UIManager,
  NativeModules,
  ActivityIndicator
} from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';


import { 
  Ionicons, 
  MaterialIcons, 
  MaterialCommunityIcons, 
  FontAwesome5,
  Feather
} from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as NavigationBar from 'expo-navigation-bar';
import * as SystemUI from 'expo-system-ui';
import * as ScreenOrientation from "expo-screen-orientation";

import * as Haptics from "expo-haptics";
import * as Application from "expo-application";
import * as MediaLibrary from "expo-media-library";
import * as Updates from "expo-updates";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import { useIsFocused } from "@react-navigation/native";
import {
  
  HERO_MOVIES,
  NEW_RELEASES,
  TRENDING,
  MOST_VIEWED,
  MOST_DOWNLOADED,
  LATEST,
  CONTINUE_WATCHING,
  FAVOURITES,
  MY_LIST,
  WATCH_LATER,
  YOU_MAY_ALSO_LIKE,
  LAST_WATCHED,
  TRENDING_SERIES,
  MOST_VIEWED_SERIES,
  MOST_DOWNLOADED_SERIES,
  Movie,
  Series,
  ALL_SERIES,
  ALL_ROWS,
  ALL_GENRES,
  ALL_VJS,
  NEW_SERIES,
  shortenGenre,
  getStreamUrl,
  resolveCDNUrl,
} from "@/constants/movieData";
import { 
  GridCard, 
  GridModal, 
  GridContent 
} from "../../components/GridComponents";
import { useSubscription } from "@/app/context/SubscriptionContext";
import { useMovies } from "@/app/context/MovieContext";
import { useDownloads } from "@/app/context/DownloadContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUser } from "../context/UserContext";
import { 
  doc, 
  getDoc, 
  updateDoc, 
  increment, 
  serverTimestamp, 
  setDoc, 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot 
} from 'firebase/firestore';
import { db, auth } from "../../constants/firebaseConfig";
import { useKeepAwake, activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { formatRelativeTime } from "../../utils/TimeUtils";
import PremiumAccessModal from "../../components/PremiumAccessModal";
import PlanSelectionModal from "../../components/PlanSelectionModal";
import DeviceManagerModal from "../../components/DeviceManagerModal";
import GoogleCast, { CastContext, CastState, useCastState } from "react-native-google-cast";

import { ExpiryReminderModal } from "../../components/ExpiryReminderModal";

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  try {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  } catch (e) {}
}

// ─── Google Cast Safety Guard ────────────────────────────────────────────────
// In Expo Go or if improperly configured on Android, Native module might be null,
// causing "Cannot read property 'getCastState' of null" crashes.
const CAN_CAST = (!!NativeModules.RNGCCastContext || !!NativeModules.RNGCastContext) && Platform.OS !== 'web';

// ─── Navigation Bar Safety Guard ─────────────────────────────────────────────
const safeSetNavigationBar = async (visibility: 'visible' | 'hidden') => {
  if (Platform.OS !== 'android') return;
  
  // Crucial: Check if the native module is actually in the binary.
  // Using require() on an expo module whose native counterpart is missing
  // can cause a fatal crash even inside a try-catch.
  const isAvailable = !!NativeModules.ExpoNavigationBar;
  if (!isAvailable) return;

  try {
    // Dynamic require to prevent top-level crash
    const NavigationBar = require('expo-navigation-bar');
    if (visibility === 'hidden') {
      await NavigationBar.setVisibilityAsync('hidden');
      // 'sticky-immersive' is better for video as it auto-hides the bars 
      // after a few seconds if the user swipes them in.
      await NavigationBar.setBehaviorAsync('sticky-immersive');
    } else {
      await NavigationBar.setVisibilityAsync('visible');
    }
  } catch (e) {
    // console.log('NavigationBar native module not found. Rebuild your dev client.');
  }
};

let Brightness: any = null;
try {
  // We use require to avoid fatal crash if native module is missing
  if (NativeModules.ExpoBrightness || Platform.OS === 'web') {
    Brightness = require('expo-brightness');
  }
} catch (e) {
  // Safe fail
}

function useSafeCastState() {
  return null;
  /*
  if (!CAN_CAST) return null;
  try {
    return useCastState();
  } catch (e) {
    console.warn("Google Cast hook error:", e);
    return null;
  }
  */
}

function ModalSystemUIRestorer() {
  const { playerMode } = useSubscription();

  useEffect(() => {
    if (playerMode === 'closed' || playerMode === 'mini') {
      const restore = async () => {
        if (Platform.OS === 'android') {
          try {
            await NavigationBar.setBehaviorAsync('inset-touch').catch(() => {});
            await NavigationBar.setVisibilityAsync('visible').catch(() => {});
            await NavigationBar.setBackgroundColorAsync('transparent').catch(() => {});
          } catch (e) {}
        }
      };
      restore();
      const interval = setInterval(restore, 600);
      const timeout = setTimeout(() => clearInterval(interval), 2000);
      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [playerMode]);

  return null;
}


const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const HERO_H = SCREEN_H * 0.55;

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0f",
  },
  topBarWrapper: {
    position: "absolute",
    top: Platform.OS === "ios" ? 44 : (StatusBar.currentHeight ?? 0) + 4,
    left: 16,
    right: 16,
    zIndex: 20,
  },
  topBarBlur: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 30,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  appName: {
    color: "#fff",
    fontSize: 12, // Reduced size
    fontWeight: "800",
    letterSpacing: 1.0,
    textShadowColor: "rgba(0, 0, 0, 0.85)", // High contrast shadow
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 4,
  },
  searchIcon: { padding: 4 },
  dropShadow: {
    textShadowColor: "rgba(0, 0, 0, 0.85)",
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 4,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 0 },

  // ── Event Banner ──
  eventBannerContainer: {
    marginHorizontal: 20,
    marginTop: Platform.OS === 'ios' ? 64 : 74,
    marginBottom: 10, 
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
    zIndex: 100,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
  },
  eventBannerContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    // Removed padding to allow marquee to reach edges
  },
  eventBadge: {
    position: "absolute",
    left: 8,
    zIndex: 100,
    backgroundColor: "#e11d48",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  eventBadgeText: {
    color: "#fff",
    fontSize: 8.5,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  eventMessageText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    flex: 1,
    letterSpacing: 0.1,
  },
  animatedMessage: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 20, // Increased buffer to start further right
    zIndex: 1, // Below badge
  },
  eventBadgePulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#22c55e",
    marginLeft: 8,
    shadowColor: "#22c55e",
  },

  // ── Hero video ──
  heroVideo: {
    width: SCREEN_W,
    height: SCREEN_H * 0.65, // Increase video height so it fills down closer to the rows
    backgroundColor: "#111",
  },
  videoDotsInline: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: 20,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  dotActive: { backgroundColor: "#fff", width: 18 },

  // ── Hero info ──
  heroInfoOverlay: {
    position: "absolute",
    bottom: 0,
    top: 0,
    width: "100%",
    zIndex: 15,
    justifyContent: "flex-end",
    paddingBottom: 20, // Tighter padding for metadata inclusion
  },
  heroMetadataRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
  },
  heroMetaText: {
    color: "rgba(255,255,255,0.95)",
    fontSize: 12,
    fontWeight: "600",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  heroMetaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  heroActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
    marginTop: 18,
  },
  heroSecondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255, 255, 255, 0.05)", // Design 3
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 50, // Standardized pill
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    overflow: "hidden",
  },
  heroSecondaryBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  heroIndigoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#5B5FEF", // Vibrant Indigo
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    overflow: "hidden",
    shadowColor: "#5B5FEF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  heroIndigoBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  heroInfoCenteredContent: {
    alignItems: "center",
    paddingHorizontal: 20,
  },
  largePlayBtnContainer: {
    marginBottom: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  largePlayBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(0, 206, 254, 0.15)",
    borderWidth: 1.5,
    borderColor: "rgba(0, 206, 254, 0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "300",
    textAlign: "center",
    marginBottom: 24,
    textTransform: "uppercase",
    letterSpacing: 4,
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  watchNowBtn: {
    backgroundColor: "rgba(255, 255, 255, 0.05)", // Frosted Dark (Design 3)
    paddingHorizontal: 36,
    paddingVertical: 14,
    borderRadius: 50,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  watchNowText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  heroPulseRing: {
    position: "absolute",
    width: "120%",
    height: "140%",
    borderRadius: 60,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.4)",
  },
  heroMuteBtn: {
    position: "absolute",
    bottom: 20,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  previewMuteBtn: {
    position: "absolute",
    top: 20,
    left: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    zIndex: 10,
  },
  tagsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  heroActionCol: {
    alignItems: "center",
    gap: 6,
    width: 80,
  },
  heroActionIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  heroActionLabel: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  outlinedPill: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#00cefe",
    minWidth: 80,
    alignItems: "center",
  },
  outlinedPillText: {
    color: "#00cefe",
    fontSize: 12,
    fontWeight: "600",
  },
  iconBtnMinimal: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 4,
  },
  heroButtons: {
    flexDirection: "row",
    alignItems: "center",
  },

  // ── Comment toggle button (in tags row) ──
  commentToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: "rgba(91,95,239,0.12)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(91,95,239,0.35)",
  },
  commentToggleBtnActive: {
    backgroundColor: "#e50914",
    borderColor: "#e50914",
  },
  commentToggleText: {
    color: "#ff4b4b",
    fontSize: 11,
    fontWeight: "700",
  },
  commentToggleTextActive: {
    color: "#fff",
  },

  // ── Comments ──
  commentsSection: {
    backgroundColor: "#0a0a0f",
    paddingHorizontal: 18,
    paddingTop: 26,
    paddingBottom: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.05)",
  },
  commentsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 18,
  },
  commentsTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 2,
  },
  commentsSub: { color: "#475569", fontSize: 12, fontWeight: "500" },
  avgBadge: {
    alignItems: "center",
    backgroundColor: "rgba(255,215,0,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.2)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  avgScore: { color: "#FFD700", fontSize: 20, fontWeight: "900" },

  commentCard: {
    marginBottom: 20,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    overflow: "hidden",
  },
  commentCardInner: {
    flex: 1,
    flexDirection: "row",
    gap: 12,
    padding: 16,
  },
  commentAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#1e293b",
  },
  commentHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
    flexWrap: "wrap",
  },
  commentUser: { color: "#e2e8f0", fontSize: 13, fontWeight: "700" },
  commentTime: { color: "#475569", fontSize: 11, marginLeft: "auto" },
  commentText: {
    color: "#94a3b8",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 8,
  },
  likeRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  likeText: { color: "#475569", fontSize: 12, fontWeight: "500" },

  // ── Input ──
  inputCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    overflow: "hidden",
    marginBottom: 20,
  },
  inputCardInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
  },
  inputAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#1e293b",
  },
  inputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
    minHeight: 48,
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: "#e2e8f0",
    fontSize: 14,
    textAlignVertical: "center",
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#e50914",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
  },

  // ── Movie rows ──
  rowContainer: { marginTop: 10 },
  rowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 5,
  },
  resultsCountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 50,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    backgroundColor: "rgba(2, 2, 5, 0.85)",
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
  },
  resultsCountText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  sectionHeaderBadge: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 50,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    flexDirection: "row",
    alignItems: "center",
  },
  rowTitle: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  seeAllBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(91, 95, 239, 0.25)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    overflow: "hidden",
    shadowColor: "#5B5FEF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
  },
  seeAllText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  rowList: { paddingHorizontal: 16, gap: 6 },

  // ── Movie card ──
  card: {
    width: (SCREEN_W - 44) / 3,
    marginRight: 0,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginBottom: 4,
  },
  cardPoster: {
    width: "100%",
    height: 150,
    resizeMode: "cover",
  },
  cardInfo: {
    padding: 6,
    alignItems: "center",
  },
  cardTitle: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 2,
  },
  cardMetadata: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 9,
    fontWeight: "600",
    textAlign: "center",
  },
  vjBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  vjBadgeText: { color: "#fff", fontSize: 8, fontWeight: "900" },
  epBadgePremium: {
    position: "absolute",
    bottom: 6,
    right: 6,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: "rgba(0,0,0,0.7)",
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  epBadgeTextPremium: {
    color: "#FFC107",
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  genreBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  genreBadgeText: { color: "#fff", fontSize: 8, fontWeight: "900" },
  lockBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  cardProgressBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  cardProgressBarFill: {
    height: '100%',
    backgroundColor: '#ef4444',
  },

  // ── See-All Grid Modal ──
  gridModalContainer: { flex: 1, backgroundColor: "#0a0a0f" },
  gridModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  gridModalBack: { padding: 4, marginRight: 4 },
  gridModalTitle: {
    flex: 1,
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  gridModalCount: { color: "#475569", fontSize: 12, fontWeight: "600" },
  gridList: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    paddingTop: 10,
  },
  gridRow: { justifyContent: "flex-start", gap: 6 },
  gridCard: {
    marginBottom: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  gridPoster: {
    width: "100%",
    resizeMode: "cover",
  },

  // ── Grid Modal search bar ──
  gridModalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  gridModalHeaderIconBtn: {
    padding: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  gridModalSearchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    height: 38,
  },
  gridModalSearchInput: {
    flex: 1,
    color: "#fff",
    fontSize: 16,
    paddingHorizontal: 4,
  },
  gridModalClearBtn: {
    padding: 4,
  },

  // ── Search overlay ──
  searchOverlayContainer: { flex: 1, backgroundColor: "#0a0a0f" },
  searchOverlayHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop:
      Platform.OS === "ios" ? 10 : (StatusBar.currentHeight ?? 0) + 10,
    paddingBottom: 10,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  headerIconBtn: {
    padding: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    height: 38,
  },
  searchInput: {
    flex: 1,
    color: "#fff",
    fontSize: 16,
    paddingHorizontal: 4,
  },
  clearBtn: {
    padding: 4,
  },
  searchResultBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  searchResultCount: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "600",
  },
  searchEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 80,
    gap: 10,
  },
  searchEmptyText: {
    color: "#64748b",
    fontSize: 16,
    fontWeight: "700",
  },
  searchEmptySub: {
    color: "#1e293b",
    fontSize: 13,
    fontWeight: "500",
  },

  // ── Unified Search Capsule (used in modals) ──
  searchHeaderCapsule: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    marginTop: Platform.OS === "ios" ? 0 : 10,
  },
  searchBackBtn: {
    backgroundColor: "rgba(10, 10, 15, 0.95)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  searchInputCapsule: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    height: 44,
    backgroundColor: "rgba(10, 10, 15, 0.95)",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  universalSearchInput: {
    flex: 1,
    color: "#fff",
    fontSize: 14,
    paddingHorizontal: 12,
  },

  // ── Movie Preview Modal (full-screen) ──
  previewFullContainer: {
    flex: 1,
    backgroundColor: "#0a0a0f",
  },
  previewPoster: {
    width: "100%",
    height: 300,
    backgroundColor: "#1e1e2e",
  },
  previewPosterFade: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  previewSearchBtn: {
    position: "absolute",
    top: 14,
    left: 14,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 22,
    padding: 8,
    zIndex: 5,
  },
  previewClose: {
    position: "absolute",
    top: 14,
    right: 14,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 22,
    padding: 8,
    zIndex: 5,
  },
  previewContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 10,
  },
  previewTags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  previewTagBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 50,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    flexDirection: "row",
    alignItems: "center",
  },
  previewTagText: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  previewTitle: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  previewMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  previewRating: { color: "#FFD700", fontSize: 13, fontWeight: "700" },
  previewDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "#334155",
  },
  previewMetaText: { color: "#64748b", fontSize: 13 },
  previewDesc: { color: "#94a3b8", fontSize: 14, lineHeight: 20 },
  posterPlayBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.7)",
    overflow: "hidden",
  },
  previewSearchSection: {
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 4,
  },
  previewSearchOverride: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  previewSearchEmpty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12,
  },
  previewActions: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
    gap: 16,
    marginTop: 10,
    width: "100%",
  },
  previewActionCol: { alignItems: "center", gap: 6 },
  previewActionIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  previewActionLabel: { color: "#94a3b8", fontSize: 11, fontWeight: "600" },

  // ── Related / Browse sections ──
  relatedSection: {
    marginTop: 15,
    paddingBottom: 4,
  },
  relatedTitle: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.2,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  relatedTitleInline: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.2,
    marginRight: 6,
  },
  browseFilterScroll: {
    paddingHorizontal: 16,
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  browseFilterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 50,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  browseFilterPillActive: {
    backgroundColor: "#5B5FEF", // Indigo
    borderColor: "rgba(255,255,255,0.4)",
  },
  browseFilterPillText: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  browseFilterPillTextActive: {
    color: "#fff",
    fontWeight: "800",
  },
  relatedList: {
    paddingHorizontal: 16,
    gap: 6,
  },
  browseSectionChips: {
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 14,
  },
  browseSectionChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 50,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  browseSectionChipActive: {
    backgroundColor: "#5B5FEF",
    borderColor: "rgba(255,255,255,0.4)",
  },
  browseSectionChipText: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  browseSectionChipTextActive: {
    color: "#fff",
    fontWeight: "800",
  },

  universalSearchBottomPill: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(2, 2, 5, 0.96)",
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    zIndex: 1000,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.22)",
  },
  searchBackBtnSmall: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  searchInnerCapsule: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    height: 40,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  bottomSearchInput: {
    flex: 1,
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
    paddingHorizontal: 12,
  },
  floatingTopBackBtn: {
    position: "absolute",
    top: 50,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
  },
  pillSheen: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "50%",
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
  },

  // ── Download Modal ──
  downloadModalCentering: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  downloadGlassCard: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 32,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
    elevation: 10,
  },
  downloadIconHeader: {
    marginBottom: 20,
  },
  downloadIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(91, 95, 239, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(91, 95, 239, 0.3)",
  },
  downloadTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  downloadSub: {
    color: "#94a3b8",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 28,
  },
  downloadActions: {
    width: "100%",
    gap: 12,
  },
  downloadPrimaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    shadowColor: "#5B5FEF",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
  downloadPrimaryBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  downloadSecondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.15)",
  },
  downloadSecondaryBtnText: {
    color: "#94a3b8",
    fontSize: 16,
    fontWeight: "600",
  },
  downloadCancelLink: {
    marginTop: 8,
    padding: 8,
  },
  downloadCancelText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    opacity: 0.8,
  },
  // Movie Parts / Episodes styling
  episodesSection: {
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
    paddingTop: 8,
  },
  premiumHeaderOuterPill: {
    height: 46,
    borderRadius: 23,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    backgroundColor: "rgba(10, 10, 15, 0.4)",
    shadowColor: "#5B5FEF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
    width: "100%",
  },
  premiumHeaderInner: {
    flexDirection: "row",
    alignItems: "center",
    height: "100%",
    paddingHorizontal: 16,
    gap: 8,
  },
  episodesTitlePremium: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  epCountPillPremium: {
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    paddingHorizontal: 8,
    paddingVertical: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  epCountTextPremium: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "900",
  },
  episodeItemPremium: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 18,
    marginBottom: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
    backgroundColor: "rgba(30, 30, 45, 0.4)",
  },
  epThumbWrapPremiumLarge: {
    width: 140,
    height: 80,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#1e1e2e",
    borderWidth: 1.2,
    borderColor: "rgba(255,255,255,0.6)",
  },
  epThumb: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  epThumbPlayIconOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  epDurationBadgePremiumSmall: {
    position: "absolute",
    bottom: 6,
    right: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  epDurationTextPremium: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
  },
  epInfoPremium: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  epTitlePremium: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.1,
    marginBottom: 4,
  },
  epMetaRowSmall: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  epStatusBadgeSmall: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.2)",
  },
  epStatusTextSmall: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 8,
    fontWeight: "900",
  },
  epSubPremiumSmall: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 11,
    fontWeight: "600",
  },
  // Full Player Modal
  fullPlayerContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  fullPlayerInner: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  fullPlayerVideoWrapper: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: "#000",
    overflow: "hidden",
  },
  fullPlayerVideo: {
    width: '100%',
    height: '100%',
    flex: 1,
  },
  playerControlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
    padding: 16,
  },
  playerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 10,
    paddingHorizontal: 16,
  },
  playerBackBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  playerTitleContainer: {
    flex: 1, // Takes remaining space in the row
    marginLeft: 28, // Offset from the back button to achieve ~72px total left gap
    justifyContent: 'center',
    height: 44,
  },
  playerHeaderRightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  playerTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "left",
  },
  playerCenterControls: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -30,
    marginTop: -30,
    width: 60,
    height: 60,
    justifyContent: "center",
    alignItems: "center",
  },
  playerSeekBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  playerPlayBtnLarge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(91, 95, 239, 0.4)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  premiumLockButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(91, 95, 239, 0.4)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  playerFooter: {
    marginBottom: 10,
  },
  playerProgressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  playerProgressBarContainer: {
    flex: 1,
    height: 30,
    justifyContent: "center",
  },
  playerProgressBarOuter: {
    width: "100%",
    height: 3,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 1.5,
    overflow: "hidden",
    position: "relative",
  },
  playerProgressBarBuffer: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 255, 255, 0.35)",
    borderRadius: 1.5,
  },
  playerProgressBarInner: {
    height: "100%",
    backgroundColor: "#5B5FEF",
  },
  playerProgressBarThumb: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#fff",
    marginLeft: -6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 2,
    elevation: 4,
  },
  playerTimeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    width: 35,
    textAlign: "center",
  },
  playerHeaderIconBtn: {
    flexDirection: 'row',
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  playerFooterIconBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  playerBtnLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    opacity: 0.9,
  },
  playerLockBtnLarge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(91, 95, 239, 0.4)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  playerBottomToolRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    marginTop: 10,
  },
  playerSpeedBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  playerSpeedText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  sleepTimerBadgeText: {
    color: '#e11d48',
    fontSize: 9,
    fontWeight: '900',
    marginTop: -2,
  },
  playerNextEpBtn: {
    backgroundColor: 'rgba(225, 29, 72, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(225, 29, 72, 0.4)',
    alignItems: 'center',
  },
  playerNextEpBtnLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 8,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  playerNextEpBtnValue: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  sleepTimerMenuPopup: {
    position: 'absolute',
    top: 60,
    right: 60,
    width: 140,
    backgroundColor: 'rgba(30, 30, 40, 0.98)',
    borderRadius: 14,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sleepTimerPopupItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  sleepTimerPopupText: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '600',
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  epTitleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "rgba(91,95,239,0.15)",
    borderWidth: 1,
    borderColor: "rgba(91,95,239,0.3)",
  },
  epTitleBadgeText: {
    color: "#5B5FEF",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  relatedGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    marginTop: 10,
  },
  relatedCard: {
    width: (SCREEN_W - 48) / 3,
    aspectRatio: 2/3,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  relatedPoster: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
});

// ─── Seed comments ────────────────────────────────────────────────────────────
interface Comment {
  id: string;
  user: string;
  avatar: string;
  time: string;
  text: string;
  likes: number;
  stars: number;
}

const SEED_COMMENTS: Comment[] = [
  {
    id: "c1",
    user: "Alex R.",
    avatar: "https://i.pravatar.cc/40?img=1",
    time: "2h ago",
    text: "Absolutely mind-blowing! The storyline kept me on the edge of my seat the entire time. 100% recommended! 🚀",
    likes: 42,
    stars: 5,
  },
  {
    id: "c2",
    user: "Sarah M.",
    avatar: "https://i.pravatar.cc/40?img=5",
    time: "5h ago",
    text: "Great visuals and soundtrack. The plot twist at the end was something I did NOT see coming. Watch it!",
    likes: 27,
    stars: 4,
  },
  {
    id: "c3",
    user: "Omar K.",
    avatar: "https://i.pravatar.cc/40?img=12",
    time: "1d ago",
    text: "Solid sci-fi film. A bit slow in the second act but picks up massively towards the end. Worth every minute.",
    likes: 18,
    stars: 4,
  },
  {
    id: "c4",
    user: "Priya S.",
    avatar: "https://i.pravatar.cc/40?img=23",
    time: "2d ago",
    text: "I dragged my whole family to watch this and now everyone's obsessed. It's that good. Don't miss it! 🎬",
    likes: 61,
    stars: 5,
  },
];

// ─── Star row ─────────────────────────────────────────────────────────────────
function Stars({ count, size = 12 }: { count: number; size?: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons
          key={n}
          name={n <= count ? "star" : "star-outline"}
          size={size}
          color={n <= count ? "#FFD700" : "#334155"}
        />
      ))}
    </View>
  );
}

// ─── Single comment card ──────────────────────────────────────────────────────
function CommentCard({ comment }: { comment: Comment }) {
  const [liked, setLiked] = useState(false);
  return (
    <View style={styles.commentCard}>
      <BlurView intensity={65} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.commentCardInner}>
        <Image source={{ uri: comment.avatar }} style={styles.commentAvatar} />
        <View style={{ flex: 1 }}>
          <View style={styles.commentHeader}>
            <Text style={styles.commentUser}>{comment.user}</Text>
            <Stars count={comment.stars} />
            <Text style={styles.commentTime}>{comment.time}</Text>
          </View>
          <Text style={styles.commentText}>{comment.text}</Text>
          <TouchableOpacity
            style={styles.likeRow}
            onPress={() => setLiked((v) => !v)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={liked ? "heart" : "heart-outline"}
              size={14}
              color={liked ? "#e50914" : "#475569"}
            />
            <Text style={[styles.likeText, liked && { color: "#e50914" }]}>
              {comment.likes + (liked ? 1 : 0)} helpful
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Comments section ─────────────────────────────────────────────────────────
function CommentsSection({
  onCountChange,
}: {
  onCountChange?: (n: number) => void;
}) {
  const { profile, user } = useUser();
  const { isGuest } = useSubscription();
  const [comments, setComments] = useState<Comment[]>(SEED_COMMENTS);
  const [text, setText] = useState("");
  const [selectedStars, setSelectedStars] = useState(5);

  // Notify parent whenever comment count changes
  useEffect(() => {
    onCountChange?.(comments.length);
  }, [comments.length, onCountChange]);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const newComment: Comment = {
      id: Date.now().toString(),
      user: profile.fullName,
      avatar: profile.profilePhoto,
      time: "Just now",
      text: trimmed,
      likes: 0,
      stars: selectedStars,
    };
    setComments((c) => [newComment, ...c]);
    setText("");
  };

  // Average rating
  const avg = (
    comments.reduce((s, c) => s + c.stars, 0) / comments.length
  ).toFixed(1);

  return (
    <View style={styles.commentsSection}>
      {/* Header */}
      <View style={styles.commentsHeader}>
        <View>
          <Text style={styles.commentsTitle}>Viewer Reviews</Text>
          <Text style={styles.commentsSub}>
            {comments.length} reviews · avg {avg} ⭐
          </Text>
        </View>
        <View style={styles.avgBadge}>
          <Text style={styles.avgScore}>{avg}</Text>
          <Stars count={Math.round(Number(avg))} size={10} />
        </View>
      </View>

      {/* Comment list */}
      {comments.map((c) => (
        <CommentCard key={c.id} comment={c} />
      ))}

      {/* New comment input */}
      <View style={styles.inputCard}>
        <BlurView intensity={65} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.inputCardInner}>
          <Image
            source={{ uri: profile.profilePhoto }}
            style={styles.inputAvatar}
          />
          <View style={styles.inputWrapper}>
            <TextInput
              placeholder="Add a comment..."
              placeholderTextColor="#475569"
              style={styles.input}
              value={text}
              onChangeText={setText}
              multiline
              maxLength={250}
            />
            <TouchableOpacity
              style={[styles.sendBtn, !text.trim() && { opacity: 0.4 }]}
              onPress={submit}
              disabled={!text.trim()}
            >
              <Ionicons name="send" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── Genre → description helper ───────────────────────────────────────────────
const GENRE_DESC: Record<string, string> = {
  "Sci-Fi":
    "A mind-bending journey through galaxies, technology, and the future of mankind.",
  Thriller:
    "Edge-of-your-seat tension drives every frame of this gripping story.",
  Action:
    "Explosive set pieces and relentless pacing make this an unmissable ride.",
  Drama:
    "Deeply human storytelling that will move and resonate long after the credits.",
  Horror:
    "Masterfully crafted scares and dread linger well past the final scene.",
  Romance: "A beautiful, emotional love story filled with heart and chemistry.",
  Mystery:
    "Clues unfold layer by layer in a puzzle you won't solve until the end.",
  Fantasy: "Breathtaking world-building and epic imagination on a grand scale.",
  "Indian Movies":
    "Rich culture, powerful performances, and an unforgettable story from South Asia.",
  Comedy:
    "A laugh-out-loud experience that brings joy and levity to the screen.",
  Adventure:
    "Thrilling journeys to the unknown, where every corner holds a new discovery.",
  Animation:
    "Stunning visuals and heartwarming stories that transcend all ages.",
  Documentary:
    "Compelling real-world narratives that inform, inspire, and challenge.",
  Crime:
    "Gritty investigations and high-stakes drama from the heart of the underworld.",
  Biography:
    "Powerful true stories that document the lives of extraordinary people.",
  Sport: "The triumph of the human spirit on and off the field of competition.",
  War: "Brave stories of conflict, sacrifice, and the enduring hope for peace.",
  History:
    "A cinematic window into the events and figures that shaped our world.",
};
function movieDesc(genre?: string, title?: string): string {
  const g = genre || "General";
  const t = title || "The Movie";
  return (
    GENRE_DESC[g] ??
    `${t} is a critically acclaimed ${g} film you won't want to miss.`
  );
}

export function SeriesPreviewContent({
  movie: series,
  onClose,
  onSwitch,
  onSeeAll,
  playingNow,
  setPlayingNow,
  setPlayerMode,
  setPlayerTitle,
  setSelectedVideoUrl,
  playerMode,
  playerTitle,
  selectedVideoUrl,
  isMuted: isMutedProp,
  onShowPremium,
  onUpgrade,
  isFocused,
  appState
}: { 
  movie: Series;
  onClose: () => void;
  onSwitch: (m: Movie | Series) => void;
  onSeeAll?: (title: string, data: (Movie | Series)[]) => void;
  playingNow?: Movie | null;
  setPlayingNow?: (m: Movie | null) => void;
  setPlayerMode?: (m: 'closed' | 'full' | 'mini') => void;
  setPlayerTitle?: (t: string) => void;
  setSelectedVideoUrl?: (u: string | undefined) => void;
  playerMode?: 'closed' | 'full' | 'mini';
  playerTitle?: string;
  selectedVideoUrl?: string | undefined;
  isMuted?: boolean;
  onShowPremium: () => void;
  onUpgrade: () => void;
  isFocused: boolean;
  appState: string;
}) {
  const router = useRouter();
  const { 
    allRows: ALL_ROWS, 
    allSeries: ALL_SERIES, 
    heroMovies: HERO_MOVIES,
    movies: MOVIES
  } = useMovies();
  const { profile, user } = useUser();
  const {
    allMoviesFree,
    subscriptionBundle,
    isGuest,
    toggleFavorite,
    favorites,
    checkDeviceLimit,
    recordTrialUsage,
    isDeviceBlocked,
    activeDeviceIds,
    removeDevice,
    deviceLimit,
    setIsPreview,
  } = useSubscription();

  const {
    activeDownloads: ctxActiveDownloads,
    downloadedMovies: ctxDownloadedMovies,
    episodeDownloads: ctxEpisodeDownloads,
    downloadEpisode,
    pauseDownload,
    resumeDownload,
    deleteDownload,
    getRemainingDownloads,
  } = useDownloads();

  const isPaid = subscriptionBundle !== 'None';
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [descExpanded, setDescExpanded] = useState(false);
  const [isMuted, setIsMuted] = useState(isMutedProp ?? false);
  const [activeEpisodeId, setActiveEpisodeId] = useState<string>("");
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [containerWidth, setContainerWidth] = useState(0);

  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [selectedEpisodeForDownload, setSelectedEpisodeForDownload] = useState<any>(null);
  const [alreadyDownloadedState, setAlreadyDownloadedState] = useState<{ visible: boolean, episode?: any, localItem?: any }>({ visible: false });

  const handleDownload = (episode?: any) => {
    if (!series) return;
    
    // Use the currently selected episode if none passed
    const targetEp = episode || episodes.find((e: any) => e.id === activeEpisodeId);
    if (!targetEp) return;

    // If actively downloading this episode, toggle pause/resume
    const activeDl = ctxActiveDownloads[targetEp.id];
    if (activeDl) {
      activeDl.isPaused ? resumeDownload(targetEp.id) : pauseDownload(targetEp.id);
      return;
    }

    // If already downloaded, show options modal
    const isDownloaded = !!ctxEpisodeDownloads[targetEp.id];
    if (isDownloaded) {
      setAlreadyDownloadedState({ visible: true, episode: targetEp, localItem: { localUri: ctxEpisodeDownloads[targetEp.id] } });
      return;
    }

    if (getRemainingDownloads() === 0 && !isPaid) {
      onShowPremium();
      return;
    }
    
    setSelectedEpisodeForDownload(targetEp);
    setShowDownloadModal(true);
  };

  const wavePulseAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const playPulse = useRef(new Animated.Value(1)).current;
  const downloadPulse = useRef(new Animated.Value(1)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;
  const myListScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const breath = Animated.loop(
      Animated.sequence([
        Animated.timing(playPulse, { toValue: 1.15, duration: 700, useNativeDriver: true }),
        Animated.timing(playPulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.delay(800),
      ]),
    );
    const wave = Animated.loop(
      Animated.timing(waveAnim, { toValue: 1, duration: 2500, useNativeDriver: true }),
    );
    breath.start();
    wave.start();
    return () => {
      breath.stop();
      wave.stop();
    };
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.loop(
        Animated.timing(wavePulseAnim, { toValue: 1, duration: 3000, easing: Easing.out(Easing.poly(4)), useNativeDriver: true })
      ),
      Animated.loop(
        Animated.timing(shimmerAnim, { toValue: 2, duration: 4500, easing: Easing.linear, useNativeDriver: true })
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(downloadPulse, { toValue: 1.15, duration: 600, useNativeDriver: true }),
          Animated.timing(downloadPulse, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.delay(100),
        ])
      ),
    ]).start();
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTo({ y: 0, animated: false });
  }, [series?.id]);

  useEffect(() => {
    if (isMutedProp !== undefined) setIsMuted(isMutedProp);
  }, [isMutedProp]);

  const previewVideoUrl = useMemo(() => {
    if (!series) return undefined;
    if (series.previewUrl && series.previewUrl.startsWith('http')) return series.previewUrl;
    if (series.videoUrl && series.videoUrl.startsWith('http')) return series.videoUrl;
    return '';
  }, [series]);

  const episodes = useMemo(() => {
    if (series.episodeList && series.episodeList.length > 0) {
      const multiplier = series.episodesPerPart || 1;
      return series.episodeList.map((ep: any, index: number) => {
        const isFree = index < (series.freeEpisodesCount || 0) || series.isFree;
        let displayIdx: any = index + 1;
        if (multiplier > 1) {
          const start = (index * multiplier) + 1;
          const end = (index + 1) * multiplier;
          displayIdx = `${start}-${end}`;
        }
        return {
          id: `${series.id}-ep-${index}`,
          displayIndex: displayIdx,
          title: ep.title,
          duration: series.episodeDuration || "45m",
          isPremium: !isFree,
          thumbnail: series.poster,
          videoUrl: ep.url,
          description: `This exciting episode follows the journey in ${series.title}.`,
        };
      });
    }
    const count = series.episodes || 1;
    return Array.from({ length: count }, (_, i) => {
      const isFree = i < (series.freeEpisodesCount || 0) || series.isFree;
      return {
        id: `${series.id}-ep-${i}`,
        displayIndex: i + 1,
        title: `${series.title} - Ep ${i + 1}${isFree ? " (Preview)" : ""}`,
        duration: series.episodeDuration || "45m",
        isPremium: !isFree,
        thumbnail: series.poster,
        videoUrl: previewVideoUrl,
        description: `This exciting episode follows the journey in ${series.title}.`,
      };
    });
  }, [series, previewVideoUrl]);

  const activeEpisode = useMemo(() => episodes.find((e) => e.id === activeEpisodeId) || episodes[0], [episodes, activeEpisodeId]);

  const computedTotalDuration = useMemo(() => {
    if ((series as any).duration && (series as any).duration !== "N/A" && (series as any).duration !== "") return (series as any).duration;
    const totalMinutes = episodes.length * 45; // Fallback
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }, [(series as any).duration, episodes]);

  const isFavorite = favorites.some((f: any) => f.id === series?.id);
  const currentIndex = episodes.findIndex(e => e.id === activeEpisode.id);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!showComments || !series?.id) return;
    setIsLoadingComments(true);
    const q = query(collection(db, "comments"), where("contentId", "==", series.id));
    return onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      fetched.sort((a, b) => (b as any).createdAt?.seconds - (a as any).createdAt?.seconds);
      setComments(fetched);
      setIsLoadingComments(false);
    });
  }, [showComments, series?.id]);

  const handlePostComment = async () => {
    if (isGuest) { onShowPremium(); return; }
    if (!commentText.trim()) return;
    const text = commentText.trim();
    setCommentText("");
    try {
      await addDoc(collection(db, "comments"), {
        contentId: series.id,
        userId: auth.currentUser?.uid || 'anonymous',
        user: profile?.fullName || "A Series Fan",
        avatar: profile?.profilePhoto || null,
        text,
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      setCommentText(text);
      Alert.alert("Error", "Could not post comment.");
    }
  };

  const handleMyList = () => {
    Animated.sequence([
      Animated.timing(myListScale, { toValue: 1.4, duration: 150, useNativeDriver: true }),
      Animated.timing(myListScale, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
    toggleFavorite(series);
  };

  const handleShare = () => {
    Share.share({
      message: `Check out "${series.title}" on MovieApp! 🎬`,
    });
  };

  const related = ALL_SERIES.filter(s => s.genre === series.genre && s.id !== series.id).slice(0, 6);

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: "#0a0a0f" }]}>
      <Animated.View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          top: 0, left: 0, right: 0,
          flexDirection: "row",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          zIndex: 110,
          height: 64,
          paddingTop: insets.top,
        }}
      >
        <Animated.View
          style={[StyleSheet.absoluteFill, {
            opacity: scrollY.interpolate({ inputRange: [200, 240], outputRange: [0, 1], extrapolate: "clamp" }),
          }]}
          pointerEvents="none"
        >
          <BlurView intensity={99} tint="dark" style={StyleSheet.absoluteFill} />
        </Animated.View>

        <TouchableOpacity
          style={styles.closeBtn}
          onPress={onClose}
        >
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.closeBtn, { marginLeft: 'auto' }]}
          onPress={() => setIsMuted(!isMuted)}
        >
          <Ionicons name={isMuted ? "volume-mute" : "volume-high"} size={20} color="#fff" />
        </TouchableOpacity>
      </Animated.View>

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
      >
        <TouchableOpacity 
          activeOpacity={0.9}
          onPress={() => {
            // Prioritize local downloaded file for offline playback
            const localUri = ctxEpisodeDownloads[activeEpisode.id];
            if (setIsPreview) setIsPreview(true);
            if (setSelectedVideoUrl) setSelectedVideoUrl(localUri || activeEpisode.videoUrl || previewVideoUrl || "");
            if (setPlayerTitle) setPlayerTitle(series.title + " - " + activeEpisode.title);
            if (setPlayerMode) setPlayerMode('full');
          }}
        >
          {previewVideoUrl ? (
            <Video
              source={{ uri: previewVideoUrl }}
              style={styles.previewPoster}
              resizeMode={ResizeMode.COVER}
              shouldPlay={playerMode === 'closed' && isFocused && appState === 'active'}
              isLooping
              isMuted={isMuted}
              usePoster={true}
              posterSource={{ uri: series.poster }}
              posterStyle={{ resizeMode: 'cover' }}
            />
          ) : (
            <Image source={{ uri: series.poster }} style={styles.previewPoster} />
          )}
          <LinearGradient colors={["transparent", "#0a0a0f"]} style={styles.previewPosterFade} />
          <View style={[StyleSheet.absoluteFill, { justifyContent: "center", alignItems: "center" }]}>
            <Animated.View style={{ transform: [{ scale: playPulse }] }}>
              <View style={styles.posterPlayBtn}>
                <Ionicons name="play" size={32} color="#fff" style={{ marginLeft: 4 }} />
              </View>
            </Animated.View>
          </View>
        </TouchableOpacity>

        <View style={styles.previewContent}>
          <View style={styles.previewTags}>
            <View style={styles.epTitleBadge}><Text style={styles.epTitleBadgeText}>{series.genre}</Text></View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Ionicons name="mic-outline" size={11} color="#f59e0b" />
              <Text style={[styles.previewMetaText, { color: '#f59e0b' }]}>{series.vj}</Text>
              <View style={styles.previewDot} />
              <Text style={styles.previewMetaText}>{series.year}</Text>
              <View style={styles.previewDot} />
              <Text style={styles.previewMetaText}>{computedTotalDuration}</Text>
              {series.episodeDuration && (
                <>
                  <View style={styles.previewDot} />
                  <Ionicons name="play-outline" size={10} color="#475569" />
                  <Text style={styles.previewMetaText}>{series.episodeDuration}/ep</Text>
                </>
              )}
            </View>
          </View>

          <View style={{ marginVertical: 12 }}>
            <Text style={[styles.previewTitle, { marginBottom: 10 }]}>{series.title}</Text>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {/* Series Type Badge (RED) */}
              <View style={{
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                borderWidth: 1,
                borderColor: 'rgba(239, 68, 68, 0.4)',
                borderRadius: 6,
                paddingHorizontal: 8,
                paddingVertical: 3,
              }}>
                <Text style={{ color: '#ef4444', fontSize: 11, fontWeight: '900' }}>
                  {series.isMiniSeries ? "Mini Series" : "Series"}
                </Text>
              </View>

              {/* Season Badge (GOLD) */}
              <View style={{
                backgroundColor: 'rgba(245, 158, 11, 0.2)',
                borderWidth: 1,
                borderColor: 'rgba(245, 158, 11, 0.4)',
                borderRadius: 6,
                paddingHorizontal: 8,
                paddingVertical: 3,
              }}>
                <Text style={{ color: '#f59e0b', fontSize: 11, fontWeight: '900' }}>
                  Season {series.seasons || 1}
                </Text>
              </View>

              {/* EP Badge (PURPLE) */}
              <View style={{
                backgroundColor: 'rgba(91, 95, 239, 0.2)',
                borderWidth: 1,
                borderColor: 'rgba(91, 95, 239, 0.4)',
                borderRadius: 6,
                paddingHorizontal: 8,
                paddingVertical: 3,
              }}>
                <Text style={{ color: '#818cf8', fontSize: 11, fontWeight: '900' }}>
                  EP {currentIndex + 1} / {episodes.length}
                </Text>
              </View>
            </View>
          </View>

          <TouchableOpacity onPress={() => setDescExpanded(!descExpanded)}>
            <Text style={styles.previewDesc} numberOfLines={descExpanded ? undefined : 3}>
              {series.description || `Dive into ${series.title}. An epic journey.`}
            </Text>
          </TouchableOpacity>

          <View style={styles.previewActions}>
            <TouchableOpacity style={styles.previewActionCol} onPress={handleMyList}>
              <Animated.View style={[styles.previewActionIconBg, isFavorite && { borderColor: "#FFC107" }, { transform: [{ scale: myListScale }] }]}>
                <Ionicons name={isFavorite ? "checkmark" : "add"} size={24} color={isFavorite ? "#FFC107" : "#fff"} />
              </Animated.View>
              <Text style={[styles.previewActionLabel, isFavorite && { color: "#FFC107" }]}>My List</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.previewActionCol} 
              onPress={() => handleDownload()}
            >
              <View 
                style={[
                  styles.previewActionIconBg, 
                  (ctxActiveDownloads[activeEpisodeId] || ctxEpisodeDownloads[activeEpisodeId]) && { 
                    borderColor: ctxActiveDownloads[activeEpisodeId]?.isPaused ? "#ef4444" : "#22c55e",
                    backgroundColor: ctxActiveDownloads[activeEpisodeId]?.isPaused ? "rgba(239,68,68,0.12)" : "rgba(34,197,94,0.12)"
                  }
                ]}
              >
                {ctxActiveDownloads[activeEpisodeId] ? (
                  <Animated.View style={{ transform: [{ scale: downloadPulse }] }}>
                    <Ionicons 
                      name={ctxActiveDownloads[activeEpisodeId]?.isPaused ? "play" : "pause"} 
                      size={20} 
                      color={ctxActiveDownloads[activeEpisodeId]?.isPaused ? "#ef4444" : "#22c55e"} 
                    />
                  </Animated.View>
                ) : ctxEpisodeDownloads[activeEpisodeId] ? (
                  <Ionicons name="checkmark-circle" size={22} color="#10b981" />
                ) : (
                  <Ionicons name="download-outline" size={22} color="#fff" />
                )}
              </View>
              <Text 
                style={[
                  styles.previewActionLabel, 
                  (ctxActiveDownloads[activeEpisodeId] || ctxEpisodeDownloads[activeEpisodeId]) && { 
                    color: ctxActiveDownloads[activeEpisodeId]?.isPaused ? "#ef4444" : "#22c55e" 
                  }
                ]}
              >
                {ctxActiveDownloads[activeEpisodeId]
                  ? ctxActiveDownloads[activeEpisodeId]?.isPaused
                    ? `Paused (${Math.round(ctxActiveDownloads[activeEpisodeId].progress)}%)`
                    : `${Math.round(ctxActiveDownloads[activeEpisodeId].progress)}% • ${ctxActiveDownloads[activeEpisodeId].speedString?.split('•')[1]?.trim() || 'Starting...'}`
                  : ctxEpisodeDownloads[activeEpisodeId] ? "Saved Offline" : "Download"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.previewActionCol} onPress={() => handleShare(series)}>
              <View style={styles.previewActionIconBg}><Ionicons name="share-social-outline" size={22} color="#fff" /></View>
              <Text style={styles.previewActionLabel}>Share</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.episodesSection}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={styles.relatedTitle}>Episodes</Text>
              <TouchableOpacity 
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 }}
                onPress={() => {
                  episodes.forEach((ep: any) => {
                    const isDl = ctxActiveDownloads[ep.id];
                    const isDownloaded = ctxEpisodeDownloads[ep.id];
                    if (!isDl && !isDownloaded) {
                      if (isGuest) onShowPremium();
                      else downloadEpisode(series, ep, 'internal');
                    }
                  });
                }}
              >
                <Ionicons name="download-outline" size={16} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600', marginLeft: 4 }}>Download All</Text>
              </TouchableOpacity>
            </View>
            {episodes.map((ep: any, idx: number) => {
              const activeDl = ctxActiveDownloads[ep.id];
              const isDl = !!activeDl;
              const isDownloaded = !!ctxEpisodeDownloads[ep.id];

              return (
                <TouchableOpacity
                  key={ep.id}
                  style={[styles.episodeItemPremium, activeEpisode.id === ep.id && { borderColor: '#5B5FEF', backgroundColor: 'rgba(91,95,239,0.1)' }, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                  onPress={() => {
                    setActiveEpisodeId(ep.id);
                    if (setPlayingEpisodeId) setPlayingEpisodeId(ep.id);
                    // Prioritize local downloaded file for offline playback
                    const localUri = ctxEpisodeDownloads[ep.id];
                    if (setSelectedVideoUrl) setSelectedVideoUrl(localUri || ep.videoUrl);
                    if (setPlayerTitle) setPlayerTitle(series.title + " - " + ep.title);
                    if (setPlayingNow) setPlayingNow(series);
                    if (setPlayerMode) setPlayerMode('full');
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View style={styles.epThumbWrapPremiumLarge}>
                      <Image source={{ uri: ep.thumbnail }} style={styles.epThumb} />
                    </View>
                    <View style={styles.epInfoPremium}>
                      <Text style={styles.epTitlePremium}>{ep.displayIndex}. {ep.title}</Text>
                      <Text style={styles.epSubPremiumSmall}>{ep.duration}</Text>
                    </View>
                  </View>
                  <View style={{ paddingHorizontal: 12 }}>
                    <TouchableOpacity 
                      onPress={(e) => {
                        e.stopPropagation();
                        if (isDl) {
                           activeDl.isPaused ? resumeDownload(ep.id) : pauseDownload(ep.id);
                        } else if (isDownloaded) {
                          setAlreadyDownloadedState({ visible: true, episode: ep, localItem: { localUri: ctxEpisodeDownloads[ep.id] } });
                        } else {
                           if (isGuest) onShowPremium();
                           else downloadEpisode(series, ep, 'internal');
                        }
                      }}
                      style={{ padding: 4 }}
                    >
                      {isDl ? (
                        <View style={{ alignItems: 'flex-end', gap: 2 }}>
                           <Animated.View style={{ transform: [{ scale: downloadPulse }] }}>
                              <Ionicons
                                name={activeDl?.isPaused ? "play-circle" : "pause-circle"}
                                size={28}
                                color={activeDl?.isPaused ? "#ef4444" : "#22c55e"}
                              />
                           </Animated.View>
                           <Text style={{ color: activeDl?.isPaused ? "#ef4444" : "#22c55e", fontSize: 9, fontWeight: '900' }}>
                             {activeDl?.isPaused ? `PAUSED (${activeDl.progress}%)` : `${activeDl.progress}% • ${activeDl.speedString?.split('•')[1]?.trim() || '...'}`}
                           </Text>
                        </View>
                      ) : isDownloaded ? (
                        <Ionicons name="checkmark-circle" size={26} color="#10b981" />
                      ) : (
                        <Ionicons name="download-outline" size={26} color="#94a3b8" />
                      )}
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
          
          {related.length > 0 && (
            <View style={styles.relatedSection}>
              <Text style={styles.relatedTitle}>More Like This</Text>
              <View style={styles.relatedGrid}>
                {related.map(item => (
                  <TouchableOpacity key={item.id} style={styles.relatedCard} onPress={() => onSwitch(item)}>
                    <Image source={{ uri: item.poster }} style={styles.relatedPoster} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── ALREADY DOWNLOADED MODAL FOR SERIES ── */}
      <Modal
        visible={alreadyDownloadedState.visible && playerMode !== 'full'}
        transparent
        animationType="fade"
        onRequestClose={() => setAlreadyDownloadedState({ visible: false })}
      >
        <View style={styles.downloadModalCentering}>
          <TouchableOpacity
            style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.6)" }]}
            activeOpacity={1}
            onPress={() => setAlreadyDownloadedState({ visible: false })}
          />
          <View
            style={[
              styles.downloadModalContent,
              { width: 300, backgroundColor: "#1e293b", padding: 0 },
            ]}
          >
            <View style={{ padding: 20, alignItems: "center" }}>
              <Ionicons name="checkmark-circle" size={40} color="#10b981" style={{ marginBottom: 10 }} />
              <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700", textAlign: "center", marginBottom: 8 }}>
                Already Downloaded
              </Text>
              <Text style={{ color: "#94a3b8", fontSize: 14, textAlign: "center", lineHeight: 20 }}>
                "{alreadyDownloadedState.episode?.title || series.title}" is already saved in My Downloads.
              </Text>
            </View>
            
            <View style={{ borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)" }}>
              <TouchableOpacity
                style={{ paddingVertical: 16, alignItems: "center", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)" }}
                onPress={() => {
                  setAlreadyDownloadedState({ visible: false });
                  if ((alreadyDownloadedState.localItem as any)?.localUri) {
                    if (setSelectedVideoUrl) setSelectedVideoUrl((alreadyDownloadedState.localItem as any).localUri);
                    if (setPlayerTitle) setPlayerTitle(series.title + " - " + alreadyDownloadedState.episode?.title);
                    if (setPlayerMode) setPlayerMode('full');
                  }
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="play" size={18} color="#10b981" />
                  <Text style={{ color: "#10b981", fontSize: 16, fontWeight: "600" }}>Play Offline</Text>
                </View>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={{ paddingVertical: 16, alignItems: "center", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)" }}
                onPress={async () => {
                  if (!isPaid) {
                     setAlreadyDownloadedState({ visible: false });
                     Alert.alert("Premium Feature", "External Downloads are reserved for Premium Subscribers. Enjoy your Free Streaming inside the app today!");
                     return;
                  }
                  if (getRemainingDownloads() === 0) {
                     setAlreadyDownloadedState({ visible: false });
                     onShowPremium();
                     return;
                  }

                  // Check permissions first in the UI
                  const { status } = await MediaLibrary.requestPermissionsAsync(true);
                  if (status !== 'granted') {
                    setAlreadyDownloadedState({ visible: false });
                    Alert.alert("Permission Denied", "Please allow gallery access to save videos as MP4 files.");
                    return;
                  }

                  setAlreadyDownloadedState({ visible: false });
                  if (alreadyDownloadedState.episode) {
                    downloadEpisode(series, alreadyDownloadedState.episode, 'external');
                  }
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="download" size={18} color="#3b82f6" />
                  <Text style={{ color: "#3b82f6", fontSize: 16, fontWeight: "600" }}>External Downloads</Text>
                </View>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={{ paddingVertical: 16, alignItems: "center", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)" }}
                onPress={() => {
                  setAlreadyDownloadedState({ visible: false });
                  const id = alreadyDownloadedState.episode?.id || series.id;
                  deleteDownload(id);
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  <Text style={{ color: "#ef4444", fontSize: 16, fontWeight: "600" }}>Delete from Device</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ paddingVertical: 16, alignItems: "center" }}
                onPress={() => setAlreadyDownloadedState({ visible: false })}
              >
                <Text style={{ color: "#94a3b8", fontSize: 16, fontWeight: "500" }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── DOWNLOAD TYPE MODAL FOR SERIES ── */}
      <Modal
        visible={showDownloadModal && playerMode !== 'full'}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDownloadModal(false)}
      >
        <View style={styles.downloadModalCentering}>
          <TouchableOpacity
            style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.6)" }]}
            activeOpacity={1}
            onPress={() => setShowDownloadModal(false)}
          />
          <Animated.View
            style={[
              styles.downloadModalContent,
              {
                transform: [
                  {
                    scale: waveAnim.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [1, 1.02, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.downloadModalHeader}>
              <View style={styles.downloadIconRing}>
                <Ionicons name="cloud-download" size={32} color="#5B5FEF" />
              </View>
              <Text style={styles.downloadModalTitle}>Choose Download Type</Text>
              <Text style={styles.downloadModalSub}>
                How would you like to save "{selectedEpisodeForDownload?.title || series.title}"?
              </Text>
            </View>

            <View style={styles.downloadOptions}>
              <TouchableOpacity
                style={styles.downloadPrimaryBtn}
                onPress={() => {
                  setShowDownloadModal(false);
                  if (selectedEpisodeForDownload) {
                    downloadEpisode(series, selectedEpisodeForDownload, 'internal');
                  }
                }}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={["#5B5FEF", "#3b82f6"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[StyleSheet.absoluteFill, { borderRadius: 16 }]}
                />
                <Ionicons name="phone-portrait-outline" size={22} color="#fff" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.downloadPrimaryBtnText}>Save in App</Text>
                  <Text style={styles.downloadPrimarySubText}>Watch offline anytime</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.downloadSecondaryBtn,
                  (!isPaid && getRemainingDownloads() === 0) && { opacity: 0.5 }
                ]}
                onPress={() => {
                  if (!isPaid) {
                    setShowDownloadModal(false);
                    onShowPremium();
                    return;
                  }
                  if (getRemainingDownloads() === 0) {
                     setShowDownloadModal(false);
                     onShowPremium();
                     return;
                  }
                  setShowDownloadModal(false);
                  if (selectedEpisodeForDownload) {
                    downloadEpisode(series, selectedEpisodeForDownload, 'external');
                  }
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="download-outline" size={22} color="#94a3b8" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.downloadSecondaryBtnText}>External Download</Text>
                  <Text style={styles.downloadSecondarySubText}>Use ADM, IDM, etc.</Text>
                </View>
                <View style={{ backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{getRemainingDownloads()} LEFT</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.downloadCancelLink}
                onPress={() => setShowDownloadModal(false)}
              >
                <Text style={styles.downloadCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
  
    </View>
  );
}

export function CategoryBar({ 
  activeCategory, 
  onSelect 
}: { 
  activeCategory: string; 
  onSelect: (cat: string) => void; 
}) {
  const categories = ["MOVIES", "SERIES", "PLAY NOW", "CINEMA", "MY LIST"];
  
  return (
    <View style={{ marginVertical: 12 }}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      >
        {categories.map((cat) => {
          const isActive = activeCategory === cat;
          return (
            <TouchableOpacity
              key={cat}
              onPress={() => onSelect(cat)}
              activeOpacity={0.8}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: isActive ? '#5B5FEF' : 'rgba(255,255,255,0.05)',
                borderWidth: 1,
                borderColor: isActive ? '#5B5FEF' : 'rgba(255,255,255,0.1)',
                minWidth: 80,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{
                color: isActive ? '#fff' : 'rgba(255,255,255,0.6)',
                fontSize: 12,
                fontWeight: '900',
                letterSpacing: 0.5,
              }}>
                {cat}
              </Text>
              {isActive && (
                <View style={{
                  position: 'absolute',
                  bottom: -2,
                  width: 4,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: '#fff',
                }} />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function MoviePreviewContent({
  movie,
  onClose,
  onSwitch,
  onSeeAll,
  playingNow,
  setPlayingNow,
  setPlayerMode,
  setPlayerTitle,
  setSelectedVideoUrl,
  playerMode,
  playerTitle,
  selectedVideoUrl,
  isMuted: isMutedProp,
  onShowPremium,
  onUpgrade,
  isFocused,
  appState
}: { 
  movie: Movie | Series | null;
  onClose: () => void;
  onSwitch: (m: Movie | Series) => void;
  onSeeAll?: (title: string, data: (Movie | Series)[]) => void;
  playingNow?: Movie | null;
  setPlayingNow?: (m: Movie | null) => void;
  setPlayerMode?: (m: 'closed' | 'full' | 'mini') => void;
  setPlayerTitle?: (t: string) => void;
  setSelectedVideoUrl?: (u: string | undefined) => void;
  playerMode?: 'closed' | 'full' | 'mini';
  playerTitle?: string;
  selectedVideoUrl?: string | undefined;
  isMuted?: boolean;
  onShowPremium: () => void;
  onUpgrade: () => void;
  isFocused: boolean;
  appState: string;
}) {

  const router = useRouter();
  const [selectedSeason, setSelectedSeason] = useState(1);
  const { 
    allRows: ALL_ROWS, 
    allSeries: ALL_SERIES, 
    heroMovies: HERO_MOVIES,
    youMayAlsoLike: liveYouMayAlsoLike,
    trending: liveTrending,
    mostViewed: liveMostViewed,
    mostDownloaded: liveMostDownloaded,
    newReleases: liveNewReleases,
    liveMovies,
    liveSeries,
  } = useMovies();

  const YOU_MAY_ALSO_LIKE = liveYouMayAlsoLike.slice(0, 12);
  const TRENDING = liveTrending.slice(0, 12);
  const MOST_VIEWED = liveMostViewed.slice(0, 12);
  const MOST_DOWNLOADED = liveMostDownloaded.slice(0, 12);
  const NEW_RELEASES = liveNewReleases.slice(0, 12);

  const { profile, user } = useUser();
  const [browseSection, setBrowseSection] = useState(ALL_ROWS[0]?.title ?? 'New Releases');
  const {
    subscriptionBundle,
    setSubscriptionBundle,
    allMoviesFree,
    isGuest,
    favorites,
    toggleFavorite,
    recordTrialUsage,
    isDeviceBlocked,
    activeDeviceIds,
    removeDevice,
    deviceLimit,
    setIsPreview,
  } = useSubscription();

  const {
    activeDownloads,
    downloadedMovies,
    episodeDownloads,
    downloadMovie,
    downloadEpisode,
    pauseDownload,
    resumeDownload,
    deleteDownload,
    getRemainingDownloads,
    getExternalDownloadLimit,
  } = useDownloads();
  const isPaid = subscriptionBundle !== 'None';
  const [previewQuery, setPreviewQuery] = useState("");
  const [browseSectionModal, setBrowseSectionModal] = useState<{
    title: string;
    data: (Movie | Series)[];
  } | null>(null);
  const [activeBrowseFilter, setActiveBrowseFilter] =
    useState<string>("By VJ,s");
  const [hSelectedType, setHSelectedType] = useState<string | null>(null);
  const [hSelectedGenre, setHSelectedGenre] = useState<string | null>(null);
  const [hSelectedYear, setHSelectedYear] = useState<string | null>(null);
  const [hSelectedVJ, setHSelectedVJ] = useState<string | null>(null);
  const [hSelectedSection, setHSelectedSection] = useState<string | null>(null);
  const [hSelectedSort, setHSelectedSort] = useState<string | null>(null);
  const [hYearCategory, setHYearCategory] = useState<'new' | 'oldest'>('new');

  const [activePartId, setActivePartId] = useState<string | null>(null);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [selectedEpisodeForDownload, setSelectedEpisodeForDownload] = useState<any>(null);
  const [detectedDuration, setDetectedDuration] = useState<string | null>(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  const getHomeFilteredResults = useCallback(() => {
    let pool: (Movie | Series)[] = [];
    
    // Base pool: All unique movies and series
    const moviePool: (Movie | Series)[] = [];
    for (const row of ALL_ROWS) {
      for (const m of row.data) {
        if (!moviePool.find((p) => p.id === m.id)) moviePool.push(m);
      }
    }
    pool = [...moviePool, ...ALL_SERIES];

    // Apply Filter: Type
    if (hSelectedType) {
      if (hSelectedType === "Movie") {
        pool = pool.filter((item) => !("seasons" in item));
      } else if (hSelectedType === "Series") {
        pool = pool.filter((item) => "seasons" in item && !(item as Series).isMiniSeries);
      } else if (hSelectedType === "Mini Series") {
        pool = pool.filter((item) => "seasons" in item && (item as Series).isMiniSeries);
      }
    }

    // Apply Filter: Genre
    if (hSelectedGenre) {
      pool = pool.filter((item) => item.genre.includes(hSelectedGenre));
    }

    // Apply Filter: Year
    if (hSelectedYear) {
      pool = pool.filter((item) => item.year === Number(hSelectedYear));
    }

    // Apply Filter: VJ
    if (hSelectedVJ) {
      const vjLower = (hSelectedVJ || "").toLowerCase();
      pool = pool.filter(
        (item) => (item.vj || "").toLowerCase() === vjLower || (item.vj || "").toLowerCase() === "vj " + vjLower
      );
    }

    // Apply Filter: Section
    if (hSelectedSection) {
      const row = ALL_ROWS.find(r => r.title === hSelectedSection);
      if (row) {
        pool = pool.filter(item => row.data.some(rm => rm.id === item.id));
      }
    }

    // Apply Sort
    if (hSelectedSort) {
      if (hSelectedSort === "Newest") {
        pool.sort((a, b) => b.year - a.year);
      } else if (hSelectedSort === "Oldest") {
        pool.sort((a, b) => a.year - b.year);
      } else if (hSelectedSort === "Rating") {
        pool.sort((a, b) => parseFloat(b.rating || "0") - parseFloat(a.rating || "0"));
      }
    }

    return pool;
  }, [hSelectedType, hSelectedGenre, hSelectedYear, hSelectedVJ, hSelectedSection, hSelectedSort]);

  const clearHomeFilters = () => {
    setHSelectedType(null);
    setHSelectedGenre(null);
    setHSelectedYear(null);
    setHSelectedVJ(null);
    setHSelectedSection(null);
    setHSelectedSort(null);
  };

  const [seriesSubFilter, setSeriesSubFilter] = useState<string>("All");
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchAnim = useRef(new Animated.Value(0)).current;
  const previewInputRef = useRef<TextInput>(null);
  const insets = useSafeAreaInsets();
  const playPulse = useRef(new Animated.Value(1)).current;
  const downloadPulse = useRef(new Animated.Value(1)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;
  const myListScale = useRef(new Animated.Value(1)).current;
  const modalScrollRef = useRef<ScrollView>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const isFavorite = favorites.some((f: any) => f.id === movie?.id);

  const [descExpanded, setDescExpanded] = useState(false);
  const [showOtherParts, setShowOtherParts] = useState(false);
  const [isMuted, setIsMuted] = useState(isMutedProp ?? false);
  const [prevIsMuted, setPrevIsMuted] = useState(isMuted);
  const [videoError, setVideoError] = useState<string | null>(null);

  // ── Swipe-to-dismiss gesture ──
  const pan = useRef(new Animated.ValueXY()).current;
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return (
          gestureState.dx > 50 && 
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 2
        );
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow swiping to the right
        if (gestureState.dx > 0) {
          pan.x.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > 120) {
          // Commit swipe: animate off-screen then close
          Animated.timing(pan, {
            toValue: { x: SCREEN_W, y: 0 },
            duration: 200,
            useNativeDriver: false,
          }).start(() => {
            onClose();
            pan.setValue({ x: 0, y: 0 }); // reset for next open
          });
        } else {
          // Reset position
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            friction: 5,
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  // Sync internal muted state with parent prop (e.g. when stack changes)
  useEffect(() => {
    if (isMutedProp !== undefined) {
      setIsMuted(isMutedProp);
    }
  }, [isMutedProp]);

  const rawCastState = useSafeCastState();
  const isCasting = rawCastState === CastState.CONNECTED;
  const isCastConnecting = rawCastState === CastState.CONNECTING;
  const [showComments, setShowComments] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [alreadyDownloadedState, setAlreadyDownloadedState] = useState<{ visible: boolean, episode?: any, localItem?: any }>({ visible: false });
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<any[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);

  // ── Real-time Firestore Comments ──
  useEffect(() => {
    if (!movie?.id) return;

    setIsLoadingComments(true);
    const q = query(
      collection(db, "comments"),
      where("contentId", "==", movie.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedComments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Client-side sort to avoid requiring a composite index
      fetchedComments.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });

      setComments(fetchedComments);
      setIsLoadingComments(false);
    }, (error) => {
      console.error("Comments listener error:", error);
      setIsLoadingComments(false);
    });

    return () => unsubscribe();
  }, [showComments, movie?.id]);

  const handlePostComment = async () => {
    if (isGuest) {
      onShowPremium();
      return;
    }
    if (!commentText.trim() || !movie?.id) return;

    const trimmed = commentText.trim();
    setCommentText(""); // Optimistic clear

    try {
      await addDoc(collection(db, "comments"), {
        contentId: movie.id,
        userId: auth.currentUser?.uid || 'anonymous',
        user: profile?.fullName || "A Movie Fan",
        avatar: profile?.profilePhoto || null,
        text: trimmed,
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      console.error("Failed to post comment:", e);
      setCommentText(trimmed); // Restore text on failure
      Alert.alert("Error", "Could not post comment. Please try again.");
    }
  };

  // ── Other Parts Wave/Pulse Animation ──
  const otherPartsWaveAnim = useRef(new Animated.Value(0)).current;
  const otherPartsShimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const startAnims = () => {
      Animated.parallel([
        Animated.loop(
          Animated.timing(otherPartsWaveAnim, {
            toValue: 1,
            duration: 3000,
            easing: Easing.out(Easing.poly(4)),
            useNativeDriver: true,
          })
        ),
        Animated.loop(
          Animated.timing(otherPartsShimmerAnim, {
            toValue: 2,
            duration: 4500,
            easing: Easing.linear,
            useNativeDriver: true,
          })
        ),
        Animated.loop(
          Animated.sequence([
            Animated.timing(downloadPulse, { toValue: 1.15, duration: 600, useNativeDriver: true }),
            Animated.timing(downloadPulse, { toValue: 1, duration: 600, useNativeDriver: true }),
            Animated.delay(100),
          ])
        ),
      ]).start();
    };
    startAnims();
  }, [otherPartsWaveAnim, otherPartsShimmerAnim]);

  const handleMyList = () => {
    if (isGuest) {
      onShowPremium();
      return;
    }

    Animated.sequence([
      Animated.timing(myListScale, {
        toValue: 1.4,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(myListScale, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
    if(movie) toggleFavorite(movie);
  };

  const handleDownload = (episode?: any) => {
    if (!movie) return;

    // If already downloading requested item, toggle pause/resume
    const targetId = episode?.id || movie.id;
    const activeDl = activeDownloads[targetId];
    if (activeDl) {
      activeDl.isPaused ? resumeDownload(targetId) : pauseDownload(targetId);
      return;
    }

    // If already downloaded, show options instead of re-downloading silently
    const isAlreadyDownloaded = downloadedMovies.some(m => m.id === movie.id);
    if (isAlreadyDownloaded) {
      const localItem = downloadedMovies.find(m => m.id === movie.id);
      setAlreadyDownloadedState({ visible: true, episode, localItem });
      return;
    }

    if (isGuest && !(movie.isFree || allMoviesFree)) {
      onShowPremium();
      return;
    }
    if (getRemainingDownloads() === 0) {
      onShowPremium();
      return;
    }
    setSelectedEpisodeForDownload(episode || null);
    setShowDownloadModal(true);
  };


  const startDownloadFlow = () => {
    if (movie) {
      setShowDownloadModal(false);
      if (selectedEpisodeForDownload) {
        downloadEpisode(
          "seasons" in movie ? (movie as Series) : { ...movie, episodeList: [] } as any, 
          selectedEpisodeForDownload, 
          'internal'
        );
      } else {
        downloadMovie(movie as any, 'internal');
      }
    }
  };

  const handleShare = () => {
    Share.share({
      title: movie?.title,
      message: `🎬 Watch "${movie?.title}" (${movie?.year}) — ${movie?.genre} · Rated ${movie?.rating} ⭐\n\nDiscover this and more on THE MOVIE ZONE 24/7!`,
    });
  };


  const handleCast = () => {
    if (isGuest) {
      if (onShowPremium) onShowPremium();
      return;
    }
    // Launch the native casting dialog ONLY if available
    if (CAN_CAST) {
      CastContext.showCastDialog();
    } else {
      const toolTip = Platform.OS === 'ios' 
        ? "Casting requires a physical device and a development build. Simulators and Expo Go do not support native Cast SDK."
        : "Casting requires a physical device and a dedicated development build. It is not supported in Expo Go.";
      Alert.alert("Casting Unavailable", toolTip, [{ text: "OK" }]);
    }
  };

  // Auto-Start Cast Media
  useEffect(() => {
    if (CAN_CAST && isCasting && selectedVideoUrl && movie) {
      GoogleCast.getSessionManager().getCurrentCastSession().then((session: any) => {
        if (session) {
          session.client.loadMedia({
            mediaInfo: {
               contentUrl: selectedVideoUrl
            },
            autoplay: true
          });
        }
      });
    }
  }, [isCasting, selectedVideoUrl, playerTitle, movie]);

  // Derive a consistent video preview teaser for this movie/series (Home Preview Modal)
  const previewVideoUrl = React.useMemo(() => {
    if (!movie) return undefined;
    // 1. Use the dedicated Preview Clip URL if set in admin
    if ((movie as any).previewUrl) return (movie as any).previewUrl;
    // 2. DO NOT fallback to full videoUrl (heavy)
    return undefined;
  }, [movie]);

  useEffect(() => {
    // 1. Play-button pulse
    const breath = Animated.loop(
      Animated.sequence([
        Animated.timing(playPulse, {
          toValue: 1.15,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(playPulse, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.delay(800),
      ]),
    );

    // 2. Wave/Ripple Effect
    const wave = Animated.loop(
      Animated.timing(waveAnim, {
        toValue: 1,
        duration: 2500,
        useNativeDriver: true,
      }),
    );

    breath.start();
    wave.start();

    // Download button attention pulse
    const triggerDownloadPulse = () => {
      Animated.sequence([
        Animated.timing(downloadPulse, {
          toValue: 1.3,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(downloadPulse, {
          toValue: 1,
          friction: 3,
          useNativeDriver: true,
        }),
      ]).start();
    };

    const initialDelay = setTimeout(triggerDownloadPulse, 2000);
    const pulseInterval = setInterval(triggerDownloadPulse, 15000);

    return () => {
      breath.stop();
      wave.stop();
      clearTimeout(initialDelay);
      clearInterval(pulseInterval);
    };
  }, [movie?.id]);

  useEffect(() => {
    // Keyboard listeners removed in favor of KeyboardAvoidingView
  }, []);

  // Auto-scroll modal to top when preview search query changes
  useEffect(() => {
    if (previewQuery.trim().length > 0) {
      modalScrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  }, [previewQuery]);

  if (!movie) return null;
  const desc = (movie as any).description || movieDesc(movie.genre, movie.title);

  // Related movies: same primary genre, excluding the current movie
  const primaryGenre = movie.genre?.split(" · ")[0]?.trim()?.toLowerCase() || 'general';
  const related = React.useMemo(() => {
    const seen = new Set<string>();
    seen.add(movie.id);
    const pool: (Movie | Series)[] = [];
    if (!movie.genre) return []; // Skip related if no genre info
    
    for (const row of ALL_ROWS) {
      for (const m of row.data) {
        if (!seen.has(m.id) && m.genre?.toLowerCase().includes(primaryGenre)) {
          seen.add(m.id);
          pool.push(m);
        }
      }
    }
    return pool;
  }, [movie.id, primaryGenre]);

  // Browse section movies
  const browseMovies =
    ALL_ROWS.find((r) => r.title === browseSection)?.data ?? [];

  // All movies pool (deduped) for preview search
  const allPool = React.useMemo(() => {
    const seen = new Set<string>();
    const pool: (Movie | Series)[] = [];
    
    // 1. RAW LIVE DATA from context (MOST COMPREHENSIVE)
    for (const m of liveMovies) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        pool.push(m);
      }
    }
    for (const s of liveSeries) {
      if (!seen.has(s.id)) {
        seen.add(s.id);
        pool.push(s);
      }
    }

    // 2. Extra safety: All from rows (deduped)
    for (const row of ALL_ROWS) {
      for (const m of row.data) {
        if (!seen.has(m.id)) {
          seen.add(m.id);
          pool.push(m);
        }
      }
    }

    return pool;
  }, [liveMovies, liveSeries, ALL_ROWS]);

  // Helper to get a "base" title for fuzzy matching (e.g., "Movie Part 2" -> "Movie")
  // and stripping VJ names/years
  const getCanonicalTitle = (title: string | undefined): string => {
    if (!title) return "";
    return title
      .toLowerCase()
      // 1. Strip common VJ suffixes (e.g., "by vj junior", "vj emmy")
      .replace(/\s+by\s+vj\s+[\w\s]+/i, "")
      .replace(/\s+vj\s+[\w\s]+/i, "")
      // 2. Strip year patterns (e.g., "2025")
      .replace(/\s+\d{4}/g, "")
      // 3. Strip "Part X", "EP X", or trailing numbers
      .replace(/\s+part\s+\d+/i, "")
      .replace(/\s+ep(?:isode)?\s+\d+/i, "")
      .replace(/\s+\d+$/g, "")
      // 4. Strip extra symbols
      .replace(/[^\w\s]/g, "")
      .trim();
  };

  // Find other parts of the same movie or episodes of a series
  const movieParts = React.useMemo(() => {
    if (!movie) return []; 
    
    let parts: any[] = [];

    // 1. Check for Series episodes (NEW feature)
    if ((movie as any).episodeList && (movie as any).episodeList.length > 0) {
       const multiplier = (movie as any).episodesPerPart || 1;
       let list = (movie as any).episodeList;

       // Attempt to filter by season if requested
       if ("seasons" in movie && movie.seasons > 1) {
         const filteredList = list.filter((ep: any) => {
           const title = (ep.title || "").toLowerCase();
           // Heuristic: check for "S1", "S01", "Season 1"
           const sMatch = title.match(/s(\d+)/i) || title.match(/season\s*(\d+)/i);
           if (sMatch) return parseInt(sMatch[1]) === selectedSeason;
           // Fallback: if no season tag but multiple seasons exist, 
           // we might need to assume distribution if the list is sorted
           return true; 
         });
         // Only use filtered list if it actually found something, otherwise show all
         if (filteredList.length > 0) list = filteredList;
       }

       parts = list.map((ep: any, index: number) => {
         const isFree = index < ((movie as any).freeEpisodesCount || 0) || movie.isFree;
         let displayIdx: any = index + 1;
         if (multiplier > 1) {
           const start = (index * multiplier) + 1;
           const end = (index + 1) * multiplier;
           displayIdx = `${start}-${end}`;
         }
         return {
           id: `${movie.id}-ep-${index}-${selectedSeason}`,
           displayIndex: displayIdx,
           title: ep.title,
           videoUrl: ep.url,
           poster: movie.poster,
           duration: ep.duration || (movie as any).duration || "", 
           vj: movie.vj,
           year: movie.year,
           genre: movie.genre,
           rating: movie.rating,
           isFree: isFree,
         };
       });
    } 
    // 2. Try explicit parts field (Movies legacy feature)
    else if ((movie as Movie).parts && (movie as Movie).parts!.length > 0) {
      parts = (movie as Movie).parts!.map((p, index) => ({
        ...p,
        displayIndex: index + 1,
        poster: (p as any).poster || movie.poster,
        duration: (p as any).duration || (movie as any).duration,
        videoUrl: (p as any).videoUrl || (movie as Movie).videoUrl,
        previewUrl: (p as any).previewUrl || (movie as Movie).previewUrl,
        vj: (p as any).vj || movie.vj,
        year: (p as any).year || movie.year,
        genre: (p as any).genre || movie.genre,
        rating: (p as any).rating || movie.rating,
        isFree: (p as any).isFree || movie.isFree,
      }));
    } 
    // 3. Fallback to fuzzy title-matching for sequels/parts
    else {
      if ("seasons" in movie) return []; // Don't do title matching for series

      const base = getCanonicalTitle(movie.title);
      if (!base || base.length < 3) return []; // Avoid matching very short titles like "A"

      const matchedParts = allPool.filter((m): m is Movie => {
        if ("seasons" in m) return false;
        const mBase = getCanonicalTitle(m.title);
        // Match if base titles are identical OR one contains the other (sig. overlap)
        return mBase === base || (mBase.startsWith(base) && mBase.length < base.length + 5);
      });
      
      if (matchedParts.length > 0) {
        matchedParts.sort((a, b) => {
          // Extract numbers for better sorting (e.g., Part 1, Part 2, EP 1, EP 2)
          // We look for a number specifically after "part" or "ep" or at the end
          const aMatch = a.title.match(/(?:part|ep(?:isode)?)\s*(\d+)/i) || a.title.match(/(\d+)$/);
          const bMatch = b.title.match(/(?:part|ep(?:isode)?)\s*(\d+)/i) || b.title.match(/(\d+)$/);
          const aNum = parseInt(aMatch?.[1] || "1");
          const bNum = parseInt(bMatch?.[1] || "1");
          return aNum - bNum;
        });
        parts = matchedParts.map((p, index) => ({ ...p, displayIndex: index + 1 }));
      }
    }
    
    return parts.length > 1 ? parts : [];
  }, [movie, allPool]);

  useEffect(() => {
    if (movie && movieParts.length > 0) {
      if (!activePartId || !movieParts.find(p => p.id === activePartId)) {
        setActivePartId(movieParts[0].id);
      }
    } else {
      setActivePartId(null);
    }
  }, [movie, movieParts]);

  const activePart = React.useMemo(() => {
    if (!activePartId) return null;
    return movieParts.find(p => p.id === activePartId) || null;
  }, [activePartId, movieParts]);

  const currentIndex = movieParts.findIndex(p => p.id === activePartId);
  const hasNext = currentIndex != -1 && currentIndex < movieParts.length - 1;
  const hasPrev = currentIndex > 0;
  const nextPart = hasNext ? movieParts[currentIndex + 1] : null;

  const currentPlayerUrl = React.useMemo(() => {
    if (activePart) {
      // Prioritize local downloaded file for offline playback
      const localUri = episodeDownloads?.[activePart.id];
      return localUri || (activePart as any).videoUrl || selectedVideoUrl;
    }
    // For single movies (no parts), check if the movie itself is downloaded
    if (movie && !('seasons' in movie)) {
      const dl = downloadedMovies.find(m => m.id === movie.id);
      if ((dl as any)?.localUri) return (dl as any).localUri;
    }
    return selectedVideoUrl;
  }, [activePart, selectedVideoUrl, episodeDownloads, downloadedMovies, movie]);

  const currentPlayerTitle = React.useMemo(() => {
    if (activePart) {
      const baseTitle = movie?.title || "";
      const partTitle = activePart.title;
      // If base title already contains part title (case-insensitive), just use base title
      if (baseTitle.toLowerCase().includes(partTitle.toLowerCase())) return baseTitle;
      return `${baseTitle} - ${partTitle}`;
    }
    return playerTitle;
  }, [activePart, playerTitle, movie]);

  const handleNextPart = () => {
    if (hasNext) {
      const nextPartItem = movieParts[currentIndex + 1];
      const canWatchNext = allMoviesFree || (nextPartItem as any).isFree || isPaid;
      if (!canWatchNext) {
        onSwitch?.(nextPartItem);
        setPlayerMode?.('closed');
        onShowPremium?.();
        return;
      }
      setActivePartId(nextPartItem.id);
      // Prioritize local downloaded file for offline playback
      const localUri = episodeDownloads?.[nextPartItem.id];
      setSelectedVideoUrl?.(localUri || nextPartItem.videoUrl);
      setPlayerTitle?.(movie?.title + " - " + nextPartItem.title);
    }
  };

  const handlePrevPart = () => {
    if (hasPrev) {
      const prevPartItem = movieParts[currentIndex - 1];
      const canWatchPrev = allMoviesFree || (prevPartItem as any).isFree || isPaid;
      if (!canWatchPrev) {
        onSwitch?.(prevPartItem);
        setPlayerMode?.('closed');
        onShowPremium?.();
        return;
      }
      setActivePartId(prevPartItem.id);
      // Prioritize local downloaded file for offline playback
      const localUri = episodeDownloads?.[prevPartItem.id];
      setSelectedVideoUrl?.(localUri || prevPartItem.videoUrl);
      setPlayerTitle?.(movie?.title + " - " + prevPartItem.title);
    }
  };

  const computedTotalDuration = useMemo(() => {
    const mov = movie as any;
    if (mov.duration && mov.duration !== "N/A" && mov.duration !== "" && mov.duration !== "0:00") return mov.duration;
    if (!movieParts || movieParts.length === 0) return mov.duration || (detectedDuration || "...");
    
    const totalMinutes = movieParts.reduce((acc, part) => {
      const dur = part.duration || "";
      const hrMatch = dur.match(/(\d+)\s*h/i);
      const minMatch = dur.match(/(\d+)\s*m/i);
      const hrsCount = hrMatch ? parseInt(hrMatch[1]) : 0;
      const minsCount = minMatch ? parseInt(minMatch[1]) : 0;
      return acc + (hrsCount * 60) + minsCount;
    }, 0);
    
    if (totalMinutes === 0) return mov.duration || (detectedDuration || "...");
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }, [movie, movieParts, detectedDuration]);

  const relatedMovies = React.useMemo(() => {
    if (!movie) return [];
    const partIds = new Set(movieParts.map(p => p.id));
    const partTitles = new Set(movieParts.map(p => p.title?.toLowerCase().trim() || ""));
    const movieTitle = movie.title?.toLowerCase().trim() || "";

    // Filter YOU_MAY_ALSO_LIKE for movies of the same genre, or just return the list
    // AND exclude movies that are already identified as "Other Parts" (by ID or Title)
    return YOU_MAY_ALSO_LIKE.filter(m => {
      const mTitle = m.title?.toLowerCase().trim() || "";
      return m.id !== movie.id && 
             !partIds.has(m.id) && 
             mTitle !== movieTitle &&
             !partTitles.has(mTitle);
    }).slice(0, 6);
  }, [movie, movieParts]);

  const previewSearchResults = previewQuery.trim()
    ? (() => {
        const q = previewQuery.toLowerCase().trim();
        let searchQ = q;
        
        // 1. Map aliases
        if (q === "trending movies") searchQ = "trending";
        if (q === "newly released" || q === "newly movie" || q === "latest") searchQ = "new releases";
        if (q === "most viewed movies" || q === "most viewed") searchQ = "most viewed";

        // 2. Section Matches
        const sectionMatches = ALL_ROWS.filter(r => r.title?.toLowerCase().includes(searchQ)).flatMap(r => r.data);

        // 3. Regional & Type Mapping
        const regionalMatches: (Movie | Series)[] = [];
        if (searchQ.includes("chinese")) regionalMatches.push(...allPool.filter(m => m.genre?.toLowerCase().includes("chinese")));
        if (searchQ.includes("filipino")) regionalMatches.push(...allPool.filter(m => m.genre?.toLowerCase().includes("filipino")));
        if (searchQ.includes("korean")) regionalMatches.push(...allPool.filter(m => m.genre?.toLowerCase().includes("korean")));
        if (searchQ === "mini series") regionalMatches.push(...allPool.filter(m => "isMiniSeries" in m && m.isMiniSeries));
        if (searchQ === "series") regionalMatches.push(...allPool.filter(m => "seasons" in m && !("isMiniSeries" in m && m.isMiniSeries)));

        // 4. Fuzzy match
        const vjSearchQuery = searchQ.startsWith("vj ") ? searchQ.replace("vj ", "") : searchQ;
        const fuzzyMatches = allPool.filter((m) => {
          return (
            (m.title || "").toLowerCase().includes(searchQ) ||
            (m.genre || "").toLowerCase().includes(searchQ) ||
            String(m.year).includes(searchQ) ||
            (m.vj || "").toLowerCase().includes(vjSearchQuery) ||
            (m.title || "").toLowerCase().replace(/[^a-z0-9]/g, "").includes(searchQ.replace(/[^a-z0-9]/g, ""))
          );
        });

        // Combine and dedup
        const combined = [...sectionMatches, ...regionalMatches, ...fuzzyMatches];
        return Array.from(new Map(combined.map(item => [item.id, item])).values());
      })()
    : [];

  return (
    <Animated.View 
      style={[
        StyleSheet.absoluteFill, 
        { 
          backgroundColor: "#0a0a0f",
          transform: [{
            translateX: pan.x.interpolate({
              inputRange: [0, SCREEN_W],
              outputRange: [0, SCREEN_W],
              extrapolate: 'clamp'
            })
          }]
        }
      ]}
      {...panResponder.panHandlers}
    >
        <StatusBar
          barStyle="light-content"
          translucent
          backgroundColor="transparent"
        />
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {(isSearchExpanded || previewQuery.trim().length > 0) && (
            <View
              style={{
                position: "absolute",
                top: insets.top + (Platform.OS === 'ios' ? 0 : 5),
                left: 0,
                right: 0,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 18,
                paddingTop: 0,
                paddingBottom: 8,
                zIndex: 100,
              }}
            >
              <BlurView intensity={99} tint="dark" style={StyleSheet.absoluteFill} />
              <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(15, 15, 25, 0.95)" }]} />
              <Text
                style={{
                  color: "rgba(255,255,255,0.4)",
                  fontSize: 10,
                  fontWeight: "900",
                  letterSpacing: 0.5,
                  flex: 1,
                }}
              >
                SEARCH RESULTS IN MOVIES/SERIES LIBRARY
              </Text>
              <View style={styles.resultsCountBadge}>
                <BlurView
                  intensity={99}
                  tint="dark"
                  style={StyleSheet.absoluteFill}
                />
                <LinearGradient
                  colors={["rgba(255,255,255,0.12)", "transparent"]}
                  style={styles.pillSheen}
                />
                <Ionicons
                  name="search"
                  size={12}
                  color="rgba(255,255,255,0.6)"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.resultsCountText}>
                  {previewSearchResults.length}{" "}
                  {previewSearchResults.length === 1 ? "RESULT" : "RESULTS"}
                </Text>
              </View>

              {/* Seamless Fade Gradient where cards scroll underneath */}
              <LinearGradient
                colors={["rgba(15, 15, 25, 0.95)", "transparent"]}
                style={{
                  position: "absolute",
                  bottom: -12,
                  left: 0,
                  right: 0,
                  height: 12,
                  zIndex: -1,
                }}
                pointerEvents="none"
              />
            </View>
          )}

          {/* ── Top Header Controls (Back & Search) ── */}
          <Animated.View
            pointerEvents="box-none"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              flexDirection: "row",
              justifyContent: "space-between",
              paddingHorizontal: 16,
              zIndex: 110,
              height: 64, // Tightened to exactly match search icon bottom (30+34)
              paddingTop: insets.top, // Move content down to previous top position
            }}
          >
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                {
                  opacity: scrollY.interpolate({
                    inputRange: [200, 240],
                    outputRange: [0, 1],
                    extrapolate: "clamp",
                  }),
                },
              ]}
              pointerEvents="none"
            >
              <BlurView intensity={99} tint="dark" style={StyleSheet.absoluteFill} />
              <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(15, 15, 25, 0.95)" }]} />
              <LinearGradient
                colors={["rgba(15, 15, 25, 0.95)", "transparent"]}
                style={{
                  position: "absolute",
                  bottom: -12,
                  left: 0,
                  right: 0,
                  height: 12,
                }}
              />
            </Animated.View>
            
            {/* Mute Toggle on Left, aligned with Search on Right */}
            <TouchableOpacity
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: "rgba(0,0,0,0.4)",
                alignItems: "center",
                justifyContent: "center",
                marginRight: "auto",
              }}
              onPress={() => setIsMuted(!isMuted)}
            >
              <Ionicons
                name={isMuted ? "volume-mute" : "volume-high"}
                size={18}
                color="#fff"
              />
            </TouchableOpacity>

            {!isSearchVisible && previewQuery.trim().length === 0 && (
              <TouchableOpacity
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: "rgba(0,0,0,0.4)",
                  alignItems: "center",
                  justifyContent: "center",
                  marginLeft: "auto",
                }}
                onPress={() => {
                  DeviceEventEmitter.emit("openSearchOverlay", {
                    autoFocus: true,
                  });
                }}
              >
                <Ionicons name="search" size={20} color="#fff" />
              </TouchableOpacity>
            )}
          </Animated.View>

          <Animated.ScrollView
            ref={modalScrollRef}
            scrollEnabled={!isSearchExpanded}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
            contentContainerStyle={{ paddingBottom: 100 }}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: false },
            )}
            scrollEventThrottle={16}
          >
            {!isSearchExpanded && !previewQuery && (
              <>
                {/* ── Poster hero ── */}
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => {
                    const canWatch = allMoviesFree || (movie as any).isFree || isPaid;
                    if (!canWatch) {
                      onShowPremium();
                      return;
                    }
                    // For series, prioritize the first episode, otherwise the standard movie URL
                    const firstPart = movieParts?.[0];
                    // Prioritize local downloaded file for offline playback
                    let finalUrl: string | undefined;
                    if (firstPart) {
                      finalUrl = episodeDownloads?.[firstPart.id] || firstPart.videoUrl;
                    } else {
                      // Single movie: check if it's downloaded locally
                      const dl = downloadedMovies.find(m => m.id === movie.id);
                      finalUrl = (dl as any)?.localUri || (movie as any).videoUrl;
                    }
                    
                    setSelectedVideoUrl?.(finalUrl);
                    setPlayerTitle?.(movie.title + (firstPart ? " - " + (firstPart.title || "Part 1") : ""));
                    setPlayingNow?.(movie as Movie);
                    setPlayerMode?.('full');
                  }}
                >
                  {previewVideoUrl ? (
                    <>
                      <Video
                        source={{ 
                          uri: resolveCDNUrl(previewVideoUrl),
                          overridingExtension: 'm3u8',
                          headers: {
                            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.162 Mobile Safari/537.36',
                            'Referer': 'https://themoviezone247.com/'
                          }
                        }}
                        style={styles.previewPoster}
                        resizeMode={ResizeMode.COVER}
                        shouldPlay={playerMode === 'closed' && isFocused && appState === 'active'}
                        isLooping
                        isMuted={isMuted}
                        usePoster={true}
                        posterSource={{ uri: movie.poster }}
                        posterStyle={{ resizeMode: 'cover' }}
                      />
                      {/* Hidden Detector for Full Movie Duration (used if database has 0:00) */}
                      {movie && !("seasons" in movie) && (!(movie as any).duration || (movie as any).duration === "0:00") && (movie as any).videoUrl && (
                        <Video
                          source={{ 
                            uri: resolveCDNUrl((movie as any).videoUrl),
                            overridingExtension: (movie as any).videoUrl?.includes('.m3u8') ? 'm3u8' : undefined,
                            headers: {
                              'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.162 Mobile Safari/537.36',
                              'Referer': 'https://themoviezone247.com/'
                            }
                          }}
                          shouldPlay={false}
                          onPlaybackStatusUpdate={(s) => {
                            if (s.isLoaded && s.durationMillis && !detectedDuration) {
                              const mins = Math.floor(s.durationMillis / 60000);
                              const hrs = Math.floor(mins / 60);
                              const rMins = mins % 60;
                              setDetectedDuration(hrs > 0 ? `${hrs}h ${rMins}m` : `${mins}m`);
                            }
                          }}
                          style={{ width: 0, height: 0, position: 'absolute' }}
                        />
                      )}
                    </>
                  ) : (
                    <Image
                      source={{ uri: movie.poster }}
                      style={styles.previewPoster}
                    />
                  )}

                  <LinearGradient
                    colors={["transparent", "#0a0a0f"]}
                    style={styles.previewPosterFade}
                  />
                  {/* Play Overlay */}
                  <View
                    style={[
                      StyleSheet.absoluteFill,
                      { justifyContent: "center", alignItems: "center" },
                    ]}
                  >
                    {/* Wave/Ripple Effect Rings */}
                    {[0, 1, 2].map((i) => (
                      <Animated.View
                        key={i}
                        style={[
                          styles.posterPlayBtn,
                          {
                            position: "absolute",
                            borderWidth: 2,
                            borderColor: "rgba(255,255,255,0.4)",
                            transform: [
                              {
                                scale: waveAnim.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [1, 1 + (i + 1) * 0.5],
                                }),
                              },
                            ],
                            opacity: waveAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.6, 0],
                            }),
                          },
                        ]}
                      />
                    ))}

                    <Animated.View
                      style={{ transform: [{ scale: playPulse }] }}
                    >

                      <TouchableOpacity
                        style={styles.posterPlayBtn}
                        activeOpacity={0.8}
                        onPress={() => {
                          const canWatch = allMoviesFree || (movie as any).isFree || isPaid;
                          if (!canWatch) {
                            onShowPremium();
                            return;
                          }
                          
                          // Consistently use the current active part's URL and title
                          const videoUri = currentPlayerUrl;
                          const titleToPlay = currentPlayerTitle;

                          if (videoUri) {
                            setIsPreview?.(true);
                            setSelectedVideoUrl?.(videoUri);
                            setPlayerTitle?.(titleToPlay);
                            setPlayingNow?.(movie as Movie);
                            setPlayerMode?.('full');
                          }
                        }}
                      >
                        <BlurView
                          intensity={30}
                          tint="light"
                          style={[
                            StyleSheet.absoluteFill,
                            { borderRadius: 36 },
                          ]}
                        />
                        <Ionicons
                          name="play"
                          size={32}
                          color="#fff"
                          style={{ marginLeft: 4 }}
                        />
                      </TouchableOpacity>
                    </Animated.View>
                  </View>
                </TouchableOpacity>

                {/* ── Movie info ── */}
                <View style={styles.previewContent}>
                  {/* Genre pills + compact VJ · year · time — matches series preview */}
                  <View style={[styles.previewTags, { alignItems: 'center', flexWrap: 'wrap' }]}>
                    {(movie.genre || "")
                      .split(" · ")
                      .filter(Boolean)
                      .map((g) => (
                        <View key={g} style={styles.previewTagBadge}>
                          <BlurView
                            intensity={45}
                            tint="dark"
                            style={StyleSheet.absoluteFill}
                          />
                          <Text style={styles.previewTagText}>{g}</Text>
                        </View>
                      ))}

                    {/* Compact meta: VJ · year · duration */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                      <Ionicons name="mic-outline" size={11} color="#f59e0b" />
                      <Text style={[styles.previewMetaText, { fontSize: 11, color: '#f59e0b' }]}>{movie.vj}</Text>
                      <View style={styles.previewDot} />
                      <Text style={[styles.previewMetaText, { fontSize: 11 }]}>{movie.year}</Text>
                      <View style={styles.previewDot} />
                      <Ionicons name="time-outline" size={11} color="#475569" />
                      <Text style={[styles.previewMetaText, { fontSize: 11 }]}>
                        {computedTotalDuration}
                      </Text>

                      {/* --- Series Info Pills (New Design) --- */}
                      {"seasons" in movie && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 4 }}>
                          {/* Mini Series / Series Badge (RED) */}
                          <View style={{
                            backgroundColor: 'rgba(239, 68, 68, 0.15)',
                            borderWidth: 1,
                            borderColor: 'rgba(239, 68, 68, 0.3)',
                            borderRadius: 6,
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                          }}>
                            <Text style={{ color: '#ef4444', fontSize: 11, fontWeight: '900' }}>
                              {movie.isMiniSeries ? "Mini Series" : "Series"}
                            </Text>
                          </View>

                          {/* Season Badge (YELLOW) */}
                          {!movie.isMiniSeries && movie.seasons > 0 && (
                             <View style={{
                              backgroundColor: 'rgba(245, 158, 11, 0.15)',
                              borderWidth: 1,
                              borderColor: 'rgba(245, 158, 11, 0.3)',
                              borderRadius: 6,
                              paddingHorizontal: 8,
                              paddingVertical: 3,
                            }}>
                              <Text style={{ color: '#f59e0b', fontSize: 11, fontWeight: '900' }}>
                                Season {movie.seasons}
                              </Text>
                            </View>
                          )}

                          {/* EP Badge (PURPLE) */}
                          {movieParts.length > 0 && (
                            <View style={{
                              backgroundColor: 'rgba(91, 95, 239, 0.2)',
                              borderWidth: 1,
                              borderColor: 'rgba(91, 95, 239, 0.4)',
                              borderRadius: 6,
                              paddingHorizontal: 8,
                              paddingVertical: 3,
                            }}>
                              <Text style={{ color: '#818cf8', fontSize: 11, fontWeight: '900' }}>
                                EP {movieParts[currentIndex]?.displayIndex || currentIndex + 1} / {(movie as any).episodes || (movieParts.length * ((movie as any).episodesPerPart || 1))}
                              </Text>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  </View>
                  {/* Title row + rating + Part badge (like series Ep/Season badges) */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 0 }}>
                    <Text style={[styles.previewTitle, { marginBottom: 0, flex: undefined }]}>{movie.title}</Text>

                    {/* TOTAL COUNT Badge (New) */}
                    {movieParts.length > 1 && (
                      <View style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1,
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                        borderRadius: 6,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                      }}>
                        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '800' }}>
                          {movieParts.length} {movieParts.length === 1 ? 'PART' : 'PARTS'}
                        </Text>
                      </View>
                    )}



                    {/* Part badge – dynamic based on selected part */}
                    {!('seasons' in movie) && movieParts.length > 0 && (
                      <View style={{
                        backgroundColor: 'rgba(91, 95, 239, 0.2)', borderWidth: 1,
                        borderColor: 'rgba(91, 95, 239, 0.4)', borderRadius: 6,
                        paddingHorizontal: 8, paddingVertical: 3,
                      }}>
                        <Text style={{ color: '#818cf8', fontSize: 12, fontWeight: '900' }}>PART {movieParts[currentIndex]?.displayIndex || currentIndex + 1}</Text>
                      </View>
                    )}
                  </View>
                  {/* ── Collapsible Description ── */}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setDescExpanded(prev => !prev)}
                    style={{ marginBottom: 4 }}
                  >
                    <Text
                      style={styles.previewDesc}
                      numberOfLines={descExpanded ? undefined : 2}
                    >
                      {desc}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                      <Ionicons
                        name={descExpanded ? 'chevron-up' : 'chevron-down'}
                        size={14}
                        color="rgba(255,255,255,0.45)"
                      />
                      <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginLeft: 3, fontWeight: '600' }}>
                        {descExpanded ? 'Less' : 'More'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  <View style={styles.previewActions}>
                    {/* MY LIST */}
                    <TouchableOpacity
                      style={styles.previewActionCol}
                      onPress={handleMyList}
                    >
                      <Animated.View
                        style={[
                          styles.previewActionIconBg,
                          isFavorite && {
                            backgroundColor: "rgba(255,193,7,0.2)",
                            borderColor: "#FFC107",
                          },
                          { transform: [{ scale: myListScale }] },
                        ]}
                      >
                        <Ionicons
                          name={isFavorite ? "checkmark-circle" : "add"}
                          size={24}
                          color={isFavorite ? "#FFC107" : "#fff"}
                        />
                      </Animated.View>
                      <Text
                        style={[
                          styles.previewActionLabel,
                          isFavorite && { color: "#FFC107" },
                        ]}
                      >
                        {isFavorite ? "In My List" : "My List"}
                      </Text>
                    </TouchableOpacity>

                    {/* DOWNLOAD */}
                    {(() => {
                      const activeDl = movie ? (activeDownloads[movie.id] || Object.values(activeDownloads).find(d => (d as any)?.item?.id === movie.id)) : null;
                      const isDl = !!activeDl;
                      const isDownloaded = movie ? downloadedMovies.some(m => m.id === movie.id) : false;
                      
                      return (
                        <TouchableOpacity
                          style={styles.previewActionCol}
                          onPress={() => handleDownload()}
                        >
                          <View
                            style={[
                              styles.previewActionIconBg,
                              isDl && { borderColor: activeDl?.isPaused ? "#ef4444" : "#22c55e", backgroundColor: activeDl?.isPaused ? "rgba(239,68,68,0.12)" : "rgba(34,197,94,0.12)" },
                              isDownloaded && !isDl && { borderColor: "#10b981", backgroundColor: "rgba(16,185,129,0.12)" },
                            ]}
                          >
                            {isDl ? (
                              <Animated.View style={{ transform: [{ scale: downloadPulse }] }}>
                                <Ionicons
                                  name={activeDl?.isPaused ? "play" : "pause"}
                                  size={20}
                                  color={activeDl?.isPaused ? "#ef4444" : "#22c55e"}
                                />
                              </Animated.View>
                            ) : isDownloaded ? (
                              <Ionicons name="checkmark-circle" size={22} color="#10b981" />
                            ) : (
                              <Ionicons
                                name="download-outline"
                                size={22}
                                color="#fff"
                              />
                            )}
                          </View>
                          <Text
                            style={[
                              styles.previewActionLabel,
                              isDl && { color: activeDl?.isPaused ? "#ef4444" : "#22c55e" },
                              isDownloaded && !isDl && { color: "#10b981" },
                            ]}
                          >
                            {isDl
                              ? activeDl?.isPaused
                                ? `Paused (${activeDl.progress}%)`
                                : `${activeDl.progress}% • ${activeDl.speedString?.split('•')[1]?.trim() || 'Starting...'}`
                              : isDownloaded
                                ? "Saved Offline"
                                : "Download"}
                          </Text>
                        </TouchableOpacity>
                      );
                    })()}

                    {/* CAST */}
                    <TouchableOpacity
                      style={styles.previewActionCol}
                      onPress={handleCast}
                    >
                      <View
                        style={[
                          styles.previewActionIconBg,
                          isCasting && {
                            backgroundColor: "rgba(56,189,248,0.2)",
                            borderColor: "#38bdf8",
                          },
                        ]}
                      >
                        {isCastConnecting ? (
                          <Animated.View style={{ opacity: playPulse }}>
                            <MaterialCommunityIcons
                              name="cast"
                              size={22}
                              color="#38bdf8"
                            />
                          </Animated.View>
                        ) : (
                          <MaterialCommunityIcons
                            name={isCasting ? "cast-connected" : "cast"}
                            size={22}
                            color={isCasting ? "#38bdf8" : "#fff"}
                          />
                        )}
                      </View>
                      <Text
                        style={[
                          styles.previewActionLabel,
                          isCasting && { color: "#38bdf8" },
                        ]}
                      >
                        {isCastConnecting
                          ? "Connecting…"
                          : isCasting
                            ? "Casting"
                            : "Cast"}
                      </Text>
                    </TouchableOpacity>

                    {/* COMMENT */}
                    <TouchableOpacity
                      style={styles.previewActionCol}
                      onPress={() => setShowComments(true)}
                    >
                      <View style={styles.previewActionIconBg}>
                        <Ionicons
                          name="chatbubble-outline"
                          size={20}
                          color="#fff"
                        />
                        {comments.length > 0 && (
                          <View
                            style={{
                              position: "absolute",
                              top: -4,
                              right: -4,
                              backgroundColor: "#e11d48",
                              borderRadius: 8,
                              minWidth: 16,
                              height: 16,
                              justifyContent: "center",
                              alignItems: "center",
                              paddingHorizontal: 3,
                            }}
                          >
                            <Text
                              style={{
                                color: "#fff",
                                fontSize: 9,
                                fontWeight: "900",
                              }}
                            >
                              {comments.length}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.previewActionLabel}>Comment</Text>
                    </TouchableOpacity>

                    {/* SHARE */}
                    <TouchableOpacity
                      style={styles.previewActionCol}
                      onPress={handleShare}
                    >
                      <View style={styles.previewActionIconBg}>
                        <Ionicons
                          name="share-social-outline"
                          size={20}
                          color="#fff"
                        />
                      </View>
                      <Text style={styles.previewActionLabel}>Share</Text>
                    </TouchableOpacity>
                  </View>

                {/* ── SEASONS SECTION (For Series) ── */}
                {"seasons" in movie && movie.seasons > 0 && (
                  <View style={{ marginTop: 20, paddingHorizontal: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 }}>
                      <View style={{ 
                        width: 4, 
                        height: 20, 
                        backgroundColor: '#5B5FEF', 
                        borderRadius: 2 
                      }} />
                      <Text style={{ 
                        color: '#fff', 
                        fontSize: 16, 
                        fontWeight: '800', 
                        letterSpacing: 0.5 
                      }}>
                        {movie.isMiniSeries ? "MINI SERIES" : "SERIES SEASONS"}
                      </Text>
                      <View style={{
                        backgroundColor: 'rgba(91, 95, 239, 0.15)',
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 6,
                        borderWidth: 1,
                        borderColor: 'rgba(91, 95, 239, 0.3)'
                      }}>
                        <Text style={{ color: '#5B5FEF', fontSize: 10, fontWeight: '900' }}>
                          {movie.seasons} {movie.seasons === 1 ? 'SEASON' : 'SEASONS'}
                        </Text>
                      </View>
                    </View>
                    <ScrollView 
                      horizontal 
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 10 }}
                    >
                      {Array.from({ length: movie.seasons }, (_, i) => i + 1).map((sNum) => (
                        <TouchableOpacity
                          key={`season-${sNum}`}
                          style={{
                            paddingHorizontal: 16,
                            paddingVertical: 8,
                            borderRadius: 12,
                            backgroundColor: sNum === selectedSeason ? 'rgba(91, 95, 239, 0.2)' : 'rgba(255,255,255,0.05)',
                            borderWidth: 1,
                            borderColor: sNum === selectedSeason ? '#5B5FEF' : 'rgba(255,255,255,0.1)',
                          }}
                          activeOpacity={0.7}
                          onPress={() => setSelectedSeason(sNum)}
                        >
                          <Text style={{ 
                            color: sNum === selectedSeason ? '#fff' : 'rgba(255,255,255,0.5)', 
                            fontSize: 14, 
                            fontWeight: '700' 
                          }}>
                            Season {sNum}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* ── OTHER PARTS SECTION (For Movie Parts) ── */}
                {movieParts.length > 1 && (
                  <View style={styles.episodesSection}>
                    <View style={{ marginTop: 12, marginBottom: showOtherParts ? 12 : 4, paddingHorizontal: 4 }}>
                      {/* ── Wave/Ripple Animation (Moved here to avoid clipping) ── */}
                      {[0, 1].map((i) => (
                        <Animated.View
                          key={`wave-outer-${i}`}
                          pointerEvents="none"
                          style={[
                            StyleSheet.absoluteFill,
                            {
                              borderWidth: 2,
                              borderColor: "rgba(91, 95, 239, 0.4)",
                              borderRadius: 18,
                              transform: [
                                {
                                  scaleX: otherPartsWaveAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [1, 1.05 + (i * 0.05)],
                                  }),
                                },
                                {
                                  scaleY: otherPartsWaveAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [1, 1.25 + (i * 0.15)],
                                  }),
                                },
                              ],
                              opacity: otherPartsWaveAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0.6, 0],
                              }),
                            },
                          ]}
                        />
                      ))}

                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => {
                          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                          setShowOtherParts(prev => !prev);
                        }}
                        style={styles.premiumHeaderOuterPill}
                      >
                        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
                        <LinearGradient
                          colors={["rgba(30, 30, 40, 0.7)", "rgba(10, 10, 15, 0.5)"]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={StyleSheet.absoluteFill}
                        />

                        {/* ── Shimmer/Sheen Overlay ── */}
                        <Animated.View
                          pointerEvents="none"
                          style={[
                            StyleSheet.absoluteFill,
                            {
                              transform: [
                                {
                                  translateX: otherPartsShimmerAnim.interpolate({
                                    inputRange: [0, 2],
                                    outputRange: [-SCREEN_W / 1.5, SCREEN_W / 1.5],
                                  }),
                                },
                                { rotate: "20deg" },
                              ],
                            },
                          ]}
                        >
                          <LinearGradient
                            colors={["transparent", "rgba(255,255,255,0.02)", "rgba(255,255,255,0.1)", "rgba(255,255,255,0.02)", "transparent"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={{ flex: 1, width: 80 }}
                          />
                        </Animated.View>
                        
                        <View style={styles.premiumHeaderInner}>
                          <Text style={[styles.episodesTitlePremium, { flexShrink: 1 }]} numberOfLines={1}>
                            {movie.title.toUpperCase()} {"seasons" in movie ? "EPISODE" : "OTHER PARTS"}
                          </Text>
                          <View style={{ flex: 1 }} />
                          <View style={styles.epCountPillPremium}>
                            <Text style={styles.epCountTextPremium}>
                              {"seasons" in movie ? `${(movie as any).episodes || (movieParts.length * ((movie as any).episodesPerPart || 1))} EP` : `EP ${(movie as any).episodes || (movieParts.length * ((movie as any).episodesPerPart || 1))}`}
                            </Text>
                          </View>
                          <Ionicons
                            name={showOtherParts ? "chevron-up" : "chevron-down"}
                            size={14}
                            color="rgba(255,255,255,0.6)"
                            style={{ marginLeft: 6 }}
                          />
                        </View>
                      </TouchableOpacity>
                    </View>

                    {showOtherParts && movieParts
                      .filter((mp) => mp.id !== activePartId)
                      .map((mp) => (
                        <TouchableOpacity
                          key={mp.id}
                          style={styles.episodeItemPremium}
                          onPress={() => {
                            const mpCanWatch = allMoviesFree || mp.isFree || isPaid;
                            if (!mpCanWatch) {
                              onShowPremium();
                              return;
                            }
                            setActivePartId(mp.id);
                            // Prioritize local downloaded file for offline playback
                            const localUri = episodeDownloads?.[mp.id];
                            setSelectedVideoUrl?.(localUri || mp.videoUrl);
                            setPlayerTitle?.(mp.title);
                            setPlayerMode?.('full');
                          }}

                          activeOpacity={0.8}
                        >
                          <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
                          <LinearGradient
                            colors={["rgba(30, 30, 45, 0.4)", "rgba(10, 10, 15, 0.2)"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={StyleSheet.absoluteFill}
                          />
                          
                          <View style={styles.epThumbWrapPremiumLarge}>
                            <Image
                              source={{ uri: mp.poster }}
                              style={styles.epThumb}
                            />
                            <LinearGradient
                              colors={["transparent", "rgba(0,0,0,0.4)"]}
                              style={StyleSheet.absoluteFill}
                            />
                            <View style={styles.epDurationBadgePremiumSmall}>
                              <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
                              <Text style={styles.epDurationTextPremium}>{mp.duration}</Text>
                            </View>

                            {/* VJ Badge (Matching Saved Tab Design) */}
                            <View style={{ 
                              position: 'absolute', 
                              bottom: 5, 
                              left: 5, 
                              backgroundColor: 'rgba(0,0,0,0.75)', 
                              paddingHorizontal: 6, 
                              paddingVertical: 2, 
                              borderRadius: 6, 
                              flexDirection: 'row', 
                              alignItems: 'center', 
                              gap: 3,
                              borderWidth: 1,
                              borderColor: 'rgba(255,255,255,0.15)'
                            }}>
                              <Ionicons name="mic" size={10} color="#fff" />
                              <Text style={{ color: '#fff', fontSize: 8, fontWeight: '900' }}>{mp.vj}</Text>
                            </View>

                            <View style={styles.epThumbPlayIconOverlay}>
                              <Ionicons name={(!allMoviesFree && !mp.isFree && (subscriptionBundle === 'None' || isGuest)) ? "lock-closed" : "play"} size={16} color="#fff" style={{ marginLeft: 2 }} />
                            </View>
                          </View>
                          
                          <View style={styles.epInfoPremium}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                              <Text style={[styles.epTitlePremium, { flex: 1 }]} numberOfLines={1}>
                                {mp.title}
                              </Text>
                            </View>
                            <View style={styles.epMetaRowSmall}>
                              <View style={{
                                backgroundColor: '#fff',
                                borderWidth: 0.5,
                                borderColor: 'rgba(0,0,0,0.1)',
                                borderRadius: 4,
                                paddingHorizontal: 5,
                                paddingVertical: 1,
                                shadowColor: "#000",
                                shadowOffset: { width: 0, height: 1 },
                                shadowOpacity: 0.1,
                                shadowRadius: 1,
                                elevation: 1,
                              }}>
                                <Text style={{ color: '#5B5FEF', fontSize: 8, fontWeight: '900' }}>
                                  EP {mp.displayIndex}
                                </Text>
                              </View>
                              <View style={styles.epStatusBadgeSmall}>
                                <Text style={styles.epStatusTextSmall}>HD</Text>
                              </View>
                            </View>
                            
                            {/* Episode Action Row (Unified Download) */}
                            <View style={{ marginTop: 2, flexDirection: 'row', alignItems: 'center' }}>
                              {activeDownloads[mp.id] !== undefined ? (
                                <TouchableOpacity 
                                  style={{ 
                                    backgroundColor: activeDownloads[mp.id].isPaused ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)', 
                                    borderWidth: 1, 
                                    borderColor: activeDownloads[mp.id].isPaused ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)', 
                                    borderRadius: 8, 
                                    flex: 1, 
                                    paddingVertical: 7, 
                                    alignItems: 'center',
                                    flexDirection: 'row',
                                    justifyContent: 'center',
                                    gap: 6
                                  }}
                                  onPress={(e) => {
                                    e.stopPropagation();
                                    activeDownloads[mp.id].isPaused ? resumeDownload(mp.id) : pauseDownload(mp.id);
                                  }}
                                >
                                  <Animated.View style={{ transform: [{ scale: downloadPulse }] }}>
                                    <Ionicons 
                                      name={activeDownloads[mp.id].isPaused ? "play" : "pause"} 
                                      size={14} 
                                      color={activeDownloads[mp.id].isPaused ? "#ef4444" : "#22c55e"} 
                                    />
                                  </Animated.View>
                                  <Text style={{ color: activeDownloads[mp.id].isPaused ? "#ef4444" : "#22c55e", fontSize: 11, fontWeight: '900', letterSpacing: 0.5 }}>
                                    {activeDownloads[mp.id].isPaused 
                                      ? `PAUSED (${activeDownloads[mp.id].progress}%)` 
                                      : `${activeDownloads[mp.id].progress}% • ${activeDownloads[mp.id].speedString?.split('•')[1]?.trim() || 'STAGING...'}`
                                    }
                                  </Text>
                                </TouchableOpacity>
                              ) : episodeDownloads[mp.id] ? (
                                <View style={{ 
                                  backgroundColor: 'rgba(16, 185, 129, 0.12)', 
                                  borderWidth: 1, 
                                  borderColor: 'rgba(16, 185, 129, 0.4)', 
                                  borderRadius: 8, 
                                  flex: 1, 
                                  paddingVertical: 7, 
                                  alignItems: 'center',
                                  flexDirection: 'row',
                                  justifyContent: 'center',
                                  gap: 6
                                }}>
                                  <Ionicons name="checkmark-circle" size={14} color="#10b981" />
                                  <Text style={{ color: '#10b981', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 }}>SAVED OFFLINE</Text>
                                </View>
                              ) : (
                                <TouchableOpacity
                                  style={{ 
                                    backgroundColor: 'rgba(52, 211, 153, 0.1)', 
                                    borderWidth: 1, 
                                    borderColor: 'rgba(52, 211, 153, 0.3)', 
                                    borderRadius: 8, 
                                    flex: 1, 
                                    paddingVertical: 7, 
                                    alignItems: 'center',
                                    flexDirection: 'row',
                                    justifyContent: 'center',
                                    gap: 6
                                  }}
                                  onPress={(e) => {
                                    e.stopPropagation();
                                    // Unified download flow: open the preview/download modal
                                    setSelectedEpisodeForDownload({
                                      id: mp.id,
                                      title: mp.title,
                                      videoUrl: mp.url || mp.videoUrl || ''
                                    });
                                    setShowDownloadModal(true);
                                  }}
                                >
                                  <Ionicons name="download-outline" size={14} color="#10b981" />
                                  <Text style={{ color: '#10b981', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 }}>DOWNLOAD</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                        </TouchableOpacity>
                      ))}
                  </View>
                )}
                </View>
              </>
            )}

            {/* ── Download Options Modal (Frosted Dark) ── */}
            <Modal
              visible={showDownloadModal}
              transparent
              animationType="fade"
              statusBarTranslucent
              onRequestClose={() => setShowDownloadModal(false)}
            >
              <View style={styles.downloadModalCentering}>
                <TouchableOpacity
                  style={[
                    StyleSheet.absoluteFill,
                    { backgroundColor: "rgba(0,0,0,0.85)" },
                  ]}
                  activeOpacity={1}
                  onPress={() => setShowDownloadModal(false)}
                />
                <Animated.View style={styles.downloadGlassCard}>
                  <BlurView
                    intensity={90}
                    tint="dark"
                    style={StyleSheet.absoluteFill}
                  />
                  <LinearGradient
                    colors={["rgba(255,255,255,0.08)", "transparent"]}
                    style={StyleSheet.absoluteFill}
                  />

                  <View style={styles.downloadIconHeader}>
                    <View style={styles.downloadIconCircle}>
                      <Ionicons
                        name="cloud-download"
                        size={32}
                        color="#5B5FEF"
                      />
                    </View>
                  </View>

                  <Text style={styles.downloadTitle}>Download Options</Text>
                  <Text style={styles.downloadSub}>
                    Choose your preferred method to save "{selectedEpisodeForDownload?.title || movie?.title}" for
                    offline viewing.
                  </Text>

                  <View style={styles.downloadActions}>
                    <TouchableOpacity
                      style={styles.downloadPrimaryBtn}
                      onPress={startDownloadFlow}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={["#5B5FEF", "#4A4EDD"]}
                        style={StyleSheet.absoluteFill}
                      />
                      <Ionicons
                        name="phone-portrait-outline"
                        size={20}
                        color="#fff"
                      />
                      <Text style={styles.downloadPrimaryBtnText}>
                        DOWNLOAD
                      </Text>
                      <View style={styles.pillSheen} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.downloadSecondaryBtn,
                        (isGuest || !isPaid) ? {} : (getRemainingDownloads() === 0 && { opacity: 0.4 }),
                      ]}
                      onPress={async () => {
                        if (!isPaid) {
                           setShowDownloadModal(false);
                           Alert.alert("Premium Feature", "External Downloads are reserved for Premium Subscribers. Enjoy your Free Streaming inside the app today!");
                           return;
                        }
                        if (getRemainingDownloads() === 0) {
                           setShowDownloadModal(false);
                           onShowPremium();
                           return;
                        }
                        
                        // Check permissions first in the UI
                        const { status } = await MediaLibrary.requestPermissionsAsync(true);
                        if (status !== 'granted') {
                          setShowDownloadModal(false);
                          Alert.alert("Permission Denied", "Please allow gallery access to save videos as MP4 files.");
                          return;
                        }

                        setShowDownloadModal(false);
                        const targetTitle = selectedEpisodeForDownload?.title || movie.title;
                        const targetItem = selectedEpisodeForDownload || movie;
                        if (selectedEpisodeForDownload) {
                          downloadEpisode(
                            "seasons" in movie ? (movie as Series) : { ...movie, episodeList: [] } as any,
                            selectedEpisodeForDownload,
                            'external'
                          );
                        } else {
                          downloadMovie(targetItem as any, 'external');
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="folder-outline"
                        size={20}
                        color="#94a3b8"
                      />
                      <Text style={styles.downloadSecondaryBtnText}>
                        EXTERNAL DOWNLOAD
                      </Text>
                      <View
                        style={{
                          backgroundColor: getRemainingDownloads() === 0 ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.08)",
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: 10,
                          marginLeft: 4,
                        }}
                      >
                          <Text
                            style={{
                              fontSize: 9,
                              color: getRemainingDownloads() === 0 ? "#ef4444" : "#94a3b8",
                              fontWeight: "700",
                            }}
                          >
                            {getRemainingDownloads() === 0 ? "0 left" : `${getRemainingDownloads()} left`}
                          </Text>
                      </View>
                    </TouchableOpacity>

                  {getRemainingDownloads() <= 3 && (
                    <TouchableOpacity
                      style={{ marginTop: 4, alignSelf: "center", padding: 8 }}
                      onPress={() => {
                        setShowDownloadModal(false);
                        onClose();
                        onUpgrade();
                      }}
                    >
                      <Text
                        style={{
                          color: getRemainingDownloads() === 0 ? "#ef4444" : "#5B5FEF",
                          fontSize: 13,
                          fontWeight: "700",
                          textDecorationLine: "underline",
                        }}
                      >
                        {getRemainingDownloads() === 0 ? "Limit reached — Upgrade for more" : "Upgrade for more daily downloads"}
                      </Text>
                    </TouchableOpacity>
                  )}

                    <TouchableOpacity
                      style={styles.downloadCancelLink}
                      onPress={() => setShowDownloadModal(false)}
                    >
                      <Text style={styles.downloadCancelText}>Maybe Later</Text>
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              </View>
            </Modal>

            {/* ── Already Downloaded Modal (Frosted Dark) ── */}
            <Modal
              visible={alreadyDownloadedState.visible && playerMode !== 'full'}
              transparent
              animationType="fade"
              onRequestClose={() => setAlreadyDownloadedState({ visible: false })}
            >
              <View style={styles.downloadModalCentering}>
                <TouchableOpacity
                  style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.6)" }]}
                  activeOpacity={1}
                  onPress={() => setAlreadyDownloadedState({ visible: false })}
                />
                <View
                  style={[
                    styles.downloadModalContent,
                    { width: 300, backgroundColor: "#1e293b", padding: 0 },
                  ]}
                >
                  <View style={{ padding: 20, alignItems: "center" }}>
                    <Ionicons name="checkmark-circle" size={40} color="#10b981" style={{ marginBottom: 10 }} />
                    <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700", textAlign: "center", marginBottom: 8 }}>
                      Already Downloaded
                    </Text>
                    <Text style={{ color: "#94a3b8", fontSize: 14, textAlign: "center", lineHeight: 20 }}>
                      "{movie.title}" is already saved in My Downloads.
                    </Text>
                  </View>
                  
                  <View style={{ borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)" }}>
                    <TouchableOpacity
                      style={{ paddingVertical: 16, alignItems: "center", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)" }}
                      onPress={() => {
                        setAlreadyDownloadedState({ visible: false });
                        if ((alreadyDownloadedState.localItem as any)?.localUri) {
                          setSelectedVideoUrl((alreadyDownloadedState.localItem as any).localUri);
                          setPlayerTitle(movie.title);
                          setPlayerMode?.('full');
                        }
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Ionicons name="play" size={18} color="#10b981" />
                        <Text style={{ color: "#10b981", fontSize: 16, fontWeight: "600" }}>Play Offline</Text>
                      </View>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={{ paddingVertical: 16, alignItems: "center", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)" }}
                      onPress={async () => {
                        if (!isPaid) {
                           setAlreadyDownloadedState({ visible: false });
                           Alert.alert("Premium Feature", "External Downloads are reserved for Premium Subscribers. Enjoy your Free Streaming inside the app today!");
                           return;
                        }
                        if (getRemainingDownloads() === 0) {
                           setAlreadyDownloadedState({ visible: false });
                           onShowPremium();
                           return;
                        }

                        // Check permissions first in the UI
                        const { status } = await MediaLibrary.requestPermissionsAsync(true);
                        if (status !== 'granted') {
                          setAlreadyDownloadedState({ visible: false });
                          Alert.alert("Permission Denied", "Please allow gallery access to save videos as MP4 files.");
                          return;
                        }

                        setAlreadyDownloadedState({ visible: false });
                        const targetTitle = alreadyDownloadedState.episode?.title || movie.title;
                        const targetItem = alreadyDownloadedState.episode || movie;
                        if (alreadyDownloadedState.episode) {
                          downloadEpisode(
                            "seasons" in movie ? (movie as Series) : { ...movie, episodeList: [] } as any,
                            alreadyDownloadedState.episode,
                            'external'
                          );
                        } else {
                          downloadMovie(targetItem as any, 'external');
                        }
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Ionicons name="download" size={18} color="#3b82f6" />
                        <Text style={{ color: "#3b82f6", fontSize: 16, fontWeight: "600" }}>External Downloads</Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={{ paddingVertical: 16, alignItems: "center", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)" }}
                      onPress={() => {
                        setAlreadyDownloadedState({ visible: false });
                        const id = alreadyDownloadedState.episode?.id || movie.id;
                        deleteDownload(id);
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Ionicons name="trash-outline" size={18} color="#ef4444" />
                        <Text style={{ color: "#ef4444", fontSize: 16, fontWeight: "600" }}>Delete from Device</Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={{ paddingVertical: 16, alignItems: "center" }}
                      onPress={() => setAlreadyDownloadedState({ visible: false })}
                    >
                      <Text style={{ color: "#94a3b8", fontSize: 16, fontWeight: "500" }}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>

            {/* ── Comments Sheet ── */}
            {showComments && (
              <Modal
                visible
                animationType="slide"
                transparent
                statusBarTranslucent
                onRequestClose={() => setShowComments(false)}
              >
                <View style={{ flex: 1 }}>
                  {/* Dimmed backdrop — tap to close */}
                  <TouchableOpacity
                    style={[
                      StyleSheet.absoluteFill,
                      { backgroundColor: "rgba(0,0,0,0.55)" },
                    ]}
                    activeOpacity={1}
                    onPress={() => {
                      setShowComments(false);
                      Keyboard.dismiss();
                    }}
                  />
                  
                  {/* Fills any gap caused by Android's navigation bar lifting the view */}
                  <View 
                    style={{ 
                      position: 'absolute', 
                      bottom: 0, 
                      left: 0, 
                      right: 0, 
                      height: 100, 
                      backgroundColor: '#111827',
                      zIndex: -1 
                    }} 
                  />
                  <KeyboardAvoidingView
                    behavior="padding"
                    keyboardVerticalOffset={0}
                    style={{ flex: 1, justifyContent: "flex-end" }}
                  >
                    <View
                      style={{
                        height: '85%', 
                        maxHeight: 420, 
                        backgroundColor: "#111827",
                        borderTopLeftRadius: 24,
                        borderTopRightRadius: 24,
                        overflow: "hidden",
                        paddingBottom: insets.bottom, // Flush with navigation bar
                      }}
                    >
                    <View style={{ flex: 1 }}>
                      <View
                        {...PanResponder.create({
                          onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 10,
                          onPanResponderRelease: (_, gestureState) => {
                            if (gestureState.dy > 40) {
                              setShowComments(false);
                              Keyboard.dismiss();
                            }
                          }
                        }).panHandlers}
                        style={{
                          padding: 16,
                          paddingTop: 12,
                          borderBottomWidth: 1,
                          borderBottomColor: "rgba(255,255,255,0.08)",
                        }}
                      >
                        <View style={{ alignItems: 'center', marginBottom: 12 }}>
                          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' }} />
                        </View>
                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <Text
                          style={{
                            color: "#fff",
                            fontSize: 17,
                            fontWeight: "800",
                            flex: 1,
                          }}
                        >
                          💬 Comments ({comments.length})
                        </Text>
                        <TouchableOpacity
                          onPress={() => setShowComments(false)}
                          style={{ padding: 4 }}
                        >
                          <Ionicons name="close" size={22} color="#64748b" />
                        </TouchableOpacity>
                        </View>
                      </View>
                      {/* Comments list */}
                      <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={{
                          padding: 16,
                          paddingBottom: 8,
                        }}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                      >
                        {comments.length === 0 ? (
                          <View
                            style={{
                              alignItems: "center",
                              paddingVertical: 40,
                              gap: 8,
                            }}
                          >
                            <Ionicons
                              name="chatbubbles-outline"
                              size={40}
                              color="#334155"
                            />
                            <Text style={{ color: "#475569", fontSize: 14 }}>
                              Be the first to comment!
                            </Text>
                          </View>
                        ) : (
                          comments.map((c, idx) => (
                            <View
                              key={c.id}
                              style={{
                                flexDirection: "row",
                                gap: 8,
                                marginBottom:
                                  idx < comments.length - 1 ? 12 : 0,
                              }}
                            >
                              <View
                                style={{
                                  width: 30,
                                  height: 30,
                                  borderRadius: 15,
                                  backgroundColor: "#1e293b",
                                  justifyContent: "center",
                                  alignItems: "center",
                                  flexShrink: 0,
                                }}
                              >
                                <Text
                                  style={{
                                    color: "#fff",
                                    fontWeight: "800",
                                    fontSize: 12,
                                  }}
                                >
                                  {c.user[0]}
                                </Text>
                              </View>
                              <View style={{ flex: 1 }}>
                                <View
                                  style={{
                                    flexDirection: "row",
                                    gap: 6,
                                    alignItems: "center",
                                    marginBottom: 1,
                                  }}
                                >
                                  <Text
                                    style={{
                                      color: "#fff",
                                      fontWeight: "600",
                                      fontSize: 12,
                                    }}
                                  >
                                    {c.user}
                                  </Text>
                                  <Text style={{ color: "#64748b", fontSize: 10 }}>
                                    {formatRelativeTime(c.createdAt)}
                                  </Text>
                                </View>
                                <Text
                                  style={{
                                    color: "#cbd5e1",
                                    fontSize: 13,
                                    lineHeight: 18,
                                  }}
                                >
                                  {c.text}
                                </Text>
                              </View>
                            </View>
                          ))
                        )}
                      </ScrollView>
                      {/* Input row */}
                      <View
                        style={{
                          flexDirection: "row",
                          gap: 10,
                          paddingHorizontal: 16,
                          paddingTop: 8,
                          paddingBottom: Platform.OS === 'ios' ? 24 : 12,
                          borderTopWidth: 1,
                          borderTopColor: "rgba(255,255,255,0.06)",
                          alignItems: "center",
                        }}
                      >
                        <TextInput
                          style={{
                            flex: 1,
                            backgroundColor: "rgba(255,255,255,0.07)",
                            borderRadius: 22,
                            paddingHorizontal: 14,
                            paddingVertical: 4, // Shorter input area
                            color: "#fff",
                            fontSize: 14,
                            borderWidth: 1,
                            borderColor: "rgba(255,255,255,0.1)",
                            maxHeight: 80,
                          }}
                          placeholder="Write a comment that attracts others… 🎬"
                          placeholderTextColor="#475569"
                          value={commentText}
                          onChangeText={setCommentText}
                          multiline
                          returnKeyType="send"
                          blurOnSubmit={false}
                          enablesReturnKeyAutomatically={true}
                          onSubmitEditing={handlePostComment}
                        />
                        <TouchableOpacity
                          onPress={handlePostComment}
                          style={{
                            backgroundColor: commentText.trim()
                              ? "#e11d48"
                              : "#1e293b",
                            width: 44,
                            height: 44,
                            borderRadius: 22,
                            justifyContent: "center",
                            alignItems: "center",
                          }}
                        >
                          <Ionicons name="send" size={18} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                  </KeyboardAvoidingView>
                </View>
              </Modal>
            )}

            {/* ── Search results OR normal browse content ── */}
            {isSearchExpanded || previewQuery.trim().length > 0 ? (
              <View
                style={[
                  styles.relatedSection,
                  { 
                    marginTop: 0, 
                    borderTopWidth: 0, 
                    paddingTop: Platform.OS === 'ios' ? 95 : (StatusBar.currentHeight ?? 0) + 55 
                  },
                ]}
              >
                  {previewSearchResults.length === 0 ? (
                  <View style={[styles.previewSearchEmpty, { flex: 1 }]}>
                    <Ionicons name="film-outline" size={40} color="#1e293b" />
                    <Text style={styles.searchEmptyText}>
                      No movies match "{previewQuery}"
                    </Text>
                  </View>
                ) : (
                  <FlatList
                    data={previewSearchResults}
                    keyExtractor={(m) => "ps-" + m.id}
                    numColumns={2}
                    scrollEnabled={false}
                    contentContainerStyle={[styles.gridList, { paddingTop: -5 }]}
                    columnWrapperStyle={styles.gridRow}
                    renderItem={({ item }) => (
                      <GridCard
                        movie={item}
                        onPress={() => {
                          DeviceEventEmitter.emit("movieSelected", item);
                        }}
                        columns={2}
                      />
                    )}
                    keyboardShouldPersistTaps="always"
                  />
                )}
              </View>
            ) : (
              <>
                {/* ── Related Movies ── */}
                {related.length > 0 && (
                  <View style={styles.relatedSection}>
                    <View
                      style={[
                        styles.sectionHeaderBadge,
                        {
                          alignSelf: "flex-start",
                          marginLeft: 16,
                          marginBottom: 5,
                        },
                      ]}
                    >
                      <BlurView
                        intensity={65}
                        tint="dark"
                        style={StyleSheet.absoluteFill}
                      />
                      <Text style={styles.rowTitle}>More Like This</Text>
                    </View>
                    <FlatList
                      data={related}
                      keyExtractor={(m) => "rel-" + m.id}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      keyboardShouldPersistTaps="handled"
                      contentContainerStyle={styles.relatedList}
                      renderItem={({ item }) => (
                        <MovieCard
                          movie={item}
                          onPress={() => onSwitch(item)}
                        />
                      )}
                    />
                  </View>
                )}

                {/* ── Browse by Section Header & Filters ── */}
                <View style={styles.relatedSection}>
                  <View
                    style={[
                      styles.sectionHeaderBadge,
                      {
                        alignSelf: "flex-start",
                        marginLeft: 16,
                        marginBottom: 5,
                      },
                    ]}
                  >
                    <BlurView
                      intensity={65}
                      tint="dark"
                      style={StyleSheet.absoluteFill}
                    />
                    <Text style={styles.rowTitle}>You May Also Search By</Text>
                  </View>
                  {/* Scrollable title & filter pills */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.browseFilterScroll}
                  >
                    {[
                      "VJ,s",
                      "Type",
                      "Genre",
                      "Year",
                      "Section",
                      "Sort",
                    ].map((filter) => {
                      const isActive = activeBrowseFilter === filter;
                      let label = filter;
                      let hasValue = false;
                      if (filter === "VJ,s" && hSelectedVJ) { label = hSelectedVJ; hasValue = true; }
                      if (filter === "Type" && hSelectedType) { label = hSelectedType === "Movie" ? "Movies" : hSelectedType === "Series" ? "Series" : "Mini Series"; hasValue = true; }
                      if (filter === "Genre" && hSelectedGenre) { label = hSelectedGenre; hasValue = true; }
                      if (filter === "Year" && hSelectedYear) { label = hSelectedYear; hasValue = true; }
                      if (filter === "Section" && hSelectedSection) { label = hSelectedSection; hasValue = true; }
                      if (filter === "Sort" && hSelectedSort) { label = hSelectedSort; hasValue = true; }

                      return (
                        <TouchableOpacity
                          key={filter}
                          style={[
                            styles.browseFilterPill,
                            (isActive || hasValue) && styles.browseFilterPillActive,
                          ]}
                          activeOpacity={0.7}
                          onPress={() => setActiveBrowseFilter(isActive ? "" : filter)}
                        >
                          {/* Removed pillSheen */}
                          <Text
                            style={[
                              styles.browseFilterPillText,
                              (isActive || hasValue) && styles.browseFilterPillTextActive,
                            ]}
                          >
                            {label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  {/* Filter Results & Clear Action */}
                  {(hSelectedType || hSelectedGenre || hSelectedYear || hSelectedVJ || hSelectedSection || hSelectedSort) && (
                    <View style={{ flexDirection: 'row', paddingHorizontal: 16, marginBottom: 16, gap: 10 }}>
                      <TouchableOpacity
                        style={[
                          styles.browseFilterPill, 
                          { flex: 1, backgroundColor: '#10b981', borderColor: 'rgba(255,255,255,0.3)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }
                        ]}
                        onPress={() => {
                          const results = getHomeFilteredResults();
                          setBrowseSectionModal({
                            title: "Filtered Results",
                            data: results,
                          });
                        }}
                      >
                        <Ionicons name="search" size={16} color="#fff" />
                        <Text style={[styles.browseFilterPillText, { color: '#fff', fontWeight: '900' }]}>
                          SEE {getHomeFilteredResults().length} RESULTS
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.browseFilterPill, 
                          { backgroundColor: '#ef4444', borderColor: 'rgba(255,255,255,0.3)' }
                        ]}
                        onPress={clearHomeFilters}
                      >
                        <Text style={[styles.browseFilterPillText, { color: '#fff', fontWeight: '900' }]}>CLEAR</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Chip Selection Area */}
                  <View
                    style={[
                      styles.browseSectionChips,
                      { flexDirection: "row", flexWrap: "wrap" },
                    ]}
                  >
                    {activeBrowseFilter === "Year"
                      ? (
                        <View style={{ width: '100%', gap: 12 }}>
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity
                              onPress={() => setHYearCategory('new')}
                              style={[
                                styles.browseSectionChip,
                                hYearCategory === 'new' && { backgroundColor: '#5B5FEF', borderColor: 'rgba(255,255,255,0.4)', borderWidth: 1 }
                              ]}
                            >
                              <Text style={[styles.browseSectionChipText, hYearCategory === 'new' && { color: '#fff', fontWeight: 'bold' }]}>NEW</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => setHYearCategory('oldest')}
                              style={[
                                styles.browseSectionChip,
                                hYearCategory === 'oldest' && { backgroundColor: '#ef4444', borderColor: 'rgba(255,255,255,0.4)', borderWidth: 1 }
                              ]}
                            >
                              <Text style={[styles.browseSectionChipText, hYearCategory === 'oldest' && { color: '#fff', fontWeight: 'bold' }]}>OLDEST</Text>
                            </TouchableOpacity>
                          </View>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {(hYearCategory === 'new'
                              ? Array.from({ length: 2026 - 2020 + 1 }, (_, i) => String(2026 - i))
                              : Array.from({ length: 2019 - 1975 + 1 }, (_, i) => String(2019 - i))
                            ).map((yr) => (
                              <TouchableOpacity
                                key={yr}
                                style={[
                                  styles.browseSectionChip,
                                  hSelectedYear === yr && { backgroundColor: 'rgba(255,255,255,0.2)', borderColor: 'rgba(255,255,255,0.5)', borderWidth: 1 }
                                ]}
                                onPress={() => setHSelectedYear(hSelectedYear === yr ? null : yr)}
                                activeOpacity={0.75}
                              >
                                <Text style={[styles.browseSectionChipText, hSelectedYear === yr && { color: '#fff', fontWeight: 'bold' }]}>
                                  {yr}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      )
                      : activeBrowseFilter === "Genre"
                        ? ALL_GENRES.map((g) => (
                            <TouchableOpacity
                              key={g}
                              style={[
                                styles.browseSectionChip,
                                hSelectedGenre === g && { backgroundColor: 'rgba(255,255,255,0.2)', borderColor: 'rgba(255,255,255,0.5)', borderWidth: 1 }
                              ]}
                              onPress={() => setHSelectedGenre(hSelectedGenre === g ? null : g)}
                              activeOpacity={0.75}
                            >
                              <Text style={[styles.browseSectionChipText, hSelectedGenre === g && { color: '#fff', fontWeight: 'bold' }]}>
                                {g}
                              </Text>
                            </TouchableOpacity>
                          ))
                      : activeBrowseFilter === "Type"
                        ? ["Movie", "Series", "Mini Series"].map((t) => (
                            <TouchableOpacity
                              key={t}
                              style={[
                                styles.browseSectionChip,
                                hSelectedType === t && { backgroundColor: 'rgba(255,255,255,0.2)', borderColor: 'rgba(255,255,255,0.5)', borderWidth: 1 }
                              ]}
                              onPress={() => setHSelectedType(hSelectedType === t ? null : t)}
                              activeOpacity={0.75}
                            >
                              <Text style={[styles.browseSectionChipText, hSelectedType === t && { color: '#fff', fontWeight: 'bold' }]}>
                                {t === "Movie" ? "Movies" : t === "Series" ? "Series" : "Mini Series"}
                              </Text>
                            </TouchableOpacity>
                          ))
                      : activeBrowseFilter === "VJ,s"
                        ? ALL_VJS.map((vj) => (
                            <TouchableOpacity
                              key={vj}
                              style={[
                                styles.browseSectionChip,
                                hSelectedVJ === vj && { backgroundColor: 'rgba(255,255,255,0.2)', borderColor: 'rgba(255,255,255,0.5)', borderWidth: 1 }
                              ]}
                              onPress={() => setHSelectedVJ(hSelectedVJ === vj ? null : vj)}
                              activeOpacity={0.75}
                            >
                              <Text style={[styles.browseSectionChipText, hSelectedVJ === vj && { color: '#fff', fontWeight: 'bold' }]}>
                                {vj}
                              </Text>
                            </TouchableOpacity>
                          ))
                      : activeBrowseFilter === "Section"
                        ? ALL_ROWS.map((r) => (
                            <TouchableOpacity
                              key={r.title}
                              style={[
                                styles.browseSectionChip,
                                hSelectedSection === r.title && { backgroundColor: 'rgba(255,255,255,0.2)', borderColor: 'rgba(255,255,255,0.5)', borderWidth: 1 }
                              ]}
                              onPress={() => setHSelectedSection(hSelectedSection === r.title ? null : r.title)}
                              activeOpacity={0.75}
                            >
                              <Text style={[styles.browseSectionChipText, hSelectedSection === r.title && { color: '#fff', fontWeight: 'bold' }]}>
                                {r.title}
                              </Text>
                            </TouchableOpacity>
                          ))
                      : activeBrowseFilter === "Sort"
                        ? ["Newest", "Oldest", "Rating"].map((s) => (
                            <TouchableOpacity
                              key={s}
                              style={[
                                styles.browseSectionChip,
                                hSelectedSort === s && { backgroundColor: 'rgba(255,255,255,0.2)', borderColor: 'rgba(255,255,255,0.5)', borderWidth: 1 }
                              ]}
                              onPress={() => setHSelectedSort(hSelectedSort === s ? null : s)}
                              activeOpacity={0.75}
                            >
                              <Text style={[styles.browseSectionChipText, hSelectedSort === s && { color: '#fff', fontWeight: 'bold' }]}>
                                {s}
                              </Text>
                            </TouchableOpacity>
                          ))
                        : null}
                  </View>
                </View>
              </>
            )}

            {/* ── Additional Suggestions (Suggested by user) ── */}
            <View style={{ paddingBottom: 6 }}>
              {/* YOU MAY ALSO LIKE */}
              <View style={styles.rowContainer}>
                <View
                  style={styles.rowHeader}
                >
                  <View style={styles.sectionHeaderBadge}>
                    <BlurView
                      intensity={65}
                      tint="dark"
                      style={StyleSheet.absoluteFill}
                    />
                    <Text style={styles.rowTitle}>You May Also Like</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.seeAllBadge}
                    onPress={() =>
                      onSeeAll?.("You May Also Like", YOU_MAY_ALSO_LIKE)
                    }
                    activeOpacity={0.8}
                  >
                    <View style={styles.pillSheen} />
                    <Text style={styles.seeAllText}>See All</Text>
                    <Ionicons name="chevron-forward" size={12} color="#fff" />
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={YOU_MAY_ALSO_LIKE}
                  keyExtractor={(m) => "yml-" + m.id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.rowList}
                  renderItem={({ item }) => (
                    <MovieCard movie={item} onPress={() => onSwitch(item)} />
                  )}
                />
              </View>

              {/* TRENDING NOW (Most Viewed) */}
              <View style={styles.rowContainer}>
                <View
                  style={styles.rowHeader}
                >
                  <View style={styles.sectionHeaderBadge}>
                    <BlurView
                      intensity={65}
                      tint="dark"
                      style={StyleSheet.absoluteFill}
                    />
                    <Text style={styles.rowTitle}>Trending Now</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.seeAllBadge}
                    onPress={() => onSeeAll?.("Trending Now", TRENDING)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.pillSheen} />
                    <Text style={styles.seeAllText}>See All</Text>
                    <Ionicons name="chevron-forward" size={12} color="#fff" />
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={TRENDING}
                  keyExtractor={(m) => "trn-" + m.id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.rowList}
                  renderItem={({ item }) => (
                    <MovieCard movie={item} onPress={() => onSwitch(item)} />
                  )}
                />
              </View>

              {/* MOST VIEWED */}
              <View style={styles.rowContainer}>
                <View
                  style={styles.rowHeader}
                >
                  <View style={styles.sectionHeaderBadge}>
                    <BlurView
                      intensity={65}
                      tint="dark"
                      style={StyleSheet.absoluteFill}
                    />
                    <Text style={styles.rowTitle}>Most Viewed</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.seeAllBadge}
                    onPress={() => onSeeAll?.("Most Viewed", MOST_VIEWED)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.pillSheen} />
                    <Text style={styles.seeAllText}>See All</Text>
                    <Ionicons name="chevron-forward" size={12} color="#fff" />
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={MOST_VIEWED}
                  keyExtractor={(m) => "mvw-" + m.id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.rowList}
                  renderItem={({ item }) => (
                    <MovieCard movie={item} onPress={() => onSwitch(item)} />
                  )}
                />
              </View>

              {/* MOST DOWNLOADED */}
              <View style={styles.rowContainer}>
                <View
                  style={styles.rowHeader}
                >
                  <View style={styles.sectionHeaderBadge}>
                    <BlurView
                      intensity={65}
                      tint="dark"
                      style={StyleSheet.absoluteFill}
                    />
                    <Text style={styles.rowTitle}>Most Downloaded</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.seeAllBadge}
                    onPress={() =>
                      onSeeAll?.("Most Downloaded", MOST_DOWNLOADED)
                    }
                    activeOpacity={0.8}
                  >
                    <View style={styles.pillSheen} />
                    <Text style={styles.seeAllText}>See All</Text>
                    <Ionicons name="chevron-forward" size={12} color="#fff" />
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={MOST_DOWNLOADED}
                  keyExtractor={(m) => "mdo-" + m.id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.rowList}
                  renderItem={({ item }) => (
                    <MovieCard movie={item} onPress={() => onSwitch(item)} />
                  )}
                />
              </View>

              {/* NEW RELEASES */}
              <View style={styles.rowContainer}>
                <View
                  style={styles.rowHeader}
                >
                  <View style={styles.sectionHeaderBadge}>
                    <BlurView
                      intensity={65}
                      tint="dark"
                      style={StyleSheet.absoluteFill}
                    />
                    <Text style={styles.rowTitle}>New Releases</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.seeAllBadge}
                    onPress={() => onSeeAll?.("New Releases", NEW_RELEASES)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.pillSheen} />
                    <Text style={styles.seeAllText}>See All</Text>
                    <Ionicons name="chevron-forward" size={12} color="#fff" />
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={NEW_RELEASES}
                  keyExtractor={(m) => "nre-" + m.id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.rowList}
                  renderItem={({ item }) => (
                    <MovieCard movie={item} onPress={() => onSwitch(item)} />
                  )}
                />
              </View>
            </View>

            <View style={{ height: 40 }} />
          </Animated.ScrollView>
        </KeyboardAvoidingView>


        {/* Full-screen grid for browsed section */}
        <GridModal
          visible={!!browseSectionModal}
          title={browseSectionModal?.title ?? ""}
          data={browseSectionModal?.data ?? []}
          onClose={() => setBrowseSectionModal(null)}
          onSelect={(m) => {
            onSwitch(m);
          }}
        />

        {/* FullVideoPlayerModal removed. Using root-level FloatingPlayer for persistence. */}
        
      </Animated.View>
  );
}



// ─── Movie Card (used in the horizontal lists) ─────────────────────────────────
export function MoviePreviewModal(props: any) {
  if (!props.movie) return null;
  return (
    <Modal
      visible={!!props.movie}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={props.onClose}
    >
      <MoviePreviewContent {...props} />
    </Modal>
  );
}

export function MovieCard({
  movie,
  onPress,
}: {
  movie: Movie | Series;
  onPress: () => void;
}) {
  const { isPaid } = useSubscription();
  const isLocked = !isPaid && !movie.isFree;

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={onPress}
    >
      <View>
        <Image source={{ uri: movie.poster }} style={styles.cardPoster} />
        

        <View style={styles.vjBadge}>
          <Text style={styles.vjBadgeText}>{movie.vj}</Text>
        </View>

        {isLocked && (
          <View style={styles.lockBadge}>
             <Ionicons name="lock-closed" size={9} color="#fff" />
          </View>
        )}
        <View style={styles.genreBadge}>
          <Text style={[styles.genreBadgeText, "seasons" in movie && { color: "#fff" }]}>
            {"seasons" in movie ? (movie.isMiniSeries ? "Mini Series" : "Series") : shortenGenre(movie.genre)}
          </Text>
        </View>
        {"seasons" in movie ? (
          <View style={styles.epBadgePremium}>
            <Ionicons name="ellipsis-horizontal" size={10} color="#fff" style={{ marginRight: 2 }} />
            <Text style={styles.epBadgeTextPremium}>{(movie as any).episodes} EP</Text>
          </View>
        ) : (
          ((movie as any).episodes > 1 || (movie.episodeList && movie.episodeList.length > 1)) && (
            <View style={styles.epBadgePremium}>
               <Ionicons name="ellipsis-horizontal" size={10} color="#fff" style={{ marginRight: 2 }} />
               <Text style={styles.epBadgeTextPremium}>{(movie as any).episodes || movie.episodeList?.length} PART</Text>
            </View>
          )
        )}

        {/* Progress Bar for Continue Watching / Last Watched */}
        {(movie as any).position > 0 && (movie as any).durationMillis > 0 && (
          <View style={styles.cardProgressBarContainer}>
            <View style={[styles.cardProgressBarFill, { width: `${Math.min(100, ((movie as any).position / (movie as any).durationMillis) * 100)}%` }]} />
          </View>
        )}
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {movie.title}
        </Text>
        <Text style={styles.cardMetadata} numberOfLines={1}>
          {"seasons" in movie
            ? `${movie.year} · Season ${movie.seasons}`
            : `${movie.year} · ${movie.duration}`}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Movie Grid Card (used in the See-All modal) ──────────────────────────────
// GridCard removed in favor of shared component in components/GridComponents.tsx

// ─── See-All Grid Modal ────────────────────────────────────────────────────────
// GridModal removed in favor of shared component in components/GridComponents.tsx

// ─── Horizontal Row ───────────────────────────────────────────────────────────
const MarqueePlaceholder = ({
  text,
  containerWidth,
  style,
}: {
  text: string;
  containerWidth: number;
  style?: any;
}) => {
  const scrollAnim = useRef(new Animated.Value(0)).current;
  const [textWidth, setTextWidth] = useState(0);

  useEffect(() => {
    if (textWidth > containerWidth - 40 && containerWidth > 0) {
      const scrollDistance = textWidth - (containerWidth - 40) + 20;
      const duration = scrollDistance * 60;

      const startAnimation = () => {
        scrollAnim.setValue(0);
        Animated.sequence([
          Animated.delay(2000),
          Animated.timing(scrollAnim, {
            toValue: -scrollDistance,
            duration: duration,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.delay(2000),
          Animated.timing(scrollAnim, {
            toValue: 0,
            duration: 1200,
            useNativeDriver: true,
          }),
        ]).start(() => startAnimation());
      };

      startAnimation();
    } else {
      scrollAnim.setValue(0);
      scrollAnim.stopAnimation();
    }
  }, [text, textWidth, containerWidth]);

  return (
    <View
      style={[{ overflow: "hidden", flex: 1, justifyContent: "center" }, style]}
    >
      <Animated.Text
        numberOfLines={1}
        onLayout={(e) => setTextWidth(e.nativeEvent.layout.width)}
        style={[
          {
            color: "rgba(255,255,255,0.4)",
            fontSize: 14,
            transform: [{ translateX: scrollAnim }],
            width: textWidth || "auto",
          },
        ]}
      >
        {text}
      </Animated.Text>
    </View>
  );
};

function MovieRow({
  title,
  data,
  onSeeAll,
  onSelect,
}: {
  title: string;
  data: (Movie | Series)[];
  onSeeAll?: () => void;
  onSelect: (m: Movie | Series) => void;
}) {
  return (
    <View style={styles.rowContainer}>
      <View style={styles.rowHeader}>
        <View style={styles.sectionHeaderBadge}>
          <BlurView
            intensity={65}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
          <Text style={styles.rowTitle}>{title}</Text>
        </View>
        <TouchableOpacity
          style={styles.seeAllBadge}
          onPress={onSeeAll}
          activeOpacity={0.8}
        >
          <View style={styles.pillSheen} />
          <Text style={styles.seeAllText}>See All</Text>
          <Ionicons name="chevron-forward" size={12} color="#fff" />
        </TouchableOpacity>
      </View>
      <FlatList
        data={data}
        keyExtractor={(m, index) => (m.id || `fallback-id-${index}`)}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rowList}
        renderItem={({ item }) => (
          <MovieCard movie={item} onPress={() => onSelect(item)} />
        )}
      />
    </View>
  );
}

// ─── Navigation Stack Types ──────────────────────────────────────────────────
type StackItem = 
  | { type: 'movie', movie: Movie | Series }
  | { type: 'series', series: Series }
  | { type: 'grid', title: string, data: (Movie | Series)[] };

// ─── Hero Video Banner ────────────────────────────────────────────────────────
function HeroBanner({ 
  onSelect, 
  isMuted, 
  setIsMuted,
  onShowPremium,
  paused,
  isFocused,
  appState
}: { 
  onSelect: (m: Movie) => void;
  isMuted: boolean;
  setIsMuted: (m: boolean) => void;
  onShowPremium: () => void;
  paused: boolean;
  isFocused: boolean;
  appState: string;
}) {
  const router = useRouter();
  const { allMoviesFree, subscriptionBundle, isGuest, toggleFavorite, favorites } = useSubscription();
  // ✅ Pull live hero movies from Firebase context (not the static import)
  const { heroMovies: LIVE_HERO_MOVIES } = useMovies();
  const videoRef = useRef<Video>(null);
  const [videoIdx, setVideoIdx] = useState(0);
  const [ready, setReady] = useState(false);
  const activeHero = LIVE_HERO_MOVIES[videoIdx];
  const isFavorite = favorites.some((f: any) => f.id === (activeHero as any)?.id);
  const TOTAL = LIVE_HERO_MOVIES.length;

  // Animation values for "Watch Now" (Breath + Shimmer)
  const playPulse = useRef(new Animated.Value(1)).current;
  const shimmerAnim = useRef(new Animated.Value(-1)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;

  // Breath & Shimmer animation loops
  useEffect(() => {
    // 1. Breathing Scale Animation
    const breath = Animated.loop(
      Animated.sequence([
        Animated.timing(playPulse, {
          toValue: 1.05,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(playPulse, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ]),
    );

    // 2. Shimmer Wipe Animation
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 2,
          duration: 2500,
          useNativeDriver: true,
        }),
        Animated.delay(1000), // Delay between wipes
        Animated.timing(shimmerAnim, {
          toValue: -1,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    const wave = Animated.loop(
      Animated.timing(waveAnim, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: true,
      }),
    );

    breath.start();
    shimmer.start();
    wave.start();
    return () => {
      breath.stop();
      shimmer.stop();
      wave.stop();
    };
  }, []);


  // Current movie metadata — updates live with videoIdx
  const movie = LIVE_HERO_MOVIES[videoIdx] ?? LIVE_HERO_MOVIES[0];
  const goTo = useCallback(
    (idx: number) => {
      setVideoIdx((idx + TOTAL) % TOTAL);
      setReady(false);
    },
    [TOTAL],
  );

  const goPrev = useCallback(() => {
    setVideoIdx((prev) => (prev - 1 + TOTAL) % TOTAL);
    setReady(false);
  }, [TOTAL]);

  const goNext = useCallback(() => {
    setVideoIdx((prev) => (prev + 1) % TOTAL);
    setReady(false);
  }, [TOTAL]);

  const onStatus = useCallback(
    (status: AVPlaybackStatus) => {
      if (!status.isLoaded) return;
      if (status.didJustFinish) goNext();
      if (!ready && status.isPlaying) setReady(true);
    },
    [goNext, ready],
  );

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponderCapture: (_, g) =>
        Math.abs(g.dx) > 50 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderRelease: (_, g) => {
        if (g.dx < -50) goNext();
        else if (g.dx > 50) goPrev();
      },
    }),
  ).current;

  const handleHeroPress = useCallback(() => {
    onSelect({
      ...movie,
      id: `hero-${videoIdx}`, // Keep the hero prefix for tracking/stacking
    });
  }, [movie, videoIdx, onSelect]);

  // Auto-advance every 30 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      goNext();
    }, 30000);
    return () => clearTimeout(timer);
  }, [videoIdx, goNext]);

  if (!movie) return null;

  const heroSource = (movie.heroVideoUrl ? resolveCDNUrl(movie.heroVideoUrl) : undefined) || 
                     (movie.previewUrl ? resolveCDNUrl(movie.previewUrl) : undefined) || 
                     getStreamUrl(movie) || '';
  const isHLS = Boolean(heroSource && (heroSource.includes('.m3u8') || heroSource.includes('playlist')));

  return (
    <View {...panResponder.panHandlers}>
      {/* ── Video or Photo Hero ── */}
      <TouchableWithoutFeedback onPress={handleHeroPress}>
        <View style={[styles.heroVideo, { height: HERO_H }]}>
          {movie.heroType === 'photo' ? (
            // Photo-only mode: custom hero image or poster fallback
            <Image
              source={{ uri: resolveCDNUrl(movie.heroPhotoUrl) || resolveCDNUrl(movie.poster) }}
              style={[StyleSheet.absoluteFill, { resizeMode: 'cover' }]}
            />
          ) : (
            // Video mode (default): auto-play the preview
            // Priority: heroVideoUrl (admin-set) → videoUrl → built-in demo pool
            <Video
              ref={videoRef}
              key={videoIdx}
              source={{ 
                uri: heroSource,
                overridingExtension: isHLS ? 'm3u8' : undefined,
              }}
              style={StyleSheet.absoluteFill}
              resizeMode={ResizeMode.COVER}
              shouldPlay={!paused && isFocused && appState === 'active'}
              isLooping={false}
              isMuted={isMuted}
              onPlaybackStatusUpdate={onStatus}
              usePoster={true}
              posterSource={{ uri: movie.poster }}
              posterStyle={{ resizeMode: 'cover' }}
              onError={(err) => {
                console.warn("Hero Video Error:", err);
                goNext();
              }}
            />
          )}
          {/* Subtle Top Overlay for Header Branding Legibility */}
          <LinearGradient
            colors={["rgba(0,0,0,0.65)", "transparent"]}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 120,
              zIndex: 10,
            }}
            pointerEvents="none"
          />
        </View>
      </TouchableWithoutFeedback>

      {/* ── Movie info centered ── */}
      <View style={styles.heroInfoOverlay} pointerEvents="box-none">
        {/* Navigation removed as per request for swipe-only */}
        <TouchableOpacity
          activeOpacity={1}
          onPress={handleHeroPress}
          style={styles.heroInfoCenteredContent}
        >
          <Text style={styles.heroTitle}>{movie.title}</Text>

          <Animated.View style={{ transform: [{ scale: playPulse }] }}>
            {/* Wave/Ripple Effect Rings (Behind the button) */}
            {[0, 1].map((i) => (
              <Animated.View
                key={i}
                style={[
                  {
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 12, // Match button marginBottom
                    borderWidth: 1.5,
                    borderColor: "rgba(255,255,255,0.3)",
                    borderRadius: 50,
                    transform: [
                      {
                        scale: waveAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 1 + (i + 0.5) * 0.4],
                        }),
                      },
                    ],
                    opacity: waveAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.5, 0],
                    }),
                  },
                ]}
              />
            ))}

            <TouchableOpacity
              style={styles.watchNowBtn}
              onPress={handleHeroPress}
              activeOpacity={0.8}
            >
              <BlurView
                intensity={65}
                tint="dark"
                style={StyleSheet.absoluteFill}
              />
              
              {/* Shimmer Layer */}
              <Animated.View
                style={[
                  StyleSheet.absoluteFill,
                  {
                    transform: [
                      {
                        translateX: shimmerAnim.interpolate({
                          inputRange: [-1, 2],
                          outputRange: [-200, 200],
                        }),
                      },
                      { rotate: "25deg" },
                    ],
                  },
                ]}
              >
                <LinearGradient
                  colors={[
                    "transparent",
                    "rgba(255,255,255,0.05)",
                    "rgba(255,255,255,0.2)",
                    "rgba(255,255,255,0.05)",
                    "transparent",
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ flex: 1, width: 60 }}
                />
              </Animated.View>

              <Text style={styles.watchNowText}>Watch Now</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Indicators moved to bottom of content */}
          <View style={styles.videoDotsInline}>
            {LIVE_HERO_MOVIES.slice(0, 8).map((_, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => goTo(i)}
                hitSlop={{ top: 15, bottom: 15, left: 10, right: 10 }}
              >
                <View
                  style={[styles.dot, i === (videoIdx % 8) && styles.dotActive]}
                />
              </TouchableOpacity>
            ))}
          </View>

          {/* New Metadata Row */}
          <View style={styles.heroMetadataRow}>
            {/* Type Badge (Series/Mini Series) */}
            {(movie as any).type && (movie as any).type !== 'Movie' && (
              <>
                <View style={{ backgroundColor: 'rgba(91, 95, 239, 0.2)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(91, 95, 239, 0.4)' }}>
                  <Text style={{ color: '#818cf8', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 }}>{(movie as any).type.toUpperCase()}</Text>
                </View>
                <View style={styles.heroMetaDot} />
              </>
            )}
            <Text style={styles.heroMetaText}>
              {movie.genre}
            </Text>
            <View style={styles.heroMetaDot} />
            <Text style={styles.heroMetaText}>{movie.year}</Text>
            <View style={styles.heroMetaDot} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="mic-outline" size={11} color="#f59e0b" />
              <Text style={[styles.heroMetaText, { color: '#f59e0b' }]}>{movie.vj}</Text>
            </View>
            <View style={styles.heroMetaDot} />
            <Text style={styles.heroMetaText}>{movie.duration}</Text>
          </View>

          {/* New Action Row - Redesigned to match Home Preview */}
          <View style={styles.heroActionRow}>
            {/* MUTE TOGGLE – hidden when hero is photo-only */}
            {movie.heroType !== 'photo' && (
              <TouchableOpacity
                style={styles.heroActionCol}
                onPress={() => setIsMuted(!isMuted)}
              >
                <View style={styles.heroActionIconBg}>
                  <BlurView
                    intensity={30}
                    tint="dark"
                    style={StyleSheet.absoluteFill}
                  />
                  <Ionicons
                    name={isMuted ? "volume-mute" : "volume-high"}
                    size={22}
                    color="#fff"
                  />
                </View>
                <Text style={styles.heroActionLabel}>
                  {isMuted ? "Unmute" : "Mute"}
                </Text>
              </TouchableOpacity>
            )}

            {/* MY LIST */}
            <TouchableOpacity
              style={styles.heroActionCol}
              onPress={() => {
                if (isGuest) {
                  onShowPremium();
                  return;
                }
                if(activeHero) toggleFavorite(activeHero as any);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}

            >
              <View
                style={[
                  styles.heroActionIconBg,
                  isFavorite && {
                    backgroundColor: "rgba(255,193,7,0.2)",
                    borderColor: "#FFC107",
                  },
                ]}
              >
                <BlurView
                  intensity={isFavorite ? 0 : 30}
                  tint="dark"
                  style={StyleSheet.absoluteFill}
                />
                <Ionicons
                  name={isFavorite ? "checkmark-circle" : "add"}
                  size={22}
                  color={isFavorite ? "#FFC107" : "#fff"}
                />
              </View>
              <Text
                style={[
                  styles.heroActionLabel,
                  isFavorite && { color: "#FFC107" },
                ]}
              >
                {isFavorite ? "In My List" : "My List"}
              </Text>
            </TouchableOpacity>

            {/* MORE INFO */}
            <TouchableOpacity
              style={styles.heroActionCol}
              onPress={handleHeroPress}
            >
              <View style={styles.heroActionIconBg}>
                <BlurView
                  intensity={30}
                  tint="dark"
                  style={StyleSheet.absoluteFill}
                />
                <Ionicons
                  name="information-circle-outline"
                  size={22}
                  color="#fff"
                />
              </View>
              <Text style={styles.heroActionLabel}>Info</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}
// ─── Home Screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const { allRows: liveRows, allSeries: liveSeries, heroMovies: liveHeroMovies, liveMovies, appUpdateConfig, myList } = useMovies();
  const allPool = useMemo(() => {
    const pool: (Movie | Series)[] = [];
    const seen = new Set<string>();
    liveRows.forEach((row) => {
      row.data.forEach((item) => {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          pool.push(item);
        }
      });
    });
    liveSeries.forEach((s) => {
      if (!seen.has(s.id)) {
        seen.add(s.id);
        pool.push(s);
      }
    });
    return pool;
  }, [liveRows, liveSeries]);
  const { 
    allMoviesFree, 
    eventMessage, 
    isGuest, 
    subscriptionBundle,
    isDeviceBlocked,
    activeDeviceIds,
    removeDevice,
    deviceLimit,
    remainingDays,
    isSubscribed,
    downloadedMovies,
    favorites,
    playingNow,
    setPlayingNow,
    playerMode,
    setPlayerMode,
    playerTitle,
    setPlayerTitle,
    selectedVideoUrl,
    setSelectedVideoUrl,
    setIsPreview
  } = useSubscription();
  const [showExpiryReminder, setShowExpiryReminder] = useState(false);
  const [hasShownReminderThisSession, setHasShownReminderThisSession] = useState(false);
  const [navigationStack, setNavigationStack] = useState<StackItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isUserMuted, setIsUserMuted] = useState(false);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [isNotificationVisible, setIsNotificationVisible] = useState(false);
  const [isStackLoading, setIsStackLoading] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);

  const isFocused = useIsFocused();
  const [appState, setAppState] = useState(AppState.currentState);
  const [loadingDeepLink, setLoadingDeepLink] = useState(false);
  const lastProcessedId = useRef<string | null>(null);
  const { movieId, autoplay, playMovieId } = useLocalSearchParams();

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      setAppState(nextAppState);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    // Show expiry reminder if in Yellow or Red zones (<= 5 days)
    if (isSubscribed && remainingDays <= 5 && !isGuest && !hasShownReminderThisSession && isFocused) {
      const timer = setTimeout(() => {
        setShowExpiryReminder(true);
        setHasShownReminderThisSession(true);
      }, 3000); // Wait 3 seconds after loading
      return () => clearTimeout(timer);
    }
  }, [isSubscribed, remainingDays, isGuest, hasShownReminderThisSession, isFocused]);

  // ── Show Update Banner once per version ─────────────────────────────────────
  useEffect(() => {
    const checkAndShowUpdateBanner = async () => {
      if (!appUpdateConfig.isUpdateAvailable || !isFocused) return;
      const key = `update_banner_shown_${appUpdateConfig.latestVersion}`;
      const alreadyShown = await AsyncStorage.getItem(key);
      if (alreadyShown) return;
      // Delay so the screen loads first
      setTimeout(() => {
        DeviceEventEmitter.emit('showLocalNotification', {
          title: `🎉 Update v${appUpdateConfig.latestVersion} Available!`,
          body: appUpdateConfig.updateMessage || 'New features and improvements are ready. Update now!',
          data: { type: 'update' }
        });
      }, 2500);
      await AsyncStorage.setItem(key, 'true');
    };
    checkAndShowUpdateBanner();
  }, [appUpdateConfig.isUpdateAvailable, appUpdateConfig.latestVersion, isFocused]);

  // Handle deep link (movieId) from search params or notifications
  useEffect(() => {
    const handleDeepLink = async () => {
      const targetId = playMovieId || movieId;
      
      // Prevent redundant processing if this ID was just handled
      if (!targetId || !isFocused || lastProcessedId.current === String(targetId)) return;
      
      // Clear params IMMEDIATELY to prevent useLocalSearchParams from re-triggering this effect
      // while we are still processing the fetch.
      router.setParams({ movieId: undefined, playMovieId: undefined, autoplay: undefined } as any);
      lastProcessedId.current = String(targetId);

      let found: (Movie | Series) | undefined;
      
      // 1. If playing a downloaded item, check the downloads list first
      if (playMovieId) {
        found = downloadedMovies.find(d => String(d.id) === String(playMovieId));
      }

      // 2. Search in all movie rows if not found
      if (!found) {
        for (const row of liveRows) {
          found = row.data.find(m => String(m.id) === String(targetId));
          if (found) break;
        }
      }
      
      // 3. Search in series
      if (!found) {
        found = liveSeries.find(s => String(s.id) === String(targetId));
      }

      // 4. 🔥 CRITICAL FALLBACK: Fetch from Firestore if not found in local cache
      if (!found) {
        setLoadingDeepLink(true);
        try {
          console.log(`Deep link target ID ${targetId} not in cache. Fetching from Firestore...`);
          const movieDoc = await getDoc(doc(db, 'movies', String(targetId)));
          if (movieDoc.exists()) {
            found = { id: movieDoc.id, ...movieDoc.data() } as any;
          } else {
            const seriesDoc = await getDoc(doc(db, 'series', String(targetId)));
            if (seriesDoc.exists()) {
              found = { id: seriesDoc.id, ...seriesDoc.data() } as any;
            } else {
              Alert.alert("Content Not Found", "This item may have been removed or is not available yet.");
            }
          }
        } catch (error) {
          console.error("Error fetching deep link data:", error);
        } finally {
          setLoadingDeepLink(false);
          // Small delay before allowing another ID to ensure state settles
          setTimeout(() => { if (lastProcessedId.current === String(targetId)) lastProcessedId.current = null; }, 2000);
        }
      }

      if (found) {
        if (playMovieId) {
          const dl = downloadedMovies.find(d => String(d.id) === String(playMovieId));
          const playItem = { ...found, videoUrl: dl?.localUri || (found as Movie).videoUrl };
          setPlayerTitle(found.title);
          setSelectedVideoUrl(playItem.videoUrl);
          setPlayingNow(playItem as Movie);
          if (setPlayingEpisodeId) setPlayingEpisodeId(null);
          setPlayerMode('full');
        } else {
          // Open the movie detail alone in the stack to prevent layering
          // Deduplication Guard: Check if the top item is already this movie
          setNavigationStack(prev => {
            if (prev.length > 0) {
              const top = prev[prev.length - 1];
              if (top.type === 'movie' && String(top.movie.id) === String(found.id)) return prev;
            }
            return [{ type: 'movie', movie: found! }];
          });
          
          if (autoplay === 'true' && !("seasons" in found)) {
             setPlayingNow(found as Movie);
          }
        }
      }
    };

    handleDeepLink();
  }, [movieId, playMovieId, autoplay, isFocused, liveRows, liveSeries, downloadedMovies]);

  // Keep screen on during video playback
  useEffect(() => {
    if (playerMode === 'full') {
      activateKeepAwakeAsync();
    } else {
      deactivateKeepAwake();
    }
    return () => { deactivateKeepAwake(); };
  }, [playerMode]);

  // Derived state to determine if the hero video should actually be muted
  const isHeroMuted = useMemo(() => {
    return isUserMuted || navigationStack.length > 0 || !isFocused || isSearchVisible || isNotificationVisible;
  }, [isUserMuted, navigationStack.length, isFocused, isSearchVisible, isNotificationVisible]);

  const bannerAnim = useRef(new Animated.Value(0)).current;
  const stackAnim = useRef(new Animated.Value(SCREEN_H)).current; // Start hidden (off-screen bottom)

  useEffect(() => {
    const isVisible = navigationStack.length > 0 || loadingDeepLink;
    Animated.timing(stackAnim, {
      toValue: isVisible ? 0 : SCREEN_H,
      duration: 350,
      easing: Easing.out(Easing.back(0.5)),
      useNativeDriver: true,
    }).start();

    // Global UI Sync: Hide Tab Bar and Home Header when detail stack is open (only if focused)
    if (isFocused) {
      DeviceEventEmitter.emit("setDetailStackVisible", isVisible);
    }

    // Restoration Burst when it enters
    if (isVisible && Platform.OS === 'android') {
      const restore = async () => {
        if (playerMode !== 'full') {
          await NavigationBar.setVisibilityAsync('visible').catch(() => {});
          await NavigationBar.setBackgroundColorAsync('transparent').catch(() => {});
          await NavigationBar.setBehaviorAsync('inset-touch').catch(() => {});
          StatusBar.setHidden(false);
        }
      };
      restore();
      setTimeout(restore, 100);
      setTimeout(restore, 500);
    }
  }, [navigationStack.length, loadingDeepLink, playerMode]);

  useEffect(() => {
    if (allMoviesFree || eventMessage) {
      const startAnimation = () => {
        bannerAnim.setValue(SCREEN_W - 80); // Start from right side of the banner
        Animated.timing(bannerAnim, {
          toValue: -SCREEN_W / 1.5, // Move left but don't "come out to the end" far
          duration: 12000, 
          easing: Easing.linear,
          useNativeDriver: true,
        }).start(() => startAnimation());
      };
      startAnimation();
    } else {
      bannerAnim.setValue(0);
      bannerAnim.stopAnimation();
    }
  }, [allMoviesFree, eventMessage]);

  // Listen for search and notification overlay visibility changes
  useEffect(() => {
    const searchSub = DeviceEventEmitter.addListener("searchOverlayVisible", (visible: boolean) => {
      setIsSearchVisible(visible);
    });
    const notificationSub = DeviceEventEmitter.addListener("notificationOverlayVisible", (visible: boolean) => {
      setIsNotificationVisible(visible);
    });
    return () => {
      searchSub.remove();
      notificationSub.remove();
    };
  }, []);

  // ORientation Guard: Force Portrait whenever the full-screen player is NOT active
  // This prevents the 'Landscape Preview' bug
  useEffect(() => {
    const lockPortrait = async () => {
      if (playerMode !== 'full' && Platform.OS !== 'web') {
        try {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        } catch (e) {}
      }
    };
    lockPortrait();
  }, [playerMode]);
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const bgScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(bgScale, {
      toValue: navigationStack.length > 0 ? 0.95 : 1,
      friction: 9,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, [navigationStack.length]);


  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("homeTabPress", () => {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    });
    const movieSub = DeviceEventEmitter.addListener(
      "movieSelected",
      (m: (Movie | Series) & { autoPlay?: boolean }) => {
        setIsStackLoading(true);
        const isSeries = "seasons" in m || m.type === 'Series' || (m as any).isMiniSeries;
        if (isSeries) {
          router.push(`/(tabs)/saved?seriesId=${m.id}`);
        } else {
          setNavigationStack((prev) => {
            if (prev.length > 0) {
              const top = prev[prev.length - 1];
              if (top.type === 'movie' && String(top.movie.id) === String(m.id)) return prev;
            }
            return [...prev, { type: 'movie', movie: m }];
          });
        }
        setTimeout(() => setIsStackLoading(false), 1200);
      },
    );

    // Enhanced Back Handler: Prioritize closing the player
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (playerMode === 'full') {
        setPlayerMode('closed');
        return true;
      }
      if (navigationStack.length > 0) {
        setNavigationStack(prev => prev.slice(0, -1));
        return true;
      }
      return false;
    });

    const sectionSub = DeviceEventEmitter.addListener(
      "sectionSelected",
      (title: string) => {
        const found = liveRows.find((r) => r.title === title);
        if (found) {
          setNavigationStack(prev => {
            if (prev.length > 0) {
              const top = prev[prev.length - 1];
              if (top.type === 'grid' && top.title === found.title) return prev;
            }
            return [...prev, { type: 'grid', title: found.title, data: found.data }];
          });
        }
      },
    );
    return () => {
      sub.remove();
      movieSub.remove();
      sectionSub.remove();
      backHandler.remove();
    };
  }, [playerMode, navigationStack.length]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (!__DEV__) {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          Alert.alert(
            "Update Available", 
            "A new hotfix or update is available! Downloading now...",
            [{ text: "OK" }]
          );
          await Updates.fetchUpdateAsync();
          Updates.reloadAsync();
        }
      }
    } catch (e) {
      console.log("Update check failed or DEV mode", e);
    }
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  const ROWS = liveRows;

  // Increment views and track user activity
  useEffect(() => {
    if (playingNow && playingNow.id && !playingNow.id.toString().startsWith('hero-')) {
      const trackActivity = async () => {
        try {
          // 1. Global movie views
          const movieRef = doc(db, 'movies', playingNow.id.toString());
          await updateDoc(movieRef, {
            views: increment(1)
          });

          // 2. Personal user views
          if (auth.currentUser) {
            const userRef = doc(db, 'users', auth.currentUser.uid);
            await updateDoc(userRef, {
              totalViews: increment(1),
              lastActive: serverTimestamp()
            });
          }
        } catch (error) {
          console.warn("Error tracking activity:", error);
        }
      };
      trackActivity();
    }
  }, [playingNow]);

  // Heartbeat Presence Pulse
  useEffect(() => {
    const updatePresence = async () => {
      const user = auth.currentUser;
      if (user) {
        try {
          // Use setDoc with merge: true to handle both initial creation (guests/legacy) and updates
          await setDoc(doc(db, 'users', user.uid), {
            lastActive: serverTimestamp()
          }, { merge: true });
        } catch (error) {
          // Fail silently for presence
        }
      }
    };

    // Initial update
    updatePresence();

    // Pulse every 30 seconds
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') {
        updatePresence();
      }
    }, 30000);

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        updatePresence();
      }
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [auth.currentUser]); // Re-run pulse setup when current user changes (e.g. on login/logout)

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      <Animated.ScrollView
        ref={scrollRef}
        style={{ 
          transform: [{ scale: bgScale }],
          opacity: bgScale.interpolate({
            inputRange: [0.95, 1],
            outputRange: [0.6, 1]
          })
        }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110, paddingTop: 0 }} // Removed top padding for full-screen hero
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          {
            useNativeDriver: false, // Need for opacity animations later or direct state updates
            listener: (event: any) => {
              const y = event.nativeEvent.contentOffset.y;
              DeviceEventEmitter.emit("homeHeaderScroll", y);
            },
          }
        )}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#fff"
            colors={["#fff"]}
            progressBackgroundColor="#1a1a24"
          />
        }
      >
        {(allMoviesFree || eventMessage) && (
          <TouchableOpacity 
            style={[
              styles.eventBannerContainer,
              { 
                backgroundColor: "rgba(10, 10, 15, 0.9)",
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: "rgba(255, 255, 255, 0.2)"
              }
            ]}
            activeOpacity={0.9}
            onPress={() => DeviceEventEmitter.emit("openNotifications", { highlightId: "event_n1" })}
          >
            <LinearGradient
              colors={allMoviesFree ? ["rgba(225, 29, 72, 0.4)", "rgba(10, 10, 15, 0.8)"] : ["rgba(91, 95, 239, 0.4)", "rgba(10, 10, 15, 0.8)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.eventBannerContent}>
              <View style={{ flex: 1, marginLeft: 105, overflow: 'hidden' }}>
                <Animated.View style={[styles.animatedMessage, { transform: [{ translateX: bannerAnim }] }]}>
                  <Text style={styles.eventMessageText} numberOfLines={1}>
                    {eventMessage || (allMoviesFree ? "Enjoy all movies for FREE today!" : "")}
                  </Text>
                  <View style={styles.eventBadgePulse} />
                </Animated.View>
              </View>

              <View style={[styles.eventBadge, !allMoviesFree && { backgroundColor: '#5B5FEF' }]}>
                <Ionicons name={allMoviesFree ? "gift-outline" : "megaphone-outline"} size={12} color="#fff" />
                <Text style={styles.eventBadgeText}>{allMoviesFree ? "HOLIDAY MODE" : "ANNOUNCEMENT"}</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
        <HeroBanner
          onSelect={(m) => {
            const isSeries = "seasons" in m || m.type === 'Series' || (m as any).isMiniSeries;
            if (isSeries) {
              router.push(`/(tabs)/saved?seriesId=${m.id}`);
            } else {
               setNavigationStack((prev) => {
                 if (prev.length > 0) {
                   const top = prev[prev.length - 1];
                   if (top.type === 'movie' && String(top.movie.id) === String(m.id)) return prev;
                 }
                 return [...prev, { type: 'movie', movie: m }];
               });
            }
          }}
          isMuted={isHeroMuted}
          setIsMuted={setIsUserMuted}
          onShowPremium={() => setShowPremiumModal(true)}
          paused={!!playingNow || !isFocused}
          isFocused={isFocused}
          appState={appState}
        />

        {ROWS.map((row) => (
          <MovieRow
            key={row.title}
            title={row.title}
            data={row.data}
            onSeeAll={() => {
              setNavigationStack(prev => {
                if (prev.length > 0) {
                  const top = prev[prev.length - 1];
                  if (top.type === 'grid' && top.title === row.title) return prev;
                }
                return [...prev, { type: 'grid', title: row.title, data: row.data }];
              });
            }}
            onSelect={(m) => {
              const isSeries = "seasons" in m || m.type === 'Series' || (m as any).isMiniSeries;
              if (isSeries) {
                router.push(`/(tabs)/saved?seriesId=${m.id}`);
              } else {
                 setNavigationStack((prev) => {
                   if (prev.length > 0) {
                     const top = prev[prev.length - 1];
                     if (top.type === 'movie' && String(top.movie.id) === String(m.id)) return prev;
                   }
                   return [...prev, { type: 'movie', movie: m }];
                 });
              }
            }}
          />
        ))}

        <View style={{ height: 110 }} />
      </Animated.ScrollView>

      {/* Unified Navigation Stack (Single Window Pattern) */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { 
            backgroundColor: '#0a0a0f', 
            zIndex: 1000, 
            elevation: 10,
            transform: [{ translateY: stackAnim }] 
          }
        ]}
      >
        {loadingDeepLink ? (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0a0a0f', justifyContent: 'center', alignItems: 'center' }]}>
             <View style={{ backgroundColor: '#1a1a2e', padding: 40, borderRadius: 30, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 15, elevation: 12 }}>
               <ActivityIndicator size="large" color="#5B5FEF" />
               <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 24 }}>Verifying Content...</Text>
               <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 8, textAlign: 'center' }}>This will only take a moment</Text>
             </View>
          </View>
        ) : (
          <View 
            horizontal={false}
            style={StyleSheet.absoluteFill} 
            pointerEvents={playerMode === 'full' ? 'none' : 'auto'}
          >
          {navigationStack.map((item, index) => {
            const onClose = () => {
              setNavigationStack((prev) => {
                const newStack = [...prev];
                newStack.splice(index, 1);
                if (newStack.length === 0) {
                  DeviceEventEmitter.emit("previewClosed");
                }
                return newStack;
              });
            };

            if (item.type === 'grid') {
              return (
                <GridContent
                  key={`grid-${index}`}
                  title={item.title}
                  data={item.data}
                  onClose={onClose}
                  onSelect={(m) => {
                    const isSeries = "seasons" in m || m.type === 'Series' || (m as any).isMiniSeries;
                    if (isSeries) {
                      router.push(`/(tabs)/saved?seriesId=${m.id}`);
                    } else {
                      setNavigationStack((prev) => {
                        if (prev.length > 0) {
                          const top = prev[prev.length - 1];
                          if (top.type === 'movie' && String(top.movie.id) === String(m.id)) return prev;
                        }
                        return [...prev, { type: 'movie', movie: m }];
                      });
                    }
                  }}
                />
              );
            }



            return (
              <MoviePreviewContent
                key={`movie-${index}`}
                movie={item.movie}
                onClose={onClose}
                onSwitch={(m) => {
                  const isSeries = "seasons" in m || m.type === 'Series' || (m as any).isMiniSeries;
                  if (isSeries) {
                    router.push(`/(tabs)/saved?seriesId=${m.id}`);
                  } else {
                    setNavigationStack((prev) => {
                      if (prev.length > 0) {
                        const top = prev[prev.length - 1];
                        if (top.type === 'movie' && String(top.movie.id) === String(m.id)) return prev;
                      }
                      return [...prev, { type: 'movie', movie: m }];
                    });
                  }
                }}
                onSeeAll={(title: string, data: (Movie | Series)[]) => {
                  setNavigationStack((prev) => {
                    if (prev.length > 0) {
                      const top = prev[prev.length - 1];
                      if (top.type === 'grid' && top.title === title) return prev;
                    }
                    return [...prev, { type: 'grid', title, data }];
                  });
                }}
                playingNow={playingNow}
                setPlayingNow={setPlayingNow}
                setPlayerMode={setPlayerMode}
                setPlayerTitle={setPlayerTitle}
                setSelectedVideoUrl={setSelectedVideoUrl}
                playerMode={playerMode}
                playerTitle={playerTitle}
                selectedVideoUrl={selectedVideoUrl}
                isMuted={index !== navigationStack.length - 1 || !isFocused}
                onShowPremium={() => setShowPremiumModal(true)}
                onUpgrade={() => setShowPlanModal(true)}
                isFocused={isFocused}
                appState={appState}
              />
            );
          })}
          
          {isStackLoading && (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0a0a0f', justifyContent: 'center', alignItems: 'center', zIndex: 10001 }]}>
               <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
               <View style={{ backgroundColor: 'rgba(26,26,46,0.85)', padding: 40, borderRadius: 30, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.6, shadowRadius: 20, elevation: 15 }}>
                 <ActivityIndicator size="large" color="#5B5FEF" />
                 <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 24, letterSpacing: 1 }}>Opening Content...</Text>
                 <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 8, textAlign: 'center', fontWeight: '600' }}>Preparing your viewing experience</Text>
               </View>
            </View>
          )}
        </View>
      )}
      </Animated.View>


      {/* Premium Access Modal */}
      <PremiumAccessModal
        visible={showPremiumModal}
        isGuest={isGuest}
        onClose={() => setShowPremiumModal(false)}
        onLogin={() => {
          setShowPremiumModal(false);
          // If we are in a modal, we might need to close it or just navigate
          router.push("/login" as any);
        }}
        onUpgrade={() => {
          setShowPremiumModal(false);
          setShowPlanModal(true);
        }}
        onSignUp={() => {
          setShowPremiumModal(false);
          router.push("/login?mode=signup" as any);
        }}
        onSocialLogin={(provider) => {
          setShowPremiumModal(false);
          // Navigate to login with provider hint or just to login screen
          router.push("/login" as any);
        }}
      />

      <PlanSelectionModal 
        visible={showPlanModal}
        onClose={() => setShowPlanModal(false)}
      />

      <ExpiryReminderModal 
        visible={showExpiryReminder}
        onClose={() => setShowExpiryReminder(false)}
        onRenew={() => {
          setShowExpiryReminder(false);
          setShowPlanModal(true);
        }}
        remainingDays={remainingDays}
        planName={subscriptionBundle}
      />

      <DeviceManagerModal
        visible={isDeviceBlocked && !isGuest}
        activeDeviceIds={activeDeviceIds}
        currentDeviceId={(Application as any).androidId || null}
        onRemoveDevice={removeDevice}
        onClose={() => {}} // User must manage devices to move forward
        planName={subscriptionBundle}
        limit={deviceLimit}
      />
    </KeyboardAvoidingView>

  );
}
