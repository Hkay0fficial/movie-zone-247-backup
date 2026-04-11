import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth, db } from '../constants/firebaseConfig';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Handles the Firebase sign-in using a Google ID Token.
 * Also performs auto-registration if the user doesn't exist in Firestore.
 */
export async function signinWithGoogle(idToken: string) {
  try {
    const credential = GoogleAuthProvider.credential(idToken);
    const userCredential = await signInWithCredential(auth, credential);
    const user = userCredential.user;

    // --- AUTO-REGISTRATION LOGIC ---
    // Check if user document exists in Firestore
    const userRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      // First time user - Create their profile
      await setDoc(userRef, {
        fullName: user.displayName || 'Google User',
        email: user.email,
        createdAt: serverTimestamp(),
        lastActive: serverTimestamp(),
        role: 'user',
        authProvider: 'google',
        profilePhoto: user.photoURL || '',
        subscriptionBundle: 'None',
        activeDeviceIds: [],
        paymentMethod: '',
        hasUsedGuestTrial: false,
      });
      return { user, isNewUser: true };
    } else {
      // Existing user - Update last active
      await setDoc(userRef, { lastActive: serverTimestamp() }, { merge: true });
      return { user, isNewUser: false };
    }
  } catch (error) {
    console.error('Google Sign-In Error:', error);
    throw error;
  }
}
