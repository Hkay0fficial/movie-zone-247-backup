import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from './menu.styles';

interface Plan {
  name: string;
  price: string;
  currency: string;
  tag: string | null;
  color: string;
  glowColor: string;
  ctaSuffix: string;
  specs: string[];
}

interface ChoosePlanSectionProps {
  isSubscribed: boolean;
  subscriptionBundle: string;
  upcomingMembership: any;
  setSelectedPlanForPayment: (plan: any) => void;
  handleShowPaymentModal: (show: boolean) => void;
  isGuest?: boolean;
  onGuestPlanSelect?: () => void;
}

export const ChoosePlanSection: React.FC<ChoosePlanSectionProps> = ({
  isSubscribed,
  subscriptionBundle,
  upcomingMembership,
  setSelectedPlanForPayment,
  handleShowPaymentModal,
  isGuest,
  onGuestPlanSelect,
}) => {
  const plans: Plan[] = [
    {
      name: '1 week [+1 day bonus]',
      price: '2,500',
      currency: 'Ugx',
      tag: null,
      color: '#6366f1',
      glowColor: 'rgba(99, 102, 241, 0.4)',
      ctaSuffix: 'AS LOW AS 357 Ugx A DAY',
      specs: ['FHD / HD Streaming', 'Unlimited movies and series', 'Ad-free experience', 'Access to all content', 'Unlimited in-app download', '1 external download', '1 device']
    },
    {
      name: '2 weeks [+2 days bonus]',
      price: '5,000',
      currency: 'Ugx',
      tag: 'MOST POPULAR',
      color: '#8338ec',
      glowColor: 'rgba(131, 56, 236, 0.5)',
      ctaSuffix: 'AS LOW AS 357 Ugx A DAY',
      specs: ['FHD / HD Streaming', 'Unlimited movies and series', 'Ad-free experience', 'Access to all content', 'Unlimited in-app download', '2 external downloads', '1 device']
    },
    {
      name: '1 Month [+4 day bonus]',
      price: '10,000',
      currency: 'Ugx',
      tag: 'BEST VALUE',
      color: '#ff006e',
      glowColor: 'rgba(255, 0, 110, 0.5)',
      ctaSuffix: 'AS LOW AS 333 Ugx A DAY',
      specs: ['FHD / HD Streaming', 'Unlimited movies and series', 'Ad-free experience', 'Access to all content', 'Unlimited in-app download', '3 external downloads', '2 devices']
    },
    {
      name: '2 months [+1 week bonus]',
      price: '20,000',
      currency: 'Ugx',
      tag: 'EXCLUSIVE',
      color: '#fb5607',
      glowColor: 'rgba(251, 86, 7, 0.5)',
      ctaSuffix: 'AS LOW AS 333 A DAY',
      specs: ['FHD / HD Streaming', 'Unlimited movies and series', 'Ad-free experience', 'Access to all content', 'Unlimited in-app download', '5 external downloads', '3 devices']
    }
  ];

  return (
    <View style={styles.settingsContentSection}>
      <Text style={styles.settingsText}>Select the best plan for you and your family to enjoy unlimited movies.</Text>
      <View style={{ paddingHorizontal: 20, paddingBottom: 40 }}>
        {plans.map((p) => {
          const planLabel = p.name.split(' [')[0];
          const isActivePlan = isSubscribed && subscriptionBundle === planLabel;
          const isQueuedPlan = upcomingMembership && upcomingMembership.bundle === planLabel;

          return (
            <View key={p.name} style={{ width: '100%', marginBottom: 20 }}>
              {/* Premium Background Glow */}
              <View style={{
                position: 'absolute',
                top: 20,
                left: 20,
                right: 20,
                bottom: 20,
                backgroundColor: isActivePlan ? p.color : isQueuedPlan ? '#818cf8' : p.glowColor,
                borderRadius: 100,
                opacity: (isActivePlan || isQueuedPlan) ? 0.18 : 0.4,
                zIndex: 0,
                shadowColor: isQueuedPlan ? '#818cf8' : p.color,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 1,
                shadowRadius: (isActivePlan || isQueuedPlan) ? 40 : 30,
              }} />

              <View
                style={[
                  {
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: 24,
                    paddingTop: 48,
                    gap: 24,
                    backgroundColor: isActivePlan ? 'rgba(30, 30, 48, 0.98)' : isQueuedPlan ? 'rgba(30, 32, 55, 0.98)' : 'rgba(30, 30, 45, 0.95)',
                    borderRadius: 32,
                    borderWidth: (isActivePlan || isQueuedPlan) ? 1.5 : 1,
                    borderColor: isActivePlan ? p.color : isQueuedPlan ? '#818cf8' : 'rgba(255, 255, 255, 0.1)',
                    shadowColor: isActivePlan ? p.color : isQueuedPlan ? '#818cf8' : '#000',
                    shadowOffset: { width: 0, height: 10 },
                    shadowOpacity: (isActivePlan || isQueuedPlan) ? 0.4 : 0.3,
                    shadowRadius: (isActivePlan || isQueuedPlan) ? 30 : 20,
                    elevation: 12,
                    overflow: 'hidden'
                  }
                ]}
              >
                {/* Background Watermark Price */}
                <View style={{ position: 'absolute', top: -20, left: -20, opacity: 0.03 }}>
                  <Text style={{ fontSize: 180, fontWeight: '900', color: p.color }}>
                    {p.price.replace(',', '')}
                  </Text>
                </View>

                {/* Floating Bonus Pill (Top Right) */}
                {p.name.includes('[') && (
                  <View style={{ 
                    position: 'absolute', 
                    top: 20, 
                    right: 20, 
                    backgroundColor: p.color, 
                    paddingHorizontal: 10, 
                    paddingVertical: 5, 
                    borderRadius: 20,
                    shadowColor: p.color,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.5,
                    shadowRadius: 8,
                    zIndex: 10
                  }}>
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' }}>
                      {p.name.split('[')[1].replace(' bonus]', '').trim()} EXTRA
                    </Text>
                  </View>
                )}

                {/* Centered Title \u0026 Price Stack */}
                <View style={{ alignItems: 'center', width: '100%', marginBottom: 10 }}>
                  <Text style={{ color: p.color, fontSize: 14, fontWeight: '800', letterSpacing: 4, textTransform: 'uppercase', marginBottom: 8 }}>{p.name.split(' [')[0]}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                    <Text style={{ color: '#fff', fontSize: 52, fontWeight: '900', letterSpacing: -2 }}>{p.price}</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 18, fontWeight: '700' }}>{p.currency}</Text>
                  </View>
                  {isActivePlan && (
                    <View style={{ marginTop: 12, backgroundColor: 'rgba(16, 185, 129, 0.15)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                      <Text style={{ color: '#10b981', fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>CURRENT MEMBERSHIP</Text>
                    </View>
                  )}
                </View>

                {/* Divider */}
                <View style={{ width: '60%', height: 1, backgroundColor: 'rgba(255,255,255,0.05)' }} />

                {/* Varied Benefit Icons */}
                <View style={{ width: '100%', gap: 12 }}>
                  {p.specs.map((spec, sIdx) => {
                    let iconName = "checkmark-circle";
                    if (spec.toLowerCase().includes('streaming')) iconName = "videocam";
                    if (spec.toLowerCase().includes('movies')) iconName = "play-circle";
                    if (spec.toLowerCase().includes('ad-free')) iconName = "shield-checkmark";
                    if (spec.toLowerCase().includes('content')) iconName = "layers";
                    if (spec.toLowerCase().includes('download')) iconName = "cloud-download";
                    if (spec.toLowerCase().includes('device')) iconName = "phone-portrait";

                    return (
                      <View key={sIdx} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: 6, borderRadius: 8 }}>
                          <Ionicons name={iconName as any} size={16} color={p.color} />
                        </View>
                        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '500' }}>{spec}</Text>
                      </View>
                    );
                  })}
                </View>

                <View style={{ width: '100%', marginTop: 8 }}>
                  <TouchableOpacity
                    style={{
                      backgroundColor: isQueuedPlan ? 'rgba(255,255,255,0.03)' : p.color,
                      paddingVertical: 16,
                      borderRadius: 20,
                      alignItems: 'center',
                      borderWidth: isQueuedPlan ? 1.5 : 0,
                      borderColor: isQueuedPlan ? 'rgba(255,255,255,0.1)' : 'transparent',
                      shadowColor: isQueuedPlan ? 'transparent' : p.color,
                      shadowOffset: { width: 0, height: 8 },
                      shadowOpacity: 0.4,
                      shadowRadius: 12,
                      elevation: isQueuedPlan ? 0 : 8
                    }}
                    onPress={() => {
                      if (!isQueuedPlan) {
                        if (isGuest && onGuestPlanSelect) {
                          onGuestPlanSelect();
                        } else {
                          setSelectedPlanForPayment(p);
                          handleShowPaymentModal(true);
                        }
                      }
                    }}
                    disabled={isQueuedPlan}
                  >
                    {isActivePlan ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Ionicons name="flash" size={16} color="#fff" />
                        <Text style={{ color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 1 }}>EXTEND ACCESS</Text>
                      </View>
                    ) : isQueuedPlan ? (
                      <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 15, fontWeight: '900' }}>QUEUED</Text>
                    ) : (
                      <View style={{ alignItems: 'center' }}>
                        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 }}>GET STARTED</Text>
                        {p.ctaSuffix && (
                          <Text style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 10, fontWeight: '600', marginTop: 2 }}>{p.ctaSuffix}</Text>
                        )}
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};
