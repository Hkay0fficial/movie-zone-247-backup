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
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ALL_ROWS, ALL_SERIES, Movie, Series } from '@/constants/movieData';
import { useMovies } from '@/app/context/MovieContext';
import { useUser } from '../context/UserContext';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

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
  const { allRows: ALL_ROWS, allSeries: ALL_SERIES } = useMovies();
  const { profile } = useUser();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<(Movie | Series)[]>([]);
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Flatten all movies and series for searching
  const allContent = React.useMemo(() => {
    const seen = new Set<string>();
    const pool: (Movie | Series)[] = [];
    
    // Add all structured rows (movies + featured series)
    ALL_ROWS.forEach(row => {
      row.data.forEach(item => {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          pool.push(item);
        }
      });
    });

    // Explicitly add all series (some might not be in featured rows)
    ALL_SERIES.forEach(item => {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        pool.push(item);
      }
    });

    return pool;
  }, []);

  const handleSearch = useCallback((text: string) => {
    setQuery(text);
    if (!text.trim()) {
      setResults([]);
      return;
    }

    const q = text.toLowerCase().trim();
    const filtered = allContent.filter(item => 
      item.title.toLowerCase().includes(q) ||
      item.genre.toLowerCase().includes(q) ||
      item.vj.toLowerCase().includes(q) ||
      String(item.year).includes(q)
    );
    setResults(filtered);
  }, [allContent]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

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

        {query.trim() === '' ? (
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
              {['Action', 'Sci-Fi', 'VJ Junior', 'New 2025'].map((tag) => (
                <TouchableOpacity 
                  key={tag} 
                  style={styles.tag}
                  onPress={() => handleSearch(tag)}
                >
                  <BlurView intensity={10} tint="light" style={StyleSheet.absoluteFill} />
                  <Text style={styles.tagText}>{tag}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            data={results}
            numColumns={2}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.gridContainer}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <ResultCard 
                item={item} 
                onPress={() => {
                   // Navigate to detail or show modal
                   console.log('Pressed', item.title);
                }} 
              />
            )}
            ListHeaderComponent={() => (
              <Text style={styles.resultsCount}>
                Found {results.length} results for "{query}"
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
});

