import React, { useState, useEffect, useRef } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  ImageBackground,
  TouchableOpacity,
  FlatList,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
  Dimensions,
  Modal,
  TextInput,
  Animated,
  Keyboard,
  Easing,
} from "react-native";

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
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { ALL_ROWS, Movie, Series } from "@/constants/movieData";
import { MoviePreviewModal } from "./index";
import { GridModal, GridContent } from "../../components/GridComponents";
import ModernVideoPlayer from "../../components/ModernVideoPlayer";
import { useMovies } from "@/app/context/MovieContext";
import { useSubscription } from "@/app/context/SubscriptionContext";
import PremiumAccessModal from "../../components/PremiumAccessModal";
import PlanSelectionModal from "../../components/PlanSelectionModal";
import { useRouter } from "expo-router";

const { width: W } = Dimensions.get("window");
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// ─── Genre data ───────────────────────────────────────────────────────────────
const GENRES = [
  {
    id: "1",
    name: "Action",
    count: 48,
    color: "#ef4444",
    image:
      "https://images.unsplash.com/photo-1542204165-65bf26472b9b?w=500&q=70",
  },
  {
    id: "2",
    name: "Comedy",
    count: 35,
    color: "#f97316",
    image:
      "https://images.unsplash.com/photo-1605809825458-7c870ad8ab43?w=500&q=70",
  },
  {
    id: "3",
    name: "Drama",
    count: 62,
    color: "#a855f7",
    image:
      "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=500&q=70",
  },
  {
    id: "4",
    name: "Sci-Fi",
    count: 29,
    color: "#3b82f6",
    image:
      "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=500&q=70",
  },
  {
    id: "5",
    name: "Horror",
    count: 24,
    color: "#6366f1",
    image:
      "https://images.unsplash.com/photo-1505635552518-3448ff116dd3?w=500&q=70",
  },
  {
    id: "6",
    name: "Romance",
    count: 31,
    color: "#ec4899",
    image:
      "https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=500&q=70",
  },
  {
    id: "7",
    name: "Thriller",
    count: 44,
    color: "#6b7280",
    image:
      "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500&q=70",
  },
  {
    id: "8",
    name: "Animation",
    count: 19,
    color: "#14b8a6",
    image:
      "https://images.unsplash.com/photo-1560472355-109703aa3edc?w=500&q=70",
  },
  {
    id: "16",
    name: "Documentary",
    count: 22,
    color: "#10b981",
    image:
      "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=500&q=70",
  },
  {
    id: "17",
    name: "Indian Movies",
    count: 38,
    color: "#eab308",
    image:
      "https://images.unsplash.com/photo-1628126235206-5260b9ea6441?w=500&q=70",
  },
  {
    id: "18",
    name: "Anime",
    count: 26,
    color: "#0ea5e9",
    image:
      "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500&q=70",
  },
  {
    id: "19",
    name: "Fantasy",
    count: 17,
    color: "#8b5cf6",
    image:
      "https://images.unsplash.com/photo-1518770660439-4636190af475?w=500&q=70",
  },
  {
    id: "13",
    name: "Crime",
    count: 33,
    color: "#475569",
    image:
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=500&q=70",
  },
  {
    id: "14",
    name: "Mystery",
    count: 21,
    color: "#78716c",
    image:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&q=70",
  },
  {
    id: "15",
    name: "Biography",
    count: 15,
    color: "#d97706",
    image:
      "https://images.unsplash.com/photo-1501426026826-31c667bdf23d?w=500&q=70",
  },
  {
    id: "16",
    name: "Sport",
    count: 14,
    color: "#059669",
    image:
      "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=500&q=70",
  },
];

const UGANDAN_VJS = [
  {
    id: "v1",
    name: "VJ Junior",
    count: 125,
    color: "#ef4444",
    image:
      "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=500&q=70",
  },
  {
    id: "v2",
    name: "VJ Emmy",
    count: 98,
    color: "#3b82f6",
    image:
      "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&q=70",
  },
  {
    id: "v3",
    name: "VJ Ice P",
    count: 87,
    color: "#10b981",
    image:
      "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&q=70",
  },
  {
    id: "v4",
    name: "VJ Ivo",
    count: 76,
    color: "#a855f7",
    image:
      "https://images.unsplash.com/photo-1514525253361-b83f85df025c?w=500&q=70",
  },
  {
    id: "v5",
    name: "VJ Kevo",
    count: 64,
    color: "#f59e0b",
    image:
      "https://images.unsplash.com/photo-1459749411177-042180ce673c?w=500&q=70",
  },
  {
    id: "v6",
    name: "VJ Cab",
    count: 52,
    color: "#ec4899",
    image:
      "https://images.unsplash.com/photo-1501386761578-e95c670f34a3?w=500&q=70",
  },
  {
    id: "v7",
    name: "VJ Little T",
    count: 45,
    color: "#06b6d4",
    image:
      "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=500&q=70",
  },
  {
    id: "v8",
    name: "VJ Mark",
    count: 38,
    color: "#8b5cf6",
    image:
      "https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=500&q=70",
  },
];

const REQUESTED_VJS = [
  "Vj Junior",
  "Vj Ice P",
  "Vj Kevo",
  "Vj HD",
  "Vj Sammy",
  "Vj Emmy",
  "Vj Jovan",
  "Vj Tom",
  "Vj Shao Khan",
  "Vj Jingo",
  "Vj Kevin",
  "Vj Kriss Sweet",
  "Vj Dan De",
  "Vj lvo",
  "Vj Fredy",
  "Vj Jumpers",
  "Vj Ashim",
  "Vj Pauleta",
  "Vj Martin K",
  "Vj Henrico",
  "Vj Uncle T",
  "Vj Soul",
  "Vj Nelly",
  "Vj Isma K",
  "Vj Little T",
  "Vj Mox",
  "Vj Muba",
  "Vj Eddy",
  "Vj Kam",
  "Vj Lance",
  "Vj KS",
  "Vj Ulio",
  "Vj Aaron",
  "Vj Cabs",
  "Vj Banks",
  "Vj Jimmy",
  "Vj Baros",
  "Vj Kimuli",
];

// ─── VJ Request Modal ──────────────────────────────────────────────────────────
function VJRequestModal({
  visible,
  onClose,
  title,
  genre,
  onSelectMovie,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  genre: string;
  onSelectMovie: (m: Movie | Series) => void;
}) {
  const { allRows: ALL_ROWS } = useMovies();
  const [search, setSearch] = useState("");
  const [selectedVJ, setSelectedVJ] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);
  const insets = useSafeAreaInsets();
  const [containerWidth, setContainerWidth] = useState(0);
  const filtered = REQUESTED_VJS.filter((vj) =>
    vj.toLowerCase().includes(search.toLowerCase()),
  );

  // Movies for the selected VJ + specific genre (or 'all' for general requests)
  const genreMovies = React.useMemo(() => {
    if (!selectedVJ) return [];
    const all = ALL_ROWS.flatMap((r) => r.data);
    const unique = Array.from(new Map(all.map((m) => [m.id, m])).values());

    return unique.filter((m) => {
      const matchVJ = m.vj
        .toLowerCase()
        .includes(selectedVJ.toLowerCase().replace("vj ", ""));
      if (genre === "all" || genre === "request") return matchVJ;
      return matchVJ && m.genre.toLowerCase().includes(genre.toLowerCase());
    });
  }, [selectedVJ, genre]);

  useEffect(() => {
    // Keyboard listeners removed in favor of KeyboardAvoidingView
  }, []);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.vjModalFullScreen}>
        <StatusBar
          barStyle="light-content"
          translucent
          backgroundColor="transparent"
        />
        <View style={styles.vjModalContent}>
          {/* Header */}
          <View style={[styles.vjModalHeader, { justifyContent: 'center', paddingTop: insets.top + (Platform.OS === 'ios' ? 0 : 5) }]}>
          <View style={[styles.vjTitleCapsule]}>
              <View style={styles.vjTitleSheen} />
              <Text
                style={styles.vjModalTitle}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {title}
              </Text>
            </View>
          </View>

          {/* VJ List */}
          <FlatList
            data={filtered}
            keyExtractor={(v) => v}
            contentContainerStyle={[
              styles.vjListContent,
              { paddingBottom: 100 },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.vjItem}
                activeOpacity={0.7}
                onPress={() => setSelectedVJ(item)}
              >
                <View style={styles.vjDot} />
                <Text style={styles.vjItemText}>{item}</Text>
                <Ionicons
                  name="chevron-forward"
                  size={14}
                  color="rgba(255,255,255,0.4)"
                />
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyVJ}>
                <Text style={styles.emptyVJText}>
                  No VJ found matching "{search}"
                </Text>
              </View>
            }
          />
        </View>

        {/* Movies grid for tapped VJ */}
        <GridModal
          visible={!!selectedVJ}
          title={
            selectedVJ
              ? `${selectedVJ} — ${genre === "all" || genre === "request" ? "All" : genre}`
              : ""
          }
          data={genreMovies}
          onClose={() => setSelectedVJ(null)}
          onSelect={onSelectMovie}
        />
      </View>
    </Modal>
  );
}

// ─── Genre Card ───────────────────────────────────────────────────────────────
function GenreCard({ item, onPress }: { item: any; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={styles.gridItem}
      activeOpacity={0.85}
      onPress={onPress}
    >
      <View style={styles.gridItemInner}>
        <ImageBackground
          source={{ uri: item.image }}
          style={styles.genreImage}
          imageStyle={styles.genreImageStyle}
        >
          {/* Obsidian Glass Foundation */}
          <LinearGradient
            colors={["rgba(10,10,15,0.4)", "rgba(10,10,15,0.85)"]}
            style={StyleSheet.absoluteFill}
          />

          {/* Light Sheen */}
          <LinearGradient
            colors={["rgba(255,255,255,0.08)", "transparent"]}
            style={styles.pillSheen}
          />

          <View
            style={[
              styles.genreCardContent,
              { justifyContent: "center", alignItems: "center" },
            ]}
          >
            <Text
              style={[styles.genreText, { textAlign: "center" }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {item.name}
            </Text>
            <Text style={styles.allVjsText}>ALL VJS</Text>
          </View>
        </ImageBackground>
      </View>
    </TouchableOpacity>
  );
}

// ─── Category Screen ──────────────────────────────────────────────────────────
export default function CategoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { allRows: ALL_ROWS } = useMovies();
  const { isGuest, isPreview, setIsPreview } = useSubscription();
  const [query, setQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [previewMovie, setPreviewMovie] = useState<Movie | Series | null>(null);
  const [requestModalVisible, setRequestModalVisible] = useState(false);
  const [activeRequestTitle, setActiveRequestTitle] = useState("");
  const [activeGenre, setActiveGenre] = useState("");
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);

  // Navigation stack – mirrors the home screen pattern so "See All" works
  type CatStackItem =
    | { type: 'movie'; movie: Movie | Series }
    | { type: 'grid'; title: string; data: (Movie | Series)[] };
  const [categoryStack, setCategoryStack] = React.useState<CatStackItem[]>([]);

  // Unified Video Player State
  const [playerMode, setPlayerMode] = useState<'closed' | 'full' | 'mini'>('closed');
  const [selectedVideoUrl, setSelectedVideoUrl] = useState<string | null>(null);
  const [playerTitle, setPlayerTitle] = useState("");
  const playerPos = useRef(new Animated.ValueXY({ x: SCREEN_W - 170, y: SCREEN_H - 240 })).current;
  const playerSize = useRef(new Animated.Value(150)).current;

  const handlePress = (item: any) => {
    setActiveRequestTitle(
      `${item.name} ONLY BY YOUR FAVOURITE VJ`.toUpperCase(),
    );
    setActiveGenre(item.name);
    setRequestModalVisible(true);
  };

  const filtered = query.trim()
    ? GENRES.filter((g) => g.name.toLowerCase().includes(query.toLowerCase()))
    : GENRES;

  const totalCount = filtered.reduce((acc, g) => acc + g.count, 0);

  const gridMovies = React.useMemo(() => {
    if (!selectedItem) return [];
    const all = ALL_ROWS.flatMap((r) => r.data);
    const unique = Array.from(new Map(all.map((m) => [m.id, m])).values());
    return unique.filter((m) => m.genre.includes(selectedItem.name));
  }, [selectedItem]);

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      <KeyboardAvoidingView
        style={{ flex: 1, paddingTop: insets.top + (Platform.OS === 'ios' ? 44 : 45) }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          <FlatList
            data={filtered}
            keyExtractor={(g) => g.id}
            numColumns={3}
            columnWrapperStyle={styles.row}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <GenreCard item={item} onPress={() => handlePress(item)} />
            )}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          />

          <View style={{ height: 120 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <GridModal
        visible={!!selectedItem}
        title={selectedItem ? `${selectedItem.name} Movies` : ""}
        data={gridMovies}
        onClose={() => setSelectedItem(null)}
        onSelect={(m: Movie | Series) => {
          setSelectedItem(null);
          setTimeout(() => setPreviewMovie(m), 150);
        }}
      />

      {/* Category navigation stack – handles See All from movie detail */}
      <Modal
        visible={categoryStack.length > 0 && playerMode !== 'full'}
        animationType="slide"
        transparent
        statusBarTranslucent
        onRequestClose={() => setCategoryStack(prev => prev.slice(0, -1))}
      >
        <View style={{ flex: 1 }}>
          {categoryStack.map((item, index) => {
            const onClose = () =>
              setCategoryStack(prev => {
                const next = [...prev];
                next.splice(index, 1);
                return next;
              });
            if (item.type === 'grid') {
              return (
                <GridContent
                  key={`cg-${index}`}
                  title={item.title}
                  data={item.data}
                  onClose={onClose}
                  onSelect={(m) =>
                    setCategoryStack(prev => [...prev, { type: 'movie', movie: m }])
                  }
                />
              );
            }
              return (
                <MoviePreviewModal
                  key={`cm-${index}`}
                movie={item.movie}
                onClose={onClose}
                onSwitch={(m: any) =>
                  setCategoryStack(prev => [...prev, { type: 'movie', movie: m }])
                }
                onSeeAll={(title: any, data: any) =>
                  setCategoryStack(prev => [...prev, { type: 'grid', title, data }])
                }
                onShowPremium={() => setShowPremiumModal(true)}
                onUpgrade={() => {
                  setShowPremiumModal(false);
                  setShowPlanModal(true);
                }}
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
              />
            );
          })}
        </View>
      </Modal>

      {/* Legacy single-movie preview (opened from genre grid) */}
      {previewMovie && (
        <MoviePreviewModal
          visible={playerMode !== 'full'}
          movie={previewMovie}
          onClose={() => setPreviewMovie(null)}
          onSwitch={(m: any) => {
            setPreviewMovie(null);
            setTimeout(() => setPreviewMovie(m), 150);
          }}
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
        />
      )}

      <VJRequestModal
        visible={requestModalVisible && playerMode !== 'full'}
        title={activeRequestTitle}
        genre={activeGenre}
        onClose={() => setRequestModalVisible(false)}
        onSelectMovie={(m: any) =>
          setCategoryStack([{ type: 'movie', movie: m }])
        }
      />

      <PremiumAccessModal
        visible={showPremiumModal}
        isGuest={isGuest}
        onClose={() => setShowPremiumModal(false)}
        onSignUp={() => {
          setShowPremiumModal(false);
          router.push("/login" as any);
        }}
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

      {/* Unified Video Player Component */}
      <ModernVideoPlayer
        playerMode={playerMode}
        setPlayerMode={setPlayerMode}
        videoUrl={selectedVideoUrl}
        title={playerTitle}
        playerPos={playerPos}
        playerSize={playerSize}
        isPreview={isPreview}
        onClose={() => {
          setPlayerMode('closed');
          setIsPreview(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0f",
  },
  scrollContent: {
    paddingTop: 4,
    paddingHorizontal: 12,
  },
  headerArea: {
    marginBottom: 24,
  },
  sectionHeaderBadge: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 50,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    shadowColor: "#5B5FEF",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 15,
    elevation: 12,
  },
  switcherContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  switcherButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.03)",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  switcherButtonActive: {
    backgroundColor: "#5B5FEF",
    borderColor: "rgba(255,255,255,0.4)",
    shadowColor: "#5B5FEF",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  switcherText: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  headerSheen: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "50%",
    backgroundColor: "rgba(255,255,255,0.25)",
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
  },
  rowTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  statsBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  sectionSub: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  statsDivider: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginHorizontal: 8,
  },
  row: {
    justifyContent: "flex-start",
    gap: 6,
  },
  gridItem: {
    width: (W - 36) / 3,
    height: 145,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "#0a0a0f",
  },
  gridItemInner: {
    flex: 1,
  },
  genreImage: {
    flex: 1,
  },
  genreImageStyle: {
    resizeMode: "cover",
    opacity: 0.7,
  },
  pillSheen: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "50%",
  },
  genreCardContent: {
    flex: 1,
    padding: 16,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
  genreText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
    width: "100%",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
    letterSpacing: 0.1,
  },
  allVjsText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 10,
    fontWeight: "800",
    marginTop: 6,
    letterSpacing: 1.5,
  },
  genreArrow: {
    padding: 6,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  vjModalFullScreen: {
    flex: 1,
    backgroundColor: "#0a0a0f",
  },
  vjModalContent: {
    flex: 1,
    paddingTop: 0,
  },
  vjModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
  },
  vjTitleCapsule: {
    flex: 1,
    height: 35,
    borderRadius: 17.5,
    overflow: "hidden",
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    backgroundColor: "rgba(91, 95, 239, 0.25)",
    shadowColor: "#5B5FEF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
  },
  vjTitleSheen: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "50%",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 50,
  },
  vjModalTitle: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  vjSearchContainer: {
    display: "none",
  },
  vjBottomSearch: {
    display: "none",
  },
  vjSearchCapsule: {
    display: "none",
  },
  vjSearchInput: {
    flex: 1,
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    paddingHorizontal: 12,
  },
  // ── Uniform search pill (matches home screen) ──
  vjUniversalSearchPill: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(2, 2, 5, 0.96)",
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    zIndex: 1000,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.22)",
  },
  vjSearchBackBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  vjSearchInnerCapsule: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    height: 40,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  vjUniversalSearchInput: {
    flex: 1,
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    paddingHorizontal: 12,
  },
  vjListContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  vjItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  vjDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#5956E9",
    marginRight: 16,
    shadowColor: "#5956E9",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  vjItemText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
  },
  emptyVJ: {
    padding: 60,
    alignItems: "center",
  },
  emptyVJText: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 15,
    textAlign: "center",
  },
});
