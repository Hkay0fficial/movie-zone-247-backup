import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db } from '../../constants/firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import * as Application from 'expo-application';
import { Platform } from 'react-native';
import { Movie, Series } from '../../constants/movieData';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { downloadToGallery, downloadToAppIsolatedStorage } from '../../lib/externalDownload';
import { downloadNotificationManager } from '../../lib/notificationHelper';
import DownloadSuccessModal, { DownloadModalType } from '../../components/DownloadSuccessModal';


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
  activeDownloads: Record<string, { progress: number, item: Movie | Series, mode: 'internal' | 'external', episodeId?: string, isPaused?: boolean }>; // ID -> progress (0-100)
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
  isSubscribed: boolean;
  remainingDays: number;
  minAppVersion: string;
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
    isPaused?: boolean
  }>>({});
  const [downloadQueue, setDownloadQueue] = useState<string[]>([]);
  const [episodeDownloads, setEpisodeDownloads] = useState<Record<string, string>>({});
  const isProcessingQueue = useRef(false);
  // Stores active DownloadResumable objects keyed by download ID for pause/resume
  const resumablesRef = useRef<Record<string, import('expo-file-system/legacy').DownloadResumable>>({});
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
    const unsubAuth = onAuthStateChanged(auth, (user) => {
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
      unsubAuth();
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
        message: "External downloads (MP4) are a Premium feature. Upgrade your plan to save movies to your gallery!" 
      };
    }

    const remaining = limit - (currentUsed + 1);
    if (currentUsed < limit) {
      const newUsed = currentUsed + 1;
      setDownloadsUsedToday(newUsed);
      
      const successMsg = isGuest
        ? `"${movieTitle}" is downloading! Register now to unlock high-speed downloads and more.`
        : `"${movieTitle}" is downloading to your phone storage (MP4).\n${remaining} download${remaining === 1 ? '' : 's'} remaining today.`;

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
      message: `"${item.title}" saved to secure app storage for offline viewing. This file is hidden from your gallery.` 
    };
  };

  const removeDownload = (id: string) => {
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
    if (activeDownloads[item.id] !== undefined || downloadQueue.includes(item.id)) {
      showModal('warning', 'Already in Queue', `"${item.title}" is already being saved or is in the queue.`);
      return;
    }
    setActiveDownloads(prev => ({ ...prev, [item.id]: { progress: 0, item, mode: 'internal' } }));
    setDownloadQueue(prev => [...prev, item.id]);
  };

  const startExternalGalleryDownload = async (item: Movie | Series) => {
    setActiveDownloads(prev => ({ ...prev, [item.id]: { progress: 0, item, mode: 'external' } }));
    setDownloadQueue(prev => [...prev, item.id]);
  };

  const startInternalEpisodeDownload = async (series: Series, episodeId: string, episodeUrl: string, episodeTitle: string) => {
    const queueId = episodeId;
    if (activeDownloads[queueId] !== undefined || downloadQueue.includes(queueId)) {
      showModal('warning', 'Already in Queue', `"${episodeTitle}" is already being saved or is in the queue.`);
      return;
    }
    setActiveDownloads(prev => ({ 
      ...prev, 
      [queueId]: { progress: 0, item: series, mode: 'internal', episodeId, episodeUrl, episodeTitle } 
    }));
    setDownloadQueue(prev => [...prev, queueId]);
  };

  const startExternalEpisodeDownload = async (series: Series, episodeId: string, episodeUrl: string, episodeTitle: string) => {
    const queueId = episodeId;
    if (activeDownloads[queueId] !== undefined || downloadQueue.includes(queueId)) {
      showModal('warning', 'Already in Queue', `"${episodeTitle}" is already being saved or is in the queue.`);
      return;
    }
    setActiveDownloads(prev => ({ 
      ...prev, 
      [queueId]: { progress: 0, item: series, mode: 'external', episodeId, episodeUrl, episodeTitle } 
    }));
    setDownloadQueue(prev => [...prev, queueId]);
  };

  // ── Pause / Resume ────────────────────────────────────────────────────────
  const toggleDownloadPause = async (id: string) => {
    const resumable = resumablesRef.current[id];
    if (!resumable) {
      console.warn('[DownloadPause] No resumable found for id:', id);
      return;
    }

    const isCurrentlyPaused = pausedRef.current.has(id);

    if (isCurrentlyPaused) {
      // RESUME: clear the paused flag first so the processQueue while-loop wakes up
      pausedRef.current.delete(id);
      setActiveDownloads(prev => ({ ...prev, [id]: { ...prev[id], isPaused: false } }));
    } else {
      // PAUSE: tell the download to pause, then set the flag
      try {
        await resumable.pauseAsync();
      } catch (e) {
        // Some platforms throw on pauseAsync — that's expected, ignore
      }
      pausedRef.current.add(id);
      setActiveDownloads(prev => ({ ...prev, [id]: { ...prev[id], isPaused: true } }));
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
  };

  // Notification Response Listener for Background Interactivity (Pause / Cancel)
  useEffect(() => {
    import('expo-notifications').then((Notifications) => {
      const subscription = Notifications.addNotificationResponseReceivedListener(response => {
        const actionId = response.actionIdentifier;
        const notificationId = response.notification.request.identifier;
        
        if (notificationId.startsWith('download_')) {
          const downloadId = notificationId.replace('download_', '');
          
          if (actionId === 'pause') {
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

      try {
        const videoUrl = episodeUrl || (item as any).videoUrl || (item as any).previewUrl || '';
        const displayTitle = episodeTitle || item.title;

        const safeTitle = displayTitle.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 60);
        let displayedPct = 0;
        let nextThreshold = 1 + Math.floor(Math.random() * 3);
        
        let lastBytes = 0;
        let lastTimestamp = Date.now();
        let speedString = '';

        const progressCallback = ({ totalBytesWritten, totalBytesExpectedToWrite }: { totalBytesWritten: number; totalBytesExpectedToWrite: number }) => {
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
            if (realPct >= nextThreshold && displayedPct < 99) {
              displayedPct = Math.min(nextThreshold, 99);
              setActiveDownloads(prev => ({ ...prev, [nextId]: { ...prev[nextId], progress: displayedPct } }));
              
              const posterUrl = item.poster || item.heroBanner || '';
              downloadNotificationManager.updateProgress(nextId, displayTitle, displayedPct, speedString, posterUrl);
              
              const step = 2 + Math.floor(Math.random() * 4);
              nextThreshold = displayedPct + step;
            }
          }
        };

        if (mode === 'internal') {
          const fileUri = `${FileSystem.documentDirectory}${safeTitle}_${Date.now()}.mp4`;
          const resumable = FileSystem.createDownloadResumable(
            videoUrl, fileUri,
            { headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G981B)', 'Referer': 'https://themoviezone247.com/' } },
            progressCallback
          );
          resumablesRef.current[nextId] = resumable;

          let localUri: string | null = null;
          let isResuming = false;

          while (!localUri) {
            try {
              const result = isResuming
                ? await resumable.resumeAsync()
                : await resumable.downloadAsync();

              if (result?.uri) {
                localUri = result.uri;
                setActiveDownloads(prev => ({ ...prev, [nextId]: { ...prev[nextId], progress: 100 } }));
              } else {
                // downloadAsync/resumeAsync resolved with undefined = paused by system or user
                markPaused();
                await waitForResume();
                isResuming = true;
              }
            } catch (err: any) {
              const errMsg = (err?.message || '').toLowerCase();
              const errCode = err?.code || '';
              if (errCode === 'ERR_TASK_CANCELLED' || errMsg.includes('cancel') || errMsg.includes('pause') || errMsg.includes('abort')) {
                // Paused via pauseAsync() throwing a cancellation
                markPaused();
                await waitForResume();
                isResuming = true;
              } else {
                throw err;
              }
            }
          }

          // ── Success: save to downloaded list ──
          if (episodeId) {
            setEpisodeDownloads(prev => ({ ...prev, [episodeId]: localUri! }));
            setDownloadedMovies(prev => {
              if (prev.some(m => m.id === item.id)) return prev;
              return [item, ...prev];
            });
          } else {
            const downloadedItem = { ...item, localUri };
            setDownloadedMovies(prev => {
              if (prev.some(m => m.id === item.id)) return prev;
              return [downloadedItem, ...prev];
            });
          }
          showModal('success', 'In-App Save Complete', `"${displayTitle}" has been saved securely to My Downloads.`);

        } else {
          // ── External (Gallery) download ──
          const { status } = await MediaLibrary.requestPermissionsAsync();
          if (status !== 'granted') {
            showModal('error', 'Permission Denied', 'Please allow media access in your phone settings to save downloads.');
          } else {
            const fileUri = `${FileSystem.cacheDirectory}${safeTitle}_${Date.now()}.mp4`;
            const resumable = FileSystem.createDownloadResumable(
              videoUrl, fileUri,
              { headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G981B)', 'Referer': 'https://themoviezone247.com/' } },
              progressCallback
            );
            resumablesRef.current[nextId] = resumable;

            let localUri: string | null = null;
            let isResuming = false;

            while (!localUri) {
              try {
                const result = isResuming
                  ? await resumable.resumeAsync()
                  : await resumable.downloadAsync();

                if (result?.uri) {
                  localUri = result.uri;
                  setActiveDownloads(prev => ({ ...prev, [nextId]: { ...prev[nextId], progress: 100 } }));
                } else {
                  markPaused();
                  await waitForResume();
                  isResuming = true;
                }
              } catch (err: any) {
                const errMsg = (err?.message || '').toLowerCase();
                const errCode = err?.code || '';
                if (errCode === 'ERR_TASK_CANCELLED' || errMsg.includes('cancel') || errMsg.includes('pause') || errMsg.includes('abort')) {
                  markPaused();
                  await waitForResume();
                  isResuming = true;
                } else {
                  throw err;
                }
              }
            }

            // Save to media library
            const asset = await MediaLibrary.createAssetAsync(localUri);
            try {
              const album = await MediaLibrary.getAlbumAsync('Movie Zone 24/7');
              if (album) {
                await MediaLibrary.addAssetsToAlbumAsync([asset], album, true);
              } else {
                await MediaLibrary.createAlbumAsync('Movie Zone 24/7', asset, true);
              }
            } catch { /* Album optional */ }

            await FileSystem.deleteAsync(localUri, { idempotent: true });
            showModal('success', 'Saved to Gallery', `"${displayTitle}" has been saved to your gallery.`);
            recordTrialUsage();
          }
        }
      } catch (err) {
        console.error('Global download error:', err);
        showModal('error', 'Unexpected Error', 'An unexpected error occurred during the background download.');
      } finally {
        delete resumablesRef.current[nextId];
        pausedRef.current.delete(nextId);
        setTimeout(() => {
          setActiveDownloads(prev => {
            const next = { ...prev };
            delete next[nextId];
            return next;
          });
          setDownloadQueue(prev => prev.slice(1));
          isProcessingQueue.current = false;
        }, 3000);
      }
    };

    processQueue();
  }, [downloadQueue]);




  return (
    <SubscriptionContext.Provider value={{
      subscriptionBundle,
      subscriptionExpiresAt,
      setSubscriptionBundle,
      paymentMethod,
      downloadsUsedToday,
      customExternalLimit,
      recordExternalDownload,
      recordInAppDownload,
      getExternalDownloadLimit,
      getRemainingDownloads,
      recordTrialUsage,
      allMoviesFree,
      eventMessage,
      isGuest,
      isPaid: subscriptionBundle !== 'None',
      downloadedMovies,
      favorites,
      removeDownload,
      toggleFavorite,
      activeDownloads,
      downloadQueue,
      episodeDownloads,
      startExternalGalleryDownload,
      startInternalAppDownload,
      startInternalEpisodeDownload,
      startExternalEpisodeDownload,
      toggleDownloadPause,
      isDeviceBlocked,
      activeDeviceIds,
      removeDevice,
      deviceLimit: planDeviceLimits[subscriptionBundle] || 0,
      isSubscribed: subscriptionBundle !== 'None' && subscriptionExpiresAt ? (subscriptionExpiresAt > Date.now()) : false,
      remainingDays: subscriptionExpiresAt ? Math.max(0, Math.ceil((subscriptionExpiresAt - Date.now()) / (1000 * 60 * 60 * 24))) : 0,
      minAppVersion
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
