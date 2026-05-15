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
import { Plan } from '../constants/planData';
import { useSubscription } from '../app/context/SubscriptionContext';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../constants/firebaseConfig';
import UpgradeSuccessModal from './UpgradeSuccessModal';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const PAYMENT_API_BASE = 'https://www.themoviezone247.com/api/payments';


interface PlanSelectionModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function PlanSelectionModal({ visible, onClose }: PlanSelectionModalProps) {
  const insets = useSafeAreaInsets();
  const { isPaid, subscriptionBundle, availablePlans } = useSubscription();
  
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

  const [paymentStatus, setPaymentStatus] = useState('');
  const pollIntervalRef = React.useRef<any>(null);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const handlePaymentSubmit = async () => {
    if (!selectedPlan || !selectedMethod) return;
    if ((selectedMethod.id === 'mtn' || selectedMethod.id === 'airtel') && paymentPhone.length < 10) {
      alert('Please enter a valid phone number');
      return;
    }
    
    setIsProcessing(true);
    setPaymentStatus('Initiating payment...');
    triggerHaptic('impact');

    const user = auth.currentUser;
    if (!user) {
      setIsProcessing(false);
      alert('You must be signed in to upgrade.');
      return;
    }

    try {
      // 1. Initiate Relworx Charge (STK Push)
      const chargeResponse = await fetch(`${PAYMENT_API_BASE}/relworx-charge`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          phoneNumber: paymentPhone.replace(/\D/g, ''),
          amount: selectedPlan.price.replace(/\D/g, ''),
          currency: selectedPlan.currency || 'UGX',
          email: user.email || 'customer@themoviezone247.com',
          uid: user.uid,
          planName: selectedPlan.name
        }),
      });

      const chargeData = await chargeResponse.json();

      if (!chargeData.success) {
        throw new Error(chargeData.error || 'Failed to initiate payment');
      }

      const { tx_ref } = chargeData;
      setPaymentStatus('Please confirm the PIN prompt on your phone...');
      triggerHaptic('success');

      // 2. Start Polling for Verification
      let attempts = 0;
      const maxAttempts = 30; // 90 seconds (3s * 30)
      
      pollIntervalRef.current = setInterval(async () => {
        attempts++;
        try {
          const verifyResponse = await fetch(`${PAYMENT_API_BASE}/verify?tx_ref=${tx_ref}`);
          const verifyData = await verifyResponse.json();

          if (verifyData.success && verifyData.status === 'successful') {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            setPaymentStatus('Payment successful!');
            setIsProcessing(false);
            triggerHaptic('success');
            setShowSuccess(true);
          } else if (verifyData.status === 'failed' || attempts >= maxAttempts) {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            setIsProcessing(false);
            setPaymentStatus('');
            triggerHaptic('warning');
            alert(verifyData.status === 'failed' ? 'Payment was declined.' : 'Payment confirmation timed out. If you were charged, please contact support.');
          } else {
            setPaymentStatus(`Waiting for confirmation... (${maxAttempts - attempts})`);
          }
        } catch (pollError) {
          console.error('Polling error:', pollError);
        }
      }, 3000);

    } catch (err: any) {
      console.error("Error initiating Relworx payment:", err);
      setIsProcessing(false);
      setPaymentStatus('');
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
          entering={SlideInUp.springify().damping(25).stiffness(150)}
          exiting={SlideOutDown.duration(250)}
          style={styles.modalContent}
        >
          <BlurView intensity={Platform.OS === 'ios' ? 95 : 100} tint="dark" style={StyleSheet.absoluteFill}>
             <LinearGradient
                colors={['rgba(255,255,255,0.05)', 'transparent'] as any}
                style={StyleSheet.absoluteFill}
             />
          </BlurView>
          
          <View style={styles.header}>
            <TouchableOpacity 
              onPress={step === 'plans' ? onClose : () => {
                triggerHaptic('impact');
                setStep(step === 'payment-details' ? 'payment-method' : 'plans');
              }} 
              style={styles.backBtn}
            >
              <Ionicons name={step === 'plans' ? "close" : "chevron-back"} size={22} color="#fff" />
            </TouchableOpacity>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerTitle}>
                {step === 'plans' ? 'Premium Access' : step === 'payment-method' ? 'Payment Method' : 'Secure Checkout'}
              </Text>
              <Text style={styles.headerSub}>
                {step === 'plans' ? 'Select a plan to unlock everything' : 'Complete your subscription'}
              </Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {step === 'plans' && (
              <View style={styles.plansContainer}>
                {availablePlans.map((plan) => {
                  const isActive = isPaid && subscriptionBundle === plan.name;
                  const bonusDownloads = (plan as any).bonusDownloads || 0;
                  
                  return (
                    <TouchableOpacity 
                      key={plan.name} 
                      style={[
                        styles.planCard, 
                        { borderColor: plan.color + '40' },
                        isActive && { backgroundColor: 'rgba(255,255,255,0.05)' }
                      ]}
                      onPress={() => handlePlanSelect(plan)}
                    >
                      <View style={[styles.planGlow, { backgroundColor: plan.color, opacity: 0.08 }]} />
                      
                      {/* Watermark Price Background */}
                      <View style={{ position: 'absolute', top: -10, left: -10, opacity: 0.04, zIndex: 0 }}>
                        <Text style={{ fontSize: 90, fontWeight: '900', color: plan.color }}>
                          {plan.price.replace(',', '')}
                        </Text>
                      </View>

                      <View style={styles.planHeader}>
                        <View>
                           <Text style={[styles.planName, { color: plan.color }]}>
                             {plan.name}
                           </Text>
                           {isActive && (
                             <View style={styles.activePill}>
                               <View style={styles.activeDot} />
                               <Text style={styles.activeText}>CURRENT PLAN</Text>
                             </View>
                           )}
                        </View>
                        {(plan.bonusDays || plan.tag) && (
                          <View style={[styles.planTag, { backgroundColor: plan.color }]}>
                            <Text style={styles.planTagText}>{plan.bonusDays || plan.tag}</Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.priceRow}>
                        <Text style={styles.price}>{plan.price}</Text>
                        <Text style={styles.currency}>{plan.currency}</Text>
                      </View>

                      {bonusDownloads > 0 && (
                        <View style={[styles.bonusPill, { backgroundColor: plan.color + '20' }]}>
                          <Ionicons name="gift-outline" size={14} color={plan.color} />
                          <Text style={[styles.bonusText, { color: plan.color }]}>
                            +{bonusDownloads} Bonus Downloads Included
                          </Text>
                        </View>
                      )}

                      <View style={styles.cardDivider} />
                      
                      <View style={styles.specsContainer}>
                        {plan.specs.map((spec, i) => {
                          let iconName = "checkmark-circle";
                          if (spec.toLowerCase().includes('quality')) iconName = "videocam-outline";
                          if (spec.toLowerCase().includes('movies')) iconName = "play-circle-outline";
                          if (spec.toLowerCase().includes('ad-free')) iconName = "shield-checkmark-outline";
                          if (spec.toLowerCase().includes('download')) iconName = "cloud-download-outline";
                          if (spec.toLowerCase().includes('device')) iconName = "phone-portrait-outline";

                          return (
                            <View key={i} style={styles.specItem}>
                              <Ionicons name={iconName as any} size={16} color={plan.color} />
                              <Text style={styles.specText}>{spec}</Text>
                            </View>
                          );
                        })}
                      </View>

                      <View style={[styles.selectBtn, { backgroundColor: plan.color }]}>
                        <Text style={styles.selectBtnText}>GET {plan.name}</Text>
                        <Ionicons name="arrow-forward" size={16} color="#fff" />
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
                    <View style={{ flex: 1 }}>
                      <Text style={styles.methodLabel}>{m.label}</Text>
                      <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>Secure transaction</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.3)" />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {step === 'payment-details' && (
              <View style={styles.detailsContainer}>
                <View style={styles.paymentSummary}>
                   <Text style={styles.summaryLabel}>PAYING FOR</Text>
                   <View style={styles.summaryRow}>
                      <Text style={styles.summaryName}>{selectedPlan?.name}</Text>
                      <Text style={styles.summaryPrice}>{selectedPlan?.price} {selectedPlan?.currency}</Text>
                   </View>
                </View>

                {selectedMethod?.id === 'mtn' || selectedMethod?.id === 'airtel' ? (
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Mobile Money Number</Text>
                    <View style={styles.inputWrap}>
                      <Ionicons name="call-outline" size={20} color="rgba(255,255,255,0.4)" style={{ marginLeft: 16 }} />
                      <TextInput 
                        style={styles.input}
                        value={paymentPhone}
                        onChangeText={setPaymentPhone}
                        placeholder="e.g. 07xx xxx xxx"
                        placeholderTextColor="rgba(255,255,255,0.2)"
                        keyboardType="phone-pad"
                      />
                    </View>
                    <Text style={styles.inputHint}>You will receive a prompt to enter your PIN</Text>
                  </View>
                ) : (
                  <View style={styles.cardForm}>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Card Number</Text>
                      <View style={styles.inputWrap}>
                        <Ionicons name="card-outline" size={20} color="rgba(255,255,255,0.4)" style={{ marginLeft: 16 }} />
                        <TextInput 
                          style={styles.input} 
                          placeholder="0000 0000 0000 0000" 
                          placeholderTextColor="rgba(255,255,255,0.2)" 
                          keyboardType="numeric"
                        />
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <View style={[styles.inputGroup, { flex: 1 }]}>
                        <Text style={styles.inputLabel}>Expiry</Text>
                        <TextInput style={styles.input} placeholder="MM/YY" placeholderTextColor="rgba(255,255,255,0.2)" keyboardType="numeric" />
                      </View>
                      <View style={[styles.inputGroup, { flex: 1 }]}>
                        <Text style={styles.inputLabel}>CVV</Text>
                        <TextInput style={styles.input} placeholder="123" placeholderTextColor="rgba(255,255,255,0.2)" keyboardType="numeric" secureTextEntry />
                      </View>
                    </View>
                  </View>
                )}

                <TouchableOpacity 
                  style={styles.payBtn} 
                  onPress={handlePaymentSubmit}
                  disabled={isProcessing}
                >
                  <LinearGradient
                    colors={['#5B5FEF', '#818cf8'] as any}
                    style={styles.payGradient}
                  >
                    {isProcessing ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <ActivityIndicator color="#fff" />
                        <Text style={styles.payBtnText}>{paymentStatus || 'Processing...'}</Text>
                      </View>
                    ) : (
                      <>
                        <Text style={styles.payBtnText}>Confirm & Pay</Text>
                        <Ionicons name="shield-checkmark" size={18} color="#fff" />
                      </>
                    )}

                  </LinearGradient>
                </TouchableOpacity>

                <View style={styles.securityNote}>
                  <Ionicons name="lock-closed" size={12} color="rgba(255,255,255,0.4)" />
                  <Text style={styles.securityText}>End-to-end encrypted payment</Text>
                </View>
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
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    height: SCREEN_H * 0.82,
    backgroundColor: 'rgba(20,20,30,0.7)',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  headerSub: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 60,
  },
  plansContainer: {
    gap: 20,
  },
  planCard: {
    padding: 24,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  planGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    zIndex: 1,
  },
  planName: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 6,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  activeText: {
    color: '#10b981',
    fontSize: 9,
    fontWeight: '900',
  },
  planTag: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  planTagText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 12,
    zIndex: 1,
  },
  price: {
    color: '#fff',
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -1,
  },
  currency: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 16,
    fontWeight: '700',
  },
  bonusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 20,
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  bonusText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: 20,
  },
  specsContainer: {
    gap: 12,
    marginBottom: 24,
  },
  specItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  specText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '600',
  },
  selectBtn: {
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  selectBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  methodsContainer: {
    gap: 16,
  },
  methodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    gap: 16,
  },
  methodIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  methodLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  detailsContainer: {
    gap: 24,
  },
  paymentSummary: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 20,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  summaryLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  summaryPrice: {
    color: '#5B5FEF',
    fontSize: 18,
    fontWeight: '900',
  },
  inputGroup: {
    gap: 10,
  },
  inputLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginLeft: 4,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  input: {
    flex: 1,
    height: 56,
    paddingHorizontal: 16,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  inputHint: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    fontStyle: 'italic',
    marginLeft: 4,
  },
  cardForm: {
    gap: 16,
  },
  payBtn: {
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    marginTop: 10,
    shadowColor: '#5B5FEF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
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
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: -8,
  },
  securityText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    fontWeight: '600',
  },
});
