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
  TouchableWithoutFeedback,
  Animated,
  BackHandler,
} from "react-native";
import { Video, ResizeMode } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Movie, Series, shortenGenre, getPreviewClipUrl } from "@/constants/movieData";
import { useSubscription } from "@/app/context/SubscriptionContext";
import { useUser } from "@/app/context/UserContext";

const { width: SCREEN_W } = Dimensions.get("window");

// ─── Grid Card Component (matches home screen MovieCard exactly) ───────────────
export function GridCard({
  movie,
  onPress,
  columns = 2,
}: {
  movie: Movie | Series;
  onPress: () => void;
  columns?: number;
}) {
  const gap = 8;
  const hPad = 16;
  const paddingSpace = hPad * 2 + (columns - 1) * gap;
  const cardWidth = (SCREEN_W - paddingSpace) / columns;
  const { isPaid } = useSubscription();
  const isLocked = !isPaid && !movie.isFree;

  const [showPreview, setShowPreview] = useState(false);
  const previewOpacity = useRef(new Animated.Value(0)).current;
  const previewClip = getPreviewClipUrl(movie);

  const startPreview = () => {
    if (!previewClip) return;
    setShowPreview(true);
    Animated.timing(previewOpacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const stopPreview = () => {
    Animated.timing(previewOpacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setShowPreview(false));
  };

  return (
    <TouchableOpacity
      style={[styles.gridCard, { width: cardWidth }]}
      onPress={onPress}
      onLongPress={startPreview}
      onPressOut={stopPreview}
      delayLongPress={400}
      activeOpacity={0.85}
    >
      {/* Poster */}
      <Image
        source={{ uri: movie.poster }}
        style={[styles.gridPoster, { height: cardWidth * 1.5 }]}
      />

      {/* Preview Overlay (animated WebP or Video) */}
        {showPreview && previewClip && (
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                opacity: previewOpacity,
                backgroundColor: "#000",
                zIndex: 10,
                borderRadius: 12,
                overflow: "hidden",
              },
            ]}
          >
            {previewClip.endsWith(".mp4") ? (
              <Video
                source={{ uri: previewClip }}
                style={StyleSheet.absoluteFill}
                resizeMode={ResizeMode.COVER}
                shouldPlay
                isMuted
                isLooping
              />
            ) : (
              <Image
                source={{ uri: previewClip }}
                style={StyleSheet.absoluteFill}
              />
            )}
            {/* Soft gradient to blend with the card bottom info if needed */}
            <LinearGradient
              colors={["transparent", "rgba(10,10,15,0.8)"]}
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: 40,
              }}
            />
          </Animated.View>
        )}

      {/* View Indicator (Checkmark) - top-left */}

      {/* VJ Badge — top-right, identical to home screen */}
      <View style={styles.vjBadge}>
        <Text style={styles.vjBadgeText}>{movie.vj}</Text>
      </View>

      {/* Lock — top-left (offset if viewed) */}
      {isLocked && (
        <View style={styles.lockBadge}>
          <Ionicons name="lock-closed" size={9} color="#fff" />
        </View>
      )}

      {/* Genre — bottom-left */}
      <View style={styles.genreBadge}>
        <Text style={styles.genreBadgeText}>
          {"seasons" in movie ? (movie.isMiniSeries ? "Mini Series" : "Series") : shortenGenre(movie.genre)}
        </Text>
      </View>


      {/* Episode/Part Badge */}
      {(() => {
        const isSeries = "seasons" in movie;
        const multiplier = (movie as any).episodesPerPart || 1;
        const epList = (movie as any).episodeList || [];
        const count = (movie as any).episodes || 0;
        const listCount = epList.length * multiplier;
        const total = Math.max(count, listCount);

        if (total <= 1 && !isSeries) return null;

        let badgeText = "";
        if (multiplier > 1 && epList.length > 0) {
          const start = (epList.length - 1) * multiplier + 1;
          const end = epList.length * multiplier;
          badgeText = `${start}-${end}`;
        } else {
          badgeText = `${total}`;
        }

        return (
          <View style={styles.epBadgePremium}>
            <Ionicons name="ellipsis-horizontal" size={9} color="#fff" style={{ marginRight: 2 }} />
            <Text style={styles.epBadgeTextPremium}>
              {badgeText} {isSeries ? "EP" : "PART"}
            </Text>
          </View>
        );
      })()}

      {/* Card info */}
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {movie.title}
        </Text>
        <Text style={styles.cardMetadata} numberOfLines={1}>
          {"seasons" in movie
            ? `${movie.year} · ${movie.isMiniSeries ? "Mini Series" : `Season ${movie.seasons}`}`
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
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={StyleSheet.absoluteFill} />
      </TouchableWithoutFeedback>

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

      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <View style={{ flex: 1 }}>
        
        {/* Header */}
        <View style={[styles.headerContainer, { paddingTop: Math.max(insets.top, StatusBar.currentHeight || 24) + (Platform.OS === 'ios' ? 0 : 12) }]}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>

          <View style={styles.searchPill}>
            {Platform.OS === 'ios' ? (
              <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255, 255, 255, 0.08)' }]} />
            )}
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
      </View>
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
  useEffect(() => {
    if (visible) {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        onClose();
        return true;
      });
      return () => backHandler.remove();
    }
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 40000 }]}>
      <GridContent 
        title={title}
        data={data}
        onClose={onClose}
        onSelect={onSelect}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  gridCard: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    position: 'relative',
  },
  gridPoster: {
    width: '100%',
    height: 150,
    resizeMode: 'cover',
  },
  vjBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.70)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  lockBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  qualityRow: {
    position: 'absolute',
    top: 6,
    flexDirection: 'row',
    gap: 3,
  },
  qBadge: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  qText: {
    color: '#fff',
    fontSize: 7,
    fontWeight: '900',
  },
  vjBadgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '900',
  },
  genreBadge: {
    position: 'absolute',
    bottom: 42,            // above cardInfo (cardInfo ~36px)
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.70)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  genreBadgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  epBadgePremium: {
    position: 'absolute',
    bottom: 42,            // above cardInfo
    right: 6,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.70)',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  epBadgeTextPremium: {
    color: '#FFC107',
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  cardInfo: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  cardTitle: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 2,
  },
  cardMetadata: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Modal Header Styles
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    marginRight: 10,
  },
  searchPill: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.22)',
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
