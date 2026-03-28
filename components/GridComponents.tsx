import React, { useRef, useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
  FlatList,
  Dimensions,
  Platform,
  StatusBar,
  TextInput,
  Modal,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Movie, Series, shortenGenre } from "@/constants/movieData";

const { width: SCREEN_W } = Dimensions.get("window");

// ─── Grid Card Component ──────────────────────────────────────────────────────
export function GridCard({
  movie,
  onPress,
  columns = 2,
}: {
  movie: Movie | Series;
  onPress: () => void;
  columns?: number;
}) {
  const paddingSpace = 16 * 2 + (columns - 1) * 8;
  const cardWidth = (SCREEN_W - paddingSpace) / columns;
  const cardHeight = cardWidth * 1.5; // Premium vertical ratio

  return (
    <TouchableOpacity
      style={[styles.gridCard, { width: cardWidth }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={{ borderRadius: 12, overflow: 'hidden' }}>
        <Image
          source={{ uri: movie.poster }}
          style={[styles.gridPoster, { height: cardHeight }]}
        />
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.6)"]}
          style={StyleSheet.absoluteFill}
        />
        
        {/* VJ Badge (Top Right) */}
        <View style={styles.vjBadge}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          <Text style={styles.vjBadgeText}>{movie.vj}</Text>
        </View>

        {/* Genre Badge (Bottom Left) */}
        <View style={styles.genreBadge}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          <Text style={styles.genreBadgeText}>
            {"seasons" in movie ? (movie.isMiniSeries ? "Mini Series" : "Series") : shortenGenre(movie.genre)}
          </Text>
        </View>

        {"seasons" in movie && (
          <View style={styles.epBadgePremium}>
            <Ionicons name="ellipsis-horizontal" size={10} color="#FFC107" style={{ marginRight: 2 }} />
            <Text style={styles.epBadgeTextPremium}>{(movie as any).episodes} EP</Text>
          </View>
        )}
      </View>
      
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {movie.title}
        </Text>
        <Text style={styles.cardMetadata} numberOfLines={1}>
          {"seasons" in movie 
            ? `${movie.year} · ${(movie.isMiniSeries ? "Mini Series" : `Season ${movie.seasons}`)}`
            : `${movie.year} · ${movie.duration}`}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Grid Modal Component ─────────────────────────────────────────────────────
export function GridContent({
  title,
  data,
  onClose,
  onSelect,
}: {
  title: string;
  data: (Movie | Series)[];
  onClose: () => void;
  onSelect: (m: Movie | Series) => void;
}) {
  const [gridQuery, setGridQuery] = useState("");
  const gridInputRef = useRef<TextInput>(null);
  const insets = useSafeAreaInsets();

  const filtered = data.filter((m) => {
    const q = gridQuery.toLowerCase().trim();
    if (!q) return true;
    const vjName = q.startsWith("vj ") ? q : "vj " + q;
    return (
      m.title.toLowerCase().includes(q) ||
      m.genre.toLowerCase().includes(q) ||
      String(m.year).includes(q) ||
      m.vj.toLowerCase() === vjName ||
      m.vj.toLowerCase() === q
    );
  });

  useEffect(() => {
    setGridQuery("");
  }, [data]);

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: "#0a0a0f" }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <SafeAreaView style={{ flex: 1 }}>
        
        {/* Header */}
        <View style={[styles.headerContainer, { paddingTop: insets.top + (Platform.OS === 'ios' ? 0 : 4) }]}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>

          <View style={styles.searchPill}>
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
            <Ionicons name="search" size={18} color="rgba(255,255,255,0.4)" style={{ marginLeft: 12 }} />
            <TextInput
              ref={gridInputRef}
              style={styles.searchInput}
              placeholder={title || 'Search…'}
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={gridQuery}
              onChangeText={setGridQuery}
              returnKeyType="search"
            />
            {gridQuery.length > 0 && (
              <TouchableOpacity onPress={() => setGridQuery('')} style={{ padding: 8 }}>
                <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            )}
            
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{filtered.length}</Text>
            </View>
          </View>
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(m) => m.id}
          numColumns={3}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.columnWrapper}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          renderItem={({ item }) => (
            <GridCard
              movie={item}
              onPress={() => onSelect(item)}
              columns={3}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="film-outline" size={48} color="rgba(255,255,255,0.1)" />
              <Text style={styles.emptyText}>
                No results {gridQuery ? `for "${gridQuery}"` : ''}
              </Text>
            </View>
          }
        />
      </SafeAreaView>
    </View>
  );
}

// ─── Grid Modal Component ─────────────────────────────────────────────────────
export function GridModal({
  visible,
  title,
  data,
  onClose,
  onSelect,
}: {
  visible: boolean;
  title: string;
  data: (Movie | Series)[];
  onClose: () => void;
  onSelect: (m: Movie | Series) => void;
}) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <GridContent 
        title={title}
        data={data}
        onClose={onClose}
        onSelect={onSelect}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  gridCard: {
    marginBottom: 16,
    borderRadius: 12,
  },
  gridPoster: {
    width: "100%",
    resizeMode: "cover",
  },
  vjBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    borderRadius: 8,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  vjBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
  },
  genreBadge: {
    position: "absolute",
    bottom: 8,
    left: 8,
    borderRadius: 8,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  genreBadgeText: {
    color: "#FFC107",
    fontSize: 9,
    fontWeight: "900",
    textTransform: 'uppercase',
  },
  epBadgePremium: {
    position: "absolute",
    bottom: 8,
    right: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "rgba(0,0,0,0.6)",
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  epBadgeTextPremium: {
    color: "#FFC107",
    fontSize: 8,
    fontWeight: "900",
  },
  cardInfo: {
    paddingVertical: 8,
    paddingHorizontal: 2,
  },
  cardTitle: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2,
  },
  cardMetadata: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    fontWeight: "500",
  },

  // Modal Header Styles
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  searchPill: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 0,
  },
  countBadge: {
    backgroundColor: '#5B5FEF',
    paddingHorizontal: 12,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    minWidth: 32,
  },
  countBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },

  // List Styles
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 100,
  },
  columnWrapper: {
    justifyContent: 'flex-start',
    gap: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
    gap: 16,
  },
  emptyText: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 16,
    fontWeight: "600",
  },
});
