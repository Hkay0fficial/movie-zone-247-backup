import React from 'react';
import { 
  Modal, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform,
  StyleSheet
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { styles } from './menu.styles';

interface TwoFAVerificationModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  verificationCode: string;
  setVerificationCode: (value: string) => void;
  isLoading: boolean;
  onResend?: () => void;
}

export const TwoFAVerificationModal: React.FC<TwoFAVerificationModalProps> = ({
  visible,
  onClose,
  onConfirm,
  verificationCode,
  setVerificationCode,
  isLoading,
  onResend
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
    >
      <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.verifyModalContainer}
        >
          <View style={styles.verifyModalContent}>
            <View style={styles.verifyIconWrap}>
              <Ionicons name="lock-closed" size={32} color="#818cf8" />
            </View>
            <Text style={styles.verifyTitle}>Verify Identity</Text>
            <Text style={styles.verifyDesc}>
              Enter the 6-digit code sent to your registered device. 
              <Text style={{ color: '#818cf8', fontWeight: '800' }}> Tap notification to auto-fill.</Text>
            </Text>

            <TextInput
              style={styles.verifyInput}
              value={verificationCode}
              onChangeText={setVerificationCode}
              placeholder="000000"
              placeholderTextColor="rgba(255,255,255,0.3)"
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />

            <TouchableOpacity 
              style={{ marginTop: 12, alignSelf: 'center' }} 
              onPress={onResend}
            >
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' }}>
                Didn't get a code? Resend
              </Text>
            </TouchableOpacity>

            <View style={styles.verifyActions}>
              <TouchableOpacity 
                style={styles.verifyCancelBtn} 
                onPress={onClose}
              >
                <Text style={styles.verifyCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.verifyConfirmBtn, (verificationCode.length < 6 || isLoading) && { opacity: 0.5 }]} 
                onPress={onConfirm}
                disabled={verificationCode.length < 6 || isLoading}
              >
                {isLoading ? (
                  <Text style={styles.verifyConfirmText}>Verifying...</Text>
                ) : (
                  <Text style={styles.verifyConfirmText}>Confirm</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </BlurView>
    </Modal>
  );
};
