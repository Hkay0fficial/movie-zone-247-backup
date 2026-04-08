import React from 'react';
import { View, Text, StyleSheet, TextStyle, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface ReflectiveTextProps {
  children: string;
  style?: TextStyle | TextStyle[];
  containerStyle?: ViewStyle;
  reflectionOpacity?: number;
  gap?: number;
}

/**
 * A reusable component that adds a cinematic "mirror" reflection beneath text.
 * Perfect for headers, titles, and branding to add a premium feel.
 */
export default function ReflectiveText({ 
  children, 
  style, 
  containerStyle,
  reflectionOpacity = 0.3,
  gap = -5
}: ReflectiveTextProps) {
  
  // Extract text color if possible to apply a similar tint to the reflection
  const flattenedStyle = StyleSheet.flatten(style);
  const textColor = flattenedStyle?.color || '#ffffff';

  return (
    <View style={[styles.root, containerStyle]}>
      {/* Primary Text */}
      <Text style={[styles.primary, style]}>
        {children}
      </Text>

      {/* Reflection Layer */}
      <View style={[styles.reflectionWrapper, { marginTop: gap }]}>
        <View style={{ transform: [{ scaleY: -1 }] }}>
          <Text style={[
            styles.primary, 
            style, 
            { opacity: reflectionOpacity, color: textColor }
          ]}>
            {children}
          </Text>
        </View>

        {/* Cinematic Gradient Fade Mask */}
        <LinearGradient
          colors={[
            'rgba(10, 10, 15, 0.4)', 
            'rgba(10, 10, 15, 0.8)', 
            '#0a0a0f'
          ]}
          style={styles.mask}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
  },
  reflectionWrapper: {
    overflow: 'hidden',
    alignItems: 'center',
  },
  mask: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
