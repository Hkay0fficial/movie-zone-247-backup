import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy, getDocs, doc } from 'firebase/firestore';
import { db } from '../../constants/firebaseConfig';
import { 
  Movie, 
  Series, 
  HeroMovie,
  NEW_RELEASES as mockNewReleases,
  TRENDING as mockTrending,
  MOST_VIEWED as mockMostViewed,
  MOST_DOWNLOADED as mockMostDownloaded,
  LATEST as mockLatest,
  CONTINUE_WATCHING as mockContinueWatching,
  FAVOURITES as mockFavourites,
  MY_LIST as mockMyList,
  WATCH_LATER as mockWatchLater,
  YOU_MAY_ALSO_LIKE as mockYouMayAlsoLike,
  LAST_WATCHED as mockLastWatched,
  ACTION_MOVIES as mockActionMovies,
  SCIFI_MOVIES as mockSciFiMovies,
  ROMANCE_MOVIES as mockRomanceMovies,
  HORROR_MOVIES as mockHorrorMovies,
  DRAMA_MOVIES as mockDramaMovies,
  INDIAN_MOVIES as mockIndianMovies,
  VJ_COLLECTION as mockVjCollection,
  NEW_SERIES as mockNewSeries,
  TRENDING_SERIES as mockTrendingSeries,
  MOST_VIEWED_SERIES as mockMostViewedSeries,
  MOST_DOWNLOADED_SERIES as mockMostDownloadedSeries,
  ALL_SERIES as mockAllSeries,
  HERO_MOVIES as mockHeroMovies,
  ALL_ROWS as mockAllRows,
} from '../../constants/movieData';

interface MovieContextType {
  movies: (Movie | Series)[];
  series: Series[];
  liveMovies: Movie[];
  liveSeries: Series[];
  loading: boolean;
  newReleases: (Movie | Series)[];
  trending: (Movie | Series)[];
  heroMovies: HeroMovie[];
  allRows: { title: string; data: (Movie | Series)[] }[];
  allSeries: Series[];
  newSeries: Series[];
  trendingSeries: Series[];
  mostViewedSeries: Series[];
  mostDownloadedSeries: Series[];
  
  mostViewed: Movie[];
  mostDownloaded: Movie[];
  latest: Movie[];
  continueWatching: Movie[];
  favourites: Movie[];
  myList: Movie[];
  watchLater: Movie[];
  youMayAlsoLike: Movie[];
  lastWatched: Movie[];
  actionMovies: Movie[];
  scifiMovies: Movie[];
  romanceMovies: Movie[];
  vjCollection: Movie[];
  allMovies: (Movie | Series)[];
  globalSettings: {
    allMoviesFree: boolean;
    eventMessage: string;
    expiresAt: string;
  };
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
            seasons: data.seasons || 1,
            year: data.year ? parseInt(data.year) : 2024,
            rating: data.rating || '8.0',
            vj: data.vj || 'Unknown VJ',
            status: data.status || 'Ongoing',
            poster: data.coverUrl || data.posterUrl || data.poster || 'https://images.unsplash.com/photo-1542204165-65bf26472b9b',
            episodes: data.episodes || 10,
            episodeList: data.episodeList || [],
            freeEpisodesCount: data.freeEpisodesCount ? parseInt(data.freeEpisodesCount) : 0,
            description: data.synopsis || data.description || '',
            videoUrl: data.videoUrl,
            previewUrl: data.previewUrl,
            totalDuration: data.duration || '0:00',
            previewDuration: data.previewDuration,
            episodeDuration: data.episodeDuration || '45m',
            isMiniSeries: data.isMiniSeries || false,
            isHero: data.isHero || false,
            heroType: data.heroType || 'video',
            heroVideoUrl: data.heroVideoUrl || '',
            heroPhotoUrl: data.heroPhotoUrl || '',
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
            videoUrl: data.videoUrl,
            previewUrl: data.previewUrl,
            duration: data.duration || '0:00',
            previewDuration: data.previewDuration,
            isFree: data.isFree || false,
            isHero: data.isHero || false,
            heroType: data.heroType || 'video',
            heroVideoUrl: data.heroVideoUrl || '',
            heroPhotoUrl: data.heroPhotoUrl || '',
          });
        }
      });
      
      setLiveMovies(fetchedMovies);
      setLiveSeries(fetchedSeries);
      setLoading(false);
    }, (error) => {
      console.warn("Firestore listener error (MovieContext):", error);
      // Fallback to offline/mock data if offline
      setLoading(false);
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

  // Merge live data with mock data so the beautiful UI stays populated
  const contextValue = useMemo(() => {
    const actualLiveMovies = globalSettings.allMoviesFree 
      ? liveMovies.map(m => ({ ...m, isFree: true }))
      : liveMovies;
    const actualLiveSeries = globalSettings.allMoviesFree
      ? liveSeries.map(s => ({ ...s, isFree: true }))
      : liveSeries;

    const newReleases = [...actualLiveMovies, ...actualLiveSeries, ...mockNewReleases, ...mockNewSeries];
    const trending = [...actualLiveMovies, ...mockTrending];
    const mostViewed = [...actualLiveMovies, ...mockMostViewed];
    const mostDownloaded = [...actualLiveMovies, ...mockMostDownloaded];
    const latest = [...actualLiveMovies, ...mockLatest];
    const continueWatching = mockContinueWatching; // Optional: prepending live to all
    const favourites = mockFavourites;
    const myList = mockMyList;
    const watchLater = mockWatchLater;
    const youMayAlsoLike = mockYouMayAlsoLike;
    const lastWatched = mockLastWatched;
    
    // Auto category filter
    const actionMovies = [...actualLiveMovies.filter(m => m.genre?.toLowerCase().includes('action')), ...mockActionMovies];
    const scifiMovies = [...actualLiveMovies.filter(m => m.genre?.toLowerCase().includes('sci-fi')), ...mockSciFiMovies];
    const romanceMovies = [...actualLiveMovies.filter(m => m.genre?.toLowerCase().includes('romance')), ...mockRomanceMovies];
    const horrorMovies = [...actualLiveMovies.filter(m => m.genre?.toLowerCase().includes('horror')), ...mockHorrorMovies];
    const dramaMovies = [...actualLiveMovies.filter(m => m.genre?.toLowerCase().includes('drama')), ...mockDramaMovies];
    const indianMovies = [...actualLiveMovies.filter(m => m.genre?.toLowerCase().includes('indian')), ...mockIndianMovies];
    const freeMovies = [
      ...actualLiveMovies.filter(m => m.isFree),
      ...mockNewReleases.filter(m => m.isFree),
      ...mockTrending.filter(m => m.isFree),
      ...mockAllSeries.filter(s => s.isFree),
    ].filter((item, index, self) => index === self.findIndex((t) => t.id === item.id)); // Dedup
    const vjCollection = mockVjCollection;

    const allSeries = [...liveSeries, ...mockAllSeries];
    const newSeries = [...liveSeries, ...mockNewSeries];
    const trendingSeries = [...liveSeries, ...mockTrendingSeries];
    const mostViewedSeries = [...liveSeries, ...mockMostViewedSeries];
    const mostDownloadedSeries = [...liveSeries, ...mockMostDownloadedSeries];

    // Build live hero items — only content explicitly marked as hero by admin
    const adminHeroMovies: HeroMovie[] = [
      // Hero-marked movies
      ...liveMovies
        .filter(m => m.isHero)
        .map(m => ({
          title: m.title,
          genre: m.genre,
          rating: m.rating,
          vj: m.vj,
          year: m.year,
          duration: m.duration,
          director: 'App User',
          description: m.description || 'Newly uploaded content from THE MOVIE ZONE 247 Admin portal.',
          poster: m.poster,
          videoUrl: m.videoUrl || mockHeroMovies[0].videoUrl,
          previewUrl: m.previewUrl || '',
          heroVideoUrl: m.heroVideoUrl || '',
          heroPhotoUrl: m.heroPhotoUrl || '',
          heroType: (m.heroType || 'video') as 'video' | 'photo',
        })),
      // Hero-marked series
      ...liveSeries
        .filter(s => s.isHero)
        .map(s => ({
          title: s.title,
          genre: s.genre,
          rating: s.rating,
          vj: s.vj,
          year: s.year,
          duration: s.totalDuration || '',
          director: 'App User',
          description: s.description || 'Newly uploaded series from THE MOVIE ZONE 247 Admin portal.',
          poster: s.poster,
          videoUrl: s.videoUrl || mockHeroMovies[0].videoUrl,
          previewUrl: s.previewUrl || '',
          heroVideoUrl: s.heroVideoUrl || '',
          heroPhotoUrl: s.heroPhotoUrl || '',
          heroType: (s.heroType || 'video') as 'video' | 'photo',
        })),
    ];

    // If admin hasn't marked any content as hero, fall back to the newest uploaded
    // movies (New Releases) using their videoUrl + previewUrl, then mock data
    const newReleaseFallback: HeroMovie[] = adminHeroMovies.length === 0
      ? liveMovies.slice(0, 5).map(m => ({
          title: m.title,
          genre: m.genre,
          rating: m.rating,
          vj: m.vj,
          year: m.year,
          duration: m.duration,
          director: 'App User',
          description: m.description || '',
          poster: m.poster,
          videoUrl: m.videoUrl || mockHeroMovies[0].videoUrl,
          previewUrl: m.previewUrl || '',
          heroType: 'video' as const,
        }))
      : [];

    const heroMovies: HeroMovie[] = [
      ...adminHeroMovies,
      ...newReleaseFallback,
      // Always include mock content so hero is never empty
      ...mockHeroMovies,
    ];

    // Rebuild ALL_ROWS with live data prepended
    const allRows = [
      { title: 'New Releases',       data: [...liveMovies, ...liveSeries, ...mockNewReleases, ...mockNewSeries] },
      { title: 'Free Movies',        data: freeMovies        },
      { title: 'Trending Now',       data: trending          },
      { title: 'Trending VJs',       data: trending          }, 
      { title: 'Most Viewed',        data: mostViewed       },
      { title: 'Most Downloaded',    data: mostDownloaded   },
      { title: 'Latest',             data: latest            },
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
    ];

    return {
      movies: newReleases, // Merged for UI
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
      lastWatched,
      actionMovies,
      scifiMovies,
      romanceMovies,
      horrorMovies,
      dramaMovies,
      indianMovies,
      vjCollection,
      heroMovies,
      allRows,
      allMovies: newReleases,
      allSeries,
      newSeries,
      trendingSeries,
      mostViewedSeries,
      mostDownloadedSeries,
      globalSettings
    };
  }, [liveMovies, liveSeries, loading, globalSettings]);

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
