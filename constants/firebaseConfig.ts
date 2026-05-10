import { initializeApp, getApp, getApps } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, getAuth, Auth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyAliWNvMWmO4ffePb2VU1uXE4zBh0k5Ca0",
  authDomain: "the-movie-zone-247-256.firebaseapp.com",
  projectId: "the-movie-zone-247-256",
  storageBucket: "the-movie-zone-247-256.firebasestorage.app",
  messagingSenderId: "1005273436856",
  appId: "1:1005273436856:web:a8da428284d57be44f1a4d",
  measurementId: "G-QT3GJL2L2S"
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

let authInstance: Auth;
try {
  authInstance = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
} catch (e: any) {
  // During Fast Refresh, fallback to getAuth
  authInstance = getAuth(app);
}

export const auth = authInstance;





// Enable persistent local cache for Firestore
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: undefined })
});

export const storage = getStorage(app);

export default app;

