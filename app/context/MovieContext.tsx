import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy, getDocs, doc } from 'firebase/firestore';
import { db } from '../../constants/firebaseConfig';
import { 
  Movie, 
  Series, 
  HeroMovie,
  resolveCDNUrl,
  
} from '../../constants/movieData';
import { BUNNY_CONFIG } from '../../constants/bunnyConfig';

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
  kDramaMovies: Movie[];
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
  const [appLayout, setAppLayout] = useState<any[]>([]);

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
            episodeList: (data.episodeList || []).map((ep: any) => ({
              ...ep,
              url: resolveCDNUrl(ep.url)
            })),
            freeEpisodesCount: data.freeEpisodesCount ? parseInt(data.freeEpisodesCount) : 0,
            description: data.synopsis || data.description || '',
            videoUrl: resolveCDNUrl(data.videoUrl || (data.episodeList && data.episodeList[0]?.url) || (data.bunnyVideoId ? `https://${BUNNY_CONFIG.PULL_ZONE}/${data.bunnyVideoId}/playlist.m3u8` : undefined), false),
            previewUrl: resolveCDNUrl(data.previewUrl || '', false),
            totalDuration: data.duration && data.duration !== '0:00' ? data.duration : (data.totalDuration || '0:00'),
            previewDuration: data.previewDuration,
            episodeDuration: data.episodeDuration || '45m',
            isMiniSeries: data.isMiniSeries || false,
            isHero: data.isHero || false,
            heroType: data.heroType || 'video',
            heroVideoUrl: resolveCDNUrl(data.heroVideoUrl || ''),
            heroPhotoUrl: resolveCDNUrl(data.heroPhotoUrl || ''),
            createdAt: typeof data.createdAt?.toMillis === 'function' ? data.createdAt.toMillis() : (data.createdAt?.seconds ? data.createdAt.seconds * 1000 : Date.now()),
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
            videoUrl: resolveCDNUrl(data.videoUrl || (data.bunnyVideoId ? `https://${BUNNY_CONFIG.PULL_ZONE}/${data.bunnyVideoId}/playlist.m3u8` : undefined), false),
            previewUrl: resolveCDNUrl(data.previewUrl || '', false),
            duration: data.duration || '0:00',
            previewDuration: data.previewDuration,
            isFree: data.isFree || false,
            isHero: data.isHero || false,
            heroType: data.heroType || 'video',
            heroVideoUrl: resolveCDNUrl(data.heroVideoUrl || ''),
            heroPhotoUrl: resolveCDNUrl(data.heroPhotoUrl || ''),
            createdAt: typeof data.createdAt?.toMillis === 'function' ? data.createdAt.toMillis() : (data.createdAt?.seconds ? data.createdAt.seconds * 1000 : Date.now()),
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

  useEffect(() => {
    // Listen to Mobile Layout Manager
    const unsubscribe = onSnapshot(doc(db, 'app_layout', 'main'), (docSnap) => {
      if (docSnap.exists() && docSnap.data().sections) {
        setAppLayout(docSnap.data().sections);
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

    const newReleases = [...actualLiveMovies, ...actualLiveSeries].sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
    const trending = [...actualLiveMovies];
    const mostViewed = [...actualLiveMovies];
    const mostDownloaded = [...actualLiveMovies];
    const latest = [...actualLiveMovies].sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
    const continueWatching: Movie[] = []; // Live data doesn't have continue watching state yet
    const favourites: Movie[] = [];
    const myList: Movie[] = [];
    const watchLater: Movie[] = [];
    const youMayAlsoLike = [...actualLiveMovies];
    const lastWatched: Movie[] = [];
    
    // Auto category filter
    const actionMovies = [...actualLiveMovies.filter(m => m.genre?.toLowerCase().includes('action'))];
    const scifiMovies = [...actualLiveMovies.filter(m => m.genre?.toLowerCase().includes('sci-fi'))];
    const romanceMovies = [...actualLiveMovies.filter(m => m.genre?.toLowerCase().includes('romance'))];
    const horrorMovies = [...actualLiveMovies.filter(m => m.genre?.toLowerCase().includes('horror'))];
    const dramaMovies = [...actualLiveMovies.filter(m => m.genre?.toLowerCase().includes('drama'))];
    const indianMovies = [...actualLiveMovies.filter(m => m.genre?.toLowerCase().includes('indian'))];
    const freeMovies = [
      ...actualLiveMovies.filter(m => m.isFree),
      ...actualLiveSeries.filter(s => s.isFree),
    ].filter((item, index, self) => index === self.findIndex((t) => t.id === item.id)); // Dedup
    const kDramaMovies = [...actualLiveMovies.filter(m => m.genre?.toLowerCase().includes('korean') || m.genre?.toLowerCase().includes('kdrama') || m.genre?.toLowerCase().includes('k-drama'))];
    const vjCollection: Movie[] = [];

    const allSeries = [...liveSeries];
    const newSeries = [...liveSeries];
    const trendingSeries = [...liveSeries];
    const mostViewedSeries = [...liveSeries];
    const mostDownloadedSeries = [...liveSeries];

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
      ...liveSeries
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
    // movies (New Releases) using their videoUrl + previewUrl
    const newReleaseFallback: HeroMovie[] = adminHeroMovies.length === 0
      ? newReleases.slice(0, 5).map(m => ({
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
    ];

    // Rebuild ALL_ROWS dynamically based on the Admin Portal's Layout Manager
    let allRows: { title: string; data: (Movie | Series)[] }[] = [];
    
    if (appLayout && appLayout.length > 0) {
      // Use Live Firestore Managed Rows
      const visibleSections = appLayout.filter(s => s.isVisible);
      allRows = visibleSections.map(section => {
        let sectionData: any[] = [];
        if (section.filterType === 'newReleases') {
          sectionData = newReleases;
        } else if (section.filterType === 'trending') {
          sectionData = trending; // Using basic trending var fallback
        } else if (section.filterType === 'free') {
          sectionData = freeMovies; 
        } else if (section.filterType === 'genre') {
          const val = (section.filterValue || '').toLowerCase();
          sectionData = [...actualLiveMovies, ...actualLiveSeries].filter(m => m.genre?.toLowerCase().includes(val));
        } else {
          sectionData = newReleases; // Guarantee an array
        }
        return { title: section.title, data: sectionData };
      });
      
      // Inject standard persistence categories (these are hardcoded to follow standard Netflix conventions)
      const personalRows = [
        { title: 'Continue Watching',  data: continueWatching },
        { title: 'Favourites',         data: favourites        },
        { title: 'My List',            data: myList           },
        { title: 'Watch Later',        data: watchLater       },
      ];
      // Splice them neatly underneath the very first row (usually New Releases)
      allRows.splice(1, 0, ...personalRows);
      allRows.push({ title: 'Last Watched', data: lastWatched });

    } else {
      // Fallback Layout (Original System Layout in case of DB offline behavior)
      allRows = [
        { title: 'New Releases',       data: newReleases       },
        { title: 'Free Movies',        data: freeMovies        },
        { title: 'Trending Now',       data: trending          },
        { title: 'K-Drama',            data: kDramaMovies      }, 
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
    }

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
      kDramaMovies,
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
  }, [liveMovies, liveSeries, loading, globalSettings, appLayout]);

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
