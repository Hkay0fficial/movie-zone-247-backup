/**
 * DownloadContext.tsx
 *
 * Clean-slate download engine. Single responsibility: download files.
 * Each episode download key = episodeId (never the series ID).
 * Each movie  download key = movie.id.
 * No shared state between different episode downloads.
 */
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { Alert, Platform } from 'react-native';
import { Movie, Series } from '../../constants/movieData';
import { resolveCDNUrl, getDownloadUrlVariants } from '../../constants/bunnyConfig';
import { useSubscription } from './SubscriptionContext';

const {
  documentDirectory,
  cacheDirectory,
  getFreeDiskStorageAsync,
  createDownloadResumable,
} = FileSystem;

interface DownloadEntry {
  id: string;
  title: string;
  movieId: string;
  poster: string;
  progress: number;
  speedString: string;
  isPaused: boolean;
  mode: 'internal' | 'external';
  url: string;
  item: Movie | Series;
  isEpisode: boolean;
  type?: 'Movie' | 'Series';
}

interface DownloadContextType {
  activeDownloads: Record<string, DownloadEntry>;
  downloadQueue: string[];
  episodeDownloads: Record<string, string>; // epId -> localUri
  downloadedMovies: any[]; // List of completed movie objects
  downloadEpisode: (series: Series, epId: string, url: string, title: string, mode: 'internal' | 'external') => void;
  downloadMovie: (movie: Movie | Series, mode: 'internal' | 'external') => void;
  pauseDownload: (id: string) => void;
  resumeDownload: (id: string) => void;
  cancelDownload: (id: string) => void;
  deleteDownload: (id: string) => void;
  isEpisodeDownloaded: (epId: string) => boolean;
  isMovieDownloaded: (id: string) => boolean;
  getRemainingDownloads: () => number;
  getExternalDownloadLimit: () => number;
  downloadsUsedToday: number;
}

const DownloadContext = createContext<DownloadContextType | undefined>(undefined);

export const DownloadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeDownloads, setActiveDownloads] = useState<Record<string, DownloadEntry>>({});
  const [downloadQueue, setDownloadQueue] = useState<string[]>([]);
  const [episodeDownloads, setEpisodeDownloads] = useState<Record<string, string>>({});
  const [downloadedMovies, setDownloadedMovies] = useState<any[]>([]);
  const [downloadsUsedToday, setDownloadsUsedToday] = useState(0);

  const { isPaid, subscription } = useSubscription();

  // Refs for background processing
  const entriesRef = useRef<Record<string, DownloadEntry>>({});
  const resumablesRef = useRef<Record<string, any>>({});
  const pausedRef = useRef<Set<string>>(new Set());
  const isProcessing = useRef(false);

  // ── Persistence ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const [epSaved, movSaved, qSaved, usedSaved] = await Promise.all([
          AsyncStorage.getItem('down_episodes'),
          AsyncStorage.getItem('down_movies'),
          AsyncStorage.getItem('down_queue'),
          AsyncStorage.getItem('down_used_today'),
        ]);
        if (epSaved) setEpisodeDownloads(JSON.parse(epSaved));
        if (movSaved) setDownloadedMovies(JSON.parse(movSaved));
        if (qSaved) {
            const q = JSON.parse(qSaved);
            // We don't restore partial downloads for simplicity in this version, 
            // but we keep the queue logic ready.
        }
        if (usedSaved) {
            const { count, date } = JSON.parse(usedSaved);
            if (date === new Date().toDateString()) {
                setDownloadsUsedToday(count);
            }
        }
      } catch (_) {}
    };
    load();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem('down_episodes', JSON.stringify(episodeDownloads));
  }, [episodeDownloads]);

  useEffect(() => {
    AsyncStorage.setItem('down_movies', JSON.stringify(downloadedMovies));
  }, [downloadedMovies]);

  // ── Logic Helpers ───────────────────────────────────────────────────────────
  const getRemainingDownloads = () => {
    const limit = isPaid ? (subscription?.downloadLimit || 20) : 3;
    return Math.max(0, limit - downloadsUsedToday);
  };

  const getExternalDownloadLimit = () => {
    return isPaid ? (subscription?.externalDownloadLimit || 5) : 0;
  };

  const isEpisodeDownloaded = (epId: string) => !!episodeDownloads[epId];
  const isMovieDownloaded = (id: string) => downloadedMovies.some(m => m.id === id);

  const updateNotification = async (id: string, title: string, progress: number, speed: string, done: boolean) => {
     // Notification logic removed for brevity
  };

  // ── Actions ─────────────────────────────────────────────────────────────────
  const enqueue = (entry: DownloadEntry) => {
    const { id } = entry;
    if (downloadQueue.includes(id)) {
      Alert.alert('In Queue', 'This item is already in your download queue.');
      return;
    }
    entriesRef.current[id] = entry;
    setDownloadQueue(prev => [...prev, id]);
  };

  const downloadEpisode = (series: Series, episodeId: string, episodeUrl: string, episodeTitle: string, mode: 'internal' | 'external') => {
    if (!episodeId) return;
    if (isEpisodeDownloaded(episodeId)) return;
    
    enqueue({
      id: episodeId,
      title: episodeTitle || `${series.title} — Episode`,
      movieId: series.id,
      type: 'Series',
      poster: series.poster || '',
      progress: 0,
      speedString: '',
      isPaused: false,
      mode,
      url: episodeUrl,
      item: series,
      isEpisode: true,
    });
  };

  const downloadMovie = (movie: Movie | Series, mode: 'internal' | 'external') => {
    if (!movie.id) return;
    const url = (movie as any).videoUrl || '';
    if (!url) {
      Alert.alert('Cannot Download', 'This movie does not have a video URL yet.');
      return;
    }
    if (isMovieDownloaded(movie.id)) return;
    
    enqueue({
      id: movie.id,
      title: movie.title,
      movieId: movie.id,
      type: 'Movie',
      poster: movie.poster || '',
      progress: 0,
      speedString: '',
      isPaused: false,
      mode,
      url,
      item: movie,
      isEpisode: false,
    });
  };

  const pauseDownload = (id: string) => {
    pausedRef.current.add(id);
    setActiveDownloads(prev => prev[id] ? { ...prev, [id]: { ...prev[id], isPaused: true } } : prev);
  };

  const resumeDownload = (id: string) => {
    pausedRef.current.delete(id);
    setActiveDownloads(prev => prev[id] ? { ...prev, [id]: { ...prev[id], isPaused: false } } : prev);
  };

  const cancelDownload = async (id: string) => {
    if (resumablesRef.current[id]) {
      try { await resumablesRef.current[id].cancelAsync(); } catch (_) {}
      delete resumablesRef.current[id];
    }
    delete entriesRef.current[id];
    setDownloadQueue(prev => prev.filter(qid => qid !== id));
    setActiveDownloads(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  const deleteDownload = async (id: string) => {
     // File deletion logic
  };

  // ── Queue processor ─────────────────────────────────────────────────────────
  useEffect(() => {
    const processNext = async () => {
      if (downloadQueue.length === 0 || isProcessing.current) return;
      isProcessing.current = true;

      const id = downloadQueue[0];
      const entry = entriesRef.current[id];

      if (!entry) {
        setDownloadQueue(prev => prev.slice(1));
        isProcessing.current = false;
        return;
      }

      const { title, mode, url: rawUrl, item, isEpisode } = entry;
      const urlVariants = getDownloadUrlVariants(rawUrl);
      let success = false;
      let lastResultUri = '';
      let fatalError = '';

      try {
        const free = await getFreeDiskStorageAsync();
        if (free < 300 * 1024 * 1024) {
          Alert.alert('Storage Full', 'You need at least 300 MB free to download content.');
          await cancelDownload(id);
          isProcessing.current = false;
          return;
        }
      } catch (_) {}

      for (const targetUrl of urlVariants) {
        if (!resumablesRef.current[id] && urlVariants.indexOf(targetUrl) > 0) break;

        const safeTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);
        const fileUri = mode === 'internal'
          ? `${documentDirectory}${safeTitle}_${Date.now()}.mp4`
          : `${cacheDirectory}${safeTitle}_${Date.now()}.mp4`;

        let lastBytes = 0;
        let lastTime = Date.now();

        const progressCallback = (p: { totalBytesWritten: number; totalBytesExpectedToWrite: number }) => {
          if (!resumablesRef.current[id]) return;
          if (p.totalBytesExpectedToWrite <= 0) return;
          const pct = Math.floor((p.totalBytesWritten / p.totalBytesExpectedToWrite) * 100);
          const now = Date.now();
          if (now - lastTime >= 1000) {
            const bps = ((p.totalBytesWritten - lastBytes) / Math.max(1, now - lastTime)) * 1000;
            const mbps = (bps / 1024 / 1024).toFixed(1);
            const speedString = `${(p.totalBytesWritten/1e9).toFixed(2)}GB / ${(p.totalBytesExpectedToWrite/1e9).toFixed(2)}GB • ${mbps}MB/s`;
            lastBytes = p.totalBytesWritten;
            lastTime = now;
            setActiveDownloads(prev => prev[id] ? { ...prev, [id]: { ...prev[id], progress: pct, speedString } } : prev);
          }
        };

        const resumable = createDownloadResumable(
          targetUrl,
          fileUri,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Referer': 'https://themoviezone247.com/',
            },
          },
          progressCallback
        );
        resumablesRef.current[id] = resumable;

        try {
          while (pausedRef.current.has(id)) await new Promise(r => setTimeout(r, 1000));
          const result = await resumable.downloadAsync();
          if (result && result.status === 200) {
            lastResultUri = result.uri;
            success = true;
            break;
          } else if (result) {
            fatalError = `Server returned ${result.status}`;
          }
        } catch (err: any) {
          if (err?.message?.includes('cancel') || !resumablesRef.current[id]) {
            isProcessing.current = false;
            return;
          }
          fatalError = err.message || 'Unknown error';
        }
      }

      try {
        if (success && lastResultUri) {
          if (mode === 'external') {
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status === 'granted') await MediaLibrary.createAssetAsync(lastResultUri);
          }
          if (isEpisode) {
            setEpisodeDownloads(prev => ({ ...prev, [id]: lastResultUri }));
            setDownloadedMovies(prev => prev.some(m => m.id === item.id) ? prev : [item, ...prev]);
          } else {
            setDownloadedMovies(prev => prev.some(m => m.id === id) ? prev : [{ ...item, localUri: lastResultUri } as any, ...prev]);
          }
        } else {
           Alert.alert('Download Failed', `"${title}" could not be saved. Error: ${fatalError}`);
        }
      } catch (_) {} finally {
        delete resumablesRef.current[id];
        delete entriesRef.current[id];
        pausedRef.current.delete(id);
        setTimeout(() => {
          setActiveDownloads(prev => { const n = { ...prev }; delete n[id]; return n; });
          setDownloadQueue(prev => prev.slice(1));
          isProcessing.current = false;
        }, 1500);
      }
    };

    processNext();
  }, [downloadQueue]);

  return (
    <DownloadContext.Provider value={{
      activeDownloads,
      downloadQueue,
      episodeDownloads,
      downloadedMovies,
      downloadEpisode,
      downloadMovie,
      pauseDownload,
      resumeDownload,
      cancelDownload,
      deleteDownload,
      isEpisodeDownloaded,
      isMovieDownloaded,
      getRemainingDownloads,
      getExternalDownloadLimit,
      downloadsUsedToday,
    }}>
      {children}
    </DownloadContext.Provider>
  );
};

export const useDownloads = () => {
  const context = useContext(DownloadContext);
  if (context === undefined) throw new Error('useDownloads must be used within a DownloadProvider');
  return context;
};
