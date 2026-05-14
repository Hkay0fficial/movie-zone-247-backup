import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSubscription } from '../app/context/SubscriptionContext';
import PlanSelectionModal from './PlanSelectionModal';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';


const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface SubscriptionGuardProps {
  children: React.ReactNode;
}

export default function SubscriptionGuard({ children }: SubscriptionGuardProps) {
  const { isPaid, isGuest, subscriptionBundle } = useSubscription();
  const [showPlans, setShowPlans] = useState(false);
  const router = useRouter();

  // If the user has a paid plan (not 'None' and not expired), or if it's a guest (guest logic might differ, but usually guests have limited access)
  // The user said: "enforce access restrictions for 'None' or expired accounts."
  // isPaid already handles 'None' and 'expired'.
  
  const isLocked = !isPaid && !isGuest;

  if (!isLocked) {
    return <>{children}</>;
  }

  return (
    <View style={styles.container}>
      {/* Background Content (Blurred) */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {children}
        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
      </View>

      <StatusBar barStyle="light-content" transparent />

      <Animated.View 
        entering={FadeIn.duration(600)}
        style={styles.content}
      >
        <Animated.View 
          entering={ZoomIn.delay(200).springify()}
          style={styles.lockCircle}
        >

          <LinearGradient
            colors={['#5B5FEF', '#818cf8']}
            style={styles.lockGradient}
          >
            <Ionicons name="lock-closed" size={42} color="#fff" />
          </LinearGradient>
        </Animated.View>

        <Text style={styles.title}>Subscription Expired</Text>
        <Text style={styles.subtitle}>
          Your {subscriptionBundle} access has ended. Upgrade your plan to continue enjoying unlimited movies and series.
        </Text>

        <View style={styles.actionContainer}>
          <TouchableOpacity 
            style={styles.primaryBtn}
            onPress={() => setShowPlans(true)}
          >
            <LinearGradient
              colors={['#5B5FEF', '#4f46e5']}
              style={styles.btnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.primaryBtnText}>Renew Subscription</Text>
              <Ionicons name="flash" size={18} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.secondaryBtn}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.secondaryBtnText}>Switch Account</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.perksContainer}>
          <View style={styles.perkItem}>
            <Ionicons name="checkmark-circle" size={16} color="#5B5FEF" />
            <Text style={styles.perkText}>Unlimited FHD Streaming</Text>
          </View>
          <View style={styles.perkItem}>
            <Ionicons name="checkmark-circle" size={16} color="#5B5FEF" />
            <Text style={styles.perkText}>No Ads, No Interruptions</Text>
          </View>
          <View style={styles.perkItem}>
            <Ionicons name="checkmark-circle" size={16} color="#5B5FEF" />
            <Text style={styles.perkText}>In-app & External Downloads</Text>
          </View>
        </View>
      </Animated.View>

      <PlanSelectionModal 
        visible={showPlans}
        onClose={() => setShowPlans(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  lockCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 24,
    shadowColor: '#5B5FEF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  lockGradient: {
    flex: 1,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
    paddingHorizontal: 10,
  },
  actionContainer: {
    width: '100%',
    gap: 16,
    marginBottom: 48,
  },
  primaryBtn: {
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    shadowColor: '#5B5FEF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  btnGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  secondaryBtn: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 15,
    fontWeight: '600',
  },
  perksContainer: {
    gap: 12,
  },
  perkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  perkText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '600',
  },
});
