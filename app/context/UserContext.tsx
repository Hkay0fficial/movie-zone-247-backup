import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { arrayRemove, arrayUnion, doc, onSnapshot, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../constants/firebaseConfig';
import { registerForPushNotificationsAsync } from '../../lib/notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Device from 'expo-device';

interface UserProfile {
  fullName: string;
  username: string;
  phoneNumber: string;
  profilePhoto: string;
  email: string;
  isGuest: boolean;
  watchHistory: Record<string, { position: number; timestamp: number; episodeId?: string }>;
  createdAt?: any;
  is2FAEnabled: boolean;
  activeDeviceIds: string[];
  completionCount: number;
  hasRatedApp: boolean;
  notificationPrefs?: Record<string, boolean>;
}

interface UserContextType {
  user: User | null;
  profile: UserProfile;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  savePlaybackProgress: (movieId: string, position: number, episodeId?: string) => Promise<void>;
  getPlaybackProgress: (movieId: string, episodeId?: string) => { position: number; timestamp: number } | null;
  removeFromWatchHistory: (movieId: string, episodeId?: string) => Promise<void>;
  clearWatchHistory: () => Promise<void>;
  incrementCompletion: () => Promise<number>;
  markAsRated: () => Promise<void>;
}

const DEFAULT_PROFILE: UserProfile = {
  fullName: 'Guest Mode',
  username: '',
  phoneNumber: '',
  profilePhoto: '',
  email: 'Sign in to save your history',
  isGuest: true,
  watchHistory: {},
  is2FAEnabled: false,
  activeDeviceIds: [],
  completionCount: 0,
  hasRatedApp: false,
  notificationPrefs: {
    newReleases: true,
    myListUpdates: true,
    recommendations: false,
    billingAccount: true,
  },
};

const UserContext = createContext<UserContextType | undefined>(undefined);

/**
 * Detects the auth provider from a Firebase user object.
 */
function detectAuthProvider(user: User): string {
  if (user.isAnonymous) return 'anonymous';
  const providerData = user.providerData;
  if (providerData && providerData.length > 0) {
    const id = providerData[0].providerId;
    if (id === 'google.com') return 'google';
    if (id === 'apple.com') return 'apple';
    if (id === 'phone') return 'phone';
    if (id === 'password') return 'email';
  }
  return 'unknown';
}

/**
 * Ensures a Firestore user document exists and is fully populated.
 * Creates from scratch if missing; backfills missing fields if partial.
 */
async function ensureUserDocument(user: User) {
  const userRef = doc(db, 'users', user.uid);
  const docSnap = await getDoc(userRef);

  const authProvider = detectAuthProvider(user);
  const displayName = user.displayName || '';
  const email = user.email || '';
  const photo = user.photoURL || '';

  if (!docSnap.exists()) {
    // First time — create full profile
    await setDoc(userRef, {
      fullName: displayName || (authProvider === 'anonymous' ? 'Guest User' : 'User'),
      email: email,
      profilePhoto: photo,
      username: '',
      phoneNumber: user.phoneNumber || '',
      createdAt: serverTimestamp(),
      lastActive: serverTimestamp(),
      role: 'user',
      authProvider,
      subscriptionBundle: 'None',
      activeDeviceIds: [],
      paymentMethod: '',
      hasUsedGuestTrial: false,
    });
  } else {
    // Existing user — backfill any missing critical fields
    const data = docSnap.data();
    const updates: Record<string, any> = { lastActive: serverTimestamp() };

    if (!data.email && email) updates.email = email;
    if (!data.fullName && displayName) updates.fullName = displayName;
    if (!data.profilePhoto && photo) updates.profilePhoto = photo;
    if (!data.createdAt) updates.createdAt = serverTimestamp();
    if (!data.authProvider) updates.authProvider = authProvider;

    await setDoc(userRef, updates, { merge: true });
  }
}

const CACHE_KEY = '@user_profile_v3';

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(true);
  const registeredPushRef = useRef<{ uid: string; token: string; entry: Record<string, any> } | null>(null);

  // Load profile from cache on mount
  useEffect(() => {
    const loadCachedProfile = async () => {
      try {
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        if (cached) {
          setProfile(JSON.parse(cached));
          setLoading(false);
        }
      } catch (e) {
        console.warn('UserContext: Failed to load cached profile:', e);
      }
    };
    loadCachedProfile();
  }, []);

  // Save profile to cache whenever it changes
  useEffect(() => {
    if (profile && profile !== DEFAULT_PROFILE) {
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify(profile)).catch(e => 
        console.warn('UserContext: Failed to cache profile:', e)
      );
    }
  }, [profile]);

  // Push Notification Registration
  useEffect(() => {
    let cancelled = false;

    const removeRegisteredToken = async () => {
      const registered = registeredPushRef.current;
      if (!registered) return;

      registeredPushRef.current = null;
      const userRef = doc(db, 'users', registered.uid);
      await setDoc(userRef, {
        pushTokens: arrayRemove(registered.entry),
        lastPushTokenRemovedAt: serverTimestamp(),
      }, { merge: true });
    };

    if (!user) {
      removeRegisteredToken().catch(error => {
        console.warn('Failed to remove push token from Firestore:', error);
      });
      return;
    }

    if (registeredPushRef.current && registeredPushRef.current.uid !== user.uid) {
      removeRegisteredToken().catch(error => {
        console.warn('Failed to remove previous user push token from Firestore:', error);
      });
    }

    if (user && !user.isAnonymous) {
      const registerToken = async () => {
        try {
          const token = await registerForPushNotificationsAsync();
          if (cancelled) return;
          if (token) {
            console.log('Push token successfully obtained:', token);
            const userRef = doc(db, 'users', user.uid);
            const tokenEntry = {
              token,
              platform: Platform.OS,
              deviceName: Device.deviceName || '',
            };

            registeredPushRef.current = { uid: user.uid, token, entry: tokenEntry };
            await setDoc(userRef, {
              pushToken: token,
              pushTokens: arrayUnion(tokenEntry),
              lastPushTokenUpdatedAt: serverTimestamp(),
            }, { merge: true });
            console.log('Push token successfully saved to Firestore for user:', user.uid);
          } else {
            console.warn('registerForPushNotificationsAsync returned no token.');
          }
        } catch (error) {
          console.error('Failed to register/save push token:', error);
        }
      };
      registerToken();
    }

    return () => {
      cancelled = true;
    };
  }, [user?.uid, user?.isAnonymous]);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      // Clean up previous profile listener before setting a new one
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = undefined;
      }

      setUser(currentUser);

      if (currentUser) {
        // Ensure Firestore doc exists and has all required fields
        try {
          await ensureUserDocument(currentUser);
        } catch (e) {
          console.error('UserContext: Failed to ensure user document:', e);
        }

        // Now listen for live updates
        const userDocRef = doc(db, 'users', currentUser.uid);
        unsubscribeProfile = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setProfile({
              fullName: data.fullName || currentUser.displayName || 'User',
              username: data.username || '',
              phoneNumber: data.phoneNumber || currentUser.phoneNumber || '',
              profilePhoto: data.profilePhoto || currentUser.photoURL || '',
              email: data.email || currentUser.email || '',
              isGuest: currentUser.isAnonymous,
              watchHistory: data.watchHistory || {},
              createdAt: data.createdAt,
              is2FAEnabled: data.is2FAEnabled || false,
              activeDeviceIds: data.activeDeviceIds || [],
              completionCount: data.completionCount || 0,
              hasRatedApp: data.hasRatedApp || false,
              notificationPrefs: data.notificationPrefs || DEFAULT_PROFILE.notificationPrefs,
            });
          } else {
            setProfile({
              fullName: currentUser.displayName || 'User',
              username: '',
              phoneNumber: '',
              profilePhoto: currentUser.photoURL || '',
              email: currentUser.email || '',
              isGuest: currentUser.isAnonymous,
              watchHistory: {},
              is2FAEnabled: false,
              activeDeviceIds: [],
              completionCount: 0,
              hasRatedApp: false,
              notificationPrefs: DEFAULT_PROFILE.notificationPrefs,
            });
          }
          setLoading(false);
        }, (error: any) => {
          if (error.code === 'permission-denied') return;
          console.error("UserContext profile listener error:", error);
        });
      } else {
        setProfile(DEFAULT_PROFILE);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const savePlaybackProgress = async (movieId: string, position: number, episodeId?: string) => {
    const key = episodeId ? `${movieId}_${episodeId}` : movieId;
    const historyItem: any = { position, timestamp: Date.now() };
    if (episodeId !== undefined && episodeId !== null) historyItem.episodeId = episodeId;

    // Update local state immediately for snappy UI
    setProfile(prev => ({
      ...prev,
      watchHistory: {
        ...prev.watchHistory,
        [key]: historyItem
      }
    }));

    // Persist to Firestore if logged in
    if (user && !user.isAnonymous) {
      try {
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, {
          watchHistory: {
            [key]: historyItem
          }
        }, { merge: true });
      } catch (e) {
        console.error('UserContext: Failed to save playback progress:', e);
      }
    }
  };

  const getPlaybackProgress = (movieId: string, episodeId?: string) => {
    const key = episodeId ? `${movieId}_${episodeId}` : movieId;
    return profile.watchHistory[key] || null;
  };

  const removeFromWatchHistory = async (movieId: string, episodeId?: string) => {
    const key = episodeId ? `${movieId}_${episodeId}` : movieId;
    
    // Update local state
    setProfile(prev => {
      const nextHistory = { ...prev.watchHistory };
      delete nextHistory[key];
      return { ...prev, watchHistory: nextHistory };
    });

    // Persist to Firestore
    if (user && !user.isAnonymous) {
      try {
        const { deleteField } = require('firebase/firestore');
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, {
          watchHistory: {
            [key]: deleteField()
          }
        }, { merge: true });
      } catch (e) {
        console.error('UserContext: Failed to remove from watch history:', e);
      }
    }
  };

  const clearWatchHistory = async () => {
    // Update local state
    setProfile(prev => ({ ...prev, watchHistory: {} }));

    // Persist to Firestore
    if (user && !user.isAnonymous) {
      try {
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, { watchHistory: {} }, { merge: true });
      } catch (e) {
        console.error('UserContext: Failed to clear watch history:', e);
      }
    }
  };

  const refreshProfile = async () => {
    if (user) {
      const userDocRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(userDocRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setProfile(prev => ({
          ...prev,
          fullName: data.fullName || user.displayName || 'User',
          username: data.username || '',
          phoneNumber: data.phoneNumber || '',
          profilePhoto: data.profilePhoto || prev.profilePhoto,
          email: data.email || user.email || '',
          watchHistory: data.watchHistory || {},
        }));
      }
    }
  };

  const incrementCompletion = async () => {
    const newCount = (profile.completionCount || 0) + 1;
    setProfile(prev => ({ ...prev, completionCount: newCount }));
    
    if (user && !user.isAnonymous) {
      try {
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, { completionCount: newCount }, { merge: true });
      } catch (e) {
        console.error('UserContext: Failed to increment completion count:', e);
      }
    }
    return newCount;
  };

  const markAsRated = async () => {
    setProfile(prev => ({ ...prev, hasRatedApp: true }));
    if (user && !user.isAnonymous) {
      try {
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, { hasRatedApp: true }, { merge: true });
      } catch (e) {
        console.error('UserContext: Failed to mark as rated:', e);
      }
    }
  };

  return (
    <UserContext.Provider value={{ 
      user, 
      profile, 
      loading, 
      refreshProfile, 
      savePlaybackProgress, 
      getPlaybackProgress,
      removeFromWatchHistory,
      clearWatchHistory,
      incrementCompletion,
      markAsRated
    }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}

export default UserProvider;
