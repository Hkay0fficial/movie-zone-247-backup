/**
 * DownloadContext.tsx
 *
 * Clean-slate download engine. Single responsibility: download files.
 * KEY ARCHITECTURE:
 * - pauseAsync() / resumeAsync() are called on the actual DownloadResumable object.
 * - cancelDownload is fully SYNCHRONOUS to prevent UI freezes.
 * - completedIdsRef guards against auto-restart loops.
 * - NEW: Migration cleanup clearly removes legacy auto-downloads on startup.
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
import { Movie, Series, getStreamUrl } from '../../constants/movieData';
import { getDownloadUrlVariants } from '../../constants/bunnyConfig';
import { useSubscription } from './SubscriptionContext';
import { downloadNotificationManager } from '@/lib/notificationHelper';
import { addNotificationResponseListener } from '@/lib/notifications';

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
  episodeDownloads: Record<string, string>;
  downloadedMovies: any[];
  downloadEpisode: (series: Series, episode: any, mode: 'internal' | 'external') => void;
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
  removeDownload: (id: string) => void;
}

const DownloadContext = createContext<DownloadContextType | undefined>(undefined);

export const DownloadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeDownloads, setActiveDownloads] = useState<Record<string, DownloadEntry>>({});
  const [downloadQueue, setDownloadQueue] = useState<string[]>([]);
  const [episodeDownloads, setEpisodeDownloads] = useState<Record<string, string>>({});
  const [downloadedMovies, setDownloadedMovies] = useState<any[]>([]);
  const [downloadsUsedToday, setDownloadsUsedToday] = useState(0);

  const { isPaid, subscriptionBundle, isGuest, recordTrialUsage } = useSubscription();

  // Refs for download engine state
  const entriesRef = useRef<Record<string, DownloadEntry>>({});
  const resumablesRef = useRef<Record<string, FileSystem.DownloadResumable>>({});
  const cancelledIdsRef = useRef<Set<string>>(new Set()); 
  const completedIdsRef = useRef<Set<string>>(new Set()); 
  const isProcessing = useRef(false);

  // ── MIGRATION CLEANUP ────────────────────────────────────────────────────────
  // This kills any legacy "Auto-downloads" by clearing the old context's keys
  useEffect(() => {
    downloadNotificationManager.initChannel().catch(e => console.warn('Failed to init notification channel', e));
    const cleanup = async () => {
      try {
        await AsyncStorage.removeItem('active_downloads_metadata');
        await AsyncStorage.removeItem('download_queue'); // Legacy key
        console.log('[DownloadContext] Migration cleanup: old metadata cleared.');
      } catch (e) {}
    };
    cleanup();
  }, []);

  // ── Persistence ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const [epSaved, movSaved, usedSaved, dateSaved] = await Promise.all([
          AsyncStorage.getItem('down_episodes'),
          AsyncStorage.getItem('down_movies'),
          AsyncStorage.getItem('down_used_today_v2'),
          AsyncStorage.getItem('down_date_v2'),
        ]);
        if (epSaved) setEpisodeDownloads(JSON.parse(epSaved));
        if (movSaved) setDownloadedMovies(JSON.parse(movSaved));
        
        const today = new Date().toDateString();
        if (dateSaved === today && usedSaved) {
          setDownloadsUsedToday(parseInt(usedSaved, 10));
        } else {
          setDownloadsUsedToday(0);
          await AsyncStorage.setItem('down_date_v2', today);
          await AsyncStorage.setItem('down_used_today_v2', '0');
        }
      } catch (_) {}
    };
    load();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem('down_episodes', JSON.stringify(episodeDownloads));
    AsyncStorage.setItem('down_movies', JSON.stringify(downloadedMovies));
  }, [episodeDownloads, downloadedMovies]);

  useEffect(() => {
    AsyncStorage.setItem('down_used_today_v2', String(downloadsUsedToday));
  }, [downloadsUsedToday]);

  // ── Notification Action Listener ─────────────────────────────────────────────
  useEffect(() => {
    const sub = addNotificationResponseListener(response => {
      const actionId = response.actionIdentifier;
      const id = response.notification.request.content.data?.movieId;
      if (!id) return;
      if (actionId === 'pause') pauseDownload(id);
      else if (actionId === 'resume') resumeDownload(id);
      else if (actionId === 'cancel') cancelDownload(id);
    });
    return () => { if (sub?.remove) sub.remove(); };
  }, []);

  // ── Logic Helpers ───────────────────────────────────────────────────────────
  const getExternalDownloadLimit = () => {
    if (isGuest) return 1; // 1 Free Trial
    const limits: Record<string, number> = {
      '1 week': 1, '2 weeks': 2, '1 Month': 3, '2 months': 5, 'Premium': 10, 'VIP': 999, 'None': 0
    };
    return limits[subscriptionBundle] || 0;
  };

  const getRemainingDownloads = () => {
    return Math.max(0, getExternalDownloadLimit() - downloadsUsedToday);
  };

  const isEpisodeDownloaded = (epId: string) => !!episodeDownloads[epId];
  const isMovieDownloaded = (id: string) => downloadedMovies.some(m => m.id === id);

  const updateNotification = (id: string, title: string, progress: number, speed: string, done: boolean, isPaused = false) => {
    const poster = entriesRef.current[id]?.poster || '';
    downloadNotificationManager.updateProgress(id, title, progress, speed, poster, isPaused)
      .catch(e => console.warn('[Notif] Update failed:', e));
  };

  // ── Actions ─────────────────────────────────────────────────────────────────
  const enqueue = (entry: DownloadEntry) => {
    const remaining = getRemainingDownloads();
    if (remaining <= 0) {
      Alert.alert('Limit Reached', 'You have reached your daily download limit. Upgrade or wait until tomorrow.');
      return false;
    }

    if (entriesRef.current[entry.id]) {
      Alert.alert('In Queue', 'This item is already in your download queue.');
      return false;
    }
    entriesRef.current[entry.id] = entry;
    completedIdsRef.current.delete(entry.id);
    cancelledIdsRef.current.delete(entry.id);
    setDownloadQueue(prev => [...prev, entry.id]);
    return true;
  };

  const downloadEpisode = (series: Series, episode: any, mode: 'internal' | 'external') => {
    if (!episode || !episode.id || isEpisodeDownloaded(episode.id)) return;
    const url = getStreamUrl(episode) || episode.videoUrl || '';
    if (!url) {
      Alert.alert('Cannot Download', 'This episode does not have a video URL.');
      return;
    }
    enqueue({
      id: episode.id, title: episode.title || `${series.title} — Episode`,
      movieId: series.id, type: 'Series', poster: series.poster || '',
      progress: 0, speedString: '', isPaused: false,
      mode, url, item: series, isEpisode: true,
    });
  };

  const downloadMovie = (movie: Movie | Series, mode: 'internal' | 'external') => {
    if (!movie.id) return;
    const url = getStreamUrl(movie) || (movie as any).videoUrl || '';
    if (!url) { Alert.alert('Cannot Download', 'This movie does not have a video URL yet.'); return; }
    if (isMovieDownloaded(movie.id)) return;
    enqueue({
      id: movie.id, title: movie.title, movieId: movie.id, type: 'Movie',
      poster: movie.poster || '', progress: 0, speedString: '', isPaused: false,
      mode, url, item: movie, isEpisode: false,
    });
  };

  const pauseDownload = (id: string) => {
    const resumable = resumablesRef.current[id];
    if (resumable) {
      if (entriesRef.current[id]) entriesRef.current[id].isPaused = true;
      resumable.pauseAsync()
        .then(() => {
          setActiveDownloads(prev => prev[id] ? { ...prev, [id]: { ...prev[id], isPaused: true } } : prev);
          const entry = entriesRef.current[id];
          if (entry) updateNotification(id, entry.title, entry.progress, entry.speedString, false, true);
        })
        .catch(e => console.warn('[Download] Pause failed:', e));
    }
  };

  const resumeDownload = (id: string) => {
    if (resumablesRef.current[id] && entriesRef.current[id]) {
      entriesRef.current[id].isPaused = false;
      setActiveDownloads(prev => prev[id] ? { ...prev, [id]: { ...prev[id], isPaused: false } } : prev);
      const entry = entriesRef.current[id];
      updateNotification(id, entry.title, entry.progress, entry.speedString, false, false);
      
      // Inject back to front of processing queue
      setDownloadQueue(prev => [id, ...prev.filter(qid => qid !== id)]);
    }
  };

  const cancelDownload = (id: string) => {
    console.log('[Download] Cancelling:', id);
    cancelledIdsRef.current.add(id);
    const resumable = resumablesRef.current[id];
    if (resumable) resumable.cancelAsync().catch(() => {});
    downloadNotificationManager.dismiss(id).catch(() => {});
    delete resumablesRef.current[id];
    delete entriesRef.current[id];
    isProcessing.current = false; 
    setDownloadQueue(prev => prev.filter(qid => qid !== id));
    setActiveDownloads(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  const removeDownload = (id: string) => {
    setDownloadedMovies(prev => prev.filter(m => m.id !== id));
    setEpisodeDownloads(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(key => {
        if (key.includes(id)) delete next[key];
      });
      return next;
    });
  };

  const deleteDownload = async (id: string) => {
    // TBD: File system cleanup
  };

  // ── Queue processor ─────────────────────────────────────────────────────────
  useEffect(() => {
    const processNext = async () => {
      if (downloadQueue.length === 0 || isProcessing.current) return;

      const id = downloadQueue[0];
      if (cancelledIdsRef.current.has(id) || completedIdsRef.current.has(id)) {
        setDownloadQueue(prev => prev.filter(qid => qid !== id));
        return;
      }

      const entry = entriesRef.current[id];
      if (!entry) {
        setDownloadQueue(prev => prev.filter(qid => qid !== id));
        return;
      }

      isProcessing.current = true;
      const { title, mode, url: rawUrl, item, isEpisode } = entry;
      const urlVariants = getDownloadUrlVariants(rawUrl);
      let success = false;
      let lastResultUri = '';
      let fatalError = '';

      let isResuming = !!resumablesRef.current[id] && !entriesRef.current[id]?.isPaused;

      try {
        const free = await getFreeDiskStorageAsync();
        if (free < 300 * 1024 * 1024) {
          Alert.alert('Storage Full', 'You need at least 300 MB free to download.');
          cancelDownload(id);
          return;
        }
      } catch (_) {}

      // If resuming, skip the URL variant loop and directly resume the existing task
      if (isResuming) {
        const resumable = resumablesRef.current[id];
        try {
          const result = await resumable.resumeAsync();
          if (cancelledIdsRef.current.has(id)) {
             // Canceled during resume
          } else if (entriesRef.current[id]?.isPaused) {
            isProcessing.current = false;
            setDownloadQueue(prev => prev.filter(qid => qid !== id));
            return;
          } else if (result && (result as any).status === 200) {
            lastResultUri = (result as any).uri;
            success = true;
          } else if (result && typeof (result as any).status !== 'undefined') {
            fatalError = `Server ${(result as any).status}`;
          }
        } catch (err: any) {
          const msg = err?.message || '';
          if (entriesRef.current[id]?.isPaused) {
            isProcessing.current = false;
            setDownloadQueue(prev => prev.filter(qid => qid !== id));
            return;
          }
          if (!msg.includes('cancel') && !msg.includes('interrupt') && !cancelledIdsRef.current.has(id)) {
            fatalError = msg || 'Unknown error';
          }
        }
      } else {
        // Not resuming, strictly start a fresh download variant loop
        for (const targetUrl of urlVariants) {
          if (cancelledIdsRef.current.has(id)) break;
          const safeTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);
          const fileUri = mode === 'internal'
            ? `${documentDirectory}${safeTitle}_${Date.now()}.mp4`
            : `${cacheDirectory}${safeTitle}_${Date.now()}.mp4`;

          let lastBytes = 0;
          let lastTime = Date.now();

          const progressCallback = (p: { totalBytesWritten: number; totalBytesExpectedToWrite: number }) => {
            if (cancelledIdsRef.current.has(id) || p.totalBytesExpectedToWrite <= 0) return;
            const pct = Math.floor((p.totalBytesWritten / p.totalBytesExpectedToWrite) * 100);
            const now = Date.now();
            if (now - lastTime >= 1000) {
              const bps = ((p.totalBytesWritten - lastBytes) / Math.max(1, now - lastTime)) * 1000;
              const mbps = (bps / 1024 / 1024).toFixed(1);
              const speedString = `${(p.totalBytesWritten / 1e9).toFixed(2)}GB / ${(p.totalBytesExpectedToWrite / 1e9).toFixed(2)}GB • ${mbps}MB/s`;
              lastBytes = p.totalBytesWritten;
              lastTime = now;
              if (entriesRef.current[id]) {
                entriesRef.current[id].progress = pct;
                entriesRef.current[id].speedString = speedString;
              }
              updateNotification(id, title, pct, speedString, false, false);
              setActiveDownloads(prev => prev[id] ? { ...prev, [id]: { ...prev[id], progress: pct, speedString } } : prev);
            }
          };

          const resumable = createDownloadResumable(targetUrl, fileUri, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0)', 'Referer': 'https://themoviezone247.com/' },
          }, progressCallback);

          resumablesRef.current[id] = resumable;

          try {
            const result = await resumable.downloadAsync();
            if (cancelledIdsRef.current.has(id)) break;
            if (entriesRef.current[id]?.isPaused) {
              isProcessing.current = false;
              setDownloadQueue(prev => prev.filter(qid => qid !== id));
              return;
            }
            if (result && (result as any).status === 200) {
              lastResultUri = (result as any).uri;
              success = true;
              break;
            } else if (result && typeof (result as any).status !== 'undefined') {
              fatalError = `Server ${(result as any).status}`;
            }
          } catch (err: any) {
            const msg = err?.message || '';
            if (entriesRef.current[id]?.isPaused) {
              isProcessing.current = false;
              setDownloadQueue(prev => prev.filter(qid => qid !== id));
              return;
            }
            if (msg.includes('cancel') || msg.includes('interrupt') || cancelledIdsRef.current.has(id)) {
              break;
            }
            fatalError = msg || 'Unknown error';
          }
        }
      }

      try {
        if (success && lastResultUri && !cancelledIdsRef.current.has(id)) {
          if (mode === 'external') {
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status === 'granted') {
              await Promise.race([
                MediaLibrary.createAssetAsync(lastResultUri),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000)),
              ]).catch(() => {});
            }
            if (isGuest) recordTrialUsage();
          }
          if (isEpisode) {
            setEpisodeDownloads(prev => ({ ...prev, [id]: lastResultUri }));
            setDownloadedMovies(prev => prev.some(m => m.id === item.id) ? prev : [item, ...prev]);
          } else {
            setDownloadedMovies(prev => prev.some(m => m.id === id) ? prev : [{ ...item, localUri: lastResultUri } as any, ...prev]);
          }
          setDownloadsUsedToday(prev => prev + 1);
          completedIdsRef.current.add(id);
          updateNotification(id, title, 100, 'Complete', true);
        } else if (!success && fatalError && !cancelledIdsRef.current.has(id)) {
          Alert.alert('Download Failed', `"${title}" - ${fatalError}`);
          downloadNotificationManager.notifyError(title, fatalError).catch(() => {});
        }
      } catch (err) {} finally {
        delete resumablesRef.current[id];
        delete entriesRef.current[id];
        isProcessing.current = false;
        setDownloadQueue(prev => prev.filter(qid => qid !== id));
        setTimeout(() => setActiveDownloads(prev => { const n = { ...prev }; delete n[id]; return n; }), 1000);
      }
    };
    processNext();
  }, [downloadQueue]);

  return (
    <DownloadContext.Provider value={{
      activeDownloads, downloadQueue, episodeDownloads, downloadedMovies,
      downloadEpisode, downloadMovie, pauseDownload, resumeDownload,
      cancelDownload, deleteDownload, isEpisodeDownloaded, isMovieDownloaded,
      getRemainingDownloads, getExternalDownloadLimit, downloadsUsedToday,
      removeDownload,
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
