import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Dimensions, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

interface PremiumAlertButton {
  text: string;
  onPress: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface PremiumAlertProps {
  visible: boolean;
  title: string;
  message: string;
  buttons: PremiumAlertButton[];
  onClose: () => void;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  iconColor?: string;
}

const PremiumAlert: React.FC<PremiumAlertProps> = ({
  visible,
  title,
  message,
  buttons,
  onClose,
  icon = 'information-outline',
  iconColor = '#6366f1'
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
        
        <View style={styles.container}>
          <LinearGradient
            colors={['rgba(30, 30, 45, 0.98)', 'rgba(10, 10, 15, 0.98)'] as any}
            style={styles.content}
          >
            <View style={styles.iconWrapper}>
              <View style={[styles.iconContainer, { backgroundColor: `${iconColor}15` }]}>
                <MaterialCommunityIcons name={icon} size={32} color={iconColor} />
              </View>
            </View>

            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>

            <View style={styles.buttonContainer}>
              {buttons.map((button, index) => {
                const isCancel = button.style === 'cancel';
                const isDestructive = button.style === 'destructive';
                
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.button,
                      isCancel && styles.cancelButton,
                      isDestructive && styles.destructiveButton,
                      buttons.length > 2 && styles.verticalButton
                    ]}
                    onPress={() => {
                      button.onPress();
                      onClose();
                    }}
                  >
                    {isDestructive || (!isCancel && index === buttons.length - 1) ? (
                      <LinearGradient
                        colors={isDestructive ? ['#ef4444', '#dc2626'] : ['#6366f1', '#4f46e5']}
                        style={styles.gradientButton}
                      >
                        <Text style={styles.buttonText}>{button.text}</Text>
                      </LinearGradient>
                    ) : (
                      <Text style={[styles.buttonText, isCancel && styles.cancelText]}>
                        {button.text}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
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
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 24,
  },
  container: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  content: {
    padding: 24,
    alignItems: 'center',
  },
  iconWrapper: {
    marginBottom: 16,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  message: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  buttonContainer: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  verticalButton: {
    width: '100%',
    marginBottom: 8,
  },
  gradientButton: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  cancelButton: {
    backgroundColor: 'transparent',
  },
  cancelText: {
    color: '#64748b',
  },
  destructiveButton: {
    backgroundColor: 'transparent',
  },
});

export default PremiumAlert;
