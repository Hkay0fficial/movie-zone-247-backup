import React, { memo, useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_W } = Dimensions.get('window');

export const SkeletonLoader = memo(({ width, height, borderRadius = 12, style, shimmer = true }: { width: any, height: any, borderRadius?: number, style?: any, shimmer?: boolean }) => {
  const translateX = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    if (shimmer) {
      Animated.loop(
        Animated.timing(translateX, {
          toValue: 2,
          duration: 1500,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    }
  }, [shimmer]);

  // Convert percentage widths to actual pixel values for the translateX interpolation
  const numericWidth = typeof width === 'string' && width.endsWith('%') 
    ? (parseFloat(width) / 100) * SCREEN_W 
    : width;

  return (
    <View
      style={[
        {
          width,
          height,
          backgroundColor: 'rgba(255,255,255,0.06)',
          borderRadius,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {shimmer && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              transform: [
                {
                  translateX: translateX.interpolate({
                    inputRange: [-1, 2],
                    outputRange: [-numericWidth * 1.5, numericWidth * 1.5],
                  }),
                },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={[
              'transparent',
              'rgba(255,255,255,0.05)',
              'rgba(255,255,255,0.12)',
              'rgba(255,255,255,0.05)',
              'transparent',
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[StyleSheet.absoluteFill, { transform: [{ skewX: '-20deg' }] }]}
          />
        </Animated.View>
      )}
    </View>
  );
});

import { ScrollView } from 'react-native';

export const SkeletonRow = memo(() => (
  <View style={{ marginBottom: 30 }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 15 }}>
      <SkeletonLoader width={140} height={16} />
      <SkeletonLoader width={60} height={16} />
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
      {[1, 2, 3, 4].map(i => (
        <View key={i}>
          <SkeletonLoader width={140} height={200} borderRadius={15} />
          <SkeletonLoader width={100} height={12} style={{ marginTop: 10 }} />
          <SkeletonLoader width={60} height={10} style={{ marginTop: 6 }} />
        </View>
      ))}
    </ScrollView>
  </View>
));

export const PreviewEpisodeSkeleton = memo(() => (
  <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
    {[1, 2, 3, 4, 5].map((i) => (
      <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
        <SkeletonLoader width={120} height={70} borderRadius={8} />
        <View style={{ marginLeft: 12, flex: 1, justifyContent: 'center' }}>
          <SkeletonLoader width="70%" height={14} style={{ marginBottom: 8 }} />
          <SkeletonLoader width="40%" height={12} />
        </View>
        <SkeletonLoader width={24} height={24} borderRadius={12} style={{ marginLeft: 12 }} />
      </View>
    ))}
  </View>
));

export const PreviewSkeleton = memo(() => (
  <View style={{ padding: 20 }}>
    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
      <SkeletonLoader width={80} height={30} borderRadius={15} />
      <SkeletonLoader width={60} height={30} borderRadius={15} />
      <SkeletonLoader width={100} height={30} borderRadius={15} />
    </View>
    <SkeletonLoader width="40%" height={20} style={{ marginBottom: 15 }} />
    <View style={{ flexDirection: 'row', gap: 12, marginBottom: 30 }}>
      {[1, 2, 3].map((i) => (
        <SkeletonLoader key={i} width={(SCREEN_W - 60) / 3} height={150} borderRadius={15} />
      ))}
    </View>
    <SkeletonLoader width="30%" height={20} style={{ marginBottom: 15 }} />
    <View style={{ flexDirection: 'row', gap: 12 }}>
      {[1, 2, 3].map((i) => (
        <SkeletonLoader key={i} width={(SCREEN_W - 60) / 3} height={150} borderRadius={15} />
      ))}
    </View>
  </View>
));

const styles = StyleSheet.create({});
