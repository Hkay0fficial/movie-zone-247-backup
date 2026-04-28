import React, { useState } from 'react';
import { 
  View, 
  Text, 
  Image, 
  TouchableOpacity, 
  StyleSheet 
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { styles } from './menu.styles';

interface ProfileCardProps {
  userName: string;
  userEmail: string;
  profileImageUri: string;
  isSubscribed: boolean;
  subscriptionBundle: string;
  remainingDays: number;
  isGuest?: boolean;
  onEditProfile: () => void;
  onUpgrade: () => void;
  paymentMethod: string;
}

export const ProfileCard: React.FC<ProfileCardProps> = ({
  userName,
  userEmail,
  profileImageUri,
  isSubscribed,
  subscriptionBundle,
  remainingDays,
  isGuest,
  onEditProfile,
  onUpgrade,
  paymentMethod,
}) => {
  const [imageError, setImageError] = useState(false);

  const getInitials = (name: string) => {
    if (!name) return '?';
    const names = name.trim().split(/\s+/);
    if (names.length === 1) {
      return names[0].substring(0, 2).toUpperCase();
    }
    return (names[0][0] + names[1][0]).toUpperCase();
  };

  const isVIP = subscriptionBundle === 'VIP';
  
  const sCol = isGuest 
    ? '#818cf8' 
    : isVIP 
      ? '#a855f7' 
      : !isSubscribed || remainingDays <= 2 
        ? '#ef4444' 
        : remainingDays <= 5 
          ? '#f59e0b' 
          : '#10b981';
          
  const sBg = isGuest 
    ? 'rgba(129,140,248,0.1)' 
    : isVIP 
      ? 'rgba(168,85,247,0.1)' 
      : !isSubscribed || remainingDays <= 2 
        ? 'rgba(239,68,68,0.1)' 
        : remainingDays <= 5 
          ? 'rgba(245,158,11,0.08)' 
          : 'rgba(16,185,129,0.08)';
          
  const sBor = isGuest 
    ? 'rgba(129,140,248,0.2)' 
    : isVIP 
      ? 'rgba(168,85,247,0.2)' 
      : !isSubscribed || remainingDays <= 2 
        ? 'rgba(239,68,68,0.2)' 
        : remainingDays <= 5 
          ? 'rgba(245,158,11,0.2)' 
          : 'rgba(16,185,129,0.2)';

  const formatBundleName = (name: string) => {
    return name + (name.toLowerCase().includes('week') && !name.toLowerCase().includes('weeks') ? 's' : '');
  };

  return (
    <View style={{ width: '100%', marginBottom: 20 }}>
      {/* White Background Glow */}
      <View style={{
        position: 'absolute', top: 15, left: 15, right: 15, bottom: 15,
        backgroundColor: '#ffffff', borderRadius: 24, opacity: 0.15,
        shadowColor: '#ffffff', shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1, shadowRadius: 25,
      }} />
      
      <View style={[styles.profileCard, { 
        marginBottom: 0, 
        backgroundColor: 'rgba(30, 30, 45, 0.98)', 
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255, 255, 255, 0.22)',
        shadowColor: '#000000', shadowOffset: { width: 0, height: 8 }, 
        shadowOpacity: 0.4, shadowRadius: 20, elevation: 12
      }]}>
        <View style={styles.profileCardInner}>
          <LinearGradient
            colors={['rgba(91,95,239,0.2)', 'rgba(91,95,239,0)']}
            style={styles.profileGradient}
          />
          
          <TouchableOpacity style={styles.avatarRing} activeOpacity={0.9} onPress={onEditProfile}>
            {!imageError && profileImageUri ? (
              <Image
                source={{ uri: profileImageUri }}
                style={styles.avatar}
                onError={() => setImageError(true)}
              />
            ) : (
              <LinearGradient
                colors={['#2a2a3e', '#1e1e2d']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.avatar, { backgroundColor: '#1e1e2d', justifyContent: 'center', alignItems: 'center' }]}
              >
                <Text style={{ color: '#ffffff', fontSize: 26, fontWeight: '900', letterSpacing: 1 }}>
                  {getInitials(userName)}
                </Text>
              </LinearGradient>
            )}
          </TouchableOpacity>
          
          <View style={styles.profileInfo}>
            <View style={{ marginLeft: 64, marginRight: 24, justifyContent: 'center' }}>
              <Text style={styles.profileName} numberOfLines={1}>{userName}</Text>
              <Text style={styles.profileEmail} numberOfLines={1}>{userEmail}</Text>
            </View>
            
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 24 }}>
              <TouchableOpacity
                style={[
                  styles.profileBadge,
                  { backgroundColor: sBg, borderColor: sBor, marginTop: 0 }
                ]}
                activeOpacity={0.7}
                onPress={onUpgrade}
              >
                <Ionicons
                  name={isSubscribed ? "diamond" : "star-outline"}
                  size={11}
                  color={sCol}
                />
                <Text style={[styles.profileBadgeText, { color: sCol, fontSize: 10 }]} numberOfLines={1} adjustsFontSizeToFit>
                  {isGuest
                      ? "GUEST ACCOUNT • REGISTER TO SAVE DATA"
                      : !isSubscribed 
                        ? "NO ACTIVE SUBSCRIPTION • UPGRADE TO PREMIUM"
                        : isVIP 
                          ? "VIP STATUS ACTIVE • ALL ACCESS UNLOCKED"
                          : paymentMethod === 'Administrative Grant'
                            ? `COMPLIMENTARY ACCESS ACTIVE • ${remainingDays} DAYS REMAINING`
                            : remainingDays <= 5
                              ? `ENDING SOON: ${formatBundleName(subscriptionBundle).toUpperCase()} PLAN • ${remainingDays} DAYS LEFT`
                              : `${formatBundleName(subscriptionBundle).toUpperCase()} PLAN ACTIVE • ${remainingDays} DAYS LEFT`
                  }
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={styles.editBtn} activeOpacity={0.75} onPress={onEditProfile}>
            <BlurView intensity={65} tint="dark" style={StyleSheet.absoluteFill} />
            <Ionicons name="create-outline" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};
