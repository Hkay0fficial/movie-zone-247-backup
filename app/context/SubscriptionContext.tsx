import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db } from '../../constants/firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { Movie, Series } from '../../constants/movieData';
import { downloadToGallery, downloadToAppIsolatedStorage } from '../../lib/externalDownload';
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
  activeDownloads: Record<string, { progress: number, item: Movie | Series, mode: 'internal' | 'external', episodeId?: string }>; // ID -> progress (0-100)
  downloadQueue: string[]; // List of IDs in order
  startExternalGalleryDownload: (item: Movie | Series) => Promise<void>;
  startInternalAppDownload: (item: Movie | Series) => Promise<void>;
  startInternalEpisodeDownload: (series: Series, episodeId: string, episodeUrl: string, episodeTitle: string) => Promise<void>;
}





const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [subscriptionBundle, setSubscriptionBundle] = useState('None');
  const [subscriptionExpiresAt, setSubscriptionExpiresAt] = useState<number | null>(null);
  const [downloadsUsedToday, setDownloadsUsedToday] = useState(0);
  const [lastDownloadDate, setLastDownloadDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [allMoviesFree, setAllMoviesFree] = useState(false);
  const [eventMessage, setEventMessage] = useState('');
  const [customExternalLimit, setCustomExternalLimit] = useState(0);
  const [isGuest, setIsGuest] = useState(false);
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
    episodeTitle?: string
  }>>({});
  const [downloadQueue, setDownloadQueue] = useState<string[]>([]);
  const [episodeDownloads, setEpisodeDownloads] = useState<Record<string, string>>({});
  const isProcessingQueue = useRef(false);



  useEffect(() => {
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
          }
        });
      } else {
        // Fallback check for mock-guest-token if no Firebase user
        checkMockGuest();
        if (unsubUserDoc) unsubUserDoc();
        setSubscriptionBundle('None');
        setSubscriptionExpiresAt(null);
        setPaymentMethod('');
      }
    });

    const checkMockGuest = async () => {
      const token = await AsyncStorage.getItem('userToken');
      if (token === 'mock-guest-token') {
        setIsGuest(true);
      }
    };

    return () => {
      unsubAuth();
      if (unsubUserDoc) unsubUserDoc();
    };
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
    return planLimits[subscriptionBundle] || 0;
  };

  const getRemainingDownloads = () => {
    return Math.max(0, getExternalDownloadLimit() - downloadsUsedToday);
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
    
    // Non-premium users have a limit of 0
    if (limit === 0) {
      return { 
        success: false, 
        message: "External downloads (MP4) are a Premium feature. Upgrade your plan to save movies to your gallery!" 
      };
    }

    if (currentUsed < limit) {
      const newUsed = currentUsed + 1;
      setDownloadsUsedToday(newUsed);
      const remaining = limit - newUsed;
      return { 
        success: true, 
        message: remaining > 0
          ? `"${movieTitle}" is downloading to your phone storage (MP4).\n${remaining} download${remaining === 1 ? '' : 's'} remaining today.`
          : `"${movieTitle}" is downloading. You've used all ${limit} external downloads for today.` 
      };
    }
    return { 
      success: false, 
      message: `Daily limit reached. You've used all ${limit} external downloads for today. Upgrade for a higher limit, or use in-app saving (unlimited).` 
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
    const queueId = episodeId; // Simplified to just episodeId
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

      try {
        const videoUrl = episodeUrl || (item as any).videoUrl || (item as any).previewUrl || '';
        const displayTitle = episodeTitle || item.title;
        let dlResult: { success: boolean, message: string, localUri?: string };

        if (mode === 'internal') {
          dlResult = await downloadToAppIsolatedStorage(
            videoUrl,
            displayTitle,
            (progress) => {
              setActiveDownloads(prev => ({ 
                ...prev, 
                [nextId]: { ...prev[nextId], progress } 
              }));
            }
          );
          if (dlResult.success) {
             if (episodeId) {
               // Episode Download
               setEpisodeDownloads(prev => ({ ...prev, [episodeId]: dlResult.localUri! }));
               // Ensure series is in downloaded list
               setDownloadedMovies(prev => {
                 if (prev.some(m => m.id === item.id)) return prev;
                 return [item, ...prev];
               });
             } else {
               // Standard Movie Download
               const downloadedItem = { ...item, localUri: dlResult.localUri };
               setDownloadedMovies(prev => {
                  if (prev.some(m => m.id === item.id)) return prev;
                  return [downloadedItem, ...prev];
               });
             }
             showModal('success', 'In-App Save Complete', dlResult.message);
          } else {
             showModal('error', 'Download Failed', dlResult.message);
          }
        } else {
          dlResult = await downloadToGallery(
            videoUrl,
            item.title,
            (progress) => {
              setActiveDownloads(prev => ({ 
                ...prev, 
                [item.id]: { ...prev[item.id], progress, mode: 'external' } 
              }));
            }
          );

          if (dlResult.success) {
            showModal('success', 'Saved to Gallery', dlResult.message);
          } else {
            showModal('error', 'Download Failed', dlResult.message);
          }
        }
      } catch (err) {
        console.error('Global download error:', err);
        showModal('error', 'Unexpected Error', 'An unexpected error occurred during the background download.');
      } finally {
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
      startInternalEpisodeDownload
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
