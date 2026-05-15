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
import * as Notifications from 'expo-notifications';
import { downloadNotificationManager } from '@/lib/notificationHelper';
import { addNotificationResponseListener } from '@/lib/notifications';
import { auth, db } from '../../constants/firebaseConfig';
import { doc, updateDoc, increment, runTransaction, onSnapshot, serverTimestamp } from 'firebase/firestore';

const {
  documentDirectory,
  cacheDirectory,
  getFreeDiskStorageAsync,
  createDownloadResumable,
} = FileSystem;

const inferExternalDailyLimit = (plan: any, fallback = 1) => {
  const base = plan?.externalDownloadDailyLimit || plan?.downloadLimit || fallback;
  const bonus = plan?.bonusDownloads || 0;
  return base + bonus;
};

const inferExternalTotalLimit = (plan: any, fallback = 1) => {
  const base = plan?.externalDownloadTotalLimit || plan?.downloadLimit || fallback;
  const bonus = plan?.bonusDownloads || 0;
  
  // If no explicit total limit is set, and it's not a legacy override, 
  // we might want to infer it for long-duration plans, 
  // but for consistency with admin, we should trust the fields.
  if (plan?.externalDownloadTotalLimit) return plan.externalDownloadTotalLimit + bonus;
  
  // Fallback to legacy inference ONLY if explicit fields are missing
  const name = (plan?.name || '').toLowerCase();
  if (name.includes('1 day')) return (plan?.downloadLimit || 1) + bonus;
  if (name.includes('1 week')) return Math.max(8, (plan?.downloadLimit || 1) * 7) + bonus;
  if (name.includes('2 week')) return Math.max(16, (plan?.downloadLimit || 1) * 14) + bonus;
  if (name.includes('1 month') || name === 'month') return Math.max(32, (plan?.downloadLimit || 1) * 30) + bonus;
  if (name.includes('2 month')) return Math.max(60, (plan?.downloadLimit || 1) * 60) + bonus;

  return (plan?.downloadLimit || fallback) + bonus;
};

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
  verifyLocalFile: (id: string) => Promise<string | null>;
  cancelSeriesDownloads: (seriesId: string) => void;
}

const DownloadContext = createContext<DownloadContextType | undefined>(undefined);

export const DownloadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeDownloads, setActiveDownloads] = useState<Record<string, DownloadEntry>>({});
  const [downloadQueue, setDownloadQueue] = useState<string[]>([]);
  const [episodeDownloads, setEpisodeDownloads] = useState<Record<string, string>>({});
  const [episodeParentMap, setEpisodeParentMap] = useState<Record<string, string>>({});
  const [downloadedMovies, setDownloadedMovies] = useState<any[]>([]);
  const [downloadsUsedToday, setDownloadsUsedToday] = useState(0);
  const [externalDownloadsUsedTotal, setExternalDownloadsUsedTotal] = useState(0);

  const subscriptionData = useSubscription();
  const { 
    isPaid, isSubscribed, allMoviesFree, subscriptionBundle, 
    subscriptionExpiresAt, isGuest, recordTrialUsage,
    planLimits 
  } = subscriptionData;
  const hasInternalDownloadAccess = isPaid || isSubscribed || allMoviesFree;

  // Refs for download engine state
  const entriesRef = useRef<Record<string, DownloadEntry>>({});
  const resumablesRef = useRef<Record<string, FileSystem.DownloadResumable>>({});
  const cancelledIdsRef = useRef<Set<string>>(new Set()); 
  const completedIdsRef = useRef<Set<string>>(new Set()); 
  const reservedExternalIdsRef = useRef<Set<string>>(new Set());
  const cancelledSeriesIdsRef = useRef<Set<string>>(new Set());
  const isProcessing = useRef(false);
  const externalReservationQueueRef = useRef(Promise.resolve());

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
        const [epSaved, parentSaved, movSaved, usedSaved, dateSaved] = await Promise.all([
          AsyncStorage.getItem('down_episodes'),
          AsyncStorage.getItem('down_episode_parents'),
          AsyncStorage.getItem('down_movies'),
          AsyncStorage.getItem('down_used_today_v2'),
          AsyncStorage.getItem('down_date_v2'),
        ]);
        if (epSaved) setEpisodeDownloads(JSON.parse(epSaved));
        if (parentSaved) setEpisodeParentMap(JSON.parse(parentSaved));
        if (movSaved) setDownloadedMovies(JSON.parse(movSaved));

        if (!isGuest) {
          setDownloadsUsedToday(0);
          return;
        }

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
  }, [isGuest]);

  useEffect(() => {
    AsyncStorage.setItem('down_episodes', JSON.stringify(episodeDownloads));
    AsyncStorage.setItem('down_episode_parents', JSON.stringify(episodeParentMap));
    AsyncStorage.setItem('down_movies', JSON.stringify(downloadedMovies));
  }, [episodeDownloads, episodeParentMap, downloadedMovies]);

  useEffect(() => {
    AsyncStorage.setItem('down_used_today_v2', String(downloadsUsedToday));
  }, [downloadsUsedToday]);

  // ── Asset Verification ────────────────────────────────────────────────────────
  const verifyLocalFile = async (id: string): Promise<string | null> => {
    const movie = downloadedMovies.find(m => m.id === id);
    const epUri = episodeDownloads[id];
    const uri = movie?.localUri || epUri;
    
    if (!uri) return null;
    
    try {
      const info = await FileSystem.getInfoAsync(uri);
      if (info.exists) return uri;
      
      // If not exists, clean up state
      console.warn(`[DownloadContext] File missing at ${uri}, cleaning up.`);
      removeDownload(id);
      return null;
    } catch (e) {
      return null;
    }
  };

  // Periodically verify all downloads
  useEffect(() => {
    const verifyAll = async () => {
      if (downloadedMovies.length === 0 && Object.keys(episodeDownloads).length === 0) return;
      
      const missingIds: string[] = [];
      
      for (const m of downloadedMovies) {
        if (m.localUri) {
          try {
            const info = await FileSystem.getInfoAsync(m.localUri);
            if (!info.exists) missingIds.push(m.id);
          } catch (e) {}
        }
      }
      
      for (const [id, uri] of Object.entries(episodeDownloads)) {
        try {
          const info = await FileSystem.getInfoAsync(uri);
          if (!info.exists) missingIds.push(id);
        } catch (e) {}
      }
      
      if (missingIds.length > 0) {
        missingIds.forEach(id => removeDownload(id));
      }
    };
    
    const timer = setTimeout(verifyAll, 5000); // Verify once after 5s
    return () => clearTimeout(timer);
  }, [downloadedMovies.length, Object.keys(episodeDownloads).length]);

  // ── Notification Action Listener ─────────────────────────────────────────────
  useEffect(() => {
    const sub = addNotificationResponseListener(response => {
      const actionId = response.actionIdentifier;
      const data = response.notification.request.content.data;
      const id = data?.downloadId || data?.movieId;
      const parentId = data?.movieId; // Use specifically for routing
      const episodeId = data?.episodeId;
      if (!id) return;

      if (actionId === 'pause') {
        pauseDownload(id);
      } else if (actionId === 'resume') {
        resumeDownload(id);
      } else if (actionId === 'cancel') {
        cancelDownload(id);
      } else if (actionId === Notifications.DEFAULT_ACTION_IDENTIFIER) {
        // Default tap action (tapping the main body of the notification)
        const { router } = require('expo-router');
        router.push({
          pathname: '/(tabs)',
          params: { movieId: parentId || id, episodeId }
        });
      }
    });
    return () => { if (sub?.remove) sub.remove(); };
  }, []);

  // ── Logic Helpers ───────────────────────────────────────────────────────────
  const getDownloadDateKey = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getExternalCounterRef = () => {
    const user = auth.currentUser;
    const dateKey = getDownloadDateKey();

    if (isGuest) {
      const id = subscriptionData.deviceId || user?.uid;
      return id ? doc(db, 'device_trials', id) : null;
    }

    return user ? doc(db, 'users', user.uid, 'downloadCounters', dateKey) : null;
  };

  const getExternalPlanKey = () => {
    if (isGuest) return `guest:${subscriptionData.deviceId || auth.currentUser?.uid || 'unknown'}`;
    return `${subscriptionBundle || 'None'}:${subscriptionExpiresAt || 'no-expiry'}`;
  };

  const getExternalTotalCounterRef = () => {
    const user = auth.currentUser;
    if (isGuest) {
      const id = subscriptionData.deviceId || user?.uid;
      return id ? doc(db, 'device_trials', id) : null;
    }
    return user ? doc(db, 'users', user.uid, 'downloadCounters', 'external_total') : null;
  };

  useEffect(() => {
    const ref = getExternalCounterRef();
    const totalRef = getExternalTotalCounterRef();
    if (!ref || !totalRef) return;

    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.exists() ? snap.data() : {};
      const dateKey = getDownloadDateKey();

      if (isGuest) {
        const usageDate = data.externalDownloadDate || '';
        setDownloadsUsedToday(usageDate === dateKey ? (data.externalDownloadsUsed || 0) : 0);
      } else {
        setDownloadsUsedToday(data.externalDownloadsUsed || 0);
      }
    }, (error: any) => {
      if (error.code === 'permission-denied') return;
      console.error("DownloadContext: Daily counter listener error:", error);
    });

    return unsub;
  }, [auth.currentUser?.uid, isGuest, subscriptionData.deviceId]);

  useEffect(() => {
    const ref = getExternalTotalCounterRef();
    if (!ref) return;

    const expectedPlanKey = getExternalPlanKey();
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.exists() ? snap.data() : {};
      if (isGuest) {
        setExternalDownloadsUsedTotal(data.hasUsedTrial ? 1 : 0);
        return;
      }
      setExternalDownloadsUsedTotal(data.planKey === expectedPlanKey ? (data.externalDownloadsUsedTotal || 0) : 0);
    }, (error: any) => {
      if (error.code === 'permission-denied') return;
      console.error("DownloadContext: Total counter listener error:", error);
    });

    return unsub;
  }, [auth.currentUser?.uid, isGuest, subscriptionData.deviceId, subscriptionBundle, subscriptionExpiresAt]);

  const getMatchedPlan = () => {
    const normalizedBundle = subscriptionBundle ? subscriptionBundle.toLowerCase() : 'none';
    return subscriptionData.availablePlans.find(
      p => p.name.toLowerCase() === normalizedBundle
    );
  };

  const getExternalDailyDownloadLimit = () => {
    if (isGuest) return (subscriptionData as any).hasUsedGuestTrial ? 0 : 1; // 1 Free Trial total
    const normalizedBundle = subscriptionBundle ? subscriptionBundle.toLowerCase() : 'none';
    if (normalizedBundle === 'none') return 0;

    const matchedPlan = getMatchedPlan();
    if (!matchedPlan) return planLimits[subscriptionBundle] || 1;

    return inferExternalDailyLimit(matchedPlan);
  };

  const getExternalTotalDownloadLimit = () => {
    if (isGuest) return (subscriptionData as any).hasUsedGuestTrial ? 0 : 1;
    if ((subscriptionData as any).customExternalLimit > 0) return (subscriptionData as any).customExternalLimit;
    const normalizedBundle = subscriptionBundle ? subscriptionBundle.toLowerCase() : 'none';
    if (normalizedBundle === 'none') return 0;

    const matchedPlan = getMatchedPlan();
    if (!matchedPlan) return (planLimits[subscriptionBundle] || 1) * 30; // Rough guess if plan doc missing

    return inferExternalTotalLimit(matchedPlan);
  };

  const getExternalDownloadLimit = () => {
    return Math.min(getExternalDailyDownloadLimit(), getExternalTotalDownloadLimit());
  };

  const getRemainingDownloads = () => {
    const dailyRemaining = getExternalDailyDownloadLimit() - downloadsUsedToday;
    const totalRemaining = getExternalTotalDownloadLimit() - externalDownloadsUsedTotal;
    return Math.max(0, Math.min(dailyRemaining, totalRemaining));
  };

  const isEpisodeDownloaded = (epId: string) => !!episodeDownloads[epId];
  const isMovieDownloaded = (id: string) => downloadedMovies.some(m => m.id === id);

  const updateNotification = (id: string, title: string, progress: number, speed: string, done: boolean, isPaused = false) => {
    const entry = entriesRef.current[id];
    const poster = entry?.poster || '';
    const movieId = entry?.movieId || id;
    const episodeId = entry?.isEpisode ? id : undefined;
    downloadNotificationManager.updateProgress(id, title, progress, speed, poster, isPaused, movieId, episodeId)
      .catch(e => console.warn('[Notif] Update failed:', e));
  };

  const reserveExternalDownloadSlotNow = async (entry: DownloadEntry) => {
    if (entry.mode !== 'external') return true;

    if (!isPaid && !isSubscribed && !isGuest) {
      Alert.alert('Premium Required', 'Saving to your gallery is a premium feature. Upgrade to enable external downloads.');
      return false;
    }

    const ref = getExternalCounterRef();
    const totalRef = getExternalTotalCounterRef();
    const dailyLimit = getExternalDailyDownloadLimit();
    const totalLimit = getExternalTotalDownloadLimit();
    const dateKey = getDownloadDateKey();
    const planKey = getExternalPlanKey();

    if (!ref || !totalRef || dailyLimit <= 0 || totalLimit <= 0) {
      Alert.alert('Limit Reached', 'External downloads are not available on your current plan.');
      return false;
    }

    try {
      const reservation = await runTransaction(db, async (transaction) => {
        const [dailySnap, totalSnap] = await Promise.all([
          transaction.get(ref),
          transaction.get(totalRef),
        ]);
        const dailyData = dailySnap.exists() ? dailySnap.data() : {};
        const totalData = totalSnap.exists() ? totalSnap.data() : {};
        const usageDate = isGuest ? (dailyData.externalDownloadDate || '') : dateKey;
        const currentDailyUsed = usageDate === dateKey ? (dailyData.externalDownloadsUsed || 0) : 0;
        const currentTotalUsed = isGuest
          ? (totalData.hasUsedTrial ? 1 : 0)
          : (totalData.planKey === planKey ? (totalData.externalDownloadsUsedTotal || 0) : 0);

        if (currentDailyUsed >= dailyLimit) {
          throw new Error('DAILY_LIMIT_REACHED');
        }
        if (currentTotalUsed >= totalLimit) {
          throw new Error('TOTAL_LIMIT_REACHED');
        }

        const nextDailyUsed = currentDailyUsed + 1;
        const nextTotalUsed = currentTotalUsed + 1;
        transaction.set(ref, {
          externalDownloadsUsed: nextDailyUsed,
          externalDownloadDate: dateKey,
          updatedAt: serverTimestamp(),
          ...(isGuest ? {} : { userId: auth.currentUser?.uid, date: dateKey }),
        }, { merge: true });

        transaction.set(totalRef, {
          externalDownloadsUsedTotal: nextTotalUsed,
          externalDownloadTotalLimit: totalLimit,
          externalDownloadDailyLimit: dailyLimit,
          planKey,
          updatedAt: serverTimestamp(),
          ...(isGuest ? { hasUsedTrial: true } : { userId: auth.currentUser?.uid, subscriptionBundle, subscriptionExpiresAt }),
        }, { merge: true });

        return { daily: nextDailyUsed, total: nextTotalUsed };
      });

      reservedExternalIdsRef.current.add(entry.id);
      setDownloadsUsedToday(reservation.daily);
      setExternalDownloadsUsedTotal(reservation.total);
      return true;
    } catch (error: any) {
      const isLimitReached = error?.message === 'DAILY_LIMIT_REACHED' || error?.message === 'TOTAL_LIMIT_REACHED';
      const message = isLimitReached
        ? (isGuest
          ? 'You have already used your free trial download. Please register or upgrade to continue.'
          : error?.message === 'TOTAL_LIMIT_REACHED'
            ? 'You have reached the total external download allowance for this plan.'
            : 'You have reached your daily limit for external downloads. Upgrade or wait until tomorrow.')
        : 'Could not confirm your external download allowance. Please try again in a moment.';
      console.warn('[DownloadContext] External download limit check failed:', error?.code || error?.message || error);
      Alert.alert(isLimitReached ? 'Limit Reached' : 'Download Limit Check Failed', message);
      return false;
    }
  };

  const reserveExternalDownloadSlot = (entry: DownloadEntry) => {
    if (entry.mode !== 'external') return Promise.resolve(true);

    const task = externalReservationQueueRef.current.then(() => reserveExternalDownloadSlotNow(entry));
    externalReservationQueueRef.current = task.then(() => undefined).catch(() => undefined);
    return task;
  };

  const releaseExternalDownloadSlot = async (id: string) => {
    if (!reservedExternalIdsRef.current.has(id)) return;
    reservedExternalIdsRef.current.delete(id);

    const ref = getExternalCounterRef();
    const totalRef = getExternalTotalCounterRef();
    if (!ref || !totalRef) return;

    try {
      const nextUsage = await runTransaction(db, async (transaction) => {
        const [dailySnap, totalSnap] = await Promise.all([
          transaction.get(ref),
          transaction.get(totalRef),
        ]);
        if (!dailySnap.exists() && !totalSnap.exists()) return { daily: 0, total: 0 };

        const data = dailySnap.exists() ? dailySnap.data() : {};
        const totalData: any = totalSnap.exists() ? totalSnap.data() : {};
        const dateKey = getDownloadDateKey();
        const planKey = getExternalPlanKey();
        const usageDate = isGuest ? (data.externalDownloadDate || '') : dateKey;
        const currentUsed = usageDate === dateKey ? (data.externalDownloadsUsed || 0) : 0;
        const updatedUsed = Math.max(0, currentUsed - 1);
        const currentTotalUsed = isGuest
          ? (totalData.hasUsedTrial ? 1 : 0)
          : (totalData.planKey === planKey ? (totalData.externalDownloadsUsedTotal || 0) : 0);
        const updatedTotalUsed = Math.max(0, currentTotalUsed - 1);

        transaction.set(ref, {
          externalDownloadsUsed: updatedUsed,
          externalDownloadDate: dateKey,
          updatedAt: serverTimestamp(),
        }, { merge: true });

        transaction.set(totalRef, {
          externalDownloadsUsedTotal: updatedTotalUsed,
          ...(isGuest ? { hasUsedTrial: updatedTotalUsed > 0 } : { planKey }),
          updatedAt: serverTimestamp(),
        }, { merge: true });

        return { daily: updatedUsed, total: updatedTotalUsed };
      });

      setDownloadsUsedToday(nextUsage.daily);
      setExternalDownloadsUsedTotal(nextUsage.total);
    } catch (_) {}
  };

  // ── Actions ─────────────────────────────────────────────────────────────────
  const enqueue = async (entry: DownloadEntry) => {
    if (cancelledSeriesIdsRef.current.has(entry.movieId)) {
      cancelledIdsRef.current.add(entry.id);
      downloadNotificationManager.dismiss(entry.id).catch(() => {});
      return false;
    }

    // 1. Check existing queue/active state
    if (entriesRef.current[entry.id]) {
      Alert.alert('In Progress', 'This item is already downloading or in your queue.');
      return false;
    }

    // 2. Enforce Plan Limits
    if (entry.mode === 'external') {
      const reserved = await reserveExternalDownloadSlot(entry);
      if (!reserved) return false;
    } else {
      // Internal Mode
      if (isGuest && !allMoviesFree) {
        const remaining = getRemainingDownloads(); // Use same trial pool for simplicity
        if (remaining <= 0) {
          Alert.alert('Trial Limit', 'You have already used your free trial download. Please register or upgrade to continue.');
          return false;
        }
      } else if (!hasInternalDownloadAccess) {
        Alert.alert('Subscription Required', 'Offline viewing inside the app is a premium feature. Please upgrade to start downloading.');
        return false;
      }
      // Paid users OR holiday mode users get internal downloads
    }

    // 3. Add to Queue
    entriesRef.current[entry.id] = entry;
    completedIdsRef.current.delete(entry.id);
    cancelledIdsRef.current.delete(entry.id);
    setDownloadQueue(prev => [...prev, entry.id]);
    setActiveDownloads(prev => ({ ...prev, [entry.id]: entry }));
    return true;
  };

  const downloadEpisode = (series: Series, episode: any, mode: 'internal' | 'external') => {
    if (!episode || !episode.id || isEpisodeDownloaded(episode.id)) return;
    const url = getStreamUrl(episode) || episode.videoUrl || '';
    
    console.log('[DownloadContext] downloadEpisode:', {
      series: series.title,
      episode: episode.title,
      url,
      seriesPreviewUrl: series.previewUrl
    });

    if (!url) {
      Alert.alert('Coming Soon', 'This episode is not available for download yet. Stay tuned!');
      return;
    }

    // Strict Validation: Prevent downloading if it's explicitly a preview link
    const isExplicitPreview = url.toLowerCase().includes('/preview/') || url.toLowerCase().includes('preview.mp4');
    if (series.previewUrl && url === series.previewUrl && isExplicitPreview) {
      Alert.alert('Content Unavailable', 'This episode is currently only available as a preview and cannot be downloaded yet.');
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
    
    console.log('[DownloadContext] downloadMovie:', {
      title: movie.title,
      url,
      previewUrl: (movie as any).previewUrl
    });

    if (!url) { Alert.alert('Coming Soon', 'This movie is not available for download yet. Stay tuned!'); return; }
    
    // Validation: Only block if it's explicitly a preview URL (contains "preview")
    // If the URLs just happen to be equal (e.g. both resolve to same HLS playlist), we allow it
    const isExplicitPreview = url.toLowerCase().includes('/preview/') || url.toLowerCase().includes('preview.mp4');
    if ((movie as any).previewUrl && url === (movie as any).previewUrl && isExplicitPreview) {
      Alert.alert('Content Unavailable', 'This content is currently only available as a preview and cannot be downloaded yet.');
      return;
    }

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
    const entry = entriesRef.current[id];
    const resumable = resumablesRef.current[id];
    if (resumable) resumable.cancelAsync().catch(() => {});
    if (entry?.mode === 'external') releaseExternalDownloadSlot(id);
    downloadNotificationManager.dismiss(id).catch(() => {});
    setTimeout(() => downloadNotificationManager.dismiss(id).catch(() => {}), 500);
    delete resumablesRef.current[id];
    delete entriesRef.current[id];
    isProcessing.current = false; 
    setDownloadQueue(prev => prev.filter(qid => qid !== id));
    setActiveDownloads(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  const cancelSeriesDownloads = (seriesId: string) => {
    console.log('[Download] Cancelling all episodes for series:', seriesId);
    cancelledSeriesIdsRef.current.add(seriesId);
    setTimeout(() => cancelledSeriesIdsRef.current.delete(seriesId), 3000);

    const toCancel = Object.values(entriesRef.current)
      .filter(entry => entry.movieId === seriesId)
      .map(entry => entry.id);

    if (toCancel.length === 0) return;

    toCancel.forEach(id => {
      cancelledIdsRef.current.add(id);
    });

    toCancel.forEach(id => {
      const entry = entriesRef.current[id];
      const resumable = resumablesRef.current[id];
      if (resumable) resumable.cancelAsync().catch(() => {});
      if (entry?.mode === 'external') releaseExternalDownloadSlot(id);
      downloadNotificationManager.dismiss(id).catch(() => {});
      setTimeout(() => downloadNotificationManager.dismiss(id).catch(() => {}), 500);
      setTimeout(() => downloadNotificationManager.dismiss(id).catch(() => {}), 1500);
      delete resumablesRef.current[id];
      delete entriesRef.current[id];
    });

    isProcessing.current = false;
    setDownloadQueue(prev => prev.filter(qid => !toCancel.includes(qid)));
    setActiveDownloads(prev => {
      const next = { ...prev };
      toCancel.forEach(id => delete next[id]);
      return next;
    });
  };

  const removeDownload = (id: string) => {
    setDownloadedMovies(prev => prev.filter(m => m.id !== id));
    setEpisodeDownloads(prev => {
      const next = { ...prev };
      if (next[id]) {
        delete next[id];
      } else {
        Object.keys(next).forEach(key => {
          const parentId = episodeParentMap[key];
          if (parentId === id || key.startsWith(`${id}-ep-`)) {
            delete next[key];
          }
        });
      }
      return next;
    });
    setEpisodeParentMap(prev => {
      const next = { ...prev };
      if (next[id]) {
        delete next[id];
      }
      Object.keys(next).forEach(key => {
        if (next[key] === id || key === id || key.startsWith(`${id}-ep-`)) {
          delete next[key];
        }
      });
      return next;
    });
  };

  const deleteDownload = async (id: string) => {
    try {
      const movie = downloadedMovies.find(m => m.id === id);
      const epUri = episodeDownloads[id];
      const childEpisodeIds = Object.keys(episodeDownloads).filter((epId) => {
        const parentId = episodeParentMap[epId];
        return parentId === id || epId.startsWith(`${id}-ep-`);
      });
      const urisToDelete = new Set<string>();

      if (movie?.localUri) urisToDelete.add(movie.localUri);
      if (epUri) urisToDelete.add(epUri);
      childEpisodeIds.forEach((epId) => {
        const childUri = episodeDownloads[epId];
        if (childUri) urisToDelete.add(childUri);
      });

      for (const uri of urisToDelete) {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      }
      
      removeDownload(id);
      console.log(`[DownloadContext] Deleted ${id} from storage.`);
    } catch (e) {
      console.warn('[DownloadContext] Delete error:', e);
    }
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
              setActiveDownloads(prev => ({ 
                ...prev, 
                [id]: { ...(prev[id] || entriesRef.current[id]), progress: pct, speedString } 
              }));
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
            if (status !== 'granted') {
              await releaseExternalDownloadSlot(id);
              await FileSystem.deleteAsync(lastResultUri, { idempotent: true }).catch(() => {});
              await downloadNotificationManager.notifyError(
                id,
                title,
                'Media permission was denied. Allow Photos and Videos permission to save this download.',
                entry.movieId,
                isEpisode ? id : undefined
              ).catch(() => {});
              Alert.alert('Permission Required', 'Please allow media access in your phone settings to save external downloads.');
              return;
            }

            await Promise.race([
              MediaLibrary.createAssetAsync(lastResultUri),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000)),
            ]);

            await FileSystem.deleteAsync(lastResultUri, { idempotent: true }).catch(() => {});
          }

          if (isGuest) recordTrialUsage();

          const analyticsCollection = isEpisode || 'seasons' in item ? 'series' : 'movies';
          const analyticsId = isEpisode ? entry.movieId : item.id;
          if (analyticsId) {
            updateDoc(doc(db, analyticsCollection, analyticsId), {
              downloads: increment(1)
            }).catch(e => console.warn('Failed to increment completed downloads:', e));
          }

          if (isEpisode) {
            if (mode === 'internal') {
              setEpisodeParentMap(prev => ({ ...prev, [id]: item.id }));
              setEpisodeDownloads(prev => ({ ...prev, [id]: lastResultUri }));
              setDownloadedMovies(prev => prev.some(m => m.id === item.id) ? prev : [item, ...prev]);
            }
          } else if (mode === 'internal') {
            setDownloadedMovies(prev => prev.some(m => m.id === id) ? prev : [{ ...item, ...(mode === 'internal' ? { localUri: lastResultUri } : {}) } as any, ...prev]);
          }

          // External downloads are counted when the slot is reserved. Do not
          // count them again here, or cancel/retry can desync the visible limit.
          if (isGuest && mode !== 'external') {
            setDownloadsUsedToday(prev => prev + 1);
          }
          
          completedIdsRef.current.add(id);
          updateNotification(id, title, 100, 'Complete', true);
        } else if (!success && fatalError && !cancelledIdsRef.current.has(id)) {
          if (mode === 'external') await releaseExternalDownloadSlot(id);
          Alert.alert('Download Failed', `"${title}" - ${fatalError}`);
          downloadNotificationManager.notifyError(id, title, fatalError, entry.movieId, isEpisode ? id : undefined).catch(() => {});
        }
      } catch (err) {
        if (mode === 'external') await releaseExternalDownloadSlot(id);
      } finally {
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
      removeDownload, verifyLocalFile, cancelSeriesDownloads,
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
