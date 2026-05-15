import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Platform, TextInput, ActivityIndicator, Alert, Keyboard } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface DeviceManagerModalProps {
  visible: boolean;
  activeDeviceIds: string[];
  currentDeviceId: string | null;
  onRemoveDevice: (id: string) => Promise<void>;
  onClose: () => void;
  onUpgrade: () => void;
  planName: string;
  limit: number;
  removalRequests?: Record<string, { status: string; requestedAt: string }>;
  onRemoteLogout?: (id: string, pin: string) => Promise<void>;
  hasSecurityPin?: boolean;
  onSwitchAccount?: (mode?: 'login' | 'signup') => void;
  isLoggingOut?: boolean;
}

const DeviceManagerModal: React.FC<DeviceManagerModalProps> = ({
  visible,
  activeDeviceIds,
  currentDeviceId,
  onRemoveDevice,
  onClose,
  onUpgrade,
  planName,
  limit,
  removalRequests = {},
  onRemoteLogout,
  hasSecurityPin = false,
  onSwitchAccount,
  isLoggingOut,
}) => {
  const [pin, setPin] = React.useState('');
  const [isPinVisible, setIsPinVisible] = React.useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = React.useState<string | null>(null);
  const [isKicking, setIsKicking] = React.useState(false);
  const [showPin, setShowPin] = React.useState(false);

  const handleForceKickPress = (id: string) => {
    if (!hasSecurityPin) {
      Alert.alert(
        "Security PIN Required",
        "You haven't set a Security PIN yet. Please go to Menu > My Account > Password & Security to set one before you can force kick devices.",
        [{ text: "OK" }]
      );
      return;
    }
    setSelectedDeviceId(id);
    setIsPinVisible(true);
    setPin('');
  };

  const handleConfirmKick = async () => {
    if (!selectedDeviceId || !onRemoteLogout) return;
    if (pin.length < 4) {
      Alert.alert("Invalid PIN", "Please enter a valid 4-6 digit Security PIN.");
      return;
    }

    setIsKicking(true);
    try {
      await onRemoteLogout(selectedDeviceId, pin);
      setIsPinVisible(false);
      setSelectedDeviceId(null);
      setPin('');
      Keyboard.dismiss();
    } catch (error: any) {
      Alert.alert("Verification Failed", error.message || "Incorrect Security PIN. Please try again.");
    } finally {
      setIsKicking(false);
    }
  };

  const isNoPlan = planName === 'None';
  const planLabel = isNoPlan ? 'account' : `${planName} plan`;

  return (
    <>
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {}}
    >
      <View style={styles.overlay}>
        <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
        
        <View style={styles.container}>
            <LinearGradient
              colors={['#1e1e2d', '#0a0a0f'] as any}
              style={styles.content}
            >
              {isLoggingOut && (
                <View style={[StyleSheet.absoluteFill, styles.loadingOverlay]}>
                  <ActivityIndicator size="large" color="#10b981" />
                  <Text style={styles.loadingText}>Switching account...</Text>
                </View>
              )}
              <View style={styles.header}>
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons name="cellphone-key" size={40} color="#f59e0b" />
              </View>
              <Text style={styles.title}>Device Limit Reached</Text>
              <Text style={styles.subtitle}>
                {isNoPlan
                  ? 'This account is not subscribed. You can continue as guest or upgrade to unlock more access.'
                  : <>Your <Text style={styles.highlight}>{planLabel}</Text> allows up to <Text style={styles.highlight}>{limit} {limit === 1 ? 'device' : 'devices'}</Text>.</>}
              </Text>
            </View>


            <View style={styles.divider} />

            <Text style={styles.sectionTitle}>Manage Registered Devices</Text>
            
            <Text style={styles.instruction}>
              To use this device with the same account, request approval from a registered device or upgrade your plan.
            </Text>

            <ScrollView style={styles.deviceList} contentContainerStyle={styles.listContent}>
              {activeDeviceIds.map((id, index) => {
                const isCurrent = id === currentDeviceId;
                return (
                  <View key={id} style={[styles.deviceItem, isCurrent && styles.currentDevice]}>
                    <View style={styles.deviceInfo}>
                      <Ionicons 
                        name={Platform.OS === 'ios' ? "logo-apple" : "logo-android"} 
                        size={24} 
                        color={isCurrent ? "#10b981" : "#64748b"} 
                      />
                      <View style={styles.deviceText}>
                        <Text style={styles.deviceName}>
                          {isCurrent ? "This Device" : `Registered Device ${index + 1}`}
                        </Text>
                        <Text style={styles.deviceId} numberOfLines={1}>{id}</Text>
                      </View>
                    </View>
                    
                    {!isCurrent && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {removalRequests[id]?.status === 'pending' && (
                          <View style={styles.pendingBadge}>
                            <Text style={styles.pendingText}>PENDING...</Text>
                          </View>
                        )}
                        {removalRequests[id]?.status === 'denied' && (
                          <View style={styles.deniedBadge}>
                            <Text style={styles.deniedText}>REFUSED</Text>
                          </View>
                        )}
                        <TouchableOpacity 
                          style={[
                            styles.removeBtn, 
                            removalRequests[id]?.status === 'denied' && styles.forceBtn
                          ]}
                          onPress={() => {
                            if (removalRequests[id]?.status === 'denied') {
                              handleForceKickPress(id);
                            } else {
                              onRemoveDevice(id);
                            }
                          }}
                        >
                          <Text style={[
                            styles.removeText,
                            removalRequests[id]?.status === 'denied' && styles.forceText
                          ]}>
                            {removalRequests[id]?.status === 'denied' ? 'FORCE KICK' : 'DEACTIVATE'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    {isCurrent && (
                      <View style={styles.activeBadge}>
                        <Text style={styles.activeText}>ACTIVE</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <Text style={styles.closeBtnText}>I will do this later</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.upgradeBtn} activeOpacity={0.8} onPress={onUpgrade}>
                <LinearGradient
                  colors={['#6366f1', '#4f46e5'] as any}
                  style={styles.upgradeGradient}
                >
                  <Text style={styles.upgradeText}>UPGRADE PLAN</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {onSwitchAccount && (
                <View style={styles.bottomAuthSection}>
                  <TouchableOpacity 
                    style={styles.bottomAuthBtn} 
                    onPress={() => onSwitchAccount('login')}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="swap-horizontal" size={16} color="#94a3b8" />
                    <Text style={styles.bottomAuthText}>Switch Account</Text>
                  </TouchableOpacity>

                  <View style={styles.bottomAuthDivider} />

                  <TouchableOpacity 
                    style={styles.bottomAuthBtn} 
                    onPress={() => onSwitchAccount('signup')}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="person-add-outline" size={16} color="#10b981" />
                    <Text style={styles.bottomSignUpText}>Sign Up</Text>
                  </TouchableOpacity>
                </View>
            )}
          </LinearGradient>
        </View>
      </View>
    </Modal>

    <Modal
      visible={isPinVisible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.pinContainer}>
          <LinearGradient
            colors={['rgba(30, 30, 45, 0.95)', 'rgba(10, 10, 15, 0.98)'] as any}
            style={styles.pinContent}
          >
            <View style={styles.pinHeader}>
              <View style={[styles.iconContainer, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                <Ionicons name="shield-checkmark" size={32} color="#ef4444" />
              </View>
              <Text style={styles.pinTitle}>Confirm Force Kick</Text>
              <Text style={styles.pinSubtitle}>Enter your Security PIN to remotely log out this device.</Text>
            </View>

            <View style={styles.pinInputWrapper}>
              <TextInput
                style={styles.pinInput}
                value={pin}
                onChangeText={(val) => setPin(val.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                placeholderTextColor="#475569"
                keyboardType="numeric"
                secureTextEntry={!showPin}
                autoFocus
              />
              <TouchableOpacity 
                style={styles.pinEye}
                onPress={() => setShowPin(!showPin)}
              >
                <Ionicons name={showPin ? "eye-off-outline" : "eye-outline"} size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={styles.pinFooter}>
              <TouchableOpacity 
                style={styles.pinCancelBtn} 
                onPress={() => {
                  setIsPinVisible(false);
                  setSelectedDeviceId(null);
                }}
                disabled={isKicking}
              >
                <Text style={styles.pinCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.pinConfirmBtn, isKicking && { opacity: 0.7 }]} 
                onPress={handleConfirmKick}
                disabled={isKicking}
              >
                {isKicking ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.pinConfirmText}>VERIFY & KICK</Text>
                )}
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </View>
    </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  content: {
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
  },
  highlight: {
    color: '#f59e0b',
    fontWeight: 'bold',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 8,
  },
  instruction: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 18,
    marginBottom: 20,
  },
  deviceList: {
    maxHeight: 250,
    marginBottom: 24,
  },
  listContent: {
    gap: 12,
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  currentDevice: {
    borderColor: 'rgba(16, 185, 129, 0.3)',
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
  },
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  deviceText: {
    flex: 1,
  },
  deviceName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f1f5f9',
    marginBottom: 2,
  },
  deviceId: {
    fontSize: 10,
    color: '#475569',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  removeBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  removeText: {
    color: '#ef4444',
    fontSize: 10,
    fontWeight: '800',
  },
  activeBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  activeText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '800',
  },
  pendingBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  pendingText: {
    color: '#f59e0b',
    fontSize: 9,
    fontWeight: '800',
  },
  deniedBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  deniedText: {
    color: '#ef4444',
    fontSize: 9,
    fontWeight: '800',
  },
  forceBtn: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  forceText: {
    color: '#fff',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
  },
  closeBtn: {
    flex: 1,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  closeBtnText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  upgradeBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
  },
  upgradeGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  upgradeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  pinContainer: {
    width: '90%',
    maxWidth: 340,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  pinContent: {
    padding: 24,
  },
  pinHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  pinTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  pinSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 18,
  },
  pinInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  pinInput: {
    flex: 1,
    height: 56,
    color: '#fff',
    fontSize: 24,
    letterSpacing: 8,
    textAlign: 'center',
    fontWeight: '700',
  },
  pinEye: {
    padding: 8,
  },
  pinFooter: {
    flexDirection: 'row',
    gap: 12,
  },
  pinCancelBtn: {
    flex: 1,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  pinCancelText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  pinConfirmBtn: {
    flex: 1.5,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#ef4444',
  },
  pinConfirmText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  bottomAuthSection: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  bottomAuthBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  bottomAuthText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  bottomAuthDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  bottomSignUpText: {
    color: '#10b981',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  loadingOverlay: {
    backgroundColor: 'rgba(10, 10, 15, 0.8)',
    zIndex: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 24,
  },
  loadingText: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
  },
});

export default DeviceManagerModal;
