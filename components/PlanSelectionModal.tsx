import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  Modal,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { 
  FadeInDown, 
  FadeOutDown, 
  SlideInUp, 
  SlideOutDown 
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { PLANS, Plan } from '../constants/planData';
import { useSubscription } from '../app/context/SubscriptionContext';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../constants/firebaseConfig';
import UpgradeSuccessModal from './UpgradeSuccessModal';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface PlanSelectionModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function PlanSelectionModal({ visible, onClose }: PlanSelectionModalProps) {
  const insets = useSafeAreaInsets();
  const { isPaid, subscriptionBundle } = useSubscription();
  
  // Flow State
  const [step, setStep] = useState<'plans' | 'payment-method' | 'payment-details'>('plans');
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<any>(null);
  
  // Payment Details State
  const [paymentPhone, setPaymentPhone] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCVV, setCardCVV] = useState('');
  const [cardName, setCardName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const triggerHaptic = (type: 'impact' | 'success' | 'warning' = 'impact') => {
    if (type === 'impact') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    else if (type === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else if (type === 'warning') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };

  const handlePlanSelect = (plan: Plan) => {
    triggerHaptic('impact');
    setSelectedPlan(plan);
    setStep('payment-method');
  };

  const handleMethodSelect = (method: any) => {
    triggerHaptic('impact');
    setSelectedMethod(method);
    setStep('payment-details');
  };

  const handlePaymentSubmit = async () => {
    if (!selectedPlan || !selectedMethod) return;
    
    setIsProcessing(true);
    triggerHaptic('impact');

    const user = auth.currentUser;
    if (!user) {
      setIsProcessing(false);
      alert('You must be signed in to upgrade.');
      return;
    }

    try {
      // Calculate Expiry Date based on Plan ID
      let durationDays = 0;
      switch (selectedPlan.id) {
        case 'week_1': durationDays = 8; break; // 7 + 1 bonus
        case 'weeks_2': durationDays = 16; break; // 14 + 2 bonus
        case 'month_1': durationDays = 34; break; // 30 + 4 bonus
        case 'months_2': durationDays = 67; break; // 60 + 7 bonus
        default: durationDays = 30;
      }

      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + durationDays);

      // Update Firestore
      await updateDoc(doc(db, 'users', user.uid), {
        subscriptionBundle: selectedPlan.name,
        subscriptionExpiresAt: expiryDate, // Firestore handles JS Date natively
        paymentMethod: selectedMethod.label,
        updatedAt: new Date()
      });
      
      setIsProcessing(false);
      triggerHaptic('success');
      setShowSuccess(true);
    } catch (err: any) {
      console.error("Error updating subscription:", err);
      setIsProcessing(false);
      triggerHaptic('warning');
      alert('Payment failed: ' + (err.message || 'Please try again.'));
    }
  };

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        
        <Animated.View 
          entering={FadeInDown.springify().damping(22).stiffness(120)}
          exiting={FadeOutDown.duration(250)}
          style={styles.modalContent}
        >
          <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
          
          <View style={styles.header}>
            <TouchableOpacity onPress={step === 'plans' ? onClose : () => setStep(step === 'payment-details' ? 'payment-method' : 'plans')} style={styles.backBtn}>
              <Ionicons name={step === 'plans' ? "close" : "chevron-back"} size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {step === 'plans' ? 'Choose Your Plan' : step === 'payment-method' ? 'Payment Method' : 'Payment Details'}
            </Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {step === 'plans' && (
              <View style={styles.plansContainer}>
                {PLANS.map((plan) => {
                  const isActive = isPaid && subscriptionBundle === plan.name;
                  return (
                    <TouchableOpacity 
                      key={plan.name} 
                      style={[styles.planCard, { borderColor: plan.color + '40' }]}
                      onPress={() => handlePlanSelect(plan)}
                    >
                      <View style={[styles.planGlow, { backgroundColor: plan.color, opacity: 0.05 }]} />
                      
                      {/* Watermark Price Background */}
                      <View style={{ position: 'absolute', top: -15, left: -15, opacity: 0.03, zIndex: 0 }}>
                        <Text style={{ fontSize: 100, fontWeight: '900', color: plan.color }}>
                          {plan.price.replace(',', '')}
                        </Text>
                      </View>

                      {/* Floating Bonus/Tag Right */}
                      {(plan.bonusDays || plan.tag) && (
                        <View style={{ 
                          position: 'absolute', 
                          top: 16, 
                          right: 16, 
                          backgroundColor: plan.color, 
                          paddingHorizontal: 8, 
                          paddingVertical: 4, 
                          borderRadius: 20,
                          zIndex: 10
                        }}>
                          <Text style={{ color: '#fff', fontSize: 9, fontWeight: '900', textTransform: 'uppercase' }}>
                            {plan.bonusDays || plan.tag}
                          </Text>
                        </View>
                      )}

                      {/* Centered Title & Price */}
                      <View style={{ alignItems: 'center', width: '100%', marginBottom: 12, marginTop: 12, zIndex: 5 }}>
                        <Text style={{ color: plan.color, fontSize: 12, fontWeight: '800', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 8 }}>
                          {plan.name}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                          <Text style={{ color: '#fff', fontSize: 46, fontWeight: '900', letterSpacing: -1.5 }}>{plan.price}</Text>
                          <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 16, fontWeight: '700' }}>{plan.currency}</Text>
                        </View>
                      </View>

                      {/* Divider */}
                      <View style={{ alignSelf: 'center', width: '50%', height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginBottom: 16 }} />
                      <View style={styles.specsContainer}>
                        {plan.specs.map((spec, i) => {
                          let iconName = "checkmark-circle";
                          if (spec.toLowerCase().includes('quality')) iconName = "videocam";
                          if (spec.toLowerCase().includes('movies')) iconName = "play-circle";
                          if (spec.toLowerCase().includes('ad-free')) iconName = "shield-checkmark";
                          if (spec.toLowerCase().includes('content')) iconName = "layers";
                          if (spec.toLowerCase().includes('download')) iconName = "cloud-download";
                          if (spec.toLowerCase().includes('device')) iconName = "phone-portrait";

                          return (
                            <View key={i} style={styles.specItem}>
                              <Ionicons name={iconName as any} size={16} color={plan.color} />
                              <Text style={styles.specText}>{spec}</Text>
                            </View>
                          );
                        })}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {step === 'payment-method' && (
              <View style={styles.methodsContainer}>
                {[
                  { id: 'mtn', label: 'MTN Mobile Money', icon: 'phone-portrait-outline', color: '#facc15' },
                  { id: 'airtel', label: 'Airtel Money', icon: 'phone-portrait-outline', color: '#ef4444' },
                  { id: 'card', label: 'Credit / Debit Card', icon: 'card-outline', color: '#6366f1' },
                ].map((m) => (
                  <TouchableOpacity key={m.id} style={styles.methodBtn} onPress={() => handleMethodSelect(m)}>
                    <View style={[styles.methodIcon, { backgroundColor: m.color + '20' }]}>
                      <Ionicons name={m.icon as any} size={24} color={m.color} />
                    </View>
                    <Text style={styles.methodLabel}>{m.label}</Text>
                    <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.3)" />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {step === 'payment-details' && (
              <View style={styles.detailsContainer}>
                {selectedMethod?.id === 'mtn' || selectedMethod?.id === 'airtel' ? (
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Phone Number</Text>
                    <TextInput 
                      style={styles.input}
                      value={paymentPhone}
                      onChangeText={setPaymentPhone}
                      placeholder="e.g. 07xx xxx xxx"
                      placeholderTextColor="rgba(255,255,255,0.2)"
                      keyboardType="phone-pad"
                    />
                  </View>
                ) : (
                  <View style={styles.cardForm}>
                    <TextInput style={styles.input} placeholder="Card Number" placeholderTextColor="rgba(255,255,255,0.2)" />
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <TextInput style={[styles.input, { flex: 1 }]} placeholder="MM/YY" placeholderTextColor="rgba(255,255,255,0.2)" />
                      <TextInput style={[styles.input, { flex: 1 }]} placeholder="CVV" placeholderTextColor="rgba(255,255,255,0.2)" />
                    </View>
                  </View>
                )}

                <TouchableOpacity 
                  style={styles.payBtn} 
                  onPress={handlePaymentSubmit}
                  disabled={isProcessing}
                >
                  <LinearGradient
                    colors={['#5B5FEF', '#818cf8']}
                    style={styles.payGradient}
                  >
                    {isProcessing ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Text style={styles.payBtnText}>Pay {selectedPlan?.price} {selectedPlan?.currency}</Text>
                        <Ionicons name="lock-closed" size={16} color="#fff" />
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </Animated.View>

        <UpgradeSuccessModal 
          visible={showSuccess}
          planName={selectedPlan?.name.split(' [')[0] || ''}
          onClose={() => {
            setShowSuccess(false);
            onClose();
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 40,
  },
  modalContent: {
    maxHeight: SCREEN_H * 0.85,
    backgroundColor: 'rgba(15,15,20,0.95)',
    borderRadius: 32,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.12)',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  plansContainer: {
    gap: 16,
  },
  planCard: {
    padding: 20,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  planGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  planName: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  planTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  planTagText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
  },
  bonusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  bonusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: 20,
  },
  price: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
  },
  currency: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
    fontWeight: '700',
  },
  specsContainer: {
    gap: 10,
  },
  specItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  specText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '500',
  },
  methodsContainer: {
    gap: 12,
  },
  methodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    gap: 16,
  },
  methodIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodLabel: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  detailsContainer: {
    gap: 24,
  },
  inputGroup: {
    gap: 10,
  },
  inputLabel: {
    color: '#818cf8',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  input: {
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: 16,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cardForm: {
    gap: 12,
  },
  payBtn: {
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    marginTop: 20,
  },
  payGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  payBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
});
