import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface DeviceManagerModalProps {
  visible: boolean;
  activeDeviceIds: string[];
  currentDeviceId: string | null;
  onRemoveDevice: (id: string) => Promise<void>;
  onClose: () => void;
  planName: string;
  limit: number;
}

const DeviceManagerModal: React.FC<DeviceManagerModalProps> = ({
  visible,
  activeDeviceIds,
  currentDeviceId,
  onRemoveDevice,
  onClose,
  planName,
  limit
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
        
        <View style={styles.container}>
          <LinearGradient
            colors={['rgba(30, 30, 45, 0.95)', 'rgba(10, 10, 15, 0.98)']}
            style={styles.content}
          >
            <View style={styles.header}>
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons name="cellphone-key" size={40} color="#f59e0b" />
              </View>
              <Text style={styles.title}>Device Limit Reached</Text>
              <Text style={styles.subtitle}>
                Your <Text style={styles.highlight}>{planName}</Text> plan allows up to <Text style={styles.highlight}>{limit} {limit === 1 ? 'device' : 'devices'}</Text>.
              </Text>
            </View>

            <View style={styles.divider} />

            <Text style={styles.sectionTitle}>Manage Registered Devices</Text>
            <Text style={styles.instruction}>
              To use this device, you must remove an old one from your account slots.
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
                      <TouchableOpacity 
                        style={styles.removeBtn}
                        onPress={() => onRemoveDevice(id)}
                      >
                        <Text style={styles.removeText}>DEACTIVATE</Text>
                      </TouchableOpacity>
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
                <Text style={styles.closeBtnText}>I'll do this later</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.upgradeBtn} activeOpacity={0.8}>
                <LinearGradient
                  colors={['#6366f1', '#4f46e5']}
                  style={styles.upgradeGradient}
                >
                  <Text style={styles.upgradeText}>UPGRADE PLAN</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </View>
    </Modal>
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
    height: 1,
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
});

export default DeviceManagerModal;
