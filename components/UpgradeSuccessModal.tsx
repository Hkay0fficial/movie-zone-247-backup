import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Modal,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import Animated, { 
  FadeIn,
  FadeInDown,
  ZoomIn,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  Easing
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface UpgradeSuccessModalProps {
  visible: boolean;
  planName: string;
  onClose: () => void;
}

export default function UpgradeSuccessModal({
  visible,
  planName,
  onClose,
}: UpgradeSuccessModalProps) {
  
  const triggerHaptic = (type: 'success' | 'impact' = 'success') => {
    if (type === 'success') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  useEffect(() => {
    if (visible) {
      triggerHaptic('success');
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
        
        <Animated.View 
          entering={FadeIn.duration(600)}
          style={styles.container}
        >
          {/* Glowing Background Effect */}
          <View style={styles.glowContainer}>
            <AnimatedGlow color="#FFC107" size={300} delay={0} />
            <AnimatedGlow color="#f59e0b" size={250} delay={1000} />
          </View>

          {/* Success Icon */}
          <Animated.View 
            entering={ZoomIn.delay(300).duration(800).springify()}
            style={styles.iconWrapper}
          >
            <LinearGradient
              colors={['#FFC107', '#f59e0b']}
              style={styles.iconGradient}
            >
              <Ionicons name="checkmark" size={60} color="#000" />
            </LinearGradient>
            
            {/* Animated Rings */}
            <AnimatedRing delay={0} color="#FFC107" />
            <AnimatedRing delay={400} color="#FFC107" />
          </Animated.View>

          {/* Content */}
          <Animated.View entering={FadeInDown.delay(600).duration(800).springify()}>
            <Text style={styles.title}>UPGRADE SUCCESS!</Text>
            <Text style={styles.subtitle}>
              Welcome to the Premium tier. Your {planName} plan is now active.
            </Text>
          </Animated.View>

          {/* Unlocked Features */}
          <View style={styles.featuresList}>
            <FeatureRow icon="flash" text="Instant 4K Playback" delay={1000} />
            <FeatureRow icon="download" text="Unlimited Offline Saves" delay={1200} />
            <FeatureRow icon="shield-checkmark" text="Ad-Free Experience" delay={1400} />
          </View>

          {/* Action Button */}
          <Animated.View 
            entering={FadeInDown.delay(1800).duration(600)}
            style={styles.buttonWrapper}
          >
            <TouchableOpacity 
              style={styles.button}
              onPress={() => {
                triggerHaptic('impact');
                onClose();
              }}
            >
              <LinearGradient
                colors={['#FFC107', '#f59e0b']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buttonGradient}
              >
                <Text style={styles.buttonText}>START WATCHING</Text>
                <Ionicons name="play" size={18} color="#000" />
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function AnimatedGlow({ color, size, delay }: any) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    scale.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(1.5, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    ));
    opacity.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(0.6, { duration: 3000 }),
        withTiming(0.3, { duration: 3000 })
      ),
      -1,
      true
    ));
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: color,
    position: 'absolute',
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
    filter: 'blur(60px)',
  }));

  return <Animated.View style={animatedStyle} />;
}

function AnimatedRing({ delay, color }: any) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.6);

  useEffect(() => {
    scale.value = withDelay(delay, withRepeat(
      withTiming(2, { duration: 2000, easing: Easing.out(Easing.quad) }),
      -1,
      false
    ));
    opacity.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(0.6, { duration: 0 }),
        withTiming(0, { duration: 2000, easing: Easing.out(Easing.quad) })
      ),
      -1,
      false
    ));
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: color,
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return <Animated.View style={animatedStyle} />;
}

function FeatureRow({ icon, text, delay }: any) {
  return (
    <Animated.View 
      entering={FadeInDown.delay(delay).duration(500)}
      style={styles.featureRow}
    >
      <View style={styles.featureIcon}>
        <Ionicons name={icon} size={16} color="#FFC107" />
      </View>
      <Text style={styles.featureText}>{text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  glowContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: -1,
  },
  container: {
    width: SCREEN_W * 0.85,
    alignItems: 'center',
    padding: 32,
  },
  iconWrapper: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  iconGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    shadowColor: '#FFC107',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 15,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 15,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 40,
  },
  featuresList: {
    width: '100%',
    gap: 16,
    marginBottom: 48,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  featureIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255,193,7,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  featureText: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '700',
  },
  buttonWrapper: {
    width: '100%',
  },
  button: {
    width: '100%',
    height: 60,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#FFC107',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  buttonGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  buttonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },
});
