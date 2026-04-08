import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import GoogleCast, { CastContext, CastState, useCastState } from "react-native-google-cast";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Image,
  TouchableOpacity,
  Dimensions,
  Platform,
  StatusBar,
  TextInput,
  Modal,
  SafeAreaView,
  ScrollView,
  Animated,
  Keyboard,
  Alert,
  Linking,
  Share,
  KeyboardAvoidingView,
  Easing,
  DeviceEventEmitter,
  RefreshControl,
  Pressable,
  TouchableWithoutFeedback,
  PanResponder,
  BackHandler,
  LayoutAnimation,
  UIManager,
  useWindowDimensions,
  NativeModules,
} from "react-native";

// ─── Google Cast Safety Guard ────────────────────────────────────────────────
const CAN_CAST = (!!NativeModules.RNGCCastContext || !!NativeModules.RNGCastContext) && Platform.OS !== 'web';

function useSafeCastState() {
  if (!CAN_CAST) return null;
  try {
    return useCastState();
  } catch (e) {
    return null;
  }
}

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
      await NavigationBar.setBehaviorAsync('inset-touch');
    } else {
      await NavigationBar.setVisibilityAsync('visible');
    }
  } catch (e) {
    // console.log('NavigationBar native module not found. Rebuild your dev client.');
  }
};

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
import { useRouter } from "expo-router";
import { BlurView } from "expo-blur";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";
import * as ScreenOrientation from "expo-screen-orientation";
// import * as NavigationBar from 'expo-navigation-bar'; // Removed to prevent crash if native module is missing
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import {
  Series,
  Movie,
  ALL_SERIES,
  HERO_VIDEOS,
  ALL_GENRES,
  ALL_VJS,
  TRENDING_SERIES,
  MOST_VIEWED_SERIES,
  MOST_DOWNLOADED_SERIES,
  NEW_SERIES,
} from "@/constants/movieData";
import { useSubscription } from "@/app/context/SubscriptionContext";
import { useMovies } from "@/app/context/MovieContext";
import PremiumAccessModal from "../../components/PremiumAccessModal";
import PlanSelectionModal from "../../components/PlanSelectionModal";

const { width: W, height: SCREEN_H } = Dimensions.get("window");
const CARD_W = (W - 44) / 3;

const GENRES = ["All", ...ALL_GENRES];


// ─── Series Card ─────────────────────────────────────────────────────────────
function SeriesCard({ item, onPress }: { item: Series; onPress: () => void }) {
  const { isPaid } = useSubscription();
  const isLocked = !isPaid && !item.isFree;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View>
        <Image
          source={{ uri: item.poster }}
          style={styles.poster}
        />
        <View style={styles.vjBadge}>
          <Text style={styles.vjBadgeText}>{item.vj}</Text>
        </View>

        {isLocked && (
          <View style={styles.lockBadge}>
             <Ionicons name="lock-closed" size={9} color="#fff" />
          </View>
        )}
        <View style={styles.genreBadge}>
          <Text style={[styles.genreBadgeText, { color: "#fff" }]}>
            {item.isMiniSeries ? "Mini Series" : "Series"}
          </Text>
        </View>
        <View style={styles.epBadgePremium}>
          <Ionicons name="ellipsis-horizontal" size={10} color="#fff" style={{ marginRight: 2 }} />
          <Text style={styles.epBadgeTextPremium}>{item.episodes} EP</Text>
        </View>
      </View>
      <View style={styles.cardInfo}>
        <Text
          style={styles.cardTitle}
          numberOfLines={1}
        >
          {item.title}
        </Text>
        <Text
          style={styles.cardMetadata}
          numberOfLines={1}
        >
          {item.year} · {item.isMiniSeries ? "Mini Series" : `Season ${item.seasons}`}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const SERIES_CATEGORIES = [
  "All Series/Mini Series",
  "New Releases",
  "Trending Series",
  "Most Downloaded",
  "Korean Series",
  "Chinese Series",
  "Filipino Series",
  "Mini Series",
];

// ─── Series Screen ────────────────────────────────────────────────────────────
export default function SeriesScreen() {
  const router = useRouter();
  const { allSeries: ALL_SERIES, mostDownloadedSeries: MOST_DOWNLOADED_SERIES } = useMovies();
  const { recordExternalDownload } = useSubscription();
  const [activeBrowseFilter, setActiveBrowseFilter] =
    useState<string>("Status");
  const [query, setQuery] = useState("");
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("All Series/Mini Series");
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const { isGuest, allMoviesFree, subscriptionBundle } = useSubscription();

  useEffect(() => {
    const sub1 = DeviceEventEmitter.addListener("seriesSearchQuery", (q: string) => {
      setQuery(q);
      setIsSearchActive(true);
    });
    const movieSub = DeviceEventEmitter.addListener("movieSelected", (m: Movie | Series) => {
        setSeriesStack((prev) => [...prev, m as Series]);
    });
    const sub2 = DeviceEventEmitter.addListener("seriesSearchClosed", () => {
      setQuery("");
      setIsSearchActive(false);
    });
    const sub3 = DeviceEventEmitter.addListener("toggleSeriesFilters", () => {
      setIsFiltersVisible(prev => {
        if (!prev) {
          setActiveCategory("All Series/Mini Series");
        } else {
          setTimeout(() => {
            setSSelectedGenre(null);
            setSSelectedYear(null);
            setSSelectedVJ(null);
            setSSelectedStatus(null);
            setSSelectedSort(null);
            setSSelectedSeasons(null);
            DeviceEventEmitter.emit("clearSeriesSearch");
          }, 0);
        }
        return !prev;
      });
    });
    const sub4 = DeviceEventEmitter.addListener("openSeriesPreview", (s: Series) => {
      setSeriesStack([s]);
      setIsExternalSearch(true);
    });
    const sub5 = DeviceEventEmitter.addListener("openSeriesLibrarySearch", () => {
      setSeriesStack([]);
    });
    return () => {
      sub1.remove();
      sub2.remove();
      sub3.remove();
      sub4.remove();
      sub5.remove();
    };
  }, []);

  const [seriesStack, setSeriesStack] = useState<Series[]>([]);
  const [isExternalSearch, setIsExternalSearch] = useState(false);
  const [activeSection, setActiveSection] = useState<{
    title: string;
    data: Series[];
  } | null>(null);

  // Real Multi-Filters
  const [sSelectedGenre, setSSelectedGenre] = useState<string | null>(null);
  const [sSelectedYear, setSSelectedYear] = useState<string | null>(null);
  const [sSelectedVJ, setSSelectedVJ] = useState<string | null>(null);
  const [sSelectedStatus, setSSelectedStatus] = useState<string | null>(null);
  const [sSelectedSort, setSSelectedSort] = useState<string | null>(null);
  const [sSelectedSeasons, setSSelectedSeasons] = useState<string | null>(null);

  const [sYearCategory, setSYearCategory] = useState<'new' | 'oldest'>('new');
  const [isFiltersVisible, setIsFiltersVisible] = useState(false);

  const getFilteredResults = () => {
    let result = [...ALL_SERIES];

    // Search query takes precedence and searches across the entire library
    if (query.trim()) {
      const q = query.toLowerCase().trim();

      // 1. Smart Category Mapping
      if (q === "new releases") {
        result = [...ALL_SERIES].sort((a, b) => b.year - a.year);
      } else if (q === "trending series" || q === "trending") {
        result = [...ALL_SERIES].sort((a, b) => parseFloat(b.rating || "0") - parseFloat(a.rating || "0"));
      } else if (q === "most downloaded") {
        const mostDownloadedIds = new Set(MOST_DOWNLOADED_SERIES.map(m => m.id));
        result = ALL_SERIES.filter(s => mostDownloadedIds.has(s.id));
      } else {
        // 2. Multi-field search + Regional mapping
        result = result.filter(
          (s) =>
            s.title.toLowerCase().includes(q) ||
            s.genre.toLowerCase().includes(q) ||
            String(s.year).includes(q) ||
            s.vj.toLowerCase().includes(q) ||
            s.status.toLowerCase().includes(q) ||
            (q === "mini series" && s.isMiniSeries) ||
            (q === "series" && !s.isMiniSeries) ||
            // Regional keywords mapping to genre
            (q.includes("chinese") && s.genre.toLowerCase().includes("chinese")) ||
            (q.includes("filipino") && s.genre.toLowerCase().includes("filipino")) ||
            (q.includes("korean") && s.genre.toLowerCase().includes("korean"))
        );
      }
    } else {
      // Only apply category filtering if NOT searching
      if (activeCategory !== "All Series/Mini Series") {
        if (activeCategory === "New Releases") {
          result.sort((a, b) => b.year - a.year);
        } else if (activeCategory === "Trending Series") {
          result.sort((a, b) => parseFloat(b.rating || "0") - parseFloat(a.rating || "0"));
        } else if (activeCategory === "Most Downloaded") {
          const mostDownloadedIds = new Set(MOST_DOWNLOADED_SERIES.map(m => m.id));
          result = result.filter(s => mostDownloadedIds.has(s.id));
        } else if (activeCategory === "Korean Series") {
          result = result.filter(s => s.genre.toLowerCase().includes("korean"));
        } else if (activeCategory === "Chinese Series") {
          result = result.filter(s => s.genre.toLowerCase().includes("chinese"));
        } else if (activeCategory === "Filipino Series") {
          result = result.filter(s => s.genre.toLowerCase().includes("filipino"));
        } else if (activeCategory === "Mini Series") {
          result = result.filter(s => s.isMiniSeries === true);
        } else {
          result = result.filter(s => s.genre.toLowerCase().includes(activeCategory.toLowerCase()));
        }
      }
    }

    if (sSelectedGenre) {
      result = result.filter((s) => s.genre === sSelectedGenre);
    }
    if (sSelectedYear) {
      result = result.filter((s) => String(s.year) === sSelectedYear);
    }
    if (sSelectedVJ) {
      result = result.filter((s) => s.vj === sSelectedVJ);
    }
    if (sSelectedStatus) {
      if (sSelectedStatus === "Mini Series") {
        result = result.filter((s) => s.isMiniSeries === true);
      } else if (sSelectedStatus === "Series") {
        result = result.filter((s) => !s.isMiniSeries);
      } else {
        result = result.filter((s) => s.status === sSelectedStatus);
      }
    }

    if (sSelectedSeasons) {
      if (sSelectedSeasons === "1-30") {
        result = result.filter((s) => s.seasons >= 1 && s.seasons <= 30);
      } else {
        // Individual numeric season
        const seasonNum = parseInt(sSelectedSeasons);
        if (!isNaN(seasonNum)) {
          result = result.filter((s) => s.seasons === seasonNum);
        }
      }
    }

    if (sSelectedSort) {
      if (sSelectedSort === "Newest") {
        result.sort((a, b) => b.year - a.year);
      } else if (sSelectedSort === "Oldest") {
        result.sort((a, b) => a.year - b.year);
      } else if (sSelectedSort === "Trending") {
        result.sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating));
      }
    }

    return result;
  };

  const filtered = getFilteredResults();

  useEffect(() => {
    DeviceEventEmitter.emit("seriesCountUpdate", filtered.length);
  }, [filtered.length]);

  const clearFilters = () => {
    setSSelectedGenre(null);
    setSSelectedYear(null);
    setSSelectedVJ(null);
    setSSelectedStatus(null);
    setSSelectedSort(null);
    setSSelectedSeasons(null);
    setQuery("");
    setActiveCategory("All Series/Mini Series");
    DeviceEventEmitter.emit("clearSeriesSearch");
  };

  const hasActiveFilters = !!(sSelectedGenre || sSelectedYear || sSelectedVJ || sSelectedStatus || sSelectedSort || sSelectedSeasons);

  const [showCategories, setShowCategories] = useState(true);
  const activityTimer = useRef<any>(null);
  const categoriesAnim = useRef(new Animated.Value(1)).current;

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    // Simulate refresh delay
    setTimeout(() => {
      setRefreshing(false);
    }, 1500);
  }, []);

  useEffect(() => {
    Animated.timing(categoriesAnim, {
      toValue: showCategories ? 1 : 0,
      duration: 350,
      useNativeDriver: false,
    }).start();
  }, [showCategories]);

  const resetActivityTimer = () => {
    setShowCategories(prev => {
      if (!prev) return true;
      return prev;
    });
    if (activityTimer.current) {
      clearTimeout(activityTimer.current);
    }
    activityTimer.current = setTimeout(() => {
      setShowCategories(false);
    }, 10000);
  };

  useEffect(() => {
    resetActivityTimer();
    return () => {
      if (activityTimer.current) clearTimeout(activityTimer.current);
    };
  }, []);

  return (
    <View 
      style={styles.container}
      onStartShouldSetResponderCapture={() => {
        resetActivityTimer();
        return false;
      }}
      onMoveShouldSetResponderCapture={() => {
        resetActivityTimer();
        return false;
      }}
    >
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      {/* Spacer for header - reduced to align categories directly below header pill */}
      <View style={{ paddingTop: Platform.OS === "android" ? StatusBar.currentHeight! + 48 : 40, paddingBottom: 0 }} />

      {/* Categories Horizontal Scroll - Hidden if searching or filters visible */}
      {!isFiltersVisible && !query && !isSearchActive && (
        <Animated.View style={{ 
          opacity: categoriesAnim,
          maxHeight: categoriesAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 100]
          }),
          overflow: "hidden"
        }}>
          <View style={{ paddingBottom: 2 }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
            >
              {SERIES_CATEGORIES.map((category) => (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.browseFilterPill,
                    activeCategory === category && { backgroundColor: '#5B5FEF', borderColor: 'rgba(255,255,255,0.3)' }
                  ]}
                  onPress={() => setActiveCategory(category)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.browseFilterPillText,
                      activeCategory === category && { color: '#fff', fontWeight: '800' }
                    ]}
                  >
                    {category}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Animated.View>
      )}

      {/* Clear Filters below header if active and filters hidden */}
      {hasActiveFilters && !isFiltersVisible && (
        <View style={{ paddingHorizontal: 16, marginBottom: 12, flexDirection: 'row', justifyContent: 'flex-start' }}>
          <TouchableOpacity
            style={[styles.browseFilterPill, { backgroundColor: 'rgba(239, 68, 68, 0.12)', borderColor: 'rgba(239, 68, 68, 0.3)' }]}
            onPress={clearFilters}
          >
            <Ionicons name="close-circle" size={12} color="#ef4444" style={{ marginRight: 4 }} />
            <Text style={[styles.browseFilterPillText, { color: '#ef4444', fontWeight: '800' }]}>Clear</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Expanded Filter Area - Hidden if searching */}
      {isFiltersVisible && !query && !isSearchActive && (
        <View style={[styles.filterWrap, { paddingTop: 0 }]}>
          {/* Primary filter tabs (Top Pills) */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterListPrimary}
          >
            {hasActiveFilters && (
              <TouchableOpacity
                style={[styles.browseFilterPill, { backgroundColor: 'rgba(239, 68, 68, 0.12)', borderColor: 'rgba(239, 68, 68, 0.3)', marginRight: 8 }]}
                onPress={clearFilters}
              >
                <Ionicons name="close-circle" size={14} color="#ef4444" style={{ marginRight: 4 }} />
                <Text style={[styles.browseFilterPillText, { color: '#ef4444', fontWeight: '900' }]}>Clear</Text>
              </TouchableOpacity>
            )}

            {["VJ,s", "Type", "Seasons", "Sort", "Genre", "Year"].map((filter) => {
              const isActive = activeBrowseFilter === filter;
              let label = filter;
              let hasValue = false;
              // Map "Status" logic to "Type" label
              if (filter === "VJ,s" && sSelectedVJ) { label = sSelectedVJ; hasValue = true; }
              if (filter === "Type" && sSelectedStatus) { label = sSelectedStatus; hasValue = true; }
              if (filter === "Seasons" && sSelectedSeasons) { 
                label = sSelectedSeasons === "1-30" ? "1-30" : `Season ${sSelectedSeasons}`; 
                hasValue = true; 
              }
              if (filter === "Genre" && sSelectedGenre) { label = sSelectedGenre; hasValue = true; }
              if (filter === "Year" && sSelectedYear) { label = sSelectedYear; hasValue = true; }
              if (filter === "Sort" && sSelectedSort) { label = sSelectedSort; hasValue = true; }

              return (
                <TouchableOpacity
                  key={filter}
                  style={[
                    styles.browseFilterPill,
                    { flexDirection: 'row', alignItems: 'center', gap: 6 },
                    (isActive || hasValue) && { backgroundColor: '#5B5FEF', borderColor: 'rgba(255,255,255,0.3)' },
                  ]}
                  activeOpacity={0.7}
                  onPress={() => setActiveBrowseFilter(isActive ? "" : filter)}
                >
                  <Text
                    style={[
                      styles.browseFilterPillText,
                      (isActive || hasValue) && { color: '#fff', fontWeight: '800' },
                    ]}
                  >
                    {label}
                  </Text>
                  <Ionicons 
                    name="chevron-down" 
                    size={10} 
                    color={(isActive || hasValue) ? "#fff" : "rgba(255,255,255,0.5)"} 
                  />
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Chip Selection Area - Only render if a valid filter category is active */}
          {["VJ,s", "Type", "Seasons", "Sort", "Genre", "Year"].includes(activeBrowseFilter) && (
            <View style={styles.chipSelectionArea}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterListSecondary}
            >
              {activeBrowseFilter === "Type"
                ? ["Series", "Mini Series"].map((st) => (
                    <TouchableOpacity
                      key={st}
                      style={[styles.filterChip, sSelectedStatus === st && styles.filterChipActive]}
                      onPress={() => setSSelectedStatus(sSelectedStatus === st ? null : st)}
                    >
                      <Text style={[styles.filterChipText, sSelectedStatus === st && styles.filterChipTextActive]}>{st}</Text>
                    </TouchableOpacity>
                  ))
                : activeBrowseFilter === "Seasons"
                  ? Array.from({ length: 30 }, (_, i) => String(i + 1)).map((num) => (
                      <TouchableOpacity
                        key={num}
                        style={[styles.filterChip, sSelectedSeasons === num && styles.filterChipActive]}
                        onPress={() => setSSelectedSeasons(sSelectedSeasons === num ? null : num)}
                      >
                        <Text style={[styles.filterChipText, sSelectedSeasons === num && styles.filterChipTextActive]}>Season {num}</Text>
                      </TouchableOpacity>
                    ))
                  : activeBrowseFilter === "Year"
                  ? (
                    <View style={{ flexDirection: 'column', gap: 10 }}>
                      <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 4 }}>
                        <TouchableOpacity
                          onPress={() => setSYearCategory('new')}
                          style={[
                            styles.filterChip,
                            { paddingHorizontal: 12, height: 28 },
                            sYearCategory === 'new' && { backgroundColor: '#5B5FEF', borderColor: 'rgba(255,255,255,0.3)' }
                          ]}
                        >
                          <Text style={[styles.filterChipText, sYearCategory === 'new' && { color: '#fff', fontWeight: '800' }]}>NEW</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => setSYearCategory('oldest')}
                          style={[
                            styles.filterChip,
                            { paddingHorizontal: 12, height: 28 },
                            sYearCategory === 'oldest' && { backgroundColor: '#ef4444', borderColor: 'rgba(255,255,255,0.3)' }
                          ]}
                        >
                          <Text style={[styles.filterChipText, sYearCategory === 'oldest' && { color: '#fff', fontWeight: '800' }]}>OLDEST</Text>
                        </TouchableOpacity>
                      </View>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                        {(sYearCategory === 'new'
                          ? Array.from({ length: 2026 - 2020 + 1 }, (_, i) => String(2026 - i))
                          : Array.from({ length: 2019 - 1975 + 1 }, (_, i) => String(2019 - i))
                        ).map((yr) => (
                          <TouchableOpacity
                            key={yr}
                            style={[styles.filterChip, sSelectedYear === yr && styles.filterChipActive]}
                            onPress={() => setSSelectedYear(sSelectedYear === yr ? null : yr)}
                          >
                            <Text style={[styles.filterChipText, sSelectedYear === yr && styles.filterChipTextActive]}>{yr}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )
                  : activeBrowseFilter === "Genre"
                    ? ALL_GENRES.map((g) => (
                        <TouchableOpacity
                          key={g}
                          style={[styles.filterChip, sSelectedGenre === g && styles.filterChipActive]}
                          onPress={() => setSSelectedGenre(sSelectedGenre === g ? null : g)}
                        >
                          <Text style={[styles.filterChipText, sSelectedGenre === g && styles.filterChipTextActive]}>{g}</Text>
                        </TouchableOpacity>
                      ))
                    : activeBrowseFilter === "VJ,s"
                    ? ALL_VJS.slice(0, 12).map((vj) => (
                        <TouchableOpacity
                          key={vj}
                          style={[styles.filterChip, sSelectedVJ === vj && styles.filterChipActive]}
                          onPress={() => setSSelectedVJ(sSelectedVJ === vj ? null : vj)}
                        >
                          <Text style={[styles.filterChipText, sSelectedVJ === vj && styles.filterChipTextActive]}>{vj}</Text>
                        </TouchableOpacity>
                      ))
                      : activeBrowseFilter === "Sort"
                        ? ["Newest", "Oldest", "Trending"].map((srt) => (
                            <TouchableOpacity
                              key={srt}
                              style={[styles.filterChip, sSelectedSort === srt && styles.filterChipActive]}
                              onPress={() => setSSelectedSort(sSelectedSort === srt ? null : srt)}
                            >
                              <Text style={[styles.filterChipText, sSelectedSort === srt && styles.filterChipTextActive]}>{srt}</Text>
                            </TouchableOpacity>
                          ))
                        : null}
            </ScrollView>
          </View>
        )}
      </View>
      )}

      {/* Grid */}
      <FlatList
        data={filtered}
        keyExtractor={(s) => s.id}
        numColumns={3}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#5B5FEF"
            colors={["#5B5FEF", "#818cf8"]}
            progressBackgroundColor="#1e293b"
          />
        }
        contentContainerStyle={[styles.grid, { paddingBottom: 110 }]}
        columnWrapperStyle={styles.gridRow}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={Platform.OS === "android"}
        initialNumToRender={12}
        maxToRenderPerBatch={6}
        windowSize={5}
        renderItem={({ item }) => (
          <SeriesCard item={item} onPress={() => {
            setSeriesStack([item]);
            setIsExternalSearch(false);
          }} />
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="tv-outline" size={48} color="#1e293b" />
            <Text style={styles.emptyText}>No series found</Text>
          </View>
        }
      />

      {/* Series Preview Modal Stack */}
      {seriesStack.map((series, index) => (
        <SeriesPreviewModal
          key={`${series.id}-${index}`}
          series={series}
          onClose={() => {
            setSeriesStack(prev => {
              const newStack = [...prev];
              newStack.splice(index, 1);
              if (newStack.length === 0 && isExternalSearch) {
                setIsExternalSearch(false);
                router.back();
              }
              return newStack;
            });
          }}
          onSwitch={(s) => setSeriesStack(prev => [...prev, s])}
          onSeeAll={(title, data) => setActiveSection({ title, data })}
          isMuted={index !== seriesStack.length - 1}
          onShowPremium={() => setShowPremiumModal(true)}
        />
      ))}

      {/* Series Grid Modal */}
      <SeriesGridModal
        visible={!!activeSection}
        title={activeSection?.title ?? ""}
        data={activeSection?.data ?? []}
        onClose={() => setActiveSection(null)}
        onSelect={(s) => {
          setActiveSection(null);
          setTimeout(() => {
            setSeriesStack(prev => [...prev, s]);
            setIsExternalSearch(false);
          }, 300);
        }}
      />
      
      <PremiumAccessModal
        visible={showPremiumModal}
        isGuest={isGuest}
        onClose={() => setShowPremiumModal(false)}
        onLogin={() => {
          setShowPremiumModal(false);
          router.push("/login" as any);
        }}
        onUpgrade={() => {
          setShowPremiumModal(false);
          setShowPlanModal(true);
        }}
        onSocialLogin={(provider) => {
          setShowPremiumModal(false);
          router.push("/login" as any);
        }}
      />

      <PlanSelectionModal 
        visible={showPlanModal}
        onClose={() => setShowPlanModal(false)}
      />
    </View>
  );
}
// ─── Playing Now Indicator Component ──────────────────────────────────────────
const PlayingNowIndicator = () => {
  const anim1 = useRef(new Animated.Value(0.4)).current;
  const anim2 = useRef(new Animated.Value(0.7)).current;
  const anim3 = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const createAnim = (val: Animated.Value, duration: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(val, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(val, { toValue: 0.3, duration, easing: Easing.linear, useNativeDriver: true }),
        ])
      );
    };
    const a1 = createAnim(anim1, 500);
    const a2 = createAnim(anim2, 700);
    const a3 = createAnim(anim3, 600);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, []);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 12, gap: 2, marginRight: 4 }}>
        <Animated.View style={{ width: 2, backgroundColor: '#e11d48', height: 12, transform: [{ scaleY: anim1 }] }} />
        <Animated.View style={{ width: 2, backgroundColor: '#e11d48', height: 12, transform: [{ scaleY: anim2 }] }} />
        <Animated.View style={{ width: 2, backgroundColor: '#e11d48', height: 12, transform: [{ scaleY: anim3 }] }} />
      </View>
      <Text style={{ color: '#e11d48', fontSize: 13, fontWeight: '800', letterSpacing: 0.5 }}>PLAYING NOW</Text>
    </View>
  );
};

// ─── Full Video Player Modal ──────────────────────────────────────────────────
function FullVideoPlayerModal({
  visible,
  videoUrl,
  title,
  onClose,
  onNext,
  onPrev,
  hasNext,
  hasPrev,
  nextEpisodeName,
  episodes = [],
  activeEpisodeId,
  onSelectEpisode,
  relatedSeries = [],
  onSelectRelated,
  seriesVj,
  seriesEpisodeDuration,
}: {
  visible: boolean;
  videoUrl?: string;
  title: string;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
  nextEpisodeName?: string;
  episodes?: any[];
  activeEpisodeId?: string;
  onSelectEpisode?: (ep: any) => void;
  relatedSeries?: Series[];
  onSelectRelated?: (series: Series) => void;
  seriesVj?: string;
  seriesEpisodeDuration?: string;
}) {
  // Force landscape layout regardless of immediate window dimensions
  const isPortrait = false; 

  const videoRef = useRef<Video>(null);
  const [status, setStatus] = useState<AVPlaybackStatus>({} as AVPlaybackStatus);
  const statusRef = useRef<AVPlaybackStatus>({} as AVPlaybackStatus);
  const [showControls, setShowControls] = useState(true);
  const showControlsRef = useRef(true);
  const controlsTimeout = useRef<any>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const scrubbingRef = useRef(false);
  const [scrubPosition, setScrubPosition] = useState(0);
  const scrubPositionRef = useRef(0);
  const [scrubStartPos, setScrubStartPos] = useState(0);
  const scrubStartPosRef = useRef(0);
  const progressBarWidth = useRef(0);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [isLocked, setIsLocked] = useState(false);
  const [sleepTimerMs, setSleepTimerMs] = useState(0);
  const [showTimerOptions, setShowTimerOptions] = useState(false); // 0 = off
  const [showEpisodesOverlay, setShowEpisodesOverlay] = useState(false);
  const [showRelatedOverlay, setShowRelatedOverlay] = useState(false);
  const [showSpeedOverlay, setShowSpeedOverlay] = useState(false);
  const insets = useSafeAreaInsets();
  
  const lockPulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isLocked) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(lockPulseAnim, {
            toValue: 1.08,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(lockPulseAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      lockPulseAnim.setValue(1);
    }
  }, [isLocked]);

  const formatTime = (ms: number) => {
    if (!ms || ms < 0) return "0:00";
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const handleTogglePlay = () => {
    if (isLocked) return;
    if (status.isLoaded) {
      if (status.isPlaying) {
        videoRef.current?.pauseAsync();
      } else {
        // If it was already finished, replay from 0
        if (status.positionMillis === status.durationMillis) {
          videoRef.current?.replayAsync();
        } else {
          videoRef.current?.playAsync();
        }
      }
    }
    resetControlsTimer();
  };

  const resetControlsTimer = () => {
    setShowControls(true);
    showControlsRef.current = true;
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    controlsTimeout.current = setTimeout(() => {
      setShowControls(false);
      showControlsRef.current = false;
    }, 3000);
  };

  const handleToggleControls = () => {
    if (showControlsRef.current) {
      setShowControls(false);
      showControlsRef.current = false;
      if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    } else {
      resetControlsTimer();
    }
  };

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    videoRef.current?.setIsMutedAsync(next);
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

  const handleToggleSpeed = () => {
    setShowSpeedOverlay(true);
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
  };

  const handleSelectSpeed = (rate: number) => {
    setPlaybackSpeed(rate);
    videoRef.current?.setRateAsync(rate, true);
    setShowSpeedOverlay(false);
    resetControlsTimer();
  };

  const handleToggleLock = () => {
    const next = !isLocked;
    setIsLocked(next);
    resetControlsTimer();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSetSleepTimer = () => {
    setShowTimerOptions(true);
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
  };

  const selectSleepTimer = (minutes: number) => {
    setSleepTimerMs(minutes * 60 * 1000);
    setShowTimerOptions(false);
    resetControlsTimer();
  };

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

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (isLocked) return false;
        return Math.abs(gestureState.dx) > 20; 
      },
      onPanResponderGrant: (evt, gestureState) => {
        const currentStatus = statusRef.current;
        if (currentStatus.isLoaded) {
          const current = currentStatus.positionMillis || 0;
          scrubStartPosRef.current = current;
          scrubPositionRef.current = current;
          setScrubPosition(current);
          setIsScrubbing(true);
          scrubbingRef.current = true;
        }
        resetControlsTimer();
      },
      onPanResponderMove: (evt, gestureState) => {
        const currentStatus = statusRef.current;
        if (currentStatus.isLoaded && currentStatus.durationMillis && progressBarWidth.current > 0) {
          const sensitivity = 1.0;
          const delta = (gestureState.dx / progressBarWidth.current) * currentStatus.durationMillis * sensitivity;
          const newPos = Math.max(0, Math.min(currentStatus.durationMillis, (scrubStartPosRef.current || 0) + delta));
          scrubPositionRef.current = newPos;
          setScrubPosition(newPos);
          resetControlsTimer();
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (statusRef.current.isLoaded && scrubbingRef.current) {
          videoRef.current?.setPositionAsync(scrubPositionRef.current);
        }
        setIsScrubbing(false);
        scrubbingRef.current = false;
      },
      onPanResponderTerminate: () => {
        setIsScrubbing(false);
        scrubbingRef.current = false;
      },
    })
  ).current;

  useEffect(() => {
    const backAction = () => {
      if (showEpisodesOverlay) {
        setShowEpisodesOverlay(false);
        resetControlsTimer();
        return true;
      }
      if (showRelatedOverlay) {
        setShowRelatedOverlay(false);
        resetControlsTimer();
        return true;
      }
      if (showSpeedOverlay) {
        setShowSpeedOverlay(false);
        resetControlsTimer();
        return true;
      }
      if (showTimerOptions) {
        setShowTimerOptions(false);
        resetControlsTimer();
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction
    );

    return () => backHandler.remove();
  }, [showEpisodesOverlay, showRelatedOverlay, showSpeedOverlay, showTimerOptions]);

  useEffect(() => {
    if (visible && activeEpisodeId) {
      videoRef.current?.replayAsync();
    }
  }, [activeEpisodeId, visible]);

  useEffect(() => {
    const toggleOrientation = async () => {
      if (visible) {
        // Force Landscape strictly
        if (Platform.OS !== "web") {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        }
        StatusBar.setHidden(true, 'fade');
        await safeSetNavigationBar('hidden');
      } else {
        if (Platform.OS !== "web") {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        }
        StatusBar.setHidden(false, 'fade');
        await safeSetNavigationBar('visible');
      }
    };
    toggleOrientation();

    if (visible) {
      resetControlsTimer();
    }
    return () => {
      if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
      if (Platform.OS !== "web") {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      }
      StatusBar.setHidden(false, 'fade');
      safeSetNavigationBar('visible');
    };
  }, [visible]);

  if (!visible) return null;

  const currentPos = isScrubbing ? scrubPosition : (status.isLoaded ? status.positionMillis : 0);
  const duration = status.isLoaded ? (status.durationMillis || 0) : 0;
  const progressPercent = duration > 0 ? (currentPos / duration) * 100 : 0;

  return (
    <Modal 
      visible={visible} 
      animationType="fade" 
      transparent 
      statusBarTranslucent
      navigationBarTranslucent
      supportedOrientations={['landscape', 'landscape-left', 'landscape-right']}
      onRequestClose={onClose}
    >
      <View style={styles.fullPlayerContainer}>
        <TouchableWithoutFeedback onPress={handleToggleControls}>
          <View 
            style={styles.fullPlayerInner} 
            {...panResponder.panHandlers}
            onLayout={(e) => progressBarWidth.current = e.nativeEvent.layout.width}
          >
            <View style={styles.fullPlayerVideoWrapper} pointerEvents="box-none">
              <Video
                ref={videoRef}
                source={{ uri: videoUrl || "" }}
                style={styles.fullPlayerVideo}
                resizeMode={ResizeMode.COVER}
                shouldPlay
                onPlaybackStatusUpdate={s => {
                  setStatus(s);
                  statusRef.current = s;
                  
                  // Auto-play logic
                  if (s.isLoaded && s.isPlaying && s.durationMillis && hasNext && onNext) {
                    const remaining = s.durationMillis - s.positionMillis;
                    if (remaining <= 500 && s.isPlaying) {
                       // Episode finished or very close to it
                       onNext();
                    }
                  }
                }}
                useNativeControls={false}
              />

              {showControls && (
                <View style={[
                  styles.playerControlsOverlay, 
                  { 
                    pointerEvents: 'box-none',
                    paddingLeft: Math.max(insets.left, 16),
                    paddingRight: Math.max(insets.right, 16),
                    paddingBottom: Math.max(insets.bottom, 16)
                  }
                ]}>
                  <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                  
                  {/* Header */}
                  {!isLocked && (
                    <View style={[styles.playerHeader, isPortrait && { flexDirection: 'column', alignItems: 'center', paddingTop: 20 }, { pointerEvents: 'box-none' }]}>
                      {/* Top Row for Portrait / Single Row for Landscape */}
                      <View style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                        <TouchableOpacity onPress={onClose} style={styles.playerBackBtn}>
                          <Ionicons name="arrow-back" size={24} color="#fff" />
                        </TouchableOpacity>
                        
                        {!isPortrait && (
                          <View style={styles.playerTitleContainer} pointerEvents="none">
                            <Text style={styles.playerTitle} numberOfLines={1}>{title}</Text>
                          </View>
                        )}

                        <View style={styles.playerHeaderRightIcons}>
                          <TouchableOpacity onPress={handleSetSleepTimer} style={[styles.playerHeaderIconBtn, { width: 'auto', paddingHorizontal: 10 }]}>
                            <Ionicons 
                              name="alarm-outline" 
                              size={22} 
                              color={sleepTimerMs > 0 ? "#e11d48" : "#fff"} 
                            />
                            <View style={{ alignItems: 'center' }}>
                              <Text style={styles.playerBtnLabel} numberOfLines={1}>Sleep Timer</Text>
                              {sleepTimerMs > 0 && (
                                <Text style={styles.sleepTimerBadgeText}>
                                  {Math.ceil(sleepTimerMs / 60000)}m
                                </Text>
                              )}
                            </View>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={resetControlsTimer} style={[styles.playerHeaderIconBtn, { width: 'auto', paddingHorizontal: 10 }]}>
                            <MaterialCommunityIcons name="cast" size={22} color="#fff" />
                            <Text style={styles.playerBtnLabel} numberOfLines={1}>AirPlay</Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Title Row for Portrait */}
                      {isPortrait && (
                        <View style={{ marginTop: 15, paddingHorizontal: 20 }}>
                          <Text style={[styles.playerTitle, { fontSize: 18 }]} numberOfLines={2}>{title}</Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Center Controls */}
                  <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', pointerEvents: 'box-none' }]}>
                    {!isLocked ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: isPortrait ? 25 : 40 }}>
                        <TouchableOpacity onPress={() => handleSeek(-10000)} style={styles.playerSeekBtn}>
                          <MaterialIcons name="replay-10" size={isPortrait ? 28 : 32} color="#fff" />
                        </TouchableOpacity>
                        
                        <TouchableOpacity onPress={handleTogglePlay}>
                          <View style={styles.playerPlayBtnLarge}>
                            <Ionicons 
                              name={status.isLoaded && status.isPlaying ? "pause" : "play"} 
                              size={40} 
                              color="#fff" 
                              style={status.isLoaded && !status.isPlaying && { marginLeft: 6 }}
                            />
                          </View>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => handleSeek(10000)} style={styles.playerSeekBtn}>
                          <MaterialIcons name="forward-10" size={32} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <Animated.View style={{ transform: [{ scale: lockPulseAnim }] }}>
                        <TouchableOpacity 
                          onPress={handleToggleLock} 
                          activeOpacity={0.8}
                          style={styles.premiumLockButton}
                        >
                          <Ionicons name="lock-closed" size={32} color="#fff" />
                        </TouchableOpacity>
                      </Animated.View>
                    )}
                  </View>

                  {/* Footer Controls */}
                  {!isLocked && (
                    <View style={[styles.playerFooter, { pointerEvents: 'box-none' }]}>
                      {/* Timeline row */}
                      <View style={[styles.playerProgressRow, { pointerEvents: 'box-none' }]}>
                        <Text style={styles.playerTimeText}>
                          {formatTime(currentPos)}
                        </Text>
                        <View style={styles.playerProgressBarContainer}>
                          <View style={styles.playerProgressBarOuter}>
                            <View 
                              style={[
                                styles.playerProgressBarInner, 
                                { width: `${progressPercent}%` }
                              ]} 
                            />
                          </View>
                          <View style={[styles.playerProgressBarThumb, { left: `${progressPercent}%` }]} />
                        </View>
                        <Text style={styles.playerTimeText}>
                          {formatTime(duration)}
                        </Text>
                      </View>

                      {/* Bottom Tool Row */}
                      <View style={[styles.playerBottomToolRow, isPortrait && { flexWrap: 'wrap', gap: 15, justifyContent: 'center' }]}>
                        <TouchableOpacity onPress={handleToggleMute} style={styles.playerFooterIconBtn}>
                          <Ionicons 
                            name={isMuted ? "volume-mute" : "volume-high"} 
                            size={24} 
                            color="#fff" 
                          />
                          <Text style={styles.playerBtnLabel}>{isMuted ? "Unmute" : "Mute"}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={handleToggleLock} style={styles.playerFooterIconBtn}>
                          <Ionicons name="lock-open-outline" size={24} color="#fff" />
                          <Text style={styles.playerBtnLabel}>Lock</Text>
                        </TouchableOpacity>

                        {relatedSeries && relatedSeries.length > 0 && (
                          <TouchableOpacity onPress={() => setShowRelatedOverlay(true)} style={[styles.playerFooterIconBtn, { width: 'auto', paddingHorizontal: 10 }]}>
                            <Ionicons name="albums-outline" size={24} color="#fff" />
                            <Text style={styles.playerBtnLabel} numberOfLines={1}>More Like This</Text>
                          </TouchableOpacity>
                        )}

                        {episodes && episodes.length > 0 && (
                          <TouchableOpacity onPress={() => setShowEpisodesOverlay(true)} style={styles.playerFooterIconBtn}>
                            <Ionicons name="copy-outline" size={24} color="#fff" />
                            <Text style={styles.playerBtnLabel}>Episodes</Text>
                          </TouchableOpacity>
                        )}

                        <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 12 }, isPortrait && { width: '100%', justifyContent: 'center', marginTop: 10 }]}>

                          {/* Play Next Button */}
                          {nextEpisodeName && onNext && (
                            <TouchableOpacity onPress={onNext} style={styles.playerNextEpBtn}>
                              <Text style={styles.playerNextEpBtnLabel}>Play Next</Text>
                              <Text style={styles.playerNextEpBtnValue}>{nextEpisodeName}</Text>
                              <Ionicons name="play-skip-forward" size={12} color="#fff" style={{ marginLeft: 4 }} />
                            </TouchableOpacity>
                          )}

                          <TouchableOpacity onPress={handleToggleSpeed} style={styles.playerSpeedBtn}>
                            <Text style={styles.playerSpeedText}>{playbackSpeed}x Speed</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Persistent Countdown removed */}

                  {/* Sleep Timer Options Overlay */}
                  {showTimerOptions && (
                    <TouchableOpacity 
                      style={[StyleSheet.absoluteFill, { zIndex: 100 }]}
                      activeOpacity={1}
                      onPress={() => { setShowTimerOptions(false); resetControlsTimer(); }}
                    >
                      <View style={styles.sleepTimerMenuPopup}>
                        {[
                          { label: 'Off', value: 0 },
                          { label: '5 min', value: 5 },
                          { label: '15 min', value: 15 },
                          { label: '30 min', value: 30 },
                          { label: '45 min', value: 45 },
                          { label: '60 min', value: 60 },
                        ].map(opt => (
                          <TouchableOpacity 
                            key={opt.value} 
                            style={styles.sleepTimerPopupItem}
                            onPress={() => selectSleepTimer(opt.value)}
                          >
                            <Text style={[
                              styles.sleepTimerPopupText, 
                              sleepTimerMs === opt.value * 60000 && { color: '#e11d48', fontWeight: 'bold' }
                            ]}>
                              {opt.label}
                            </Text>
                            {sleepTimerMs === opt.value * 60000 && <Ionicons name="checkmark" size={16} color="#e11d48" />}
                          </TouchableOpacity>
                        ))}
                      </View>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Episodes Overlay */}
              {showEpisodesOverlay && episodes && episodes.length > 0 && (
                <TouchableOpacity 
                  style={[StyleSheet.absoluteFill, { zIndex: 100, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' }]}
                  activeOpacity={1}
                  onPress={() => { setShowEpisodesOverlay(false); resetControlsTimer(); }}
                >
                  <View style={{ width: '55%', height: '75%', backgroundColor: 'rgba(30, 30, 40, 0.95)', borderRadius: 12, padding: 20, overflow: 'hidden' }}>
                    {/* Header */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                        <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold' }}>All Episodes</Text>
                        <View style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, justifyContent: 'center', alignItems: 'center' }}>
                          <Text style={{ color: '#cbd5e1', fontSize: 13, fontWeight: '700', letterSpacing: 0.5 }}>{episodes.length} eps</Text>
                        </View>
                      </View>
                      <TouchableOpacity onPress={() => { setShowEpisodesOverlay(false); resetControlsTimer(); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Ionicons name="close" size={24} color="#cbd5e1" />
                      </TouchableOpacity>
                    </View>

                    {/* Divider */}
                    <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: 12 }} />

                    <ScrollView showsVerticalScrollIndicator={false}>
                      {episodes.map((ep, idx) => {
                        const isPlaying = activeEpisodeId === ep.id;
                        return (
                          <TouchableOpacity
                            key={ep.id}
                            style={[{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', flexDirection: 'row', alignItems: 'center' }, isPlaying && { backgroundColor: 'rgba(34,197,94,0.08)', paddingHorizontal: 12, borderRadius: 8, borderBottomWidth: 0, marginVertical: 4, borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)' }]}
                            onPress={() => {
                              setShowEpisodesOverlay(false);
                              onSelectEpisode?.(ep);
                              resetControlsTimer();
                            }}
                          >
                            {/* Episode number */}
                            <Text style={{ color: isPlaying ? '#22c55e' : '#475569', fontSize: 13, fontWeight: '700', width: 28 }}>
                              {idx + 1}
                            </Text>
                            {/* Episode title + duration + VJ */}
                            <View style={{ flex: 1 }}>
                              <Text style={[
                                { color: '#cbd5e1', fontSize: 14, fontWeight: '500' },
                                isPlaying && { color: '#22c55e', fontWeight: '700' }
                              ]} numberOfLines={1}>
                                {ep.title}
                              </Text>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                <Text style={{ color: '#64748b', fontSize: 11 }}>{ep.duration}</Text>
                                {isPlaying && seriesVj && (
                                  <>
                                    <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#475569' }} />
                                    <Text style={{ color: '#22c55e', fontSize: 11, fontWeight: '700' }}>{seriesVj}</Text>
                                  </>
                                )}
                              </View>
                            </View>
                            {isPlaying && <PlayingNowIndicator />}
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                </TouchableOpacity>
              )}

              {/* Related Overlay */}
              {showRelatedOverlay && relatedSeries && relatedSeries.length > 0 && (
                <TouchableOpacity 
                  style={[StyleSheet.absoluteFill, { zIndex: 100, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }]}
                  activeOpacity={1}
                  onPress={() => { setShowRelatedOverlay(false); resetControlsTimer(); }}
                >
                  <View style={{ 
                    width: '60%', 
                    height: '75%', 
                    backgroundColor: 'rgba(18, 18, 24, 0.98)', 
                    borderRadius: 16, 
                    padding: 24, 
                    overflow: 'hidden',
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 12 },
                    shadowOpacity: 0.5,
                    shadowRadius: 16,
                    elevation: 20
                  }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                      <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: 0.5 }}>More Like This</Text>
                      <TouchableOpacity onPress={() => { setShowRelatedOverlay(false); resetControlsTimer(); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <View style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 20, padding: 4 }}>
                          <Ionicons name="close" size={24} color="#cbd5e1" />
                        </View>
                      </TouchableOpacity>
                    </View>
                    <ScrollView showsVerticalScrollIndicator={false}>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20, justifyContent: 'center' }}>
                        {relatedSeries.map((s, idx) => (
                          <TouchableOpacity
                            key={idx}
                            style={{ width: 110, marginBottom: 8 }}
                            activeOpacity={0.85}
                            onPress={() => {
                              setShowRelatedOverlay(false);
                              onSelectRelated?.(s);
                              resetControlsTimer();
                            }}
                          >
                            {/* Poster with badges */}
                            <View style={{ borderRadius: 10, overflow: 'hidden', width: 110, height: 160 }}>
                              <Image
                                source={{ uri: s.poster }}
                                style={{ width: 110, height: 160 }}
                                resizeMode="cover"
                              />
                              {/* VJ Badge — top right */}
                              <View style={{
                                position: 'absolute', top: 6, right: 6,
                                backgroundColor: 'rgba(0,0,0,0.72)',
                                borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2,
                              }}>
                                <Text style={{ color: '#fff', fontSize: 8, fontWeight: '700', letterSpacing: 0.3 }} numberOfLines={1}>
                                  {s.vj}
                                </Text>
                              </View>
                              {/* Genre/Type Badge — bottom left */}
                              <View style={{
                                position: 'absolute', bottom: 6, left: 6,
                                backgroundColor: s.isMiniSeries ? 'rgba(168,85,247,0.85)' : 'rgba(15,165,233,0.85)',
                                borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2,
                              }}>
                                <Text style={{ color: '#fff', fontSize: 8, fontWeight: '800' }}>
                                  {s.isMiniSeries ? 'Mini Series' : 'Series'}
                                </Text>
                              </View>
                              {/* Episode count badge — bottom right */}
                              <View style={{
                                position: 'absolute', bottom: 6, right: 6,
                                flexDirection: 'row', alignItems: 'center',
                                backgroundColor: 'rgba(0,0,0,0.6)',
                                borderRadius: 5, paddingHorizontal: 4, paddingVertical: 2,
                              }}>
                                <Text style={{ color: '#FFC107', fontSize: 7, fontWeight: '800' }}>
                                  •••
                                </Text>
                                <Text style={{ color: '#fff', fontSize: 7, fontWeight: '800', marginLeft: 2 }}>
                                  {(s as any).episodes || s.seasons} EP
                                </Text>
                              </View>
                            </View>
                            {/* Info area with dark background — matches home screen card */}
                            <View style={{
                              backgroundColor: '#0f0f16',
                              paddingHorizontal: 6,
                              paddingVertical: 5,
                              borderBottomLeftRadius: 10,
                              borderBottomRightRadius: 10,
                            }}>
                              <Text style={{
                                color: '#fff',
                                fontSize: 10,
                                fontWeight: '700',
                                textAlign: 'center',
                                lineHeight: 14,
                              }} numberOfLines={1}>
                                {s.title}
                              </Text>
                              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: '600', marginTop: 2, textAlign: 'center' }} numberOfLines={1}>
                                {s.year} · {s.isMiniSeries ? 'Mini Series' : `Season ${s.seasons}`}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>
                  </View>
                </TouchableOpacity>
              )}

              {/* Speed Overlay */}
              {showSpeedOverlay && (
                <TouchableOpacity 
                  style={[StyleSheet.absoluteFill, { zIndex: 100 }]}
                  activeOpacity={1}
                  onPress={() => { setShowSpeedOverlay(false); resetControlsTimer(); }}
                >
                  <View style={{ 
                    position: 'absolute',
                    bottom: 70,
                    right: 20,
                    width: 140, 
                    backgroundColor: 'rgba(30, 30, 40, 0.98)', 
                    borderRadius: 14, 
                    padding: 8, 
                    overflow: 'hidden',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.1)',
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 10
                  }}>
                    <ScrollView showsVerticalScrollIndicator={false}>
                      {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map(rate => (
                        <TouchableOpacity
                          key={rate}
                          style={[
                            { paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 8 }, 
                            playbackSpeed === rate && { backgroundColor: 'rgba(225, 29, 72, 0.15)' }
                          ]}
                          onPress={() => handleSelectSpeed(rate)}
                        >
                          <Text style={[
                            { color: '#cbd5e1', fontSize: 14, fontWeight: '500' },
                            playbackSpeed === rate && { color: '#e11d48', fontWeight: 'bold' }
                          ]}>
                            {rate === 1.0 ? 'Normal' : `${rate}x`}
                          </Text>
                          {playbackSpeed === rate && <Ionicons name="checkmark" size={16} color="#e11d48" />}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </View>
    </Modal>
  );
}

function SeriesPreviewModal({
  series,
  onClose,
  onSwitch,
  onSeeAll,
  isMuted: isMutedProp,
  onShowPremium,
}: {
  series: Series;
  onClose: () => void;
  onSwitch: (s: Series) => void;
  onSeeAll?: (title: string, data: Series[]) => void;
  isMuted?: boolean;
  onShowPremium?: () => void;
}) {
  const router = useRouter();
  const {
    isGuest,
    subscriptionBundle,
    recordInAppDownload,
    isPaid,
    recordExternalDownload,
    getRemainingDownloads,
    getExternalDownloadLimit,
    allMoviesFree,
    toggleFavorite,
    favorites,
    activeDownloads,
    episodeDownloads,
    startExternalGalleryDownload,
    startInternalAppDownload,
    startInternalEpisodeDownload,
  } = useSubscription();



  const related = ALL_SERIES.filter(
    (s) => s.genre === series.genre && s.id !== series.id,
  ).slice(0, 6);

  // Helper for background download status
  const seriesDownloadPct = activeDownloads[series.id]?.progress;
  const isThisDownloading = seriesDownloadPct !== undefined;
  const seriesInputRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);

  const wavePulseAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const startAnims = () => {
      Animated.parallel([
        Animated.loop(
          Animated.timing(wavePulseAnim, {
            toValue: 1,
            duration: 3000,
            easing: Easing.out(Easing.poly(4)),
            useNativeDriver: true,
          })
        ),
        Animated.loop(
          Animated.timing(shimmerAnim, {
            toValue: 2,
            duration: 4500,
            easing: Easing.linear,
            useNativeDriver: true,
          })
        )
      ]).start();
    };
    startAnims();
  }, [wavePulseAnim, shimmerAnim]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ y: 0, animated: false });
    }
  }, [series?.id]);
  const insets = useSafeAreaInsets();
  const playPulse = useRef(new Animated.Value(1)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;
  const myListScale = useRef(new Animated.Value(1)).current;
  const scrollY = useRef(new Animated.Value(0)).current;
  const [containerWidth, setContainerWidth] = useState(0);
  const [seriesQuery, setSeriesQuery] = useState("");
  const [activeEpisodeId, setActiveEpisodeId] = useState(`${series?.id}-ep-1`);
  const [showFullPlayer, setShowFullPlayer] = useState(false);
  const [selectedVideoUrl, setSelectedVideoUrl] = useState<string | undefined>(undefined);
  const [playerTitle, setPlayerTitle] = useState("");

  // Derive a consistent video preview URL for this series
  const previewVideoUrl = React.useMemo(() => {
    if (!series) return undefined;
    const index = series.id.charCodeAt(0) % HERO_VIDEOS.length;
    return HERO_VIDEOS[index];
  }, [series]);

  const episodes = useMemo(() => {
    if (series.episodeList && series.episodeList.length > 0) {
      return series.episodeList.map((ep: any, index: number) => {
        const isFree = index < (series.freeEpisodesCount || 0) || series.isFree;
        return {
          id: `${series.id}-ep-${index}`,
          title: ep.title,
          duration: series.episodeDuration || "45m",
          isPremium: !isFree,
          thumbnail: series.poster,
          videoUrl: ep.url,
          description: `This exciting episode follows the journey in ${series.title}. Join the adventure as characters face new challenges and unexpected turns in this highly acclaimed series.`,
        };
      });
    }
  
    const count = series.episodes; // Use dynamic count from series data
    return Array.from({ length: count }, (_, i) => {
      const isFree = i < (series.freeEpisodesCount || 0) || series.isFree;
      return {
        id: `${series.id}-ep-${i + 1}`,
        title: `${series.title} - Ep ${i + 1}${isFree ? " (Preview)" : ""}`,
        duration: series.episodeDuration || "45m",
        isPremium: !isFree,
        thumbnail: series.poster,
        videoUrl: previewVideoUrl,
        description: `This exciting episode follows the journey in ${series.title}. Join the adventure as characters face new challenges and unexpected turns in this highly acclaimed series.`,
      };
    });
  }, [series, previewVideoUrl]);

  const filteredSearchResults = useMemo(() => {
    if (!seriesQuery.trim()) return [];
    const q = seriesQuery.toLowerCase().trim();
    return ALL_SERIES.filter(s => 
      s.title.toLowerCase().includes(q) ||
      s.genre.toLowerCase().includes(q) ||
      s.vj.toLowerCase().includes(q) ||
      String(s.year).includes(q)
    );
  }, [seriesQuery]);

  const activeEpisode = useMemo(
    () => episodes.find((e) => e.id === activeEpisodeId),
    [episodes, activeEpisodeId],
  );

  // Action button state
  const isFavorite = favorites.some((f: any) => f.id === series?.id);
  const [isMuted, setIsMuted] = useState(isMutedProp ?? false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [showEpisodes, setShowEpisodes] = useState(false);

  // Sync internal muted state with parent prop (e.g. when stack changes)
  useEffect(() => {
    if (isMutedProp !== undefined) {
      setIsMuted(isMutedProp);
    }
  }, [isMutedProp]);

  const [showComments, setShowComments] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState([
    {
      id: "1",
      user: "SeriesFan_UG",
      text: "Season 2 was absolutely insane! 🔥",
      time: "1h ago",
    },
    {
      id: "2",
      user: "BingeWatcher",
      text: "Highly recommend this to anyone who loves downloading and watching great storytelling!",
      time: "4h ago",
    },
    {
      id: "3",
      user: "VJ_Vibes",
      text: "The VJ makes every episode so much more exciting 🎙️",
      time: "2d ago",
    },
  ]);

  const rawCastState = useSafeCastState();
  const isCasting = CAN_CAST && rawCastState === CastState.CONNECTED;
  const isCastConnecting = CAN_CAST && rawCastState === CastState.CONNECTING;

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

  useEffect(() => {
    if (isCasting && selectedVideoUrl && series) {
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
  }, [isCasting, selectedVideoUrl, playerTitle, series]);

  const handleMyList = () => {
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
    toggleFavorite(series);
  };

  const handleDownload = () => {
    const isPaid = subscriptionBundle !== 'None';
    if (isGuest || !isPaid) {
      onShowPremium?.();
      return;
    }
    setShowDownloadModal(true);
  };

  const startDownloadFlow = () => {
    if (series) {
      setShowDownloadModal(false);
      if (activeEpisode) {
        startInternalEpisodeDownload(series, activeEpisode.id, activeEpisode.videoUrl || previewVideoUrl || '', activeEpisode.title);
      } else {
        startInternalAppDownload(series);
      }
    }
  };

  const handleShare = () => {
    Share.share({
      message: `Check out "${series.title}" on MovieApp! 🎬`,
    });
  };

  const handleNextEpisode = () => {
    const currentIndex = episodes.findIndex(e => e.id === activeEpisodeId);
    if (currentIndex < episodes.length - 1) {
      const nextEp = episodes[currentIndex + 1];
      const canWatchNext = allMoviesFree || (nextEp as any).isFree || (nextEp as any).isPremium === false || (subscriptionBundle !== 'None' && !isGuest);
      if (!canWatchNext) {
        onShowPremium?.();
        return;
      }
      setActiveEpisodeId(nextEp.id);
      setPlayerTitle(nextEp.title);
      setSelectedVideoUrl(nextEp.videoUrl);
    }
  };

  const handlePrevEpisode = () => {
    const currentIndex = episodes.findIndex(e => e.id === activeEpisodeId);
    if (currentIndex > 0) {
      const prevEp = episodes[currentIndex - 1];
      const canWatchPrev = allMoviesFree || (prevEp as any).isFree || (prevEp as any).isPremium === false || (subscriptionBundle !== 'None' && !isGuest);
      if (!canWatchPrev) {
        onShowPremium?.();
        return;
      }
      setActiveEpisodeId(prevEp.id);
      setPlayerTitle(prevEp.title);
      setSelectedVideoUrl(prevEp.videoUrl);
    }
  };

  const currentIndex = episodes.findIndex(e => e.id === activeEpisodeId);
  const hasNext = currentIndex < episodes.length - 1;
  const hasPrev = currentIndex > 0;
  const nextEpisodeTitle = hasNext ? episodes[currentIndex + 1].title : undefined;

  const handlePostComment = () => {
    if (!commentText.trim()) return;
    setComments((prev) => [
      {
        id: Date.now().toString(),
        user: "You",
        text: commentText.trim(),
        time: "just now",
      },
      ...prev,
    ]);
    setCommentText("");
  };

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
    return () => {
      breath.stop();
      wave.stop();
    };
  }, []);

  useEffect(() => {
    // Keyboard listeners removed in favor of KeyboardAvoidingView
  }, []);

  return (
    <Modal
      visible
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "#0a0a0f" }]}>
        <StatusBar
          barStyle="light-content"
          translucent
          backgroundColor="transparent"
        />
        <SafeAreaView style={{ flex: 1 }}>
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
              height: 64,
              paddingTop: insets.top,
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
                pointerEvents="none"
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
              onPress={() => DeviceEventEmitter.emit("openSeriesLibrarySearch", series)}
            >
              <Ionicons name="search" size={20} color="#fff" />
            </TouchableOpacity>
          </Animated.View>
          {seriesQuery.trim() === "" ? (
            <ScrollView
              ref={scrollRef}
              showsVerticalScrollIndicator={false}
              bounces={false}
              contentContainerStyle={{ paddingBottom: 160 }}
              onScroll={Animated.event(
                [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                { useNativeDriver: false },
              )}
              scrollEventThrottle={16}
            >
            {/* Poster */}
            <TouchableOpacity 
              activeOpacity={0.9} 
              onPress={() => {
                const canWatch = allMoviesFree || (series as any).isFree || (subscriptionBundle !== 'None' && !isGuest);
                if (!canWatch) {
                  onShowPremium?.();
                  return;
                }
                const firstEp = episodes[0];
                const finalUrl = (firstEp && episodeDownloads[firstEp.id]) || previewVideoUrl;
                setSelectedVideoUrl(finalUrl);
                setPlayerTitle(series.title + (firstEp && episodeDownloads[firstEp.id] ? "" : " - Preview"));
                setShowFullPlayer(true);
              }}
            >
              {previewVideoUrl ? (
                <Video
                  source={{ uri: previewVideoUrl }}
                  style={styles.previewPoster}
                  resizeMode={ResizeMode.COVER}
                  shouldPlay
                  isLooping
                  isMuted={isMuted}
                />
              ) : (
                <Image
                  source={{ uri: series.poster }}
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

                {/* Pulsing button */}
                <Animated.View style={{ transform: [{ scale: playPulse }] }}>
                  <View style={styles.posterPlayBtn}>
                    <BlurView
                      intensity={30}
                      tint="light"
                      style={[StyleSheet.absoluteFill, { borderRadius: 36 }]}
                    />
                    <Ionicons
                      name="play"
                      size={32}
                      color="#fff"
                      style={{ marginLeft: 4 }}
                    />
                  </View>
                </Animated.View>
              </View>
            </TouchableOpacity>

            {/* Info */}
            <View style={styles.previewContent}>
              {/* Genre & Metadata Row */}
              <View style={[styles.previewTags, { alignItems: 'center' }]}>
                <View style={styles.previewTag}>
                  <Text style={styles.previewTagText}>{series.genre}</Text>
                </View>
                
                {/* Compact Metadata (VJ, Year, Duration) */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="mic-outline" size={11} color="#475569" />
                  <Text style={[styles.previewMetaText, { fontSize: 11 }]}>{series.vj}</Text>
                  
                  <View style={styles.previewDot} />
                  <Text style={[styles.previewMetaText, { fontSize: 11 }]}>{series.year}</Text>
                  
                  <View style={styles.previewDot} />
                  <Ionicons name="time-outline" size={11} color="#475569" />
                  <Text style={[styles.previewMetaText, { fontSize: 11 }]}>
                    {series.totalDuration || "N/A"}
                  </Text>
                  
                  <View style={styles.previewDot} />
                  <Ionicons name="play-circle-outline" size={11} color="#475569" />
                  <Text style={[styles.previewMetaText, { fontSize: 11 }]}>
                    {series.episodeDuration || "N/A"}/ep
                  </Text>
                </View>
              </View>

              {/* Title & Badges Row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
                <Text style={[styles.previewTitle, { marginBottom: 0 }]}>{series.title}</Text>
                
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {/* Series Badge */}
                  <View style={[styles.epTitleBadge, { backgroundColor: 'rgba(229, 9, 20, 0.1)', borderColor: 'rgba(229, 9, 20, 0.3)' }]}>
                    <Text style={[styles.epTitleBadgeText, { color: '#E50914' }]}>
                      {series.isMiniSeries ? "Mini Series" : "Series"}
                    </Text>
                  </View>

                  <View style={[styles.epTitleBadge, { backgroundColor: 'rgba(255, 193, 7, 0.1)', borderColor: 'rgba(255, 193, 7, 0.3)' }]}>
                    <Text style={[styles.epTitleBadgeText, { color: '#FFC107' }]}>
                      {`Season ${series.seasons || 1}`}
                    </Text>
                  </View>

                  <View style={[styles.epTitleBadge, { backgroundColor: 'rgba(91, 95, 239, 0.2)', borderColor: 'rgba(91, 95, 239, 0.4)' }]}>
                    <Text style={[styles.epTitleBadgeText, { color: '#818cf8' }]}>
                      {activeEpisodeId.toUpperCase().replace('EP', 'Ep ')} / {episodes.length}
                    </Text>
                  </View>
                </View>
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
                  {(series as any).description ||
                    `Dive into the acclaimed series ${series.title}. An epic journey spanning ${series.seasons} seasons full of twists, drama, and unforgettable moments.`}
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
                <TouchableOpacity
                  style={styles.previewActionCol}
                  onPress={handleDownload}
                  disabled={isThisDownloading}
                >
                  <View
                    style={[
                      styles.previewActionIconBg,
                      isThisDownloading && { borderColor: "#00ffcc" },
                    ]}
                  >
                    {activeDownloads[activeEpisodeId] ? (
                      <Text
                        style={{
                          color: "#818cf8",
                          fontSize: 12,
                          fontWeight: "800",
                        }}
                      >
                        {Math.round(activeDownloads[activeEpisodeId].progress)}%
                      </Text>
                    ) : episodeDownloads[activeEpisodeId] ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={22}
                        color="#10b981"
                      />
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
                      isThisDownloading && { color: "#00ffcc" },
                    ]}
                  >
                    {activeDownloads[activeEpisodeId] ? "Downloading…" : episodeDownloads[activeEpisodeId] ? "Downloaded" : "Download"}
                  </Text>
                </TouchableOpacity>

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

              {/* EPISODES SECTION */}
              <View style={styles.episodesSection}>
                {/* OTHER EPISODES toggle header */}
                <View style={{ marginTop: 12, marginBottom: showEpisodes ? 12 : 4, paddingHorizontal: 4 }}>
                  {[0, 1].map((i) => (
                    <Animated.View
                      key={`wave-outer-${i}`}
                      pointerEvents="none"
                      style={[
                        StyleSheet.absoluteFill,
                        {
                          borderWidth: 2,
                          borderColor: "rgba(91, 95, 239, 0.4)",
                          borderRadius: 23,
                          transform: [
                            {
                              scaleX: wavePulseAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [1, 1.05 + (i * 0.05)],
                              }),
                            },
                            {
                              scaleY: wavePulseAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [1, 1.25 + (i * 0.15)],
                              }),
                            },
                          ],
                          opacity: wavePulseAnim.interpolate({
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
                      setShowEpisodes(prev => !prev);
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
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        StyleSheet.absoluteFill,
                        {
                          transform: [
                            {
                              translateX: shimmerAnim.interpolate({
                                inputRange: [0, 2],
                                outputRange: [-Dimensions.get('window').width / 1.5, Dimensions.get('window').width / 1.5],
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
                        {series.title.toUpperCase()} OTHER EPISODES
                      </Text>
                      <View style={{ flex: 1 }} />
                      <View style={styles.epCountPillPremium}>
                        <Text style={styles.epCountTextPremium}>
                          EP {episodes.length - 1}
                        </Text>
                      </View>
                      <Ionicons
                        name={showEpisodes ? "chevron-up" : "chevron-down"}
                        size={14}
                        color="rgba(255,255,255,0.6)"
                        style={{ marginLeft: 6 }}
                      />
                    </View>
                  </TouchableOpacity>
                </View>

                {showEpisodes && episodes
                  .filter((ep) => ep.id !== activeEpisodeId)
                  .map(
                    (ep: {
                      id: string;
                      title: string;
                      duration: string;
                      isPremium: boolean;
                      thumbnail: string;
                      description: string;
                      videoUrl: string | undefined;
                    }) => {
                      const epIsLocked = ep.isPremium && subscriptionBundle === 'None';
                      return (
                        <TouchableOpacity
                          key={ep.id}
                          style={styles.episodeItemPremium}
                          onPress={() => {
                            const mpCanWatch = allMoviesFree || !ep.isPremium || (subscriptionBundle !== 'None' && !isGuest);
                            if (!mpCanWatch) {
                              onShowPremium?.();
                              return;
                            }
                            const finalUrl = episodeDownloads[ep.id] || ep.videoUrl || previewVideoUrl;
                            setSelectedVideoUrl(finalUrl);
                            setPlayerTitle(ep.title);
                            setShowFullPlayer(true);
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
                              source={{ uri: ep.thumbnail }}
                              style={styles.epThumb}
                            />
                            <LinearGradient
                              colors={["transparent", "rgba(0,0,0,0.4)"]}
                              style={StyleSheet.absoluteFill}
                            />
                            <View style={styles.epDurationBadgePremiumSmall}>
                              <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
                              <Text style={styles.epDurationTextPremium}>{ep.duration}</Text>
                            </View>

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
                              <Text style={{ color: '#fff', fontSize: 8, fontWeight: '900' }}>{series.vj}</Text>
                            </View>

                            {/* Lock / Play overlay */}
                            {epIsLocked ? (
                              <View style={styles.epThumbPlayIconOverlay}>
                                <Ionicons name="lock-closed" size={16} color="#fff" />
                              </View>
                            ) : (
                              <View style={styles.epThumbPlayIconOverlay}>
                                <Ionicons name="play" size={16} color="#fff" style={{ marginLeft: 2 }} />
                              </View>
                            )}
                          </View>

                          <View style={styles.epInfoPremium}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={[styles.epTitlePremium, epIsLocked && { opacity: 0.6 }]} numberOfLines={1}>
                                {ep.title}
                              </Text>
                            </View>
                            <View style={styles.epMetaRowSmall}>
                              <View style={styles.epStatusBadgeSmall}>
                                <Text style={styles.epStatusTextSmall}>HD</Text>
                              </View>
                              <Text style={styles.epSubPremiumSmall}>
                                {epIsLocked ? 'Premium only' : 'Ready to watch'}
                              </Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                              {/* Episode Download Button */}
                              {episodeDownloads[ep.id] ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderStyle: 'dashed', borderWidth: 0, paddingVertical: 4, flex: 1, justifyContent: 'center', backgroundColor: 'rgba(16, 185, 129, 0.05)', borderRadius: 6 }}>
                                  <Ionicons name="checkmark-circle" size={14} color="#10b981" />
                                  <Text style={{ color: '#10b981', fontSize: 11, fontWeight: '800' }}>DOWNLOADED</Text>
                                </View>
                              ) : activeDownloads[ep.id] ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'center', backgroundColor: 'rgba(59, 130, 246, 0.05)', paddingVertical: 4, borderRadius: 6 }}>
                                  <View style={{ width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.3)', justifyContent: 'center', alignItems: 'center' }}>
                                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#3b82f6' }} />
                                  </View>
                                  <Text style={{ color: '#3b82f6', fontSize: 11, fontWeight: '800' }}>{Math.round(activeDownloads[ep.id].progress)}% COMPLETE</Text>
                                </View>
                              ) : (
                                <TouchableOpacity 
                                  style={{ 
                                    flexDirection: 'row', 
                                    alignItems: 'center', 
                                    gap: 6, 
                                    backgroundColor: 'rgba(91, 95, 239, 0.15)', // Matching Ep badge background
                                    flex: 1, 
                                    justifyContent: 'center', 
                                    paddingVertical: 5, 
                                    borderRadius: 6,
                                    borderWidth: 1,
                                    borderColor: 'rgba(129, 140, 248, 0.3)' // Matching Ep badge border/text color
                                  }}
                                  onPress={(e) => {
                                    e.stopPropagation();
                                    const isPaidSub = subscriptionBundle !== 'None';
                                    if (isGuest || !isPaidSub) {
                                      onShowPremium?.();
                                      return;
                                    }
                                    startInternalEpisodeDownload(series, ep.id, ep.videoUrl || previewVideoUrl || '', ep.title);
                                  }}
                                >
                                  <Ionicons name="download-outline" size={14} color="#818cf8" />
                                  <Text style={{ color: '#818cf8', fontSize: 11, fontWeight: '800' }}>DOWNLOAD EPISODE</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    },
                  )}
              </View>
            </View>

            {/* Related */}
            {related.length > 0 && (
              <View style={styles.relatedSection}>
                <Text style={styles.relatedTitle}>More Like This</Text>
                <FlatList
                  data={related}
                  keyExtractor={(s) => "s-rel-" + s.id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.relatedList}
                  removeClippedSubviews={false}
                  initialNumToRender={4}
                  maxToRenderPerBatch={4}
                  windowSize={3}
                  renderItem={({ item }) => (
                    <SeriesCard item={item} onPress={() => onSwitch(item)} />
                  )}
                />
              </View>
            )}
            {/* ── Additional Suggestions (Suggested by user) ── */}
            <View style={{ marginTop: 0, paddingBottom: 20 }}>
              {/* YOU MAY ALSO LIKE */}
              <View style={{ marginBottom: 4 }}>
                <View
                  style={[
                    styles.rowHeader,
                    { paddingHorizontal: 16, marginBottom: 4 },
                  ]}
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
                      onSeeAll?.("You May Also Like", ALL_SERIES.slice(0, 15))
                    }
                    activeOpacity={0.8}
                  >
                    <View style={styles.pillSheen} />
                    <Text style={styles.seeAllText}>See All</Text>
                    <Ionicons name="chevron-forward" size={12} color="#fff" />
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={ALL_SERIES.slice(0, 8)}
                  keyExtractor={(s) => "s-yml-" + s.id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 6, paddingHorizontal: 16 }}
                  removeClippedSubviews={false}
                  initialNumToRender={4}
                  maxToRenderPerBatch={4}
                  windowSize={3}
                  renderItem={({ item }) => (
                    <SeriesCard item={item} onPress={() => onSwitch(item)} />
                  )}
                />
              </View>

              {/* TRENDING NOW (Most Viewed) */}
              <View style={{ marginBottom: 4 }}>
                <View
                  style={[
                    styles.rowHeader,
                    { paddingHorizontal: 16, marginBottom: 4 },
                  ]}
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
                    onPress={() => onSeeAll?.("Trending Now", TRENDING_SERIES)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.pillSheen} />
                    <Text style={styles.seeAllText}>See All</Text>
                    <Ionicons name="chevron-forward" size={12} color="#fff" />
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={TRENDING_SERIES}
                  keyExtractor={(s) => "s-trn-" + s.id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 6, paddingHorizontal: 16 }}
                  removeClippedSubviews={false}
                  initialNumToRender={4}
                  maxToRenderPerBatch={4}
                  windowSize={3}
                  renderItem={({ item }) => (
                    <SeriesCard item={item} onPress={() => onSwitch(item)} />
                  )}
                />
              </View>

              {/* MOST VIEWED */}
              <View style={{ marginBottom: 4 }}>
                <View
                  style={[
                    styles.rowHeader,
                    { paddingHorizontal: 16, marginBottom: 4 },
                  ]}
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
                    onPress={() =>
                      onSeeAll?.("Most Viewed", MOST_VIEWED_SERIES)
                    }
                    activeOpacity={0.8}
                  >
                    <View style={styles.pillSheen} />
                    <Text style={styles.seeAllText}>See All</Text>
                    <Ionicons name="chevron-forward" size={12} color="#fff" />
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={MOST_VIEWED_SERIES}
                  keyExtractor={(s) => "s-mvw-" + s.id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 6, paddingHorizontal: 16 }}
                  removeClippedSubviews={false}
                  initialNumToRender={4}
                  maxToRenderPerBatch={4}
                  windowSize={3}
                  renderItem={({ item }) => (
                    <SeriesCard item={item} onPress={() => onSwitch(item)} />
                  )}
                />
              </View>

              {/* MOST DOWNLOADED */}
              <View style={{ marginBottom: 4 }}>
                <View
                  style={[
                    styles.rowHeader,
                    { paddingHorizontal: 16, marginBottom: 4 },
                  ]}
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
                      onSeeAll?.("Most Downloaded", MOST_DOWNLOADED_SERIES)
                    }
                    activeOpacity={0.8}
                  >
                    <View style={styles.pillSheen} />
                    <Text style={styles.seeAllText}>See All</Text>
                    <Ionicons name="chevron-forward" size={12} color="#fff" />
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={MOST_DOWNLOADED_SERIES}
                  keyExtractor={(s) => "s-mdo-" + s.id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 6, paddingHorizontal: 16 }}
                  removeClippedSubviews={false}
                  initialNumToRender={4}
                  maxToRenderPerBatch={4}
                  windowSize={3}
                  renderItem={({ item }) => (
                    <SeriesCard item={item} onPress={() => onSwitch(item)} />
                  )}
                />
              </View>

              {/* NEW RELEASES */}
              <View style={{ marginBottom: 4 }}>
                <View
                  style={[
                    styles.rowHeader,
                    { paddingHorizontal: 16, marginBottom: 4 },
                  ]}
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
                    onPress={() => onSeeAll?.("New Releases", NEW_SERIES)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.pillSheen} />
                    <Text style={styles.seeAllText}>See All</Text>
                    <Ionicons name="chevron-forward" size={12} color="#fff" />
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={NEW_SERIES}
                  keyExtractor={(s) => "s-nre-" + s.id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 6, paddingHorizontal: 16 }}
                  removeClippedSubviews={false}
                  initialNumToRender={4}
                  maxToRenderPerBatch={4}
                  windowSize={3}
                  renderItem={({ item }) => (
                    <SeriesCard item={item} onPress={() => onSwitch(item)} />
                  )}
                />
              </View>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
          ) : (
            <View style={{ flex: 1 }}>
              <View style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 18,
                paddingTop: Platform.OS === "ios" ? 53 : (StatusBar.currentHeight ?? 0) + 13,
                paddingBottom: 8,
                backgroundColor: "rgba(10, 10, 15, 0.97)",
                zIndex: 100,
                borderBottomWidth: 1,
                borderBottomColor: "rgba(255,255,255,0.05)",
              }}>
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '900', letterSpacing: 0.5, flex: 1 }}>
                  SEARCH RESULTS IN SERIES LIBRARY
                </Text>
                <View style={styles.resultsCountBadge}>
                  <BlurView
                    intensity={99}
                    tint="dark"
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.badgeSheen} />
                  <Ionicons
                    name="search"
                    size={12}
                    color="rgba(255,255,255,0.6)"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.resultsCountText}>
                    {filteredSearchResults.length}{" "}
                    {filteredSearchResults.length === 1 ? "RESULT" : "RESULTS"}
                  </Text>
                </View>

                {/* Seamless Fade Gradient where cards scroll underneath */}
                <LinearGradient
                  colors={["rgba(10, 10, 15, 0.97)", "transparent"]}
                  style={{
                    position: "absolute",
                    bottom: -10,
                    left: 0,
                    right: 0,
                    height: 10,
                    zIndex: -1,
                  }}
                  pointerEvents="none"
                />
              </View>
              <FlatList
                data={filteredSearchResults}
                keyExtractor={(s) => "search-" + s.id}
                numColumns={3}
                contentContainerStyle={[styles.grid, { paddingTop: Platform.OS === "ios" ? 90 : (StatusBar.currentHeight ?? 0) + 50, paddingBottom: 160 }]}
                columnWrapperStyle={styles.gridRow}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <SeriesCard 
                    item={item} 
                    onPress={() => {
                      setSeriesQuery("");
                      onSwitch(item);
                    }} 
                  />
                )}
                ListEmptyComponent={
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 100 }}>
                    <Ionicons name="search-outline" size={60} color="rgba(255,255,255,0.1)" />
                    <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 16, marginTop: 15 }}>
                      No series found for "{seriesQuery}"
                    </Text>
                  </View>
                }
              />
            </View>
          )}


          {/* ── Comments Sheet ── */}
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
                    <Ionicons name="cloud-download" size={32} color="#5B5FEF" />
                  </View>
                </View>

                <Text style={styles.downloadTitle}>Download Options</Text>
                <Text style={styles.downloadSub}>
                  Choose your preferred method to save "{series?.title}" for
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
                      Save to App (Offline)
                    </Text>
                    <View style={styles.pillSheen} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.downloadSecondaryBtn,
                      getRemainingDownloads() === 0 && { opacity: 0.4 },
                    ]}
                    onPress={() => {
                      setShowDownloadModal(false);
                      startExternalGalleryDownload(series);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="folder-outline" size={20} color="#94a3b8" />
                    <Text style={styles.downloadSecondaryBtnText}>
                      External Download
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
                        router.push("/(tabs)/menu?upgrade=true");
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

          {showComments && (
            <Modal
              visible
              animationType="slide"
              transparent
              statusBarTranslucent
              onRequestClose={() => setShowComments(false)}
            >
              <View style={{ flex: 1 }}>
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
                <KeyboardAvoidingView
                  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: 480,
                    backgroundColor: "#111827",
                    borderTopLeftRadius: 24,
                    borderTopRightRadius: 24,
                    overflow: "hidden",
                  }}
                >
                  <View style={{ flex: 1 }}>
                    {/* Header */}
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        padding: 16,
                        borderBottomWidth: 1,
                        borderBottomColor: "rgba(255,255,255,0.08)",
                      }}
                    >
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
                    {/* Comments list */}
                    <ScrollView
                      style={{ flex: 1 }}
                      contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
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
                              gap: 10,
                              marginBottom: idx < comments.length - 1 ? 16 : 0,
                            }}
                          >
                            <View
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: 18,
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
                                  fontSize: 14,
                                }}
                              >
                                {c.user[0]}
                              </Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <View
                                style={{
                                  flexDirection: "row",
                                  gap: 8,
                                  alignItems: "center",
                                  marginBottom: 3,
                                }}
                              >
                                <Text
                                  style={{
                                    color: "#fff",
                                    fontWeight: "700",
                                    fontSize: 13,
                                  }}
                                >
                                  {c.user}
                                </Text>
                                <Text
                                  style={{ color: "#64748b", fontSize: 11 }}
                                >
                                  {c.time}
                                </Text>
                              </View>
                              <Text
                                style={{
                                  color: "#cbd5e1",
                                  fontSize: 14,
                                  lineHeight: 20,
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
                        padding: 12,
                        paddingBottom: 20,
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
                          paddingHorizontal: 16,
                          paddingVertical: 10,
                          color: "#fff",
                          fontSize: 14,
                          borderWidth: 1,
                          borderColor: "rgba(255,255,255,0.1)",
                          maxHeight: 80,
                        }}
                        placeholder="Write a comment to attract others… 📺"
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
                </KeyboardAvoidingView>
              </View>
            </Modal>
          )}
        </SafeAreaView>
      </View>

      <FullVideoPlayerModal 
        visible={showFullPlayer}
        videoUrl={selectedVideoUrl}
        title={playerTitle}
        onClose={() => setShowFullPlayer(false)}
        onNext={handleNextEpisode}
        onPrev={handlePrevEpisode}
        hasNext={hasNext}
        hasPrev={hasPrev}
        nextEpisodeName={nextEpisodeTitle ? `${series?.title} ${nextEpisodeTitle}` : undefined}
        episodes={episodes}
        activeEpisodeId={activeEpisodeId}
        onSelectEpisode={(ep) => {
          const canWatchEp = allMoviesFree || (ep as any).isFree || (ep as any).isPremium === false || (subscriptionBundle !== 'None' && !isGuest);
          if (!canWatchEp) {
            onShowPremium?.();
            return;
          }
          setActiveEpisodeId(ep.id);
          setPlayerTitle(ep.title);
          setSelectedVideoUrl(ep.videoUrl);
        }}
        relatedSeries={TRENDING_SERIES}
        onSelectRelated={(s) => {
          setShowFullPlayer(false);
          onSwitch(s);
        }}
        seriesVj={series?.vj}
        seriesEpisodeDuration={series?.episodeDuration}
      />
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const TOP_OFFSET =
  Platform.OS === "ios" ? 44 : (StatusBar.currentHeight ?? 0) + 4;

// ─── Series Grid Modal ────────────────────────────────────────────────────────
function SeriesGridModal({
  visible,
  title,
  data,
  onClose,
  onSelect,
}: {
  visible: boolean;
  title: string;
  data: Series[];
  onClose: () => void;
  onSelect: (s: Series) => void;
}) {
  const insets = useSafeAreaInsets();


  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "#0a0a0f" }]}>
        <StatusBar
          barStyle="light-content"
          translucent
          backgroundColor="transparent"
        />
        <SafeAreaView style={{ flex: 1 }}>
          <View
            style={{
              padding: 16,
              paddingTop: insets.top + (Platform.OS === 'ios' ? 0 : 10),
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <TouchableOpacity
              onPress={() => {
                Keyboard.dismiss();
                onClose();
              }}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: "rgba(255,255,255,0.05)",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={{ color: "#fff", fontSize: 20, fontWeight: "800" }}>
              {title}
            </Text>
          </View>

          <FlatList
            data={data}
            keyExtractor={(s) => s.id}
            numColumns={3}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
            columnWrapperStyle={{ gap: 6, marginBottom: 10 }}
            removeClippedSubviews={Platform.OS === "android"}
            initialNumToRender={12}
            maxToRenderPerBatch={6}
            windowSize={5}
            renderItem={({ item }) => (
              <SeriesCard item={item} onPress={() => onSelect(item)} />
            )}
            ListEmptyComponent={
              <View style={{ alignItems: "center", marginTop: 100 }}>
                <Ionicons name="search-outline" size={60} color="#1e293b" />
                <Text style={{ color: "#475569", marginTop: 12 }}>
                  No matches found
                </Text>
              </View>
            }
          />
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0f" },

  // ── Header removed ──
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

  // Filter chips
  filterWrap: {
    paddingVertical: 2,
    gap: 2,
  },
  filterListPrimary: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 0,
  },
  chipSelectionArea: {
    paddingHorizontal: 16,
    marginTop: 0,
    paddingBottom: 4,
  },
  filterListSecondary: {
    gap: 6,
    paddingBottom: 6,
  },
  browseFilterPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  browseFilterPillActive: {
    backgroundColor: "rgba(91, 95, 239, 0.15)",
    borderColor: "#5B5FEF",
    shadowColor: "#5B5FEF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  browseFilterPillText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  browseFilterPillTextActive: {
    color: "#fff",
    fontWeight: "800",
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  filterChipActive: {
    backgroundColor: "#5B5FEF",
    borderColor: "rgba(255,255,255,0.3)",
    shadowColor: "#5B5FEF",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 4,
  },
  filterChipText: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  filterChipTextActive: { color: "#fff", fontWeight: "800" },

  // Grid
  grid: { paddingHorizontal: 16, paddingTop: 2 },
  gridRow: { justifyContent: "flex-start", gap: 6 },

  // Card
  card: {
    width: CARD_W,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginBottom: 10,
  },
  poster: {
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
  header: {
    paddingHorizontal: 16,
    paddingTop: 90,
    marginBottom: 20,
  },
  sectionHeaderBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    alignSelf: 'flex-start',
  },
  rowTitle: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  rowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  seeAllBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(91, 95, 239, 0.25)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    gap: 4,
    overflow: "hidden",
    shadowColor: "#5B5FEF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
  },
  seeAllText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
  },
  headerSub: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    fontWeight: "600",
  },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: "#334155" },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
    gap: 12,
  },
  emptyText: { color: "#334155", fontSize: 15, fontWeight: "600" },

  // ── Unified Search Capsule ──
  universalSearchBottomPill: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    height: 54,
    borderRadius: 27,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    zIndex: 1000,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  searchBackBtnSmall: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
    backgroundColor: "rgba(10, 10, 15, 0.95)",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  searchInnerCapsule: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    height: 40,
    backgroundColor: "rgba(10, 10, 15, 0.95)",
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  universalSearchInput: {
    flex: 1,
    color: "#fff",
    fontSize: 14,
    paddingHorizontal: 12,
  },

  // Preview Modal
  previewContainer: { flex: 1, backgroundColor: "#0a0a0f" },
  previewHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    paddingTop: TOP_OFFSET,
    paddingBottom: 12,
    paddingHorizontal: 20,
    flexDirection: "row",
  },
  previewPoster: { width: "100%", height: 300, resizeMode: "cover" },
  previewPosterFade: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  previewContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 0,
    backgroundColor: "#0a0a0f",
  },
  previewTags: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 8,
    flexWrap: "wrap",
  },
  previewTag: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  previewTagText: {
    color: "#e2e8f0",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  previewTitle: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  previewMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  previewRating: { color: "#FFD700", fontSize: 12, fontWeight: "800" },
  previewDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "#334155",
  },
  previewMetaText: { color: "#64748b", fontSize: 12, fontWeight: "600" },
  previewDesc: {
    color: "#94a3b8",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
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
  relatedSection: {
    marginTop: 12,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
  },
  relatedTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
    marginLeft: 20,
    marginTop: 8,
    marginBottom: 4,
  },
  relatedList: { paddingHorizontal: 20, gap: 6 },
  pillSheen: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "50%",
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  // ── Download Modal (Universal) ──
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
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
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
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
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
  // Episodes
  episodesSection: {
    marginTop: 32,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
    paddingTop: 8,
  },
  episodesHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 8,
  },
  episodesTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
  },
  episodesCountBadge: {
    backgroundColor: "rgba(91, 95, 239, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(91, 95, 239, 0.4)",
  },
  episodesCountText: {
    color: "#818cf8",
    fontSize: 10,
    fontWeight: "900",
  },
  episodeItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.02)",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.6)",
  },
  episodeItemActive: {
    backgroundColor: "rgba(91, 95, 239, 0.1)",
    borderColor: "rgba(91, 95, 239, 0.3)",
  },
  epThumbWrap: {
    width: 100,
    height: 56,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#1e1e2e",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.6)",
  },
  epThumb: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  epActiveOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(91, 95, 239, 0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  epLockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  epDurationBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.75)",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  epDurationText: {
    color: "#fff",
    fontSize: 8,
    fontWeight: "800",
  },
  epInfo: {
    flex: 1,
    marginLeft: 12,
  },
  epTitle: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 2,
  },
  epSub: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    fontWeight: "600",
  },
  epNowPlaying: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  epNowPlayingText: {
    color: "#10b981",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
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
    marginLeft: -4,
    marginTop: 28,
  },
  playerTitleContainer: {
    position: 'absolute',
    top: 28,
    left: 60,
    right: 120, // Accommodate right icons
    alignItems: 'center',
    justifyContent: 'center',
    height: 44, // Match icon height for vertical centering
  },
  playerHeaderRightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
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
  premiumLockButtonGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  premiumLockButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  playerFooter: {
    marginBottom: 65,
  },
  playerProgressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  playerProgressBarContainer: {
    flex: 1,
    height: 30, // Taller for easier touch
    justifyContent: "center",
  },
  playerProgressBarOuter: {
    width: "100%",
    height: 3,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 1.5,
    overflow: "hidden",
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
  sleepTimerBadgeText: {
    color: '#e11d48',
    fontSize: 9,
    fontWeight: '800',
    position: 'absolute',
    bottom: -10,
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
  playerNextEpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    maxWidth: 280,
  },
  playerNextEpBtnLabel: {
    color: '#ccc',
    fontSize: 10,
    fontWeight: '600',
    marginRight: 4,
  },
  playerNextEpBtnValue: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
    flexShrink: 1,
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
  sleepTimerMenuPopup: {
    position: 'absolute',
    top: 75,
    right: 80,
    backgroundColor: 'rgba(30, 30, 40, 0.95)',
    borderRadius: 12,
    paddingVertical: 8,
    width: 140,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 5,
  },
  sleepTimerPopupItem: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sleepTimerPopupText: {
    color: '#ccc',
    fontSize: 14,
    fontWeight: '500',
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
  epTitleBadge: {
    backgroundColor: "rgba(91, 95, 239, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(91, 95, 239, 0.4)",
  },
  epTitleBadgeText: {
    color: "#818cf8",
    fontSize: 12,
    fontWeight: "900",
  },
  pillSheenSmall: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "50%",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  // Premium Episodes Redesign
  episodeItemPremium: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 18,
    marginBottom: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.6)",
    backgroundColor: "rgba(30, 30, 45, 0.4)",
  },
  epThumbWrapPremiumLarge: {
    width: 140,
    height: 80,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#1e1e2e",
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.6)",
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
  epDescPremium: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
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
  },
  resultsCountText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  badgeSheen: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "50%",
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
  },
});
