import React from 'react';
import { 
  Modal, 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  TextInput, 
  StyleSheet, 
  Platform, 
  ActivityIndicator,
  Vibration,
  Animated,
  Easing
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { styles } from './menu.styles';

interface SubscriptionModalsProps {
  // Payment Type Selection Modal
  showPaymentModal: boolean;
  handleShowPaymentModal: (show: boolean) => void;
  paymentMethods: any[];
  setPaymentMethods: React.Dispatch<React.SetStateAction<any[]>>;
  setPaymentMethod: (method: string) => void;
  subscriptionBundle: string;
  TOP: number;

  // Payment Details Modal
  showPaymentDetailsModal: boolean;
  setShowPaymentDetailsModal: (show: boolean) => void;
  selectedPaymentMethod: any;
  setSelectedPaymentMethod: (method: any) => void;
  selectedPlanForPayment: any;
  paymentPhone: string;
  setPaymentPhone: (phone: string) => void;
  cardNumber: string;
  setCardNumber: (card: string) => void;
  cardExpiry: string;
  setCardExpiry: (expiry: string) => void;
  cardCVV: string;
  setCardCVV: (cvv: string) => void;
  isProcessingPayment: boolean;
  setIsProcessingPayment: (processing: boolean) => void;
  paymentStatusText: string;
  setPaymentStatusText: (text: string) => void;
  errorText: string;
  setErrorText: (text: string) => void;
  paymentSuccess: boolean;
  setPaymentSuccess: (success: boolean) => void;
  formatCardNumber: (text: string) => string;
  formatExpiry: (text: string) => string;

  // Billing History Modal
  showBillingHistory: boolean;
  setShowBillingHistory: (show: boolean) => void;
  billingHistory: any[];
  insets: { top: number; bottom: number; left: number; right: number };
  uid: string;
  userEmail: string;
  onPay: () => void;
  onCancel: () => void;
}

export const SubscriptionModals: React.FC<SubscriptionModalsProps> = ({
  showPaymentModal,
  handleShowPaymentModal,
  paymentMethods,
  setPaymentMethods,
  setPaymentMethod,
  subscriptionBundle,
  TOP,
  showPaymentDetailsModal,
  setShowPaymentDetailsModal,
  selectedPaymentMethod,
  setSelectedPaymentMethod,
  selectedPlanForPayment,
  paymentPhone,
  setPaymentPhone,
  cardNumber,
  setCardNumber,
  cardExpiry,
  setCardExpiry,
  cardCVV,
  setCardCVV,
  isProcessingPayment,
  setIsProcessingPayment,
  paymentStatusText,
  setPaymentStatusText,
  errorText,
  setErrorText,
  paymentSuccess,
  setPaymentSuccess,
  formatCardNumber,
  formatExpiry,
  showBillingHistory,
  setShowBillingHistory,
  billingHistory,
  insets,
  uid,
  userEmail,
  onPay,
  onCancel
}) => {
  const shakeAnimation = React.useRef(new Animated.Value(0)).current;

  const triggerShake = () => {
    Vibration.vibrate(100);
    Animated.sequence([
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true, easing: Easing.linear }),
      Animated.timing(shakeAnimation, { toValue: -10, duration: 50, useNativeDriver: true, easing: Easing.linear }),
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true, easing: Easing.linear }),
      Animated.timing(shakeAnimation, { toValue: 0, duration: 50, useNativeDriver: true, easing: Easing.linear }),
    ]).start();
  };

  const allowedPrefixes = selectedPaymentMethod?.id === 'mtn' ? ['077', '078', '076'] : ['070', '074', '075'];

  const handlePhoneChange = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    
    // Limit to 10 digits
    if (cleaned.length > 10) return;

    // Check prefix validity at 3 digits
    if (cleaned.length >= 3) {
      const currentPrefix = cleaned.substring(0, 3);
      if (!allowedPrefixes.includes(currentPrefix)) {
        triggerShake();
        // We still let them type but the UI will show the error
      }
    }

    setPaymentPhone(cleaned);
  };
  return (
    <>
      {/* ── Payment Method Selection Modal ── */}
      <Modal
        visible={showPaymentModal}
        transparent
        animationType="slide"
        onRequestClose={() => handleShowPaymentModal(false)}
        statusBarTranslucent={true}
      >
        <BlurView intensity={80} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.85)' }]}>
          <LinearGradient
            colors={['rgba(15,15,20,0.95)', 'rgba(20,20,28,0.95)', 'rgba(15,15,20,0.95)']}
            style={StyleSheet.absoluteFill}
          />
          <TouchableOpacity
            style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 24 }}
            activeOpacity={1}
            onPress={() => handleShowPaymentModal(false)}
          >
            <TouchableOpacity
              activeOpacity={1}
              style={{
                width: '100%',
                backgroundColor: '#1E1E2D',
                borderRadius: 28,
                padding: 16,
                paddingTop: 12,
                paddingBottom: 24,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: 'rgba(255, 255, 255, 0.22)',
                marginBottom: 60, // Shifted "more up" as requested
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.5,
                shadowRadius: 20,
              }}
            >
              <View style={{ width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, alignSelf: 'center', marginBottom: 16 }} />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <View>
                  <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800' }}>Payment Method</Text>
                  <Text style={{ color: '#94a3b8', fontSize: 13 }}>Control your payments and renewals</Text>
                </View>
                <TouchableOpacity
                  style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' }}
                  onPress={() => handleShowPaymentModal(false)}
                >
                  <Ionicons name="close" size={20} color="#fff" />
                </TouchableOpacity>
              </View>

              <View style={{ gap: 8 }}>
                {[
                  { id: 'mtn', label: 'MTN Mobile Money Uganda', icon: 'phone-portrait-outline', color: '#ffcc00' },
                  { id: 'airtel', label: 'Airtel Money Uganda', icon: 'phone-portrait-outline', color: '#e11900' },
                  { id: 'card', label: 'Credit card or Debit card', icon: 'card-outline', color: '#6366f1' }
                ].map((method) => (
                  <TouchableOpacity
                    key={method.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      padding: 12,
                      borderRadius: 14,
                      borderWidth: StyleSheet.hairlineWidth,
                      borderColor: 'rgba(255, 255, 255, 0.22)'
                    }}
                    onPress={() => {
                      setSelectedPaymentMethod(method);
                      setPaymentPhone('');
                      setShowPaymentDetailsModal(true);
                    }}
                  >
                    <View style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      backgroundColor: `${method.color}20`,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12
                    }}>
                      <Ionicons name={method.icon as any} size={20} color={method.color} />
                    </View>
                    <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600', flex: 1 }}>{method.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>


              <TouchableOpacity
                style={{
                  marginTop: 16,
                  padding: 14,
                  alignItems: 'center',
                  borderRadius: 14,
                  backgroundColor: 'rgba(255,255,255,0.05)'
                }}
                onPress={() => handleShowPaymentModal(false)}
              >
                <Text style={{ color: '#94a3b8', fontSize: 15, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </BlurView>
      </Modal>

      {/* ── Payment Details Modal ── */}
      <Modal
        visible={showPaymentDetailsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPaymentDetailsModal(false)}
        statusBarTranslucent={true}
      >
        <BlurView intensity={80} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.85)' }]}>
          <LinearGradient
            colors={['rgba(15,15,20,0.95)', 'rgba(20,20,28,0.95)', 'rgba(15,15,20,0.95)']}
            style={StyleSheet.absoluteFill}
          />
          <TouchableOpacity
            style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 24 }}
            activeOpacity={1}
            onPress={() => {
              if(!isProcessingPayment) setShowPaymentDetailsModal(false);
            }}
          >
            <TouchableOpacity
              activeOpacity={1}
              style={{
                width: '100%',
                backgroundColor: '#13131f',
                borderRadius: 28,
                padding: 20,
                paddingTop: 12,
                paddingBottom: 32,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: 'rgba(255, 255, 255, 0.22)',
                marginBottom: 60, // Consistent "more up" positioning
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.5,
                shadowRadius: 20,
              }}
            >
              {/* Drag Handle */}
              <View style={{ width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, alignSelf: 'center', marginBottom: 24 }} />

              {paymentSuccess ? (
                /* Success State */
                <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                  <View style={{
                    width: 80, height: 80, borderRadius: 40,
                    backgroundColor: 'rgba(52,211,153,0.15)',
                    alignItems: 'center', justifyContent: 'center', marginBottom: 16
                  }}>
                    <Ionicons name="checkmark-circle" size={52} color="#34d399" />
                  </View>
                  <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900', marginBottom: 8 }}>Payment Successful!</Text>
                  <Text style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center' }}>
                    Your {selectedPlanForPayment?.name?.split(' [')[0]} plan is now active.
                  </Text>
                </View>
              ) : (
                <>
                  {/* Back button + title */}
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 }}
                    onPress={() => setShowPaymentDetailsModal(false)}
                    disabled={isProcessingPayment}
                  >
                    <Ionicons name="arrow-back" size={20} color="#94a3b8" />
                    <Text style={{ color: '#94a3b8', fontSize: 14, fontWeight: '600' }}>Back to Methods</Text>
                  </TouchableOpacity>

                  {/* Method badge */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                    <View style={{
                      width: 48, height: 48, borderRadius: 14,
                      backgroundColor: `${selectedPaymentMethod?.color}20`,
                      alignItems: 'center', justifyContent: 'center'
                    }}>
                      <Ionicons name={selectedPaymentMethod?.icon as any} size={26} color={selectedPaymentMethod?.color} />
                    </View>
                    <View>
                      <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800' }}>{selectedPaymentMethod?.label}</Text>
                      <Text style={{ color: '#64748b', fontSize: 12 }}>
                        Paying for: {selectedPlanForPayment?.name?.split(' [')[0]} — {selectedPlanForPayment?.price} {selectedPlanForPayment?.currency}
                      </Text>
                    </View>
                  </View>

                  {/* -- MOBILE MONEY FIELDS -- */}
                  {(selectedPaymentMethod?.id === 'mtn' || selectedPaymentMethod?.id === 'airtel') && (
                    <View style={{ gap: 14 }}>
                      <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 }}>
                        {selectedPaymentMethod?.id === 'mtn' ? 'MTN Mobile Money' : 'Airtel Money'} Number
                      </Text>
                      {/* prefix hint chips */}
                      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 4 }}>
                        {allowedPrefixes.map(p => (
                          <TouchableOpacity 
                            key={p} 
                            onPress={() => setPaymentPhone(p)}
                            style={{
                              paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
                              backgroundColor: paymentPhone.startsWith(p)
                                ? `${selectedPaymentMethod?.color}30`
                                : 'rgba(255,255,255,0.05)',
                              borderWidth: StyleSheet.hairlineWidth,
                              borderColor: paymentPhone.startsWith(p)
                                ? selectedPaymentMethod?.color
                                : 'rgba(255, 255, 255, 0.12)'
                            }}
                          >
                            <Text style={{
                              color: paymentPhone.startsWith(p)
                                ? selectedPaymentMethod?.color
                                : '#475569',
                              fontSize: 12, fontWeight: '700'
                            }}>{p}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      <Animated.View style={{
                        flexDirection: 'row', alignItems: 'center',
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        borderRadius: 16, borderWidth: StyleSheet.hairlineWidth,
                        transform: [{ translateX: shakeAnimation }],
                        borderColor: paymentPhone.length === 10 && allowedPrefixes.some(p => paymentPhone.startsWith(p))
                          ? selectedPaymentMethod?.color
                          : paymentPhone.length >= 3 && !allowedPrefixes.some(p => paymentPhone.startsWith(p))
                            ? '#ef4444'
                            : 'rgba(255, 255, 255, 0.12)',
                        paddingHorizontal: 16, paddingVertical: 14, gap: 12
                      }}>
                        <Ionicons name="phone-portrait-outline" size={20} color={selectedPaymentMethod?.color} />
                        <TextInput
                          style={{ flex: 1, color: '#fff', fontSize: 18, fontWeight: '700', letterSpacing: 1 }}
                          value={paymentPhone}
                          onChangeText={handlePhoneChange}
                          placeholder={selectedPaymentMethod?.id === 'mtn' ? '077XXXXXXX' : '070XXXXXXX'}
                          placeholderTextColor="rgba(255,255,255,0.2)"
                          keyboardType="phone-pad"
                          maxLength={10}
                          editable={!isProcessingPayment}
                        />
                      </Animated.View>

                      {/* wrong prefix error */}
                      {paymentPhone.length >= 3 && !allowedPrefixes.some(p => paymentPhone.startsWith(p)) && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name="alert-circle" size={14} color="#ef4444" />
                          <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '600' }}>
                            {selectedPaymentMethod?.id === 'mtn'
                              ? 'MTN numbers start with 077, 078 or 076'
                              : 'Airtel numbers start with 070, 074 or 075'}
                          </Text>
                        </View>
                      )}

                      <Text style={{ color: '#475569', fontSize: 12 }}>
                        You will receive a prompt on your {selectedPaymentMethod?.id === 'mtn' ? 'MTN' : 'Airtel'} number to confirm the payment of {selectedPlanForPayment?.price} {selectedPlanForPayment?.currency}.
                      </Text>
                    </View>
                  )}

                  {/* -- CARD FIELDS -- */}
                  {selectedPaymentMethod?.id === 'card' && (
                    <View style={{ gap: 14 }}>
                      <View>
                        <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Card Number</Text>
                        <View style={{
                          flexDirection: 'row', alignItems: 'center',
                          backgroundColor: 'rgba(255,255,255,0.05)',
                          borderRadius: 14, borderWidth: StyleSheet.hairlineWidth,
                          borderColor: cardNumber.replace(/\s/g, '').length === 16 ? '#6366f1' : 'rgba(255, 255, 255, 0.12)',
                          paddingHorizontal: 16, paddingVertical: 14, gap: 12
                        }}>
                          <Ionicons name="card-outline" size={20} color="#6366f1" />
                          <TextInput
                            style={{ flex: 1, color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 2 }}
                            value={cardNumber}
                            onChangeText={(t) => setCardNumber(formatCardNumber(t))}
                            placeholder="1234 5678 9012 3456"
                            placeholderTextColor="rgba(255,255,255,0.2)"
                            keyboardType="number-pad"
                            maxLength={19}
                            editable={!isProcessingPayment}
                          />
                        </View>
                      </View>

                      <View style={{ flexDirection: 'row', gap: 12 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Expiry Date</Text>
                          <View style={{
                            flexDirection: 'row', alignItems: 'center',
                            backgroundColor: 'rgba(255,255,255,0.05)',
                            borderRadius: 14, borderWidth: StyleSheet.hairlineWidth,
                            borderColor: cardExpiry.length === 5 ? '#6366f1' : 'rgba(255, 255, 255, 0.12)',
                            paddingHorizontal: 14, paddingVertical: 14, gap: 10
                          }}>
                            <Ionicons name="calendar-outline" size={18} color="#6366f1" />
                            <TextInput
                              style={{ flex: 1, color: '#fff', fontSize: 16, fontWeight: '700' }}
                              value={cardExpiry}
                              onChangeText={(t) => setCardExpiry(formatExpiry(t))}
                              placeholder="MM/YY"
                              placeholderTextColor="rgba(255,255,255,0.2)"
                              keyboardType="number-pad"
                              maxLength={5}
                              editable={!isProcessingPayment}
                            />
                          </View>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>CVV</Text>
                          <View style={{
                            flexDirection: 'row', alignItems: 'center',
                            backgroundColor: 'rgba(255,255,255,0.05)',
                            borderRadius: 14, borderWidth: StyleSheet.hairlineWidth,
                            borderColor: cardCVV.length === 3 ? '#6366f1' : 'rgba(255, 255, 255, 0.12)',
                            paddingHorizontal: 14, paddingVertical: 14, gap: 10
                          }}>
                            <Ionicons name="lock-closed-outline" size={18} color="#6366f1" />
                            <TextInput
                              style={{ flex: 1, color: '#fff', fontSize: 16, fontWeight: '700' }}
                              value={cardCVV}
                              onChangeText={setCardCVV}
                              placeholder="123"
                              placeholderTextColor="rgba(255,255,255,0.2)"
                              keyboardType="number-pad"
                              maxLength={3}
                              secureTextEntry
                              editable={!isProcessingPayment}
                            />
                          </View>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Payment Button */}
                  <TouchableOpacity
                    style={{
                      marginTop: 32,
                      height: 60,
                      borderRadius: 18,
                      backgroundColor: isProcessingPayment ? 'rgba(255,255,255,0.05)' : '#fff',
                      alignItems: 'center', justifyContent: 'center',
                      flexDirection: 'row', gap: 12,
                      shadowColor: '#fff', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12
                    }}
                    disabled={isProcessingPayment}
                    onPress={onPay}
                   >
                     {isProcessingPayment ? (
                       <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                         <ActivityIndicator color={selectedPaymentMethod?.color} />
                         <Text style={{ color: '#000', fontSize: 15, fontWeight: '700' }}>Processing...</Text>
                       </View>
                     ) : (
                       <>
                         <Ionicons name="shield-checkmark" size={18} color="#000" />
                         <Text style={{ color: '#000', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 }}>
                           PAY {selectedPlanForPayment?.price} {selectedPlanForPayment?.currency}
                         </Text>
                       </>
                     )}
                   </TouchableOpacity>
 
                   {isProcessingPayment && paymentStatusText && (
                     <View>
                       <Text style={{ color: '#818cf8', fontSize: 12, textAlign: 'center', marginTop: 12, fontWeight: '600' }}>
                           {paymentStatusText}
                       </Text>
                       <TouchableOpacity 
                         style={{ 
                           marginTop: 16, 
                           padding: 10, 
                           backgroundColor: 'rgba(239,68,68,0.1)', 
                           borderRadius: 12,
                           borderWidth: StyleSheet.hairlineWidth,
                           borderColor: 'rgba(239, 68, 68, 0.3)',
                           alignSelf: 'center'
                         }}
                         onPress={onCancel}
                       >
                         <Text style={{ color: '#ef4444', fontSize: 13, fontWeight: '700' }}>Cancel Transfer</Text>
                       </TouchableOpacity>
                     </View>
                   )}
 
                   {errorText && (
                     <Text style={{ color: '#ef4444', fontSize: 12, textAlign: 'center', marginTop: 12, fontWeight: '600' }}>
                         {errorText}
                     </Text>
                   )}
 
                   <View style={{
                     marginTop: 24,
                     paddingVertical: 10,
                     paddingHorizontal: 16,
                     backgroundColor: 'rgba(16,185,129,0.05)',
                     borderRadius: 14,
                     borderWidth: StyleSheet.hairlineWidth,
                     borderColor: 'rgba(16, 185, 129, 0.22)',
                     flexDirection: 'row',
                     alignItems: 'center',
                     justifyContent: 'center',
                     gap: 10
                   }}>
                     <Ionicons name="shield-checkmark" size={16} color="#10b981" />
                     <View>
                       <Text style={{ color: '#10b981', fontSize: 11, fontWeight: '800', letterSpacing: 0.3 }}>
                         SECURED & AUTHORIZED BY PESAPAL
                       </Text>
                       <Text style={{ color: '#065f46', fontSize: 9, fontWeight: '600' }}>
                         OFFICIAL UGANDAN PAYMENT GATEWAY
                       </Text>
                     </View>
                   </View>
                </>
              )}
            </TouchableOpacity>
          </TouchableOpacity>
        </BlurView>
      </Modal>

      {/* ── Billing History Modal ── */}
      <Modal
        visible={showBillingHistory}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBillingHistory(false)}
        statusBarTranslucent={true}
      >
        <BlurView intensity={80} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.85)' }]}>
           <LinearGradient
            colors={['rgba(15,15,20,0.95)', 'rgba(20,20,28,0.95)', 'rgba(15,15,20,0.95)']}
            style={StyleSheet.absoluteFill}
          />
          <TouchableOpacity
            style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 24 }}
            activeOpacity={1}
            onPress={() => setShowBillingHistory(false)}
          >
            <TouchableOpacity
              activeOpacity={1}
              style={{
                width: '100%',
                backgroundColor: '#1E1E2D',
                borderRadius: 28,
                padding: 20,
                paddingTop: 12,
                paddingBottom: Platform.OS === 'android' ? (insets.bottom > 0 ? insets.bottom + 12 : 24) : Math.max(insets.bottom + 10, 40),
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: 'rgba(255, 255, 255, 0.22)',
                marginBottom: 60, // Consistent "more up" positioning
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.5,
                shadowRadius: 20,
              }}
            >
              <View style={{ width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, alignSelf: 'center', marginBottom: 24 }} />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                <View>
                  <Text style={{ color: '#fff', fontSize: 24, fontWeight: '900' }}>Billing History</Text>
                  <Text style={{ color: '#94a3b8', fontSize: 13, marginTop: 2 }}>Track your previous subscriptions</Text>
                </View>
                <TouchableOpacity
                  style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' }}
                  onPress={() => setShowBillingHistory(false)}
                >
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
                {billingHistory.map((item, idx) => (
                  <View key={item.id} style={{
                    marginBottom: 16,
                    padding: 16,
                    borderRadius: 20,
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: 'rgba(255, 255, 255, 0.12)'
                  }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <View>
                        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{item.plan}</Text>
                        <Text style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>{item.date}</Text>
                      </View>
                      <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: 'rgba(52,211,153,0.1)' }}>
                        <Text style={{ color: '#34d399', fontSize: 11, fontWeight: '800' }}>PAID</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255, 255, 255, 0.12)' }}>
                      <Text style={{ color: '#94a3b8', fontSize: 14 }}>{item.method}</Text>
                      <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900' }}>{item.amount}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>

              <TouchableOpacity
                style={{
                  marginTop: 24,
                  height: 56,
                  borderRadius: 16,
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  alignItems: 'center', justifyContent: 'center'
                }}
                onPress={() => setShowBillingHistory(false)}
              >
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Close History</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </BlurView>
      </Modal>
    </>
  );
};
