import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  Modal,
  Pressable,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, FontAwesome5, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import Animated, { 
  FadeInDown, 
  FadeOutDown, 
  SlideInUp, 
  SlideOutDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface PremiumAccessModalProps {
  visible: boolean;
  isGuest: boolean;
  onClose: () => void;
  onLogin: () => void;
  onSignUp: () => void;
  onUpgrade: () => void;
  onSocialLogin: (provider: string) => void;
  guestMessage?: string;
}

export default function PremiumAccessModal({
  visible,
  isGuest,
  onClose,
  onLogin,
  onSignUp,
  onUpgrade,
  onSocialLogin,
  guestMessage,
}: PremiumAccessModalProps) {
  const insets = useSafeAreaInsets();
  
  const triggerHaptic = (type: 'impact' | 'success' | 'warning' = 'impact') => {
    if (type === 'impact') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else if (type === 'success') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (type === 'warning') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={[styles.overlay, { paddingTop: insets.top }]}>
        <Pressable 
          style={StyleSheet.absoluteFill} 
          onPress={() => {
            triggerHaptic('impact');
            onClose();
          }} 
        />
        
        <Animated.View 
          entering={FadeInDown.springify().damping(22).stiffness(120)}
          exiting={FadeOutDown.duration(250)}
          style={styles.modalContent}
        >
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          
          {/* Drag Indicator */}
          <View style={styles.dragIndicator} />

          {isGuest ? (
            /* ── GUEST VIEW ── */
            <View style={styles.container}>
              <View style={styles.header}>
                <View style={[styles.iconBox, { backgroundColor: 'rgba(91, 95, 239, 0.15)' }]}>
                  <Ionicons name="person-add" size={28} color="#5B5FEF" />
                </View>
                <Text style={styles.title}>THE MOVIE ZONE 24/7</Text>
                <Text style={styles.subtitle}>
                  {guestMessage || "Guests can only watch free movies. Sign up now to unlock premium content and sync your progress."}
                </Text>
              </View>

              <Text style={styles.alreadyAccountLabel}>Already have an account?</Text>

              <TouchableOpacity 
                style={styles.primaryBtn} 
                onPress={() => {
                  triggerHaptic('impact');
                  onLogin();
                }}
              >
                <LinearGradient
                  colors={['#5B5FEF', '#818cf8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.gradientBtn}
                >
                  <Text style={styles.primaryBtnText}>Sign In</Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR SIGN IN WITH</Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.socialGrid}>
                <SocialBtn 
                  label="Google" 
                  iconUrl="https://www.gstatic.com/images/branding/product/2x/googleg_48dp.png"
                  onPress={() => onSocialLogin('Google')}
                />
                <SocialBtn 
                  label="Apple" 
                  icon="logo-apple" 
                  onPress={() => onSocialLogin('Apple')}
                />
              </View>

              <TouchableOpacity 
                style={styles.noThanksBtn} 
                onPress={() => {
                  triggerHaptic('impact');
                  onSignUp();
                }}
              >
                <Text style={styles.noThanksText}>
                  Don't have an account? <Text style={{ color: '#5B5FEF', fontWeight: '800' }}>Sign Up</Text>
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* ── REGISTERED USER VIEW ── */
            <View style={styles.container}>
              <View style={styles.header}>
                <View style={[styles.iconBox, { backgroundColor: 'rgba(91, 95, 239, 0.15)' }]}>
                  <Ionicons name="sparkles" size={28} color="#5B5FEF" />
                </View>
                <Text style={styles.title}>Go Premium Now</Text>
                <Text style={styles.subtitle}>
                  Upgrade your account to watch this movie and many others with best quality and no ads.
                </Text>
              </View>

              <View style={styles.benefitsContainer}>
                <BenefitItem 
                  icon="tv-outline" 
                  title="Full HD & HD Streaming" 
                  desc="High definition quality on all your devices" 
                  color="#5B5FEF"
                />
                <BenefitItem 
                  icon="ban-outline" 
                  title="Zero Advertisements" 
                  desc="No interruptions during your cinema time" 
                  color="#ef4444"
                />
                <BenefitItem 
                  icon="cloud-download-outline" 
                  title="Offline Viewing" 
                  desc="Unlimited downloads for on-the-go" 
                  color="#3b82f6"
                />
                <BenefitItem 
                  icon="phone-portrait-outline" 
                  title="External Downloads" 
                  desc="Save movies directly to your device storage" 
                  color="#f59e0b"
                />
                <BenefitItem 
                  icon="gift-outline" 
                  title="Huge Bonus Access" 
                  desc="Get up to 1 MONTH FREE with your plan" 
                  color="#10b981"
                />
              </View>

              <TouchableOpacity 
                style={styles.primaryBtn} 
                onPress={() => {
                  triggerHaptic('success');
                  onUpgrade();
                }}
              >
                <LinearGradient
                  colors={['#5B5FEF', '#818cf8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.gradientBtn}
                >
                  <Text style={styles.primaryBtnText}>Upgrade Now</Text>
                  <Ionicons name="chevron-forward" size={20} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity style={styles.noThanksBtn} onPress={onClose}>
                <Text style={styles.noThanksText}>Maybe Later</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

function SocialBtn({ label, icon, iconUrl, iconColor = "#fff", onPress }: any) {
  return (
    <TouchableOpacity style={styles.socialBtn} onPress={onPress}>
      <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
      {iconUrl ? (
        <ExpoImage source={iconUrl} style={{ width: 20, height: 20 }} contentFit="contain" />
      ) : (
        <Ionicons name={icon} size={20} color={iconColor} />
      )}
      <Text style={styles.socialBtnLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function BenefitItem({ icon, title, desc, color, isMC }: any) {
  return (
    <View style={styles.benefitItem}>
      <View style={[styles.benefitIcon, { backgroundColor: `${color}15` }]}>
        {isMC ? (
            <MaterialCommunityIcons name={icon as any} size={18} color={color} />
        ) : icon.includes('-outline') ? (
            <Ionicons name={icon as any} size={18} color={color} />
        ) : (
            <MaterialIcons name={icon as any} size={18} color={color} />
        )}
      </View>
      <View style={styles.benefitText}>
        <Text style={styles.benefitTitle}>{title}</Text>
        <Text style={styles.benefitDesc}>{desc}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'rgba(15,15,20,0.95)',
    borderRadius: 32,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    overflow: 'hidden',
    marginHorizontal: 16,
    marginVertical: 40,
    width: SCREEN_W - 32,
    maxHeight: SCREEN_H * 0.85,
  },
  dragIndicator: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 10,
  },
  container: {
    padding: 20,
    paddingBottom: 30,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconBox: {
    width: 60,
    height: 60,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 10,
    fontWeight: '500',
  },
  socialGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 24,
  },
  socialBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24, // Fully rounded (pill)
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  socialBtnLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    gap: 12,
    paddingHorizontal: 12,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  dividerText: {
    color: '#475569',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  primaryBtn: {
    width: '100%',
    height: 52,
    borderRadius: 26, // Fully rounded (pill)
    overflow: 'hidden',
    shadowColor: '#5B5FEF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  gradientBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  benefitsContainer: {
    gap: 16,
    marginBottom: 24,
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 16,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  benefitIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: {
    flex: 1,
  },
  benefitTitle: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  benefitDesc: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '500',
  },
  noThanksBtn: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 8,
  },
  noThanksText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700',
  },
  alreadyAccountLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 0.2,
  },
});
