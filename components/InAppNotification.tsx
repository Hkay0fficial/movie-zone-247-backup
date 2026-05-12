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
  onAddToList?: (notification: LocalNotification) => void;
}

export default function InAppNotification({ notification, onClose, onAddToList }: InAppNotificationProps) {
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
      <BlurView intensity={60} tint="dark" style={styles.blur}>
        <View style={styles.unreadIndicator} />
        <TouchableOpacity 
          style={styles.content} 
          onPress={handlePress} 
          activeOpacity={0.9}
        >
          <View style={styles.mainRow}>
             <View style={styles.iconContainer}>
              {notification.imageUrl ? (
                <View style={styles.imageWrapper}>
                  <Image source={{ uri: notification.imageUrl }} style={styles.image} />
                </View>
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
              <Ionicons name="close" size={18} color="rgba(255,255,255,0.3)" />
            </TouchableOpacity>
          </View>

          {/* New Interactive Actions Section */}
          {notification.data?.movieId && (
            <View style={styles.actionRow}>
               <TouchableOpacity 
                style={[styles.actionBtn, styles.primaryAction]} 
                onPress={handlePress}
               >
                 <Ionicons name="play" size={14} color="#fff" />
                 <Text style={styles.actionText}>WATCH NOW</Text>
               </TouchableOpacity>
               
               <TouchableOpacity 
                style={[styles.actionBtn, styles.secondaryAction]} 
                onPress={() => {
                   if (notification && onAddToList) {
                     onAddToList(notification);
                     dismiss();
                   } else {
                     handlePress();
                   }
                }}
               >
                 <Ionicons name="add" size={16} color="#fff" />
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
    top: Platform.OS === 'ios' ? 54 : (StatusBar.currentHeight || 20) + 10,
    left: 12,
    right: 12,
    zIndex: 9999,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(5, 5, 8, 0.7)',
  },
  blur: {
    padding: 12,
    paddingLeft: 18,
  },
  unreadIndicator: {
    position: 'absolute',
    top: 12,
    bottom: 12,
    left: 6,
    width: 3,
    backgroundColor: '#6366f1',
    borderRadius: 4,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
  },
  content: {
    paddingVertical: 2,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  actionBtn: {
    flex: 1,
    height: 38,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  primaryAction: {
    backgroundColor: '#6366f1',
  },
  secondaryAction: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  actionText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 1.2,
  },
  iconContainer: {
    marginRight: 14,
  },
  imageWrapper: {
    width: 48,
    height: 68,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1e293b',
  },
  defaultIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(99, 102, 241, 0.2)',
  },
  textContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  appTitle: {
    fontSize: 9,
    fontWeight: '900',
    color: '#6366f1',
    letterSpacing: 1.5,
  },
  timeLabel: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.3)',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 15,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 1,
    letterSpacing: -0.2,
  },
  body: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
    lineHeight: 16,
  },
  closeBtn: {
    padding: 6,
    marginLeft: 4,
  }
});
