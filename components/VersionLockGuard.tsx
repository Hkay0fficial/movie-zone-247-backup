import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Linking, Platform } from 'react-native';
import { useSubscription } from '@/app/context/SubscriptionContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

// HARDCODED CURRENT VERSION
// Update this string to '2', '3', etc., before building each production APK!
export const CURRENT_APP_VERSION = "1"; 

export default function VersionLockGuard() {
  const { minAppVersion } = useSubscription();
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    if (minAppVersion && minAppVersion.trim() !== '') {
      try {
        // Strip non-digits for a safe integer comparison (e.g., '1.0.5' -> 105 or just use major versions like '2')
        // For simplicity, we recommend using pure integers for your version codes.
        const minVersionInt = parseInt(minAppVersion.replace(/\D/g,''), 10);
        const currentVersionInt = parseInt(CURRENT_APP_VERSION.replace(/\D/g,''), 10);
        
        if (minVersionInt > currentVersionInt) {
          setIsLocked(true);
        } else {
          setIsLocked(false);
        }
      } catch (e) {
        console.error("Error parsing versions", e);
      }
    }
  }, [minAppVersion]);

  if (!isLocked) return null;

  return (
    <Modal visible={true} transparent={true} animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <LinearGradient colors={['#0F0F1A', '#1A1A2E']} style={StyleSheet.absoluteFillObject} />
        
        <View style={styles.container}>
          <Ionicons name="cloud-download-outline" size={80} color="#3b82f6" style={{ marginBottom: 20 }} />
          <Text style={styles.title}>Update Required</Text>
          <Text style={styles.subtitle}>
            A newer version of THE MOVIE ZONE 24/7 is available. You are currently running an unsupported version. Please update the app to continue securely formatting.
          </Text>
          
          <TouchableOpacity 
            style={styles.updateButton}
            activeOpacity={0.8}
            onPress={() => {
              // Direct the user to the generic playstore link
              const url = Platform.OS === 'android' 
                ? 'market://details?id=com.serunkumaharuna.app'
                : 'https://play.google.com/store/apps/details?id=com.serunkumaharuna.app';
              
              Linking.openURL(url).catch(() => {
                Linking.openURL('https://play.google.com/store/apps/details?id=com.serunkumaharuna.app');
              });
            }}
          >
            <LinearGradient colors={['#3b82f6', '#2563eb']} style={StyleSheet.absoluteFillObject} />
            <Text style={styles.updateButtonText}>Update Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 99999,
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    width: '100%',
    maxWidth: 400,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 36,
    lineHeight: 22,
  },
  updateButton: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  updateButtonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.5,
  }
});
