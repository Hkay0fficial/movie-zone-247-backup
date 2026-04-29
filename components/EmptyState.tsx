import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  buttonText?: string;
  onPress?: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, buttonText, onPress }) => {
  return (
    <Animated.View 
      entering={FadeInDown.duration(600).springify()} 
      style={styles.container}
    >
      <View style={styles.iconContainer}>
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={['rgba(91, 95, 239, 0.2)', 'rgba(91, 95, 239, 0.05)']}
          style={StyleSheet.absoluteFill}
        />
        <Ionicons name={icon} size={48} color="#818cf8" />
      </View>

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>

      {buttonText && onPress && (
        <TouchableOpacity style={styles.button} onPress={onPress} activeOpacity={0.8}>
          <LinearGradient
            colors={['#5B5FEF', '#4A4ED9']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradient}
          >
            <Text style={styles.buttonText}>{buttonText}</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.3)',
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  button: {
    borderRadius: 25,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#5B5FEF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  gradient: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});

export default EmptyState;
