import React from 'react';
import { 
  Modal, 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Dimensions, 
  Platform 
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

interface ExpiryReminderModalProps {
  visible: boolean;
  onClose: () => void;
  onRenew: () => void;
  remainingDays: number;
  planName: string;
}

export const ExpiryReminderModal: React.FC<ExpiryReminderModalProps> = ({
  visible,
  onClose,
  onRenew,
  remainingDays,
  planName,
}) => {
  const isUrgent = remainingDays <= 2;
  const themeColor = isUrgent ? '#ef4444' : '#f59e0b';
  const themeBg = isUrgent ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        <TouchableOpacity 
          style={StyleSheet.absoluteFill} 
          activeOpacity={1} 
          onPress={onClose} 
        />
        
        <View style={styles.modalContent}>
          <LinearGradient
            colors={['rgba(30, 30, 45, 0.98)', 'rgba(20, 20, 35, 1)']}
            style={styles.gradientBg}
          />
          
          <View style={[styles.iconContainer, { backgroundColor: themeBg }]}>
            <Ionicons 
              name={isUrgent ? "alert-circle" : "time-outline"} 
              size={40} 
              color={themeColor} 
            />
          </View>

          <Text style={styles.title}>
            {isUrgent ? 'Urgent Renewal' : 'Plan Ending Soon'}
          </Text>
          
          <Text style={styles.description}>
            Your <Text style={{ color: themeColor, fontWeight: '800' }}>{planName}</Text> plan will expire in 
            <Text style={{ color: '#fff', fontWeight: '900' }}> {remainingDays} {remainingDays === 1 ? 'day' : 'days'}</Text>. 
            Renew now to ensure uninterrupted premium access.
          </Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.renewButton, { backgroundColor: themeColor }]}
              onPress={onRenew}
              activeOpacity={0.8}
            >
              <Text style={styles.renewButtonText}>RENEW NOW</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.maybeLaterButton}
              onPress={onClose}
            >
              <Text style={styles.maybeLaterText}>Maybe Later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalContent: {
    width: width - 48,
    borderRadius: 32,
    padding: 32,
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  gradientBg: {
    ...StyleSheet.absoluteFillObject,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  renewButton: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  renewButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },
  maybeLaterButton: {
    width: '100%',
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  maybeLaterText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
    fontWeight: '700',
  },
});
