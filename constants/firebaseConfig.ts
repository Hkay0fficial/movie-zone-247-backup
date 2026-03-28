import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

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

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
