import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db } from '../../constants/firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import * as Application from 'expo-application';
import { Platform } from 'react-native';
import { Movie, Series } from '../../constants/movieData';
import * as FileSystem from 'expo-file-system/legacy';
const { documentDirectory, cacheDirectory, getFreeDiskStorageAsync, createDownloadResumable } = FileSystem;
// Safe conditional import — avoids startup crash when native module isn't linked in dev builds
let Network: typeof import('expo-network') | null = null;
try { Network = require('expo-network'); } catch (_) {
  console.warn('[SubscriptionContext] expo-network native module unavailable — Wi-Fi guard disabled');
}
import * as MediaLibrary from 'expo-media-library';
import { downloadToGallery, downloadToAppIsolatedStorage } from '../../lib/externalDownload';
import { downloadNotificationManager } from '../../lib/notificationHelper';
import DownloadSuccessModal, { DownloadModalType } from '../../components/DownloadSuccessModal';
import { resolveCDNUrl } from '../../constants/bunnyConfig';


// Define the limits per plan type
const planLimits: Record<string, number> = {
  '1 week': 1,
  '2 weeks': 2,
  '1 Month': 3,
  '2 months': 5,
  'Premium': 10,
  'VIP': 999,
  'None': 0
};

const planDeviceLimits: Record<string, number> = {
  '1 week': 1,
  '2 weeks': 1,
  '1 Month': 2,
  '2 months': 3,
  'Premium': 5,
  'VIP': 999,
  'None': 0
};

interface SubscriptionContextType {
  subscriptionBundle: string;
  subscriptionExpiresAt: number | null;
  setSubscriptionBundle: (bundle: string) => void;
  downloadsUsedToday: number;
  customExternalLimit: number;
  recordExternalDownload: (movieTitle: string) => { success: boolean, message: string }; 
  isGuest: boolean;
  isPaid: boolean;
  paymentMethod: string;
  allMoviesFree: boolean;
  eventMessage: string;
  getExternalDownloadLimit: () => number;
  getRemainingDownloads: () => number;
  downloadedMovies: (Movie | Series)[];
  favorites: (Movie | Series)[];
  removeDownload: (id: string) => void;
  recordInAppDownload: (item: Movie | Series) => { success: boolean, message: string };
  toggleFavorite: (item: Movie | Series) => void;
  episodeDownloads: Record<string, string>; // mapping episodeId (or seriesId-episodeId) to localUri
  
  // Global Background Downloads
  activeDownloads: Record<string, { 
    progress: number, 
    item: Movie | Series, 
    mode: 'internal' | 'external', 
    episodeId?: string, 
    episodeTitle?: string,
    isPaused?: boolean,
    speedString?: string 
  }>; // ID -> progress (0-100)
  downloadQueue: string[]; // List of IDs in order
  startExternalGalleryDownload: (item: Movie | Series) => Promise<void>;
  startInternalAppDownload: (item: Movie | Series) => Promise<void>;
  startInternalEpisodeDownload: (series: Series, episodeId: string, episodeUrl: string, episodeTitle: string) => Promise<void>;
  startExternalEpisodeDownload: (series: Series, episodeId: string, episodeUrl: string, episodeTitle: string) => Promise<void>;
  toggleDownloadPause: (id: string) => Promise<void>;
  recordTrialUsage: () => Promise<void>;
  isDeviceBlocked: boolean;
  activeDeviceIds: string[];
  removeDevice: (id: string) => Promise<void>;
  deviceLimit: number;
  minAppVersion: string;
  downloadOnWifiOnly: boolean;
  setDownloadOnWifiOnly: (val: boolean) => void;
  smartDownloads: boolean;
  setSmartDownloads: (val: boolean) => void;
  playingNow: Movie | Series | null;
  setPlayingNow: (m: Movie | Series | null) => void;
  playerMode: 'closed' | 'full' | 'mini';
  setPlayerMode: (mode: 'closed' | 'full' | 'mini') => void;
  playerTitle: string;
  setPlayerTitle: (title: string) => void;
  selectedVideoUrl: string;
  setSelectedVideoUrl: (url: string) => void;
}





const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [subscriptionBundle, setSubscriptionBundle] = useState('None');
  const [subscriptionExpiresAt, setSubscriptionExpiresAt] = useState<number | null>(null);
  const [downloadsUsedToday, setDownloadsUsedToday] = useState(0);
  const [lastDownloadDate, setLastDownloadDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [allMoviesFree, setAllMoviesFree] = useState(false);
  const [eventMessage, setEventMessage] = useState('');
  const [minAppVersion, setMinAppVersion] = useState('');
  const [customExternalLimit, setCustomExternalLimit] = useState(0);
  const [isGuest, setIsGuest] = useState(true);
  const [downloadOnWifiOnly, setDownloadOnWifiOnlyState] = useState(false);
  const [smartDownloads, setSmartDownloadsState] = useState(true);
  const [playingNow, setPlayingNow] = useState<Movie | Series | null>(null);
  const [playerMode, setPlayerMode] = useState<'closed' | 'full' | 'mini'>('closed');
  const [playerTitle, setPlayerTitle] = useState('');
  const [selectedVideoUrl, setSelectedVideoUrl] = useState('');
  const [hasUsedGuestTrial, setHasUsedGuestTrial] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [downloadedMovies, setDownloadedMovies] = useState<(Movie | Series)[]>([]);
  const [favorites, setFavorites] = useState<(Movie | Series)[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [activeDownloads, setActiveDownloads] = useState<Record<string, { 
    progress: number, 
    item: Movie | Series, 
    mode: 'internal' | 'external',
    episodeId?: string,
    episodeUrl?: string,
    episodeTitle?: string,
    isPaused?: boolean,
    speedString?: string
  }>>({});
  const [downloadQueue, setDownloadQueue] = useState<string[]>([]);
  const [episodeDownloads, setEpisodeDownloads] = useState<Record<string, string>>({});
  const isProcessingQueue = useRef(false);
  // Stores active DownloadResumable objects keyed by download ID for pause/resume
  const resumablesRef = useRef<Record<string, FileSystem.DownloadResumable>>({});
  // Tracks which downloads are currently paused — using a ref to avoid stale closure issues
  const pausedRef = useRef<Set<string>>(new Set());
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [activeDeviceIds, setActiveDeviceIds] = useState<string[]>([]);
  const [isDeviceBlocked, setIsDeviceBlocked] = useState(false);

  // Helper to get persistent hardware ID
  const getDeviceId = async () => {
    try {
      if (Platform.OS === 'android') {
        return (Application as any).androidId;
      } else if (Platform.OS === 'ios') {
        return await Application.getIosIdForVendorAsync();
      }
      return null;
    } catch (e) {
      console.error("Failed to get device ID:", e);
      return null;
    }
  };



  useEffect(() => {
    // Initialize system notification channel
    downloadNotificationManager.initChannel();

    let unsubUserDoc: (() => void) | undefined;

    // Check for Firebase Auth state
    const loadSettings = async () => {
      try {
        const wifi = await AsyncStorage.getItem('downloadOnWifiOnly');
        const smart = await AsyncStorage.getItem('smartDownloads');
        if (wifi !== null) setDownloadOnWifiOnlyState(wifi === 'true');
        if (smart !== null) setSmartDownloadsState(smart === 'true');
      } catch (e) {}
    };
    loadSettings();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsGuest(user.isAnonymous);
        
        // Setup real-time listener for the user's specific subscription bundle
        unsubUserDoc = onSnapshot(doc(db, 'users', user.uid), (snap) => {
          if (snap.exists()) {
            const userData = snap.data();
            const bundle = userData.subscriptionBundle || 'None';
            const expiresAt = userData.subscriptionExpiresAt; // Firestore Timestamp
            const method = userData.paymentMethod || '';
            
            setPaymentMethod(method);
            setHasUsedGuestTrial(userData.hasUsedGuestTrial || false);

            const fetchedActiveDevices = userData.activeDeviceIds || [];
            setActiveDeviceIds(fetchedActiveDevices);

            // Device limit check for paid users
            if (user && !user.isAnonymous && bundle !== 'None' && deviceId) {
              const limit = planDeviceLimits[bundle] || 1;
              const isAllowed = fetchedActiveDevices.includes(deviceId);

              if (isAllowed) {
                setIsDeviceBlocked(false);
              } else if (fetchedActiveDevices.length < limit) {
                // Auto-register this device if we have room
                const newDevices = [...fetchedActiveDevices, deviceId];
                setDoc(doc(db, 'users', user.uid), { activeDeviceIds: newDevices }, { merge: true });
                setIsDeviceBlocked(false);
              } else {
                // Device limit reached
                setIsDeviceBlocked(true);
              }
            } else {
              setIsDeviceBlocked(false);
            }
            
            if (expiresAt && expiresAt.seconds) {
              const expirationMs = expiresAt.seconds * 1000;
              if (Date.now() > expirationMs) {
                // Subscription has expired
                setSubscriptionBundle('None');
                setSubscriptionExpiresAt(null);
              } else {
                setSubscriptionBundle(bundle);
                setSubscriptionExpiresAt(expirationMs);
              }
            } else {
              // No expiration set, just use the bundle
              setSubscriptionBundle(bundle);
              setSubscriptionExpiresAt(null);
            }
          } else {
            // User has no custom plan
            setSubscriptionBundle('None');
            setSubscriptionExpiresAt(null);
            setHasUsedGuestTrial(false);
          }
        });
      } else {
        // No Firebase user
        setIsGuest(true);
        if (unsubUserDoc) unsubUserDoc();
        setSubscriptionBundle('None');
        setSubscriptionExpiresAt(null);
        setPaymentMethod('');
      }
    });

    return () => {
      unsubscribe();
      if (unsubUserDoc) unsubUserDoc();
    };
  }, []);

  // NEW: Persistent Device Check for Guests
  useEffect(() => {
    const checkDeviceTrial = async () => {
      const id = await getDeviceId();
      if (id) {
        setDeviceId(id);
        // If we are a guest, check if this physical device already used its 1 free movie
        try {
          const deviceTrialRef = doc(db, 'device_trials', id);
          const snap = await getDoc(deviceTrialRef);
          if (snap.exists() && snap.data().hasUsedGuestTrial) {
            setHasUsedGuestTrial(true);
          }
        } catch (err) {
          console.error("Failed to check persistent device trial:", err);
        }
      }
    };
    checkDeviceTrial();
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        const savedDownloads = await AsyncStorage.getItem('downloaded_movies');
        if (savedDownloads) {
          setDownloadedMovies(JSON.parse(savedDownloads));
        }
        const savedFavorites = await AsyncStorage.getItem('my_list_movies');
        if (savedFavorites) {
          setFavorites(JSON.parse(savedFavorites));
        }
        const savedEpisodeDownloads = await AsyncStorage.getItem('episode_downloads');
        if (savedEpisodeDownloads) {
          setEpisodeDownloads(JSON.parse(savedEpisodeDownloads));
        }

        // Re-hydrate active downloads metadata to survive app restarts
        const savedMetadata = await AsyncStorage.getItem('active_downloads_metadata');
        if (savedMetadata) {
          const metadata = JSON.parse(savedMetadata);
          setActiveDownloads(prev => ({ ...prev, ...metadata }));
          // Ensure these IDs are also in the queue if not already there
          setDownloadQueue(prev => {
            const keys = Object.keys(metadata);
            const next = [...prev];
            keys.forEach(k => { if (!next.includes(k)) next.push(k); });
            return next;
          });
        }

        // Restore daily download counter — reset automatically if it's a new day
        const today = new Date().toISOString().split('T')[0];
        const storedDate = await AsyncStorage.getItem('download_date');
        const storedCount = await AsyncStorage.getItem('downloads_used_today');
        if (storedDate === today && storedCount) {
          setDownloadsUsedToday(parseInt(storedCount, 10));
          setLastDownloadDate(today);
        } else {
          // New day — reset counter
          setDownloadsUsedToday(0);
          setLastDownloadDate(today);
          await AsyncStorage.setItem('download_date', today);
          await AsyncStorage.setItem('downloads_used_today', '0');
        }
      } catch (e) {
        console.error('Failed to load local data', e);
      } finally {
        setIsInitialized(true);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (isInitialized) {
      AsyncStorage.setItem('downloaded_movies', JSON.stringify(downloadedMovies));
      AsyncStorage.setItem('my_list_movies', JSON.stringify(favorites));
      AsyncStorage.setItem('episode_downloads', JSON.stringify(episodeDownloads));
    }
  }, [downloadedMovies, favorites, episodeDownloads, isInitialized]);

  // Persist daily download counter whenever it changes
  useEffect(() => {
    if (isInitialized) {
      AsyncStorage.setItem('downloads_used_today', String(downloadsUsedToday));
      AsyncStorage.setItem('download_date', lastDownloadDate);
    }
  }, [downloadsUsedToday, lastDownloadDate, isInitialized]);



  const timerRef = useRef<any>(null);
  const userTimerRef = useRef<any>(null);

  useEffect(() => {
    // Listen to global settings
    const unsub = onSnapshot(doc(db, 'settings', 'global'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const expiresAtStr = data.expiresAt;

        // Clear existing timer if any
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        
        const checkExpiration = () => {
          if (expiresAtStr) {
            const now = Date.now();
            const expirationTime = new Date(expiresAtStr).getTime();
            if (now > expirationTime) {
              setAllMoviesFree(false);
              setEventMessage('');
              // Final clearing of timer inside check to stop interval
              if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
              }
              return true;
            }
          }
          setAllMoviesFree(data.allMoviesFree || false);
          setEventMessage(data.eventMessage || '');
          if (data.minAppVersion) setMinAppVersion(data.minAppVersion);
          return false;
        };

        const isCurrentlyExpired = checkExpiration();

        // If not expired yet, and is active, set up an interval to check again
        if (!isCurrentlyExpired && data.allMoviesFree && expiresAtStr) {
          timerRef.current = setInterval(() => {
            checkExpiration();
          }, 30000); // Check every 30 seconds
        }
      }
    });
    return () => {
      unsub();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // User-specific expiration timer
  useEffect(() => {
    if (userTimerRef.current) {
      clearInterval(userTimerRef.current);
      userTimerRef.current = null;
    }

    if (subscriptionExpiresAt) {
      const checkUserExpiration = () => {
        if (Date.now() > subscriptionExpiresAt) {
          setSubscriptionBundle('None');
          setSubscriptionExpiresAt(null);
          if (userTimerRef.current) {
            clearInterval(userTimerRef.current);
            userTimerRef.current = null;
          }
        }
      };

      // Check immediately
      checkUserExpiration();
      
      // Then periodically
      userTimerRef.current = setInterval(checkUserExpiration, 30000);
    }

    return () => {
      if (userTimerRef.current) clearInterval(userTimerRef.current);
    };
  }, [subscriptionExpiresAt]);

  const getExternalDownloadLimit = () => {
    if (customExternalLimit > 0) return customExternalLimit;
    if (isGuest) return hasUsedGuestTrial ? 0 : 1; // 1 Free Trial lifetime for Guests
    return planLimits[subscriptionBundle] || 0;
  };

  const getRemainingDownloads = () => {
    return Math.max(0, getExternalDownloadLimit() - (isGuest ? 0 : downloadsUsedToday));
  };

  const recordTrialUsage = async () => {
    if (isGuest && auth.currentUser && !hasUsedGuestTrial) {
      try {
        // 1. Lock the Firebase User Account
        await setDoc(doc(db, "users", auth.currentUser.uid), {
          hasUsedGuestTrial: true
        }, { merge: true });

        // 2. Lock the Physical Device ID (Survives Uninstall)
        if (deviceId) {
          await setDoc(doc(db, "device_trials", deviceId), {
            hasUsedGuestTrial: true,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        }

        setHasUsedGuestTrial(true);
      } catch (err) {
        console.error("Failed to mark guest trial as used:", err);
      }
    }
  };

  const recordExternalDownload = (movieTitle: string) => {
    const today = new Date().toISOString().split('T')[0];
    
    // Day reset logic — handled by AsyncStorage on load, but guard here too
    let currentUsed = downloadsUsedToday;
    if (lastDownloadDate !== today) {
      currentUsed = 0;
      setDownloadsUsedToday(0);
      setLastDownloadDate(today);
    }

    const limit = getExternalDownloadLimit();
    
    // Non-premium users have a limit of 0 (Guests are handled in getExternalDownloadLimit)
    if (limit === 0 && !isGuest) {
      return { 
        success: false, 
        message: "External downloads (MP4) are a Premium feature. Upgrade your plan to unlock external downloads!" 
      };
    }

    const remaining = limit - (currentUsed + 1);
    if (currentUsed < limit) {
      const newUsed = currentUsed + 1;
      setDownloadsUsedToday(newUsed);
      
      const successMsg = isGuest
        ? `"${movieTitle}" is downloading! Register now to unlock high-speed downloads and more.`
        : `"${movieTitle}" is downloading to your phone storage (MP4).\n${remaining} download${remaining === 1 ? '' : 's'} remaining today. Check your notification tray for progress.`;

      return { 
        success: true, 
        message: successMsg
      };
    }

    const errorMsg = isGuest
      ? "You've used your 1 Free Movie! Register or Upgrade now to unlock more downloads."
      : `Daily limit reached. You've used all ${limit} external downloads for today. Upgrade for a higher limit, or use in-app saving (unlimited).`;

    return { 
      success: false, 
      message: errorMsg
    };
  };

  const recordInAppDownload = (item: Movie | Series) => {
    // Check if already downloaded
    if (downloadedMovies.some(m => m.id === item.id)) {
      return { 
        success: true, 
        message: `"${item.title}" is already in your downloads.` 
      };
    }

    setDownloadedMovies(prev => [item, ...prev]);
    return { 
      success: true, 
      message: `"${item.title}" saved to secure app storage for offline viewing. This file is hidden from your local gallery.` 
    };
  };

  const removeDownload = async (id: string) => {
    setDownloadedMovies(prev => prev.filter(m => m.id !== id));
    // Also remove associated episodes if any
    setEpisodeDownloads(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(key => {
        if (key.startsWith(id + '-')) {
          delete next[key];
        }
      });
      return next;
    });

    // Cleanup active downloads metadata if any
    const m = await AsyncStorage.getItem('active_downloads_metadata');
    if (m) {
      const nextMeta = JSON.parse(m);
      if (nextMeta[id]) {
        delete nextMeta[id];
        await AsyncStorage.setItem('active_downloads_metadata', JSON.stringify(nextMeta));
      }
    }
  };

  const toggleFavorite = (item: Movie | Series) => {
    setFavorites(prev => {
      const exists = prev.some(m => m.id === item.id);
      if (exists) {
        return prev.filter(m => m.id !== item.id);
      } else {
        return [item, ...prev];
      }
    });
  };

  const removeDevice = async (targetId: string) => {
    if (auth.currentUser && !isGuest) {
      try {
        const nextDevices = activeDeviceIds.filter(id => id !== targetId);
        await setDoc(doc(db, 'users', auth.currentUser.uid), { 
          activeDeviceIds: nextDevices 
        }, { merge: true });
      } catch (err) {
        console.error("Failed to remove device:", err);
      }
    }
  };

  // ---- Download modal state ----
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<DownloadModalType>('success');
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');

  const showModal = (type: DownloadModalType, title: string, message: string) => {
    setModalType(type);
    setModalTitle(title);
    setModalMessage(message);
    setModalVisible(true);
  };

  const startInternalAppDownload = async (item: Movie | Series) => {
    const title = item.title || "Unknown Movie";
    const meta = { progress: 0, item, mode: 'internal' as const };
    setActiveDownloads(prev => ({ ...prev, [item.id]: meta }));
    setDownloadQueue(prev => prev.includes(item.id) ? prev : [...prev, item.id]);

    // Persist
    const currentMeta = await AsyncStorage.getItem('active_downloads_metadata');
    const nextMeta = currentMeta ? JSON.parse(currentMeta) : {};
    nextMeta[item.id] = meta;
    await AsyncStorage.setItem('active_downloads_metadata', JSON.stringify(nextMeta));
  };

  const startExternalGalleryDownload = async (item: Movie | Series) => {
    const title = item.title || "Unknown Movie";
    const meta = { progress: 0, item, mode: 'external' as const };
    setActiveDownloads(prev => ({ ...prev, [item.id]: meta }));
    setDownloadQueue(prev => [...prev, item.id]);

    // Persist
    const currentMeta = await AsyncStorage.getItem('active_downloads_metadata');
    const nextMeta = currentMeta ? JSON.parse(currentMeta) : {};
    nextMeta[item.id] = meta;
    await AsyncStorage.setItem('active_downloads_metadata', JSON.stringify(nextMeta));
  };

  const startInternalEpisodeDownload = async (series: Series, episodeId: string, episodeUrl: string, episodeTitle: string) => {
    const queueId = episodeId;
    const title = episodeTitle || series.title || "Unknown Episode";
    const meta = { progress: 0, item: series, mode: 'internal' as const, episodeId, episodeUrl, episodeTitle: title };
    setActiveDownloads(prev => ({ ...prev, [queueId]: meta }));
    setDownloadQueue(prev => prev.includes(queueId) ? prev : [...prev, queueId]);
    
    // Persist metadata
    const currentMeta = await AsyncStorage.getItem('active_downloads_metadata');
    const nextMeta = currentMeta ? JSON.parse(currentMeta) : {};
    nextMeta[queueId] = meta;
    await AsyncStorage.setItem('active_downloads_metadata', JSON.stringify(nextMeta));
  };

  const startExternalEpisodeDownload = async (series: Series, episodeId: string, episodeUrl: string, episodeTitle: string) => {
    const queueId = episodeId;
    const title = episodeTitle || series.title || "Unknown Episode";
    const meta = { progress: 0, item: series, mode: 'external' as const, episodeId, episodeUrl, episodeTitle: title };
    setActiveDownloads(prev => ({ 
      ...prev, 
      [queueId]: meta 
    }));
    setDownloadQueue(prev => prev.includes(queueId) ? prev : [...prev, queueId]);

    // Persist
    const currentMeta = await AsyncStorage.getItem('active_downloads_metadata');
    const nextMeta = currentMeta ? JSON.parse(currentMeta) : {};
    nextMeta[queueId] = meta;
    await AsyncStorage.setItem('active_downloads_metadata', JSON.stringify(nextMeta));
  };

  // ── Pause / Resume ────────────────────────────────────────────────────────
  const toggleDownloadPause = async (id: string) => {
    const resumable = resumablesRef.current[id];
    if (!resumable) {
      console.warn('[DownloadPause] No resumable found for id:', id);
      return;
    }

    const isCurrentlyPaused = pausedRef.current.has(id);
    const downloadData = activeDownloads[id];

    if (isCurrentlyPaused) {
      // RESUME: clear the paused flag first
      pausedRef.current.delete(id);
      setActiveDownloads(prev => ({ ...prev, [id]: { ...prev[id], isPaused: false } }));
      
      // Immediate notification update to show "Downloading..." and "Pause" button
      if (downloadData) {
        const displayTitle = downloadData.episodeTitle || downloadData.item.title;
        const posterUrl = downloadData.item.poster || (downloadData.item as any).heroBanner || '';
        console.log('[DownloadResume] Resuming download for:', displayTitle);
        downloadNotificationManager.updateProgress(
          id, 
          displayTitle, 
          downloadData.progress, 
          downloadData.speedString || 'Resuming...', 
          posterUrl, 
          false,
          downloadData.item.id
        );
      }
    } else {
      // PAUSE: tell the download to pause, then set the flag
      try {
        if (resumable) await resumable.pauseAsync();
      } catch (e) {
        // Some platforms throw on pauseAsync — that's expected
      }
      pausedRef.current.add(id);
      setActiveDownloads(prev => ({ ...prev, [id]: { ...prev[id], isPaused: true } }));

      // Immediate notification update to show "Paused" and "Resume" button
      if (downloadData) {
        const displayTitle = downloadData.episodeTitle || downloadData.item.title;
        const posterUrl = downloadData.item.poster || (downloadData.item as any).heroBanner || '';
        downloadNotificationManager.updateProgress(
          id, 
          displayTitle, 
          downloadData.progress, 
          downloadData.speedString || '', 
          posterUrl, 
          true,
          downloadData.item.id
        );
      }
    }
  };

  const cancelActiveDownload = async (id: string) => {
    const resumable = resumablesRef.current[id];
    if (resumable) {
      try {
        await resumable.cancelAsync();
      } catch (e) {}
      delete resumablesRef.current[id];
    }
    pausedRef.current.delete(id);
    setActiveDownloads(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setDownloadQueue(prev => prev.filter(qId => qId !== id));
    downloadNotificationManager.dismiss(id);

    // Cleanup persistent metadata
    try {
      const m = await AsyncStorage.getItem('active_downloads_metadata');
      if (m) {
        const nextMeta = JSON.parse(m);
        if (nextMeta[id]) {
          delete nextMeta[id];
          await AsyncStorage.setItem('active_downloads_metadata', JSON.stringify(nextMeta));
        }
      }
    } catch (e) {
      console.error("Failed to cleanup metadata on cancel:", e);
    }
  };

  // Notification Response Listener for Background Interactivity (Pause / Cancel)
  useEffect(() => {
    import('expo-notifications').then((Notifications) => {
      const subscription = Notifications.addNotificationResponseReceivedListener(response => {
        const actionId = response.actionIdentifier;
        const notificationId = response.notification.request.identifier;
        
        if (notificationId.startsWith('download_')) {
          const downloadId = notificationId.replace('download_', '');
          
          if (actionId === 'pause' || actionId === 'resume') {
            toggleDownloadPause(downloadId);
          } else if (actionId === 'cancel') {
            cancelActiveDownload(downloadId);
          }
        }
      });
      return () => {
        subscription.remove();
      };
    });
  }, []);

  // 3. Process the queue sequentially
  useEffect(() => {
    const processQueue = async () => {
      if (isProcessingQueue.current || downloadQueue.length === 0) return;
      
      isProcessingQueue.current = true;
      const nextId = downloadQueue[0];
      const downloadData = activeDownloads[nextId];
      
      if (!downloadData) {
        setDownloadQueue(prev => prev.slice(1));
        isProcessingQueue.current = false;
        return;
      }

      const { item, mode, episodeId, episodeUrl, episodeTitle } = downloadData;

      // Helper: wait until pausedRef no longer contains nextId
      const waitForResume = () => new Promise<void>(resolve => {
        const check = setInterval(() => {
          if (!pausedRef.current.has(nextId)) {
            clearInterval(check);
            resolve();
          }
        }, 300);
      });

      // Helper: mark this download as paused (if not already)
      const markPaused = () => {
        if (!pausedRef.current.has(nextId)) {
          pausedRef.current.add(nextId);
          setActiveDownloads(prev => ({ ...prev, [nextId]: { ...prev[nextId], isPaused: true } }));
        }
      };

      const displayTitle = episodeTitle || item.title;
      const posterUrl = item.poster || (item as any).heroBanner || '';

      try {
        const rawVideoUrl = episodeUrl || (item as any).videoUrl || (item as any).previewUrl || '';
        const videoUrl = resolveCDNUrl(rawVideoUrl, false);

        const safeTitle = displayTitle.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 60);
        let displayedPct = 0;
        
        let lastBytes = 0;
        let lastTimestamp = Date.now();
        let speedString = '';

        const progressCallback = ({ totalBytesWritten, totalBytesExpectedToWrite }: { totalBytesWritten: number; totalBytesExpectedToWrite: number }) => {
          // Safety: If this ID has been removed from resumables (canceled), stop updating state
          if (!resumablesRef.current[nextId]) return;

          if (totalBytesExpectedToWrite > 0) {
            const now = Date.now();
            if (now - lastTimestamp >= 1000 || speedString === '') {
               const bytesPerSec = ((totalBytesWritten - lastBytes) / Math.max(1, now - lastTimestamp)) * 1000;
               const mbPerSec = (bytesPerSec / (1024 * 1024)).toFixed(1);
               const gbWritten = (totalBytesWritten / (1024 * 1024 * 1024)).toFixed(2);
               const gbTotal = (totalBytesExpectedToWrite / (1024 * 1024 * 1024)).toFixed(2);
               speedString = `${gbWritten} GB / ${gbTotal} GB • ${mbPerSec} MB/s`;
               
               lastBytes = totalBytesWritten;
               lastTimestamp = now;
            }

            const realPct = Math.floor((totalBytesWritten / totalBytesExpectedToWrite) * 100);
            if (realPct > displayedPct && realPct < 100) {
              displayedPct = realPct;
              
              const isPaused = pausedRef.current.has(nextId);
              setActiveDownloads(prev => ({ 
                ...prev, 
                [nextId]: { 
                  ...prev[nextId], 
                  progress: displayedPct,
                  speedString 
                } 
              }));
              
              downloadNotificationManager.updateProgress(
                nextId, 
                displayTitle, 
                displayedPct, 
                speedString, 
                posterUrl, 
                isPaused,
                item.id
              );
            }
          }
        };

        // ── Safeguard: Network Scan (Wi-Fi Only Check) ──
        if (downloadOnWifiOnly && Network) {
          try {
            const netState = await Network.getNetworkStateAsync();
            if (netState.type !== Network.NetworkStateType.WIFI) {
              console.log('[DownloadLoop] Wi-Fi only enabled, waiting for Wi-Fi...');
              await new Promise(r => setTimeout(r, 30000));
              return;
            }
          } catch (netErr) {
            console.warn('[DownloadLoop] Network check failed, skipping Wi-Fi guard:', netErr);
          }
        }

        // ── Safeguard: Disk Space Check ──
        const freeSpace = await getFreeDiskStorageAsync();
        const MIN_FREE_SPACE = 500 * 1024 * 1024; // 500MB safety buffer
        if (freeSpace < MIN_FREE_SPACE) {
          showModal('error', 'Storage Full', 'You need at least 500MB of free space to download content.');
          // Pause queue and wait
          setDownloadQueue(prev => prev.filter(id => id !== nextId));
          return;
        }

        if (mode === 'internal') {
          const fileUri = `${documentDirectory}${safeTitle}_${Date.now()}.mp4`;
          const resumable = createDownloadResumable(
            videoUrl, fileUri,
            { headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G981B)', 'Referer': 'https://themoviezone247.com/' } },
            progressCallback
          );
          resumablesRef.current[nextId] = resumable;

          let localUri: string | null = null;
          let isResuming = false;
          let retryCount = 0;

          while (!localUri && retryCount < 5) {
            try {
              let result;
              try {
                result = isResuming
                  ? await resumable.resumeAsync()
                  : await resumable.downloadAsync();
              } catch (resumeErr: any) {
                if (isResuming && resumablesRef.current[nextId]) {
                  console.warn('[DownloadLoop] native resumeAsync failed, falling back to downloadAsync...', resumeErr);
                  result = await resumable.downloadAsync();
                } else {
                  throw resumeErr;
                }
              }

              if (result?.uri) {
                localUri = result.uri;
                setActiveDownloads(prev => ({ ...prev, [nextId]: { ...prev[nextId], progress: 100 } }));
                downloadNotificationManager.updateProgress(
                  nextId, 
                  displayTitle, 
                  100, 
                  'Complete', 
                  posterUrl, 
                  false,
                  item.id
                );
              } else {
                // If it resolves with undefined, it means it's gracefully paused (resumable)
                console.log('[DownloadLoop] Download gracefully paused/suspended.');
                if (pausedRef.current.has(nextId)) {
                  markPaused();
                  await waitForResume();
                }
                isResuming = true;
                speedString = 'Resuming...';
              }
            } catch (err: any) {
              const errMsg = (err?.message || '').toLowerCase();
              const errCode = err?.code || '';
              if (errCode === 'ERR_TASK_CANCELLED' || errMsg.includes('cancel') || errMsg.includes('pause') || errMsg.includes('abort')) {
                // If the resumable is gone, it was a cancellation, not a pause
                if (!resumablesRef.current[nextId]) {
                  console.log('[DownloadLoop] Download intentionally cancelled.');
                  break; 
                }
                console.log('[DownloadLoop] Download intentionally paused in try-catch.');
                if (pausedRef.current.has(nextId)) {
                  markPaused();
                  await waitForResume();
                }
                isResuming = true;
              } else {
                console.warn('[DownloadLoop] Transient error, retrying...', err);
                retryCount++;
                await new Promise(r => setTimeout(r, 2000));
                isResuming = true;
              }
            }
          }

          if (!localUri) throw new Error('Download failed after multiple retries.');

          // ── Success: save to downloaded list ──
          if (episodeId) {
            setEpisodeDownloads(prev => ({ ...prev, [episodeId]: localUri! }));
            setDownloadedMovies(prev => {
              if (prev.some(m => m.id === item.id)) return prev;
              return [item, ...prev];
            });

            // ── Smart Downloads: Queue Next Episode ──
            if (smartDownloads && "episodeList" in item && item.episodeList) {
              const currentIdx = item.episodeList.findIndex(ep => (ep as any).id === episodeId || ep.title === activeDownloads[nextId].episodeTitle);
              if (currentIdx !== -1 && currentIdx < item.episodeList.length - 1) {
                const nextEp = item.episodeList[currentIdx + 1];
                console.log('[SmartDownload] Queueing next episode:', nextEp.title);
                startInternalEpisodeDownload(item as Series, (nextEp as any).id || `${item.id}-${currentIdx + 1}`, nextEp.url, nextEp.title);
              }
            }
          } else {
            const downloadedItem = { ...item, localUri };
            setDownloadedMovies(prev => {
              if (prev.some(m => m.id === item.id)) return prev;
              return [downloadedItem, ...prev];
            });
          }
        } else {
          // ── External (Gallery) download ──
          const { status } = await MediaLibrary.requestPermissionsAsync();
          if (status !== 'granted') {
            showModal('error', 'Permission Denied', 'Please allow media access in your phone settings to save downloads.');
          } else {
            const fileUri = `${cacheDirectory}${safeTitle}_${Date.now()}.mp4`;
            const resumable = createDownloadResumable(
              videoUrl, fileUri,
              { headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G981B)', 'Referer': 'https://themoviezone247.com/' } },
              progressCallback
            );
            resumablesRef.current[nextId] = resumable;

            let localUri: string | null = null;
            let isResuming = false;

            while (!localUri) {
              try {
                let result;
                try {
                  result = isResuming
                    ? await resumable.resumeAsync()
                    : await resumable.downloadAsync();
                } catch (resumeErr: any) {
                  if (isResuming && resumablesRef.current[nextId]) {
                    console.warn('[DownloadLoop] native resumeAsync fallback to fresh download...', resumeErr);
                    result = await resumable.downloadAsync();
                  } else {
                    throw resumeErr;
                  }
                }

                if (result?.uri) {
                  localUri = result.uri;
                  setActiveDownloads(prev => ({ ...prev, [nextId]: { ...prev[nextId], progress: 100 } }));
                  downloadNotificationManager.updateProgress(
                    nextId, 
                    displayTitle, 
                    100, 
                    'Complete', 
                    posterUrl, 
                    false,
                    item.id
                  );
                  console.log('[DownloadLoop] Download gracefully finished (external).');
                  if (pausedRef.current.has(nextId)) {
                    markPaused();
                    await waitForResume();
                  }
                  isResuming = true;
                  speedString = 'Resuming...';
                }
              } catch (err: any) {
                const errMsg = (err?.message || '').toLowerCase();
                const errCode = err?.code || '';
                if (errCode === 'ERR_TASK_CANCELLED' || errMsg.includes('cancel') || errMsg.includes('pause') || errMsg.includes('abort')) {
                  if (!resumablesRef.current[nextId]) break;
                  console.log('[DownloadLoop] Download intentionally paused in try-catch (external).');
                  if (pausedRef.current.has(nextId)) {
                    markPaused();
                    await waitForResume();
                  }
                  isResuming = true;
                } else {
                  throw err;
                }
              }
            }

            // Save to media library
            const asset = await MediaLibrary.createAssetAsync(localUri);
            try {
              const album = await MediaLibrary.getAlbumAsync('The Movie Zone');
              if (album) {
                await MediaLibrary.addAssetsToAlbumAsync([asset], album, true);
              } else {
                await MediaLibrary.createAlbumAsync('The Movie Zone', asset, true);
              }
            } catch { /* Album optional */ }

            await FileSystem.deleteAsync(localUri, { idempotent: true });
            recordTrialUsage();
          }
        }
      } catch (err: any) {
        console.error('Global download error:', err);
        const errorTitle = displayTitle || 'Unknown Content';
        const errorMsg = err?.message || 'An unexpected error occurred during the background download.';
        showModal('error', 'Unexpected Error', errorMsg);
        downloadNotificationManager.notifyError(errorTitle, errorMsg);
      } finally {
        const cleanup = async () => {
          delete resumablesRef.current[nextId];
          pausedRef.current.delete(nextId);

          // Cleanup persistent metadata
          try {
            const m = await AsyncStorage.getItem('active_downloads_metadata');
            if (m) {
              const nextMeta = JSON.parse(m);
              if (nextMeta[nextId]) {
                delete nextMeta[nextId];
                await AsyncStorage.setItem('active_downloads_metadata', JSON.stringify(nextMeta));
              }
            }
          } catch (e) { console.error("Metadata cleanup failed", e); }

          setActiveDownloads(prev => {
            // Safety: If it's still < 100%, a NEW download of the same ID might have started.
            // Don't clear it in that case!
            if (prev[nextId] && prev[nextId].progress < 100) return prev;
            const next = { ...prev };
            delete next[nextId];
            return next;
          });
          // Remove ONLY this nextId from the queue, don't just slice(1)
          setDownloadQueue(prev => prev.filter(id => id !== nextId));
          isProcessingQueue.current = false;
        };

        // Minimal delay just to ensure state settling
        setTimeout(cleanup, 200);
      }
    };

    processQueue();
  }, [downloadQueue]);




  const isPaid = subscriptionBundle !== 'None';
  const deviceLimit = planDeviceLimits[subscriptionBundle] || 1;

  return (
    <SubscriptionContext.Provider value={{
      subscriptionBundle,
      subscriptionExpiresAt,
      setSubscriptionBundle,
      downloadsUsedToday,
      customExternalLimit,
      recordExternalDownload,
      isGuest,
      isPaid,
      paymentMethod,
      allMoviesFree,
      eventMessage,
      getExternalDownloadLimit,
      getRemainingDownloads,
      downloadedMovies,
      favorites,
      removeDownload,
      recordInAppDownload,
      toggleFavorite,
      episodeDownloads,
      activeDownloads,
      downloadQueue,
      startExternalGalleryDownload,
      startInternalAppDownload,
      startInternalEpisodeDownload,
      startExternalEpisodeDownload,
      toggleDownloadPause,
      recordTrialUsage,
      isDeviceBlocked,
      activeDeviceIds,
      removeDevice,
      deviceLimit,
      minAppVersion,
      downloadOnWifiOnly,
      setDownloadOnWifiOnly: (val: boolean) => {
        setDownloadOnWifiOnlyState(val);
        AsyncStorage.setItem('downloadOnWifiOnly', String(val));
      },
      smartDownloads,
      setSmartDownloads: (val: boolean) => {
        setSmartDownloadsState(val);
        AsyncStorage.setItem('smartDownloads', String(val));
      },
      playingNow,
      setPlayingNow,
      playerMode,
      setPlayerMode,
      playerTitle,
      setPlayerTitle,
      selectedVideoUrl,
      setSelectedVideoUrl,
    }}>
      {children}

      {/* Premium download result modal — overlays everything */}
      <DownloadSuccessModal
        visible={modalVisible}
        type={modalType}
        title={modalTitle}
        message={modalMessage}
        onClose={() => setModalVisible(false)}
      />
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};
