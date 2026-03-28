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
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updateProfile 
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import Animated, { 
  FadeInDown, 
  FadeOutUp, 
  Layout, 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring,
  withTiming,
  FadeIn,
  FadeOut,
  interpolate,
  interpolateColor,
  Easing,
  withRepeat
} from 'react-native-reanimated';

// Background image (dark sci-fi / cinematic vibe)
const BG_URL = 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&q=80&w=1000';

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
  onPasswordToggle
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
      style={[styles.inputContainer, isFocused && styles.inputContainerFocused]}
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
  const isValidInput = isEmail(emailOrPhone) || isPhone(emailOrPhone);

  // Biometric states
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<LocalAuthentication.AuthenticationType[]>([]);
  
  // Signup Step (Progressive Disclosure)
  const [signupStep, setSignupStep] = useState(1);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Animations
  const btnScale = useSharedValue(1);

  const animatedBtnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: btnScale.value }]
  }));
  
  useEffect(() => {
    checkBiometrics();

    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => setIsKeyboardVisible(true)
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => setIsKeyboardVisible(false)
    );

    return () => {
      keyboardDidHideListener.remove();
      keyboardDidShowListener.remove();
    };
  }, []);

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
        await signInWithEmailAndPassword(auth, emailOrPhone.trim(), password);
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
          role: 'user' // Default role
        });

        triggerHaptic('success');
        router.replace('/(tabs)');
      }
    } catch (error: any) {
      console.error('Auth Error:', error.code, error.message);
      triggerHaptic('error');
      
      let errorMsg = error.message.replace("Firebase: ", "") || "Authentication failed";
      if (error.code === 'auth/email-already-in-use') errorMsg = "Email already in use";
      else if (error.code === 'auth/invalid-email') errorMsg = "Invalid email address";
      else if (error.code === 'auth/weak-password') errorMsg = "Password is too weak";
      else if (error.code === 'auth/wrong-password') errorMsg = "Incorrect password";
      else if (error.code === 'auth/user-not-found') errorMsg = "No account with this email";
      else if (error.code === 'auth/network-request-failed') errorMsg = "Network error. Please check your connection.";
      
      alert(errorMsg);
      setLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    triggerHaptic('impact');
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Sign in to Movie Zone',
      fallbackLabel: 'Use Password',
    });

    if (result.success) {
      triggerHaptic('success');
      setLoading(true);
      // Simulate quick auth
      setTimeout(async () => {
        await AsyncStorage.setItem('userToken', 'mock-biometric-token');
        router.replace('/(tabs)');
      }, 500);
    } else {
      triggerHaptic('error');
    }
  };

  const handleSocialLogin = (provider: string) => {
    setLoading(true);
    setTimeout(async () => {
      try {
        await AsyncStorage.setItem('userToken', `mock-${provider.toLowerCase()}-token`);
        router.replace('/(tabs)');
      } catch (e) {
        setLoading(false);
      }
    }, 2000);
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
    
    if (firstName.length < 3) return "First name must be atleast 3 characters and above";
    if (!name.includes(' ')) return "Please add a space and your last name";
    if (lastName.trim().length === 0) return "Please enter your last names";
    if (lastName.trim().length < 3) return "Last name must be atleast 3 characters and above";
    
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
            
            {/* Header Area - Constant during transition, hidden on keyboard */}
            {!isKeyboardVisible && (
              <Animated.View 
                entering={FadeIn.duration(300)} 
                exiting={FadeOut.duration(300)}
                style={styles.headerContainer}
              >
                <View style={styles.logoShadowContainer}>
                  <View style={styles.brandingContainer}>
                    <Image 
                      source={require('../assets/images/movie_zone_logo.jpg')}
                      style={[styles.mainLogo, { transform: [{ scale: 1.15 }] }]}
                      resizeMode="cover"
                    />
                  </View>
                </View>
                <Text style={styles.subtitle}>
                  {isLogin 
                    ? "Stream your favorite movies & series anywhere, anytime."
                    : "Join the Movie Zone 24/7 community today!"}
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
                      <FloatingLabelInput
                        label="Password"
                        value={password}
                        icon="lock-closed-outline"
                        secureTextEntry={!showPassword}
                        onChangeText={setPassword}
                        showPasswordToggle
                        onPasswordToggle={() => setShowPassword(!showPassword)}
                        onFocus={() => setFocusedField('password')}
                        onBlur={() => {
                          setFocusedField(null);
                          setPasswordTouched(true);
                        }}
                      />
                      {emailTouched && (emailOrPhone.length === 0 || !isValidInput) && (
                        <Text style={styles.errorText}>
                          {emailOrPhone.length === 0 ? "Please enter your email or phone" : "Please enter a valid email or phone number"}
                        </Text>
                      )}
                      {passwordTouched && getPasswordStrength(password) && (
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
                                if (signupStep === 2) setEmailTouched(true); // Assuming I add this for consistency
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
                              {/* Premium Sheen Pill Effect */}
                              <View style={[styles.pillSheen, !isNextStepEnabled() && { opacity: 0.1 }]} />
                              <Text style={styles.nextStepText}>Continue</Text>
                            </LinearGradient>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </>
                  )}
                </Animated.View>

                {/* Forgot Password - Only for Login */}
                {isLogin && (
                  <Animated.View 
                    entering={FadeIn.duration(300)}
                    exiting={FadeOut.duration(200)}
                  >
                    <TouchableOpacity style={styles.forgotPassBtn}>
                      <Text style={styles.forgotPassText}>Forgot Password?</Text>
                    </TouchableOpacity>
                  </Animated.View>
                )}

                {/* Auth Button */}
                <Animated.View style={[animatedBtnStyle, { marginTop: (isLogin || signupStep === 3) ? 10 : 0 }]}>
                  {(isLogin || signupStep === 3) && (
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
                        {/* Premium Sheen Pill Effect */}
                        <View style={[styles.pillSheen, !isFormValid && { opacity: 0.1 }]} />
                        
                        {loading ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Text style={styles.loginBtnText}>
                            {isLogin ? "Sign In" : "Create Account"}
                          </Text>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  )}
                </Animated.View>

                {/* Biometric Button */}
                {isLogin && isBiometricAvailable && (
                  <TouchableOpacity 
                    style={styles.biometricBtn} 
                    onPress={handleBiometricLogin}
                  >
                    <Ionicons 
                      name={biometricType.includes(1) ? "scan-outline" : "finger-print-outline"} 
                      size={28} 
                      color="#818cf8" 
                    />
                    <Text style={styles.biometricText}>Quick Sign In</Text>
                  </TouchableOpacity>
                )}

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
    paddingTop: 30,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 15,
  },
  logoShadowContainer: {
    marginBottom: 8,
    borderRadius: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.8,
    shadowRadius: 16,
    elevation: 10,
    backgroundColor: '#0a0a0f',
  },
  brandingContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
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
    height: 36, // Fixed height to avoid jumps
  },
  glassCardWrapper: {
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(20, 20, 30, 0.4)',
  },
  glassCard: {
    padding: 20,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    height: 48,
    paddingHorizontal: 16,
    marginBottom: 10,
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
  forgotPassBtn: {
    alignSelf: 'flex-end',
    marginBottom: 16,
  },
  forgotPassText: {
    color: '#818cf8',
    fontSize: 14,
    fontWeight: '600',
  },
  loginBtnContainer: {
    borderRadius: 30, 
    overflow: 'hidden',
    shadowColor: '#5B5FEF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: (Platform.OS === 'android' ? 8 : 0),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)', // Reference pill border
  },
  loginBtnGradient: {
    height: 46,
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
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
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
    height: 46,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
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
    marginTop: 16,
    marginBottom: 44,
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
  biometricBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    gap: 10,
  },
  biometricText: {
    color: '#818cf8',
    fontSize: 14,
    fontWeight: '700',
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
    borderWidth: 1,
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
    borderWidth: 1,
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
