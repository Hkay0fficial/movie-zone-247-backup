import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  TextInput,
  Animated,
  KeyboardAvoidingView,
  Keyboard,
  Easing,
  DeviceEventEmitter,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { FloatingBackButton } from "../../components/FloatingBackButton";
import { Movie, Series, ALL_GENRES, ALL_VJS } from '@/constants/movieData';
import { useMovies } from '@/app/context/MovieContext';
import { useSubscription } from '@/app/context/SubscriptionContext';
import { useIsFocused, useFocusEffect } from "@react-navigation/native";
import { useUser } from '../context/UserContext';
import { MoviePreviewModal } from "./index";
import { useRouter } from "expo-router";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

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
            ] as any}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[StyleSheet.absoluteFill, { transform: [{ skewX: '-20deg' }] }]}
          />
        </Animated.View>
      )}
    </View>
  );
});

const GridSkeleton = React.memo(() => (
  <View style={{ paddingHorizontal: 15, paddingTop: 20 }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
      {[1, 2].map((i) => (
        <SkeletonLoader key={i} width={(SCREEN_W - 45) / 2} height={250} borderRadius={20} />
      ))}
    </View>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      {[1, 2].map((i) => (
        <SkeletonLoader key={i} width={(SCREEN_W - 45) / 2} height={250} borderRadius={20} />
      ))}
    </View>
  </View>
));

import { resolveCDNUrl } from '@/constants/bunnyConfig';

const normalizeSearchValue = (value: any) =>
  String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const compactSearchValue = (value: any) => normalizeSearchValue(value).replace(/\s+/g, '');

const getContentPartCount = (item: Movie | Series) => {
  const rawCount = Number((item as any).episodes || 0);
  const multiplier = Number((item as any).episodesPerPart || 1);
  const episodeListCount = Array.isArray((item as any).episodeList)
    ? (item as any).episodeList.length * multiplier
    : 0;
  const partsCount = Array.isArray((item as any).parts)
    ? (item as any).parts.length * multiplier
    : 0;

  return Math.max(Number.isFinite(rawCount) ? rawCount : 0, episodeListCount, partsCount);
};

// ─── Search Result Card ───────────────────────────────────────────────────────
function ResultCard({ item, onPress }: { item: Movie | Series; onPress: () => void }) {
  const isSeries = 'seasons' in item;
  const partCount = getContentPartCount(item);

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={onPress}
    >
      <View style={styles.cardInner}>
        <Image source={{ uri: resolveCDNUrl(item.poster) }} style={styles.cardPoster} />
        <LinearGradient
          colors={['transparent', 'rgba(10,10,15,0.95)'] as any}
          style={styles.cardGradient}
        />
        {(isSeries || partCount > 1) && (
          <View style={styles.partBadge}>
            <Ionicons name="ellipsis-horizontal" size={9} color="#fff" style={{ marginRight: 2 }} />
            <Text style={styles.partBadgeText}>
              {partCount || 1} {isSeries ? 'EP' : partCount === 1 ? 'PART' : 'PARTS'}
            </Text>
          </View>
        )}
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          <View style={styles.cardMeta}>
            <Text style={styles.cardMetaText}>
              {item.year} · {isSeries ? ((item as Series).isMiniSeries ? "Mini Series" : `Season ${(item as Series).seasons}`) : item.duration}
            </Text>
          </View>
          <View style={styles.vjBadge}>
            <Text style={styles.vjText}>{item.vj}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Search Screen ────────────────────────────────────────────────────────────

export default function SearchScreen() {
  const router = useRouter();
  const { allMovies, allSeries, loading, selectedGenre, setSelectedGenre, selectedVJ, setSelectedVJ } = useMovies();
  const { setPlayingNow, setPlayerTitle, setSelectedVideoUrl, setPlayerMode, playerMode } = useSubscription();
  const { profile } = useUser();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isStackLoading, setIsStackLoading] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [profile?.profilePhoto]);

  const getInitials = (name: string) => {
    if (!name) return '?';
    const names = name.trim().split(/\s+/);
    if (names.length === 1) {
      return names[0].substring(0, 2).toUpperCase();
    }
    return (names[0][0] + names[1][0]).toUpperCase();
  };

  // ─── Stack-based Navigation ───
  const [navigationStack, setNavigationStack] = useState<(Movie | Series)[]>([]);
  const navigationStackRef = useRef<(Movie | Series)[]>([]);

  useEffect(() => {
    navigationStackRef.current = navigationStack;
  }, [navigationStack]);

  // Flatten all movies and series for searching
  const allContent = React.useMemo(() => {
    const seen = new Set<string>();
    const pool: (Movie | Series)[] = [];

    [...(allMovies || []), ...(allSeries || [])].forEach(item => {
      if (item && item.id && !seen.has(item.id)) {
        seen.add(item.id);
        pool.push(item);
      }
    });

    return pool;
  }, [allMovies, allSeries]);

  const handleSearch = useCallback((text: string) => {
    setQuery(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    
    if (!text.trim()) {
      setDebouncedQuery('');
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchTimeout.current = setTimeout(() => {
      setDebouncedQuery(text.toLowerCase().trim());
      setIsSearching(false);
    }, 300);
  }, []);

  const displayResults = React.useMemo(() => {
    let results = allContent;

    if (selectedVJ) {
      const vjFilter = normalizeSearchValue(selectedVJ);
      results = results.filter(item => normalizeSearchValue(item.vj).includes(vjFilter));
    }

    if (selectedGenre) {
      const genreFilter = normalizeSearchValue(selectedGenre);
      results = results.filter(item => normalizeSearchValue(item.genre).includes(genreFilter));
    }

    if (!debouncedQuery) return results;

    const compactQuery = compactSearchValue(debouncedQuery);

    return results.filter(item => {
      const title = normalizeSearchValue(item.title);
      const compactTitle = compactSearchValue(item.title);
      const genre = normalizeSearchValue(item.genre);
      const vj = normalizeSearchValue(item.vj);
      const year = String(item.year || '');
      const description = normalizeSearchValue((item as any).description);
      const episodeText = Array.isArray((item as any).episodeList)
        ? normalizeSearchValue((item as any).episodeList.map((ep: any) => `${ep.title || ''} ${ep.episode || ''} ${ep.season || ''}`).join(' '))
        : '';

      return title.includes(debouncedQuery) ||
        compactTitle.includes(compactQuery) ||
        genre.includes(debouncedQuery) ||
        vj.includes(debouncedQuery) ||
        year.includes(debouncedQuery) ||
        description.includes(debouncedQuery) ||
        episodeText.includes(debouncedQuery);
    });
  }, [allContent, debouncedQuery, selectedGenre, selectedVJ]);

  const hasFilters = Boolean(selectedGenre || selectedVJ || debouncedQuery.length > 0);

  const openPreview = useCallback((item: Movie | Series) => {
    setIsStackLoading(true);
    setNavigationStack(prev => [...prev, item]);
    setTimeout(() => setIsStackLoading(false), 600);
  }, []);

  const clearOneSearchStep = useCallback(() => {
    if (query.length > 0 || debouncedQuery.length > 0) {
      setQuery('');
      setDebouncedQuery('');
      return true;
    }
    if (selectedGenre) {
      setSelectedGenre(null);
      return true;
    }
    if (selectedVJ) {
      setSelectedVJ(null);
      return true;
    }
    return false;
  }, [debouncedQuery.length, query.length, selectedGenre, selectedVJ, setSelectedGenre, setSelectedVJ]);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        // 1. If in full screen, consume the event here too.
        // Some Android devices miss the player's listener during orientation/timing changes.
        if (playerMode === 'full') {
          setPlayerMode('closed');
          return true;
        }

        // 2. Pop Navigation Stack (Previews)
        if (navigationStackRef.current.length > 0) {
          setNavigationStack(prev => prev.slice(0, -1));
          return true;
        }

        // 3. Handle local search state
        if (hasFilters && clearOneSearchStep()) {
          return true;
        }

        // 4. Navigate back to Home tab
        router.navigate('/(tabs)');
        return true;
      };
      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [clearOneSearchStep, hasFilters, playerMode, router, setPlayerMode])
  );

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent />

      {/* ── Vibrant Background ── */}
      <View style={StyleSheet.absoluteFill}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#050508' }]} />
        <LinearGradient
          colors={['rgba(91,95,239,0.15)', 'transparent', 'rgba(139,92,246,0.1)'] as any}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <SafeAreaView style={{ flex: 1 }}>
        <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
          <TouchableOpacity
            onPress={() => {
              if (hasFilters && clearOneSearchStep()) {
                return;
              } else {
                router.back();
              }
            }}
            style={styles.backBtn}
          >
            <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>EXPLORE CONTENT</Text>
          {!imageError && profile?.profilePhoto ? (
            <Image 
              source={{ uri: profile.profilePhoto }} 
              style={styles.profilePic} 
              onError={() => setImageError(true)}
            />
          ) : (
            <View style={[styles.profilePic, { backgroundColor: '#161622', alignItems: 'center', justifyContent: 'center', borderColor: '#5B5FEF' }]}>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>
                {getInitials(profile?.fullName)}
              </Text>
            </View>
          )}
        </Animated.View>

        <View style={{ marginBottom: 15 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 10, marginBottom: 10 }}>
            {['All', ...ALL_VJS].map(vj => {
               const isActive = selectedVJ === vj || (vj === 'All' && !selectedVJ);
               return (
                 <TouchableOpacity 
                   key={vj} 
                   onPress={() => setSelectedVJ(vj === 'All' ? null : vj)}
                   style={[styles.pill, isActive && styles.pillActive]}
                 >
                   <Text style={[styles.pillText, isActive && styles.pillTextActive]}>{vj === 'All' ? 'All VJs' : vj}</Text>
                 </TouchableOpacity>
               );
            })}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
            {['All', ...ALL_GENRES].map(genre => {
               const isActive = selectedGenre === genre || (genre === 'All' && !selectedGenre);
               return (
                 <TouchableOpacity 
                   key={genre} 
                   onPress={() => setSelectedGenre(genre === 'All' ? null : genre)}
                   style={[styles.pill, isActive && styles.pillActive]}
                 >
                   <Text style={[styles.pillText, isActive && styles.pillTextActive]}>{genre === 'All' ? 'All Genres' : genre}</Text>
                 </TouchableOpacity>
               );
            })}
          </ScrollView>
        </View>

        {loading || isSearching ? (
          <GridSkeleton />
        ) : !hasFilters ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <LinearGradient
                colors={['#5B5FEF', '#8B5CF6'] as any}
                style={StyleSheet.absoluteFill}
              />
              <Ionicons name="search" size={40} color="#fff" />
            </View>
            <Text style={styles.emptyTitle}>What are you looking for?</Text>
            <Text style={styles.emptyDesc}>
              Search for your favorite movies, series, or VJs to start watching.
            </Text>

          </View>
        ) : displayResults.length === 0 ? (
          <View style={styles.premiumEmptyContainer}>
            <View style={styles.emptyIconGlow}>
              <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
              <Ionicons name="search-outline" size={50} color="rgba(91,95,239,0.8)" />
            </View>
            <Text style={styles.premiumEmptyTitle}>No Results Found</Text>
            <Text style={styles.premiumEmptyDesc}>
              We couldn&apos;t find any movies or series matching &quot;{query}&quot;. Try searching for VJs or different genres.
            </Text>

          </View>
        ) : (
          <FlatList
            data={displayResults}
            keyExtractor={(item) => item.id}
            numColumns={2}
            contentContainerStyle={styles.gridContainer}
            renderItem={({ item }) => (
              <ResultCard
                item={item}
                onPress={() => openPreview(item)}
              />
            )}
            ListHeaderComponent={() => (
              <Text style={styles.resultsCount}>
                {displayResults.length} {displayResults.length === 1 ? 'RESULT' : 'RESULTS'} FOUND
              </Text>
            )}
          />
        )}

        <FloatingBackButton
          visible={hasFilters && navigationStack.length === 0}
          onPress={() => {
            clearOneSearchStep();
          }}
          label="CLEAR SEARCH"
        />

        {/* ── Floating Search Pill (Indigo Glass) ── */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[
            styles.searchPillContainer,
            { bottom: Math.max(insets.bottom, 12) + 8 }
          ]}
        >
          <BlurView intensity={80} tint="dark" style={styles.searchPill}>
            <LinearGradient
              colors={['rgba(91,95,239,0.3)', 'rgba(139,92,246,0.1)'] as any}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            <Ionicons name="search" size={20} color="rgba(255,255,255,0.6)" style={{ marginLeft: 16 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search movies, series, VJs..."
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={query}
              onChangeText={handleSearch}
              selectionColor="#5B5FEF"
              autoFocus
            />
            {isSearching ? (
              <ActivityIndicator size="small" color="#5B5FEF" style={{ marginRight: 16 }} />
            ) : query.length > 0 && (
              <TouchableOpacity onPress={() => handleSearch('')} style={styles.clearBtn}>
                <Ionicons name="close-circle" size={20} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            )}
          </BlurView>
        </KeyboardAvoidingView>

        {/* ── Preview Modal Stack ── */}
        {navigationStack.map((item, index) => (
          <MoviePreviewModal
            key={`${item.id}-${index}`}
            visible={playerMode !== 'full'}
            movie={item}
            hideSearchBy={true}
            onClose={() => {
              setNavigationStack(prev => {
                const newStack = [...prev];
                newStack.splice(index, 1);
                return newStack;
              });
            }}
            playerMode={playerMode}
            setPlayerMode={setPlayerMode}
            setSelectedVideoUrl={setSelectedVideoUrl}
            setPlayerTitle={setPlayerTitle}
            onSwitch={(m: any) => {
              openPreview(m);
            }}
            playingNow={null} // Managed by global context
            setPlayingNow={setPlayingNow}
          />
        ))}

        {isStackLoading && (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10, 10, 15, 0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 10001 }]}>
             <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
             <View style={{ backgroundColor: 'rgba(26,26,46,0.85)', padding: 40, borderRadius: 30, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.15)', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.6, shadowRadius: 20, elevation: 15 }}>
               <ActivityIndicator size="large" color="#5B5FEF" />
               <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 24, letterSpacing: 1 }}>Opening Content...</Text>
               <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 8, textAlign: 'center', fontWeight: '600' }}>Preparing your viewing experience</Text>
             </View>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    marginBottom: 20,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 2,
  },
  profilePic: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#5B5FEF',
  },
  searchPillContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 100,
  },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.15)',
    shadowColor: '#5B5FEF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    color: '#fff',
    fontSize: 16,
    paddingHorizontal: 12,
  },
  clearBtn: {
    padding: 15,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    overflow: 'hidden',
    shadowColor: '#5B5FEF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 30,
    elevation: 20,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
  },
  emptyDesc: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  suggestionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  tag: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  tagText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '600',
  },
  gridContainer: {
    paddingHorizontal: 15,
    paddingBottom: 100,
  },
  resultsCount: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 20,
    marginLeft: 5,
  },
  card: {
    flex: 1,
    aspectRatio: 0.7,
    margin: 6,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#161622',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  cardInner: {
    flex: 1,
  },
  cardPoster: {
    width: '100%',
    height: '100%',
  },
  cardGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
  },
  cardContent: {
    position: 'absolute',
    bottom: 15,
    left: 15,
    right: 15,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardMetaText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '600',
  },
  vjBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(91,95,239,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(91,95,239,0.3)',
  },
  vjText: {
    color: '#5B5FEF',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  partBadge: {
    position: 'absolute',
    right: 10,
    top: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(17,17,24,0.76)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 8,
  },
  partBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  loadingText: {
    color: 'rgba(255,255,255,0.5)',
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
  },
  premiumEmptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  emptyIconGlow: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(91, 95, 239, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(91, 95, 239, 0.2)',
  },
  premiumEmptyTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 12,
    textAlign: 'center',
  },
  premiumEmptyDesc: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  suggestionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  suggestionChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  suggestionChipText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
    fontWeight: '600',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 6,
  },
  qualityBadge: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  qualityText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '900',
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  pillActive: {
    backgroundColor: 'rgba(91,95,239,0.2)',
    borderColor: '#5B5FEF',
  },
  pillText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '600',
  },
  pillTextActive: {
    color: '#fff',
    fontWeight: '800',
  },
});
