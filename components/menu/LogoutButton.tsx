import React from 'react';
import { 
  TouchableOpacity, 
  Text, 
  StyleSheet 
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { styles } from './menu.styles';

interface LogoutButtonProps {
  onPress: () => Promise<void>;
}

export const LogoutButton: React.FC<LogoutButtonProps> = ({ onPress }) => {
  return (
    <TouchableOpacity 
      style={styles.logoutBtn} 
      activeOpacity={0.75}
      onPress={onPress}
    >
      <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
      <Ionicons name="log-out-outline" size={20} color="#ef4444" />
      <Text style={styles.logoutText}>Log Out</Text>
    </TouchableOpacity>
  );
};
