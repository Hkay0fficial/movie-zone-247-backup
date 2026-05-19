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
import * as Network from 'expo-network';
import { ActivityIndicator, Alert, Linking, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Movie, Series, getStreamUrl } from '../../constants/movieData';
import { getDownloadUrlVariants } from '../../constants/bunnyConfig';
import { useSubscription } from './SubscriptionContext';
import { useUser } from './UserContext';
import * as Notifications from 'expo-notifications';
import { downloadNotificationManager } from '@/lib/notificationHelper';
import { addNotificationResponseListener, sendLocalNotification } from '@/lib/notifications';
import { auth, db } from '../../constants/firebaseConfig';
import { doc, updateDoc, increment, runTransaction, onSnapshot, serverTimestamp, getDoc } from 'firebase/firestore';
import DownloadSuccessModal, { DownloadModalType } from '@/components/DownloadSuccessModal';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const PAYMENT_API_BASE = 'https://www.themoviezone247.com/api/payments';
const EXTERNAL_DOWNLOAD_TOKEN_PRICE_UGX = 500;
const CREDIT_PAYMENT_METHODS = [
  { id: 'mtn', label: 'MTN Mobile Money Uganda', icon: 'phone-portrait-outline', color: '#ffcc00' },
  { id: 'airtel', label: 'Airtel Money Uganda', icon: 'phone-portrait-outline', color: '#e11900' },
  { id: 'card', label: 'Credit card or Debit card', icon: 'card-outline', color: '#6366f1' },
] as const;

type CreditPaymentMethod = typeof CREDIT_PAYMENT_METHODS[number];

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
  remoteRequestId?: string;
}

interface DownloadContextType {
  activeDownloads: Record<string, DownloadEntry>;
  remoteActiveDownloads: Record<string, DownloadEntry>;
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
  requestRemoteDownload: (item: Movie | Series, episode?: any) => void;
  purchaseExternalDownloadCredits: (quantity: number, entry?: DownloadEntry) => Promise<boolean>;
  smartQueueCount: number;
}

const DownloadContext = createContext<DownloadContextType | undefined>(undefined);
const REMOTE_STATUS_ACK_STORAGE_KEY = 'remote_download_notified_statuses_v1';
const SMART_OFFLINE_QUEUE_KEY = 'smart_offline_queue_v1';

export const DownloadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeDownloads, setActiveDownloads] = useState<Record<string, DownloadEntry>>({});
  const [remoteActiveDownloads, setRemoteActiveDownloads] = useState<Record<string, DownloadEntry>>({});
  const [downloadQueue, setDownloadQueue] = useState<string[]>([]);
  const [episodeDownloads, setEpisodeDownloads] = useState<Record<string, string>>({});
  const [episodeParentMap, setEpisodeParentMap] = useState<Record<string, string>>({});
  const [downloadedMovies, setDownloadedMovies] = useState<any[]>([]);
  const [downloadsUsedToday, setDownloadsUsedToday] = useState(0);
  const [externalDownloadsUsedTotal, setExternalDownloadsUsedTotal] = useState(0);
  const [downloadAlert, setDownloadAlert] = useState<{
    visible: boolean;
    type: DownloadModalType;
    title: string;
    message: string;
  }>({
    visible: false,
    type: 'info',
    title: '',
    message: '',
  });
  const [remoteDownloadPrompt, setRemoteDownloadPrompt] = useState<any | null>(null);
  const [smartQueueCount, setSmartQueueCount] = useState(0);
  const [remoteDevicePicker, setRemoteDevicePicker] = useState<{
    item: Movie | Series;
    episode?: any;
    targets: string[];
  } | null>(null);
  const [creditPaymentRequest, setCreditPaymentRequest] = useState<{
    quantity: number;
    amount: number;
    entry?: DownloadEntry;
  } | null>(null);
  const [creditPaymentStep, setCreditPaymentStep] = useState<'methods' | 'details'>('methods');
  const [creditPaymentMethod, setCreditPaymentMethod] = useState<CreditPaymentMethod | null>(null);
  const [creditPaymentPhone, setCreditPaymentPhone] = useState('');
  const [creditCardNumber, setCreditCardNumber] = useState('');
  const [creditCardExpiry, setCreditCardExpiry] = useState('');
  const [creditCardCVV, setCreditCardCVV] = useState('');
  const [creditPaymentProcessing, setCreditPaymentProcessing] = useState(false);
  const [creditPaymentStatus, setCreditPaymentStatus] = useState('');
  const [creditPaymentError, setCreditPaymentError] = useState('');
  const creditPaymentResolveRef = useRef<((success: boolean) => void) | null>(null);

  const subscriptionData = useSubscription();
  const { profile } = useUser();
  const { 
    isPaid, isSubscribed, allMoviesFree, subscriptionBundle, 
    subscriptionExpiresAt, isGuest, recordTrialUsage,
    planLimits 
  } = subscriptionData;
  const normalizedSubscriptionBundle = String(subscriptionBundle || 'None');
  const hasNamedPlan = normalizedSubscriptionBundle.toLowerCase() !== 'none';
  const hasFutureExpiry = Boolean(subscriptionExpiresAt && subscriptionExpiresAt > Date.now());
  const hasDisplayedPremiumDays = Number((subscriptionData as any).remainingDays || 0) > 0;
  const hasManualPlanAccess = Number((subscriptionData as any).customExternalLimit || 0) > 0;
  const hasPremiumAccess = !isGuest && (
    isPaid ||
    isSubscribed ||
    hasNamedPlan ||
    hasFutureExpiry ||
    hasDisplayedPremiumDays ||
    hasManualPlanAccess
  );
  const canUseInternalDownloads = allMoviesFree || hasPremiumAccess;

  const showDownloadAlert = (type: DownloadModalType, title: string, message: string) => {
    setDownloadAlert({ visible: true, type, title, message });
  };

  const respondToRemoteDownloadRequest = async (request: any, accepted: boolean) => {
    const user = auth.currentUser;
    if (!user || !request?.id) return;

    const userRef = doc(db, 'users', user.uid);
    setRemoteDownloadPrompt(null);

    if (!accepted) {
      await updateDoc(userRef, {
        [`remoteDownloadRequests.${request.id}.status`]: 'denied',
        [`remoteDownloadRequests.${request.id}.respondedAt`]: new Date().toISOString(),
      }).catch(() => {});
      return;
    }

    await updateDoc(userRef, {
      [`remoteDownloadRequests.${request.id}.status`]: 'downloading',
      [`remoteDownloadRequests.${request.id}.respondedAt`]: new Date().toISOString(),
    }).catch(() => {});

    if (request.episode) {
      downloadEpisode(request.item as Series, request.episode, 'internal', request.id);
    } else if (request.item) {
      downloadMovie(request.item as Movie | Series, 'internal', request.id);
    }
  };

  const hasPremiumAccessFromServer = async () => {
    const user = auth.currentUser;
    if (!user || user.isAnonymous) return false;

    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (!snap.exists()) return false;
      const data = snap.data();
      const bundle = String(data.subscriptionBundle || 'None');
      const expiry = (() => {
        const value = data.subscriptionExpiresAt;
        if (!value) return null;
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
          const parsed = Date.parse(value);
          return Number.isFinite(parsed) ? parsed : null;
        }
        if (typeof value.toMillis === 'function') return value.toMillis();
        if (typeof value.seconds === 'number') return value.seconds * 1000;
        return null;
      })();
      const hasServerPlan = bundle.toLowerCase() !== 'none';
      const hasServerExpiry = expiry === null ? hasServerPlan : Boolean(expiry && expiry > Date.now());
      const hasManualAccess = Number(data.customExternalLimit || data.downloadLimit || 0) > 0;
      return (hasServerPlan && hasServerExpiry) || hasManualAccess;
    } catch (error) {
      console.warn('[DownloadContext] Premium fallback check failed:', error);
      return false;
    }
  };

  // Refs for download engine state
  const entriesRef = useRef<Record<string, DownloadEntry>>({});
  const resumablesRef = useRef<Record<string, FileSystem.DownloadResumable>>({});
  const cancelledIdsRef = useRef<Set<string>>(new Set()); 
  const completedIdsRef = useRef<Set<string>>(new Set()); 
  const reservedExternalIdsRef = useRef<Set<string>>(new Set());
  const externalTopUpInProgressRef = useRef(false);
  const cancelledSeriesIdsRef = useRef<Set<string>>(new Set());
  const handledRemoteDownloadRequestsRef = useRef<Set<string>>(new Set());
  const notifiedRemoteDownloadStatusesRef = useRef<Set<string>>(new Set());
  const remoteDownloadSessionStartedAtRef = useRef(Date.now());
  const isProcessing = useRef(false);
  const externalReservationQueueRef = useRef(Promise.resolve());
  const smartQueueProcessingRef = useRef(false);

  const rememberRemoteDownloadStatus = (statusKey: string) => {
    const statuses = notifiedRemoteDownloadStatusesRef.current;
    statuses.add(statusKey);
    const recentStatuses = Array.from(statuses).slice(-250);
    AsyncStorage.setItem(REMOTE_STATUS_ACK_STORAGE_KEY, JSON.stringify(recentStatuses)).catch(() => {});
  };

  const getRemoteDownloadStatusTime = (request: any) => {
    const rawTime = request?.status === 'completed'
      ? request?.completedAt
      : request?.respondedAt || request?.completedAt || request?.requestedAt;
    if (!rawTime) return 0;
    const parsed = Date.parse(rawTime);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const getRemoteRequestTime = (request: any, fields: string[]) => {
    for (const field of fields) {
      const value = request?.[field];
      if (!value) continue;
      const parsed = Date.parse(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
  };

  const isStaleRemoteRequest = (request: any) => {
    const now = Date.now();
    if (request?.status === 'pending') {
      const requestedAt = getRemoteRequestTime(request, ['requestedAt']);
      return Boolean(requestedAt && now - requestedAt > 30 * 60 * 1000);
    }
    if (request?.status === 'downloading') {
      const progress = Number(request.progress || 0);
      const lastActivity = getRemoteRequestTime(request, ['progressUpdatedAt', 'respondedAt', 'requestedAt']);
      return Boolean(lastActivity && progress <= 0 && now - lastActivity > 5 * 60 * 1000);
    }
    return false;
  };

  const updateRemoteDownloadProgress = (entry: DownloadEntry, progress: number) => {
    if (!entry.remoteRequestId || !auth.currentUser) return;
    updateDoc(doc(db, 'users', auth.currentUser.uid), {
      [`remoteDownloadRequests.${entry.remoteRequestId}.progress`]: Math.max(0, Math.min(100, progress)),
      [`remoteDownloadRequests.${entry.remoteRequestId}.progressUpdatedAt`]: new Date().toISOString(),
    }).catch(() => {});
  };

  const saveSmartOfflineEntry = async (entry: DownloadEntry) => {
    const saved = await AsyncStorage.getItem(SMART_OFFLINE_QUEUE_KEY).catch(() => null);
    const queue: DownloadEntry[] = saved ? JSON.parse(saved) : [];
    if (!queue.some((queued) => queued.id === entry.id)) queue.push(entry);
    await AsyncStorage.setItem(SMART_OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    setSmartQueueCount(queue.length);
  };

  const drainSmartOfflineQueue = async () => {
    if (smartQueueProcessingRef.current) return;
    smartQueueProcessingRef.current = true;
    try {
      const state = await Network.getNetworkStateAsync();
      if (state.type !== Network.NetworkStateType.WIFI) return;
      const saved = await AsyncStorage.getItem(SMART_OFFLINE_QUEUE_KEY);
      const queue: DownloadEntry[] = saved ? JSON.parse(saved) : [];
      if (!queue.length) return;
      await AsyncStorage.removeItem(SMART_OFFLINE_QUEUE_KEY);
      setSmartQueueCount(0);
      queue.forEach((entry) => enqueue({ ...entry, progress: 0, speedString: '', isPaused: false }));
      sendLocalNotification('Smart Offline Queue', `${queue.length} download${queue.length === 1 ? '' : 's'} started on Wi-Fi.`, { type: 'smart_queue' }).catch(() => {});
    } catch (_) {
    } finally {
      smartQueueProcessingRef.current = false;
    }
  };

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

  useEffect(() => {
    AsyncStorage.getItem(REMOTE_STATUS_ACK_STORAGE_KEY)
      .then((saved) => {
        if (!saved) return;
        const parsed = JSON.parse(saved);
        if (!Array.isArray(parsed)) return;
        parsed.forEach((statusKey) => {
          if (typeof statusKey === 'string') {
            notifiedRemoteDownloadStatusesRef.current.add(statusKey);
          }
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(SMART_OFFLINE_QUEUE_KEY)
      .then((saved) => {
        const queue = saved ? JSON.parse(saved) : [];
        setSmartQueueCount(Array.isArray(queue) ? queue.length : 0);
      })
      .catch(() => {});
    const timer = setInterval(drainSmartOfflineQueue, 60000);
    drainSmartOfflineQueue();
    return () => clearInterval(timer);
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
    const topUpCredits = Number((subscriptionData as any).externalDownloadTopUpCredits || 0);
    const normalizedBundle = subscriptionBundle ? subscriptionBundle.toLowerCase() : 'none';
    if (normalizedBundle === 'none') return 0;

    const matchedPlan = getMatchedPlan();
    if (!matchedPlan) return (planLimits[subscriptionBundle] || 1) + topUpCredits;

    return inferExternalDailyLimit(matchedPlan) + topUpCredits;
  };

  const getExternalTotalDownloadLimit = () => {
    if (isGuest) return (subscriptionData as any).hasUsedGuestTrial ? 0 : 1;
    const topUpCredits = Number((subscriptionData as any).externalDownloadTopUpCredits || 0);
    if ((subscriptionData as any).customExternalLimit > 0) return (subscriptionData as any).customExternalLimit + topUpCredits;
    const normalizedBundle = subscriptionBundle ? subscriptionBundle.toLowerCase() : 'none';
    if (normalizedBundle === 'none') return 0;

    const matchedPlan = getMatchedPlan();
    if (!matchedPlan) return ((planLimits[subscriptionBundle] || 1) * 30) + topUpCredits; // Rough guess if plan doc missing

    return inferExternalTotalLimit(matchedPlan) + topUpCredits;
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

  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const resetCreditPaymentState = () => {
    setCreditPaymentRequest(null);
    setCreditPaymentStep('methods');
    setCreditPaymentMethod(null);
    setCreditPaymentPhone('');
    setCreditCardNumber('');
    setCreditCardExpiry('');
    setCreditCardCVV('');
    setCreditPaymentProcessing(false);
    setCreditPaymentStatus('');
    setCreditPaymentError('');
  };

  const finishCreditPayment = (success: boolean) => {
    const resolve = creditPaymentResolveRef.current;
    creditPaymentResolveRef.current = null;
    resetCreditPaymentState();
    resolve?.(success);
  };

  const getCreditPaymentPrefixes = () => {
    if (creditPaymentMethod?.id === 'mtn') return ['077', '078', '076'];
    if (creditPaymentMethod?.id === 'airtel') return ['070', '074', '075'];
    return [];
  };

  const formatCreditCardNumber = (text: string) => text.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();

  const formatCreditCardExpiry = (text: string) => {
    const cleaned = text.replace(/\D/g, '').slice(0, 4);
    if (cleaned.length <= 2) return cleaned;
    return `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
  };

  const formatCreditPaymentError = (error: unknown) => {
    const code = typeof error === 'object' && error && 'code' in error ? String((error as any).code) : '';
    const rawMessage = error instanceof Error ? error.message : typeof error === 'string' ? error : 'Please try again.';
    const normalized = rawMessage.toLowerCase();

    if (code === 'RELWORX_API_DISABLED' || normalized.includes('api disabled') || normalized.includes('not live') || normalized.includes('activation')) {
      return 'Payments are not live yet on this account. Please finish Relworx API activation, then try again.';
    }
    if (code === 'RELWORX_NOT_CONFIGURED' || (normalized.includes('keys') && normalized.includes('missing'))) {
      return 'Payment setup is incomplete on the server. Please contact support.';
    }
    if (normalized.includes('network request failed') || normalized.includes('failed to fetch')) {
      return 'Could not reach the payment server. Check your internet and try again.';
    }
    return rawMessage;
  };

  const purchaseExternalDownloadCredits = async (quantity: number, entry?: DownloadEntry) => {
    const user = auth.currentUser;
    const safeQuantity = Math.max(1, Math.min(50, Math.floor(Number(quantity) || 1)));
    const amount = EXTERNAL_DOWNLOAD_TOKEN_PRICE_UGX * safeQuantity;

    if (!user || user.isAnonymous) {
      Alert.alert('Sign In Required', 'Please sign in to buy an extra download credit.');
      return false;
    }

    if (externalTopUpInProgressRef.current) {
      Alert.alert('Payment In Progress', 'Please finish the current payment first.');
      return false;
    }

    setCreditPaymentRequest({ quantity: safeQuantity, amount, entry });
    setCreditPaymentStep('methods');
    setCreditPaymentMethod(null);
    setCreditPaymentPhone((profile?.phoneNumber || user?.phoneNumber || '').replace(/\D/g, '').slice(0, 10));
    setCreditCardNumber('');
    setCreditCardExpiry('');
    setCreditCardCVV('');
    setCreditPaymentStatus('');
    setCreditPaymentError('');

    return new Promise<boolean>((resolve) => {
      creditPaymentResolveRef.current = resolve;
    });
  };

  const submitCreditPayment = async () => {
    const user = auth.currentUser;
    const request = creditPaymentRequest;
    const method = creditPaymentMethod;
    if (!user || !request || !method) return;

    const cleanPhone = creditPaymentPhone.replace(/\D/g, '');
    const allowedPrefixes = getCreditPaymentPrefixes();
    const isMobileMoney = method.id === 'mtn' || method.id === 'airtel';

    if (isMobileMoney && (cleanPhone.length !== 10 || !allowedPrefixes.some(prefix => cleanPhone.startsWith(prefix)))) {
      setCreditPaymentError(method.id === 'mtn' ? 'Enter a valid MTN number: 077, 078 or 076.' : 'Enter a valid Airtel number: 070, 074 or 075.');
      return;
    }

    if (method.id === 'card') {
      if (creditCardNumber.replace(/\D/g, '').length !== 16 || creditCardExpiry.length !== 5 || creditCardCVV.length < 3) {
        setCreditPaymentError('Enter valid card details before continuing.');
        return;
      }
    }

    externalTopUpInProgressRef.current = true;
    setCreditPaymentProcessing(true);
    setCreditPaymentError('');
    setCreditPaymentStatus(isMobileMoney ? 'Sending prompt to your phone...' : 'Opening secure card checkout...');

    try {
      const chargeResponse = await fetch(`${PAYMENT_API_BASE}/relworx-charge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber: isMobileMoney ? cleanPhone : '',
          amount: request.amount,
          currency: 'UGX',
          email: user.email || profile?.email || 'customer@themoviezone247.com',
          uid: user.uid,
          planName: 'Download Credit',
          paymentType: 'external_download_token',
          tokenQuantity: request.quantity,
          paymentMethod: method.id,
        }),
      });

      const chargeData = await chargeResponse.json();
      if (!chargeData.success) {
        throw new Error(chargeData.error || 'Failed to start token payment.');
      }

      if (chargeData.redirectUrl) {
        await Linking.openURL(chargeData.redirectUrl);
        setCreditPaymentStatus('Complete the secure checkout, then return to the app.');
      } else {
        setCreditPaymentStatus('Prompt sent. Approve it and enter your PIN.');
      }

      for (let attempt = 0; attempt < 30; attempt += 1) {
        await wait(3000);
        setCreditPaymentStatus(`Waiting for confirmation... ${30 - attempt}`);
        const verifyResponse = await fetch(`${PAYMENT_API_BASE}/verify?tx_ref=${chargeData.tx_ref}`);
        const verifyData = await verifyResponse.json();

        if (verifyData.success && verifyData.status === 'successful') {
          showDownloadAlert(
            'success',
            'Download Credits Added',
            `${request.quantity} download credit${request.quantity === 1 ? '' : 's'} added successfully.${request.entry ? ' Starting the download now.' : ''}`
          );
          if (request.entry) setTimeout(() => enqueue(request.entry!), 1500);
          finishCreditPayment(true);
          return true;
        }

        if (verifyData.status === 'failed') {
          throw new Error('Payment failed or was cancelled.');
        }
      }

      throw new Error('Payment is still pending. If you confirmed it, try the download again in a moment.');
    } catch (error: any) {
      console.warn('[DownloadContext] External download token purchase failed:', error?.message || error);
      setCreditPaymentError(formatCreditPaymentError(error) || 'Could not add the extra download credit. Please try again.');
      return false;
    } finally {
      externalTopUpInProgressRef.current = false;
      setCreditPaymentProcessing(false);
    }
  };

  const showExternalLimitPurchasePrompt = (entry: DownloadEntry, reason?: string) => {
    if (isGuest) {
      Alert.alert('Limit Reached', 'You have already used your free trial download. Please register or upgrade to continue.');
      return;
    }

    const message = reason === 'TOTAL_LIMIT_REACHED'
      ? `You have reached this plan's phone-storage download allowance. Buy 1 extra download credit for ${EXTERNAL_DOWNLOAD_TOKEN_PRICE_UGX} UGX?`
      : `You have reached today's phone-storage download limit. Buy 1 extra download credit for ${EXTERNAL_DOWNLOAD_TOKEN_PRICE_UGX} UGX?`;

    Alert.alert('Limit Reached', message, [
      { text: 'Not Now', style: 'cancel' },
      { text: `Buy for ${EXTERNAL_DOWNLOAD_TOKEN_PRICE_UGX} UGX`, onPress: () => purchaseExternalDownloadCredits(1, entry) },
    ]);
  };

  const reserveExternalDownloadSlotNow = async (entry: DownloadEntry) => {
    if (entry.mode !== 'external') return true;

    if (!isPaid && !isSubscribed && !isGuest) {
      Alert.alert('Premium Required', 'Saving to your gallery is a premium feature. Upgrade to enable phone-storage downloads.');
      return false;
    }

    const ref = getExternalCounterRef();
    const totalRef = getExternalTotalCounterRef();
    const dailyLimit = getExternalDailyDownloadLimit();
    const totalLimit = getExternalTotalDownloadLimit();
    const dateKey = getDownloadDateKey();
    const planKey = getExternalPlanKey();

    if (!ref || !totalRef || dailyLimit <= 0 || totalLimit <= 0) {
      Alert.alert('Limit Reached', 'Phone-storage downloads are not available on your current plan.');
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
            ? "You have reached this plan's phone-storage download allowance."
            : "You have reached today's phone-storage download limit. Upgrade or wait until tomorrow.")
        : 'Could not confirm your download allowance. Please try again in a moment.';
      console.warn('[DownloadContext] External download limit check failed:', error?.code || error?.message || error);
      if (isLimitReached) {
        showExternalLimitPurchasePrompt(entry, error?.message);
      } else {
        Alert.alert('Download Limit Check Failed', message);
      }
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
      showDownloadAlert('info', 'Download In Progress', 'This item is already downloading or in your queue.');
      return false;
    }

    const networkState = await Network.getNetworkStateAsync().catch(() => null);
    if (networkState && (!networkState.isConnected || networkState.type !== Network.NetworkStateType.WIFI)) {
      await saveSmartOfflineEntry(entry).catch(() => {});
      showDownloadAlert('info', 'Added to Smart Offline Queue', `"${entry.title}" will start automatically when this device is on Wi-Fi.`);
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
          showDownloadAlert('warning', 'Trial Limit', 'You have already used your free trial download. Please register or upgrade to continue.');
          return false;
        }
      } else if (!canUseInternalDownloads) {
        const serverAllowsDownload = await hasPremiumAccessFromServer();
        if (!serverAllowsDownload) {
          showDownloadAlert('warning', 'Subscription Required', 'Offline viewing inside the app is a premium feature. Please upgrade to start downloading.');
          return false;
        }
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

  const downloadEpisode = (series: Series, episode: any, mode: 'internal' | 'external', remoteRequestId?: string) => {
    if (!episode || !episode.id || isEpisodeDownloaded(episode.id)) return;
    const url = getStreamUrl(episode) || episode.videoUrl || '';
    
    console.log('[DownloadContext] downloadEpisode:', {
      series: series.title,
      episode: episode.title,
      url,
      seriesPreviewUrl: series.previewUrl
    });

    if (!url) {
      showDownloadAlert('info', 'Coming Soon', 'This episode is not available for download yet. Stay tuned.');
      return;
    }

    // Strict Validation: Prevent downloading if it's explicitly a preview link
    const isExplicitPreview = url.toLowerCase().includes('/preview/') || url.toLowerCase().includes('preview.mp4');
    if (series.previewUrl && url === series.previewUrl && isExplicitPreview) {
      showDownloadAlert('warning', 'Content Unavailable', 'This episode is currently only available as a preview and cannot be downloaded yet.');
      return;
    }

    enqueue({
      id: episode.id, title: episode.title || `${series.title} — Episode`,
      movieId: series.id, type: 'Series', poster: series.poster || '',
      progress: 0, speedString: '', isPaused: false,
      mode, url, item: series, isEpisode: true, remoteRequestId,
    });
  };

  const downloadMovie = (movie: Movie | Series, mode: 'internal' | 'external', remoteRequestId?: string) => {
    if (!movie.id) return;
    const url = getStreamUrl(movie) || (movie as any).videoUrl || '';
    
    console.log('[DownloadContext] downloadMovie:', {
      title: movie.title,
      url,
      previewUrl: (movie as any).previewUrl
    });

    if (!url) { showDownloadAlert('info', 'Coming Soon', 'This movie is not available for download yet. Stay tuned.'); return; }
    
    // Validation: Only block if it's explicitly a preview URL (contains "preview")
    // If the URLs just happen to be equal (e.g. both resolve to same HLS playlist), we allow it
    const isExplicitPreview = url.toLowerCase().includes('/preview/') || url.toLowerCase().includes('preview.mp4');
    if ((movie as any).previewUrl && url === (movie as any).previewUrl && isExplicitPreview) {
      showDownloadAlert('warning', 'Content Unavailable', 'This content is currently only available as a preview and cannot be downloaded yet.');
      return;
    }

    if (isMovieDownloaded(movie.id)) return;
    enqueue({
      id: movie.id, title: movie.title, movieId: movie.id, type: 'Movie',
      poster: movie.poster || '', progress: 0, speedString: '', isPaused: false,
      mode, url, item: movie, isEpisode: false, remoteRequestId,
    });
  };

  const getRemoteDownloadDeviceLabel = (id: string, index = 0) => {
    const meta = (subscriptionData as any).activeDevicesMeta?.[id] || {};
    const name = meta.name || `Device ${index + 1}`;
    return `${name} (...${id.slice(-6).toUpperCase()})`;
  };

  const sanitizeRemoteDownloadData = (value: any) => JSON.parse(JSON.stringify(value ?? null));

  const sendRemoteDownloadRequest = async (targetDeviceId: string, item: Movie | Series, episode?: any) => {
    const user = auth.currentUser;
    const currentDeviceId = (subscriptionData as any).deviceId;
    if (!user || isGuest || !currentDeviceId) {
      Alert.alert('Sign In Required', 'Remote downloads are only available for signed-in accounts.');
      return;
    }

    const requestId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const userRef = doc(db, 'users', user.uid);

    await updateDoc(userRef, {
      [`remoteDownloadRequests.${requestId}`]: {
        id: requestId,
        status: 'pending',
        progress: 0,
        targetDeviceId,
        requestedBy: currentDeviceId,
        requestedAt: new Date().toISOString(),
        mode: 'internal',
        item: sanitizeRemoteDownloadData(item),
        episode: sanitizeRemoteDownloadData(episode),
        title: episode?.title || item.title,
      },
    });

    setRemoteDevicePicker(null);
    showDownloadAlert('success', 'Remote Download Sent', `Request sent to ${getRemoteDownloadDeviceLabel(targetDeviceId)}.`);
  };

  const requestRemoteDownload = (item: Movie | Series, episode?: any) => {
    const currentDeviceId = (subscriptionData as any).deviceId;
    const activeDeviceIds: string[] = (subscriptionData as any).activeDeviceIds || [];
    const targets = activeDeviceIds.filter(id => id && id !== currentDeviceId);

    if (isGuest || !auth.currentUser) {
      showDownloadAlert('warning', 'Sign In Required', 'Remote downloads are only available for signed-in accounts.');
      return;
    }
    if (targets.length === 0) {
      showDownloadAlert('info', 'No Other Device', 'Sign in on another device with this same account to use remote download.');
      return;
    }

    setRemoteDevicePicker({ item, episode, targets });
  };

  useEffect(() => {
    const user = auth.currentUser;
    const currentDeviceId = (subscriptionData as any).deviceId;
    if (!user || isGuest || !currentDeviceId) return;

    const userRef = doc(db, 'users', user.uid);
    const unsub = onSnapshot(userRef, (snap) => {
      const requests = snap.exists() ? (snap.data().remoteDownloadRequests || {}) : {};
      const remoteActive: Record<string, DownloadEntry> = {};
      Object.values(requests).forEach((request: any) => {
        if (!request?.id) return;

        const isMyRemoteRequest = (
          request.requestedBy === currentDeviceId ||
          request.targetDeviceId === currentDeviceId
        );
        const isStale = isStaleRemoteRequest(request);
        if (isMyRemoteRequest && isStale) {
          updateDoc(userRef, {
            [`remoteDownloadRequests.${request.id}.status`]: 'canceled',
            [`remoteDownloadRequests.${request.id}.completedAt`]: new Date().toISOString(),
          }).catch(() => {});
        }
        if (isMyRemoteRequest && !isStale && ['pending', 'downloading'].includes(request.status)) {
          const item = request.item;
          const contentId = request.episode?.id || item?.id;
          if (contentId && item) {
            remoteActive[contentId] = {
              id: contentId,
              title: request.title || request.episode?.title || item.title || 'Remote download',
              movieId: item.id || contentId,
              poster: item.poster || '',
              progress: Math.max(0, Math.min(100, Number(request.progress || 0))),
              speedString: request.status === 'pending' ? 'Waiting for device' : 'Remote download',
              isPaused: request.status === 'pending',
              mode: 'internal',
              url: request.episode?.videoUrl || item.videoUrl || '',
              item,
              isEpisode: Boolean(request.episode),
              type: item.type,
              remoteRequestId: request.id,
            };
          }
        }

        if (request.requestedBy === currentDeviceId && request.targetDeviceId !== currentDeviceId) {
          const statusKey = `${request.id}:${request.status || 'unknown'}`;
          if (!notifiedRemoteDownloadStatusesRef.current.has(statusKey)) {
            const statusTime = getRemoteDownloadStatusTime(request);
            if (statusTime && statusTime < remoteDownloadSessionStartedAtRef.current - 2000) {
              rememberRemoteDownloadStatus(statusKey);
              return;
            }

            if (request.status === 'downloading') {
              rememberRemoteDownloadStatus(statusKey);
              showDownloadAlert(
                'success',
                'Remote Download Started',
                `${getRemoteDownloadDeviceLabel(request.targetDeviceId)} accepted and started downloading "${request.title || request.item?.title || 'this title'}".`
              );
            } else if (request.status === 'completed') {
              rememberRemoteDownloadStatus(statusKey);
              showDownloadAlert(
                'success',
                'Remote Download Finished',
                `${getRemoteDownloadDeviceLabel(request.targetDeviceId)} finished downloading "${request.title || request.item?.title || 'this title'}".`
              );
            } else if (request.status === 'denied') {
              rememberRemoteDownloadStatus(statusKey);
              showDownloadAlert(
                'warning',
                'Remote Download Refused',
                `${getRemoteDownloadDeviceLabel(request.targetDeviceId)} refused the download request for "${request.title || request.item?.title || 'this title'}".`
              );
            } else if (request.status === 'canceled' || request.status === 'failed') {
              rememberRemoteDownloadStatus(statusKey);
              showDownloadAlert(
                'warning',
                request.status === 'canceled' ? 'Remote Download Canceled' : 'Remote Download Failed',
                `${getRemoteDownloadDeviceLabel(request.targetDeviceId)} ${request.status === 'canceled' ? 'canceled' : 'could not finish'} "${request.title || request.item?.title || 'this title'}".`
              );
            }
          }
        }

        if (!request?.id || request.status !== 'pending' || request.targetDeviceId !== currentDeviceId) return;
        const handledKey = `${request.id}:${request.requestedAt || ''}`;
        if (handledRemoteDownloadRequestsRef.current.has(handledKey)) return;
        handledRemoteDownloadRequestsRef.current.add(handledKey);

        setRemoteDownloadPrompt(request);
      });
      setRemoteActiveDownloads(remoteActive);
    }, (error: any) => {
      if (error.code !== 'permission-denied') {
        console.warn('[RemoteDownload] Listener error:', error);
      }
    });

    return unsub;
  }, [auth.currentUser?.uid, isGuest, (subscriptionData as any).deviceId]);

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
    if (entry?.remoteRequestId && auth.currentUser) {
      updateDoc(doc(db, 'users', auth.currentUser.uid), {
        [`remoteDownloadRequests.${entry.remoteRequestId}.status`]: 'canceled',
        [`remoteDownloadRequests.${entry.remoteRequestId}.progress`]: 0,
        [`remoteDownloadRequests.${entry.remoteRequestId}.completedAt`]: new Date().toISOString(),
      }).catch(() => {});
    }
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
      if (entry?.remoteRequestId && auth.currentUser) {
        updateDoc(doc(db, 'users', auth.currentUser.uid), {
          [`remoteDownloadRequests.${entry.remoteRequestId}.status`]: 'canceled',
          [`remoteDownloadRequests.${entry.remoteRequestId}.progress`]: 0,
          [`remoteDownloadRequests.${entry.remoteRequestId}.completedAt`]: new Date().toISOString(),
        }).catch(() => {});
      }
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
              updateRemoteDownloadProgress(entry, pct);
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
              Alert.alert('Permission Required', 'Please allow media access in your phone settings to save to phone storage.');
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
          if (auth.currentUser && !isGuest) {
            updateDoc(doc(db, 'users', auth.currentUser.uid), {
              loyaltyPoints: increment(entry.remoteRequestId ? 15 : 10),
              lastLoyaltyReason: entry.remoteRequestId ? 'Remote download completed' : 'Download completed',
            }).catch(() => {});
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
          if (entry.remoteRequestId && auth.currentUser) {
            updateDoc(doc(db, 'users', auth.currentUser.uid), {
              [`remoteDownloadRequests.${entry.remoteRequestId}.status`]: 'completed',
              [`remoteDownloadRequests.${entry.remoteRequestId}.progress`]: 100,
              [`remoteDownloadRequests.${entry.remoteRequestId}.completedAt`]: new Date().toISOString(),
            }).catch(e => console.warn('[RemoteDownload] Failed to mark completed:', e));
          }
        } else if (!success && fatalError && !cancelledIdsRef.current.has(id)) {
          if (mode === 'external') await releaseExternalDownloadSlot(id);
          Alert.alert('Download Failed', `"${title}" - ${fatalError}`);
          if (entry.remoteRequestId && auth.currentUser) {
            updateDoc(doc(db, 'users', auth.currentUser.uid), {
              [`remoteDownloadRequests.${entry.remoteRequestId}.status`]: 'failed',
              [`remoteDownloadRequests.${entry.remoteRequestId}.error`]: fatalError,
              [`remoteDownloadRequests.${entry.remoteRequestId}.completedAt`]: new Date().toISOString(),
            }).catch(() => {});
          }
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
      activeDownloads, remoteActiveDownloads, downloadQueue, episodeDownloads, downloadedMovies,
      downloadEpisode, downloadMovie, pauseDownload, resumeDownload,
      cancelDownload, deleteDownload, isEpisodeDownloaded, isMovieDownloaded,
      getRemainingDownloads, getExternalDownloadLimit, downloadsUsedToday,
      removeDownload, verifyLocalFile, cancelSeriesDownloads, requestRemoteDownload, purchaseExternalDownloadCredits, smartQueueCount,
    }}>
      {children}
      <Modal
        visible={!!creditPaymentRequest}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {
          if (!creditPaymentProcessing) finishCreditPayment(false);
        }}
      >
        <View style={remoteStyles.paymentOverlay}>
          <BlurView intensity={36} tint="dark" style={StyleSheet.absoluteFillObject} />
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => {
              if (!creditPaymentProcessing) finishCreditPayment(false);
            }}
          />
          <View style={remoteStyles.paymentCard}>
            <LinearGradient
              colors={['rgba(91,95,239,0.14)', 'rgba(20,20,30,0.98)'] as any}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={remoteStyles.paymentHandle} />

            {creditPaymentStep === 'methods' ? (
              <>
                <View style={remoteStyles.paymentHeaderRow}>
                  <View>
                    <Text style={remoteStyles.paymentTitle}>Payment Method</Text>
                    <Text style={remoteStyles.paymentSubtitle}>
                      Pay {creditPaymentRequest?.amount.toLocaleString()} UGX for {creditPaymentRequest?.quantity} download credit{creditPaymentRequest?.quantity === 1 ? '' : 's'}
                    </Text>
                  </View>
                  <TouchableOpacity style={remoteStyles.paymentCloseButton} onPress={() => finishCreditPayment(false)}>
                    <Ionicons name="close" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>

                <View style={remoteStyles.methodList}>
                  {CREDIT_PAYMENT_METHODS.map((method) => (
                    <TouchableOpacity
                      key={method.id}
                      style={remoteStyles.methodButton}
                      activeOpacity={0.82}
                      onPress={() => {
                        setCreditPaymentMethod(method);
                        setCreditPaymentStep('details');
                        setCreditPaymentError('');
                      }}
                    >
                      <View style={[remoteStyles.methodIcon, { backgroundColor: `${method.color}20` }]}>
                        <Ionicons name={method.icon as any} size={22} color={method.color} />
                      </View>
                      <Text style={remoteStyles.methodLabel}>{method.label}</Text>
                      <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.42)" />
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity style={remoteStyles.paymentCancelButton} onPress={() => finishCreditPayment(false)}>
                  <Text style={remoteStyles.paymentCancelText}>Cancel</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={remoteStyles.backToMethods}
                  onPress={() => {
                    if (!creditPaymentProcessing) setCreditPaymentStep('methods');
                  }}
                  disabled={creditPaymentProcessing}
                >
                  <Ionicons name="arrow-back" size={22} color="#94a3b8" />
                  <Text style={remoteStyles.backToMethodsText}>Back to Methods</Text>
                </TouchableOpacity>

                <View style={remoteStyles.detailMethodRow}>
                  <View style={[remoteStyles.detailMethodIcon, { backgroundColor: `${creditPaymentMethod?.color || '#6366f1'}20` }]}>
                    <Ionicons name={(creditPaymentMethod?.icon || 'card-outline') as any} size={28} color={creditPaymentMethod?.color || '#6366f1'} />
                  </View>
                  <View style={remoteStyles.detailMethodText}>
                    <Text style={remoteStyles.detailMethodTitle}>{creditPaymentMethod?.label}</Text>
                    <Text style={remoteStyles.detailMethodSubtitle}>
                      Paying for: {creditPaymentRequest?.quantity} credits - {creditPaymentRequest?.amount.toLocaleString()} UGX
                    </Text>
                  </View>
                </View>

                {(creditPaymentMethod?.id === 'mtn' || creditPaymentMethod?.id === 'airtel') ? (
                  <View style={remoteStyles.paymentForm}>
                    <Text style={remoteStyles.inputLabel}>
                      {creditPaymentMethod.id === 'mtn' ? 'MTN Mobile Money Number' : 'Airtel Money Number'}
                    </Text>
                    <View style={remoteStyles.prefixRow}>
                      {getCreditPaymentPrefixes().map((prefix) => (
                        <TouchableOpacity
                          key={prefix}
                          style={[
                            remoteStyles.prefixChip,
                            creditPaymentPhone.startsWith(prefix) && {
                              borderColor: creditPaymentMethod.color,
                              backgroundColor: `${creditPaymentMethod.color}25`,
                            },
                          ]}
                          onPress={() => setCreditPaymentPhone(prefix)}
                          disabled={creditPaymentProcessing}
                        >
                          <Text style={[
                            remoteStyles.prefixText,
                            creditPaymentPhone.startsWith(prefix) && { color: creditPaymentMethod.color },
                          ]}>{prefix}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <View style={[
                      remoteStyles.inputWrap,
                      creditPaymentPhone.length === 10 && getCreditPaymentPrefixes().some(prefix => creditPaymentPhone.startsWith(prefix)) && {
                        borderColor: creditPaymentMethod.color,
                      },
                    ]}>
                      <Ionicons name="phone-portrait-outline" size={22} color={creditPaymentMethod.color} />
                      <TextInput
                        style={remoteStyles.paymentInput}
                        value={creditPaymentPhone}
                        onChangeText={(text) => setCreditPaymentPhone(text.replace(/\D/g, '').slice(0, 10))}
                        placeholder={creditPaymentMethod.id === 'mtn' ? '077XXXXXXX' : '070XXXXXXX'}
                        placeholderTextColor="rgba(255,255,255,0.22)"
                        keyboardType="phone-pad"
                        maxLength={10}
                        editable={!creditPaymentProcessing}
                      />
                    </View>
                    <Text style={remoteStyles.methodHint}>
                      You will receive a prompt on your {creditPaymentMethod.id === 'mtn' ? 'MTN' : 'Airtel'} number to approve the payment.
                    </Text>
                  </View>
                ) : (
                  <View style={remoteStyles.paymentForm}>
                    <Text style={remoteStyles.inputLabel}>Card Number</Text>
                    <View style={remoteStyles.inputWrap}>
                      <Ionicons name="card-outline" size={22} color="#6366f1" />
                      <TextInput
                        style={remoteStyles.paymentInput}
                        value={creditCardNumber}
                        onChangeText={(text) => setCreditCardNumber(formatCreditCardNumber(text))}
                        placeholder="1234 5678 9012 3456"
                        placeholderTextColor="rgba(255,255,255,0.22)"
                        keyboardType="number-pad"
                        maxLength={19}
                        editable={!creditPaymentProcessing}
                      />
                    </View>
                    <View style={remoteStyles.cardFieldRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={remoteStyles.inputLabel}>Expiry</Text>
                        <View style={remoteStyles.inputWrap}>
                          <TextInput
                            style={remoteStyles.paymentInput}
                            value={creditCardExpiry}
                            onChangeText={(text) => setCreditCardExpiry(formatCreditCardExpiry(text))}
                            placeholder="MM/YY"
                            placeholderTextColor="rgba(255,255,255,0.22)"
                            keyboardType="number-pad"
                            maxLength={5}
                            editable={!creditPaymentProcessing}
                          />
                        </View>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={remoteStyles.inputLabel}>CVV</Text>
                        <View style={remoteStyles.inputWrap}>
                          <TextInput
                            style={remoteStyles.paymentInput}
                            value={creditCardCVV}
                            onChangeText={(text) => setCreditCardCVV(text.replace(/\D/g, '').slice(0, 4))}
                            placeholder="123"
                            placeholderTextColor="rgba(255,255,255,0.22)"
                            keyboardType="number-pad"
                            secureTextEntry
                            editable={!creditPaymentProcessing}
                          />
                        </View>
                      </View>
                    </View>
                    <Text style={remoteStyles.methodHint}>
                      Your bank may ask for an OTP or 3D Secure confirmation.
                    </Text>
                  </View>
                )}

                {!!creditPaymentError && (
                  <View style={remoteStyles.paymentErrorBox}>
                    <Ionicons name="alert-circle" size={15} color="#ef4444" />
                    <Text style={remoteStyles.paymentErrorText}>{creditPaymentError}</Text>
                  </View>
                )}
                {!!creditPaymentStatus && (
                  <Text style={remoteStyles.paymentStatusText}>{creditPaymentStatus}</Text>
                )}

                <TouchableOpacity
                  style={[remoteStyles.payButton, creditPaymentProcessing && { opacity: 0.7 }]}
                  activeOpacity={0.86}
                  onPress={submitCreditPayment}
                  disabled={creditPaymentProcessing}
                >
                  {creditPaymentProcessing ? (
                    <ActivityIndicator color="#111" />
                  ) : (
                    <Ionicons name="shield-checkmark" size={22} color="#111" />
                  )}
                  <Text style={remoteStyles.payButtonText}>
                    {creditPaymentProcessing ? 'Processing...' : `PAY ${creditPaymentRequest?.amount.toLocaleString()} UGX`}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
      <Modal
        visible={!!remoteDevicePicker}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setRemoteDevicePicker(null)}
      >
        <View style={remoteStyles.overlay}>
          <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFillObject} />
          <View style={remoteStyles.card}>
            <LinearGradient colors={['rgba(77,159,255,0.2)', 'rgba(18,18,28,0.98)'] as any} style={StyleSheet.absoluteFillObject} />
            <View style={remoteStyles.iconWrap}>
              <Ionicons name="phone-landscape-outline" size={32} color="#fff" />
            </View>
            <Text style={remoteStyles.title}>Remote Download</Text>
            <Text style={remoteStyles.message}>
              Choose where to download "{remoteDevicePicker?.episode?.title || remoteDevicePicker?.item?.title || 'this title'}".
            </Text>
            <ScrollView style={remoteStyles.deviceList} contentContainerStyle={remoteStyles.deviceListInner}>
              {remoteDevicePicker?.targets.map((id, index) => (
                <TouchableOpacity
                  key={id}
                  style={remoteStyles.deviceButton}
                  activeOpacity={0.8}
                  onPress={() => sendRemoteDownloadRequest(id, remoteDevicePicker.item, remoteDevicePicker.episode).catch((error) => {
                    console.warn('[RemoteDownload] Failed to send request:', error);
                    showDownloadAlert('error', 'Request Failed', 'Could not send the remote download request. Please try again.');
                  })}
                >
                  <View style={remoteStyles.deviceIcon}>
                    <Ionicons name="tablet-landscape-outline" size={18} color="#4D9FFF" />
                  </View>
                  <Text style={remoteStyles.deviceText}>{getRemoteDownloadDeviceLabel(id, index)}</Text>
                  <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.45)" />
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={remoteStyles.cancelButton} onPress={() => setRemoteDevicePicker(null)} activeOpacity={0.8}>
              <Text style={remoteStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <DownloadSuccessModal
        visible={downloadAlert.visible}
        type={downloadAlert.type}
        title={downloadAlert.title}
        message={downloadAlert.message}
        onClose={() => setDownloadAlert(prev => ({ ...prev, visible: false }))}
      />
      <DownloadSuccessModal
        visible={!!remoteDownloadPrompt}
        type="info"
        title="Remote Download Request"
        message={`Download "${remoteDownloadPrompt?.title || remoteDownloadPrompt?.item?.title || 'this title'}" on this device?`}
        primaryLabel="Download"
        secondaryLabel="No"
        onClose={() => respondToRemoteDownloadRequest(remoteDownloadPrompt, true)}
        onSecondary={() => respondToRemoteDownloadRequest(remoteDownloadPrompt, false)}
      />
    </DownloadContext.Provider>
  );
};

export const useDownloads = () => {
  const context = useContext(DownloadContext);
  if (context === undefined) throw new Error('useDownloads must be used within a DownloadProvider');
  return context;
};

const remoteStyles = StyleSheet.create({
  paymentOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.78)',
    padding: 24,
  },
  paymentCard: {
    width: '100%',
    maxWidth: 390,
    borderRadius: 30,
    overflow: 'hidden',
    padding: 20,
    backgroundColor: 'rgba(20,20,30,0.98)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  paymentHandle: {
    width: 46,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignSelf: 'center',
    marginBottom: 20,
  },
  paymentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
    marginBottom: 18,
  },
  paymentTitle: {
    color: '#fff',
    fontSize: 25,
    fontWeight: '900',
  },
  paymentSubtitle: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
    lineHeight: 18,
  },
  paymentCloseButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  methodList: {
    gap: 10,
  },
  methodButton: {
    minHeight: 70,
    borderRadius: 18,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  methodIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodLabel: {
    flex: 1,
    color: '#fff',
    fontSize: 17,
    fontWeight: '900',
  },
  paymentCancelButton: {
    height: 58,
    borderRadius: 18,
    marginTop: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  paymentCancelText: {
    color: '#94a3b8',
    fontSize: 17,
    fontWeight: '900',
  },
  backToMethods: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 22,
  },
  backToMethodsText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '900',
  },
  detailMethodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 24,
  },
  detailMethodIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailMethodText: {
    flex: 1,
    minWidth: 0,
  },
  detailMethodTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
  },
  detailMethodSubtitle: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 3,
  },
  paymentForm: {
    gap: 12,
  },
  inputLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  prefixRow: {
    flexDirection: 'row',
    gap: 8,
  },
  prefixChip: {
    minWidth: 54,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  prefixText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '900',
  },
  inputWrap: {
    minHeight: 62,
    borderRadius: 18,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  paymentInput: {
    flex: 1,
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.6,
    paddingVertical: 0,
  },
  methodHint: {
    color: '#64748b',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  cardFieldRow: {
    flexDirection: 'row',
    gap: 12,
  },
  paymentErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(239,68,68,0.22)',
  },
  paymentErrorText: {
    flex: 1,
    color: '#fecaca',
    fontSize: 12,
    fontWeight: '800',
  },
  paymentStatusText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 12,
    textAlign: 'center',
  },
  payButton: {
    marginTop: 20,
    height: 64,
    borderRadius: 24,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  payButtonText: {
    color: '#111',
    fontSize: 18,
    fontWeight: '900',
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.68)',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 28,
    overflow: 'hidden',
    padding: 24,
    alignItems: 'center',
    backgroundColor: 'rgba(18,18,28,0.98)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  iconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1d9bf0',
    marginBottom: 16,
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    color: 'rgba(255,255,255,0.66)',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 18,
  },
  deviceList: {
    width: '100%',
    maxHeight: 220,
  },
  deviceListInner: {
    gap: 10,
  },
  deviceButton: {
    width: '100%',
    minHeight: 56,
    borderRadius: 18,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  deviceIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(77,159,255,0.14)',
  },
  deviceText: {
    flex: 1,
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  cancelButton: {
    marginTop: 16,
    width: '100%',
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  cancelText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 15,
    fontWeight: '800',
  },
});
