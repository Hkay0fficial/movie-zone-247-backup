import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Image, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../constants/firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withDelay, 
  withSpring, 
  withTiming, 
  withSequence,
  withRepeat,
  FadeIn,
} from 'react-native-reanimated';
import ClockAnimation from '../components/ClockAnimation';
import OnboardingFlow from '../components/OnboardingFlow';

const { width } = Dimensions.get('window');

export default function Index() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Animation values
  const containerFade = useSharedValue(0);
  const rotation = useSharedValue(0);
  const contentScale = useSharedValue(0.9);
  const glowAnim = useSharedValue(0);

  useEffect(() => {
    checkOnboarding();
    
    // Entrance Animations
    containerFade.value = withTiming(1, { duration: 1000 });
    contentScale.value = withSpring(1, { damping: 12 });

    rotation.value = withDelay(
      1500,
      withSpring(180, { damping: 15, stiffness: 60 })
    );
    
    glowAnim.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1200 }),
        withTiming(0.3, { duration: 1200 })
      ),
      -1,
      true
    );
  }, []);

  const checkOnboarding = async () => {
    try {
      const hasSeen = await AsyncStorage.getItem('hasSeenOnboarding');
      setShowOnboarding(hasSeen !== 'true');
    } catch (e) {
      setShowOnboarding(false);
    }
  };

  useEffect(() => {
    if (showOnboarding === null) return;

    // Authentication & Navigation
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      // If we have a deep link intent (movieId), shorten the splash delay
      const hasIntent = params.movieId || params.autoplay;
      const delay = hasIntent ? 1500 : 5000;

      const timer = setTimeout(() => {
        if (showOnboarding) {
          setIsReady(true);
        } else {
          if (user) {
            router.replace({
              pathname: '/(tabs)',
              params: params // Pass through notification params
            });
          } else {
            router.replace('/login');
          }
        }
      }, delay);
      
      return () => clearTimeout(timer);
    });
    
    return () => unsubscribe();
  }, [showOnboarding, params]);

  const handleOnboardingComplete = async () => {
    await AsyncStorage.setItem('hasSeenOnboarding', 'true');
    setShowOnboarding(false);
    
    // After onboarding, check auth and navigate
    if (auth.currentUser) {
      router.replace('/(tabs)');
    } else {
      router.replace('/login');
    }
  };

  const frontStyle = useAnimatedStyle(() => {
    const isFrontVisible = rotation.value < 90;
    return {
      transform: [
        { perspective: 1000 },
        { rotateY: `${rotation.value}deg` }
      ],
      opacity: isFrontVisible ? 1 : 0,
      zIndex: isFrontVisible ? 1 : 0,
    };
  });

  const backStyle = useAnimatedStyle(() => {
    const isBackVisible = rotation.value >= 90;
    return {
      transform: [
        { perspective: 1000 },
        { rotateY: `${rotation.value + 180}deg` }
      ],
      opacity: isBackVisible ? 1 : 0,
      zIndex: isBackVisible ? 1 : 0,
      position: 'absolute',
    };
  });

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerFade.value,
    transform: [{ scale: contentScale.value }]
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowAnim.value,
  }));

  if (showOnboarding && isReady) {
    return <OnboardingFlow onComplete={handleOnboardingComplete} />;
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient
        colors={['#0a0a0f', '#1a1a2e', '#0a0a0f']}
        style={StyleSheet.absoluteFill}
      />
      
      <View style={styles.center}>
        <Animated.View style={[styles.mainContainer, containerStyle]}>
          <View style={styles.flipWrapper}>
            <Animated.View style={[styles.card, frontStyle]}>
              <Animated.View style={[styles.glowRing, glowStyle]} />
              <View style={styles.logoCircle}>
                <Image 
                  source={require('../assets/images/movie_zone_logo_new.png')}
                  style={styles.logoImg}
                  resizeMode="cover"
                />
              </View>
            </Animated.View>

            <Animated.View style={[styles.card, backStyle]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15 }}>
                <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                  <Animated.View style={[styles.smallGlowRing, glowStyle]} />
                  <View style={styles.smallLogoCircle}>
                    <Image 
                      source={require('../assets/images/movie_zone_logo_new.png')}
                      style={styles.logoImg}
                      resizeMode="cover"
                    />
                  </View>
                </View>

                <View style={[styles.contentWrap, { alignSelf: 'center', marginLeft: 15 }]}>
                  <Text style={styles.brandTitle}>
                    THE MOVIE <Text style={{ color: '#818cf8', textShadowColor: 'rgba(129, 140, 248, 0.4)' }}>ZONE</Text>
                  </Text>
                  
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, width: '100%' }}>
                    <LinearGradient 
                      colors={['#818cf8', 'rgba(129, 140, 248, 0.2)', 'transparent']} 
                      start={{ x: 0, y: 0 }} 
                      end={{ x: 1, y: 0 }} 
                      style={[styles.underline, { flex: 1, height: 1.5, marginRight: 10 }]} 
                    />
                    <View style={styles.subtitleRow}>
                      <ClockAnimation size={15} color="#ffffff" />
                      <Text style={[styles.subtitle, { marginLeft: 6 }]}>24 / 7</Text>
                    </View>
                  </View>
                </View>
              </View>
              
              {/* Intent Indicator */}
              {(params.movieId || params.autoplay) && (
                <Animated.View entering={FadeIn.delay(1000)} style={styles.intentLoader}>
                  <ActivityIndicator color="#818cf8" size="small" />
                  <Text style={styles.intentText}>Opening your movie...</Text>
                </Animated.View>
              )}
            </Animated.View>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainContainer: {
    alignItems: 'center',
    zIndex: 2,
    width: '100%',
    height: 400,
    justifyContent: 'center',
  },
  flipWrapper: {
    width: width,
    height: 350,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backfaceVisibility: 'hidden',
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
  underline: {
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
  logoCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    overflow: 'hidden',
    backgroundColor: '#0a0a0f',
    shadowColor: '#1a5fa3',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 15,
  },
  glowRing: {
    position: 'absolute',
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: 'transparent',
    borderWidth: 3,
    borderColor: 'rgba(70,140,220,0.55)',
    shadowColor: '#4a8ce0',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 25,
    elevation: 0,
    zIndex: -1,
  },
  smallGlowRing: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: 'rgba(70,140,220,0.55)',
    shadowColor: '#4a8ce0',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 0,
    zIndex: -1,
  },
  logoImg: {
    width: '100%',
    height: '100%',
    transform: [{ scale: 1.27 }],
  },
  intentLoader: {
    marginTop: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(129, 140, 248, 0.3)',
  },
  intentText: {
    color: '#818cf8',
    fontSize: 14,
    fontWeight: '700',
  }
});

