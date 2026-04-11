import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { styles } from './menu.styles';

interface Device {
  id: string;
  device: string;
  location: string;
  time: string;
  current: boolean;
}

interface BillingItem {
  id: string;
  plan: string;
  amount: string;
  date: string;
  method: string;
}

interface SubscriptionSectionProps {
  showBillingHistory: boolean;
  setShowBillingHistory: (show: boolean) => void;
  isSubscribed: boolean;
  subscriptionBundle: string;
  subscriptionSpecs: string[];
  subscriptionBonus: string | null;
  remainingDays: number;
  downloadsUsedToday: number;
  getExternalDownloadLimit: () => number;
  getRemainingDownloads: () => number;
  renewalDate: string;
  paymentMethod: string;
  activeDevices: Device[];
  getDeviceLimit: () => number;
  handleKickDevice: (id: string) => void;
  billingHistory: BillingItem[];
  upcomingMembership?: {
    bundle: string;
    days: number;
    bonus?: string;
    specs: string[];
    startDate?: string;
    expiryDate?: string;
  } | null;
  currentScrollY: number;
  setSavedScrollPosition: (pos: number) => void;
  setCameFromSubscription: (val: boolean) => void;
  setSelectedItem: (item: any) => void;
  handleShowPaymentModal: (show: boolean) => void;
  toggleSettingsModal: (item: any) => void;
  MENU_ITEMS: any[];
}

export const SubscriptionSection: React.FC<SubscriptionSectionProps> = ({
  showBillingHistory,
  setShowBillingHistory,
  isSubscribed,
  subscriptionBundle,
  subscriptionSpecs,
  subscriptionBonus,
  remainingDays,
  downloadsUsedToday,
  getExternalDownloadLimit,
  getRemainingDownloads,
  renewalDate,
  paymentMethod,
  activeDevices,
  getDeviceLimit,
  handleKickDevice,
  billingHistory,
  upcomingMembership,
  currentScrollY,
  setSavedScrollPosition,
  setCameFromSubscription,
  setSelectedItem,
  handleShowPaymentModal,
  toggleSettingsModal,
  MENU_ITEMS,
}) => {
  if (showBillingHistory) {
    return (
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900', marginBottom: 20 }}>Billing History</Text>

        {billingHistory.length === 0 ? (
          <View style={{ alignItems: 'center', marginTop: 60 }}>
            <Ionicons name="receipt-outline" size={48} color="rgba(255,255,255,0.05)" />
            <Text style={{ color: '#475569', fontSize: 14, marginTop: 12 }}>No transactions yet</Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
            {billingHistory.map((item) => (
              <View key={item.id} style={[styles.historyCard, { borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1 }]}>
                <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                <View style={{ padding: 20 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>{item.plan} Plan</Text>
                    <Text style={{ color: '#f59e0b', fontSize: 16, fontWeight: '900' }}>{item.amount}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Ionicons name="calendar-outline" size={12} color="#94a3b8" />
                    <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '600' }}>{item.date}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name={item.method?.includes('Card') ? "card-outline" : "phone-portrait-outline"} size={12} color="#cbd5e1" />
                    <Text style={{ color: '#cbd5e1', fontSize: 12, fontWeight: '500' }}>{item.method}</Text>
                  </View>
                  <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, position: 'absolute', bottom: 8, right: 12, fontWeight: '800' }}>{item.id}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    );
  }

  return (
    <>
      <Text style={styles.settingsText}>Manage your premium subscription, billing history, and payment methods.</Text>

      {!isSubscribed ? (
        <View style={{ alignItems: 'center', paddingVertical: 40, gap: 16 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.03)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
            <Ionicons name="diamond-outline" size={40} color="#475569" />
          </View>
          <Text style={{ color: '#94a3b8', fontSize: 16, fontWeight: '700', textAlign: 'center' }}>No Active Subscription</Text>
          <TouchableOpacity
            style={{ backgroundColor: '#f59e0b', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
            onPress={() => toggleSettingsModal(MENU_ITEMS.find(m => m.id === '3') || null)}
          >
            <Text style={{ color: '#fff', fontWeight: '900' }}>CHOOSE A PLAN</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.coverageBlur}>
            <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.coverageContent}>
              <View>
                <Text style={styles.coverageLabel}>Total Premium Coverage</Text>
                <Text style={styles.coverageValue}>{remainingDays + (upcomingMembership?.days || 0)} Days</Text>
              </View>
              <Ionicons name="shield-checkmark" size={28} color="#10b981" />
            </View>
          </View>

          <View style={styles.glassSubscriptionCard}>
            <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={{ padding: 24 }}>
              <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '900', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 16 }}>Active Membership</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Plan</Text>
                  <View>
                    <Text style={[styles.detailValue, { color: '#f59e0b', fontSize: 18, fontWeight: '800' }]}>{subscriptionBundle}</Text>
                    {subscriptionBonus ? (
                      <Text style={{ color: '#f59e0b', fontSize: 11, fontWeight: '700', marginTop: 2 }}>{subscriptionBonus}</Text>
                    ) : null}
                  </View>
                </View>
                <View style={[styles.profileBadge, { marginTop: 0, backgroundColor: 'rgba(245, 158, 11, 0.15)', borderWidth: 0 }]}>
                  <Ionicons name="flash" size={12} color="#f59e0b" />
                  <Text style={[styles.profileBadgeText, { color: '#f59e0b' }]}>ACTIVE</Text>
                </View>
              </View>

              <View style={styles.cardDivider} />

              <View style={styles.detailRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Ionicons name="folder-outline" size={14} color="#818cf8" />
                  <Text style={styles.detailLabel}>External Downloads (Daily limit)</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                  <Text style={[styles.detailValue, { color: getRemainingDownloads() > 0 ? '#10b981' : '#f43f5e', fontSize: 24, fontWeight: '800' }]}>
                    {subscriptionBundle.toLowerCase().includes('vip') ? 'Unlimited' : `${downloadsUsedToday} / ${getExternalDownloadLimit()}`}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>
                    {subscriptionBundle.toLowerCase().includes('vip') ? 'Elite Status' : getRemainingDownloads() > 0 ? `${getRemainingDownloads()} Remaining` : 'Limit Reached'}
                  </Text>
                </View>
              </View>

              <View style={styles.cardDivider} />

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Plan Duration</Text>
                <Text style={[styles.detailValue, { fontSize: 16, color: subscriptionBundle === 'VIP' ? '#10b981' : '#f1f5f9' }]}>
                  {subscriptionBundle === 'VIP' ? 'Never Expires' : `Ends on ${renewalDate}`}
                </Text>
              </View>

              <View style={styles.cardDivider} />

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Payment & Authentication</Text>
                
                {paymentMethod.toLowerCase().includes('admin') || paymentMethod.toLowerCase().includes('gift') ? (
                  <View style={{ marginTop: 10, alignSelf: 'flex-start' }}>
                    <View style={{
                      height: 34,
                      borderRadius: 17,
                      overflow: 'hidden',
                      borderWidth: 1.5,
                      borderColor: 'rgba(245, 158, 11, 0.5)',
                      backgroundColor: 'rgba(245, 158, 11, 0.05)',
                    }}>
                      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
                      <LinearGradient
                        colors={['rgba(245, 158, 11, 0.25)', 'rgba(217, 119, 6, 0.15)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                      />
                      <LinearGradient
                        colors={['rgba(255, 255, 255, 0.12)', 'transparent', 'rgba(255, 255, 255, 0.05)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0.5, y: 1 }}
                        style={StyleSheet.absoluteFill}
                      />
                      <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingHorizontal: 16,
                        height: '100%',
                        gap: 10
                      }}>
                        <View style={{
                          backgroundColor: '#f59e0b',
                          width: 20,
                          height: 20,
                          borderRadius: 10,
                          alignItems: 'center',
                          justifyContent: 'center',
                          shadowColor: '#f59e0b',
                          shadowOffset: { width: 0, height: 0 },
                          shadowOpacity: 0.8,
                          shadowRadius: 8,
                          elevation: 6,
                        }}>
                          <Ionicons name="shield-checkmark" size={13} color="#fff" />
                        </View>
                        <View>
                          <Text style={{
                            color: '#fbbf24',
                            fontSize: 12,
                            fontWeight: '900',
                            letterSpacing: 0.8,
                            textTransform: 'uppercase',
                            textShadowColor: 'rgba(245, 158, 11, 0.4)',
                            textShadowOffset: { width: 0, height: 1 },
                            textShadowRadius: 2,
                          }}>
                            ADMINISTRATIVE GRANT
                          </Text>
                          <View style={{ 
                            flexDirection: 'row', 
                            alignItems: 'center', 
                            marginTop: -1,
                            opacity: 0.8 
                          }}>
                            <View style={{ 
                              width: 3, 
                              height: 3, 
                              borderRadius: 1.5, 
                              backgroundColor: 'rgba(245, 158, 11, 0.6)',
                              marginRight: 4 
                            }} />
                            <Text style={{ 
                              color: 'rgba(245, 158, 11, 0.9)', 
                              fontSize: 9, 
                              fontWeight: '800',
                              letterSpacing: 0.5,
                              textTransform: 'uppercase'
                            }}>
                              Activated by Admin
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <Ionicons 
                      name={paymentMethod.includes('Card') ? "card-outline" : "phone-portrait-outline"} 
                      size={16} 
                      color="rgba(255,255,255,0.4)" 
                    />
                    <Text style={[styles.detailValue, { fontSize: 16, color: "#f1f5f9" }]}>
                      {paymentMethod}
                    </Text>
                  </View>
                )}
              </View>

              <View style={{ marginTop: 20 }}>
                <Text style={{ color: subscriptionBundle === 'VIP' ? '#a855f7' : '#64748b', fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>
                  {subscriptionBundle === 'VIP' ? 'VIP Membership Benefits' : 'Active Plan Benefits'}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  {(subscriptionSpecs).map((spec: string, idx: number) => {
                    let bColor = '#6366f1';
                    let bIcon = 'checkmark-circle';
                    const s = spec.toLowerCase();
                    if (s.includes('quality') || s.includes('2k') || s.includes('fhd')) { bColor = '#0ea5e9'; bIcon = 'videocam'; }
                    else if (s.includes('movies') || s.includes('content') || s.includes('unlimited')) { bColor = '#8b5cf6'; bIcon = 'play-circle'; }
                    else if (s.includes('ad-free')) { bColor = '#ec4899'; bIcon = 'shield-checkmark'; }
                    else if (s.includes('download')) { bColor = '#f59e0b'; bIcon = 'cloud-download'; }
                    else if (s.includes('device')) { bColor = '#10b981'; bIcon = 'phone-portrait'; }
                    else if (s.includes('access')) { bColor = '#06b6d4'; bIcon = 'layers'; }
                    return (
                      <View key={idx} style={[styles.benefitTag, { backgroundColor: bColor + '15', borderColor: bColor + '30', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 12 }]}>
                        <Ionicons name={bIcon as any} size={14} color={bColor} />
                        <Text style={[styles.benefitTagText, { color: bColor, fontSize: 11, fontWeight: '700' }]}>{spec}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>

              <View style={styles.cardDivider} />

              <View style={{ marginTop: 12 }}>
                  <Text style={styles.detailLabel}>Active Devices ({activeDevices.length}/{getDeviceLimit()})</Text>
                <View style={{ gap: 8 }}>
                  {activeDevices.map((device) => (
                    <View key={device.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: device.current ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name={device.device.includes('iPhone') || device.device.includes('Phone') ? "phone-portrait-outline" : "desktop-outline"} size={14} color={device.current ? '#10b981' : 'rgba(255,255,255,0.4)'} />
                        </View>
                        <View>
                          <Text style={{ color: '#f1f5f9', fontSize: 12, fontWeight: '700' }}>{device.device}</Text>
                          <Text style={{ color: '#64748b', fontSize: 10 }}>{device.location} • {device.time}</Text>
                        </View>
                      </View>
                      {!device.current && (
                        <TouchableOpacity onPress={() => handleKickDevice(device.id)} style={{ padding: 4 }}>
                          <Ionicons name="log-out-outline" size={16} color="#ef4444" />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>
              </View>

              {upcomingMembership && (
                <>
                  <View style={[styles.cardDivider, { marginVertical: 24, backgroundColor: 'rgba(255,255,255,0.06)' }]} />
                  <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '900', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 16 }}>Upcoming Membership</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Next Plan</Text>
                      <View>
                        <Text style={[styles.detailValue, { color: '#818cf8', fontSize: 18, fontWeight: '800' }]}>{upcomingMembership.bundle}</Text>
                        {upcomingMembership.bonus ? (
                          <Text style={{ color: '#818cf8', fontSize: 11, fontWeight: '700', marginTop: 2 }}>{upcomingMembership.bonus}</Text>
                        ) : null}
                      </View>
                    </View>
                    <View style={[styles.profileBadge, { marginTop: 0, backgroundColor: 'rgba(129, 140, 248, 0.15)', borderColor: '#818cf8', borderWidth: 0 }]}>
                      <Ionicons name="time" size={12} color="#818cf8" />
                      <Text style={[styles.profileBadgeText, { color: '#818cf8' }]}>QUEUED</Text>
                    </View>
                  </View>

                  <View style={{ marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <Ionicons name="calendar-outline" size={12} color="#94a3b8" />
                      <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '700' }}>Starting from {upcomingMembership.startDate || 'next renewal'}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="log-out-outline" size={12} color="#64748b" />
                      <Text style={{ color: '#64748b', fontSize: 11, fontWeight: '600' }}>Valid until {upcomingMembership.expiryDate || '...'}</Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                    {(upcomingMembership.specs || []).map((spec: string, idx: number) => {
                      let bColor = '#6366f1';
                      let bIcon = 'checkmark-circle';
                      const s = spec.toLowerCase();
                      if (s.includes('quality') || s.includes('2k') || s.includes('fhd')) { bColor = '#0ea5e9'; bIcon = 'videocam'; }
                      else if (s.includes('movies') || s.includes('content') || s.includes('unlimited')) { bColor = '#8b5cf6'; bIcon = 'play-circle'; }
                      else if (s.includes('ad-free')) { bColor = '#ec4899'; bIcon = 'shield-checkmark'; }
                      else if (s.includes('download')) { bColor = '#f59e0b'; bIcon = 'cloud-download'; }
                      else if (s.includes('device')) { bColor = '#10b981'; bIcon = 'phone-portrait'; }
                      else if (s.includes('access')) { bColor = '#06b6d4'; bIcon = 'layers'; }
                      return (
                        <View key={idx} style={{ backgroundColor: bColor + '10', flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, borderWidth: 1, borderColor: bColor + '20' }}>
                          <Ionicons name={bIcon as any} size={10} color={bColor} />
                          <Text style={{ color: bColor, fontSize: 10, fontWeight: '700' }}>{spec}</Text>
                        </View>
                      );
                    })}
                  </View>
                </>
              )}

            </View>
          </View>

          <View style={[styles.settingsList, { backgroundColor: 'rgba(255,255,255,0.02)', padding: 8, borderRadius: 20, marginTop: 12 }]}>
            {[
              { label: 'Billing History', icon: 'receipt-outline', color: '#818cf8', action: () => { setSavedScrollPosition(currentScrollY); setShowBillingHistory(true); } },
              { label: 'Upgrade Plan', icon: 'options-outline', color: '#f59e0b', action: () => { setSavedScrollPosition(currentScrollY); setCameFromSubscription(true); setSelectedItem(MENU_ITEMS.find(m => m.id === '3') || null); } }
            ].map((item, index, l) => (
              <TouchableOpacity key={item.label} style={[styles.settingsRow, index === l.length - 1 && { borderBottomWidth: 0 }, { height: 56, paddingHorizontal: 16 }]} onPress={item.action}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: item.color + '15', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={item.icon as any} size={20} color={item.color} />
                  </View>
                  <Text style={[styles.settingsRowText, { color: '#f1f5f9', fontWeight: '700' }]}>{item.label}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
    </>
  );
};
