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
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Movie, Series, getStreamUrl } from '@/constants/movieData';
import { useMovies } from '@/app/context/MovieContext';
import { useSubscription } from '@/app/context/SubscriptionContext';
import { useUser } from '../context/UserContext';

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

// ─── Search Result Card ───────────────────────────────────────────────────────
function ResultCard({ item, onPress }: { item: Movie | Series; onPress: () => void }) {
  const isSeries = 'seasons' in item;
  
  return (
    <TouchableOpacity 
      style={styles.card} 
      activeOpacity={0.85}
      onPress={onPress}
    >
      <View style={styles.cardInner}>
        <Image source={{ uri: item.poster }} style={styles.cardPoster} />
        <LinearGradient
          colors={['transparent', 'rgba(10,10,15,0.95)']}
          style={styles.cardGradient}
        />
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
  const { allMovies, allSeries, loading } = useMovies();
  const { setPlayingNow, setPlayerTitle, setSelectedVideoUrl, setPlayerMode } = useSubscription();
  const { profile } = useUser();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<(Movie | Series)[]>([]);
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;

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
    if (!text.trim()) {
      setResults([]);
      return;
    }

    const q = text.toLowerCase().trim();
    const filtered = allContent.filter(item => {
      const title = item.title?.toLowerCase() || '';
      const genre = item.genre?.toLowerCase() || '';
      const vj = item.vj?.toLowerCase() || '';
      const year = String(item.year || '');
      
      return title.includes(q) ||
             genre.includes(q) ||
             vj.includes(q) ||
             year.includes(q);
    });
    setResults(filtered);
  }, [allContent]);

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
          colors={['rgba(91,95,239,0.15)', 'transparent', 'rgba(139,92,246,0.1)']}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <SafeAreaView style={{ flex: 1 }}>
        <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
          <TouchableOpacity 
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>EXPLORE CONTENT</Text>
          <Image source={{ uri: profile.profilePhoto }} style={styles.profilePic} />
        </Animated.View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#5B5FEF" />
            <Text style={styles.loadingText}>Fetching latest content...</Text>
          </View>
        ) : query.trim() === '' ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <LinearGradient
                colors={['#5B5FEF', '#8B5CF6']}
                style={StyleSheet.absoluteFill}
              />
              <Ionicons name="search" size={40} color="#fff" />
            </View>
            <Text style={styles.emptyTitle}>What are you looking for?</Text>
            <Text style={styles.emptyDesc}>
              Search for your favorite movies, series, or VJs to start watching.
            </Text>
            <View style={styles.suggestionRow}>
              {['VJ Junior', 'K-Drama', 'Action', 'Sci-Fi', 'Vj Ice P'].map((tag) => (
                <TouchableOpacity 
                  key={tag} 
                  style={styles.tag}
                  onPress={() => {
                    setQuery(tag);
                    handleSearch(tag);
                  }}
                >
                  <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
                  <Text style={styles.tagText}>{tag}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : query.length > 0 && results.length === 0 ? (
          <View style={styles.premiumEmptyContainer}>
            <View style={styles.emptyIconGlow}>
              <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
              <Ionicons name="search-outline" size={50} color="rgba(91,95,239,0.8)" />
            </View>
            <Text style={styles.premiumEmptyTitle}>No Results Found</Text>
            <Text style={styles.premiumEmptyDesc}>
              We couldn't find any movies or series matching "{query}". Try searching for VJs or different genres.
            </Text>
            <View style={styles.suggestionChips}>
              {['Action', 'Comedy', 'VJ Junior', 'Horror', 'Sci-Fi'].map((tag) => (
                <TouchableOpacity 
                  key={tag} 
                  style={styles.suggestionChip}
                  onPress={() => handleSearch(tag)}
                >
                  <Text style={styles.suggestionChipText}>{tag}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            data={query.length > 0 ? results : []}
            keyExtractor={(item) => item.id}
            numColumns={2}
            contentContainerStyle={styles.gridContainer}
            renderItem={({ item }) => (
              <ResultCard 
                item={item} 
                onPress={() => {
                  const isSeries = 'seasons' in item;
                  if (isSeries) {
                    router.push(`/(tabs)/saved?seriesId=${item.id}`);
                  } else {
                    // Emit selection event to be caught by the Home detail stack
                    DeviceEventEmitter.emit("movieSelected", item);
                    router.back();
                  }
                }} 
              />
            )}
            ListHeaderComponent={() => (
              <Text style={styles.resultsCount}>
                {results.length} {results.length === 1 ? 'RESULT' : 'RESULTS'} FOUND FOR "{query.toUpperCase()}"
              </Text>
            )}
          />
        )}

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
              colors={['rgba(91,95,239,0.3)', 'rgba(139,92,246,0.1)']}
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
            {query.length > 0 && (
              <TouchableOpacity onPress={() => handleSearch('')} style={styles.clearBtn}>
                <Ionicons name="close-circle" size={20} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            )}
          </BlurView>
        </KeyboardAvoidingView>
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
    borderWidth: 1,
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
    borderWidth: 1,
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
    borderWidth: 1,
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
    borderWidth: 1,
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
    borderWidth: 1,
    borderColor: 'rgba(91,95,239,0.3)',
  },
  vjText: {
    color: '#5B5FEF',
    fontSize: 10,
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
    borderWidth: 1,
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
    borderWidth: 1,
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
});

