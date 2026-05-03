/**
 * DownloadSuccessModal.tsx
 * A premium cinematic modal replacing the plain Alert for download notifications.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: W } = Dimensions.get('window');

export type DownloadModalType = 'success' | 'error' | 'info' | 'warning';

interface DownloadModalProps {
  visible: boolean;
  type: DownloadModalType;
  title: string;
  message: string;
  onClose: () => void;
}

const CONFIG: Record<DownloadModalType, { icon: any; color: string; glow: string; gradient: [string, string] }> = {
  success: {
    icon: 'checkmark-circle',
    color: '#00FFB0',
    glow: 'rgba(0,255,176,0.3)',
    gradient: ['#00FFB0', '#00C896'],
  },
  error: {
    icon: 'close-circle',
    color: '#FF4D6A',
    glow: 'rgba(255,77,106,0.3)',
    gradient: ['#FF4D6A', '#CC1A33'],
  },
  warning: {
    icon: 'warning',
    color: '#FFB830',
    glow: 'rgba(255,184,48,0.3)',
    gradient: ['#FFB830', '#CC8800'],
  },
  info: {
    icon: 'information-circle',
    color: '#4D9FFF',
    glow: 'rgba(77,159,255,0.3)',
    gradient: ['#4D9FFF', '#1A6ACC'],
  },
};

export default function DownloadSuccessModal({
  visible,
  type,
  title,
  message,
  onClose,
}: DownloadModalProps) {
  const cfg = CONFIG[type];
  const scaleAnim = useRef(new Animated.Value(0.7)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const iconScaleAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 70,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Icon pops in after the card
        Animated.spring(iconScaleAnim, {
          toValue: 1,
          tension: 120,
          friction: 5,
          useNativeDriver: true,
        }).start();
        // Glow pulses
        Animated.loop(
          Animated.sequence([
            Animated.timing(glowAnim, { toValue: 1, duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
            Animated.timing(glowAnim, { toValue: 0.3, duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
          ])
        ).start();
      });
    } else {
      scaleAnim.setValue(0.7);
      opacityAnim.setValue(0);
      iconScaleAnim.setValue(0);
      glowAnim.setValue(0);
    }
  }, [visible]);

  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.7] });

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFillObject} />

        <Animated.View
          style={[
            styles.card,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Subtle top gradient accent */}
          <LinearGradient
            colors={['rgba(255,255,255,0.05)', 'transparent']}
            style={styles.topSheen}
          />

          {/* Glowing icon circle */}
          <Animated.View style={[styles.iconGlow, { backgroundColor: cfg.glow, opacity: glowOpacity }]} />
          <Animated.View style={[styles.iconWrapper, { borderColor: cfg.color + '33', transform: [{ scale: iconScaleAnim }] }]}>
            <LinearGradient colors={cfg.gradient} style={styles.iconGradientBg}>
              <Ionicons name={cfg.icon} size={36} color="#fff" />
            </LinearGradient>
          </Animated.View>

          {/* Text */}
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: cfg.color + '22' }]} />

          {/* Button */}
          <TouchableOpacity onPress={onClose} activeOpacity={0.8}>
            <LinearGradient
              colors={cfg.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.button}
            >
              <Text style={styles.buttonText}>OK</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  card: {
    width: W * 0.85,
    backgroundColor: 'rgba(18,18,28,0.97)',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 20,
  },
  topSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  iconGlow: {
    position: 'absolute',
    top: 16,
    width: 110,
    height: 110,
    borderRadius: 55,
  },
  iconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    marginBottom: 20,
    overflow: 'hidden',
  },
  iconGradientBg: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.3,
    marginBottom: 10,
  },
  message: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: 4,
  },
  divider: {
    width: '100%',
    height: StyleSheet.hairlineWidth,
    marginVertical: 24,
  },
  button: {
    paddingHorizontal: 52,
    paddingVertical: 14,
    borderRadius: 50,
    minWidth: 140,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
});
