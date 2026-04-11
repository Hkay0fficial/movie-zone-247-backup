import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../constants/firebaseConfig';

interface UserProfile {
  fullName: string;
  username: string;
  phoneNumber: string;
  profilePhoto: string;
  email: string;
  isGuest: boolean;
}

interface UserContextType {
  user: User | null;
  profile: UserProfile;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const DEFAULT_PROFILE: UserProfile = {
  fullName: 'Guest Mode',
  username: '',
  phoneNumber: '',
  profilePhoto: '', // No default image, use initials instead
  email: 'Sign in to save your history',
  isGuest: true,
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // Listen to live updates from Firestore for this user
        const userDocRef = doc(db, 'users', currentUser.uid);
        const unsubscribeProfile = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setProfile({
              fullName: data.fullName || currentUser.displayName || 'User',
              username: data.username || '',
              phoneNumber: data.phoneNumber || '',
              profilePhoto: data.profilePhoto || '',
              email: currentUser.email || '',
              isGuest: currentUser.isAnonymous,
            });
          } else {
            // New user, but logged in
            setProfile({
              fullName: currentUser.displayName || 'User',
              username: '',
              phoneNumber: '',
              profilePhoto: '',
              email: currentUser.email || '',
              isGuest: currentUser.isAnonymous,
            });
          }
          setLoading(false);
        });

        return () => unsubscribeProfile();
      } else {
        // Guest mode
        setProfile(DEFAULT_PROFILE);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

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
        }));
      }
    }
  };

  return (
    <UserContext.Provider value={{ user, profile, loading, refreshProfile }}>
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
