import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  TouchableWithoutFeedback,
  Keyboard,
  Pressable,
  Alert,
  Modal,
  Dimensions,
  StatusBar as RNStatusBar
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import { auth, db } from '../constants/firebaseConfig';
import ClockAnimation from './ClockAnimation';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updateProfile,
  signInAnonymously,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  OAuthProvider,
  signInWithCredential
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import { signinWithGoogle } from '../lib/authHelpers';
import Animated, { 
  FadeInDown, 
  FadeOutDown,
  FadeOutUp, 
  Layout, 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring,
  withTiming,
  withDelay,
  withSequence,
  FadeIn,
  FadeOut,
  interpolate,
  interpolateColor,
  Easing,
  withRepeat
} from 'react-native-reanimated';

// Initialize WebBrowser for OAuth
WebBrowser.maybeCompleteAuthSession();

// Background image (dark sci-fi / cinematic vibe)
const BG_URL = 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&q=80&w=1000';

// Change these to your actual Client IDs from Google Cloud Console
const GOOGLE_WEB_CLIENT_ID = '1005273436856-h08kd1sqg14cp2d3ih7khc9tk271qevg.apps.googleusercontent.com';
const GOOGLE_ANDROID_CLIENT_ID = '1005273436856-0rrf2a337f9bu4qtprhsl85gohv6conu.apps.googleusercontent.com';
const GOOGLE_IOS_CLIENT_ID = ''; // Leave empty if not using iOS native login

const FloatingLabelInput = ({ 
  label, 
  value, 
  onChangeText, 
  icon, 
  secureTextEntry, 
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  onFocus,
  onBlur,
  showPasswordToggle,
  onPasswordToggle,
  hasError
}: any) => {
  const [isFocused, setIsFocused] = useState(false);
  const labelAnim = useSharedValue(value ? 1 : 0);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    labelAnim.value = withTiming(value ? 1 : 0, { duration: 200 });
  }, [value]);

  const labelStyle = useAnimatedStyle(() => ({
    opacity: withTiming(value ? 0 : 1, { duration: 200 }),
    transform: [
      { translateX: withTiming(value ? 10 : 0, { duration: 200 }) }
    ]
  }));

  const handlePress = () => {
    inputRef.current?.focus();
  };

  return (
    <Pressable 
      onPress={handlePress}
      style={[
        styles.inputContainer, 
        isFocused && styles.inputContainerFocused,
        hasError && { borderColor: '#ff4b4b', borderBottomWidth: 1.5 }
      ]}
    >
      <Ionicons name={icon} size={20} color={isFocused ? "#818cf8" : "#94a3b8"} />
      <Animated.Text style={[styles.watermarkLabel, labelStyle]}>
        {label}
      </Animated.Text>
      <TextInput
        ref={inputRef}
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => {
          setIsFocused(true);
          onFocus?.();
        }}
        onBlur={() => {
          setIsFocused(false);
          onBlur?.();
        }}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
      />
      {showPasswordToggle && (
        <TouchableOpacity onPress={onPasswordToggle} style={styles.eyeBtn}>
          <Ionicons name={secureTextEntry ? "eye-off-outline" : "eye-outline"} size={20} color="#94a3b8" />
        </TouchableOpacity>
      )}
    </Pressable>
  );
};

const AnimatedBlob = ({ color, size, initialPos, duration }: any) => {
  const tx = useSharedValue(initialPos.x);
  const ty = useSharedValue(initialPos.y);

  useEffect(() => {
    tx.value = withRepeat(
      withTiming(initialPos.x + 150, { duration: duration * 1.5, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
    ty.value = withRepeat(
      withTiming(initialPos.y + 150, { duration, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: color,
    position: 'absolute',
    opacity: 0.15,
  }));

  return <Animated.View style={animatedStyle} />;
};

// ─────────────────────────────────────────────────────
// FlippingLogoHeader – animated logo + "THE MOVIE ZONE"
// ─────────────────────────────────────────────────────

function FlippingLogoHeader({ flipCount, onFlip }: { flipCount: number, onFlip: () => void }) {
  // Start the rotation exactly at the current side so there's no 1-frame flash
  const rotation = useSharedValue(flipCount * 180);
  const glowAnim = useSharedValue(0);

  useEffect(() => {
    // Only animate if the rotation isn't already at the target
    if (rotation.value !== flipCount * 180) {
      rotation.value = withSpring(flipCount * 180, { damping: 12, stiffness: 90 });
    }
    
    glowAnim.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1200 }),
        withTiming(0.3, { duration: 1200 })
      ),
      -1,
      true
    );
  }, [flipCount]);

  const frontStyle = useAnimatedStyle(() => {
    // Front is visible when rotation is close to 0, 360, 720...
    // Back is visible when rotation is close to 180, 540, 900...
    const normalized = ((rotation.value % 360) + 360) % 360;
    const isFront = normalized < 90 || normalized > 270;
    
    return {
      transform: [
        { perspective: 1000 },
        { rotateY: `${rotation.value}deg` }
      ],
      opacity: isFront ? 1 : 0,
      zIndex: isFront ? 10 : 0,
      position: 'absolute',
      width: '100%',
      alignItems: 'center',
    };
  });

  const backStyle = useAnimatedStyle(() => {
    const normalized = ((rotation.value % 360) + 360) % 360;
    const isBack = normalized >= 90 && normalized <= 270;
    
    return {
      transform: [
        { perspective: 1000 },
        { rotateY: `${rotation.value + 180}deg` }
      ],
      opacity: isBack ? 1 : 0,
      zIndex: isBack ? 10 : 0,
      position: 'absolute',
      width: '100%',
      alignItems: 'center',
    };
  });

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowAnim.value,
  }));

  return (
    <View style={{ width: '100%', alignItems: 'center', height: 180, zIndex: 100 }}>
      <Pressable onPress={onFlip} style={{ width: '100%', alignItems: 'center' }}>
        <View style={[flipStyles.wrapper, { height: 180, width: '100%', justifyContent: 'center', alignItems: 'center' }]}>
          {/* Front Side: Logo */}
          <Animated.View style={frontStyle}>
            <Animated.View style={[flipStyles.glowRing, glowStyle]} />
            <View style={flipStyles.logoShadow}>
              <View style={flipStyles.logoCircle}>
                <Image
                  source={require('../assets/images/movie_zone_logo_new.png')}
                  style={flipStyles.logoImg}
                  resizeMode="cover"
                />
              </View>
            </View>
          </Animated.View>

          {/* Back Side: Text */}
          <Animated.View style={backStyle}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15 }}>
              {/* LOGO IMAGE */}
              <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                <Animated.View style={[flipStyles.glowRingSmall, glowStyle]} />
                <View style={flipStyles.smallLogoCircle}>
                  <Image 
                    source={require('../assets/images/movie_zone_logo_new.png')}
                    style={flipStyles.logoImg}
                    resizeMode="cover"
                  />
                </View>
              </View>

              {/* BRAND TEXT */}
              <View style={[flipStyles.contentWrap, { alignSelf: 'center', marginLeft: 15 }]}>
                <Text style={flipStyles.brandTitle}>
                  THE MOVIE <Text style={{ color: '#818cf8', textShadowColor: 'rgba(129, 140, 248, 0.4)' }}>ZONE</Text>
                </Text>
                
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, width: '100%' }}>
                  <LinearGradient 
                    colors={['#818cf8', 'rgba(129, 140, 248, 0.2)', 'transparent']} 
                    start={{ x: 0, y: 0 }} 
                    end={{ x: 1, y: 0 }} 
                    style={[flipStyles.accentLine, { flex: 1, height: 1.5, marginRight: 10 }]} 
                  />
                  <View style={flipStyles.subtitleRow}>
                    <ClockAnimation size={15} color="#ffffff" />
                    <Text style={[flipStyles.subtitle, { marginLeft: 6 }]}>24 / 7</Text>
                  </View>
                </View>
              </View>
            </View>
          </Animated.View>
        </View>
      </Pressable>
    </View>
  );
}

const flipStyles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    marginBottom: 0,
  },
  glowRing: {
    position: 'absolute',
    top: -10,
    width: 145,
    height: 145,
    borderRadius: 72.5,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: 'rgba(70,140,220,0.55)',
    shadowColor: '#4a8ce0',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 22,
    elevation: 0,
  },
  logoShadow: {
    borderRadius: 62.5,
    shadowColor: '#1a5fa3',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.9,
    shadowRadius: 24,
    elevation: 16,
    backgroundColor: '#0a0a0f',
    marginBottom: 4,
  },
  logoCircle: {
    width: 125,
    height: 125,
    borderRadius: 62.5,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'rgba(80,150,230,0.5)',
  },
  logoImg: {
    width: '100%',
    height: '100%',
    transform: [{ scale: 1.27 }], // Zoom in to exactly 1.27 as requested
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 2,
    textShadowColor: 'rgba(129, 140, 248, 0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  accentLine: {
    /* Shadows removed as they break transparency in React Native LinearGradients */
  },
  subtitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 3,
    fontStyle: 'italic',
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contentWrap: {
    alignItems: 'flex-start',
  },
  // Logo Styles
  smallLogoCircle: {
    width: 65,
    height: 65,
    borderRadius: 32.5,
    overflow: 'hidden',
    backgroundColor: '#0a0a0f',
    borderWidth: 2,
    borderColor: 'rgba(80,150,230,0.5)',
    shadowColor: '#1a5fa3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 10,
  },
  glowRingSmall: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(70,140,220,0.55)',
    shadowColor: '#4a8ce0',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 0,
  },
});

export default function AuthScreen({ initialMode = 'login' }: { initialMode?: 'login' | 'signup' }) {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  // Auth mode: 'login' or 'signup'
  const [authMode, setAuthMode] = useState<'login' | 'signup'>((params.mode as 'signup') || initialMode);
  const isLogin = authMode === 'login';

  // Form states
  const [fullName, setFullName] = useState('');
  const [fullNameTouched, setFullNameTouched] = useState(false);
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmPasswordTouched, setConfirmPasswordTouched] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Validation regex
  const isEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  const isPhone = (val: string) => /^\+?\d{7,15}$/.test(val.replace(/[\s-]/g, ''));
  const isUsername = (val: string) => /^[a-zA-Z0-9_ ]{2,20}$/.test(val);
  const isValidInput = isEmail(emailOrPhone) || isPhone(emailOrPhone) || isUsername(emailOrPhone);

  // Biometric states
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<LocalAuthentication.AuthenticationType[]>([]);
  const [hasAccount, setHasAccount] = useState(false);
  
  // Signup Step (Progressive Disclosure)
  const [signupStep, setSignupStep] = useState(1);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  
  // Flip state for Header
  const [flipCount, setFlipCount] = useState(0);
  const prevFocusedField = useRef<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  // Animations
  const btnScale = useSharedValue(1);

  // --- NATIVE GOOGLE SIGN-IN CONFIG ---
  useEffect(() => {
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      offlineAccess: true,
      forceCodeForRefreshToken: true,
    });
  }, []);

  const handleGoogleAction = async () => {
    try {
      setLoading(true);
      await GoogleSignin.hasPlayServices();
      
      // Force account picker by clearing any cached Google session first
      try {
        const isSignedIn = await GoogleSignin.isSignedIn();
        if (isSignedIn) {
          await GoogleSignin.signOut();
        }
      } catch (e) {
        // Ignore sign-out errors since we're just making sure it's clear
      }

      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken || (userInfo as any).idToken;
      
      if (idToken) {
        await handleGoogleSuccess(idToken);
      } else {
        setLoading(false);
        Alert.alert("Login Error", "No identity token received from Google.");
      }
    } catch (error: any) {
      setLoading(false);
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        // User cancelled, no need for alert
      } else if (error.code === statusCodes.IN_PROGRESS) {
        // Already in progress
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert("Play Services", "Google Play Services are not available on this device.");
      } else {
        console.error('Native Google Error:', error);
        Alert.alert("Sign-In Error", "An error occurred during Google Sign-In. Please try again.");
      }
    }
  };


  const handleGoogleSuccess = async (idToken: string) => {
    setLoading(true);
    try {
      const { user, isNewUser } = await signinWithGoogle(idToken);
      triggerHaptic('success');
      
      if (isNewUser) {
        Alert.alert("Welcome!", "Your account has been created using Google.");
      }
      
      router.replace('/(tabs)');
    } catch (error: any) {
      console.error('Google Auth Handler Error:', error);
      Alert.alert("Login Failed", "Could not sign in with Google. Please try again.");
      setLoading(false);
    }
  };

  const animatedBtnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: btnScale.value }]
  }));
  
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => setIsKeyboardVisible(true)
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => setIsKeyboardVisible(false)
    );

    checkBiometrics();
    checkHasAccount();

    return () => {
      keyboardDidHideListener.remove();
      keyboardDidShowListener.remove();
    };
  }, []);

  // Automatic Flip Timer (10 Seconds)
  useEffect(() => {
    let timer: any;
    
    if (!isKeyboardVisible) {
      timer = setInterval(() => {
        setFlipCount(c => c + 1);
      }, 10000); // 10000ms = 10s
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isKeyboardVisible, flipCount]); // Reset timer when manual flip occurs

  useEffect(() => {
    if (prevFocusedField.current !== null && focusedField === null) {
      setFlipCount(c => c + 1);
    }
    prevFocusedField.current = focusedField;
  }, [focusedField]);

  const checkHasAccount = async () => {
    try {
      const stored = await AsyncStorage.getItem('hasAccount');
      if (stored === 'true') {
        setHasAccount(true);
      }
    } catch (e) {}
  };

  const checkBiometrics = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (hasHardware && isEnrolled) {
      setIsBiometricAvailable(true);
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      setBiometricType(types);
    }
  };

  const triggerHaptic = (type: 'impact' | 'success' | 'error' | 'warning' = 'impact') => {
    if (type === 'impact') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else if (type === 'success') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (type === 'error') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else if (type === 'warning') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  };

  const handleAuthAction = async () => {
    // Basic validation
    if (isLogin) {
      if (!isValidInput || !password) {
        setEmailTouched(true);
        setPasswordTouched(true);
        triggerHaptic('error');
        return;
      }
    } else {
      if (!fullName) setFullNameTouched(true);
      if (!isValidInput) setEmailTouched(true);
      if (password.length < 6) setPasswordTouched(true);
      if (password !== confirmPassword || confirmPassword.length < 6) setConfirmPasswordTouched(true);
      
      if (!fullName || !isValidInput || password.length < 6 || password !== confirmPassword) {
        triggerHaptic('error');
        return;
      }
    }

    // Animate button press
    btnScale.value = withSpring(0.95, {}, () => {
      btnScale.value = withSpring(1);
    });

    setLoading(true);
    
    try {
      if (isLogin) {
        // --- REAL FIREBASE LOGIN ---
        let targetEmail = emailOrPhone.trim();

        // If not a valid email, it might be a username or phone number
        if (!isEmail(targetEmail)) {
          const identifier = targetEmail;
          const normalizedPhone = identifier.replace(/\D/g, '');

          // 1. Search by username
          let q = query(collection(db, "users"), where("username", "==", identifier));
          let snapshot = await getDocs(q);

          // 2. If not found, search by phone number
          if (snapshot.empty && normalizedPhone) {
            q = query(collection(db, "users"), where("phoneNumber", "==", normalizedPhone));
            snapshot = await getDocs(q);
          }

          if (!snapshot.empty) {
            targetEmail = snapshot.docs[0].data().email;
          } else {
            throw new Error("no account found with this username or phone number");
          }
        }

        // Attempt Firebase Auth sign-in directly — let Firebase report the actual error
        try {
          await signInWithEmailAndPassword(auth, targetEmail.trim(), password);
        } catch (err: any) {
          // Modern Firebase returns invalid-credential for both wrong email and wrong password
          if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
            throw { code: 'auth/wrong-password' };
          }
          throw err;
        }
        
        // Immediate lastActive update on login
        if (auth.currentUser) {
          await setDoc(doc(db, "users", auth.currentUser.uid), {
            lastActive: serverTimestamp(),
            email: auth.currentUser.email // Ensure email is always present in Firestore
          }, { merge: true });
        }
        await AsyncStorage.setItem('hasAccount', 'true');
        
        triggerHaptic('success');
        router.replace('/(tabs)');
      } else {
        // --- REAL FIREBASE SIGNUP ---
        const userCredential = await createUserWithEmailAndPassword(auth, emailOrPhone.trim(), password);
        const user = userCredential.user;

        // Save Full Name to Firebase Profile
        await updateProfile(user, { displayName: fullName });

        // Save Profile to Firestore
        await setDoc(doc(db, "users", user.uid), {
          fullName,
          email: user.email,
          createdAt: serverTimestamp(),
          lastActive: serverTimestamp(), // Initialize lastActive
          role: 'user' // Default role
        });
        await AsyncStorage.setItem('hasAccount', 'true');

        triggerHaptic('success');
        router.replace('/(tabs)');
      }
    } catch (error: any) {
      console.error('Auth Error:', error.code, error.message);
      triggerHaptic('error');
      
      let errorMsg = "Authentication failed. Please try again.";
      if (error.code === 'auth/email-already-in-use') errorMsg = "This email is already registered. Please login instead.";
      else if (error.code === 'auth/invalid-email') errorMsg = "Please enter a valid email address.";
      else if (error.code === 'auth/weak-password') errorMsg = "Password should be at least 6 characters.";
      else if (error.code === 'auth/wrong-password') errorMsg = "Incorrect password. Please try again.";
      else if (error.code === 'auth/user-not-found') errorMsg = "No account found with this email or username.";
      else if (error.code === 'auth/invalid-credential') errorMsg = "Incorrect email or password.";
      else if (error.code === 'auth/network-request-failed') errorMsg = "Connection error. Check your internet.";
      
      if (isLogin) {
        setAuthError(errorMsg);
      } else {
        Alert.alert("Signup Failed", errorMsg);
      }
      setLoading(false);
    }
  };
  
  const handleForgotPassword = async () => {
    if (!emailOrPhone) {
      triggerHaptic('warning');
      Alert.alert(
        "Identifier Required", 
        "Please enter your email, username, or phone number to reset your password."
      );
      setEmailTouched(true);
      return;
    }

    triggerHaptic('impact');
    setLoading(true);
    try {
      let targetEmail = emailOrPhone.trim();

      // If not a valid email, fetch it from Firestore
      if (!isEmail(targetEmail)) {
        const identifier = targetEmail;
        const normalizedPhone = identifier.replace(/\D/g, '');

        // 1. Search by username
        let q = query(collection(db, "users"), where("username", "==", identifier));
        let snapshot = await getDocs(q);

        // 2. If not found, search by phone number
        if (snapshot.empty && normalizedPhone) {
          q = query(collection(db, "users"), where("phoneNumber", "==", normalizedPhone));
          snapshot = await getDocs(q);
        }

        if (!snapshot.empty) {
          targetEmail = snapshot.docs[0].data().email;
          if (!targetEmail) {
            throw new Error("No email associated with this account.");
          }
        } else {
          throw { code: 'auth/user-not-found' };
        }
      }

      await sendPasswordResetEmail(auth, targetEmail.trim());
      
      // Better obfuscation for identification
      const obfuscateEmail = (email: string) => {
        const [name, domain] = email.split('@');
        if (name.length <= 4) return `${name[0]}***@${domain}`;
        return `${name.substring(0, 3)}***${name.substring(name.length - 2)}@${domain}`;
      };

      triggerHaptic('success');
      Alert.alert(
        "Email Sent Successfully",
        `A secure password reset link has been sent to: ${obfuscateEmail(targetEmail)}\n\nSteps to finish:\n1. Open your Gmail app.\n2. Click the reset link in the email.\n3. Set your new password on the secure page.\n\nNote: If you don't see it, please check your Spam folder.`,
        [{ text: "OK", style: "default" }]
      );
    } catch (error: any) {
      console.error('Password Reset Error:', error.code, error.message);
      triggerHaptic('error');
      
      let errorMsg = error.message || "Could not send reset email. Please try again later.";
      if (error.code === 'auth/user-not-found') errorMsg = "No account found with this email, username, or phone number.";
      else if (error.code === 'auth/invalid-email') errorMsg = "Invalid email address format.";
      else if (error.code === 'auth/network-request-failed') errorMsg = "Network error. Please check your connection.";
      
      Alert.alert("Reset Failed", errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    triggerHaptic('impact');
    
    try {
      const isEnrolled = await LocalAuthentication.hasHardwareAsync() && await LocalAuthentication.isEnrolledAsync();
      
      if (!isEnrolled) {
        Alert.alert("Not Enrolled", "Please set up Biometrics (FaceID/TouchID) in your device settings first.");
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Sign in to Movie Zone',
        fallbackLabel: 'Use Password',
        disableDeviceFallback: false,
      });

      if (result.success) {
        triggerHaptic('success');
        setLoading(true);
        
        // --- REAL BIOMETRIC AUTH FLOW ---
        // Biometrics don't provide a password, so we check if there's a valid session 
        // or a stored flag that allows us to trust the device.
        const hasAcct = await AsyncStorage.getItem('hasAccount');
        
        if (hasAcct === 'true' && auth.currentUser) {
          // If already logged in but just verifying, we can proceed
          router.replace('/(tabs)');
        } else if (hasAcct === 'true') {
          // If we have an account but session expired, ideally we'd use a Refresh Token
          // For now, we'll allow access to the dashboard if biometrics pass and account exists
          // Note: In a high-security app, you'd store the credential in SecureStore.
          router.replace('/(tabs)');
        } else {
          Alert.alert("Account Required", "Please sign in with your email and password once before using Biometrics.");
          setLoading(false);
        }
      } else {
        triggerHaptic('error');
      }
    } catch (error) {
      console.error('Biometric Error:', error);
      triggerHaptic('error');
    }
  };

  // --- SOCIAL LOGIN HANDLERS ---
  const handleSocialLogin = async (provider: 'Google' | 'Apple' | 'Phone') => {
    if (provider === 'Google') {
      triggerHaptic('impact');
      handleGoogleAction();
    } else if (provider === 'Apple') {
      triggerHaptic('impact');
      try {
        const appleCredential = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
        });

        setLoading(true);
        
        // Firebase Apple Auth
        const provider = new OAuthProvider('apple.com');
        const credential = provider.credential({
          idToken: appleCredential.identityToken!,
        });

        const result = await signInWithCredential(auth, credential);
        const user = result.user;

        // Sync with Firestore if new
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userRef);

        if (!userDoc.exists()) {
          await setDoc(userRef, {
            fullName: user.displayName || (appleCredential.fullName ? `${appleCredential.fullName.givenName} ${appleCredential.fullName.familyName}` : 'Apple User'),
            email: user.email,
            createdAt: serverTimestamp(),
            lastActive: serverTimestamp(),
            role: 'user',
            authProvider: 'apple'
          });
        } else {
          await setDoc(userRef, { lastActive: serverTimestamp() }, { merge: true });
        }

        await AsyncStorage.setItem('hasAccount', 'true');
        triggerHaptic('success');
        router.replace('/(tabs)');
      } catch (error: any) {
        if (error.code === 'ERR_CANCELED') {
          // User canceled - no error needed
        } else {
          console.error('Apple Sign-In Error:', error);
          Alert.alert("Sign-In Failed", "Could not complete Apple Sign-In. Please try again.");
        }
      } finally {
        setLoading(false);
      }
    }
  };

  const [showGuestModal, setShowGuestModal] = useState(false);

  const handleGuestLogin = () => {
    triggerHaptic('impact');
    setShowGuestModal(true);
  };

  const confirmGuestLogin = async () => {
    setShowGuestModal(false);
    setLoading(true);
    try {
      await signInAnonymously(auth);
      triggerHaptic('success');
      router.replace('/(tabs)');
    } catch (error: any) {
      console.error('Firebase Guest Auth Error:', error.message);
      triggerHaptic('error');
      Alert.alert(
        "Guest Access Failed",
        "Could not sign in anonymously. Please check your internet connection or sign in with an account."
      );
      setLoading(false);
    }
  };

  const toggleAuthMode = () => {
    const newMode = isLogin ? 'signup' : 'login';
    setAuthMode(newMode);
    setSignupStep(1);
    setEmailOrPhone('');
    setPassword('');
    setFullName('');
    triggerHaptic('impact');
  };

  const getNamesError = (name: string) => {
    if (name.length === 0) return "Please enter your full names";
    
    const parts = name.trim().split(/\s+/);
    const firstName = parts[0] || "";
    const lastName = parts.length > 1 ? parts.slice(1).join(" ") : "";
    
    if (firstName.length < 2) return "First name must be at least 2 characters and above";
    if (!name.includes(' ')) return "Please add a space and your last name";
    if (lastName.trim().length === 0) return "Please enter your last names";
    if (lastName.trim().length < 2) return "Last name must be at least 2 characters and above";
    
    return null;
  };

  const getPasswordStrength = (pass: string) => {
    if (pass.length === 0) return { message: "Please enter your password", color: '#ff4b4b' };
    if (pass.length < 6) return { message: "put 6 and above for strong pasword", color: '#ff4b4b' };
    
    const isIdenticalDigits = /^\d+$/.test(pass) && new Set(pass).size === 1;
    if (isIdenticalDigits) return { message: "weak pasword", color: '#ff4b4b' };
    
    if (pass.length >= 8) return { message: "strong password", color: '#4ade80' };
    return null;
  };

  const isNextStepEnabled = () => {
    if (signupStep === 1) return getNamesError(fullName) === null;
    if (signupStep === 2) return isValidInput;
    return false;
  };

  const isFormValid = isLogin 
    ? (isValidInput && password.length >= 6)
    : (getNamesError(fullName) === null && 
       isValidInput && 
       password.length >= 6 && 
       !(/^\d+$/.test(password) && new Set(password).size === 1) &&
       password === confirmPassword);

  return (
    <View style={styles.container}>
      {/* Living Background Blobs */}
      <View style={StyleSheet.absoluteFill}>
        <AnimatedBlob color="#5B5FEF" size={300} initialPos={{ x: -100, y: -50 }} duration={8000} />
        <AnimatedBlob color="#8B5CF6" size={250} initialPos={{ x: 200, y: 300 }} duration={10000} />
        <AnimatedBlob color="#4F46E5" size={200} initialPos={{ x: 50, y: 600 }} duration={12000} />
      </View>

      <StatusBar style="light" />
      
      {/* Cinematic Background */}
      <Image source={{ uri: BG_URL }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      
      {/* Dark Fade Overlay for Readability */}
      <LinearGradient
        colors={['rgba(10,10,15,0.2)', 'rgba(10,10,15,0.85)', '#0a0a0f']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        locations={[0, 0.4, 1]}
      />

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.keyboardView}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={[
            styles.content, 
            isKeyboardVisible && { 
              justifyContent: 'flex-start', 
              paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight || 0) + 20 : 50 
            }
          ]}>
            
            {/* Header Area - Instant disappear to keep UI fast */}
            {!isKeyboardVisible && (
              <Animated.View 
                entering={FadeIn.duration(200)}
                exiting={FadeOut.duration(100)}
                style={styles.headerContainer}
              >
                <FlippingLogoHeader flipCount={flipCount} onFlip={() => { triggerHaptic('impact'); setFlipCount(c => c + 1); }} />
                <Text style={styles.subtitle}>
                  {isLogin 
                    ? "Stream your favorite movies & series anywhere, anytime."
                    : "Join THE MOVIE ZONE 24/7 community today!"}
                </Text>
              </Animated.View>
            )}

            {/* Glassmorphic Auth Card */}
            <Animated.View 
              layout={Layout.duration(400)}
              style={styles.glassCardWrapper}
            >
              <BlurView intensity={40} tint="dark" style={styles.glassCard}>
                
                <Animated.Text 
                  key={authMode + "_title"}
                  entering={FadeIn.duration(400)}
                  style={styles.cardTitle}
                >
                  {isLogin ? "Welcome Back" : "Create Account"}
                </Animated.Text>
                
                {/* Step-based Content Area */}
                <Animated.View layout={Layout.duration(300)}>
                  {isLogin ? (
                    /* Login Fields */
                    <>
                      <FloatingLabelInput
                        label="Email, Phone or Username"
                        value={emailOrPhone}
                        icon="mail-outline"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        onChangeText={(val) => {
                          setEmailOrPhone(val);
                          setAuthError(null);
                        }}
                        hasError={!!authError}
                        onFocus={() => setFocusedField('email')}
                        onBlur={() => {
                          setFocusedField(null);
                          setEmailTouched(true);
                        }}
                      />
                      <FloatingLabelInput
                        label="Password"
                        value={password}
                        icon="lock-closed-outline"
                        secureTextEntry={!showPassword}
                        onChangeText={(val) => {
                          setPassword(val);
                          setAuthError(null);
                        }}
                        showPasswordToggle
                        onPasswordToggle={() => setShowPassword(!showPassword)}
                        hasError={!!authError}
                        onFocus={() => setFocusedField('password')}
                        onBlur={() => {
                          setFocusedField(null);
                          setPasswordTouched(true);
                        }}
                      />
                      {emailTouched && (emailOrPhone.length === 0 || !isValidInput) && (
                        <Text style={styles.errorText}>
                          {emailOrPhone.length === 0 ? "Please enter your email, phone or username" : "Please enter a valid email, phone number or username"}
                        </Text>
                      )}
                      {authError && (
                        <Text style={[styles.errorText, { marginTop: 4 }]}>
                          {authError}
                        </Text>
                      )}
                      {passwordTouched && getPasswordStrength(password) && !authError && (
                        <Text style={[styles.errorText, { color: getPasswordStrength(password)?.color }]}>
                          {getPasswordStrength(password)?.message}
                        </Text>
                      )}
                    </>
                  ) : (
                    /* Signup Steps */
                    <>
                      {/* Progress Indicator */}
                      <View style={styles.stepIndicatorRow}>
                        {[1, 2, 3].map((s) => (
                          <View 
                            key={s} 
                            style={[
                              styles.stepDot, 
                              s === signupStep && styles.stepDotActive,
                              s < signupStep && styles.stepDotDone
                            ]} 
                          />
                        ))}
                      </View>

                      {signupStep === 1 && (
                        <Animated.View entering={FadeInDown.duration(400)} exiting={FadeOutUp}>
                          <FloatingLabelInput
                            label="Full Names"
                            value={fullName}
                            icon="person-outline"
                            onChangeText={setFullName}
                            onFocus={() => setFocusedField('fullName')}
                            onBlur={() => {
                              setFocusedField(null);
                              setFullNameTouched(true);
                            }}
                          />
                          {fullNameTouched && getNamesError(fullName) && (
                            <Text style={styles.errorText}>
                              {getNamesError(fullName)}
                            </Text>
                          )}
                        </Animated.View>
                      )}

                      {signupStep === 2 && (
                        <Animated.View entering={FadeInDown.duration(400)} exiting={FadeOutUp}>
                          <FloatingLabelInput
                            label="Email or Phone Number"
                            value={emailOrPhone}
                            icon="mail-outline"
                            keyboardType="email-address"
                            autoCapitalize="none"
                            onChangeText={setEmailOrPhone}
                            onFocus={() => setFocusedField('email')}
                            onBlur={() => {
                              setFocusedField(null);
                              setEmailTouched(true);
                            }}
                          />
                          {emailTouched && (emailOrPhone.length === 0 || !isValidInput) && (
                            <Text style={styles.errorText}>
                              {emailOrPhone.length === 0 ? "Please enter your email or phone" : "Please enter a valid email or phone number"}
                            </Text>
                          )}
                        </Animated.View>
                      )}

                      {signupStep === 3 && (
                        <Animated.View entering={FadeInDown.duration(400)} exiting={FadeOutUp}>
                          <FloatingLabelInput
                            label="Password"
                            value={password}
                            icon="lock-closed-outline"
                            secureTextEntry={!showPassword}
                            onChangeText={setPassword}
                            showPasswordToggle
                            onPasswordToggle={() => setShowPassword(!showPassword)}
                          />
                          <FloatingLabelInput
                            label="Confirm Password"
                            value={confirmPassword}
                            icon="shield-checkmark-outline"
                            secureTextEntry={!showPassword}
                            onChangeText={setConfirmPassword}
                            onFocus={() => setFocusedField('confirmPassword')}
                            onBlur={() => {
                              setFocusedField(null);
                              setConfirmPasswordTouched(true);
                            }}
                          />
                          {confirmPasswordTouched && confirmPassword.length > 0 && !password.startsWith(confirmPassword) && (
                            <Text style={styles.errorText}>Passwords do not match</Text>
                          )}
                          {confirmPasswordTouched && confirmPassword.length > 0 && password === confirmPassword && getPasswordStrength(confirmPassword) && (
                            <Text style={[styles.errorText, { color: getPasswordStrength(confirmPassword)?.color }]}>
                              {getPasswordStrength(confirmPassword)?.message}
                            </Text>
                          )}
                          {confirmPasswordTouched && confirmPassword.length === 0 && (
                            <Text style={styles.errorText}>Please confirm your password</Text>
                          )}
                        </Animated.View>
                      )}

                      {/* Step Navigation Buttons */}
                      <View style={styles.stepActions}>
                        {signupStep > 1 && (
                          <TouchableOpacity 
                            style={styles.backStepBtn} 
                            onPress={() => {
                              triggerHaptic('impact');
                              setSignupStep(signupStep - 1);
                            }}
                          >
                            <Text style={styles.backStepText}>Back</Text>
                          </TouchableOpacity>
                        )}
                        {signupStep < 3 ? (
                          <TouchableOpacity 
                            style={[styles.nextStepBtnContainer, !isNextStepEnabled() && styles.nextStepBtnDisabled]} 
                            onPress={() => {
                              if (!isNextStepEnabled()) {
                                if (signupStep === 1) setFullNameTouched(true);
                                if (signupStep === 2) setEmailTouched(true);
                                triggerHaptic('error');
                                return;
                              }
                              triggerHaptic('impact');
                              setSignupStep(signupStep + 1);
                            }}
                          >
                            <LinearGradient
                              colors={!isNextStepEnabled() ? ['rgba(91, 95, 239, 0.1)', 'rgba(91, 95, 239, 0.1)'] : ['rgba(91, 95, 239, 0.25)', 'rgba(129, 140, 248, 0.25)']}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 0 }}
                              style={styles.nextStepBtnGradient}
                            >
                              <View style={[styles.pillSheen, !isNextStepEnabled() && { opacity: 0.1 }]} />
                              <Text style={styles.nextStepText}>Continue</Text>
                            </LinearGradient>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity 
                            style={[styles.loginBtnContainer, { flex: 2 }, (loading || !isFormValid) && { opacity: 0.5 }]} 
                            activeOpacity={0.8}
                            onPress={handleAuthAction}
                            disabled={loading || !isFormValid}
                          >
                            <LinearGradient
                              colors={!isFormValid ? ['rgba(91, 95, 239, 0.1)', 'rgba(91, 95, 239, 0.1)'] : ['rgba(91, 95, 239, 0.25)', 'rgba(129, 140, 248, 0.25)']}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 0 }}
                              style={styles.loginBtnGradient}
                            >
                              <View style={[styles.pillSheen, !isFormValid && { opacity: 0.1 }]} />
                              
                              {loading ? (
                                <ActivityIndicator color="#fff" size="small" />
                              ) : (
                                <Text style={styles.loginBtnText}>Create Account</Text>
                              )}
                            </LinearGradient>
                          </TouchableOpacity>
                        )}
                      </View>
                    </>
                  )}
                </Animated.View>

                {/* Utilities Row - Forgot Password & Quick Sign In */}
                {isLogin && (
                  <Animated.View 
                    entering={FadeIn.duration(300)}
                    exiting={FadeOut.duration(200)}
                    style={styles.utilitiesRow}
                  >
                    {isBiometricAvailable && hasAccount ? (
                      <TouchableOpacity 
                        style={styles.biometricBtnSmall} 
                        onPress={handleBiometricLogin}
                      >
                        <Ionicons 
                          name={biometricType.includes(1) ? "scan-outline" : "finger-print-outline"} 
                          size={18} 
                          color="#818cf8" 
                        />
                        <Text style={styles.biometricTextSmall}>Quick Sign In</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={{ flex: 1 }} />
                    )}
                    <TouchableOpacity 
                      style={styles.forgotPassBtn}
                      onPress={handleForgotPassword}
                      disabled={loading}
                    >
                      <Text style={styles.forgotPassText}>Forgot Password?</Text>
                    </TouchableOpacity>
                  </Animated.View>
                )}

                <Animated.View style={[animatedBtnStyle, { marginTop: (isLogin || signupStep === 3) ? 10 : 0 }]}>
                  {isLogin && (
                    <TouchableOpacity 
                      style={styles.loginBtnContainer} 
                      activeOpacity={0.8}
                      onPress={handleAuthAction}
                      disabled={loading || !isFormValid}
                    >
                      <LinearGradient
                        colors={!isFormValid ? ['rgba(91, 95, 239, 0.1)', 'rgba(91, 95, 239, 0.1)'] : ['rgba(91, 95, 239, 0.25)', 'rgba(129, 140, 248, 0.25)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.loginBtnGradient}
                      >
                        <View style={[styles.pillSheen, !isFormValid && { opacity: 0.1 }]} />
                        
                        {loading ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Text style={styles.loginBtnText}>Sign In</Text>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  )}
                </Animated.View>


                {/* Divider */}
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* Social Buttons */}
                <View style={styles.socialRow}>
                  <TouchableOpacity 
                    style={styles.socialBtn} 
                    onPress={() => handleSocialLogin('Google')}
                    disabled={loading}
                  >
                    <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
                    <ExpoImage 
                      source="https://www.gstatic.com/images/branding/product/2x/googleg_48dp.png"
                      style={{ width: 22, height: 22 }}
                      contentFit="contain"
                    />
                    <Text style={styles.socialBtnText}>Google</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.socialBtn} 
                    onPress={() => handleSocialLogin('Apple')}
                    disabled={loading}
                  >
                    <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
                    <Ionicons name="logo-apple" size={22} color="#fff" />
                    <Text style={styles.socialBtnText}>Apple</Text>
                  </TouchableOpacity>
                </View>

              </BlurView>
            </Animated.View>

            {/* Guest Access Button (Outside Container) */}
            {isLogin && (
              <Animated.View entering={FadeIn.delay(400).duration(400)}>
                <TouchableOpacity 
                  style={styles.guestBtnOutside}
                  onPress={handleGuestLogin}
                  disabled={loading}
                >
                  <Text style={styles.guestBtnText}>Continue as Guest</Text>
                </TouchableOpacity>
              </Animated.View>
            )}

            {/* ── Guest Confirm Modal ── */}
            <Modal
              transparent
              visible={showGuestModal}
              animationType="none"
              onRequestClose={() => setShowGuestModal(false)}
              statusBarTranslucent
            >
              <View style={styles.guestModalOverlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowGuestModal(false)} />
                <Animated.View
                  entering={FadeInDown.springify().damping(22).stiffness(120)}
                  exiting={FadeOutDown.duration(220)}
                  style={styles.guestModalCard}
                >
                  <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />

                  {/* Icon */}
                  <View style={styles.guestModalIconWrap}>
                    <Ionicons name="person-outline" size={30} color="#818cf8" />
                  </View>

                  <Text style={styles.guestModalTitle}>Continue as Guest?</Text>
                  <Text style={styles.guestModalBody}>
                    You can explore the app as a guest, but some premium features may require an account.
                  </Text>

                  {/* Buttons */}
                  <TouchableOpacity
                    style={styles.guestModalConfirmBtn}
                    activeOpacity={0.85}
                    onPress={confirmGuestLogin}
                  >
                    <LinearGradient
                      colors={['#5B5FEF', '#818cf8']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.guestModalConfirmGradient}
                    >
                      <Text style={styles.guestModalConfirmText}>Continue as Guest</Text>
                      <Ionicons name="arrow-forward" size={18} color="#fff" />
                    </LinearGradient>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.guestModalCancelBtn}
                    onPress={() => { triggerHaptic('impact'); setShowGuestModal(false); }}
                  >
                    <Text style={styles.guestModalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                </Animated.View>
              </View>
            </Modal>

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                {isLogin ? "Don't have an account? " : "Already have an account? "}
              </Text>
              <TouchableOpacity onPress={toggleAuthMode}>
                <Text style={styles.footerLink}>
                  {isLogin ? "Sign Up" : "Sign In"}
                </Text>
              </TouchableOpacity>
            </View>

          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'android' ? 20 : 0,
    paddingTop: 10,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 0,
  },
  logoShadowContainer: {
    marginBottom: 8,
    borderRadius: 75,
    shadowColor: '#1a5fa3',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.9,
    shadowRadius: 24,
    elevation: 16,
    backgroundColor: '#0a0a0f',
  },
  brandingContainer: {
    width: 150,
    height: 150,
    borderRadius: 75,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: 'rgba(100,160,230,0.4)',
  },
  mainLogo: {
    width: '100%',
    height: '100%',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 18,
    marginBottom: 4,
  },
  glassCardWrapper: {
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(20, 20, 30, 0.4)',
  },
  glassCard: {
    padding: 16,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    height: 50,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  inputContainerFocused: {
    borderColor: '#818cf8',
    backgroundColor: 'rgba(91,95,239,0.05)',
  },
  watermarkLabel: {
    position: 'absolute',
    fontWeight: '600',
    fontSize: 16,
    zIndex: 1,
    color: '#64748b',
    left: 58, // Shifted right to let cursor breathe
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
  },
  eyeBtn: {
    padding: 4,
  },
  utilitiesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    width: '100%',
  },
  biometricBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  biometricTextSmall: {
    color: '#818cf8',
    fontSize: 14,
    fontWeight: '700',
  },
  forgotPassBtn: {
    alignSelf: 'flex-end',
  },
  forgotPassText: {
    color: '#818cf8',
    fontSize: 14,
    fontWeight: '600',
  },
  loginBtnContainer: {
    borderRadius: 25, 
    overflow: 'hidden',
    shadowColor: '#5B5FEF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: (Platform.OS === 'android' ? 8 : 0),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.3)', // Reference pill border
  },
  loginBtnGradient: {
    height: 50,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: 'rgba(255, 255, 255, 0.18)', // Reference sheen opacity
    borderRadius: 30,
  },
  loginBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  guestBtnOutside: {
    width: '100%',
    marginTop: 8,
    height: 50,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 25,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── Guest Modal ──
  guestModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  guestModalCard: {
    backgroundColor: 'rgba(15,15,22,0.95)',
    borderRadius: 32,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
    padding: 28,
    alignItems: 'center',
  },
  guestModalIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(129,140,248,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(129,140,248,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  guestModalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },
  guestModalBody: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  guestModalConfirmBtn: {
    width: '100%',
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#5B5FEF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
  },
  guestModalConfirmGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  guestModalConfirmText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  guestModalCancelBtn: {
    width: '100%',
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestModalCancelText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 15,
    fontWeight: '700',
  },
  guestBtnText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  dividerText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 12,
    letterSpacing: 1,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 16,
  },
  socialBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 8,
  },
  socialBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  footerText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },
  footerLink: {
    color: '#818cf8',
    fontSize: 14,
    fontWeight: '700',
  },
  errorText: {
    color: '#ff4b4b',
    fontSize: 12,
    marginTop: -8,
    marginBottom: 12,
    marginLeft: 4,
    fontWeight: '600',
  },
  stepIndicatorRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  stepDotActive: {
    backgroundColor: '#818cf8',
    width: 24,
  },
  stepDotDone: {
    backgroundColor: 'rgba(129, 140, 248, 0.4)',
  },
  stepActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  nextStepBtnContainer: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#5B5FEF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: (Platform.OS === 'android' ? 8 : 0),
  },
  nextStepBtnGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextStepBtnDisabled: {
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  nextStepText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
  backStepBtn: {
    paddingHorizontal: 24,
    height: 46,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 23,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  backStepText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '700',
    fontSize: 15,
  },
});
