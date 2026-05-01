import { initializeApp, getApp, getApps } from 'firebase/app';
import { initializeAuth, Auth, getReactNativePersistence } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Replace with your actual Firebase config from the Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyAliWNvMWmO4ffePb2VU1uXE4zBh0k5Ca0",
  authDomain: "the-movie-zone-247-256.firebaseapp.com",
  projectId: "the-movie-zone-247-256",
  storageBucket: "the-movie-zone-247-256.firebasestorage.app",
  messagingSenderId: "1005273436856",
  appId: "1:1005273436856:web:a8da428284d57be44f1a4d",
  measurementId: "G-QT3GJL2L2S"
};

// Initialize Firebase (Safely check if already initialized)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize services with Native Persistence for React Native
let authInstance: Auth;
try {
  // Use initializeAuth with native persistence for Expo
  authInstance = initializeAuth(app, {
    persistence: (getReactNativePersistence as any)(AsyncStorage)
  });
} catch (e) {
  // If already initialized (common during Fast Refresh), get existing instance
  const { getAuth } = require('firebase/auth');
  authInstance = getAuth(app);
}

export const auth = authInstance;

// Enable persistent local cache for Firestore
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: undefined })
});
export const storage = getStorage(app);

export default app;
