import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  ActivityIndicator,
  Platform,
  AppState,
  AppStateStatus
} from 'react-native';
import * as Updates from 'expo-updates';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

/**
 * OTAUpdateGuard monitors for Over-The-Air (EAS) updates.
 * When a new update is found and downloaded, it prompts the user to reload the app.
 */
export default function OTAUpdateGuard() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkUpdates = async () => {
    // Skip update checks in development mode for better performance
    if (__DEV__) return;

    try {
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        setIsDownloading(true);
        const fetchResult = await Updates.fetchUpdateAsync();
        if (fetchResult.isNew) {
          setUpdateAvailable(true);
        }
        setIsDownloading(false);
      }
    } catch (e: any) {
      console.warn("OTA Check Error:", e);
      setIsDownloading(false);
      // We don't set error state here to avoid blocking users on network failure
    }
  };

  useEffect(() => {
    // Initial check on mount
    checkUpdates();

    // Check again when app comes back to foreground
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        checkUpdates();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const handleReload = async () => {
    try {
      await Updates.reloadAsync();
    } catch (e) {
      setUpdateAvailable(false);
    }
  };

  if (!updateAvailable) {
    // Optional: Show a subtle indicator while downloading if desired
    return null;
  }

  return (
    <Modal
      visible={true}
      transparent={true}
      animationType="slide"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.container}>
          <LinearGradient
            colors={['#1e293b', '#0f172a']}
            style={styles.card}
          >
             <View style={styles.iconContainer}>
               <LinearGradient
                 colors={['#3b82f6', '#2563eb']}
                 style={styles.iconBg}
               >
                 <Ionicons name="rocket-outline" size={32} color="#fff" />
               </LinearGradient>
             </View>

             <Text style={styles.title}>Update Ready! 🚀</Text>
             <Text style={styles.subtitle}>
               A new version of THE MOVIE ZONE 24/7 is ready with latest movies, fixes and improvements.
             </Text>

             <TouchableOpacity 
               style={styles.button}
               activeOpacity={0.8}
               onPress={handleReload}
             >
               <LinearGradient
                 colors={['#3b82f6', '#1d4ed8']}
                 start={{ x: 0, y: 0 }}
                 end={{ x: 1, y: 0 }}
                 style={styles.buttonGradient}
               >
                 <Text style={styles.buttonText}>Restart App Now</Text>
                 <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />
               </LinearGradient>
             </TouchableOpacity>

             <TouchableOpacity 
                onPress={() => setUpdateAvailable(false)}
                style={styles.dismissBtn}
             >
                <Text style={styles.dismissText}>Later</Text>
             </TouchableOpacity>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  card: {
    padding: 32,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 24,
  },
  iconBg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  button: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  buttonGradient: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  dismissBtn: {
    padding: 8,
  },
  dismissText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '600',
  }
});
