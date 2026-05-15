import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db } from '../../constants/firebaseConfig';
import { onAuthStateChanged, signInAnonymously, signOut } from 'firebase/auth';
import { doc, onSnapshot, setDoc, getDoc, collection, deleteDoc, updateDoc, arrayRemove, deleteField, runTransaction } from 'firebase/firestore';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import { Alert, Platform, Animated, Dimensions, StyleSheet } from 'react-native';
import { Movie, Series } from '../../constants/movieData';
import { Plan, PLANS } from '../../constants/planData';
import PremiumAlert from '../../components/PremiumAlert';

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
  holidayExpiresAt: string;
  holidayBadgeText: string;
  holidayBadgeColor: string;
  isBannerActive: boolean;
  bannerTheme: string;
  bannerButtonText: string;
  bannerActionUrl: string;
  favorites: (Movie | Series)[];
  toggleFavorite: (item: Movie | Series) => void;
  recordTrialUsage: () => Promise<void>;
  isDeviceBlocked: boolean;
  activeDeviceIds: string[];
  deviceId: string | null;
  removeDevice: (id: string, force?: boolean) => Promise<void>;
  forceRemoveDevice: (id: string) => Promise<void>;
  remoteLogoutWithPin: (targetId: string, pin: string) => Promise<{ success: boolean; error?: string }>;
  unregisterCurrentDevice: () => Promise<void>;
  switchToGuest: () => Promise<void>;
  deviceLimit: number;
  customExternalLimit: number;
  hasUsedGuestTrial: boolean;
  minAppVersion: string;
  latestVersion: string;
  latestBuild: string;
  forceUpdate: boolean;
  updateMessage: string;
  maintenanceMode: boolean;
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
  isNotificationVisible: boolean;
  setIsNotificationVisible: (v: boolean) => void;
  deviceRemovalRequests: Record<string, any>;
  planLimits: Record<string, number>;
  deviceLimits: Record<string, number>;
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
  holidayExpiresAt: '',
  holidayBadgeText: 'Holiday',
  holidayBadgeColor: '#e11d48',
  isBannerActive: false,
  bannerTheme: 'amber',
  bannerButtonText: '',
  bannerActionUrl: '',
  favorites: [],
  toggleFavorite: () => {},
  recordTrialUsage: async () => {},
  isDeviceBlocked: false,
  activeDeviceIds: [],
  deviceId: null,
  removeDevice: async () => {},
  forceRemoveDevice: async () => {},
  remoteLogoutWithPin: async () => ({ success: false, error: 'Not implemented' }),
  unregisterCurrentDevice: async () => {},
  switchToGuest: async () => {},
  deviceLimit: 1,
  customExternalLimit: 0,
  hasUsedGuestTrial: false,
  minAppVersion: '',
  latestVersion: '',
  latestBuild: '',
  forceUpdate: false,
  updateMessage: '',
  maintenanceMode: false,
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
  availablePlans: PLANS,
  isNotificationVisible: false,
  setIsNotificationVisible: () => {},
  deviceRemovalRequests: {},
  planLimits: dynamicPlanLimits,
  deviceLimits: dynamicDeviceLimits,
});

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [subscriptionBundle, setSubscriptionBundle] = useState('None');
  const [subscriptionExpiresAt, setSubscriptionExpiresAt] = useState<number | null>(null);
  const [allMoviesFree, setAllMoviesFree] = useState(false);
  const [eventMessage, setEventMessage] = useState('');
  const [holidayExpiresAt, setHolidayExpiresAt] = useState('');
  const [holidayBadgeText, setHolidayBadgeText] = useState('Holiday');
  const [holidayBadgeColor, setHolidayBadgeColor] = useState('#e11d48');
  const [isBannerActive, setIsBannerActive] = useState(false);
  const [bannerTheme, setBannerTheme] = useState('amber');
  const [bannerButtonText, setBannerButtonText] = useState('');
  const [bannerActionUrl, setBannerActionUrl] = useState('');
  const [minAppVersion, setMinAppVersion] = useState('');
  const [latestVersion, setLatestVersion] = useState('');
  const [latestBuild, setLatestBuild] = useState('');
  const [forceUpdate, setForceUpdate] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('');
  const [maintenanceMode, setMaintenanceMode] = useState(false);
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
  const [availablePlans, setAvailablePlans] = React.useState<Plan[]>([]);
  const [ticker, setTicker] = React.useState(0);
  const handledRemovalRequestsRef = useRef<Set<string>>(new Set());
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    buttons: any[];
    icon?: string;
    iconColor?: string;
  }>({
    visible: false,
    title: '',
    message: '',
    buttons: [],
  });

  // Minute-by-minute heartbeat to refresh time-based logic (isPaid, remainingDays)
  React.useEffect(() => {
    const interval = setInterval(() => {
      setTicker(t => t + 1);
    }, 60000);
    return () => clearInterval(interval);
  }, []);
  const [isNotificationVisible, setIsNotificationVisible] = useState(false);
  const [deviceRemovalRequests, setDeviceRemovalRequests] = useState<Record<string, any>>({});
  const [planLimits, setPlanLimits] = useState<Record<string, number>>(dynamicPlanLimits);
  const [deviceLimits, setDeviceLimits] = useState<Record<string, number>>(dynamicDeviceLimits);

  const parseSubscriptionExpiry = (value: any): number | null => {
    if (!value) return null;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = Date.parse(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    if (typeof value.seconds === 'number') return value.seconds * 1000;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (value instanceof Date) return value.getTime();
    return null;
  };

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
        .sort((a, b) => (((a as any).order || 0) - ((b as any).order || 0)));

      const effectivePlans = list.length > 0 ? list : PLANS;
      setAvailablePlans(effectivePlans);

      // Update dynamic maps
      const pLimits: Record<string, number> = { 'Premium': 10, 'VIP': 999, 'None': 0 };
      const dLimits: Record<string, number> = { 'premium': 5, 'vip': 999, 'none': 0 };

      effectivePlans.forEach(p => {
          const baseLimit = p.externalDownloadDailyLimit || p.downloadLimit || 1;
          const bonusLimit = (p as any).bonusDownloads || 0;
          pLimits[p.name] = baseLimit + bonusLimit;
          dLimits[p.name.toLowerCase()] = p.deviceLimit ?? 1;
      });

      dynamicPlanLimits = pLimits;
      dynamicDeviceLimits = dLimits;
      setPlanLimits(pLimits);
      setDeviceLimits(dLimits);
    }, (error: any) => {
      if (error.code === 'permission-denied') return;
      console.error("SubscriptionContext: Plans listener error:", error);
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
            setDeviceRemovalRequests(userData.deviceRemovalRequests || {});
            
            const extLimit = userData.customExternalLimit || userData.downloadLimit || 0;
            const devLimit = userData.customDeviceLimit || 0;
            const expirationMs = parseSubscriptionExpiry(expiresAt);
            const isExpired = expirationMs !== null && Date.now() > expirationMs;
            const finalBundle = isExpired ? 'None' : bundle;
            const finalExpires = isExpired ? null : expirationMs;
            const hasDeviceManagedAccess = finalBundle !== 'None' || extLimit > 0;
            setCustomExternalLimit(extLimit);
            setCustomDeviceLimit(devLimit);

            // Device limit check
            const runDeviceCheck = async () => {
              if (!user || user.isAnonymous) {
                setIsDeviceBlocked(false);
                return;
              }

              const { id: currentId, name: currentName } = await getDeviceInfo();
              if (currentId === 'unknown_device') return;

              if (!hasDeviceManagedAccess) {
                setIsDeviceBlocked(false);
                return;
              }

              const removalRequests = userData.deviceRemovalRequests || {};
              const pendingRequest = removalRequests[currentId];
              const requestKey = `${currentId}:${pendingRequest?.requestedAt || ''}`;
              if (pendingRequest?.status === 'pending' && !handledRemovalRequestsRef.current.has(requestKey)) {
                handledRemovalRequestsRef.current.add(requestKey);
                setAlertConfig({
                  visible: true,
                  title: 'Deactivate this device?',
                  message: 'Another device wants to use this account. Allow this device to be removed from the account slots?',
                  icon: 'cellphone-remove',
                  iconColor: '#f59e0b',
                  buttons: [
                    {
                      text: 'No',
                      style: 'cancel',
                      onPress: () => updateDoc(doc(db, 'users', user.uid), {
                        [`deviceRemovalRequests.${currentId}.status`]: 'denied',
                        [`deviceRemovalRequests.${currentId}.respondedAt`]: new Date().toISOString(),
                      }).catch(() => {}),
                    },
                    {
                      text: 'Allow',
                      style: 'destructive',
                      onPress: async () => {
                        await updateDoc(doc(db, 'users', user.uid), {
                          activeDeviceIds: arrayRemove(currentId),
                          [`activeDevicesMeta.${currentId}`]: deleteField(),
                          [`deviceRemovalRequests.${currentId}`]: deleteField(),
                          [`kickedDevices.${currentId}`]: true,
                        }).catch(() => {});
                        await signOut(auth).catch(() => {});
                        await signInAnonymously(auth).catch(() => {});
                      },
                    },
                  ],
                });

              }

              // 0. Check if this device has been explicitly kicked
              const kickedDevices = userData.kickedDevices || {};
              if (kickedDevices[currentId]) {
                await updateDoc(doc(db, 'users', user.uid), {
                  [`kickedDevices.${currentId}`]: deleteField()
                }).catch(() => {});
                await signOut(auth).catch(() => {});
                return;
              }

              const normalizedBundle = bundle.toLowerCase();
              const baseLimit = dynamicDeviceLimits[normalizedBundle] ?? 1;
              const limit = devLimit > 0 ? devLimit : baseLimit;
              const isAlreadyRegistered = fetchedActiveDevices.includes(currentId);
              const userRef = doc(db, 'users', user.uid);

              // 1. Ensure current device is registered for activity tracking
              if (!isAlreadyRegistered) {
                try {
                  await runTransaction(db, async (transaction) => {
                    const freshSnap = await transaction.get(userRef);
                    const freshData = freshSnap.exists() ? freshSnap.data() : {};
                    const freshDevices = freshData.activeDeviceIds || [];
                    const freshMeta = freshData.activeDevicesMeta || {};

                    if (freshDevices.includes(currentId)) {
                      transaction.set(userRef, {
                        [`activeDevicesMeta.${currentId}`]: {
                          ...(freshMeta[currentId] || {}),
                          name: currentName,
                          lastUsed: new Date().toISOString(),
                        }
                      }, { merge: true });
                      return;
                    }

                    if (freshDevices.length >= limit) {
                      throw new Error('DEVICE_LIMIT_REACHED');
                    }

                    transaction.set(userRef, {
                      activeDeviceIds: [...freshDevices, currentId],
                      [`activeDevicesMeta.${currentId}`]: {
                        name: currentName,
                        lastUsed: new Date().toISOString(),
                      }
                    }, { merge: true });
                  });

                  setIsDeviceBlocked(false);
                } catch (err: any) {
                  if (err?.message === 'DEVICE_LIMIT_REACHED') {
                    setIsDeviceBlocked(true);
                  }
                }
              } else {
                setIsDeviceBlocked(false);
                // Throttled metadata update (only every 30 mins)
                const meta = fetchedDeviceMeta[currentId] || {};
                const lastUpdate = meta.lastUsed ? new Date(meta.lastUsed).getTime() : 0;
                const thirtyMins = 30 * 60 * 1000;
                if ((Date.now() - lastUpdate) > thirtyMins || meta.name !== currentName) {
                  updateDoc(doc(db, 'users', user.uid), {
                    [`activeDevicesMeta.${currentId}.lastUsed`]: new Date().toISOString(),
                    [`activeDevicesMeta.${currentId}.name`]: currentName
                  }).catch(() => {});
                }
              }
            };

            runDeviceCheck();
            
            setSubscriptionBundle(finalBundle);
            setSubscriptionExpiresAt(finalExpires);

            AsyncStorage.setItem('cached_subscription', JSON.stringify({
              bundle: finalBundle,
              expiresAt: finalExpires,
              guestStatus: user.isAnonymous
            })).catch(() => {});
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
              setHolidayExpiresAt('');
              setHolidayBadgeText(data.holidayBadgeText || 'Holiday');
              setHolidayBadgeColor(data.holidayBadgeColor || '#e11d48');
              setIsBannerActive(data.isBannerActive || false);
              setBannerTheme(data.bannerTheme || 'amber');
              setBannerButtonText(data.bannerButtonText || '');
              setBannerActionUrl(data.bannerActionUrl || data.bannerTargetUrl || '');
              if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
              }
              return true;
            }
          }
          setAllMoviesFree(data.allMoviesFree || false);
          setEventMessage(data.eventMessage || '');
          setHolidayExpiresAt(expiresAtStr || '');
          setHolidayBadgeText(data.holidayBadgeText || 'Holiday');
          setHolidayBadgeColor(data.holidayBadgeColor || '#e11d48');
          setIsBannerActive(data.isBannerActive || false);
          setBannerTheme(data.bannerTheme || 'amber');
          setBannerButtonText(data.bannerButtonText || '');
          setBannerActionUrl(data.bannerActionUrl || data.bannerTargetUrl || '');
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
        const platform = Platform.OS === 'android' ? 'android' : 'ios';
        const platformData = data[platform] || {};

        // Use platform specific data if available, otherwise fallback to global keys
        setLatestVersion(platformData.latestVersion || data.latestVersion || '');
        setLatestBuild(platformData.latestBuild?.toString() || data.latestBuild?.toString() || '0');
        setForceUpdate(platformData.forceUpdate ?? data.forceUpdate ?? false);
        setUpdateMessage(platformData.updateMessage || data.updateMessage || '');
        setMaintenanceMode(data.maintenanceMode || false);
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
          genres: (item as any).genres || item.genre || [],
          year: item.year || '',
          timestamp: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error("Error toggling favorite:", err);
    }
  };

  const removeDevice = async (targetId: string, force: boolean = false) => {
    if (auth.currentUser && !isGuest) {
      try {
        const userRef = doc(db, 'users', auth.currentUser.uid);

        if (force) {
          await forceRemoveDevice(targetId);
          return;
        }

        await updateDoc(userRef, {
          [`deviceRemovalRequests.${targetId}`]: {
            status: 'pending',
            requestedBy: deviceId || 'unknown_device',
            requestedAt: new Date().toISOString(),
          },
        });
        setAlertConfig({
          visible: true,
          title: 'Request sent',
          message: 'The registered device will see a popup to approve or deny deactivation. If they refuse or are offline, you can force remove them.',
          icon: 'send-circle-outline',
          iconColor: '#10b981',
          buttons: [{ text: 'OK', onPress: () => {} }]
        });

      } catch (err) {
        console.error("Failed to request device removal:", err);
      }
    }
  };

  const forceRemoveDevice = async (targetId: string) => {
    if (auth.currentUser && !isGuest) {
      try {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        await updateDoc(userRef, {
          activeDeviceIds: arrayRemove(targetId),
          [`activeDevicesMeta.${targetId}`]: deleteField(),
          [`deviceRemovalRequests.${targetId}`]: deleteField(),
          [`kickedDevices.${targetId}`]: true,
        });
        setAlertConfig({
          visible: true,
          title: 'Device Removed',
          message: 'The device has been forcibly removed from your account.',
          icon: 'shield-check-outline',
          iconColor: '#10b981',
          buttons: [{ text: 'GREAT', onPress: () => {} }]
        });
      } catch (err) {
        console.error("Failed to force remove device:", err);
      }
    }
  };

  const remoteLogoutWithPin = async (targetId: string, pin: string) => {
    if (!auth.currentUser || isGuest) return { success: false, error: 'Auth required' };
 
    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) return { success: false, error: 'User profile not found' };
      
      const storedPin = userSnap.data().securityPin;
      
      if (!storedPin) {
        return { success: false, error: 'NO_PIN_SET' };
      }
      
      if (storedPin !== pin) {
        return { success: false, error: 'INVALID_PIN' };
      }
 
      // Pin matches, perform force removal
      await updateDoc(userRef, {
        activeDeviceIds: arrayRemove(targetId),
        [`activeDevicesMeta.${targetId}`]: deleteField(),
        [`deviceRemovalRequests.${targetId}`]: deleteField(),
        [`kickedDevices.${targetId}`]: true,
      });
 
      return { success: true };
    } catch (err) {
      console.error("Failed to perform remote logout with pin:", err);
      return { success: false, error: 'Database error' };
    }
  };

  const unregisterCurrentDevice = async () => {
    if (auth.currentUser && !isGuest && deviceId) {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userRef, {
        activeDeviceIds: arrayRemove(deviceId),
        [`activeDevicesMeta.${deviceId}`]: deleteField(),
        [`deviceRemovalRequests.${deviceId}`]: deleteField(),
        [`kickedDevices.${deviceId}`]: deleteField(),
      });
    }
  };

  const switchToGuest = async () => {
    setIsDeviceBlocked(false);
    await signOut(auth).catch(() => {});
    await signInAnonymously(auth);
  };

  const hasNamedPlan = subscriptionBundle !== 'None';
  const hasManualDownloadAccess = customExternalLimit > 0;
  // We treat null expiry as "lifetime" only if there is an actual plan/access flag.
  const hasActiveExpiry =
    subscriptionExpiresAt === null
      ? (hasNamedPlan || hasManualDownloadAccess)
      : Boolean(subscriptionExpiresAt && subscriptionExpiresAt > Date.now());
  const hasPlanAccess = (hasNamedPlan || hasManualDownloadAccess) && hasActiveExpiry;
  const isPaid = hasPlanAccess;
  const deviceLimit = customDeviceLimit > 0 ? customDeviceLimit : (dynamicDeviceLimits[subscriptionBundle.toLowerCase()] ?? 1);

  // Global Player Animated Values
  const playerPos = React.useMemo(() => new Animated.ValueXY({ x: 0, y: 0 }), []);
  const playerSize = React.useMemo(() => new Animated.Value(SCREEN_W), []);

  const isSubscribed = isPaid;
  const remainingDays = React.useMemo(() => {
    if (!subscriptionExpiresAt) return 0;
    return Math.max(0, Math.ceil((subscriptionExpiresAt - Date.now()) / (1000 * 60 * 60 * 24)));
  }, [subscriptionExpiresAt, ticker]);


  const contextValue = React.useMemo(() => ({
    subscriptionBundle,
    subscriptionExpiresAt,
    setSubscriptionBundle,
    isGuest,
    isPaid,
    paymentMethod,
    allMoviesFree,
    eventMessage,
    holidayExpiresAt,
    holidayBadgeText,
    holidayBadgeColor,
    isBannerActive,
    bannerTheme,
    bannerButtonText,
    bannerActionUrl,
    favorites,
    toggleFavorite,
    recordTrialUsage,
    isDeviceBlocked,
    activeDeviceIds,
    activeDevicesMeta,
    deviceId,
    removeDevice,
    forceRemoveDevice,
    remoteLogoutWithPin,
    unregisterCurrentDevice,
    switchToGuest,
    deviceLimit,
    customExternalLimit,
    hasUsedGuestTrial,
    minAppVersion,
    latestVersion,
    latestBuild,
    forceUpdate,
    updateMessage,
    maintenanceMode,
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
    isNotificationVisible,
    setIsNotificationVisible,
    planLimits,
    deviceLimits,
    deviceRemovalRequests,
    ticker
  }), [
    subscriptionBundle,
    subscriptionExpiresAt,
    isGuest,
    isPaid,
    paymentMethod,
    allMoviesFree,
    eventMessage,
    holidayExpiresAt,
    holidayBadgeText,
    holidayBadgeColor,
    isBannerActive,
    bannerTheme,
    bannerButtonText,
    bannerActionUrl,
    favorites,
    isDeviceBlocked,
    activeDeviceIds,
    activeDevicesMeta,
    deviceId,
    deviceLimit,
    customExternalLimit,
    hasUsedGuestTrial,
    minAppVersion,
    latestVersion,
    latestBuild,
    forceUpdate,
    updateMessage,
    maintenanceMode,
    playingNow,
    playerMode,
    playerTitle,
    selectedVideoUrl,
    playerPos,
    playerSize,
    isPreview,
    playingEpisodeId,
    playingEpisodes,
    isSubscribed,
    remainingDays,
    availablePlans,
    isNotificationVisible,
    setIsNotificationVisible,
    planLimits,
    deviceLimits,
    deviceRemovalRequests,
    remoteLogoutWithPin,
    ticker
  ]);

  return (
    <SubscriptionContext.Provider value={contextValue}>
      {children}
      <PremiumAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
        icon={alertConfig.icon as any}
        iconColor={alertConfig.iconColor}
      />
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => useContext(SubscriptionContext);
