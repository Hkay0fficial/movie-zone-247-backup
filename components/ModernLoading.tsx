import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, Image } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withRepeat, 
  withTiming, 
  withSequence,
  Easing,
  interpolate
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

interface ModernLoadingProps {
  message?: string;
  subMessage?: string;
}

export default function ModernLoading({ 
  message = "Opening Content...", 
  subMessage = "Preparing your viewing experience" 
}: ModernLoadingProps) {
  const rotation = useSharedValue(0);
  const pulse = useSharedValue(1);
  const glow = useSharedValue(0);

  useEffect(() => {
    // Rotation for the ring
    rotation.value = withRepeat(
      withTiming(360, {
        duration: 2000,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
      }),
      -1,
      false
    );

    // Pulse for the center
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    // Glow effect
    glow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500 }),
        withTiming(0.4, { duration: 1500 })
      ),
      -1,
      true
    );
  }, []);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const centerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [{ scale: interpolate(glow.value, [0.4, 1], [1, 1.2]) }],
  }));

  return (
    <View style={styles.container}>
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      
      <View style={styles.content}>
        {/* Animated Glow Background */}
        <Animated.View style={[styles.glowCircle, glowStyle]} />

        {/* Outer Rotating Ring */}
        <Animated.View style={[styles.ringContainer, ringStyle]}>
          <LinearGradient
            colors={['#5B5FEF', 'transparent', '#5B5FEF']}
            style={styles.ring}
          />
        </Animated.View>

        {/* Inner Content */}
        <Animated.View style={[styles.innerCircle, centerStyle]}>
          <Image 
            source={require('../assets/images/movie_zone_logo_new.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Text Section */}
        <View style={styles.textContainer}>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.loaderLineContainer}>
             <Animated.View style={styles.loaderLine} />
          </View>
          <Text style={styles.subMessage}>{subMessage}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(10, 10, 15, 0.8)',
    zIndex: 99999,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowCircle: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(91, 95, 239, 0.2)',
    shadowColor: '#5B5FEF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 30,
  },
  ringContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ring: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
    borderColor: 'transparent',
    borderTopColor: '#5B5FEF',
    borderRightColor: '#5B5FEF',
  },
  innerCircle: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  logo: {
    width: 60,
    height: 60,
  },
  textContainer: {
    marginTop: 40,
    alignItems: 'center',
  },
  message: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(91, 95, 239, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  subMessage: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 12,
  },
  loaderLineContainer: {
    width: 120,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 1.5,
    marginTop: 15,
    overflow: 'hidden',
  },
  loaderLine: {
    width: '40%',
    height: '100%',
    backgroundColor: '#5B5FEF',
    borderRadius: 1.5,
  }
});
