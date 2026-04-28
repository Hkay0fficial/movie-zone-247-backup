import React, { useEffect, useRef, useState } from 'react';
import { 
  View, Text, StyleSheet, Animated, 
  Dimensions, TouchableOpacity, Image,
  Platform, StatusBar
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

export interface LocalNotification {
  title: string;
  body: string;
  imageUrl?: string;
  data?: any;
}

interface InAppNotificationProps {
  notification: LocalNotification | null;
  onClose: () => void;
}

export default function InAppNotification({ notification, onClose }: InAppNotificationProps) {
  const slideAnim = useRef(new Animated.Value(-200)).current;
  const router = useRouter();

  useEffect(() => {
    if (notification) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 8
      }).start();

      const timer = setTimeout(() => {
        dismiss();
      }, 6000);

      return () => clearTimeout(timer);
    }
  }, [notification]);

  const dismiss = () => {
    Animated.timing(slideAnim, {
      toValue: -200,
      duration: 300,
      useNativeDriver: true
    }).start(() => onClose());
  };

  const handlePress = () => {
    if (notification?.data?.movieId) {
       // Deep link to movie detail
       router.push({
         pathname: '/(tabs)',
         params: { movieId: notification.data.movieId, autoplay: 'true' }
       });
    }
    dismiss();
  };

  if (!notification) return null;

  return (
    <Animated.View 
      style={[
        styles.container, 
        { transform: [{ translateY: slideAnim }] }
      ]}
    >
      <BlurView intensity={80} tint="dark" style={styles.blur}>
        <TouchableOpacity 
          style={styles.content} 
          onPress={handlePress} 
          activeOpacity={0.9}
        >
          <View style={styles.mainRow}>
             <View style={styles.iconContainer}>
              {notification.imageUrl ? (
                <Image source={{ uri: notification.imageUrl }} style={styles.image} />
              ) : (
                <View style={styles.defaultIcon}>
                  <Ionicons name="notifications" size={24} color="#6366f1" />
                </View>
              )}
            </View>
            
            <View style={styles.textContainer}>
              <View style={styles.header}>
                <Text style={styles.appTitle}>THE MOVIE ZONE</Text>
                <Text style={styles.timeLabel}>Now</Text>
              </View>
              <Text style={styles.title} numberOfLines={1}>{notification.title}</Text>
              <Text style={styles.body} numberOfLines={2}>{notification.body}</Text>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={dismiss}>
              <Ionicons name="close" size={20} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* New Interactive Actions Section */}
          {notification.data?.movieId && (
            <View style={styles.actionRow}>
               <TouchableOpacity 
                style={[styles.actionBtn, styles.primaryAction]} 
                onPress={handlePress}
               >
                 <Ionicons name="play" size={16} color="#fff" />
                 <Text style={styles.actionText}>WATCH NOW</Text>
               </TouchableOpacity>
               
               <TouchableOpacity 
                style={[styles.actionBtn, styles.secondaryAction]} 
                onPress={() => {
                   // Logic for Add to List could go here, or just view details
                   handlePress();
                }}
               >
                 <Ionicons name="add" size={18} color="#fff" />
                 <Text style={styles.actionText}>MY LIST</Text>
               </TouchableOpacity>
            </View>
          )}
        </TouchableOpacity>
      </BlurView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 20),
    left: 12,
    right: 12,
    zIndex: 9999,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  blur: {
    padding: 12,
  },
  content: {
    paddingVertical: 4,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  actionBtn: {
    flex: 1,
    height: 36,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  primaryAction: {
    backgroundColor: '#6366f1',
  },
  secondaryAction: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  actionText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  iconContainer: {
    marginRight: 12,
  },
  image: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#1e293b',
  },
  defaultIcon: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#6366f111',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#6366f122',
  },
  textContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  appTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#6366f1',
    letterSpacing: 1,
  },
  timeLabel: {
    fontSize: 9,
    color: '#64748b',
    fontWeight: '600',
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 1,
  },
  body: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
    lineHeight: 16,
  },
  closeBtn: {
    padding: 4,
    marginLeft: 8,
  }
});
