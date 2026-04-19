import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../constants/firebaseConfig';

interface UserProfile {
  fullName: string;
  username: string;
  phoneNumber: string;
  profilePhoto: string;
  email: string;
  isGuest: boolean;
  watchHistory: Record<string, { position: number; timestamp: number; episodeId?: string }>;
}

interface UserContextType {
  user: User | null;
  profile: UserProfile;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  savePlaybackProgress: (movieId: string, position: number, episodeId?: string) => Promise<void>;
  getPlaybackProgress: (movieId: string, episodeId?: string) => { position: number; timestamp: number } | null;
}

const DEFAULT_PROFILE: UserProfile = {
  fullName: 'Guest Mode',
  username: '',
  phoneNumber: '',
  profilePhoto: '',
  email: 'Sign in to save your history',
  isGuest: true,
  watchHistory: {},
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

import { registerForPushNotificationsAsync } from '../../lib/notifications';

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(true);

  // Push Notification Registration
  useEffect(() => {
    if (user && !user.isAnonymous) {
      const registerToken = async () => {
        try {
          const token = await registerForPushNotificationsAsync();
          if (token) {
            const userRef = doc(db, 'users', user.uid);
            await setDoc(userRef, { pushToken: token }, { merge: true });
          }
        } catch (error) {
          console.error('Failed to register push token:', error);
        }
      };
      registerToken();
    }
  }, [user]);

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
            });
          }
          setLoading(false);
        }, (error) => {
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
    if (episodeId) historyItem.episodeId = episodeId;

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

  return (
    <UserContext.Provider value={{ 
      user, 
      profile, 
      loading, 
      refreshProfile, 
      savePlaybackProgress, 
      getPlaybackProgress 
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
