import { Tabs } from "expo-router";
import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  DeviceEventEmitter,
  Modal,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Image,
  Dimensions,
  StatusBar,
  ScrollView,
  Animated,
  Keyboard,
  Linking,
  BackHandler,
  ActivityIndicator,
} from "react-native";
import { BlurView } from "expo-blur";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { useState, useRef, useEffect, useMemo } from "react";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ALL_ROWS,
  Movie,
  Series,
  ALL_SERIES,
  MOST_DOWNLOADED,
  TRENDING,
  shortenGenre,
  ALL_VJS,
  ALL_GENRES,
  getStreamUrl,
} from "@/constants/movieData";
import { GridModal, GridCard } from "../../components/GridComponents";
import { useMovies } from "@/app/context/MovieContext";
import { SkeletonLoader } from "../../components/SkeletonLoader";
import { useSubscription } from "@/app/context/SubscriptionContext";
import { useDownloads } from "@/app/context/DownloadContext";
import { auth, db } from "../../constants/firebaseConfig";
import ClockAnimation from "../../components/ClockAnimation";
import EmptyState from "../../components/EmptyState";
import { collection, query, where, getDocs, deleteDoc, doc } from "firebase/firestore";
import { resolveCDNUrl } from "@/constants/bunnyConfig";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const HERO_H = SCREEN_H * 0.55;
const ALL_MOVIES = Array.from(
  new Map(ALL_ROWS.flatMap((r) => r.data).map((m) => [m.id, m])).values(),
);
const ALL_ITEMS = [...ALL_MOVIES, ...ALL_SERIES];

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const TABS: {
  name: string;
  route: string;
  icon: IoniconsName;
  iconActive: IoniconsName;
  label: string;
}[] = [
    {
      name: "index",
      route: "/(tabs)",
      icon: "home-outline",
      iconActive: "home",
      label: "Home",
    },
    {
      name: "saved",
      route: "/(tabs)/saved",
      icon: "tv-outline",
      iconActive: "tv",
      label: "Series",
    },
    {
      name: "category",
      route: "/(tabs)/category",
      icon: "compass-outline",
      iconActive: "compass",
      label: "Discover",
    },
    {
      name: "menu",
      route: "/(tabs)/menu",
      icon: "person-outline",
      iconActive: "person",
      label: "Profile",
    },
  ];

const SEARCH_OPTIONS = [
  "By Movies",
  "By Series",
  "By Genres",
  "By VJ's",
  "By Sections",
  "By Year",
];

const DISCOVERY_GENRES = [
  { name: "By VJ", color: "rgba(251,146,60,0.15)", border: "#fb923c" },
  { name: "By Year", color: "rgba(129,140,248,0.15)", border: "#818cf8" },
  { name: "By Series", color: "rgba(52,211,153,0.15)", border: "#34d399" },
  { name: "By Section", color: "rgba(250,204,21,0.15)", border: "#facc15" },
  { name: "By Trending", color: "rgba(239,68,68,0.15)", border: "#ef4444" },
  { name: "By Suggestions", color: "rgba(56,189,248,0.15)", border: "#38bdf8" },
  { name: "Series", color: "rgba(239,68,68,0.15)", border: "#ef4444" },
  { name: "Action", color: "rgba(245,158,11,0.15)", border: "#f59e0b" },
  { name: "Sci-Fi", color: "rgba(16,185,129,0.15)", border: "#10b981" },
  { name: "Romance", color: "rgba(236,72,153,0.15)", border: "#ec4899" },
  { name: "Horror", color: "rgba(99,102,241,0.15)", border: "#6366f1" },
  { name: "Drama", color: "rgba(168,85,247,0.15)", border: "#a855f7" },
  { name: "Indian Movies", color: "rgba(14,165,233,0.15)", border: "#0ea5e9" },
  { name: "Thriller", color: "rgba(244,63,94,0.15)", border: "#f43f5e" },
  { name: "Mystery", color: "rgba(139,92,246,0.15)", border: "#8b5cf6" },
];

const DISCOVERY_SECTIONS = [
  "New Releases",
  "Trending Now",
  "Most Downloaded",
  "Latest",
  "Continue Watching",
  "Favourites",
  "My List",
  "Watch Later",
  "You May Also Like",
  "Last Watched",
  "Action",
  "Sci-Fi",
  "Romance",
  "Horror",
  "Drama",
  "Indian Movies",
];

const PEOPLE_ALSO_SEARCH = [
  "Orbital",
  "Inception 2",
  "The Last of Us",
  "Dark Matter",
  "Neon Horizon",
  "Severance",
  "True Detective",
  "Succession",
  "The Reckoning",
  "Mirzapur",
];

const YOU_MAY_ALSO_SEARCH_TOPICS = [
  "by section",
  "by movies",
  "by series",
  "by genres",
  "by vjs",
  "by year",
];

const BY_VJ_LIST = [
  "Vj Junior",
  "Vj Ice P",
  "Vj Emmy",
  "Vj Kevo",
  "Vj Jingo",
  "Vj Ulio",
  "Vj HD",
  "Vj Mk",
  "Vj Little T",
];
const BY_YEAR_LIST = [
  "2025",
  "2024",
  "2023",
  "2022",
  "2021",
  "2020",
  "2019",
  "2018",
];
const BY_SERIES_LIST = [
  "Action Series",
  "Thriller Series",
  "Drama Series",
  "Korean Series",
  "Hollywood Series",
  "Indian Movies",
];
const BY_TRENDING_LIST = [
  "Trending Movies",
  "Newly Released",
  "Most Viewed Movies",
  "Trending Series",
  "K-Drama",
  "Trending This Week",
  "Most Downloaded",
];

interface Notification {
  id: string;
  type: "movie" | "update" | "suggestion" | "trending" | "rating";
  icon: IoniconsName;
  title: string;
  message: string;
  time: string;
  image?: string;
  isNew?: boolean;
  movieId?: string;
  sectionTitle?: string;
  route?: string;
  count?: number;
  vjs?: { name: string; count: number }[];
  moviesCount?: number;
  seriesCount?: number;
  moviesList?: { id: string; title: string }[];
  seriesList?: { id: string; title: string }[];
  vjsDetailed?: { id: string; name: string; count: number }[];
}

const MOCK_NOTIFICATIONS: Notification[] = [];

// ─── Notification Overlay ───────────────────────────────────────────────────
function NotificationOverlay({
  visible,
  onClose,
  onSelect,
  showRatingModal,
  setShowRatingModal,
  selectedRating,
  setSelectedRating,
  submitRating,
  isRatingSubmitted,
  readIds,
  markRead,
  checkedItemIds,
  toggleCheckedItem,
  expandedType,
  setExpandedType,
  expandedNotificationId,
  setExpandedNotificationId,
  setReopenOnBack,
  setLastViewedItemId,
  isUpdateLocked,
  isUpdateApplied,
  isRatingPermanentlyRemoved,
  setGlobalGridTitle,
  setGlobalGridData,
  setGlobalGridVisible,
  notifications,
  highlightedId,
  markAllRead,
  loading,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (item: Notification) => void;
  showRatingModal: boolean;
  setShowRatingModal: (visible: boolean) => void;
  selectedRating: number;
  setSelectedRating: (rating: number) => void;
  submitRating: (rating: number) => void;
  isRatingSubmitted: boolean;
  readIds: Set<string>;
  markRead: (id: string) => void;
  checkedItemIds: Set<string>;
  toggleCheckedItem: (id: string) => void;
  expandedType: "movies" | "series" | "vjs" | null;
  setExpandedType: (type: "movies" | "series" | "vjs" | null) => void;
  expandedNotificationId: string | null;
  setExpandedNotificationId: (id: string | null) => void;
  setReopenOnBack: (val: boolean) => void;
  setLastViewedItemId: (id: string | null) => void;
  isUpdateLocked: boolean;
  isUpdateApplied: boolean;
  isRatingPermanentlyRemoved: boolean;
  setGlobalGridTitle: (title: string) => void;
  setGlobalGridData: (data: (Movie | Series)[]) => void;
  setGlobalGridVisible: (visible: boolean) => void;
  notifications: Notification[];
  highlightedId: string | null;
  markAllRead: () => void;
  loading: boolean;
  TOTAL_LIVE_ITEMS: (Movie | Series)[];
}) {
  const highlightAnim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible && highlightedId) {
      highlightAnim.setValue(1);
      Animated.sequence([
        Animated.delay(2500),
        Animated.timing(highlightAnim, {
          toValue: 0,
          duration: 1000,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      highlightAnim.setValue(0);
    }
  }, [visible, highlightedId]);

  const getFilteredItems = (item: Notification) => {
    const movies = item.moviesList || [];
    const series = item.seriesList || [];
    const vjs = item.vjsDetailed || [];
    const unreadMovies = movies.filter(m => !checkedItemIds.has(m.id));
    const unreadSeries = series.filter(s => !checkedItemIds.has(s.id));
    const unreadVjs = vjs.filter(v => !checkedItemIds.has(v.id));
    return {
      movies,
      series,
      vjs,
      unreadTotal: unreadMovies.length + unreadSeries.length,
      unreadMoviesCount: unreadMovies.length,
      unreadSeriesCount: unreadSeries.length,
      unreadVjsCount: unreadVjs.length
    };
  };

  const displayNotifications = useMemo(() => {
    const unread = notifications.filter((n) => {
      if (n.id === "n2") return !isUpdateApplied;
      if (n.type === "rating") return !isRatingPermanentlyRemoved;
      return !readIds.has(n.id);
    });
    const read = notifications.filter((n) => {
      if (n.id === "n2" || n.type === "rating") return false;
      return readIds.has(n.id);
    });
    return [...unread, ...read];
  }, [notifications, isUpdateApplied, isRatingPermanentlyRemoved, readIds]);

  useEffect(() => {
    if (visible) {
      const backAction = () => {
        if (showRatingModal) {
          setShowRatingModal(false);
          return true;
        }
        if (expandedType) {
          setExpandedType(null);
          return true;
        }
        onClose();
        return true;
      };

      const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
      return () => backHandler.remove();
    }
  }, [visible, showRatingModal, expandedType, onClose]);

  if (!visible) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 20000 }]}>
      {/* Top Line Separator (Synchronized with global theme) */}
      <View 
        style={{
          position: 'absolute',
          top: insets.top,
          left: 0,
          right: 0,
          height: StyleSheet.hairlineWidth,
          backgroundColor: "rgba(255,255,255,0.15)",
          zIndex: 1000,
        }} 
      />
      <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill}>
        <TouchableOpacity
          style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(10,10,18,0.92)" }]}
          activeOpacity={1}
          onPress={onClose}
        />
        <SafeAreaView style={[styles.notificationOverlayContainer, showRatingModal && { justifyContent: 'center' }]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={isUpdateLocked ? undefined : onClose}
          />

          {!showRatingModal ? (
            <View style={styles.notificationContent}>
              <View
                style={[
                  StyleSheet.absoluteFill,
                  { 
                    backgroundColor: "rgba(255,255,255,0.03)", 
                    borderRadius: 24, 
                    overflow: 'hidden',
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: 'rgba(255,255,255,0.1)'
                  }
                ]}
              />
              <View style={styles.notificationHeader}>
                <Text style={styles.notificationTitle}>Notifications</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {notifications.some(n => !readIds.has(n.id)) && (
                    <TouchableOpacity
                      onPress={markAllRead}
                      style={styles.markAllReadBtn}
                    >
                      <Text style={styles.markAllReadText}>Mark all as read</Text>
                    </TouchableOpacity>
                  )}
                  {!isUpdateLocked && (
                    <TouchableOpacity
                      onPress={onClose}
                      style={styles.notificationCloseBtn}
                    >
                      <Ionicons name="close" size={20} color="#fff" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 20 }}
              >
                {loading ? (
                  <View style={{ flex: 1, paddingVertical: 100, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator size="large" color="#5B5FEF" />
                    <Text style={{ color: 'rgba(255,255,255,0.5)', marginTop: 12, fontSize: 13 }}>Loading notifications...</Text>
                  </View>
                ) : (
                  <>
                    {displayNotifications.length > 0 ? (
                      displayNotifications.map((item, index) => {
                  const isRead = readIds.has(item.id);
                  const isUnread = !isRead;
                  const isLockedUpdate = item.id === "n2" && isUpdateLocked;
                  return (
                    <View key={item.id}>
                    <TouchableOpacity
                      style={[
                        styles.notificationCard,
                        isUnread && styles.notificationCardNew,
                        isRead && styles.notificationCardRead,
                        isLockedUpdate && styles.notificationCardLocked,
                      ]}
                      onPress={() => {
                        if (item.type !== 'rating') {
                          markRead(item.id);
                        }
                        onSelect(item);
                      }}
                      activeOpacity={0.7}
                    >
                      {item.id === highlightedId && (
                        <Animated.View
                          style={[
                            StyleSheet.absoluteFill,
                            {
                              borderColor: "rgba(255, 255, 255, 0.6)",
                              borderWidth: 2,
                              backgroundColor: "rgba(255, 255, 255, 0.15)",
                              opacity: highlightAnim,
                              zIndex: 10,
                              borderRadius: 16,
                            } as any
                          ]}
                        />
                      )}
                      {isUnread && (
                        <LinearGradient
                          colors={["rgba(16, 185, 129, 0.2)", "transparent"]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={StyleSheet.absoluteFill}
                        />
                      )}
                      {isUnread && <View style={styles.notificationCardSheen} />}

                      <View
                        style={[
                          styles.notificationIconWrap,
                          {
                            backgroundColor:
                              item.type === "movie"
                                ? isRead ? "rgba(56,189,248,0.07)" : "rgba(56,189,248,0.15)"
                                : item.type === "rating"
                                  ? isRead ? "rgba(245,158,11,0.07)" : "rgba(245,158,11,0.15)"
                                  : isRead ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.08)",
                          },
                          isUnread && styles.notificationIconWrapNew,
                        ]}
                      >
                        <Ionicons
                          name={item.icon}
                          size={18}
                          color={
                            isRead
                              ? "rgba(255,255,255,0.35)"
                              : item.type === "movie"
                                ? "#38bdf8"
                                : item.type === "rating"
                                  ? "#f59e0b"
                                  : "#fff"
                          }
                        />
                      </View>
                      <View style={styles.notificationTextWrap}>
                        <View style={styles.notificationCardHeader}>
                          <View style={styles.notificationTitleRow}>
                            <Text style={[styles.notificationCardTitle, isRead && styles.notificationCardTitleRead]}>
                              {item.title}
                            </Text>
                            {getFilteredItems(item).unreadTotal > 0 && !isRead && (
                              <View style={[
                                styles.countBadge,
                                (item.type === 'trending' || item.type === 'rating') && styles.countBadgeTrending
                              ]}>
                                <Text style={[
                                  styles.countBadgeText,
                                  (item.type === 'trending' || item.type === 'rating') && styles.countBadgeTrendingText
                                ]}>
                                  +{getFilteredItems(item).unreadTotal}
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.notificationTime}>{item.time}</Text>
                        </View>
                        <Text style={[styles.notificationMsg, isRead && { opacity: 0.4 }]} numberOfLines={2}>
                          {item.message}
                        </Text>

                        {!isRead && item.id === expandedNotificationId && expandedType ? (
                          <View style={styles.detailListContainer}>
                            <View style={styles.detailListHeader}>
                              <Text style={styles.detailListTitle}>
                                {expandedType.charAt(0).toUpperCase() + expandedType.slice(1)}
                              </Text>
                              <TouchableOpacity onPress={() => setExpandedType(null)}>
                                <Ionicons name="close-circle" size={20} color="rgba(255,255,255,0.4)" />
                              </TouchableOpacity>
                            </View>
                            {(expandedType === 'movies' ? getFilteredItems(item).movies :
                              expandedType === 'series' ? getFilteredItems(item).series :
                                getFilteredItems(item).vjs).map((subItem: any) => {
                                  const isSubRead = checkedItemIds.has(subItem.id);
                                  return (
                                    <View key={subItem.id} style={[styles.detailListItem, isSubRead && { opacity: 0.4 }]}>
                                      <TouchableOpacity
                                        style={{ flex: 1 }}
                                        onPress={() => {
                                          // Persistent state: mark for re-opening on back and defer checking
                                          setLastViewedItemId(subItem.id);
                                          setReopenOnBack(true);

                                          // "Command" the app to navigate
                                          if (expandedType === 'movies') {
                                            router.setParams({ movieId: subItem.id } as any);
                                          } else {
                                            DeviceEventEmitter.emit("sectionSelected", subItem.title || subItem.name);
                                          }
                                        }}
                                      >
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                          {isSubRead && <Ionicons name="checkmark-done" size={14} color="#10b981" style={{ marginRight: 6 }} />}
                                          <Text style={[styles.detailItemText, isSubRead && { textDecorationLine: 'line-through' }]}>
                                            {subItem.title || subItem.name}
                                            {isSubRead && <Text style={{ color: '#10b981', fontWeight: '800' }}> (Checked)</Text>}
                                          </Text>
                                        </View>
                                      </TouchableOpacity>
                                      <TouchableOpacity
                                        onPress={() => toggleCheckedItem(subItem.id)}
                                        style={styles.checkBtn}
                                      >
                                        <Ionicons
                                          name={isSubRead ? "checkmark-circle" : "checkmark-circle-outline"}
                                          size={20}
                                          color="#10b981"
                                        />
                                      </TouchableOpacity>
                                    </View>
                                  );
                                })}
                          </View>
                        ) : (
                          <View style={styles.typeBadgesRow}>
                            {getFilteredItems(item).movies.length > 0 && (
                              <TouchableOpacity
                                style={[
                                  styles.typeBadge,
                                  styles.movieBadge
                                ]}
                                onPress={() => {
                                  const movieIds = new Set(item.moviesList?.map((m: any) => m.id) || []);
                                  const gridData = TOTAL_LIVE_ITEMS.filter((m: any) => movieIds.has(m.id));
                                  if (gridData.length > 0) {
                                    setGlobalGridTitle(`${item.title} - Movies`);
                                    setGlobalGridData(gridData);
                                    setGlobalGridVisible(true);
                                  }
                                }}
                              >
                                <Ionicons name="film" size={10} color="#0ea5e9" style={{ marginRight: 4 }} />
                                <Text style={styles.movieBadgeText}>
                                  {getFilteredItems(item).movies.length} Movies
                                </Text>
                              </TouchableOpacity>
                            )}
                            {getFilteredItems(item).series.length > 0 && (
                              <TouchableOpacity
                                style={[
                                  styles.typeBadge,
                                  styles.seriesBadge
                                ]}
                                onPress={() => {
                                  const seriesIds = new Set(item.seriesList?.map((s: any) => s.id) || []);
                                  const gridData = TOTAL_LIVE_ITEMS.filter((m: any) => seriesIds.has(m.id));
                                  if (gridData.length > 0) {
                                    setGlobalGridTitle(`${item.title} - Series`);
                                    setGlobalGridData(gridData);
                                    setGlobalGridVisible(true);
                                  }
                                }}
                              >
                                <Ionicons name="tv" size={10} color="#a855f7" style={{ marginRight: 4 }} />
                                <Text style={styles.seriesBadgeText}>
                                  {getFilteredItems(item).series.length} Series
                                </Text>
                              </TouchableOpacity>
                            )}
                            {getFilteredItems(item).vjs.length > 0 && (
                              <View style={styles.vjPillsRow}>
                                {getFilteredItems(item).vjs.map((vj, idx) => {
                                  return (
                                    <TouchableOpacity
                                      key={idx}
                                      style={styles.vjPill}
                                      onPress={() => {
                                        const vjName = vj.name.toLowerCase();
                                        const gridData = TOTAL_LIVE_ITEMS.filter((m: any) => m.vj?.toLowerCase() === vjName || m.vj?.toLowerCase().includes(vjName));
                                        if (gridData.length > 0) {
                                          setGlobalGridTitle(`${vj.name} - Collection`);
                                          setGlobalGridData(gridData);
                                          setGlobalGridVisible(true);
                                        }
                                      }}
                                    >
                                      <Text style={styles.vjPillText}>
                                        {vj.name}
                                      </Text>
                                    </TouchableOpacity>
                                  );
                                })}
                              </View>
                            )}
                          </View>
                        )}
                      </View>
                      {isUnread && (
                        <View style={styles.newBadgePill}>
                          <View style={styles.pillSheen} />
                          <Text style={styles.newBadgeText}>NEW</Text>
                        </View>
                      )}
                      {isRead && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 'auto' }}>
                          <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                        </View>
                      )}
                    </TouchableOpacity>
                    {index < displayNotifications.length - 1 && (
                      <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 16 }} />
                    )}
                    </View>
                  );
                })) : (
                  <View style={{ flex: 1, paddingVertical: 100 }}>
                    <EmptyState
                      title="Quiet in here"
                      description="We'll notify you when new movies or updates are available. Stay tuned!"
                      icon="notifications-off-outline"
                    />
                  </View>
                )}
                  </>
                )}
              </ScrollView>
            </View>
          ) : (
            <View style={[styles.notificationContent, styles.ratingContent]}>
              <Text style={styles.ratingTitle}>Rate your experience</Text>
              <Text style={styles.ratingSub}>
                Tap a star to give your feedback
              </Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => setSelectedRating(star)}
                    activeOpacity={0.6}
                    disabled={isRatingSubmitted}
                    style={styles.starTouch}
                  >
                    <Ionicons
                      name={star <= selectedRating ? "star" : "star-outline"}
                      size={36}
                      color="#f59e0b"
                      style={{ opacity: isRatingSubmitted && star > selectedRating ? 0.4 : 1 }}
                    />
                  </TouchableOpacity>
                ))}
              </View>

              {selectedRating > 0 && !isRatingSubmitted && (
                <TouchableOpacity
                  style={styles.submitRatingBtn}
                  onPress={() => submitRating(selectedRating)}
                >
                  <Text style={styles.submitRatingText}>Submit Rating</Text>
                </TouchableOpacity>
              )}

              {isRatingSubmitted && (
                <Text style={styles.thankYouText}>Thank you! Redirecting...</Text>
              )}

              <TouchableOpacity
                onPress={() => {
                  Linking.openURL("market://details?id=com.themoviezone247.official").catch(() => {
                    Linking.openURL("https://play.google.com/store/apps/details?id=com.themoviezone247.official");
                  });
                  markRead('n5');
                  setShowRatingModal(false);
                }}
                style={styles.playStoreBtn}
              >
                <Ionicons name="logo-google-playstore" size={16} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.playStoreBtnText}>Write a review on Play Store</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowRatingModal(false)}
                style={styles.cancelRating}
              >
                <Text style={styles.cancelRatingText}>Later</Text>
              </TouchableOpacity>
            </View>
          )}
        </SafeAreaView>
      </BlurView>
    </View>
  );
}
import { Easing } from "react-native";

// ─── Marquee Placeholder Component ─────────────────────────────────────────────
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
      // subtract padding/icon space
      const scrollDistance = textWidth - (containerWidth - 40) + 20; // extra padding
      const duration = scrollDistance * 60; // speed adjustment

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

// ─── Search Overlay (Universal) ─────────────────────────────────────────────
function SearchOverlay({
  visible,
  onClose,
  onSelect,
  vjOnly = false,
  autoFocusRequested = false,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (m: Movie) => void;
  vjOnly?: boolean;
  autoFocusRequested?: boolean;
}) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [query, setQuery] = useState("");
  const [subCategory, setSubCategory] = useState<string | null>(null);
  const [discoveryMode, setDiscoveryMode] = useState<"trending" | "sections">(
    "trending",
  );
  const [selectedType, setSelectedType] = useState<"Movie" | "Series" | "Mini Series" | null>(
    null,
  );
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [selectedVJ, setSelectedVJ] = useState<string | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "rating" | null>(
    null,
  );
  const [yearCategory, setYearCategory] = useState<"new" | "oldest">("new");
  const [expandedFilter, setExpandedFilter] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (query.length > 0) {
      setSearching(true);
      const timer = setTimeout(() => setSearching(false), 400);
      return () => clearTimeout(timer);
    } else {
      setSearching(false);
    }
  }, [query]);
  const { isPaid } = useSubscription();
  const { liveMovies, liveSeries, allRows, loading, youMayAlsoLike, bukoleya, trendingSeries } = useMovies();

  // Combine all live content for absolute coverage
  const TOTAL_LIVE_ITEMS = React.useMemo(() => {
    const combined = [...liveMovies, ...liveSeries];
    // Deduplicate by ID just in case
    return Array.from(new Map(combined.map(item => [item.id, item])).values());
  }, [liveMovies, liveSeries]);

  const toggleFilter = (key: string) => {
    setExpandedFilter((prev) => (prev === key ? null : key));
  };

  const clearFilters = (stepByStep = false) => {
    if (stepByStep) {
      if (expandedFilter) {
        setExpandedFilter(null);
      } else if (selectedGenre) {
        setSelectedGenre(null);
        setExpandedFilter("genre");
      } else if (selectedYear) {
        setSelectedYear(null);
        setExpandedFilter("year");
      } else if (selectedVJ) {
        setSelectedVJ(null);
        setExpandedFilter("vj");
      } else if (selectedType) {
        setSelectedType(null);
      } else {
        setQuery("");
        setSortBy(null);
      }
    } else {
      setSelectedType(null);
      setSelectedGenre(null);
      setSelectedYear(null);
      setSelectedVJ(null);
      setSelectedSeason(null);
      setSortBy(null);
      setExpandedFilter(null);
      setQuery("");
    }
  };

  const inputRef = useRef<TextInput>(null);
  const resultsRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible && autoFocusRequested) {
      setTimeout(() => inputRef.current?.focus(), 250);
    }
  }, [visible, autoFocusRequested]);

  // Clear state effect removed to support "step-by-step" back navigation
  // State is now preserved until manually cleared or app is closed.


  useEffect(() => {
    if (selectedType && selectedType !== "Series" && selectedSeason) {
      setSelectedSeason(null);
    }
  }, [selectedType]);

  // Auto-scroll to top when query changes
  useEffect(() => {
    if (query.trim().length > 0) {
      resultsRef.current?.scrollToOffset({ offset: 0, animated: true });
    }
  }, [query]);

  useEffect(() => {
    // Keyboard listeners removed in favor of KeyboardAvoidingView
  }, []);

  const getPlaceholderText = () => {
    if (!selectedGenre && !selectedYear && !selectedVJ)
      return "Search movies, series, genres, VJs, year";

    let parts = ["Search"];
    if (selectedGenre) parts.push(selectedGenre);
    parts.push("movies");
    if (selectedVJ) parts.push(`by ${selectedVJ}`);
    if (selectedYear) parts.push(`in ${selectedYear}`);

    return parts.join(" ");
  };

  const hasActiveFilters =
    selectedType !== null ||
    selectedGenre !== null ||
    selectedYear !== null ||
    selectedVJ !== null ||
    selectedSeason !== null ||
    sortBy !== null;

  const isFiltering =
    query.trim().length > 0 || hasActiveFilters || expandedFilter !== null;

  const isPerformingFiltering =
    hasActiveFilters || expandedFilter !== null || discoveryMode === "sections";

  const results = isFiltering
    ? (() => {
      const q = query.toLowerCase().trim();
      let base: (Movie | Series)[] = TOTAL_LIVE_ITEMS;

      if (q) {
        let searchQ = q;
        // Aliases for sections
        if (q === "trending movies") searchQ = "trending";
        if (q === "newly released" || q === "newly movie" || q === "latest") searchQ = "new releases";
        if (q === "most viewed movies" || q === "most viewed") searchQ = "most viewed";

        // 1. Match any section names (e.g. "Action", "Trending", "New") and grab their movies
        const sectionMatches = allRows.filter((r) => r.title.toLowerCase().includes(searchQ))
          .flatMap((r) => r.data);

        // 2. Fuzzy search across all items (movies + series)
        const vjSearchQuery = searchQ.startsWith("vj ") ? searchQ.replace("vj ", "") : searchQ;
        const attributeMatches = TOTAL_LIVE_ITEMS.filter((m) => {
          return (
            m.title.toLowerCase().includes(searchQ) ||
            m.genre.toLowerCase().includes(searchQ) ||
            String(m.year).includes(searchQ) ||
            m.vj.toLowerCase().includes(vjSearchQuery) ||
            m.title.toLowerCase().replace(/[^a-z0-9]/g, "").includes(searchQ.replace(/[^a-z0-9]/g, ""))
          );
        });

        // Combine and deduplicate
        const combined = [...sectionMatches, ...attributeMatches];
        base = Array.from(new Map(combined.map(item => [item.id, item])).values());

        // Sort if we typed a vj name to bubble up VJ content matching the exact VJ
        if (searchQ.startsWith("vj ") || ALL_ITEMS.some(m => m.vj.toLowerCase() === searchQ)) {
          base.sort((a, b) => {
            const aVJ = a.vj.toLowerCase() === vjSearchQuery || a.vj.toLowerCase() === searchQ;
            const bVJ = b.vj.toLowerCase() === vjSearchQuery || b.vj.toLowerCase() === searchQ;
            if (aVJ && !bVJ) return -1;
            if (!aVJ && bVJ) return 1;
            if (b.year !== a.year) return b.year - a.year;
            return parseFloat(b.rating) - parseFloat(a.rating);
          });
        }
      }

      let filtered = base;
      if (selectedVJ) {
        const vjQ = selectedVJ.toLowerCase();
        const vjName = vjQ.startsWith("vj ") ? vjQ : "vj " + vjQ;
        filtered = filtered.filter(
          (m) => m.vj.toLowerCase() === vjName || m.vj.toLowerCase() === vjQ,
        );
      }
      if (selectedType) {
        filtered = filtered.filter((m) => {
          const isSeries = "seasons" in m;
          if (selectedType === "Movie") return !isSeries;
          if (selectedType === "Series") return isSeries && !(m as any).isMiniSeries;
          if (selectedType === "Mini Series") return isSeries && !!(m as any).isMiniSeries;
          return true;
        });
      }
      if (selectedGenre)
        filtered = filtered.filter((m) => m.genre.includes(selectedGenre));
      if (selectedYear)
        filtered = filtered.filter((m) => String(m.year) === selectedYear);
      if (selectedSeason) {
        filtered = filtered.filter((m) => {
          if ("seasons" in m) {
            return m.seasons >= parseInt(selectedSeason);
          }
          return false;
        });
      }

      if (sortBy === "newest")
        filtered = [...filtered].sort((a, b) => b.year - a.year);
      else if (sortBy === "oldest")
        filtered = [...filtered].sort((a, b) => a.year - b.year);
      else if (sortBy === "rating")
        filtered = [...filtered].sort(
          (a, b) => parseFloat(b.rating) - parseFloat(a.rating),
        );

      return filtered;
    })()
    : [];

  const renderFilters = () => (
    <View style={styles.resultsHeader} />
  );

  useEffect(() => {
    if (visible) {
      const backAction = () => {
        if (expandedFilter) {
          setExpandedFilter(null);
          return true;
        }
        if (hasActiveFilters) {
          clearFilters(true); // Step-by-step clearing
          return true;
        }
        if (query.trim().length > 0) {
          setQuery("");
          return true;
        }
        onClose();
        return true;
      };

      const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
      return () => backHandler.remove();
    }
  }, [visible, expandedFilter, hasActiveFilters, query, onClose]);

  if (!visible) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 30000 }]}>
      {/* Top Line Separator (Synchronized with global theme) */}
      <View 
        style={{
          position: 'absolute',
          top: insets.top,
          left: 0,
          right: 0,
          height: StyleSheet.hairlineWidth,
          backgroundColor: "rgba(255,255,255,0.15)",
          zIndex: 1000,
        }} 
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "#0a0a0f" }]}>
        <View style={{ flex: 1 }}>
          {/* ── Fixed Top Search Bar Container ── */}
          <View 
            style={{ 
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 12,
              paddingBottom: 12,
              paddingTop: Math.max(insets.top, StatusBar.currentHeight || 24) + (Platform.OS === 'ios' ? 0 : 12),
              backgroundColor: '#0a0a0f',
              zIndex: 1000,
            }}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              pointerEvents="box-none"
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <TouchableOpacity
                onPress={() => {
                  if (expandedFilter) {
                    setExpandedFilter(null);
                  } else if (hasActiveFilters) {
                    clearFilters(true); // Step by step
                  } else {
                    onClose();
                  }
                }}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: 'rgba(255, 255, 255, 0.22)',
                  marginRight: 10,
                }}
              >
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>

              <View
                style={{
                  flex: 1,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: 'rgba(255, 255, 255, 0.22)',
                  overflow: 'hidden',
                }}
                onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
              >
                {Platform.OS === 'ios' ? (
                  <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
                ) : (
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255, 255, 255, 0.08)' }]} />
                )}
                {searching ? (
                  <ActivityIndicator 
                    size="small" 
                    color="#5B5FEF" 
                    style={{ marginLeft: 12, marginRight: 6, transform: [{ scale: 0.8 }] }} 
                  />
                ) : (
                  <Ionicons
                    name="search"
                    size={18}
                    color="rgba(255,255,255,0.4)"
                    style={{ marginLeft: 12, marginRight: 6 }}
                  />
                )}
                {selectedVJ ? (
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: 'rgba(91,95,239,0.30)',
                    borderRadius: 12,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    marginRight: 6,
                  }}>
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{selectedVJ}</Text>
                    <TouchableOpacity onPress={() => setSelectedVJ(null)} style={{ marginLeft: 4 }}>
                      <Ionicons name="close-circle" size={14} color="rgba(255,255,255,0.6)" />
                    </TouchableOpacity>
                  </View>
                ) : null}
                <TextInput
                  ref={inputRef}
                  style={[styles.universalSearchInput, { paddingHorizontal: 0, flex: 1 }]}
                  placeholder={selectedVJ ? `Search in ${selectedVJ}…` : getPlaceholderText()}
                  placeholderTextColor="rgba(255,255,255,0.45)"
                  value={query}
                  onChangeText={(text) => setQuery(text)}
                  returnKeyType="search"
                  multiline={false}
                  numberOfLines={1}
                  autoFocus={false}
                />
                {(isFiltering || selectedVJ) && (
                  <View style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "rgba(91,95,239,0.25)",
                    borderRadius: 10,
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    marginRight: 4,
                  }}>
                    <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 10, fontWeight: "700" }}>
                      {results.length}
                    </Text>
                  </View>
                )}
                {query.length > 0 && (
                  <TouchableOpacity onPress={() => setQuery("")} style={{ padding: 6 }}>
                    <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.45)" />
                  </TouchableOpacity>
                )}
              </View>
            </KeyboardAvoidingView>
          </View>

          {/* ── Thin separator line below search bar ── */}
          <View style={{
            height: StyleSheet.hairlineWidth,
            backgroundColor: 'rgba(255, 255, 255, 0.22)',
            marginHorizontal: 0,
          }} />

          <View style={{ flex: 1 }}>

                {isFiltering ? (
                  <View style={{ flex: 1 }}>
                    <FlatList
                      ref={resultsRef}
                      keyboardShouldPersistTaps="always"
                      data={(loading || searching) && results.length === 0 ? Array(12).fill({ id: "skeleton" }) : results}
                      keyExtractor={(m, i) => `${m.id}-${i}`}
                      numColumns={3}
                      contentContainerStyle={{
                        paddingHorizontal: 16,
                        paddingTop: 8,
                        paddingBottom: 160,
                      }}
                      columnWrapperStyle={{
                        justifyContent: "flex-start",
                        gap: 6,
                        marginBottom: 10,
                      }}
                      renderItem={({ item, index }) => {
                        if (item.id === "skeleton") {
                          return (
                            <View style={[styles.searchResultCard, { height: 180 }]}>
                              <SkeletonLoader width="100%" height={130} borderRadius={10} />
                              <SkeletonLoader width="80%" height={12} style={{ marginTop: 8 }} />
                              <SkeletonLoader width="50%" height={10} style={{ marginTop: 4 }} />
                            </View>
                          );
                        }
                        return (
                          <TouchableOpacity
                            style={styles.searchResultCard}
                            onPress={() => {
                              onSelect(item);
                            }}
                          >
                            <View>
                              <Image
                                source={{ uri: item.poster }}
                                style={styles.searchResultPoster}
                              />
                              <View style={styles.vjBadge}>
                                <Text style={styles.vjBadgeText}>{item.vj}</Text>
                              </View>

                              {(!isPaid && !item.isFree) && (
                                <View style={styles.lockBadge}>
                                  <Ionicons name="lock-closed" size={9} color="#fff" />
                                </View>
                              )}
                              <View style={styles.genreBadge}>
                                <Text style={[styles.genreBadgeText, "seasons" in item && { color: "#fff" }]}>
                                  {"seasons" in item ? (item.isMiniSeries ? "Mini Series" : "Series") : shortenGenre(item.genre)}
                                </Text>
                              </View>
                              {"seasons" in item && (
                                <View style={styles.epBadgePremium}>
                                  <Ionicons name="ellipsis-horizontal" size={10} color="#fff" style={{ marginRight: 2 }} />
                                  <Text style={styles.epBadgeTextPremium}>{(item as any).episodes} EP</Text>
                                </View>
                              )}
                            </View>
                            <View style={styles.searchResultInfo}>
                              <Text
                                style={styles.searchResultTitle}
                                numberOfLines={1}
                              >
                                {item.title}
                              </Text>
                              <Text
                                style={styles.searchResultMetadata}
                                numberOfLines={1}
                              >
                                {item.year} ·{" "}
                                {"seasons" in item
                                  ? ((item as any).isMiniSeries ? "Mini Series" : `Season ${item.seasons}`)
                                  : item.duration}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      }}
                      ListEmptyComponent={
                        <EmptyState
                          title="No matches found"
                          description={`We couldn't find any content matching "${query || 'your filters'}". Try adjusting your search or filters.`}
                          icon="search-outline"
                          actionLabel="Clear Filters"
                          onAction={() => clearFilters()}
                        />
                      }
                    />
                  </View>
                ) : (
                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="always"
                    contentContainerStyle={{ paddingBottom: 160 }}
                  >
                    {!vjOnly && (
                      <View>
                        {youMayAlsoLike.length > 0 && (
                          <View style={styles.discoverySection}>
                            <Text style={styles.discoveryHeader}>You May Also Like</Text>
                            <View style={styles.gridDiscoveryContainer}>
                              {youMayAlsoLike.slice(0, 6).map((item) => (
                                <TouchableOpacity
                                  key={`you-may-like-${item.id}`}
                                  style={styles.searchResultCard}
                                  onPress={() => onSelect(item)}
                                >
                                  <View>
                                    <Image source={{ uri: item.poster }} style={styles.searchResultPoster} />
                                    <View style={styles.vjBadge}>
                                      <Text style={styles.vjBadgeText}>{item.vj}</Text>
                                    </View>
                                    <View style={styles.genreBadge}>
                                      <Text style={styles.genreBadgeText}>
                                        {("seasons" in item) ? (item.isMiniSeries ? "Mini Series" : "Series") : shortenGenre(item.genre)}
                                      </Text>
                                    </View>
                                    {("seasons" in item) && (
                                      <View style={styles.epBadgePremium}>
                                        <Ionicons name="ellipsis-horizontal" size={10} color="#fff" style={{ marginRight: 2 }} />
                                        <Text style={styles.epBadgeTextPremium}>{(item as any).episodes} EP</Text>
                                      </View>
                                    )}
                                  </View>
                                  <View style={styles.searchResultInfo}>
                                    <Text numberOfLines={1} style={styles.searchResultTitle}>{item.title}</Text>
                                    <Text style={styles.searchResultMetadata}>
                                      {("seasons" in item) ? `${item.year} · Season ${item.seasons}` : `${item.year} · ${item.vj}`}
                                    </Text>
                                  </View>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </View>
                        )}

                        <View style={styles.discoverySection}>
                          <Text style={styles.discoveryHeader}>Bukoleya</Text>
                          <View style={styles.gridDiscoveryContainer}>
                            {bukoleya.slice(0, 6).map((item) => (
                              <TouchableOpacity
                                key={`bukoleya-${item.id}`}
                                style={styles.searchResultCard}
                                onPress={() => onSelect(item)}
                              >
                                <View>
                                  <Image source={{ uri: item.poster }} style={styles.searchResultPoster} />
                                  <View style={styles.vjBadge}>
                                    <Text style={styles.vjBadgeText}>{item.vj}</Text>
                                  </View>
                                  <View style={styles.genreBadge}>
                                    <Text style={styles.genreBadgeText}>
                                      {("seasons" in item) ? (item.isMiniSeries ? "Mini Series" : "Series") : shortenGenre(item.genre)}
                                    </Text>
                                  </View>
                                  {("seasons" in item) && (
                                    <View style={styles.epBadgePremium}>
                                      <Ionicons name="ellipsis-horizontal" size={10} color="#fff" style={{ marginRight: 2 }} />
                                      <Text style={styles.epBadgeTextPremium}>{(item as any).episodes} EP</Text>
                                    </View>
                                  )}
                                </View>
                                <View style={styles.searchResultInfo}>
                                  <Text numberOfLines={1} style={styles.searchResultTitle}>{item.title}</Text>
                                  <Text style={styles.searchResultMetadata}>
                                    {("seasons" in item) ? `${item.year} · Season ${item.seasons}` : `${item.year} · ${item.vj}`}
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>

                        <View style={styles.discoverySection}>
                          <Text style={styles.discoveryHeader}>Trending Series</Text>
                          <View style={styles.gridDiscoveryContainer}>
                            {trendingSeries.slice(0, 6).map((item) => (
                              <TouchableOpacity
                                key={`trending-series-${item.id}`}
                                style={styles.searchResultCard}
                                onPress={() => onSelect(item)}
                              >
                                <View>
                                  <Image source={{ uri: item.poster }} style={styles.searchResultPoster} />
                                  <View style={styles.vjBadge}>
                                    <Text style={styles.vjBadgeText}>{item.vj}</Text>
                                  </View>
                                  <View style={styles.genreBadge}>
                                    <Text style={styles.genreBadgeText}>
                                      {item.isMiniSeries ? "Mini Series" : "Series"}
                                    </Text>
                                  </View>
                                  <View style={styles.epBadgePremium}>
                                    <Ionicons name="ellipsis-horizontal" size={10} color="#fff" style={{ marginRight: 2 }} />
                                    <Text style={styles.epBadgeTextPremium}>{(item as any).episodes} EP</Text>
                                  </View>
                                </View>
                                <View style={styles.searchResultInfo}>
                                  <Text numberOfLines={1} style={styles.searchResultTitle}>{item.title}</Text>
                                  <Text style={styles.searchResultMetadata}>{item.year} · Season {item.seasons}</Text>
                                </View>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      </View>
                    )}

                    {vjOnly && (
                      <View style={styles.discoverySection}>
                        <View style={styles.vjGlassWell}>
                          <BlurView
                            intensity={15}
                            tint="dark"
                            style={StyleSheet.absoluteFill}
                          />
                          <View style={styles.trendingWrap}>
                            {ALL_VJS.map((vj) => (
                              <TouchableOpacity
                                key={vj}
                                style={styles.discoveryChip}
                                onPress={() => setSelectedVJ(vj)}
                              >
                                <BlurView
                                  intensity={35}
                                  tint="dark"
                                  style={StyleSheet.absoluteFill}
                                />
                                <Text style={styles.trendingText}>{vj}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      </View>
                    )}
                  </ScrollView>
                )}
              </View>

              {/* ── Bottom Quick Search / Sections ── */}
              {!isFiltering && !vjOnly && (
                <KeyboardAvoidingView
                  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                  style={[
                    styles.universalSearchBottomFilters,
                    { paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 24 : 12) }
                  ]}
                >
                  {/* Filter Chips Layer — above the pill switcher */}
                  <View style={[styles.trendingWrap, { marginBottom: 8, paddingHorizontal: 20 }]}>
                    {discoveryMode === "trending" ? (
                      SEARCH_OPTIONS.map((topic) => (
                        <TouchableOpacity
                          key={topic}
                          style={styles.discoveryChip}
                          onPress={() => {
                            const t = topic.toLowerCase();
                            if (t === "by sections") setDiscoveryMode("sections");
                            else if (t === "by movies") setSelectedType("Movie");
                            else if (t === "by series") setSelectedType("Series");
                            else if (t === "by genres") toggleFilter("genre");
                            else if (t === "by vjs" || t === "by vj's") toggleFilter("vj");
                            else if (t === "by year") toggleFilter("year");
                            else setQuery(topic);
                          }}
                        >
                          <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFill} />
                          <Text style={styles.trendingText}>{topic}</Text>
                        </TouchableOpacity>
                      ))
                    ) : (
                      DISCOVERY_SECTIONS.map((section) => (
                        <TouchableOpacity
                          key={section}
                          style={styles.discoveryChip}
                          onPress={() => setQuery(section)}
                        >
                          <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFill} />
                          <Text style={styles.trendingText}>{section}</Text>
                        </TouchableOpacity>
                      ))
                    )}
                  </View>

                  {/* Quick Search / Quick Sections pill switcher — at the bottom */}
                  <View
                    style={[
                      styles.discoverySwitcher,
                      {
                        backgroundColor: "rgba(255,255,255,0.04)",
                        overflow: "hidden",
                        marginHorizontal: 20,
                      },
                    ]}
                  >
                    <BlurView
                      intensity={40}
                      tint="dark"
                      style={StyleSheet.absoluteFill}
                    />
                    <TouchableOpacity
                      style={[
                        styles.switcherTab,
                        discoveryMode === "trending" &&
                        styles.switcherTabActive,
                      ]}
                      onPress={() => setDiscoveryMode("trending")}
                    >
                      {discoveryMode === "trending" && (
                        <View style={styles.discoveryPillSheen} />
                      )}
                      <Ionicons
                        name="flame"
                        size={16}
                        color={
                          discoveryMode === "trending"
                            ? "#fff"
                            : "rgba(255,255,255,0.4)"
                        }
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[
                          styles.switcherTabText,
                          discoveryMode === "trending" &&
                          styles.switcherTabTextActive,
                        ]}
                      >
                        Quick Search
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.switcherTab,
                        discoveryMode === "sections" &&
                        styles.switcherTabActive,
                      ]}
                      onPress={() => setDiscoveryMode("sections")}
                    >
                      {discoveryMode === "sections" && (
                        <View style={styles.discoveryPillSheen} />
                      )}
                      <Ionicons
                        name="grid"
                        size={16}
                        color={
                          discoveryMode === "sections"
                            ? "#fff"
                            : "rgba(255,255,255,0.4)"
                        }
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[
                          styles.switcherTabText,
                          discoveryMode === "sections" &&
                          styles.switcherTabTextActive,
                        ]}
                      >
                        Quick Sections
                      </Text>
                    </TouchableOpacity>
                  </View>
                </KeyboardAvoidingView>
              )}
            </View>
          </View>
    </View>
  );
}

// ─── Custom Tab Bar ──────────────────────────────────────────────────────────
function CustomTabBar() {
  const { liveMovies, liveSeries, announcements, loadingAnnouncements, readIds, markRead, markAllRead } = useMovies();
  const {
    allMoviesFree,
    eventMessage,
    playingNow,
    setPlayingNow,
    playerMode,
    setPlayerMode,
    playerTitle,
    setPlayerTitle,
    selectedVideoUrl,
    setSelectedVideoUrl
  } = useSubscription();
  const { activeDownloads } = useDownloads();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const path = usePathname();
  const [searchVisible, setSearchVisible] = useState(false);
  const [shouldReopenSearch, setShouldReopenSearch] = useState(false);

  const [searchVjOnly, setSearchVjOnly] = useState(false);
  const [searchAutoFocus, setSearchAutoFocus] = useState(false);
  const [notificationVisible, setNotificationVisible] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showEventPreview, setShowEventPreview] = useState(false);
  const [isFromHero, setIsFromHero] = useState(false);
  const [selectedRating, setSelectedRating] = useState(0);
  const [checkedItemIds, setCheckedItemIds] = useState<Set<string>>(new Set());
  const [updateDismissCount, setUpdateDismissCount] = useState(0);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [isStateLoaded, setIsStateLoaded] = useState(false);
  const [isUpdateApplied, setIsUpdateApplied] = useState(false);
  const [isRatingPermanentlyRemoved, setIsRatingPermanentlyRemoved] = useState(false);
  const [isDetailStackVisible, setIsDetailStackVisible] = useState(false);

  const readIdsRef = useRef(readIds);
  useEffect(() => {
    readIdsRef.current = readIds;
  }, [readIds]);

  // Load persisted states on mount
  useEffect(() => {
    const loadState = async () => {
      try {
        const [
          savedCheckedIds,
          savedDismissCount,
          savedUpdateApplied,
          savedRatingRemoved
        ] = await Promise.all([
          AsyncStorage.getItem("checkedItemIds"),
          AsyncStorage.getItem("updateDismissCount"),
          AsyncStorage.getItem("isUpdateApplied"),
          AsyncStorage.getItem("isRatingPermanentlyRemoved"),
        ]);

        if (savedCheckedIds) setCheckedItemIds(new Set(JSON.parse(savedCheckedIds)));
        if (savedDismissCount) setUpdateDismissCount(parseInt(savedDismissCount, 10));
        if (savedUpdateApplied) setIsUpdateApplied(savedUpdateApplied === "true");
        if (savedRatingRemoved) setIsRatingPermanentlyRemoved(savedRatingRemoved === "true");

        setIsStateLoaded(true);
      } catch (e) {
        console.error("Failed to load notification state", e);
        setIsStateLoaded(true);
      }
    };
    loadState();
  }, []);

  // Persist states when they change (only after initial load)
  useEffect(() => {
    if (isStateLoaded) {
      AsyncStorage.setItem("checkedItemIds", JSON.stringify([...checkedItemIds]));
    }
  }, [checkedItemIds, isStateLoaded]);

  useEffect(() => {
    if (isStateLoaded) {
      AsyncStorage.setItem("updateDismissCount", String(updateDismissCount));
    }
  }, [updateDismissCount, isStateLoaded]);

  useEffect(() => {
    if (isStateLoaded) {
      AsyncStorage.setItem("isUpdateApplied", String(isUpdateApplied));
    }
  }, [isUpdateApplied, isStateLoaded]);

  const shouldReopenRef = useRef(false);
  useEffect(() => {
    shouldReopenRef.current = shouldReopenSearch;
  }, [shouldReopenSearch]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("previewClosed", () => {
      if (shouldReopenRef.current) {
        // Small delay to allow the closing modal to finish its animation
        setTimeout(() => {
          setSearchVisible(true);
          setShouldReopenSearch(false);
        }, 100);
      }
    });
    return () => sub.remove();
  }, []);

  const prevPath = useRef(path);
  useEffect(() => {
    // If we were on the saved tab (Series detail) and we move back to another tab
    // and we were previously searching, re-open the search.
    if (prevPath.current === "/(tabs)/saved" && path !== "/(tabs)/saved" && shouldReopenRef.current) {
      setSearchVisible(true);
      setShouldReopenSearch(false);
    }
    prevPath.current = path;
  }, [path]);

  useEffect(() => {
    if (isStateLoaded) {
      AsyncStorage.setItem("isRatingPermanentlyRemoved", String(isRatingPermanentlyRemoved));
    }
  }, [isRatingPermanentlyRemoved, isStateLoaded]);



  // Emit events when search or notification overlays are toggled to auto-mute hero video
  useEffect(() => {
    DeviceEventEmitter.emit("searchOverlayVisible", searchVisible);
  }, [searchVisible]);

  useEffect(() => {
    DeviceEventEmitter.emit("notificationOverlayVisible", notificationVisible);
  }, [notificationVisible]);

  const [hasThreeButtonNav, setHasThreeButtonNav] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'android' && insets.bottom > 28) {
      setHasThreeButtonNav(true);
    }
  }, [insets.bottom]);

  const [isHomeHeaderBlurred, setIsHomeHeaderBlurred] = useState(false);
  const homeHeaderOpacity = useRef(new Animated.Value(0)).current;
  const [homeScrollY, setHomeScrollY] = useState(0);
  const [isMenuHeaderBlurred, setIsMenuHeaderBlurred] = useState(false);
  const menuHeaderOpacity = useRef(new Animated.Value(0)).current;
  const [menuScrollY, setMenuScrollY] = useState(0);
  const inPlaceSearchRef = useRef<TextInput>(null);

  useEffect(() => {
    Animated.timing(homeHeaderOpacity, {
      toValue: isHomeHeaderBlurred ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isHomeHeaderBlurred]);

  useEffect(() => {
    Animated.timing(menuHeaderOpacity, {
      toValue: isMenuHeaderBlurred ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isMenuHeaderBlurred]);

  const dynamicBarBottom = Platform.OS === 'android'
    ? (hasThreeButtonNav ? 54 : (insets.bottom > 0 ? insets.bottom + 4 : 20))
    : 28;

  const dynamicSearchBottom = Platform.OS === 'ios' ? 20 : 16;


  const [showInPlaceSearch, setShowInPlaceSearch] = useState(false);
  const [inPlaceSearchQuery, setInPlaceSearchQuery] = useState("");
  const [returnSeries, setReturnSeries] = useState<any>(null);

  useEffect(() => {
    if (showInPlaceSearch) {
      const timer = setTimeout(() => {
        inPlaceSearchRef.current?.focus();
      }, 750);
      return () => clearTimeout(timer);
    }
  }, [showInPlaceSearch]);

  const segment = path.replace(/^\/\(tabs\)/, "") || "/";
  const [isOverlayVisible, setIsOverlayVisible] = useState(false);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('setOverlayVisible', (v: boolean) => {
      setIsOverlayVisible(v);
    });
    return () => sub.remove();
  }, []);

  const active = (route: string) => {
    const seg = route.replace(/^\/\(tabs\)/, "") || "/";
    if (seg === "/")
      return segment === "/" || segment === "/index" || segment === "";
    return segment === seg || segment.startsWith(seg + "/");
  };

  // Construct notifications with live data
  const notifications = useMemo(() => {
    let baseData = [...MOCK_NOTIFICATIONS];

    // Inject real Announcements from Firestore
    const realNotifications: Notification[] = (announcements || []).map((ann: any) => {
      // Map admin categories to mobile types
      const adminType = ann.type || ann.category;
      let type: 'movie' | 'trending' | 'update' | 'rating' = 'update';
      let icon: any = 'notifications';

      if (adminType === 'hero_promotion' || adminType === 'Trending' || adminType === 'Promotion') {
        type = 'trending';
        icon = 'flame';
      } else if (adminType === 'movie_release' || adminType === 'New Release') {
        type = 'movie';
        icon = 'film';
      } else if (adminType === 'System') {
        type = 'update';
        icon = 'shield-checkmark';
      }

      // Helper for clean time display
      const formatTime = (ts: any) => {
        if (!ts) return 'Just Now';
        const date = new Date(ts);
        const now = new Date();
        const diffInHours = Math.abs(now.getTime() - date.getTime()) / 36e5;
        
        if (diffInHours < 1) return 'Just Now';
        if (diffInHours < 24) return `${Math.floor(diffInHours)}h ago`;
        if (diffInHours < 48) return 'Yesterday';
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      };

      return {
        id: ann.id,
        type,
        icon,
        title: ann.subject || 'Announcement',
        message: ann.message || ann.body || '',
        time: formatTime(ann.createdAt),
        image: ann.imageUrl || undefined,
        isNew: !readIds.has(ann.id),
        movieId: ann.movieId || ann.targetMovieId || undefined,
      };
    });

    // Prepend real announcements to base data
    baseData = [...realNotifications, ...baseData];

    if (allMoviesFree) {
      const eventNotif: Notification = {
        id: "event_n1",
        type: "update",
        icon: "gift",
        title: "Holiday Celebration!",
        message: eventMessage || "System Launch Celebration! Enjoy all movies for FREE today!",
        time: "Just Now",
        isNew: true,
        route: "/(tabs)/"
      };
      baseData = [eventNotif, ...baseData];
    }

    // Inject Active Downloads - throttled to only show meaningful progress or if tray is open
    const dlNotifications: Notification[] = Object.entries(activeDownloads)
      .filter(([id, dl]) => dl && dl.item)
      .map(([id, dl]) => {
        // Show progress in chunks or 100% to reduce re-renders
        const displayProgress = dl.progress === 100 ? 100 : Math.floor(dl.progress / 5) * 5;
        return {
          id: `dl_${id}`,
          type: "update",
          icon: "cloud-download",
          title: dl.progress === 100 ? "Download Complete!" : "Downloading...",
          message: `${dl.progress === 100 ? "Finished" : "Saving"} "${(dl as any)?.episodeTitle || dl.item?.title || 'Unknown'}" (${dl.progress}%)`,
          time: "ACTIVE",
          isNew: true,
          color: "#00ffcc",
          image: dl.item?.poster
        };
      });

    baseData = [...dlNotifications, ...baseData];

    return baseData;
  }, [liveMovies, liveSeries, announcements, allMoviesFree, eventMessage, activeDownloads, readIds]);

  const unreadCount = notifications.filter(n => !readIds.has(n.id)).length;

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("clearSeriesSearch", () => {
      setInPlaceSearchQuery("");
    });
    const sub2 = DeviceEventEmitter.addListener("openSearchOverlay", (data?: { autoFocus?: boolean }) => {
      // Force a re-trigger of focus by setting to false first if already true
      setSearchAutoFocus(false);
      setSearchVisible(true);
      if (data?.autoFocus) {
        setTimeout(() => setSearchAutoFocus(true), 50);
      }
    });
    const sub3 = DeviceEventEmitter.addListener("homeHeaderScroll", (y: number) => {
      setHomeScrollY(y);
      // Threshold: appear as the hero banner leaves the top area
      if (y > 360) { // Delayed threshold
        setIsHomeHeaderBlurred(true);
      } else {
        setIsHomeHeaderBlurred(false);
      }
    });
    const sub4 = DeviceEventEmitter.addListener("menuHeaderScroll", (y: number) => {
      setMenuScrollY(y);
      if (y > 50) {
        setIsMenuHeaderBlurred(true);
      } else {
        setIsMenuHeaderBlurred(false);
      }
    });

    const sub5 = DeviceEventEmitter.addListener("openSeriesLibrarySearch", (series: any) => {
      setReturnSeries(series);
      setShowInPlaceSearch(true);
      DeviceEventEmitter.emit("seriesSearchQuery", "");
    });

    const sub6 = DeviceEventEmitter.addListener("openNotifications", (data?: { highlightId: string }) => {
      setIsFromHero(true);

      // Direct Preview logic for Holiday Celebration if already read
      if (data?.highlightId === 'event_n1' && readIdsRef.current.has('event_n1')) {
        setShowEventPreview(true);
        return; // Don't show the notification list behind it
      }

      if (data?.highlightId) {
        setHighlightedId(data.highlightId);
      }
      setNotificationVisible(true);
    });

    return () => {
      sub.remove();
      sub2.remove();
      sub3.remove();
      sub4.remove();
      sub5.remove();
      sub6.remove();
    };
  }, []);

  useEffect(() => {
    const onBackPress = () => {
      if (showEventPreview) {
        setShowEventPreview(false);
        return true;
      }
      if (showInPlaceSearch) {
        setShowInPlaceSearch(false);
        setInPlaceSearchQuery("");
        DeviceEventEmitter.emit("seriesSearchClosed");
        Keyboard.dismiss();
        return true;
      }
      if (globalGridVisible) {
        setGlobalGridVisible(false);
        if (reopenOnBack) {
          setNotificationVisible(true);
          setReopenOnBack(false);
        }
        return true;
      }
      if (notificationVisible) {
        setNotificationVisible(false);
        return true;
      }
      if (searchVisible) {
        setSearchVisible(false);
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      onBackPress
    );

    return () => backHandler.remove();
  }, [showInPlaceSearch, notificationVisible, searchVisible, globalGridVisible, reopenOnBack, showEventPreview]);

  useEffect(() => {
    if (!active("/(tabs)/saved") && showInPlaceSearch) {
      setShowInPlaceSearch(false);
      setInPlaceSearchQuery("");
      DeviceEventEmitter.emit("seriesSearchClosed");
    }
  }, [segment, showInPlaceSearch]);

  useEffect(() => {
  }, []);

  const toggleCheckedItem = (id: string) => {
    setCheckedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };
  const [expandedType, setExpandedType] = useState<"movies" | "series" | "vjs" | null>(null);
  const [expandedNotificationId, setExpandedNotificationId] = useState<string | null>(null);
  const [reopenOnBack, setReopenOnBack] = useState(false);
  const [lastViewedItemId, setLastViewedItemId] = useState<string | null>(null);
  const [seriesCount, setSeriesCount] = useState<number | null>(null);
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  const TOTAL_LIVE_ITEMS = React.useMemo(() => {
    const combined = [...liveMovies, ...liveSeries];
    return Array.from(new Map(combined.map(item => [item.id, item])).values());
  }, [liveMovies, liveSeries]);

  // Premium Grid View State for Notifications
  const [globalGridVisible, setGlobalGridVisible] = useState(false);
  const [globalGridTitle, setGlobalGridTitle] = useState("");
  const [globalGridData, setGlobalGridData] = useState<(Movie | Series)[]>([]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("openRatingModal", () => {
      setSelectedRating(0);
      setIsRatingSubmitted(false);
      setShowRatingModal(true);
      setNotificationVisible(true);
    });
    const sub2 = DeviceEventEmitter.addListener("ratingDonePermanent", () => {
      setIsRatingPermanentlyRemoved(true);
    });
    const sub3 = DeviceEventEmitter.addListener("seriesCountUpdate", (count: number) => {
      setSeriesCount(count);
    });
    return () => {
      sub.remove();
      sub2.remove();
      sub3.remove();
    };
  }, []);

  // Auto-reopen overlay when returning home if navigate from sub-item
  useEffect(() => {
    if (reopenOnBack && path === "/(tabs)") {
      if (lastViewedItemId) {
        toggleCheckedItem(lastViewedItemId);
        setLastViewedItemId(null);
      }
      setNotificationVisible(true);
      setReopenOnBack(false);
    }
  }, [path, reopenOnBack, lastViewedItemId]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("previewClosed", () => {
      if (reopenOnBack) {
        if (lastViewedItemId) {
          toggleCheckedItem(lastViewedItemId);
          setLastViewedItemId(null);
        }
        setNotificationVisible(true);
        setReopenOnBack(false);
      }
    });
    const sub2 = DeviceEventEmitter.addListener("openLiveReleaseGrid", () => {
      setGlobalGridTitle("New Release");
      const combined = [...liveMovies, ...liveSeries].sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
      setGlobalGridData(combined);
      setGlobalGridVisible(true);
    });
    const sub3 = DeviceEventEmitter.addListener("setDetailStackVisible", (visible: boolean) => {
      setIsDetailStackVisible(visible);
    });

    return () => {
      sub.remove();
      sub2.remove();
      sub3.remove();
    };
  }, [reopenOnBack, lastViewedItemId, liveMovies, liveSeries]);

  useEffect(() => {
    notifications.forEach(item => {
      if (!readIds.has(item.id) && (item.moviesList || item.seriesList || item.vjsDetailed)) {
        const movies = (item.moviesList || []).filter(m => !checkedItemIds.has(m.id));
        const series = (item.seriesList || []).filter(s => !checkedItemIds.has(s.id));
        const vjs = (item.vjsDetailed || []).filter(v => !checkedItemIds.has(v.id));
        if (movies.length === 0 && series.length === 0 && vjs.length === 0) {
          markRead(item.id);
        }
      }
    });
  }, [checkedItemIds]);

  useEffect(() => {
    const startRotation = () => {
      // Sequence: Start at image (0), delay 10s -> Flip to text (0.5), delay 10s -> Flip to image (1 -> resets to 0)
      Animated.sequence([
        Animated.delay(9200), // Total 10s state (9.2s delay + 0.8s flip)
        Animated.timing(rotateAnim, {
          toValue: 0.5, // Flip halfway (180 deg) to show text
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.delay(9200), // Total 10s state (9.2s delay + 0.8s flip)
        Animated.timing(rotateAnim, {
          toValue: 1, // Complete the flip back to image (360 deg)
          duration: 800,
          useNativeDriver: true,
        }),
      ]).start(() => {
        rotateAnim.setValue(0); // Reset for infinite loop
        startRotation();
      });
    };
    startRotation();
  }, []);

  useEffect(() => {
    const pulseAnimation = () => {
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.3,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]).start(() => pulseAnimation());
    };
    pulseAnimation();
  }, []);

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"], // Full flip
  });

  const logoPulseScale = glowAnim.interpolate({
    inputRange: [0.3, 1],
    outputRange: [1, 1.15],
  });

  const logoOpacity = rotateAnim.interpolate({
    inputRange: [0, 0.249, 0.25, 0.75, 0.751, 1],
    outputRange: [1, 1, 0, 0, 1, 1],
  });

  const textOpacity = rotateAnim.interpolate({
    inputRange: [0, 0.249, 0.25, 0.75, 0.751, 1],
    outputRange: [0, 0, 1, 1, 0, 0],
  });

  // Segment logic moved to top of component

  const handleMarkRead = (id: string) => {
    markRead(id);
    if (id === "n2" && !isUpdateApplied) {
      setUpdateDismissCount((prev) => Math.min(prev + 1, 3));
    }
  };

  const handleMarkAllRead = () => {
    const allIds = notifications.map(n => n.id);
    markAllRead(allIds);
  };


  const onSelect = (item: Notification) => {
    if (item.id === "event_n1") {
      setShowEventPreview(true);
      return;
    }
    if (item.type === "rating") {
      setSelectedRating(0);
      setIsRatingSubmitted(false);
      setShowRatingModal(true);
      return;
    }
    if (item.id === "n2") {
      setIsUpdateApplied(true);
    }

    // Handle "K-Drama" or "New Release" collections
    const hasMovies = item.moviesList && item.moviesList.length > 0;
    const hasSeries = item.seriesList && item.seriesList.length > 0;
    const isTrendingVj = item.vjsDetailed && item.vjsDetailed.length > 0;

    if (item.title === "New Release" || item.title === "Trending Now" || item.title === "K-Drama" || isTrendingVj || item.id?.startsWith("live_new_")) {
      let gridData: (Movie | Series)[] = [];

      const movieIds = new Set(item.moviesList?.map(m => m.id) || []);
      const seriesIds = new Set(item.seriesList?.map(s => s.id) || []);

      if (item.id?.startsWith("live_new_")) {
        gridData = [...liveMovies, ...liveSeries];
      } else if (movieIds.size > 0 || seriesIds.size > 0) {
        // Collect specifically listed items first from TOTAL_LIVE_ITEMS for performance and accuracy
        gridData = TOTAL_LIVE_ITEMS.filter(m => movieIds.has(m.id) || seriesIds.has(m.id));
      } else if (isTrendingVj) {
        // Collect movies for all featured VJs only if no specific list is provided
        const vjNames = item.vjsDetailed?.map(v => v.name.toLowerCase()) || [];
        gridData = TOTAL_LIVE_ITEMS.filter(m => m.vj && vjNames.some(name => m.vj.toLowerCase().includes(name)));
      }

      if (gridData.length > 0) {
        setReopenOnBack(true);
        setGlobalGridTitle(item.title);
        setGlobalGridData(gridData);
        setGlobalGridVisible(true);
        // We keep notification visible in background so it doesn't "peep"
        return;
      }

    }

    if (item.movieId) {
      // 1. Close overlay first to ensure clean navigation transition
      setNotificationVisible(false);

      // 2. Delay navigation slightly to allow modal state cleanup and avoid stack conflicts
      setTimeout(() => {
        // Identify if it's a series or movie to navigate to the correct tab
        const targetItem = TOTAL_LIVE_ITEMS.find(m => m.id === item.movieId);
        const isSeries = targetItem && ("seasons" in targetItem || (targetItem as any).type === 'Series' || (targetItem as any).isMiniSeries);

        if (isSeries) {
          // Navigate to Series tab (saved) with reliable navigate() and ensure param is passed
          router.navigate({
            pathname: "/(tabs)/saved",
            params: { seriesId: item.movieId }
          } as any);
        } else {
          // Navigate to Home tab for movie preview
          router.navigate({
            pathname: "/(tabs)/",
            params: { movieId: item.movieId }
          } as any);
        }
      }, 100);
    } else if (item.sectionTitle) {
      setReopenOnBack(true);
      setNotificationVisible(false);
      // Switch to Home tab first then emit
      router.push("/(tabs)/");
      setTimeout(() => {
        DeviceEventEmitter.emit("sectionSelected", item.sectionTitle);
      }, 500);
    }
    else if (item.route) {
      router.push(item.route as any);
    }
  };

  const [isRatingSubmitted, setIsRatingSubmitted] = useState(false);

  const submitRating = async (rating: number) => {
    setIsRatingSubmitted(true);
    setIsRatingPermanentlyRemoved(true);

    // 1. Automated Notification Cleanup in Firestore
    try {
      const user = auth.currentUser;
      if (user) {
        const notifRef = collection(db, "users", user.uid, "notifications");
        const q = query(notifRef, where("type", "==", "rating"));
        const snapshot = await getDocs(q);
        snapshot.forEach(async (d) => {
          await deleteDoc(doc(db, "users", user.uid, "notifications", d.id));
        });
      }
    } catch (e) {
      console.error("Firestore cleanup failed", e);
    }

    // 2. Clear local states and redirect
    setTimeout(() => {
      markRead('n5'); // Mark as read ONLY on submission
      Linking.openURL("market://details?id=com.themoviezone247.official").catch(() => {
        Linking.openURL("https://play.google.com/store/apps/details?id=com.themoviezone247.official");
      });
      setShowRatingModal(false);
      setSelectedRating(0);
      setIsRatingSubmitted(false);
      setNotificationVisible(false);
    }, 1200);
  };

  return (
    <>
      <GridModal
        visible={globalGridVisible}
        title={globalGridTitle}
        data={globalGridData}
        onClose={() => {
          setGlobalGridVisible(false);
          if (reopenOnBack) {
            setNotificationVisible(true);
            setReopenOnBack(false);
          }
        }}
        onSelect={(m) => {
          const isSeries = "seasons" in m || (m as any).type === 'Series' || (m as any).isMiniSeries;
          if (isSeries) {
            setGlobalGridVisible(false);
            router.push(`/(tabs)/saved?seriesId=${m.id}`);
          } else {
            setGlobalGridVisible(false);
            if (reopenOnBack) {
              setNotificationVisible(false);
            }
            // Switch to Home tab to show preview
            router.push("/(tabs)/");
            // Emit to Home stack to show preview
            DeviceEventEmitter.emit("movieSelected", m);
          }
        }}
      />
      {/* Status Bar Guard (Synchronized with Header) */}
      {!isDetailStackVisible && playerMode !== 'full' && (
        <Animated.View 
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: insets.top,
            zIndex: 999,
            backgroundColor: "#0f0f19", // Solid background matching header exactly
            opacity: active("/") ? homeHeaderOpacity : (active("/menu") ? menuHeaderOpacity : 1),
            borderBottomWidth: (active("/") || active("/menu") || segment === "/" || segment === "/index" || segment === "/menu") ? 0 : StyleSheet.hairlineWidth,
            borderColor: (active("/") || active("/menu") || segment === "/" || segment === "/index" || segment === "/menu") ? "transparent" : "rgba(255,255,255,0.15)",
          }}
          pointerEvents="none"
        />
      )}

      {/* Background for 3-button nav */}
      {Platform.OS === 'android' && hasThreeButtonNav && !isDetailStackVisible && (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: showInPlaceSearch ? dynamicBarBottom : dynamicBarBottom + 29,
            overflow: 'hidden',
            zIndex: 998,
          }}
          pointerEvents="none"
        >
          <BlurView tint="dark" intensity={99} style={StyleSheet.absoluteFill} />
          <View style={styles.glassFill} />
        </View>
      )}

      {!searchVisible && !isDetailStackVisible && playerMode !== 'full' && (
        <View style={[
          styles.topBarWrapper,
          {
            top: Platform.OS === 'android' ? (StatusBar.currentHeight || insets.top) : 0,
            left: 0,
            right: 0,
            paddingTop: active("/") || active("/menu") ? 0 : 4,
            paddingHorizontal: 16,
          }
        ]}>
          {(active("/") || active("/menu")) && (
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                {
                  zIndex: -1,
                  opacity: active("/") ? homeHeaderOpacity : menuHeaderOpacity
                }
              ]}
            >
              <View
                style={[
                  StyleSheet.absoluteFill,
                  {
                    backgroundColor: "rgba(15, 15, 25, 0.98)",
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: "rgba(255, 255, 255, 0.15)"
                  }
                ]}
              />
              <LinearGradient
                colors={["rgba(15, 15, 25, 0.95)", "transparent"]}
                style={{
                  position: "absolute",
                  bottom: -12,
                  left: 0,
                  right: 0,
                  height: 12,
                }}
                pointerEvents="none"
              />
            </Animated.View>
          )}
          <View style={[
            styles.topBarContainer,
            (active("/(tabs)/saved") || active("/(tabs)/category")) && { paddingLeft: 4, paddingRight: 0 }
          ]}>
            {/* Logo replacement conditionally removed to allow pill expansion */}
            {!active("/(tabs)/saved") && !active("/(tabs)/category") && (
              <TouchableOpacity
                style={{
                  paddingHorizontal: 8,
                  height: 45,
                  justifyContent: "center",
                }}
                onPress={() => {
                  if (active("/")) {
                    DeviceEventEmitter.emit("homeTabPress");
                  } else {
                    router.push("/" as any);
                  }
                }}
                activeOpacity={0.8}
              >
                <View style={{ height: 45, alignItems: 'center', justifyContent: 'center' }}>
                  {/* FRONT SIDE (Logo) */}
                  <Animated.View 
                    style={{ 
                      opacity: logoOpacity, 
                      transform: [{ rotateY: rotation }],
                      backfaceVisibility: "hidden",
                      alignItems: 'center', 
                      justifyContent: 'center',
                      width: 45,
                      height: 45,
                      position: 'absolute'
                    }}
                  >
                    <Animated.View style={[styles.tabLogoGlowRing, { opacity: glowAnim, transform: [{ scale: logoPulseScale }] }]} />
                    <View style={[styles.navLogoShadow, { opacity: 1 }]}>
                      <View style={styles.navLogoCircle}>
                        <Animated.Image
                          source={require("@/assets/images/movie_zone_logo_new.png")}
                          style={[
                            styles.logoImage,
                            {
                              backfaceVisibility: "hidden",
                            },
                          ]}
                        />
                      </View>
                    </View>
                  </Animated.View>

                  {/* BACK SIDE (Text) */}
                  <Animated.View
                    style={[
                      {
                        position: "absolute",
                        width: 170,
                        height: 45,
                        left: -25, // Nudged further left to fill the icon gap
                        justifyContent: "center",
                        alignItems: "flex-start",
                        backfaceVisibility: "hidden",
                        backgroundColor: "transparent",
                        transform: [{ rotateY: "180deg" }, { rotateY: rotation }],
                        opacity: textOpacity,
                      },
                    ]}
                  >
                    <View>
                      <Text style={styles.navLogoTitle}>
                        THE MOVIE <Text style={{ color: '#818cf8' }}>ZONE</Text>
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 1 }}>
                        <LinearGradient 
                          colors={['#818cf8', 'rgba(129, 140, 248, 0.2)', 'transparent']} 
                          start={{ x: 0, y: 0 }} 
                          end={{ x: 1, y: 0 }} 
                          style={{ flex: 1, height: 1, marginRight: 6 }} 
                        />
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <ClockAnimation size={10} color="#ffffff" />
                          <Text style={styles.navLogoSub}>24 / 7</Text>
                        </View>
                      </View>
                    </View>
                  </Animated.View>
                </View>
              </TouchableOpacity>
            )}

            <View style={[
              styles.topBarRight,
              (active("/(tabs)/saved") || active("/(tabs)/category")) && { flex: 1, paddingLeft: 0, gap: 4 },
              (active("/") || active("/(tabs)/menu")) ? { transform: [{ translateX: 6 }] } : { transform: [{ translateX: 0 }] },
              { height: 45 }
            ]}>
              {/* All VJs / Series Library Pill (Repositioned) */}
              {active("/(tabs)/saved") ? (
                showInPlaceSearch ? (
                  <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
                    <TouchableOpacity
                      onPress={() => {
                        setShowInPlaceSearch(false);
                        setInPlaceSearchQuery("");
                        DeviceEventEmitter.emit("seriesSearchClosed");
                        Keyboard.dismiss();
                        if (returnSeries) {
                          const seriesToReturn = returnSeries;
                          setReturnSeries(null);
                          setTimeout(() => {
                            DeviceEventEmitter.emit("openSeriesPreview", seriesToReturn);
                          }, 150);
                        }
                      }}
                      style={styles.searchBackBtnSmall}
                    >
                      <Ionicons name="arrow-back" size={22} color="#fff" />
                    </TouchableOpacity>

                    <View style={{
                      flex: 1,
                      height: 35,
                      borderRadius: 17.5,
                      backgroundColor: 'rgba(255,255,255,0.06)',
                      flexDirection: 'row',
                      alignItems: 'center',
                      borderWidth: StyleSheet.hairlineWidth,
                      borderColor: 'rgba(255, 255, 255, 0.22)',
                      overflow: 'hidden',
                      marginRight: 0,
                    }}>
                      {Platform.OS === 'ios' ? (
                        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
                      ) : (
                        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255, 255, 255, 0.08)' }]} />
                      )}
                      <Ionicons
                        name="search"
                        size={15}
                        color="rgba(255,255,255,0.4)"
                        style={{ marginLeft: 12, marginRight: 6 }}
                      />
                      <TextInput
                        ref={inPlaceSearchRef}
                        style={[styles.universalSearchInput, { paddingHorizontal: 0, flex: 1 }]}
                        placeholder="Search series..."
                        placeholderTextColor="rgba(255,255,255,0.7)"
                        value={inPlaceSearchQuery}
                        onChangeText={(text) => {
                          setInPlaceSearchQuery(text);
                          DeviceEventEmitter.emit("seriesSearchQuery", text);
                        }}
                        returnKeyType="search"
                        multiline={false}
                        numberOfLines={1}
                        autoFocus={false}
                      />
                      {inPlaceSearchQuery.length > 0 && seriesCount !== null && (
                        <View style={{
                          flexDirection: "row",
                          alignItems: "center",
                          backgroundColor: "rgba(91,95,239,0.45)",
                          borderRadius: 12,
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          marginRight: 4,
                        }}>
                          <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 11, fontWeight: "800" }}>
                            {seriesCount}
                          </Text>
                        </View>
                      )}
                      {inPlaceSearchQuery.length > 0 && (
                        <TouchableOpacity
                          onPress={() => {
                            setInPlaceSearchQuery("");
                            DeviceEventEmitter.emit("seriesSearchQuery", "");
                          }}
                          style={{ padding: 8, marginRight: 4 }}
                        >
                          <Ionicons
                            name="close-circle"
                            size={18}
                            color="rgba(255,255,255,0.5)"
                          />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ) : (
                  <View
                    style={{
                      flex: 1, // Let the pill occupy the remaining space
                      height: 35,
                      paddingHorizontal: 16,
                      borderRadius: 17.5,
                      overflow: "hidden",
                      borderWidth: StyleSheet.hairlineWidth,
                      borderColor: "rgba(255,255,255,0.3)",
                      backgroundColor: "rgba(91, 95, 239, 0.25)",
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      shadowColor: "#5B5FEF",
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.45,
                      shadowRadius: 10,
                      elevation: 8,
                    }}
                  >
                    <View style={styles.pillSheen} />

                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Ionicons name="tv" size={14} color="#fff" />
                      <Text style={{
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: "800",
                        letterSpacing: 0.5,
                        textTransform: "uppercase",
                      }}>SERIES LIBRARY</Text>
                      {seriesCount !== null && (
                        <View style={{
                          backgroundColor: "rgba(255,255,255,0.2)",
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: 10,
                          marginLeft: 2
                        }}>
                          <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>{seriesCount} series</Text>
                        </View>
                      )}
                    </View>

                    <TouchableOpacity
                      onPress={() => DeviceEventEmitter.emit("toggleSeriesFilters")}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor: "rgba(255,255,255,0.2)",
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 12,
                      }}
                    >
                      <Ionicons name="options-outline" size={14} color="#fff" style={{ marginRight: 4 }} />
                      <Ionicons name="chevron-down" size={12} color="rgba(255,255,255,0.7)" />
                    </TouchableOpacity>
                  </View>
                )) : active("/(tabs)/category") ? null : (
                  <TouchableOpacity
                    style={styles.allVjsPill}
                    activeOpacity={0.8}
                    onPress={() => {
                      setSearchVjOnly(true);
                      setSearchVisible(true);
                    }}
                  >
                    <View style={styles.pillSheen} />
                    <Ionicons
                      name="people"
                      size={14}
                      color="#fff"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.allVjsPillText}>ALL VJs</Text>
                  </TouchableOpacity>
                )}


              {/* Hide the top bar search icon if the in-place search bar is active or on category tab */}
              {!(active("/(tabs)/saved") && showInPlaceSearch) && !active("/(tabs)/category") && (
                <View style={styles.searchBlurCapsule}>
                  <LinearGradient
                    colors={["rgba(255,255,255,0.15)", "transparent"]}
                    style={styles.pillSheen}
                  />
                  <TouchableOpacity
                    style={styles.searchTriggerBtn}
                    onPress={() => {
                      if (active("/(tabs)/saved")) {
                        if (showInPlaceSearch) {
                          setShowInPlaceSearch(false);
                          setInPlaceSearchQuery("");
                          DeviceEventEmitter.emit("seriesSearchClosed");
                          Keyboard.dismiss();
                        } else {
                          setShowInPlaceSearch(true);
                          DeviceEventEmitter.emit("resetSeriesFilters");
                          DeviceEventEmitter.emit("seriesSearchQuery", "");
                        }
                      } else {
                        setSearchVjOnly(false);
                        setSearchVisible(true);
                      }
                    }}
                  >
                    <Ionicons name="search" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}
              {!active("/(tabs)/category") && !isOverlayVisible && (
                <View style={styles.notificationBlurCapsule}>
                  <LinearGradient
                    colors={["rgba(255,255,255,0.15)", "transparent"]}
                    style={styles.pillSheen}
                  />
                  <TouchableOpacity
                    style={styles.topBarActionBtn}
                    onPress={() => setNotificationVisible(true)}
                  >
                    <Ionicons
                      name="notifications-outline"
                      size={18}
                      color="#fff"
                    />
                    {unreadCount > 0 && (
                      <View style={styles.notificationIndicator}>
                        <Text style={styles.notificationIndicatorText}>{unreadCount}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>
      )}

      <SearchOverlay
        visible={searchVisible}
        autoFocusRequested={searchAutoFocus}
        onClose={() => {
          setSearchVisible(false);
          setSearchVjOnly(false);
          setSearchAutoFocus(false);
        }}
        onSelect={(movie) => {
          const isActuallySeries =
            "seasons" in movie ||
            movie.type === "Series" ||
            (movie as any).isMiniSeries;

          if (isActuallySeries) {
            setShouldReopenSearch(true);
            setSearchVisible(false);
            setSearchVjOnly(false);
            setSearchAutoFocus(false);
            // Navigate to series detail (which is the saved tab)
            router.push(`/(tabs)/saved?seriesId=${movie.id}`);
          }
          else {
            // For movies, we close search so the preview (rendered in index.tsx) can show on top.
            // When preview closes, search will reopen via "previewClosed" listener.
            setShouldReopenSearch(true);
            setSearchVisible(false);
            setSearchVjOnly(false);
            setSearchAutoFocus(false);
            
            // Switch to Home tab to show preview
            router.push("/(tabs)/");
            
            // Emit to Home stack
            DeviceEventEmitter.emit("movieSelected", movie);
          }

        }}
        vjOnly={searchVjOnly}
      />


      <NotificationOverlay
        TOTAL_LIVE_ITEMS={TOTAL_LIVE_ITEMS}
        visible={notificationVisible}
        onClose={() => {
          setNotificationVisible(false);
          setIsFromHero(false);
        }}
        onSelect={onSelect}
        highlightedId={highlightedId}
        showRatingModal={showRatingModal}
        setShowRatingModal={setShowRatingModal}
        selectedRating={selectedRating}
        setSelectedRating={setSelectedRating}
        submitRating={submitRating}
        isRatingSubmitted={isRatingSubmitted}
        readIds={readIds}
        markRead={(id) => {
            markRead(id);
            if (id === 'n2') setUpdateDismissCount(3);
        }}
        checkedItemIds={checkedItemIds}
        toggleCheckedItem={toggleCheckedItem}
        expandedType={expandedType}
        setExpandedType={setExpandedType}
        expandedNotificationId={expandedNotificationId}
        setExpandedNotificationId={setExpandedNotificationId}
        setReopenOnBack={setReopenOnBack}
        setLastViewedItemId={setLastViewedItemId}
        isUpdateLocked={updateDismissCount >= 3}
        isUpdateApplied={isUpdateApplied}
        isRatingPermanentlyRemoved={isRatingPermanentlyRemoved}
        setGlobalGridVisible={setGlobalGridVisible}
        setGlobalGridTitle={setGlobalGridTitle}
        setGlobalGridData={setGlobalGridData}
        notifications={notifications}
        markAllRead={handleMarkAllRead}
        loading={loadingAnnouncements}
      />

      {/* ── Holiday Event Preview Modal ── */}
      {showEventPreview && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 50000 }]}>
          <BackHandlerListener 
            visible={showEventPreview} 
            onBack={() => {
              setShowEventPreview(false);
              return true;
            }} 
          />
        <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} />
        <SafeAreaView style={{ flex: 1, backgroundColor: 'rgba(10, 10, 15, 0.94)' }}>
          <View style={{ flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center' }}>
            <View
              style={{
                width: '100%',
                borderRadius: 24,
                padding: 32,
                backgroundColor: 'rgba(17, 24, 39, 0.98)',
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: 'rgba(255, 255, 255, 0.08)',
                alignItems: 'center',
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.4,
                shadowRadius: 20,
                elevation: 10,
              }}
            >
              <View style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: 'rgba(16, 185, 129, 0.4)',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 24,
              }}>
                <Ionicons name="gift" size={40} color="#10b981" />
              </View>

              <Text style={{
                color: '#fff',
                fontSize: 28,
                fontWeight: '900',
                textAlign: 'center',
                marginBottom: 16,
                letterSpacing: 0.5,
              }}>
                Holiday Celebration!
              </Text>

              <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
                <Text style={{
                  color: 'rgba(255, 255, 255, 0.9)',
                  fontSize: 18,
                  lineHeight: 28,
                  textAlign: 'center',
                  fontWeight: '500',
                }}>
                  {eventMessage || "Enjoy all movies for FREE today! We're celebrating our system launch with global free access for everyone. Start exploring now!"}
                </Text>
              </ScrollView>

              <View style={{ marginTop: 40, width: '100%' }}>
                <TouchableOpacity
                  onPress={() => {
                    setShowEventPreview(false);
                    if (isFromHero) {
                      setNotificationVisible(false);
                      setIsFromHero(false);
                    }
                  }}
                  style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    height: 54,
                    borderRadius: 27,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: 'rgba(16, 185, 129, 0.4)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: '#10b981', fontSize: 18, fontWeight: '800' }}>OK</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </SafeAreaView>
        </View>
      )}

      {!showInPlaceSearch && !isDetailStackVisible && playerMode === 'closed' && !isOverlayVisible && (
        <View style={[styles.barWrapper, { bottom: Platform.OS === 'ios' ? 28 : insets.bottom + 8 }]} pointerEvents="box-none">
          <BlurView tint="dark" intensity={99} style={StyleSheet.absoluteFill} />
          <View style={styles.glassFill} />
          <View style={styles.barInner}>
            {TABS.map((tab) => {
              const isFocused = active(tab.route);
              return (
                <TouchableOpacity
                  key={tab.name}
                  style={styles.tabItem}
                  onPress={() => {
                    if (isFocused && tab.name === "index") {
                      DeviceEventEmitter.emit("homeTabPress");
                    } else {
                      router.push(tab.route as never);
                    }
                  }}
                  activeOpacity={0.75}
                >
                  {isFocused ? (
                    <View style={styles.pill}>
                      <View style={styles.pillSheen} />
                      <Ionicons name={tab.iconActive} size={18} color="#fff" />
                      <Text style={styles.pillLabel} numberOfLines={1}>
                        {tab.label}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.inactiveIconWrap}>
                      <Ionicons
                        name={tab.icon}
                        size={22}
                        color="rgba(255,255,255,0.45)"
                      />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* In-place search handled inline in header */}


    </>
  );
}

// ─── Root Layout ─────────────────────────────────────────────────────────────
export default function TabLayout() {
  return (
    <Tabs
      tabBar={() => <CustomTabBar />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="saved" options={{ title: "Series" }} />
      <Tabs.Screen name="category" options={{ title: "Discover" }} />
      <Tabs.Screen name="menu" options={{ title: "Profile" }} />
    </Tabs>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  barWrapper: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 28 : 16,
    left: 16,
    right: 16,
    height: 58,
    borderRadius: 29,
    overflow: "hidden",
    // Glass border — thin white rim simulating glass edge
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.18)",
    // Multi-layer shadow for depth + lift
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 200,
    zIndex: 999, // Guarantee tab bar floats above all scrollable content
  },

  // Dark translucent glass fill
  glassFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,15,25,0.65)",
  },

  barInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: Platform.OS === "ios" ? 0 : 0,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: 46,
  },

  // ── Active pill ──
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 50,
    overflow: "hidden",
    // Deep indigo-purple matching reference style
    backgroundColor: "rgba(91, 95, 239, 0.25)",
    // Inner border — glass rim on the pill itself
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.3)",
    shadowColor: "#5B5FEF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
  },
  // Upper-half shine inside the pill to give it a glass bubble feel
  pillSheen: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "50%",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 50,
  },
  pillLabel: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  inactiveIconWrap: {
    padding: 6,
  },
  // ── Notification Overlay ──
  notificationOverlayContainer: {
    flex: 1,
    // Reduced padding to match standard sections; SafeAreaView handles the notch
    paddingTop: Platform.OS === "ios" ? 20 : 10,
    alignItems: "center",
  },
  notificationContent: {
    width: SCREEN_W * 0.9,
    maxHeight: "97%",
    backgroundColor: "rgba(17, 24, 39, 0.8)", // Design 1 influence (Dark Blue)
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  notificationHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  notificationTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
  },
  notificationCloseBtn: {
    padding: 6,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 15,
  },
  notificationCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.03)",
  },
  notificationTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
    marginRight: 8,
  },
  notificationCardNew: {
    backgroundColor: "rgba(16, 185, 129, 0.04)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(16, 185, 129, 0.15)",
    borderTopColor: "rgba(16, 185, 129, 0.45)", // Bright top edge
    marginVertical: 6,
    borderRadius: 16,
    marginHorizontal: 12,
    overflow: "hidden", // Clip absolute children strictly
  },
  notificationCardRead: {
    opacity: 0.55,
    backgroundColor: "rgba(255,255,255,0.02)",
    borderWidth: 0,
    marginVertical: 1,
  },
  notificationCardTitleRead: {
    color: "rgba(255,255,255,0.45)",
    fontWeight: "500",
  },
  notificationCardLocked: {
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    borderColor: "rgba(16, 185, 129, 0.4)",
    borderWidth: StyleSheet.hairlineWidth,
    marginVertical: 10,
    shadowColor: "#10b981",
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },
  notificationCardSheen: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "50%",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
  },
  notificationIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  notificationIconWrapNew: {
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 15,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(16, 185, 129, 0.5)",
  },
  notificationTextWrap: {
    flex: 1,
  },
  notificationCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  notificationCardTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  notificationTime: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 10,
    fontWeight: "600",
  },
  notificationMsg: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    lineHeight: 18,
  },
  newBadgePill: {
    backgroundColor: "#10b981",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginLeft: 10,
    overflow: "hidden",
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
    elevation: 8,
  },
  newBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  countBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.2)",
    marginLeft: 10,
  },
  countBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "900",
  },
  countBadgeTrending: {
    backgroundColor: "rgba(245, 158, 11, 0.18)",
    borderColor: "rgba(245, 158, 11, 0.4)",
  },
  countBadgeTrendingText: {
    color: "#f59e0b",
  },
  vjPillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  vjPill: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(16, 185, 129, 0.2)",
  },
  vjPillText: {
    color: "#10b981",
    fontSize: 11,
    fontWeight: "700",
  },
  typeBadgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 6,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  movieBadge: {
    backgroundColor: "rgba(14, 165, 233, 0.1)",
    borderColor: "rgba(14, 165, 233, 0.2)",
  },
  seriesBadge: {
    backgroundColor: "rgba(168, 85, 247, 0.1)",
    borderColor: "rgba(168, 85, 247, 0.2)",
  },
  movieBadgeText: {
    color: "#0ea5e9",
    fontSize: 11,
    fontWeight: "700",
  },
  seriesBadgeText: {
    color: "#a855f7",
    fontSize: 11,
    fontWeight: "700",
  },
  detailListContainer: {
    marginTop: 10,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 12,
    padding: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.05)",
  },
  detailListHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  detailListTitle: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  detailListItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.02)",
  },
  detailItemText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  checkBtn: {
    padding: 4,
  },
  // ── Rating Styles ──
  ratingContent: {
    alignItems: "center",
    paddingVertical: 40,
  },
  ratingTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 8,
  },
  ratingSub: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    marginBottom: 24,
  },
  submitRatingBtn: {
    backgroundColor: "#f59e0b",
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
    marginBottom: 20,
    shadowColor: "#f59e0b",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  submitRatingText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
  playStoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
    marginBottom: 10,
  },
  playStoreBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  starsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  starTouch: {
    padding: 4,
  },
  thankYouText: {
    color: "#10b981",
    fontWeight: "700",
    marginBottom: 20,
  },
  cancelRating: {
    padding: 12,
  },
  cancelRatingText: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 14,
    fontWeight: "600",
  },
  // ── Universal Top Bar ──
  topBarWrapper: {
    position: "absolute",
    zIndex: 1000,
    backgroundColor: "transparent",
    paddingBottom: 4,
  },
  topBarBlur: {
    borderRadius: 25,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.22)", // Sharper thin line
    borderBottomColor: "rgba(255,255,255,0.35)", // Slightly brighter bottom edge for separation
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },

  inPlaceSearchContainer: {
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(2, 2, 5, 0.85)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.22)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    width: "100%",
  },
  inPlaceSearchInput: {
    flex: 1,
    color: "#fff",
    fontSize: 15,
    paddingVertical: 0,
    fontWeight: "600",
  },

  searchBlurCapsule: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.22)",
    backgroundColor: "rgba(2, 2, 5, 0.85)",
  },
  notificationBlurCapsule: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.22)",
    backgroundColor: "rgba(2, 2, 5, 0.85)",
  },
  notificationIndicator: {
    position: 'absolute',
    top: 5,
    right: 5,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FF3B30', // Premium Apple Red
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(2, 2, 5, 1)', // Matches capsule background
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    paddingHorizontal: 2,
  },
  notificationIndicatorText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '900',
    textAlign: 'center',
  },
  topBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingLeft: 16,
    paddingRight: 2,
  },
  topBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  allVjsPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    height: 35,
    borderRadius: 17.5,
    overflow: "hidden",
    backgroundColor: "rgba(91, 95, 239, 0.25)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.3)",
    shadowColor: "#5B5FEF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
  },
  allVjsPillText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  navLogoShadow: {
    borderRadius: 22.5,
    shadowColor: '#1a5fa3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 8,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navLogoCircle: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(80,150,230,0.4)',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: {
    width: 45,
    height: 45,
    resizeMode: "cover",
    transform: [{ scale: 1.15 }],
  },
  tabLogoGlowRing: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'transparent',
    borderWidth: 2.5,
    borderColor: 'rgba(70,140,220,0.6)',
    shadowColor: '#4a8ce0',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 0,
    zIndex: -1,
  },
  tabLogoGlowRingSmall: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: 'rgba(70,140,220,0.6)',
    shadowColor: '#4a8ce0',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 0,
    zIndex: -1,
  },
  navLogoSmallCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    overflow: 'hidden',
    backgroundColor: '#0a0a0f',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(80,150,230,0.5)',
  },
  navLogoSmallImg: {
    width: '100%',
    height: '100%',
    transform: [{ scale: 1.25 }],
  },
  navLogoTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: 1,
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  navLogoSub: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "700",
    marginLeft: 3,
    letterSpacing: 1.5,
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  logoTextTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    letterSpacing: 0.5,
  },
  logoTextSubContainer: {
    marginTop: -2,
    paddingHorizontal: 3,
    paddingVertical: 0.5,
    borderRadius: 4,
    backgroundColor: "rgba(91, 95, 239, 0.25)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.3)",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#5B5FEF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
  },
  logoTextSubSheen: {
    position: "absolute",
    top: -20,
    left: -20,
    right: -20,
    bottom: -20,
    transform: [{ rotate: "45deg" }],
  },
  logoTextSub: {
    color: "#EFF1FF", // Brighter off-white for glass contrast
    fontSize: 8.5,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: 1.5,
    textShadowColor: "rgba(91, 95, 239, 0.8)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  searchTriggerBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  topBarActionBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  // ── Universal Search ──
  searchHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  searchBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  searchInputCapsule: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    height: 44,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.2)",
  },
  universalSearchInput: {
    flex: 1,
    color: "#fff",
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 0,
  },
  searchResultCard: {
    width: (SCREEN_W - 44) / 3, // 3 columns
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
  searchResultPoster: {
    width: "100%",
    height: 150, // Shorter for 3 columns
    resizeMode: "cover",
  },
  searchResultInfo: {
    padding: 6,
    alignItems: "center",
  },
  searchResultTitle: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 2,
  },
  searchResultMetadata: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 9,
    fontWeight: "600",
    textAlign: "center",
  },
  emptyResults: {
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 15,
    textAlign: "center",
  },
  // ── Discovery Screen ──
  discoverySection: {
    marginTop: 24,
  },
  discoveryHeader: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  discoverySwitcher: {
    flexDirection: "row",
    backgroundColor: "rgba(17, 24, 39, 0.6)",
    borderRadius: 50,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    padding: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
  switcherTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 7,
    borderRadius: 50,
  },
  switcherTabActive: {
    backgroundColor: "#5B5FEF", // Indigo Pill
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.2)",
  },
  discoveryPillSheen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 50,
  },
  switcherTabText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 13,
    fontWeight: "700",
  },
  switcherTabTextActive: {
    color: "#fff",
  },
  trendingWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 6,
    marginTop: 8,
  },
  discoveryChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 50,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.14)",
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  sectionHeaderBadge: {
    marginHorizontal: 16,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 50,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.25)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    backgroundColor: "#5B5FEF",
  },
  vjHeaderWrapper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    marginBottom: 20,
    width: "100%",
    paddingHorizontal: 16,
  },
  vjHeaderAnchorLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(91, 95, 239, 0.25)",
  },
  vjHeaderPill: {
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 50,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.4)",
    borderTopColor: "rgba(255,255,255,0.6)",
    shadowColor: "#5B5FEF",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 15,
    elevation: 12,
  },
  vjHeaderPillText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  vjGlassWell: {
    marginHorizontal: 16,
    borderRadius: 30,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.06)",
    paddingTop: 16,
    paddingBottom: 24,
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  rowTitle: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    textShadowColor: "rgba(0, 0, 0, 0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  resultsHeader: {
    paddingTop: 10,
    paddingBottom: 4,
  },
  filterBarScroll: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    height: 28,
    borderRadius: 50,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
  filterPillActive: {
    backgroundColor: "#5B5FEF",
    borderColor: "rgba(255,255,255,0.3)",
  },
  filterPillText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  filterPillTextActive: {
    color: "#fff",
  },
  resultsHeaderTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  clearFiltersBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    height: 28,
    borderRadius: 50,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(239, 68, 68, 0.2)",
  },
  clearFiltersText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  multiSelectionContainer: {
    gap: 0,
  },
  resultsCountText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  resultsCountBadge: {
    paddingHorizontal: 12,
    height: 28,
    borderRadius: 50,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
    flexDirection: "row",
    alignItems: "center",
  },
  filterCategoryContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  categoryBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    height: 28,
    borderRadius: 50,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
  },
  categoryBtnActive: {
    backgroundColor: "#5B5FEF",
    borderColor: "rgba(255,255,255,0.4)",
    shadowColor: "#5B5FEF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  categoryBtnText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  categoryBtnTextActive: {
    color: "#fff",
  },
  selectionTrayWrapper: {
    paddingBottom: 0,
    marginTop: -4,
  },
  seeAllBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#5B5FEF",
    paddingHorizontal: 12,
    height: 28,
    borderRadius: 50,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.3)",
    overflow: "hidden",
    shadowColor: "#5B5FEF",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 4,
  },
  yearCategoryTitle: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
    marginRight: 12,
  },
  yearSubToggle: {
    paddingHorizontal: 12,
    height: 30,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  yearSubToggleActive: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderColor: "rgba(255,255,255,0.3)",
  },
  yearSubToggleActiveNew: {
    backgroundColor: "rgba(16, 185, 129, 0.25)",
    borderColor: "rgba(16, 185, 129, 0.6)",
    shadowColor: "#10b981",
    shadowOpacity: 0.3,
  },
  yearSubToggleActiveOldest: {
    backgroundColor: "rgba(168, 162, 158, 0.2)",
    borderColor: "rgba(168, 162, 158, 0.4)",
    shadowColor: "#a8a29e",
    shadowOpacity: 0.2,
  },
  yearSubToggleText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  yearSubToggleTextActive: {
    color: "#fff",
  },
  yearSubToggleTextActiveNew: {
    color: "#10b981",
  },
  yearSubToggleTextActiveOldest: {
    color: "#a8a29e",
  },
  seeAllText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  trendingText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  genreDiscoverCard: {
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    minWidth: 110,
    alignItems: "center",
    justifyContent: "center",
  },
  genreDiscoverText: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  sectionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 10,
  },
  sectionPill: {
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
  },
  sectionPillText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    fontWeight: "600",
  },
  // ── Mini Movie Card ──
  miniMovieCard: {
    width: 100,
    gap: 8,
  },
  miniMoviePoster: {
    width: 100,
    height: 140,
    borderRadius: 12,
    backgroundColor: "#1a1a24",
  },
  miniMovieTitle: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },
  universalSearchTopPill: {
    position: "absolute",
    left: 16,
    right: 16,
    height: 46,
    borderRadius: 23,
    backgroundColor: "transparent",
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    zIndex: 1000,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  universalSearchBottomFilters: {
    paddingTop: 10,
    paddingBottom: 16,
    backgroundColor: "transparent",
    zIndex: 1000,
  },
  searchBackBtnSmall: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  searchInnerCapsule: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    height: 34,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 17,
    marginRight: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  genreBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.15)",
  },
  genreBadgeText: { color: "#fff", fontSize: 8, fontWeight: "900" },
  vjBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
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
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.15)",
  },
  epBadgeTextPremium: {
    color: "#FFC107",
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
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
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  // ── You May Also Like Horizontal Row ──
  youMayLikeCard: {
    width: 105,
  },
  youMayLikePosterContainer: {
    width: 105,
    height: 155,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
  },
  youMayLikePoster: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  youMayLikeTitle: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 8,
    paddingHorizontal: 2,
  },
  youMayLikeMeta: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 9,
    fontWeight: "600",
    marginTop: 2,
    paddingHorizontal: 2,
  },
  youMayLikeBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.15)",
  },
  youMayLikeBadgeText: {
    color: "#fff",
    fontSize: 7,
    fontWeight: "900",
  },
  youMayLikeSeriesBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    backgroundColor: "rgba(239, 68, 68, 0.8)",
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  youMayLikeSeriesBadgeText: {
    color: "#fff",
    fontSize: 7,
    fontWeight: "900",
  },
  gridDiscoveryContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 6,
    justifyContent: "space-between",
  },
  vjBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.15)",
  },
  vjBadgeText: { color: "#fff", fontSize: 8, fontWeight: "900" },
  genreBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.15)",
  },
  genreBadgeText: { color: "#fff", fontSize: 8, fontWeight: "900" },
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
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.15)",
  },
  epBadgeTextPremium: {
    color: "#FFC107",
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  markAllReadBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 8,
    marginRight: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
  },
  markAllReadText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 11,
    fontWeight: "700",
  },
});
