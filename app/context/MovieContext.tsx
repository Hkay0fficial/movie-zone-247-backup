import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy, getDocs, doc, limit, setDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../../constants/firebaseConfig';
import { 
  Movie, 
  Series, 
  HeroMovie,
  resolveCDNUrl,
} from '../../constants/movieData';
import { BUNNY_CONFIG } from '../../constants/bunnyConfig';
import { SubscriptionProvider, useSubscription } from './SubscriptionContext';
import { useUser } from './UserContext';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const COUNTRY_MAP: Record<string, string> = {
  'KR': 'South Korea',
  'PH': 'Philippines',
  'CN': 'China',
  'JP': 'Japan',
  'TH': 'Thailand',
  'IN': 'India',
  'US': 'United States',
  'GB': 'United Kingdom',
  'NG': 'Nigeria',
  'ZA': 'South Africa',
  'TR': 'Turkey',
  'ES': 'Spain',
  'FR': 'France',
  'MX': 'Mexico',
  'BR': 'Brazil',
  'CO': 'Colombia',
  'VN': 'Vietnam',
  'ID': 'Indonesia',
  'MY': 'Malaysia',
};

function getFullCountryName(code: string) {
  if (!code) return '';
  const c = code.trim();
  // If it's already a full name in the map values, return it
  if (Object.values(COUNTRY_MAP).includes(c)) return c;
  return COUNTRY_MAP[c.toUpperCase()] || code;
}

interface AppUpdateConfig {
  latestVersion: string;
  updateMessage: string;
  forceUpdate: boolean;
  isUpdateAvailable: boolean;
}

interface MovieContextType {
  movies: (Movie | Series)[];
  series: Series[];
  liveMovies: Movie[];
  liveSeries: Series[];
  loading: boolean;
  newReleases: (Movie | Series)[];
  trending: (Movie | Series)[];
  heroMovies: HeroMovie[];
  announcements: any[];
  loadingAnnouncements: boolean;
  appUpdateConfig: AppUpdateConfig;
  readIds: Set<string>;
  markRead: (id: string) => void;
  markAllRead: (ids: string[]) => void;

  allRows: { title: string; data: (Movie | Series)[] }[];
  allSeries: Series[];
  newSeries: Series[];
  trendingSeries: Series[];
  mostViewedSeries: Series[];
  mostDownloadedSeries: Series[];
  
  mostViewed: (Movie | Series)[];
  mostDownloaded: (Movie | Series)[];
  latest: Movie[];
  continueWatching: (Movie | Series & { position: number; timestamp: number })[];
  favourites: (Movie | Series)[];
  myList: (Movie | Series)[];
  watchLater: (Movie | Series)[];
  youMayAlsoLike: (Movie | Series)[];
  youMayAlsoLikeMovies: Movie[];
  youMayAlsoLikeSeries: Series[];
  lastWatched: (Movie | Series)[];
  actionMovies: Movie[];
  scifiMovies: Movie[];
  romanceMovies: Movie[];
  kDramaMovies: Movie[];
  vjCollection: Movie[];
  bukoleya: Series[];
  allMovies: Movie[];
  allSeries: Series[];
  globalSettings: {
    allMoviesFree: boolean;
    eventMessage: string;
    expiresAt: string;
  };
  
  // ─── Global Filter State ───
  selectedVJ: string | null;
  setSelectedVJ: (vj: string | null) => void;
  selectedGenre: string | null;
  setSelectedGenre: (genre: string | null) => void;
  selectedType: "Movie" | "Series" | "Mini Series" | null;
  setSelectedType: (type: "Movie" | "Series" | "Mini Series" | null) => void;
  selectedYear: string | null;
  setSelectedYear: (year: string | null) => void;
  sortBy: "newest" | "oldest" | "rating" | null;
  setSortBy: (sort: "newest" | "oldest" | "rating" | null) => void;
  minRating: number;
  setMinRating: (rating: number) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  clearFilters: () => void;
  resetFilters: () => void;
}

const MovieContext = createContext<MovieContextType | undefined>(undefined);

export function MovieProvider({ children }: { children: React.ReactNode }) {
  const [liveMovies, setLiveMovies] = useState<Movie[]>([]);
  const [liveSeries, setLiveSeries] = useState<Series[]>([]);
  const [globalSettings, setGlobalSettings] = useState({
    allMoviesFree: false,
    eventMessage: '',
    expiresAt: ''
  });
  const [loading, setLoading] = useState(true);
  const [appLayout, setAppLayout] = useState<any[]>([]);
  const [appUpdateConfig, setAppUpdateConfig] = useState<AppUpdateConfig>({
    latestVersion: '',
    updateMessage: '',
    forceUpdate: false,
    isUpdateAvailable: false
  });
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [isReadStateLoaded, setIsReadStateLoaded] = useState(false);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);

  // ─── Global Filter State ───
  const [selectedVJ, setSelectedVJ] = useState<string | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<"Movie" | "Series" | "Mini Series" | null>(null);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "rating" | null>(null);
  const [minRating, setMinRating] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const clearFilters = () => {
    setSelectedVJ(null);
    setSelectedGenre(null);
    setSelectedType(null);
    setSelectedYear(null);
    setSortBy(null);
    setMinRating(0);
    setSearchQuery('');
  };

  const resetFilters = () => {
    clearFilters();
  };

  useEffect(() => {
    // Listen to Firebase 'movies' collection in real-time
    const q = query(collection(db, 'movies'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMovies: Movie[] = [];
      const fetchedSeries: Series[] = [];
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const now = Date.now();

        // 🟢 Scheduling Filter Logic
        if (data.goLiveDate) {
          const liveDate = new Date(data.goLiveDate).getTime();
          if (now < liveDate) return; // Skip if not yet live
        }
        if (data.expiryDate) {
          const expDate = new Date(data.expiryDate).getTime();
          if (now > expDate) return; // Skip if expired
        }
        
        // Convert to our Movie/Series interface
        if (data.type === 'Series') {
          fetchedSeries.push({
            id: doc.id,
            title: data.title || 'Unknown Series',
            genre: data.genre || 'Drama',
            seasons: data.season || data.seasons || 1,
            year: data.year ? parseInt(data.year) : 2024,
            rating: data.rating || '8.0',
            vj: data.vj || 'Unknown VJ',
            status: data.status || 'Ongoing',
            poster: data.coverUrl || data.posterUrl || data.poster || 'https://images.unsplash.com/photo-1542204165-65bf26472b9b',
            episodes: data.episodes || 10,
            episodeList: (data.episodeList || []).map((ep: any) => ({
              ...ep,
              url: resolveCDNUrl(ep.url)
            })),
            freeEpisodesCount: data.freeEpisodesCount ? parseInt(data.freeEpisodesCount) : 0,
            description: data.synopsis || data.description || '',
            videoUrl: resolveCDNUrl(data.videoUrl || (data.episodeList && data.episodeList[0]?.url) || (data.bunnyVideoId ? `https://${BUNNY_CONFIG.PULL_ZONE}/${data.bunnyVideoId}/playlist.m3u8` : undefined)),
            previewUrl: resolveCDNUrl(data.previewUrl || ''),
            totalDuration: data.duration && data.duration !== '0:00' ? data.duration : (data.totalDuration || '0:00'),
            previewDuration: data.previewDuration,
            episodeDuration: data.episodeDuration || '45m',
            isMiniSeries: data.isMiniSeries || false,
            isHero: data.isHero || false,
            heroType: data.heroType || 'video',
            heroVideoUrl: resolveCDNUrl(data.heroVideoUrl || ''),
            heroPhotoUrl: resolveCDNUrl(data.heroPhotoUrl || ''),
            createdAt: typeof data.createdAt?.toMillis === 'function' ? data.createdAt.toMillis() : (data.createdAt?.seconds ? data.createdAt.seconds * 1000 : Date.now()),
            country: getFullCountryName(data.country || ''),
          });
        } else {
          fetchedMovies.push({
            id: doc.id,
            title: data.title || 'Untitled Movie',
            year: data.year ? parseInt(data.year) : 2024,
            genre: data.genre || 'Action',
            rating: data.rating || '8.2',
            vj: data.vj || 'Unknown VJ',
            poster: data.coverUrl || data.posterUrl || data.poster || 'https://images.unsplash.com/photo-1485846234645-a62644f84728',
            description: data.synopsis || data.description || 'Newly uploaded movie.',
            videoUrl: resolveCDNUrl(data.videoUrl || (data.bunnyVideoId ? `https://${BUNNY_CONFIG.PULL_ZONE}/${data.bunnyVideoId}/playlist.m3u8` : undefined)),
            previewUrl: resolveCDNUrl(data.previewUrl || ''),
            duration: data.duration || '0:00',
            previewDuration: data.previewDuration,
            episodeList: (data.episodeList || []).map((ep: any) => ({
              ...ep,
              url: resolveCDNUrl(ep.url)
            })),
            freeEpisodesCount: data.freeEpisodesCount ? parseInt(data.freeEpisodesCount) : 0,
            isFree: data.isFree || false,
            isHero: data.isHero || false,
            heroType: data.heroType || 'video',
            heroVideoUrl: resolveCDNUrl(data.heroVideoUrl || ''),
            heroPhotoUrl: resolveCDNUrl(data.heroPhotoUrl || ''),
            createdAt: typeof data.createdAt?.toMillis === 'function' ? data.createdAt.toMillis() : (data.createdAt?.seconds ? data.createdAt.seconds * 1000 : Date.now()),
            country: getFullCountryName(data.country || ''),
          });
        }
      });
      
      // 🟢 Global Deduplication: Ensure no duplicate IDs enter the system
      const uniqueMovies = fetchedMovies.filter((item, index, self) => 
        index === self.findIndex((t) => t.id === item.id)
      );
      const uniqueSeries = fetchedSeries.filter((item, index, self) => 
        index === self.findIndex((t) => t.id === item.id)
      );
      
      setLiveMovies(uniqueMovies);
      setLiveSeries(uniqueSeries);
      setTimeout(() => {
        setLoading(false);
      }, 1500);
    }, (error) => {
      console.warn("Firestore listener error (MovieContext):", error);
      // Fallback to offline/mock data if offline
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Listen to App Version Settings
    const unsubscribe = onSnapshot(doc(db, 'settings', 'appVersion'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const latestVersion = data.latestVersion || '1.0.0';
        const currentVersion = Constants.expoConfig?.version || '1.0.0';
        
        // Simple version comparison (e.g. "1.2.1" > "1.2.0")
        // Converts "1.2.1" to 10201 for comparison if needed, or simple string compare for basic cases
        const isUpdateAvailable = latestVersion !== currentVersion;

        setAppUpdateConfig({
          latestVersion,
          latestBuild: data.latestBuild || '0',
          updateMessage: data.updateMessage || 'A new update is available with improvements and bug fixes.',
          forceUpdate: data.forceUpdate || false,
          isUpdateAvailable
        });
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Listen to Global Settings
    const unsubscribe = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        setGlobalSettings(docSnap.data() as any);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Listen to Mobile Layout Manager
    const unsubscribe = onSnapshot(doc(db, 'app_layout', 'main'), (docSnap) => {
      if (docSnap.exists() && docSnap.data().sections) {
        setAppLayout(docSnap.data().sections);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Listen to Announcements
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'), limit(15));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toMillis?.() || Date.now()
      }));
      setAnnouncements(fetched);
      setLoadingAnnouncements(false);
    });
    return () => unsubscribe();
  }, []);

  const { user, profile } = useUser();

  // 1. Load initial read state from AsyncStorage (fast)
  useEffect(() => {
    const loadLocalReadState = async () => {
      try {
        const saved = await AsyncStorage.getItem('readIds');
        if (saved) {
          setReadIds(new Set(JSON.parse(saved)));
        }
      } catch (e) {
        console.error('Failed to load local readIds', e);
      } finally {
        setIsReadStateLoaded(true);
      }
    };
    loadLocalReadState();
  }, []);

  // 2. Sync with Firestore when user logs in or profile updates
  useEffect(() => {
    if (user && !user.isAnonymous) {
      // Fetch readAnnouncements from Firestore
      const userRef = doc(db, 'users', user.uid);
      const unsubscribe = onSnapshot(userRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data.readAnnouncements) {
            setReadIds(new Set(data.readAnnouncements));
          }
        }
      });
      return () => unsubscribe();
    }
  }, [user]);

  // 3. Helper functions for marking read
  const markRead = async (id: string) => {
    setReadIds(prev => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      
      // Update AsyncStorage
      AsyncStorage.setItem('readIds', JSON.stringify([...next]));
      
      // Update Firestore if logged in
      if (user && !user.isAnonymous) {
        const userRef = doc(db, 'users', user.uid);
        setDoc(userRef, { readAnnouncements: arrayUnion(id) }, { merge: true })
          .catch(err => console.error('Failed to sync read status to Firestore', err));
      }
      
      return next;
    });
  };

  const markAllRead = async (ids: string[]) => {
    setReadIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.add(id));
      
      // Update AsyncStorage
      AsyncStorage.setItem('readIds', JSON.stringify([...next]));
      
      // Update Firestore if logged in
      if (user && !user.isAnonymous) {
        const userRef = doc(db, 'users', user.uid);
        setDoc(userRef, { readAnnouncements: Array.from(next) }, { merge: true })
          .catch(err => console.error('Failed to sync all read status to Firestore', err));
      }
      
      return next;
    });
  };

  const { favorites: myFavorites } = useSubscription();

  // Merge live data with mock data so the beautiful UI stays populated
  const contextValue = useMemo(() => {
    const actualLiveMovies = globalSettings.allMoviesFree 
      ? liveMovies.map(m => ({ ...m, isFree: true }))
      : liveMovies;
    const actualLiveSeries = globalSettings.allMoviesFree
      ? liveSeries.map(s => ({ ...s, isFree: true }))
      : liveSeries;

    // ── Apply Global Filters ──
    const applyGlobalFilters = (list: any[]) => {
      let res = [...list];
      if (selectedVJ) {
        const vjQ = selectedVJ.toLowerCase().trim();
        res = res.filter(m => (m.vj || "").toLowerCase().includes(vjQ));
      }
      if (selectedGenre) {
        res = res.filter(m => (m.genre || "").toLowerCase().includes(selectedGenre.toLowerCase()));
      }
      if (selectedYear) {
        res = res.filter(m => String(m.year) === selectedYear);
      }
      if (minRating > 0) {
        res = res.filter(m => parseFloat(m.rating || "0") >= minRating);
      }
      if (searchQuery) {
        const sQ = searchQuery.toLowerCase().trim();
        res = res.filter(m => 
          m.title.toLowerCase().includes(sQ) || 
          (m.genre || "").toLowerCase().includes(sQ) || 
          (m.vj || "").toLowerCase().includes(sQ)
        );
      }
      return res;
    };

    let filteredMovies = applyGlobalFilters(actualLiveMovies);
    let filteredSeries = applyGlobalFilters(actualLiveSeries);

    // Type filter specifically excludes categories
    if (selectedType === "Movie") {
      filteredSeries = [];
    } else if (selectedType === "Series") {
      filteredMovies = [];
      filteredSeries = filteredSeries.filter(s => !(s as any).isMiniSeries);
    } else if (selectedType === "Mini Series") {
      filteredMovies = [];
      filteredSeries = filteredSeries.filter(s => !!(s as any).isMiniSeries);
    }

    let allContent = [...filteredMovies, ...filteredSeries];

    if (sortBy === "newest") allContent.sort((a, b) => (b.year || 0) - (a.year || 0));
    else if (sortBy === "oldest") allContent.sort((a, b) => (a.year || 0) - (b.year || 0));
    else if (sortBy === "rating") allContent.sort((a, b) => parseFloat(b.rating || "0") - parseFloat(a.rating || "0"));

    // New Releases = newest items uploaded (movies + series), newest first
    const newReleases = [...allContent]
      .sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));

    // ── Smart Discovery Rows ──
    const trending = [...allContent]
      .sort((a: any, b: any) => ((b.views || 0) + (b.createdAt || 0) / 10000000) - ((a.views || 0) + (a.createdAt || 0) / 10000000))
      .slice(0, 15);

    const mostViewed = [...allContent]
      .sort((a: any, b: any) => (b.views || 0) - (a.views || 0))
      .slice(0, 15);

    const mostDownloaded = [...allContent]
      .sort((a: any, b: any) => (b.downloads || 0) - (a.downloads || 0))
      .slice(0, 15);

    // Latest = full movie catalog (movies only), sorted newest-first
    const latest = [...filteredMovies].sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));

    // ── Personalized Rows ──
    // You May Also Like: Suggest based on genres in watch history
    const watchedGenres = new Set<string>();
    const watchHistory = profile?.watchHistory || {};
    
    Object.values(watchHistory).forEach((h: any) => {
      if (h.category) watchedGenres.add(h.category);
    });
    
    // Mixed recommendation list - Populated with New Releases and Trending as requested
    const mixedDiscovery = [];
    const maxLenDiscovery = Math.max(newReleases.length, trending.length);
    for (let i = 0; i < maxLenDiscovery; i++) {
      if (newReleases[i]) mixedDiscovery.push(newReleases[i]);
      if (trending[i]) mixedDiscovery.push(trending[i]);
    }
    const youMayAlsoLike = Array.from(new Map(mixedDiscovery.map(item => [item.id, item])).values()).slice(0, 20);

    // Dedicated Series recommendation list (NO MOVIES)
    let youMayAlsoLikeSeries = filteredSeries
      .filter(s => watchedGenres.has(s.genre || ''))
      .filter(s => !watchHistory[s.id])
      .slice(0, 15);
    
    if (youMayAlsoLikeSeries.length < 5) {
      youMayAlsoLikeSeries = filteredSeries
        .sort((a: any, b: any) => (b.views || 0) - (a.views || 0))
        .slice(0, 15);
    }

    // Dedicated Movie recommendation list (NO SERIES)
    let youMayAlsoLikeMovies = filteredMovies
      .filter(m => watchedGenres.has(m.genre || ''))
      .filter(m => !watchHistory[m.id])
      .slice(0, 15);
    
    if (youMayAlsoLikeMovies.length < 5) {
      youMayAlsoLikeMovies = filteredMovies
        .sort((a: any, b: any) => (b.views || 0) - (a.views || 0))
        .slice(0, 15);
    }
    
    // ── Personalized Rows ──
    // Continue Watching: Map watchHistory IDs to full objects, sorted by timestamp
    const continueWatching = Object.entries(watchHistory)
      .map(([key, history]) => {
        const movieId = key.includes('_') ? key.split('_')[0] : key;
        const item = allContent.find(m => m.id === movieId);
        return item ? { ...item, ...(history as any) } as any : null;
      })
      .filter((m): m is any => m !== null)
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      .slice(0, 15);

    const favourites = myFavorites.map((fav: any) => allContent.find(m => m.id === fav.id)).filter(Boolean) as (Movie | Series)[];
    const myList = favourites;
    const watchLater: Movie[] = [];
    const lastWatched = continueWatching.length > 0 ? [continueWatching[0]] : [];
    
    // Auto category filter
    const actionMovies = [...filteredMovies.filter(m => m.genre?.toLowerCase().includes('action'))];
    const scifiMovies = [...filteredMovies.filter(m => m.genre?.toLowerCase().includes('sci-fi'))];
    const romanceMovies = [...filteredMovies.filter(m => m.genre?.toLowerCase().includes('romance'))];
    const horrorMovies = [...filteredMovies.filter(m => m.genre?.toLowerCase().includes('horror'))];
    const dramaMovies = [...filteredMovies.filter(m => m.genre?.toLowerCase().includes('drama'))];
    const indianMovies = [...filteredMovies.filter(m => m.genre?.toLowerCase().includes('indian'))];
    const freeMovies = [
      ...filteredMovies.filter(m => m.isFree),
      ...filteredSeries.filter(s => s.isFree),
    ].filter((item, index, self) => index === self.findIndex((t) => t.id === item.id)); // Dedup
    const kDramaMovies = [...filteredMovies.filter(m => m.genre?.toLowerCase().includes('korean') || m.genre?.toLowerCase().includes('kdrama') || m.genre?.toLowerCase().includes('k-drama'))];
    const bukoleya = [...filteredSeries]
      .filter(s => 
        s.genre?.toLowerCase().includes('korean') || 
        s.genre?.toLowerCase().includes('kdrama') || 
        s.genre?.toLowerCase().includes('k-drama') ||
        (s.country || '').toLowerCase().includes('korea')
      )
      .sort((a, b) => ((b.views || 0) + (b.createdAt || 0) / 10000000) - ((a.views || 0) + (a.createdAt || 0) / 10000000))
      .slice(0, 15);
    const vjCollection: Movie[] = [];

    const allSeries = [...filteredSeries];
    const newSeries = [...filteredSeries].sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 15);
    const trendingSeries = [...filteredSeries]
      .sort((a: any, b: any) => ((b.views || 0) + (b.createdAt || 0) / 10000000) - ((a.views || 0) + (a.createdAt || 0) / 10000000))
      .slice(0, 15);
    const mostViewedSeries = [...filteredSeries].sort((a: any, b: any) => (b.views || 0) - (a.views || 0)).slice(0, 15);
    const mostDownloadedSeries = [...filteredSeries].sort((a: any, b: any) => (b.downloads || 0) - (a.downloads || 0)).slice(0, 15);

    // Build live hero items — only content explicitly marked as hero by admin
    const adminHeroMovies: HeroMovie[] = [
      // Hero-marked movies
      ...filteredMovies
        .filter(m => m.isHero)
        .map(m => ({
          title: m.title,
          genre: m.genre,
          rating: m.rating,
          vj: m.vj,
          year: m.year,
          duration: m.duration,
          director: 'App User',
          description: m.description || 'Newly uploaded content from THE MOVIE ZONE 24/7 Admin portal.',
          poster: m.poster,
          videoUrl: m.videoUrl || "",
          previewUrl: m.previewUrl || '',
          heroVideoUrl: m.heroVideoUrl || '',
          heroPhotoUrl: m.heroPhotoUrl || '',
          heroType: (m.heroType || 'video') as 'video' | 'photo',
          createdAt: (m as any).createdAt,
          id: m.id,
          type: 'Movie'
        })),
      // Hero-marked series
      ...filteredSeries
        .filter(s => s.isHero)
        .map(s => ({
          title: s.title,
          genre: s.genre,
          rating: s.rating,
          vj: s.vj,
          year: s.year,
          duration: (s as any).episodes ? `${(s as any).episodes} EP` : (s.totalDuration || ''),
          director: 'App User',
          description: s.description || 'Newly uploaded series from THE MOVIE ZONE 24/7 Admin portal.',
          poster: s.poster,
          videoUrl: s.videoUrl || (s.episodeList && s.episodeList[0]?.url) || '',
          previewUrl: s.previewUrl || '',
          heroVideoUrl: s.heroVideoUrl || '',
          heroPhotoUrl: s.heroPhotoUrl || '',
          heroType: (s.heroType || 'video') as 'video' | 'photo',
          createdAt: s.createdAt,
          id: s.id,
          type: (s.isMiniSeries ? 'Mini Series' : 'Series') as any
        })),
    ].sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));

    // If admin hasn't marked any content as hero, fall back to the newest uploaded
    // movies. Use 30-day newReleases first; if empty fall back to full latest catalog.
    const heroFallbackSource = newReleases.length > 0 ? newReleases : latest;
    const newReleaseFallback: HeroMovie[] = adminHeroMovies.length === 0
      ? heroFallbackSource.slice(0, 5).map(m => ({
          title: m.title,
          genre: m.genre,
          rating: m.rating,
          vj: m.vj,
          year: m.year,
          duration: (m as any).episodes ? `${(m as any).episodes} EP` : ((m as any).duration || (m as any).totalDuration || ''),
          director: 'App User',
          description: (m as any).description || '',
          poster: m.poster,
          videoUrl: m.videoUrl || '',
          previewUrl: m.previewUrl || '',
          heroType: 'video' as const,
          createdAt: (m as any).createdAt,
          id: m.id,
          type: (m as any).isMiniSeries ? 'Mini Series' : (m as any).seasons ? 'Series' : 'Movie'
        }))
      : [];

    const heroMovies: HeroMovie[] = [
      ...adminHeroMovies,
      ...newReleaseFallback,
    ].slice(0, 20);

    // Rebuild ALL_ROWS dynamically based on the Admin Portal's Layout Manager
    let allRows: { title: string; data: (Movie | Series)[] }[] = [];
    
    if (appLayout && appLayout.length > 0) {
      // Use Live Firestore Managed Rows
      const visibleSections = appLayout.filter(s => s.isVisible);
      allRows = visibleSections.map(section => {
        let sectionData: any[] = [];
        const type = section.filterType;
        
        if (type === 'newReleases') {
          sectionData = newReleases;
        } else if (type === 'trending') {
          sectionData = trending;
        } else if (type === 'free') {
          sectionData = freeMovies;
        } else if (type === 'continueWatching') {
          sectionData = continueWatching;
        } else if (type === 'favourites') {
          sectionData = favourites;
        } else if (type === 'myList') {
          sectionData = myList;
        } else if (type === 'watchLater') {
          sectionData = watchLater;
        } else if (type === 'youMayAlsoLike') {
          sectionData = youMayAlsoLike;
        } else if (type === 'mostViewed') {
          sectionData = mostViewed;
        } else if (type === 'mostDownloaded') {
          sectionData = mostDownloaded;
        } else if (type === 'latest') {
          sectionData = latest;
        } else if (type === 'lastWatched') {
          sectionData = lastWatched;
        } else if (type === 'genre') {
          const val = (section.filterValue || '').toLowerCase();
          sectionData = [...filteredMovies, ...filteredSeries]
            .filter(m => (m.genre || "").toLowerCase().includes(val))
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        } else if (type === 'country') {
          const val = (section.filterValue || '').toLowerCase();
          sectionData = [...filteredMovies, ...filteredSeries]
            .filter(m => (m.country || '').toLowerCase() === val)
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        }
        
        // Final safety dedup for each row
        const uniqueSectionData = sectionData.filter((item, index, self) => 
          index === self.findIndex((t) => t.id === item.id)
        );
        
        return { title: section.title, data: uniqueSectionData };
      }).filter(row => row.data.length > 0);

      // Force "New Release" to the top if it exists
      allRows.sort((a, b) => {
        const aIsNew = a.title.toLowerCase().includes('new release');
        const bIsNew = b.title.toLowerCase().includes('new release');
        if (aIsNew && !bIsNew) return -1;
        if (!aIsNew && bIsNew) return 1;
        return 0;
      });

    } else {
      // Fallback Layout (Original System Layout in case of DB offline behavior)
      allRows = [
        { title: 'New Releases',       data: newReleases       }, // Last 30 days, movies + series
        { title: 'Free Movies',        data: freeMovies        },
        { title: 'Trending Now',       data: trending          },
        { title: 'K-Drama',            data: kDramaMovies      }, 
        { title: 'Most Viewed',        data: mostViewed       },
        { title: 'Most Downloaded',    data: mostDownloaded   },
        { title: 'Latest',             data: latest            }, // Full movie catalog, newest first
        { title: 'Continue Watching',  data: continueWatching },
        { title: 'Favourites',         data: favourites        },
        { title: 'My List',            data: myList           },
        { title: 'Watch Later',        data: watchLater       },
        { title: 'You May Also Like',  data: youMayAlsoLike },
        { title: 'Last Watched',       data: lastWatched      },
        { title: 'Action',             data: actionMovies     },
        { title: 'Sci-Fi',             data: scifiMovies      },
        { title: 'Romance',            data: romanceMovies    },
        { title: 'Horror',             data: horrorMovies     },
        { title: 'Drama',              data: dramaMovies      },
        { title: 'Indian Movies',      data: indianMovies     },
        { title: 'VJ Collection',      data: vjCollection     },
      ].map(row => ({
        ...row,
        data: row.data.filter((item, index, self) => index === self.findIndex((t) => t.id === item.id))
      })).filter(row => row.data.length > 0);
    }

    return {
      movies: allContent, // Merged for UI
      series: allSeries,   // Merged for UI
      liveMovies,          // Raw live data
      liveSeries,          // Raw live data
      loading,
      newReleases,
      trending,
      mostViewed,
      mostDownloaded,
      latest,
      continueWatching,
      favourites,
      myList,
      watchLater,
      youMayAlsoLike,
      youMayAlsoLikeMovies,
      youMayAlsoLikeSeries,
      lastWatched,
      actionMovies,
      scifiMovies,
      romanceMovies,
      horrorMovies,
      dramaMovies,
      indianMovies,
      kDramaMovies,
      vjCollection,
      bukoleya,
      heroMovies,
      allRows,
      allMovies: filteredMovies,
      allSeries: filteredSeries,
      newSeries,
      trendingSeries,
      mostViewedSeries,
      mostDownloadedSeries,
      globalSettings,
      announcements,
      loadingAnnouncements,
      readIds,
      markRead,
      markAllRead,
      appUpdateConfig,
      selectedVJ, setSelectedVJ,
      selectedGenre, setSelectedGenre,
      selectedType, setSelectedType,
      selectedYear, setSelectedYear,
      sortBy, setSortBy,
      minRating, setMinRating,
      searchQuery, setSearchQuery,
      clearFilters,
      resetFilters
    };
  }, [liveMovies, liveSeries, loading, globalSettings, announcements, appLayout, appUpdateConfig, myFavorites, profile,
      readIds, markRead, markAllRead,
      selectedVJ, selectedGenre, selectedType, selectedYear, sortBy, minRating, searchQuery]);

  return (
    <MovieContext.Provider value={contextValue}>
      {children}
    </MovieContext.Provider>
  );
}

export function useMovies() {
  const context = useContext(MovieContext);
  if (context === undefined) {
    throw new Error('useMovies must be used within a MovieProvider');
  }
  return context;
}

export default MovieProvider;
