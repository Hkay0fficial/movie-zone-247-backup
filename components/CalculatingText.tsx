import React, { useState, useEffect, useRef } from 'react';
import { Text, StyleSheet, View, Animated, Platform } from 'react-native';

interface CalculatingTextProps {
  value: string;
  duration?: number;
  delay?: number;
  style?: any;
}

export default function CalculatingText({ value, duration = 1800, delay = 0, style }: CalculatingTextProps) {
  const [displayValue, setDisplayValue] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  
  // Animation values
  const scale = useRef(new Animated.Value(1)).current;
  const colorAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let intervalId: any;
    let timeoutId: any;

    const startScramble = () => {
      timeoutId = setTimeout(() => {
        // High-intensity color flickering animation during scramble
        Animated.loop(
          Animated.sequence([
            Animated.timing(colorAnim, { toValue: 1, duration: 100, useNativeDriver: false }),
            Animated.timing(colorAnim, { toValue: 0, duration: 100, useNativeDriver: false }),
          ])
        ).start();

        intervalId = setInterval(() => {
          const scrambled = value
            .split('')
            .map((char) => {
              if (char === ' ' || char === '/') return char;
              // Mix digits and occasional characters for 'cyber' feel
              const chars = '0123456789X@';
              return chars[Math.floor(Math.random() * chars.length)];
            })
            .join('');
          
          setDisplayValue(scrambled);
        }, 40); // Even faster scramble (40ms)

        // Stop scrambling after the duration
        setTimeout(() => {
          clearInterval(intervalId);
          colorAnim.stopAnimation();
          colorAnim.setValue(0);
          setDisplayValue(value);
          setIsLocked(true);

          // Success 'Pop' Animation on lock
          Animated.sequence([
            Animated.spring(scale, {
              toValue: 1.15,
              friction: 4,
              useNativeDriver: true,
            }),
            Animated.spring(scale, {
              toValue: 1,
              friction: 3,
              useNativeDriver: true,
            })
          ]).start();
        }, duration);
      }, delay);
    };

    startScramble();

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
      colorAnim.stopAnimation();
    };
  }, [value, duration, delay]);

  const textColor = colorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [style?.color || '#818cf8', '#ffffff'], // Flicker between brand and white
  });

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Animated.Text 
        style={[
          style, 
          styles.monospace, 
          { color: textColor },
          isLocked && styles.lockedText
        ]}
      >
        {displayValue || ' '}
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  monospace: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', // Use monospace for numbers
    fontSize: 16,
    fontWeight: '900',
  },
  lockedText: {
    textShadowColor: 'rgba(129, 140, 248, 0.9)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
    letterSpacing: 6,
  },
});
