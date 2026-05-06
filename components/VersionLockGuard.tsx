import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Linking, Platform, Dimensions } from 'react-native';
import { useSubscription } from '@/app/context/SubscriptionContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Application from 'expo-application';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_W } = Dimensions.get('window');

/**
 * Compares two semantic version strings (e.g., '1.2.1' and '1.2.0')
 * Returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal.
 */
function compareVersions(v1: string, v2: string): number {
  if (!v1 || !v2) return 0;
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const a = parts1[i] || 0;
    const b = parts2[i] || 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

export default function VersionLockGuard() {
  const { latestVersion, latestBuild, forceUpdate, updateMessage } = useSubscription();
  const [modalType, setModalType] = useState<'locked' | 'prompt' | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  
  const currentVersion = Application.nativeApplicationVersion || "1.2.3";
  const currentBuild = Application.nativeBuildVersion || "1";

  useEffect(() => {
    const checkVersion = async () => {
      if (!latestVersion || latestVersion.trim() === '') return;

      // Check if we already dismissed this specific version today
      const lastDismissedVersion = await AsyncStorage.getItem('last_dismissed_version');
      if (lastDismissedVersion === latestVersion && !forceUpdate) {
        return;
      }

      try {
        const verCompare = compareVersions(latestVersion, currentVersion);
        const buildCompare = Number(latestBuild) > Number(currentBuild);

        const isNewer = verCompare > 0 || (verCompare === 0 && buildCompare);

        if (isNewer) {
          if (forceUpdate) {
            setModalType('locked');
          } else if (!isDismissed) {
            setModalType('prompt');
          }
        } else {
          setModalType(null);
        }
      } catch (e) {
        console.error("Error comparing versions:", e);
      }
    };

    checkVersion();
  }, [latestVersion, latestBuild, forceUpdate, currentVersion, currentBuild, isDismissed]);

  const handleDismiss = async () => {
    setIsDismissed(true);
    setModalType(null);
    // Optionally remember this dismissal for 24 hours or until next version
    await AsyncStorage.setItem('last_dismissed_version', latestVersion);
  };

  const handleUpdate = () => {
    const url = Platform.OS === 'android' 
      ? 'market://details?id=com.moviezone247.app'
      : 'https://play.google.com/store/apps/details?id=com.moviezone247.app';
    
    Linking.openURL(url).catch(() => {
      Linking.openURL('https://play.google.com/store/apps/details?id=com.moviezone247.app');
    });
  };

  if (!modalType) return null;

  const isLocked = modalType === 'locked';

  return (
    <Modal visible={true} transparent={true} animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFillObject} />
        <LinearGradient 
          colors={['rgba(15,15,26,0.8)', 'rgba(10,10,15,0.95)']} 
          style={StyleSheet.absoluteFillObject} 
        />
        
        <View style={styles.container}>
          <View style={[styles.iconContainer, !isLocked && styles.promptIconContainer]}>
            <Ionicons 
              name={isLocked ? "shield-checkmark" : "rocket-outline"} 
              size={44} 
              color={isLocked ? "#ef4444" : "#3b82f6"} 
            />
          </View>
          
          <View style={styles.badge}>
            <Text style={styles.badgeText}>v{latestVersion}</Text>
          </View>

          <Text style={styles.title}>
            {isLocked ? "Action Required" : "Update Available"}
          </Text>
          
          <Text style={styles.subtitle}>
            {updateMessage || (isLocked 
              ? "Your version is no longer supported. Please update to continue." 
              : "A new version with exciting features is waiting for you!")}
          </Text>
          
          <View style={styles.buttonStack}>
            <TouchableOpacity 
              style={styles.updateButton}
              activeOpacity={0.8}
              onPress={handleUpdate}
            >
              <LinearGradient 
                colors={isLocked ? ['#ef4444', '#b91c1c'] : ['#3b82f6', '#2563eb']} 
                start={{ x: 0, y: 0 }} 
                end={{ x: 1, y: 0 }} 
                style={StyleSheet.absoluteFillObject} 
              />
              <Text style={styles.updateButtonText}>Update Now</Text>
            </TouchableOpacity>

            {!isLocked && (
              <TouchableOpacity 
                style={styles.laterButton}
                activeOpacity={0.7}
                onPress={handleDismiss}
              >
                <Text style={styles.laterButtonText}>Maybe Later</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.footer}>
            <Text style={styles.versionInfo}>
              Current Build: {currentBuild}  •  Latest Build: {latestBuild}
            </Text>
          </View>
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
  },
  container: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 36,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    width: '100%',
    maxWidth: 380,
    overflow: 'hidden',
  },
  iconContainer: {
    width: 88,
    height: 88,
    borderRadius: 30,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  promptIconContainer: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 100,
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    opacity: 0.8,
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
    fontSize: 15,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  buttonStack: {
    width: '100%',
    gap: 12,
  },
  updateButton: {
    width: '100%',
    height: 58,
    borderRadius: 20,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  updateButtonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 17,
    letterSpacing: 0.3,
  },
  laterButton: {
    width: '100%',
    height: 58,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  laterButtonText: {
    color: '#94a3b8',
    fontWeight: '700',
    fontSize: 16,
  },
  footer: {
    marginTop: 28,
    paddingTop: 20,
    width: '100%',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  versionInfo: {
    fontSize: 10,
    color: 'rgba(148, 163, 184, 0.4)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  }
});

