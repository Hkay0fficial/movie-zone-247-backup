import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface FloatingBackButtonProps {
  onPress: () => void;
  label?: string;
  visible?: boolean;
}

export const FloatingBackButton = ({ onPress, label = "GO BACK", visible = true }: FloatingBackButtonProps) => {
  const insets = useSafeAreaInsets();
  if (!visible) return null;

  return (
    <TouchableOpacity 
      style={[
        styles.container, 
        { bottom: Math.max(insets.bottom, 20) + (Platform.OS === 'ios' ? 0 : 10) }
      ]} 
      onPress={onPress}
      activeOpacity={0.8}
    >
      <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={["rgba(91, 95, 239, 0.4)", "transparent"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <Ionicons name="chevron-back" size={18} color="#fff" />
      <Text style={styles.text}>{label}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    zIndex: 99999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 12,
  },
  text: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
    marginLeft: 6,
    letterSpacing: 1.2,
  }
});
