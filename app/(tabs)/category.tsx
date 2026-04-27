import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Platform,
  StatusBar,
  Dimensions,
  Modal,
  Animated,
  DeviceEventEmitter,
  Easing,
  ViewToken,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Movie, Series } from "@/constants/movieData";
import { MoviePreviewModal } from "./index";
import { GridModal, GridContent } from "../../components/GridComponents";
import { useMovies } from "@/app/context/MovieContext";
import { useSubscription } from "@/app/context/SubscriptionContext";
import PremiumAccessModal from "../../components/PremiumAccessModal";
import PlanSelectionModal from "../../components/PlanSelectionModal";
import { useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { Video, ResizeMode } from "expo-av";
import { 
  ALL_GENRES, 
  ALL_VJS, 
  getStreamUrl,
  ALL_ROWS
} from "@/constants/movieData";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// ─── Skeleton Loader Component ───────────────────────────────────────────────
const SkeletonLoader = React.memo(({ width, height, borderRadius = 12, style, shimmer = true }: { width: any, height: any, borderRadius?: number, style?: any, shimmer?: boolean }) => {
  const translateX = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    if (shimmer) {
      Animated.loop(
        Animated.timing(translateX, {
          toValue: 2,
          duration: 1500,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    }
  }, [shimmer]);

  return (
    <View
      style={[
        {
          width,
          height,
          backgroundColor: 'rgba(255,255,255,0.06)',
          borderRadius,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {shimmer && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              transform: [
                {
                  translateX: translateX.interpolate({
                    inputRange: [-1, 2],
                    outputRange: [-width * 1.5, width * 1.5],
                  }),
                },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={[
              'transparent',
              'rgba(255,255,255,0.05)',
              'rgba(255,255,255,0.12)',
              'rgba(255,255,255,0.05)',
              'transparent',
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[StyleSheet.absoluteFill, { transform: [{ skewX: '-20deg' }] }]}
          />
        </Animated.View>
      )}
    </View>
  );
});

const VJ_PROFILES = ALL_VJS.map(name => ({
  name,
  image: `https://ui-avatars.com/api/?name=${name.replace(' ', '+')}&background=5B5FEF&color=fff&size=200`
}));

const GENRES = ALL_GENRES.map((g, i) => ({ id: String(i), name: g }));
const YEARS = Array.from({ length: 2026 - 1990 + 1 }, (_, i) => String(2026 - i));
const TYPES = ["Movie", "Series", "Mini Series"];
const SORT_OPTIONS = [
  { label: "Top Rated", value: "rating", icon: "star" },
  { label: "Newest", value: "newest", icon: "time" },
  { label: "Oldest", value: "oldest", icon: "hourglass" },
];

const DiscoverSkeleton = React.memo(() => (
  <View style={{ flex: 1, backgroundColor: '#0a0a0f' }}>
    <SkeletonLoader width={SCREEN_W} height={SCREEN_H} borderRadius={0} />
    <View style={{ position: 'absolute', bottom: 120, left: 20, right: 20 }}>
      <SkeletonLoader width={200} height={30} style={{ marginBottom: 12 }} />
      <SkeletonLoader width={150} height={15} style={{ marginBottom: 8 }} />
      <SkeletonLoader width={100} height={15} style={{ marginBottom: 20 }} />
      <View style={{ flexDirection: 'row', gap: 15 }}>
        <SkeletonLoader width={120} height={50} borderRadius={25} />
        <SkeletonLoader width={50} height={50} borderRadius={25} />
        <SkeletonLoader width={50} height={50} borderRadius={25} />
      </View>
    </View>
  </View>
));

// ─── Discover Feed Card ────────────────────────────────────────────────────────
const DiscoverCard = React.memo(({ 
  item, 
  index, 
  isActive, 
  onPress, 
  onSave,
  isSaved,
  isMuted,
  onToggleMute,
  playerMode,
  isFocused,
  isModalOpen
}: { 
  item: Movie | Series; 
  index: number; 
  isActive: boolean; 
  onPress: () => void;
  onSave: () => void;
  isSaved: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
  playerMode: string;
  isFocused: boolean;
  isModalOpen: boolean;
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    if (isActive) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 20,
          friction: 7,
          useNativeDriver: true,
        })
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.95);
    }
  }, [isActive]);

  return (
    <View style={styles.cardContainer}>
      <Image
        source={{ uri: item.poster }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />

      {isActive && item.previewUrl && (
        <View style={styles.videoWrapper}>
          <Video
            source={{ uri: item.previewUrl }}
            style={styles.previewVideo}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay={isActive && isFocused && !isModalOpen && playerMode === 'closed'}
            isLooping
            isMuted={isMuted}
          />
        </View>
      )}
      
      {/* Immersive Overlays */}
      <LinearGradient
        colors={['rgba(10,10,15,0.2)', 'rgba(10,10,15,0.5)', 'rgba(10,10,15,1)']}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View style={[styles.cardContent, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        {/* VJ Badge */}
        {item.vj && (
          <View style={styles.vjBadge}>
            <View style={styles.vjBadgeSheen} />
            <Ionicons name="mic-outline" size={12} color="#fff" style={{ marginRight: 4 }} />
            <Text style={styles.vjBadgeText}>{item.vj.toUpperCase()}</Text>
          </View>
        )}

        <Text style={styles.cardTitle}>{item.title}</Text>
        
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{item.year}</Text>
          <View style={styles.metaDot} />
          <Text style={styles.metaText}>{item.genre}</Text>
          {item.rating && (
            <>
              <View style={styles.metaDot} />
              <Ionicons name="star" size={12} color="#FFD700" style={{ marginRight: 2 }} />
              <Text style={styles.metaText}>{item.rating}</Text>
            </>
          )}
        </View>

        <Text style={styles.cardDesc} numberOfLines={2}>
          {item.description || "Discover the latest cinematic experience. Tap to explore more details and start watching."}
        </Text>

        <View style={styles.actionRow}>
          <TouchableOpacity 
            style={styles.mainPlayBtn}
            onPress={onPress}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#5B5FEF', '#484BD3']}
              style={StyleSheet.absoluteFill}
            />
            <Ionicons name="play" size={24} color="#fff" />
            <Text style={styles.mainPlayText}>Watch Now</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.iconCircleBtn, isSaved && { backgroundColor: 'rgba(91, 95, 239, 0.4)', borderColor: '#5B5FEF' }]}
            onPress={onSave}
          >
            <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFill} />
            <Ionicons name={isSaved ? "checkmark" : "add"} size={24} color="#fff" />
          </TouchableOpacity>


          {item.previewUrl && (
            <TouchableOpacity 
              style={[styles.iconCircleBtn, { marginLeft: 'auto' }]}
              onPress={onToggleMute}
            >
              <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFill} />
              <Ionicons name={isMuted ? "volume-mute" : "volume-high"} size={20} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    </View>
  );
});

// ─── Discovery Screen ──────────────────────────────────────────────────────────
export default function CategoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { allMovies, allSeries, loading } = useMovies();
  const { 
    favorites, toggleFavorite, isGuest, isPreview, setIsPreview,
    playerMode, setPlayerMode, playerTitle, setPlayerTitle,
    selectedVideoUrl, setSelectedVideoUrl, playerPos, playerSize,
    isPaid, allMoviesFree, setPlayingNow
  } = useSubscription();
  const isFocused = useIsFocused();
  const flatListRef = useRef<FlatList>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [previewMovie, setPreviewMovie] = useState<Movie | Series | null>(null);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  // Filter States
  const [selectedVJ, setSelectedVJ] = useState<string | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<"Movie" | "Series" | "Mini Series" | null>(null);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "rating" | null>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);

  const resetFilters = () => {
    setSelectedVJ(null);
    setSelectedGenre(null);
    setSelectedType(null);
    setSelectedYear(null);
    setSortBy(null);
  };


  // Prepare filtered items for the feed
  const discoverItems = useMemo(() => {
    let filtered = [...(allMovies || []), ...(allSeries || [])];

    if (selectedVJ) {
      const vjQ = selectedVJ.toLowerCase().trim();
      const vjName = vjQ.startsWith("vj ") ? vjQ : "vj " + vjQ;
      filtered = filtered.filter(m => {
        const mVJ = (m.vj || "").toLowerCase().trim();
        return mVJ === vjQ || mVJ === vjName || mVJ.includes(vjQ);
      });
    }
    if (selectedGenre) {
      filtered = filtered.filter(m => (m.genre || "").toLowerCase().includes(selectedGenre.toLowerCase()));
    }
    if (selectedType) {
      filtered = filtered.filter(m => {
        const isSeries = "seasons" in m;
        if (selectedType === "Movie") return !isSeries;
        if (selectedType === "Series") return isSeries && !(m as any).isMiniSeries;
        if (selectedType === "Mini Series") return isSeries && !!(m as any).isMiniSeries;
        return true;
      });
    }
    if (selectedYear) {
      filtered = filtered.filter(m => String(m.year) === selectedYear);
    }

    if (sortBy === "newest") filtered.sort((a, b) => b.year - a.year);
    else if (sortBy === "oldest") filtered.sort((a, b) => a.year - b.year);
    else if (sortBy === "rating") filtered.sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating));
    else filtered.sort(() => Math.random() - 0.5);

    return filtered;
  }, [allMovies, allSeries, selectedVJ, selectedGenre, selectedType, selectedYear, sortBy]);

  // Scroll to top when filters change
  useEffect(() => {
    if (flatListRef.current && discoverItems.length > 0) {
      flatListRef.current.scrollToOffset({ offset: 0, animated: false });
    }
  }, [selectedVJ, selectedGenre, selectedType, selectedYear, sortBy]);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50
  }).current;

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index || 0);
    }
  }).current;

  useEffect(() => {
    const isVisible = !!previewMovie || showFilterModal || playerMode === 'full';
    DeviceEventEmitter.emit('setOverlayVisible', isVisible);
    
    // Auto-dismiss preview modal if video starts playing
    if (playerMode === 'full' && previewMovie) {
      setPreviewMovie(null);
    }
  }, [previewMovie, showFilterModal, playerMode]);

  const handleItemPress = (item: Movie | Series) => {
    const isSeries = "seasons" in item || "episodeList" in item;
    
    if (!isSeries) {
      // Check for subscription/access
      const canWatch = allMoviesFree || (item as any).isFree || isPaid;
      if (!canWatch) {
        setShowPremiumModal(true);
        return;
      }

      // Direct to full screen player for movies
      setPlayerTitle(item.title);
      setSelectedVideoUrl((item as Movie).videoUrl);
      setPlayingNow(item as Movie);
      setPlayerMode('full');
    } else {
      // Show preview modal for series
      setPreviewMovie(item);
    }
  };

  if (loading) {
    return <DiscoverSkeleton />;
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Main Discover Feed */}
      <FlatList
        ref={flatListRef}
        data={discoverItems}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={SCREEN_H}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={80} color="rgba(255,255,255,0.1)" />
            <Text style={styles.emptyText}>No matches found</Text>
            <TouchableOpacity style={styles.resetInlineBtn} onPress={resetFilters}>
              <Text style={styles.resetInlineText}>Clear All Filters</Text>
            </TouchableOpacity>
          </View>
        )}
        renderItem={({ item, index }) => (
          <DiscoverCard 
            item={item} 
            index={index} 
            isActive={index === activeIndex}
            isSaved={favorites.some(f => f.id === item.id)}
            isMuted={isMuted}
            playerMode={playerMode}
            isFocused={isFocused}
            isModalOpen={!!previewMovie || showFilterModal || showPremiumModal || showPlanModal}
            onToggleMute={() => setIsMuted(!isMuted)}
            onPress={() => handleItemPress(item)}
            onSave={() => toggleFavorite(item)}
          />
        )}
      />

      {/* Top Header Controls */}
      <View style={[styles.headerControls, { top: insets.top + 10 }]}>
        <View style={styles.discoverTitleWrap}>
          <Text style={styles.discoverTitle}>DISCOVER</Text>
          <View style={styles.activeDot} />
        </View>

        <TouchableOpacity 
          style={[styles.filterBtn, (selectedVJ || selectedGenre) && styles.filterBtnActive]}
          onPress={() => setShowFilterModal(true)}
        >
          <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
          <Ionicons 
            name={(selectedVJ || selectedGenre) ? "options" : "options-outline"} 
            size={22} 
            color={(selectedVJ || selectedGenre) ? "#5B5FEF" : "#fff"} 
          />
          <Text style={[styles.filterBtnText, (selectedVJ || selectedGenre) && { color: '#5B5FEF' }]}>
            {(selectedVJ || selectedGenre) ? "Active" : "Filters"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Preview Modal */}
      {previewMovie && (
        <MoviePreviewModal
          visible={playerMode !== 'full'}
          movie={previewMovie}
          hideSearchBy={true}
          onClose={() => setPreviewMovie(null)}
          onShowPremium={() => setShowPremiumModal(true)}
          playerMode={playerMode}
          setPlayerMode={setPlayerMode}
          setSelectedVideoUrl={setSelectedVideoUrl}
          setPlayerTitle={setPlayerTitle}
          selectedVideoUrl={selectedVideoUrl}
          playerTitle={playerTitle}
          playerPos={playerPos}
          playerSize={playerSize}
          isPreview={isPreview}
          setIsPreview={setIsPreview}
          onSwitch={(m: any) => {
            setPreviewMovie(null);
            setTimeout(() => {
              setPlayerTitle(m.title);
              setSelectedVideoUrl(m.videoUrl || m.episodeList?.[0]?.url || "");
              setPlayerMode('full');
            }, 200);
          }}
        />
      )}

      {/* Filter Modal (VJ/Genre Selection) */}
      <Modal
        visible={showFilterModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowFilterModal(false)}
      >
        <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={styles.filterModalHeader}>
              <View>
                <Text style={styles.filterModalTitle}>HUB FILTERS</Text>
                <Text style={styles.filterModalSubtitle}>
                  {discoverItems.length} matching titles found
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {(selectedVJ || selectedGenre || selectedType || selectedYear || sortBy) && (
                  <TouchableOpacity 
                    style={styles.closeModalBtn}
                    onPress={resetFilters}
                  >
                    <Ionicons name="refresh" size={24} color="#fff" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity 
                  style={styles.closeModalBtn}
                  onPress={() => setShowFilterModal(false)}
                >
                  <Ionicons name="close" size={28} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView 
              style={styles.filterModalContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.filterSection}>
                <View style={styles.filterSectionHeader}>
                  <Text style={styles.filterSectionTitle}>BROWSE BY VJ</Text>
                  {selectedVJ && (
                    <TouchableOpacity onPress={() => setSelectedVJ(null)}>
                      <Text style={styles.clearText}>Clear</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                  {VJ_PROFILES.map(vj => (
                    <TouchableOpacity 
                      key={vj.name}
                      style={[styles.vjFilterCard, selectedVJ === vj.name && styles.activeFilterCard]}
                      onPress={() => setSelectedVJ(vj.name)}
                    >
                      <Image 
                        source={{ uri: vj.image }} 
                        style={[styles.vjFilterImg, selectedVJ === vj.name && styles.activeFilterImg]} 
                      />
                      <Text style={[styles.vjFilterName, selectedVJ === vj.name && styles.activeFilterText]}>
                        {vj.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.filterSection}>
                <View style={styles.filterSectionHeader}>
                  <Text style={styles.filterSectionTitle}>EXPLORE GENRES</Text>
                  {selectedGenre && (
                    <TouchableOpacity onPress={() => setSelectedGenre(null)}>
                      <Text style={styles.clearText}>Clear</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={styles.genreGrid}>
                  {GENRES.map(g => (
                    <TouchableOpacity 
                      key={g.id}
                      style={[styles.genreFilterBtn, selectedGenre === g.name && styles.activeGenreBtn]}
                      onPress={() => setSelectedGenre(g.name === selectedGenre ? null : g.name)}
                    >
                      <Text style={[styles.genreFilterText, selectedGenre === g.name && styles.activeFilterText]}>
                        {g.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.filterSection}>
                <View style={styles.filterSectionHeader}>
                  <Text style={styles.filterSectionTitle}>CONTENT TYPE</Text>
                  {selectedType && (
                    <TouchableOpacity onPress={() => setSelectedType(null)}>
                      <Text style={styles.clearText}>Clear</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={styles.genreGrid}>
                  {TYPES.map(t => (
                    <TouchableOpacity 
                      key={t}
                      style={[styles.genreFilterBtn, selectedType === t && styles.activeGenreBtn]}
                      onPress={() => setSelectedType(t as any)}
                    >
                      <Text style={[styles.genreFilterText, selectedType === t && styles.activeFilterText]}>
                        {t}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.filterSection}>
                <View style={styles.filterSectionHeader}>
                  <Text style={styles.filterSectionTitle}>RELEASE YEAR</Text>
                  {selectedYear && (
                    <TouchableOpacity onPress={() => setSelectedYear(null)}>
                      <Text style={styles.clearText}>Clear</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                  {YEARS.map(year => (
                    <TouchableOpacity 
                      key={year}
                      style={[styles.yearFilterBtn, selectedYear === year && styles.activeGenreBtn]}
                      onPress={() => setSelectedYear(year === selectedYear ? null : year)}
                    >
                      <Text style={[styles.genreFilterText, selectedYear === year && styles.activeFilterText]}>
                        {year}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.filterSection}>
                <View style={styles.filterSectionHeader}>
                  <Text style={styles.filterSectionTitle}>SORT RESULTS</Text>
                  {sortBy && (
                    <TouchableOpacity onPress={() => setSortBy(null)}>
                      <Text style={styles.clearText}>Clear</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={styles.sortGrid}>
                  {SORT_OPTIONS.map(opt => (
                    <TouchableOpacity 
                      key={opt.value}
                      style={[styles.sortBtn, sortBy === opt.value && styles.activeGenreBtn]}
                      onPress={() => setSortBy(opt.value as any)}
                    >
                      <Ionicons name={opt.icon as any} size={18} color={sortBy === opt.value ? "#fff" : "rgba(255,255,255,0.4)"} style={{ marginRight: 8 }} />
                      <Text style={[styles.genreFilterText, sortBy === opt.value && styles.activeFilterText]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={{ height: 100 }} />
            </ScrollView>

            <View style={styles.filterFooter}>
              <TouchableOpacity 
                style={styles.applyBtn}
                onPress={() => setShowFilterModal(false)}
              >
                <LinearGradient colors={['#5B5FEF', '#484BD3']} style={StyleSheet.absoluteFill} />
                <Text style={styles.applyBtnText}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </BlurView>
      </Modal>

      <PremiumAccessModal
        visible={showPremiumModal}
        isGuest={isGuest}
        onClose={() => setShowPremiumModal(false)}
        onUpgrade={() => {
          setShowPremiumModal(false);
          setShowPlanModal(true);
        }}
      />

      <PlanSelectionModal 
        visible={showPlanModal}
        onClose={() => setShowPlanModal(false)}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0f",
  },
  cardContainer: {
    width: SCREEN_W,
    height: SCREEN_H,
    backgroundColor: '#000',
  },
  videoWrapper: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingBottom: 100, // Balanced with bottom text
  },
  previewVideo: {
    width: SCREEN_W,
    height: SCREEN_W * (9 / 16),
  },
  cardContent: {
    position: 'absolute',
    bottom: 155, // Lifted to clear tab bar
    left: 20,
    right: 20,
  },
  vjBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(91, 95, 239, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(91, 95, 239, 0.4)',
    overflow: 'hidden',
  },
  vjBadgeSheen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  vjBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 34,
    fontWeight: '900',
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  metaText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '600',
  },
  metaDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 8,
  },
  cardDesc: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mainPlayBtn: {
    flex: 1,
    height: 54,
    borderRadius: 27,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  mainPlayText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    marginLeft: 8,
  },
  iconCircleBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  headerControls: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  discoverTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  discoverTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 2,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#5B5FEF',
    marginLeft: 6,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  filterBtnActive: {
    borderColor: '#5B5FEF',
    shadowColor: '#5B5FEF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 10,
  },
  filterBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
  },
  filterModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  filterModalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
  },
  filterModalContent: {
    flex: 1,
    alignItems: 'center',
    padding: 20,
  },
  filterModalSubtitle: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  closeModalBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterSection: {
    marginBottom: 32,
  },
  filterSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  filterSectionTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },
  clearText: {
    color: '#5B5FEF',
    fontSize: 12,
    fontWeight: '800',
  },
  vjFilterCard: {
    width: 90,
    alignItems: 'center',
  },
  vjFilterImg: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 2,
    borderColor: 'transparent',
    marginBottom: 8,
  },
  activeFilterCard: {
    opacity: 1,
  },
  activeFilterImg: {
    borderColor: '#5B5FEF',
  },
  vjFilterName: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  genreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  genreFilterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  genreFilterText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '700',
  },
  activeGenreBtn: {
    backgroundColor: 'rgba(91, 95, 239, 0.2)',
    borderColor: '#5B5FEF',
  },
  activeFilterText: {
    color: '#fff',
  },
  filterFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: '#0a0a0f',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  applyBtn: {
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  applyBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  yearFilterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    minWidth: 70,
    alignItems: 'center',
  },
  sortGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    flex: 1,
    minWidth: '45%',
  },
  emptyState: {
    height: SCREEN_H,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 30,
  },
  resetInlineBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    backgroundColor: 'rgba(91, 95, 239, 0.2)',
    borderWidth: 1,
    borderColor: '#5B5FEF',
  },
  resetInlineText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  }
});
