import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db } from '../../constants/firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import * as Application from 'expo-application';
import { Platform, Animated, Dimensions } from 'react-native';
import { Movie, Series } from '../../constants/movieData';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

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
  isGuest: boolean;
  isPaid: boolean;
  paymentMethod: string;
  allMoviesFree: boolean;
  eventMessage: string;
  favorites: (Movie | Series)[];
  toggleFavorite: (item: Movie | Series) => void;
  recordTrialUsage: () => Promise<void>;
  isDeviceBlocked: boolean;
  activeDeviceIds: string[];
  removeDevice: (id: string) => Promise<void>;
  deviceLimit: number;
  minAppVersion: string;
  playingNow: Movie | Series | null;
  setPlayingNow: (m: Movie | Series | null) => void;
  playerMode: 'closed' | 'full' | 'mini';
  setPlayerMode: (mode: 'closed' | 'full' | 'mini') => void;
  playerTitle: string;
  setPlayerTitle: (title: string) => void;
  selectedVideoUrl: string;
  setSelectedVideoUrl: (url: string) => void;
  playerPos: Animated.ValueXY;
  playerSize: Animated.Value;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [subscriptionBundle, setSubscriptionBundle] = useState('None');
  const [subscriptionExpiresAt, setSubscriptionExpiresAt] = useState<number | null>(null);
  const [allMoviesFree, setAllMoviesFree] = useState(false);
  const [eventMessage, setEventMessage] = useState('');
  const [minAppVersion, setMinAppVersion] = useState('');
  const [isGuest, setIsGuest] = useState(true);
  const [playingNow, setPlayingNow] = useState<Movie | Series | null>(null);
  const [playerMode, setPlayerMode] = useState<'closed' | 'full' | 'mini'>('closed');
  const [playerTitle, setPlayerTitle] = useState('');
  const [selectedVideoUrl, setSelectedVideoUrl] = useState('');
  const [hasUsedGuestTrial, setHasUsedGuestTrial] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [favorites, setFavorites] = useState<(Movie | Series)[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
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
    let unsubUserDoc: (() => void) | undefined;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (unsubUserDoc) {
        unsubUserDoc();
        unsubUserDoc = undefined;
      }

      if (user) {
        setIsGuest(user.isAnonymous);
        
        unsubUserDoc = onSnapshot(doc(db, 'users', user.uid), (snap) => {
          if (snap.exists()) {
            const userData = snap.data();
            const bundle = userData.subscriptionBundle || 'None';
            const expiresAt = userData.subscriptionExpiresAt;
            const method = userData.paymentMethod || '';
            
            setPaymentMethod(method);
            setHasUsedGuestTrial(userData.hasUsedGuestTrial || false);

            const fetchedActiveDevices = userData.activeDeviceIds || [];
            setActiveDeviceIds(fetchedActiveDevices);

            // Device limit check
            if (user && !user.isAnonymous && bundle !== 'None' && deviceId) {
              const limit = planDeviceLimits[bundle] || 1;
              const isAllowed = fetchedActiveDevices.includes(deviceId);

              if (isAllowed) {
                setIsDeviceBlocked(false);
              } else if (fetchedActiveDevices.length < limit) {
                const newDevices = [...fetchedActiveDevices, deviceId];
                setDoc(doc(db, 'users', user.uid), { activeDeviceIds: newDevices }, { merge: true }).catch(() => {});
                setIsDeviceBlocked(false);
              } else {
                setIsDeviceBlocked(true);
              }
            } else {
              setIsDeviceBlocked(false);
            }
            
            if (expiresAt && expiresAt.seconds) {
              const expirationMs = expiresAt.seconds * 1000;
              if (Date.now() > expirationMs) {
                setSubscriptionBundle('None');
                setSubscriptionExpiresAt(null);
              } else {
                setSubscriptionBundle(bundle);
                setSubscriptionExpiresAt(expirationMs);
              }
            } else {
              setSubscriptionBundle(bundle);
              setSubscriptionExpiresAt(null);
            }
          } else {
            setSubscriptionBundle('None');
            setSubscriptionExpiresAt(null);
            setHasUsedGuestTrial(false);
          }
        }, (error) => {
          console.error("SubscriptionContext snapshot error:", error);
        });
      } else {
        setIsGuest(true);
        setSubscriptionBundle('None');
        setSubscriptionExpiresAt(null);
        setPaymentMethod('');
      }
    });

    return () => {
      unsubscribe();
      if (unsubUserDoc) unsubUserDoc();
    };
  }, [deviceId]);

  useEffect(() => {
    const checkDeviceTrial = async () => {
      const id = await getDeviceId();
      if (id) {
        setDeviceId(id);
        try {
          const deviceTrialRef = doc(db, 'device_trials', id);
          const snap = await getDoc(deviceTrialRef);
          if (snap.exists() && snap.data().hasUsedGuestTrial) {
            setHasUsedGuestTrial(true);
          }
        } catch (err) {}
      }
    };
    checkDeviceTrial();
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        const savedFavorites = await AsyncStorage.getItem('my_list_movies');
        if (savedFavorites) {
          setFavorites(JSON.parse(savedFavorites));
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
      AsyncStorage.setItem('my_list_movies', JSON.stringify(favorites));
    }
  }, [favorites, isInitialized]);

  const timerRef = useRef<any>(null);
  const userTimerRef = useRef<any>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'global'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const expiresAtStr = data.expiresAt;

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
        if (!isCurrentlyExpired && data.allMoviesFree && expiresAtStr) {
          timerRef.current = setInterval(checkExpiration, 30000);
        }
      }
    });
    return () => {
      unsub();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

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

      checkUserExpiration();
      userTimerRef.current = setInterval(checkUserExpiration, 30000);
    }

    return () => {
      if (userTimerRef.current) clearInterval(userTimerRef.current);
    };
  }, [subscriptionExpiresAt]);

  const recordTrialUsage = async () => {
    if (isGuest && auth.currentUser && !hasUsedGuestTrial) {
      try {
        await setDoc(doc(db, "users", auth.currentUser.uid), {
          hasUsedGuestTrial: true
        }, { merge: true });

        if (deviceId) {
          await setDoc(doc(db, "device_trials", deviceId), {
            hasUsedGuestTrial: true,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        }
        setHasUsedGuestTrial(true);
      } catch (err) {}
    }
  };

  const toggleFavorite = (item: Movie | Series) => {
    setFavorites(prev => {
      const exists = prev.some(m => m.id === item.id);
      if (exists) return prev.filter(m => m.id !== item.id);
      return [item, ...prev];
    });
  };

  const removeDevice = async (targetId: string) => {
    if (auth.currentUser && !isGuest) {
      try {
        const nextDevices = activeDeviceIds.filter(id => id !== targetId);
        await setDoc(doc(db, 'users', auth.currentUser.uid), { 
          activeDeviceIds: nextDevices 
        }, { merge: true });
      } catch (err) {}
    }
  };

  const isPaid = subscriptionBundle !== 'None';
  const deviceLimit = planDeviceLimits[subscriptionBundle] || 1;

  // Global Player Animated Values
  const playerPos = React.useMemo(() => new Animated.ValueXY({ x: 0, y: 0 }), []);
  const playerSize = React.useMemo(() => new Animated.Value(SCREEN_W), []);

  return (
    <SubscriptionContext.Provider value={{
      subscriptionBundle,
      subscriptionExpiresAt,
      setSubscriptionBundle,
      isGuest,
      isPaid,
      paymentMethod,
      allMoviesFree,
      eventMessage,
      favorites,
      toggleFavorite,
      recordTrialUsage,
      isDeviceBlocked,
      activeDeviceIds,
      removeDevice,
      deviceLimit,
      minAppVersion,
      playingNow,
      setPlayingNow,
      playerMode,
      setPlayerMode,
      playerTitle,
      setPlayerTitle,
      selectedVideoUrl,
      setSelectedVideoUrl,
      playerPos,
      playerSize,
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) throw new Error('useSubscription must be used within a SubscriptionProvider');
  return context;
};
