import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { auth } from '../constants/firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import ClockAnimation from '../components/ClockAnimation';

const { width } = Dimensions.get('window');

export default function Index() {
  const router = useRouter();
  
  // Animation values
  const containerFade = useRef(new Animated.Value(0)).current;
  const containerMove = useRef(new Animated.Value(20)).current;
  const lineWidth = useRef(new Animated.Value(0)).current;
  const subtitleFade = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Entrance: Fade & Float
    Animated.timing(containerFade, {
      toValue: 1,
      duration: 1200,
      useNativeDriver: true,
    }).start();

    Animated.spring(containerMove, {
      toValue: 0,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();

    // 2. Line Expansion & Subtitle (Delayed)
    Animated.sequence([
      Animated.delay(1000),
      Animated.timing(lineWidth, {
        toValue: 1, // Normalized for scaleX
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(subtitleFade, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();

    // 3. Continuous Breathing Glow
    const startGlow = () => {
      Animated.sequence([
        Animated.timing(glowOpacity, { toValue: 0.6, duration: 2500, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0.2, duration: 2500, useNativeDriver: true }),
      ]).start(() => startGlow());
    };
    startGlow();

    // Authentication & Navigation
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setTimeout(() => {
        if (user) {
          router.replace('/(tabs)');
        } else {
          router.replace('/login');
        }
      }, 4000); // 4s for a professional feel
    });
    
    return () => unsubscribe();
  }, [router]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Signature App Background */}
      <LinearGradient
        colors={['#0a0a0f', '#1a1a2e', '#0a0a0f']}
        style={StyleSheet.absoluteFill}
      />
      
      <View style={styles.center}>
        {/* Soft Background Glow Pulse */}
        <Animated.View style={[styles.glowBall, { opacity: glowOpacity }]} />

        <Animated.View style={[
          styles.mainContainer,
          { 
            opacity: containerFade,
            transform: [{ translateY: containerMove }]
          }
        ]}>
          <Text style={styles.brandTitle}>THE MOVIE ZONE</Text>
          
          {/* Expanding Underline */}
          <Animated.View style={[
            styles.underline,
            { transform: [{ scaleX: lineWidth }] }
          ]} />

          <Animated.View style={[styles.subtitleBox, { opacity: subtitleFade }]}>
            <View style={styles.subtitleRow}>
              <ClockAnimation size={16} color="#818cf8" />
              <Text style={styles.subtitle}>24 / 7</Text>
            </View>
          </Animated.View>
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
  },
  brandTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 2,
    textAlign: 'center',
  },
  underline: {
    height: 1.5,
    width: width * 0.5,
    backgroundColor: '#818cf8', // Signature Indigo
    marginTop: 8,
    borderRadius: 2,
  },
  subtitleBox: {
    marginTop: 12,
  },
  subtitle: {
    color: '#818cf8',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 4, // Reduced slightly for better alignment with icon
    textAlign: 'center',
    marginLeft: 8,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowBall: {
    position: 'absolute',
    width: width * 0.7,
    height: width * 0.7,
    borderRadius: width * 0.35,
    backgroundColor: 'rgba(129, 140, 248, 0.15)',
    zIndex: 1,
  }
});





