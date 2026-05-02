import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Animated, Dimensions, Platform, Alert } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSubscription } from '@/app/context/SubscriptionContext';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_W } = Dimensions.get('window');

export default function MyListScreen() {
  const insets = useSafeAreaInsets();
  const { favorites, toggleFavorite, setPlayingNow, setPlayerMode, setPlayerTitle, setSelectedVideoUrl } = useSubscription();

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
        <Text style={styles.headerTitle}>My List</Text>
        <Text style={styles.headerSubtitle}>
          {favorites.length} title{favorites.length === 1 ? '' : 's'} saved to your watchlist
        </Text>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {favorites.length > 0 ? (
          <View style={styles.grid}>
            {favorites.map((m, index) => (
              <TouchableOpacity 
                key={m.id || `fav-${index}`} 
                style={styles.card}
                activeOpacity={0.85}
                onPress={() => {
                  setPlayerTitle(m.title);
                  setSelectedVideoUrl(m.videoUrl);
                  setPlayingNow(m as any);
                  setPlayerMode('full');
                }}
              >
                <Image source={{ uri: m.poster }} style={styles.poster} />
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.8)']}
                  style={styles.cardOverlay}
                />
                
                <TouchableOpacity 
                  style={styles.removeBtn}
                  onPress={() => toggleFavorite(m)}
                >
                  <BlurView intensity={30} tint="dark" style={styles.removeBlur}>
                    <Ionicons name="close" size={16} color="#fff" />
                  </BlurView>
                </TouchableOpacity>

                <View style={styles.cardInfo}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{m.title}</Text>
                  <Text style={styles.cardMeta} numberOfLines={1}>
                    {m.year} · {shortenGenre(m.genre)}{(m as any).vj ? ` · ${(m as any).vj}` : ''}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="bookmark-outline" size={64} color="rgba(255,255,255,0.05)" />
            <Text style={styles.emptyText}>Your list is empty</Text>
            <Text style={styles.emptySubText}>Add movies and series to your list to keep track of what you want to watch.</Text>
          </View>
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
  scrollView: {
    flex: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 15,
    justifyContent: 'space-between',
  },
  card: {
    width: (SCREEN_W - 45) / 2,
    height: ((SCREEN_W - 45) / 2) * 1.5,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 15,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  cardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
  },
  removeBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
  },
  removeBlur: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  cardInfo: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
  },
  cardMeta: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '600',
  },
  emptyState: {
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
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
