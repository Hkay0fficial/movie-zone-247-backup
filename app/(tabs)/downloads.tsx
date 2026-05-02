import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Animated, Dimensions, Platform, Alert } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDownloads } from '@/app/context/DownloadContext';
import { useSubscription } from '@/app/context/SubscriptionContext';
import { useMovies } from '@/app/context/MovieContext';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import EmptyState from '@/components/EmptyState';

const { width: SCREEN_W } = Dimensions.get('window');

export default function DownloadsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { downloadedMovies, removeDownload, activeDownloads } = useDownloads();
  const { setPlayingNow, setPlayerMode, setPlayerTitle, setSelectedVideoUrl } = useSubscription();
  const [filterType, setFilterType] = React.useState<'All' | 'Movie' | 'Series'>('All');

  const filteredDownloads = React.useMemo(() => {
    return downloadedMovies.filter(m => {
      if (filterType === 'All') return true;
      const isSeries = "seasons" in m;
      if (filterType === 'Movie') return !isSeries;
      if (filterType === 'Series') return isSeries;
      return true;
    });
  }, [downloadedMovies, filterType]);

  const shortenGenre = (g: string) => {
    if (!g) return '';
    return g.split(',')[0].split(' ')[0];
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0a0a0f', '#12121a']}
        style={StyleSheet.absoluteFill}
      />
      
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <Text style={styles.headerTitle}>Downloads</Text>
        <Text style={styles.headerSubtitle}>
          {downloadedMovies.length} title{downloadedMovies.length === 1 ? '' : 's'} available offline
        </Text>
      </View>

      <View style={styles.filterRow}>
        {(['All', 'Movie', 'Series'] as const).map(type => (
          <TouchableOpacity 
            key={type}
            onPress={() => setFilterType(type)}
            style={[
              styles.filterPill,
              filterType === type && styles.filterPillActive
            ]}
          >
            <Text style={[
              styles.filterText,
              filterType === type && styles.filterTextActive
            ]}>{type}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {filteredDownloads.length > 0 ? (
          filteredDownloads.map((m, index) => (
            <TouchableOpacity 
              key={m.id || `dl-${index}`} 
              style={styles.card}
              activeOpacity={0.8}
              onPress={() => {
                setPlayerTitle(m.title);
                setSelectedVideoUrl(m.localUri || m.videoUrl);
                setPlayingNow(m as any);
                setPlayerMode('full');
              }}
            >
              <View style={styles.posterContainer}>
                <Image source={{ uri: m.poster }} style={styles.poster} />
                <View style={styles.vjBadge}>
                  <Text style={styles.vjBadgeText}>{m.vj}</Text>
                </View>
              </View>

              <View style={styles.info}>
                <Text style={styles.title} numberOfLines={1}>{m.title}</Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {m.year} · {shortenGenre(m.genre)}{m.vj ? ` · ${m.vj}` : ''}
                </Text>
                
                <View style={styles.actionRow}>
                  <TouchableOpacity 
                    style={styles.playBtn}
                    onPress={() => {
                      setPlayerTitle(m.title);
                      setSelectedVideoUrl(m.localUri || m.videoUrl);
                      setPlayingNow(m as any);
                      setPlayerMode('full');
                    }}
                  >
                    <Ionicons name="play" size={14} color="#fff" />
                    <Text style={styles.playText}>PLAY</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.deleteBtn}
                    onPress={() => {
                      Alert.alert(
                        'Remove Download',
                        `Remove "${m.title}"?`,
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Remove', style: 'destructive', onPress: () => removeDownload(m.id) },
                        ]
                      );
                    }}
                  >
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <EmptyState 
            icon="cloud-download-outline"
            title="No Downloads"
            description="Save your favorite movies and series to watch them offline anytime, anywhere."
            buttonText="Explore Movies"
            onPress={() => router.push('/')}
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    marginTop: 4,
    fontWeight: '600',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 20,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  filterPillActive: {
    backgroundColor: '#5B5FEF',
    borderColor: '#5B5FEF',
  },
  filterText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '700',
  },
  filterTextActive: {
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  card: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  posterContainer: {
    width: 100,
    height: 140,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  vjBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(91, 95, 239, 0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  vjBadgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '900',
  },
  info: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  meta: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    marginBottom: 16,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  playBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#5B5FEF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  playText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 20,
  },
  emptySubText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});
