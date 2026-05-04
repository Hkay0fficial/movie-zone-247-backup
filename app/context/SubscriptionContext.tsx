import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db } from '../../constants/firebaseConfig';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot, setDoc, getDoc, collection, deleteDoc, updateDoc, arrayUnion, arrayRemove, deleteField } from 'firebase/firestore';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import { Platform, Animated, Dimensions, StyleSheet } from 'react-native';
import { Movie, Series } from '../../constants/movieData';
import { Plan, PLANS } from '../../constants/planData';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// These will now be computed dynamically from the 'plans' collection
let dynamicPlanLimits: Record<string, number> = {
  'Premium': 10,
  'VIP': 999,
  'None': 0
};

let dynamicDeviceLimits: Record<string, number> = {
  'premium': 5,
  'vip': 999,
  'none': 0
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
  deviceId: string | null;
  removeDevice: (id: string) => Promise<void>;
  deviceLimit: number;
  customExternalLimit: number;
  minAppVersion: string;
  latestVersion: string;
  latestBuild: string;
  forceUpdate: boolean;
  updateMessage: string;
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
  isPreview: boolean;
  setIsPreview: (v: boolean) => void;
  playingEpisodeId: string | null;
  setPlayingEpisodeId: (id: string | null) => void;
  playingEpisodes: any[];
  setPlayingEpisodes: (eps: any[]) => void;
  activeDevicesMeta: Record<string, any>;
  isSubscribed: boolean;
  remainingDays: number;
  availablePlans: Plan[];
}

const SubscriptionContext = createContext<SubscriptionContextType>({
  subscriptionBundle: 'None',
  subscriptionExpiresAt: null,
  setSubscriptionBundle: () => {},
  isGuest: true,
  isPaid: false,
  paymentMethod: '',
  allMoviesFree: false,
  eventMessage: '',
  favorites: [],
  toggleFavorite: () => {},
  recordTrialUsage: async () => {},
  isDeviceBlocked: false,
  activeDeviceIds: [],
  deviceId: null,
  removeDevice: async () => {},
  deviceLimit: 1,
  customExternalLimit: 0,
  minAppVersion: '',
  latestVersion: '',
  latestBuild: '',
  forceUpdate: false,
  updateMessage: '',
  playingNow: null,
  setPlayingNow: () => {},
  playerMode: 'closed',
  setPlayerMode: () => {},
  playerTitle: '',
  setPlayerTitle: () => {},
  selectedVideoUrl: '',
  setSelectedVideoUrl: () => {},
  playerPos: new Animated.ValueXY({ x: 0, y: 0 }),
  playerSize: new Animated.Value(SCREEN_W),
  isPreview: false,
  setIsPreview: () => {},
  playingEpisodeId: null,
  setPlayingEpisodeId: () => {},
  playingEpisodes: [],
  setPlayingEpisodes: () => {},
  activeDevicesMeta: {},
  isSubscribed: false,
  remainingDays: 0,
  availablePlans: [],
});

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [subscriptionBundle, setSubscriptionBundle] = useState('None');
  const [subscriptionExpiresAt, setSubscriptionExpiresAt] = useState<number | null>(null);
  const [allMoviesFree, setAllMoviesFree] = useState(false);
  const [eventMessage, setEventMessage] = useState('');
  const [minAppVersion, setMinAppVersion] = useState('');
  const [latestVersion, setLatestVersion] = useState('');
  const [latestBuild, setLatestBuild] = useState('');
  const [forceUpdate, setForceUpdate] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('');
  const [customExternalLimit, setCustomExternalLimit] = useState(0);
  const [customDeviceLimit, setCustomDeviceLimit] = useState(0);
  const [isGuest, setIsGuest] = useState(true);
  const [playingNow, setPlayingNow] = useState<Movie | Series | null>(null);
  const [playerMode, setPlayerMode] = useState<'closed' | 'full' | 'mini'>('closed');
  const [playerTitle, setPlayerTitle] = useState('');
  const [selectedVideoUrl, setSelectedVideoUrl] = useState('');
  const [isPreview, setIsPreview] = useState(false);
  const [hasUsedGuestTrial, setHasUsedGuestTrial] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [favorites, setFavorites] = useState<(Movie | Series)[]>([]);
  const [playingEpisodeId, setPlayingEpisodeId] = useState<string | null>(null);
  const [playingEpisodes, setPlayingEpisodes] = useState<any[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [activeDeviceIds, setActiveDeviceIds] = useState<string[]>([]);
  const [activeDevicesMeta, setActiveDevicesMeta] = useState<Record<string, any>>({});
  const [isDeviceBlocked, setIsDeviceBlocked] = useState(false);
  const [availablePlans, setAvailablePlans] = useState<Plan[]>(PLANS);

  // Helper to get persistent hardware ID
  const getDeviceInfo = async () => {
    try {
      let id = null;
      if (Platform.OS === 'android') {
        id = (Application as any).androidId || await Application.getAndroidId();
      } else if (Platform.OS === 'ios') {
        id = await Application.getIosIdForVendorAsync();
      }
      
      const model = Device.modelName || Device.designName || (Platform.OS === 'ios' ? 'iPhone' : 'Android Device');
      return { 
        id: id || 'unknown_device', 
        name: model 
      };
    } catch (e) {
      console.error("Failed to get device info:", e);
      return { id: 'unknown_device', name: 'Unknown Device' };
    }
  };

  // Load cached subscription on init
  useEffect(() => {
    const loadCachedSubscription = async () => {
      try {
        const cached = await AsyncStorage.getItem('cached_subscription');
        if (cached) {
          const { bundle, expiresAt, guestStatus } = JSON.parse(cached);
          setSubscriptionBundle(bundle || 'None');
          setSubscriptionExpiresAt(expiresAt || null);
          setIsGuest(guestStatus !== undefined ? guestStatus : true);
        }
      } catch (e) {
        console.error("Failed to load cached subscription:", e);
      } finally {
        setIsInitialized(true);
      }
    };
    loadCachedSubscription();
  }, []);

  // Fetch plans from Firestore
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'plans'), (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Plan))
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      
      if (list.length > 0) {
        setAvailablePlans(list);
        
        // Update dynamic maps
        const pLimits: Record<string, number> = { 'Premium': 10, 'VIP': 999, 'None': 0 };
        const dLimits: Record<string, number> = { 'premium': 5, 'vip': 999, 'none': 0 };
        
        list.forEach(p => {
          pLimits[p.name] = p.downloadLimit || 1;
          dLimits[p.name.toLowerCase()] = p.deviceLimit || 1;
        });
        
        dynamicPlanLimits = pLimits;
        dynamicDeviceLimits = dLimits;
      }
    });
    return unsub;
  }, []);

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
            const fetchedDeviceMeta = userData.activeDevicesMeta || {};
            setActiveDeviceIds(fetchedActiveDevices);
            setActiveDevicesMeta(fetchedDeviceMeta);
            
            const extLimit = userData.customExternalLimit || 0;
            const devLimit = userData.customDeviceLimit || 0;
            setCustomExternalLimit(extLimit);
            setCustomDeviceLimit(devLimit);

                // Device limit check
                const runDeviceCheck = async () => {
                  if (user && !user.isAnonymous) {
                    const { id: currentId, name: currentName } = await getDeviceInfo();
                    if (currentId === 'unknown_device') return;

                    // 0. Check if this device has been explicitly kicked
                    const kickedDevices = userData.kickedDevices || {};
                    if (kickedDevices[currentId]) {
                      // Remove the kick flag first to prevent loops
                      await updateDoc(doc(db, 'users', user.uid), {
                        [`kickedDevices.${currentId}`]: deleteField()
                      }).catch(() => {});
                      
                      // Perform logout
                      await signOut(auth).catch(() => {});
                      return;
                    }

                    const normalizedBundle = bundle.toLowerCase();
                    const baseLimit = dynamicDeviceLimits[normalizedBundle] || 1;
                    const limit = devLimit > 0 ? devLimit : baseLimit;
                    const isAlreadyRegistered = fetchedActiveDevices.includes(currentId);

                    // 1. Ensure current device is registered for activity tracking
                    if (!isAlreadyRegistered && fetchedActiveDevices.length < 10) {
                  // Use atomic update to prevent race conditions between devices
                  const updateData: any = {
                    activeDeviceIds: arrayUnion(currentId),
                    [`activeDevicesMeta.${currentId}`]: { 
                      name: currentName, 
                      lastUsed: new Date().toISOString() 
                    }
                  };
                  
                  updateDoc(doc(db, 'users', user.uid), updateData).catch((err) => {
                    console.error("Failed to register device:", err);
                    // Fallback to setDoc if updateDoc fails (e.g. doc doesn't exist yet)
                    setDoc(doc(db, 'users', user.uid), updateData, { merge: true }).catch(() => {});
                  });

                  // If they have a bundle, check if this new registration is within limits
                  if (bundle !== 'None') {
                    setIsDeviceBlocked(fetchedActiveDevices.length >= limit);
                  } else {
                    setIsDeviceBlocked(false);
                  }
                } else if (isAlreadyRegistered) {
                  setIsDeviceBlocked(false);
                  
                  // Only update if metadata is missing, name changed, or lastUsed is more than 30 mins old
                  const meta = fetchedDeviceMeta[currentId] || {};
                  const lastUpdate = meta.lastUsed ? new Date(meta.lastUsed).getTime() : 0;
                  const thirtyMins = 30 * 60 * 1000;
                  const now = Date.now();
                  const nameChanged = meta.name !== currentName;
                  const isOld = (now - lastUpdate) > thirtyMins;

                  if (nameChanged || isOld) {
                    updateDoc(doc(db, 'users', user.uid), {
                      [`activeDevicesMeta.${currentId}.lastUsed`]: new Date().toISOString(),
                      [`activeDevicesMeta.${currentId}.name`]: currentName
                    }).catch(() => {});
                  }
                } else {
                  // Not registered and list is full (10 devices max for history) or hit plan limit
                  if (bundle !== 'None') {
                    setIsDeviceBlocked(true);
                  } else {
                    setIsDeviceBlocked(false);
                  }
                }
              } else {
                setIsDeviceBlocked(false);
              }
            };

            runDeviceCheck();
            
            if (expiresAt && expiresAt.seconds) {
              const expirationMs = expiresAt.seconds * 1000;
              const isExpired = Date.now() > expirationMs;
              const finalBundle = isExpired ? 'None' : bundle;
              const finalExpires = isExpired ? null : expirationMs;

              setSubscriptionBundle(finalBundle);
              setSubscriptionExpiresAt(finalExpires);
              
              // Cache the result
              AsyncStorage.setItem('cached_subscription', JSON.stringify({
                bundle: finalBundle,
                expiresAt: finalExpires,
                guestStatus: user.isAnonymous
              })).catch(() => {});
            } else {
              setSubscriptionBundle(bundle);
              setSubscriptionExpiresAt(null);
              AsyncStorage.setItem('cached_subscription', JSON.stringify({
                bundle: bundle,
                expiresAt: null,
                guestStatus: user.isAnonymous
              })).catch(() => {});
            }
          } else if (!snap.metadata.fromCache) {
            // Only reset if we have confirmed with the server that the doc doesn't exist
            // This prevents overwriting our cached data when offline
            setSubscriptionBundle('None');
            setSubscriptionExpiresAt(null);
            setHasUsedGuestTrial(false);
          }
        }, (error: any) => {
          if (error.code === 'permission-denied') return;
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
      const { id } = await getDeviceInfo();
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
    let unsubFavs: (() => void) | undefined;

    if (auth.currentUser && !isGuest) {
      const favsRef = collection(db, 'users', auth.currentUser.uid, 'favorites');
      unsubFavs = onSnapshot(favsRef, (snap) => {
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as (Movie | Series)));
        setFavorites(list);
      }, (error: any) => {
        if (error.code === 'permission-denied') return;
        console.error("Favorites snapshot error:", error);
      });
    } else {
      // For guests or logged out, try to load from local storage as fallback
      AsyncStorage.getItem('my_list_movies').then(val => {
        if (val) setFavorites(JSON.parse(val));
      });
    }

    return () => {
      if (unsubFavs) unsubFavs();
    };
  }, [auth.currentUser, isGuest]);

  useEffect(() => {
    if (isGuest && favorites.length > 0) {
      AsyncStorage.setItem('my_list_movies', JSON.stringify(favorites));
    }
  }, [favorites, isGuest]);

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
    }, (error: any) => {
      if (error.code === 'permission-denied') return;
      console.error("SubscriptionContext: Global settings listener error:", error);
    });
    return () => {
      unsub();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'appVersion'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setLatestVersion(data.latestVersion || '');
        setLatestBuild(data.latestBuild || '0');
        setForceUpdate(data.forceUpdate || false);
        setUpdateMessage(data.updateMessage || '');
      }
    }, (error: any) => {
      if (error.code === 'permission-denied') return;
      console.error("SubscriptionContext: Version settings listener error:", error);
    });
    return unsub;
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

  const toggleFavorite = async (item: Movie | Series) => {
    if (!auth.currentUser || isGuest) {
      // Local only for guests
      setFavorites(prev => {
        const exists = prev.some(m => m.id === item.id);
        if (exists) return prev.filter(m => m.id !== item.id);
        return [item, ...prev];
      });
      return;
    }

    const docRef = doc(db, 'users', auth.currentUser.uid, 'favorites', item.id);
    const exists = favorites.some(m => m.id === item.id);

    try {
      if (exists) {
        await deleteDoc(docRef);
      } else {
        await setDoc(docRef, {
          id: item.id,
          title: item.title,
          poster: item.poster || (item as any).banner || '',
          type: 'seasons' in item ? 'series' : 'movie',
          genres: item.genres || [],
          year: item.year || '',
          timestamp: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error("Error toggling favorite:", err);
    }
  };

  const removeDevice = async (targetId: string) => {
    if (auth.currentUser && !isGuest) {
      try {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        
        // Atomically remove from ID list, delete metadata, and set kick flag
        await updateDoc(userRef, {
          activeDeviceIds: arrayRemove(targetId),
          [`activeDevicesMeta.${targetId}`]: deleteField(),
          [`kickedDevices.${targetId}`]: true
        });
      } catch (err) {
        console.error("Failed to remove device:", err);
      }
    }
  };

  const isPaid = subscriptionBundle !== 'None';
  const deviceLimit = customDeviceLimit > 0 ? customDeviceLimit : (dynamicDeviceLimits[subscriptionBundle.toLowerCase()] || 1);

  // Global Player Animated Values
  const playerPos = React.useMemo(() => new Animated.ValueXY({ x: 0, y: 0 }), []);
  const playerSize = React.useMemo(() => new Animated.Value(SCREEN_W), []);

  const isSubscribed = isPaid && subscriptionExpiresAt !== null && subscriptionExpiresAt > Date.now();
  const remainingDays = subscriptionExpiresAt 
    ? Math.max(0, Math.ceil((subscriptionExpiresAt - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

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
      activeDevicesMeta,
      deviceId,
      removeDevice,
      deviceLimit,
      customExternalLimit,
      minAppVersion,
      latestVersion,
      latestBuild,
      forceUpdate,
      updateMessage,
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
      isPreview,
      setIsPreview,
      playingEpisodeId,
      setPlayingEpisodeId,
      playingEpisodes,
      setPlayingEpisodes,
      isSubscribed,
      remainingDays,
      availablePlans,
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => useContext(SubscriptionContext);
