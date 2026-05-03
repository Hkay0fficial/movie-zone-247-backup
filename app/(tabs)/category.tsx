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
  useWindowDimensions,
  TextInput,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Movie, Series } from "@/constants/movieData";
import { MoviePreviewModal } from "./index";
import { GridModal, GridContent } from "../../components/GridComponents";
import { SkeletonLoader, SkeletonRow } from "../../components/SkeletonLoader";
import { useMovies } from "@/app/context/MovieContext";
import { FilterChips } from '../../components/FilterChips';
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
import { useDownloads } from "@/app/context/DownloadContext";

// ─── Constants ───────────────────────────────────────────────────────────────
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");



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
  isModalOpen,
  screenWidth,
  screenHeight,
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
  screenWidth: number;
  screenHeight: number;
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
    <View style={[styles.cardContainer, { width: screenWidth, height: screenHeight }]}>
      <Image
        source={{ uri: item.poster }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />

      {isActive && item.previewUrl && (
        <View style={styles.videoWrapper}>
          <Video
            source={{ uri: item.previewUrl }}
            style={{ width: screenWidth, height: screenWidth * (9/16) }}
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

      <Animated.View style={[styles.cardContent, { bottom: screenHeight * 0.18, opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
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
            <Ionicons name={isSaved ? "checkmark" : "add"} size={24} color="#fff" />
          </TouchableOpacity>


          {item.previewUrl && (
            <TouchableOpacity 
              style={[styles.iconCircleBtn, { marginLeft: 'auto' }]}
              onPress={onToggleMute}
            >
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
  const isFocused = useIsFocused();
  const { width: windowW, height: windowH } = useWindowDimensions();
  const { 
    allMovies, allSeries, loading,
    selectedVJ, setSelectedVJ,
    selectedGenre, setSelectedGenre,
    selectedType, setSelectedType,
    selectedYear, setSelectedYear,
    sortBy, setSortBy,
    minRating, setMinRating,
    searchQuery, setSearchQuery,
    clearFilters
  } = useMovies();

  const { 
    favorites, toggleFavorite, isGuest, isPreview, setIsPreview,
    playerMode, setPlayerMode, playerTitle, setPlayerTitle,
    selectedVideoUrl, setSelectedVideoUrl, playerPos, playerSize,
    isPaid, allMoviesFree, setPlayingNow
  } = useSubscription();

  const DiscoverSkeleton = React.memo(() => {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0a0f' }}>
        <View style={{ flex: 1 }}>
           <SkeletonLoader width={windowW} height={windowH} borderRadius={0} />
           <View style={{ position: 'absolute', bottom: 100, left: 20, right: 20, gap: 15 }}>
              <SkeletonLoader width="60%" height={32} />
              <SkeletonLoader width="40%" height={16} />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <SkeletonLoader width={120} height={45} borderRadius={25} />
                <SkeletonLoader width={45} height={45} borderRadius={23} />
              </View>
           </View>
        </View>
      </View>
    );
  });

  const [showFilterModal, setShowFilterModal] = useState(false);
  const [previewMovie, setPreviewMovie] = useState<Movie | Series | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);


  // Calculate Genre Counters
  const genreCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const pool = [...(allMovies || []), ...(allSeries || [])];
    pool.forEach(item => {
      const g = item.genre || "Other";
      if (counts[g]) counts[g]++;
      else counts[g] = 1;
    });
    return counts;
  }, [allMovies, allSeries]);


  // Prepare filtered items for the feed
  const discoverItems = useMemo(() => {
    let filtered = [...(allMovies || []), ...(allSeries || [])];

    // Note: The global context already filters allMovies/allSeries, 
    // but the feed here needs the items that match the filters.
    // Actually, in MovieContext we filter `allContent`.
    // Let's use the raw data and apply filters here to keep the Discovery feed independent 
    // IF desired, but the user said "filter the entire app".
    // So allRows etc. in Home are already filtered.
    // We'll just use the already filtered content from context.
    return filtered;
  }, [allMovies, allSeries]);

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

      {/* Main Discover Feed */}
      <FlatList
        ref={flatListRef}
        data={discoverItems}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={windowH}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={80} color="rgba(255,255,255,0.1)" />
            <Text style={styles.emptyText}>No matches found</Text>
            <TouchableOpacity style={styles.resetInlineBtn} onPress={clearFilters}>
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
            screenWidth={windowW}
            screenHeight={windowH}
          />
        )}
      />

      <View style={[styles.headerControls, { top: insets.top + 10 }]}>
        <View style={styles.headerTopRow}>
          <View style={styles.searchBarWrap}>
            <Ionicons name="search" size={20} color="rgba(255,255,255,0.4)" style={{ marginLeft: 12 }} />
            <TextInput
              style={styles.searchBarInput}
              placeholder="Search movies, series..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.4)" style={{ marginRight: 10 }} />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity 
            style={[styles.filterBtn, (selectedVJ || selectedGenre || selectedType || selectedYear || minRating > 0) && styles.filterBtnActive]}
            onPress={() => setShowFilterModal(true)}
          >
            <Ionicons 
              name={(selectedVJ || selectedGenre || selectedType || selectedYear || minRating > 0) ? "options" : "options-outline"} 
              size={22} 
              color={(selectedVJ || selectedGenre || selectedType || selectedYear || minRating > 0) ? "#5B5FEF" : "#fff"} 
            />
          </TouchableOpacity>
        </View>

        <FilterChips 
          filters={{
            vj: selectedVJ,
            genre: selectedGenre,
            type: selectedType,
            year: selectedYear,
            rating: minRating,
            search: searchQuery
          }}
          onClear={(key) => {
            if (key === 'vj') setSelectedVJ(null);
            if (key === 'genre') setSelectedGenre(null);
            if (key === 'type') setSelectedType(null);
            if (key === 'year') setSelectedYear(null);
            if (key === 'rating') setMinRating(0);
            if (key === 'search') setSearchQuery("");
          }}
          onClearAll={clearFilters}
          containerStyle={{ marginTop: 12 }}
        />
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
                      <Text style={styles.genreCountText}>{genreCounts[g.name] || 0}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.filterSection}>
                <View style={styles.filterSectionHeader}>
                  <Text style={styles.filterSectionTitle}>MINIMUM RATING</Text>
                  {minRating > 0 && (
                    <TouchableOpacity onPress={() => setMinRating(0)}>
                      <Text style={styles.clearText}>Clear</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={styles.ratingRow}>
                  {[0, 6, 7, 8, 9].map(r => (
                    <TouchableOpacity 
                      key={r}
                      style={[styles.ratingBtn, minRating === r && styles.activeGenreBtn]}
                      onPress={() => setMinRating(r)}
                    >
                      <Text style={[styles.genreFilterText, minRating === r && styles.activeFilterText]}>
                        {r === 0 ? "Any" : `${r}+ ★`}
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
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.22)',
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
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  headerControls: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 10,
  },
  searchBarWrap: {
    flex: 1,
    height: 44,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  searchBarInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 10,
  },
  chipsRow: {
    marginTop: 5,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(91, 95, 239, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#5B5FEF',
  },
  chipText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  genreCountText: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#5B5FEF',
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  ratingBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
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
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.25)',
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
    borderWidth: StyleSheet.hairlineWidth,
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
    borderWidth: StyleSheet.hairlineWidth,
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
    borderWidth: StyleSheet.hairlineWidth,
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
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#5B5FEF',
  },
  resetInlineText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  }
});
