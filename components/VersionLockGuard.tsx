import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Linking, Platform } from 'react-native';
import { useSubscription } from '@/app/context/SubscriptionContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Application from 'expo-application';

/**
 * Compares two semantic version strings (e.g., '1.2.1' and '1.2.0')
 * Returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal.
 */
function compareVersions(v1: string, v2: string): number {
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
  const [isLocked, setIsLocked] = useState(false);
  const currentVersion = Application.nativeApplicationVersion || "1.0.0";
  const currentBuild = Application.nativeBuildVersion || "0";

  useEffect(() => {
    if (latestVersion && latestVersion.trim() !== '' && forceUpdate) {
      try {
        const verCompare = compareVersions(latestVersion, currentVersion);
        const buildCompare = Number(latestBuild) > Number(currentBuild);

        // Lock if (Store Version is higher) OR (Store Version is same AND Build Number is higher)
        if (verCompare > 0 || (verCompare === 0 && buildCompare)) {
          setIsLocked(true);
        } else {
          setIsLocked(false);
        }
      } catch (e) {
        console.error("Error comparing versions:", e);
      }
    } else {
      setIsLocked(false);
    }
  }, [latestVersion, latestBuild, forceUpdate, currentVersion, currentBuild]);

  if (!isLocked) return null;

  return (
    <Modal visible={true} transparent={true} animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <LinearGradient colors={['#0F0F1A', '#1A1A2E']} style={StyleSheet.absoluteFillObject} />
        
        <View style={styles.container}>
          <View style={styles.iconContainer}>
            <Ionicons name="cloud-download" size={50} color="#3b82f6" />
          </View>
          
          <Text style={styles.title}>Update Required</Text>
          
          <Text style={styles.subtitle}>
            {updateMessage || "A newer version of THE MOVIE ZONE 24/7 is available. You are currently running an unsupported version. Please update the app to continue."}
          </Text>
          
          <TouchableOpacity 
            style={styles.updateButton}
            activeOpacity={0.8}
            onPress={() => {
              const url = Platform.OS === 'android' 
                ? 'market://details?id=com.moviezone247.app'
                : 'https://play.google.com/store/apps/details?id=com.moviezone247.app';
              
              Linking.openURL(url).catch(() => {
                Linking.openURL('https://play.google.com/store/apps/details?id=com.moviezone247.app');
              });
            }}
          >
            <LinearGradient 
              colors={['#3b82f6', '#2563eb']} 
              start={{ x: 0, y: 0 }} 
              end={{ x: 1, y: 0 }} 
              style={StyleSheet.absoluteFillObject} 
            />
            <Text style={styles.updateButtonText}>Update to v{latestVersion}</Text>
          </TouchableOpacity>

          <Text style={styles.versionInfo}>
            Current: v{currentVersion} • Latest: v{latestVersion}
          </Text>
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
    borderRadius: 32,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    width: '100%',
    maxWidth: 400,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  title: {
    fontSize: 28,
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
    marginBottom: 36,
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  updateButton: {
    width: '100%',
    height: 60,
    borderRadius: 18,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  updateButtonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  versionInfo: {
    marginTop: 20,
    fontSize: 11,
    color: 'rgba(148, 163, 184, 0.5)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  }
});
