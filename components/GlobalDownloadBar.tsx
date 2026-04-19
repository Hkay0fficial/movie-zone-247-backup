/**
 * GlobalDownloadBar.tsx
 * A premium cinematic interactive download indicator.
 * Dual Action: "Show Movie" (info only) and "Tap to Play" (autoplay: true).
 * Performance: Native Driver for transforms, JS for dimensions.
 */

import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
  Easing,
  Platform,
  TouchableOpacity,
  PanResponder,
  Image,
} from 'react-native';
import { useSubscription } from '@/app/context/SubscriptionContext';
import { useDownloads } from '@/app/context/DownloadContext';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const EXPANDED_WIDTH = SCREEN_WIDTH * 0.92; // Slightly wider for two buttons
const COLLAPSED_SIZE = 54;

export default function GlobalDownloadBar() {
  const { activeDownloads, downloadQueue } = useDownloads();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [isExpanded, setIsExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const BASE_Y = insets.top + (Platform.OS === 'android' ? 68 : 58);
  const BASE_X = SCREEN_WIDTH - 74;

  const lastDraggedPos = useRef({ x: BASE_X, y: BASE_Y });
  const slideAnim = useRef(new Animated.Value(-150)).current;
  const shimmerAnim = useRef(new Animated.Value(-1)).current;
  const expansionAnim = useRef(new Animated.Value(0)).current;
  const pan = useRef(new Animated.ValueXY(lastDraggedPos.current)).current;

  const downloadIds = Object.keys(activeDownloads);
  const isDownloading = downloadIds.length > 0;
  
  // Always show the current item in the queue (the one being processed)
  const currentId = downloadQueue[0] || downloadIds[0];
  const downloadData = activeDownloads[currentId];
  const progress = downloadData?.progress ?? 0;
  const item = downloadData?.item;
  const queueCount = downloadQueue.length;

  useEffect(() => {
    const positionValue = isExpanded 
      ? { x: (SCREEN_WIDTH - EXPANDED_WIDTH) / 2, y: insets.top + (Platform.OS === 'android' ? 12 : 8) }
      : lastDraggedPos.current;

    Animated.spring(pan, {
      toValue: positionValue,
      useNativeDriver: true,
      friction: 14,
      tension: 40,
    }).start();

    Animated.spring(expansionAnim, {
      toValue: isExpanded ? 1 : 0,
      useNativeDriver: false,
      friction: 16,
      tension: 50,
    }).start();
  }, [isExpanded]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return !isExpanded && (Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2);
      },
      onPanResponderGrant: () => {
        setIsDragging(true);
        pan.setOffset({
          // @ts-ignore
          x: pan.x._value,
          // @ts-ignore
          y: pan.y._value,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: (e, gestureState) => {
        setIsDragging(false);
        pan.flattenOffset();
        
        const padding = 16;
        const currentX = (pan.x as any)._value;
        const currentY = (pan.y as any)._value;

        let targetX = currentX;
        let targetY = currentY;

        if (currentX < padding) targetX = padding;
        if (currentX > SCREEN_WIDTH - COLLAPSED_SIZE - padding) targetX = SCREEN_WIDTH - COLLAPSED_SIZE - padding;
        if (currentY < insets.top) targetY = insets.top;
        if (currentY > SCREEN_HEIGHT - 100) targetY = SCREEN_HEIGHT - 100;

        lastDraggedPos.current = { x: targetX, y: targetY };
        Animated.spring(pan, { toValue: { x: targetX, y: targetY }, useNativeDriver: true, friction: 12 }).start();
      },
    })
  ).current;

  useEffect(() => {
    if (isDownloading) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 55, friction: 10 }).start();
      Animated.loop(Animated.timing(shimmerAnim, { toValue: 2, duration: 1800, useNativeDriver: true, easing: Easing.linear })).start();
    } else {
      Animated.timing(slideAnim, { toValue: -150, duration: 400, useNativeDriver: true, easing: Easing.in(Easing.ease) }).start(() => setIsExpanded(false));
    }
  }, [isDownloading]);

  if (!isDownloading && (slideAnim as any)._value <= -140) return null;

  const clampedProgress = Math.max(0, Math.min(100, progress));

  const navigateToMovie = (autoplay: boolean) => {
    if (!item) return;
    
    // Collapse the pill when navigating
    setIsExpanded(false);

    // Redirect to the index tab (home/details page) with the target movie ID and autoplay status
    router.push({
      pathname: '/(tabs)',
      params: { 
        movieId: String(item.id), 
        autoplay: autoplay ? 'true' : 'false' 
      }
    });
  };

  const containerWidth = expansionAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [COLLAPSED_SIZE, EXPANDED_WIDTH],
  });

  const containerHeight = expansionAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [COLLAPSED_SIZE, 88],
  });

  const contentOpacity = expansionAnim.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0, 0, 1],
  });

  const circleOpacity = expansionAnim.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [1, 0, 0],
  });

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.outerContainer,
        { transform: [{ translateX: pan.x }, { translateY: pan.y }, { translateY: slideAnim }] },
      ]}
    >
      <Animated.View style={{ width: containerWidth, height: containerHeight }}>
        <BlurView intensity={120} tint="dark" style={[styles.blurWrapper, { borderRadius: 28 }]}>
          <LinearGradient
            colors={['rgba(91, 95, 239, 0.85)', 'rgba(15, 15, 25, 0.98)']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          {!isExpanded ? (
            <TouchableOpacity 
              activeOpacity={0.9} onPress={() => setIsExpanded(true)} style={StyleSheet.absoluteFill}
            >
              <Animated.View style={[styles.circularContent, { opacity: circleOpacity }]}>
                <View style={styles.centerCircle}>
                    <Text style={styles.progressTextSmall}>
                      {clampedProgress}%{queueCount > 1 ? ` (${queueCount})` : ''}
                    </Text>
                </View>
              </Animated.View>
            </TouchableOpacity>
          ) : (
            <View style={styles.expandedWrapper} pointerEvents="box-none">
              <Animated.View style={[styles.expandedContent, { opacity: contentOpacity }]} pointerEvents="auto">
                <View style={styles.expandedLayout}>
                  <TouchableOpacity activeOpacity={0.8} onPress={() => navigateToMovie(false)} style={styles.posterContainer}>
                    {item?.poster ? (
                      <Image source={{ uri: item.poster }} style={styles.miniPoster} />
                    ) : (
                      <View style={[styles.miniPoster, { backgroundColor: '#1e1e2d', justifyContent: 'center', alignItems: 'center' }]}>
                        <Ionicons name="film" size={24} color="rgba(255,255,255,0.3)" />
                      </View>
                    )}
                  </TouchableOpacity>

                  <View style={styles.infoCol}>
                    <Text style={styles.downloadTitle} numberOfLines={1}>
                      {item?.title || (queueCount > 0 ? 'Processing Queue...' : 'Downloading...')}
                    </Text>
                    <Text style={styles.downloadStatus}>
                      {clampedProgress === 100 
                        ? '✅ Download Finished' 
                        : queueCount > 1 
                          ? `📽️ Saving... (+${queueCount - 1} in queue)`
                          : '📽️ Saving Content...'
                      }
                    </Text>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressBar, { width: `${clampedProgress}%`, backgroundColor: clampedProgress === 100 ? '#10b981' : '#5B5FEF' }]} />
                    </View>

                    <View style={styles.metaRow}>
                      <TouchableOpacity 
                        activeOpacity={0.6} 
                        onPress={() => navigateToMovie(false)} 
                        style={styles.secondaryBtn}
                        hitSlop={{ top: 15, bottom: 15, left: 10, right: 10 }}
                      >
                        <Ionicons name="eye-outline" size={14} color="#fff" style={{ marginRight: 4 }} />
                        <Text style={styles.btnText}>SHOW MOVIE</Text>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        activeOpacity={0.6} 
                        onPress={() => navigateToMovie(true)} 
                        style={styles.primaryBtn}
                        hitSlop={{ top: 15, bottom: 15, left: 10, right: 10 }}
                      >
                        <Ionicons name="play" size={14} color="#fff" style={{ marginRight: 4 }} />
                        <Text style={styles.btnText}>TAP TO PLAY</Text>
                      </TouchableOpacity>
                      
                      <Text style={styles.percentDetail}>{clampedProgress}%</Text>
                    </View>
                  </View>
                </View>
              </Animated.View>
            </View>
          )}

          {isExpanded && (
            <TouchableOpacity 
              activeOpacity={0.7} onPress={() => setIsExpanded(false)} style={styles.closeBtn}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            >
              <Ionicons name="close-circle" size={26} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
          )}

          <Animated.View pointerEvents="none" style={[styles.shimmer, {
              transform: [{ translateX: shimmerAnim.interpolate({ inputRange: [-1, 2], outputRange: [-200, SCREEN_WIDTH] }) }],
            }]}>
            <LinearGradient colors={['transparent', 'rgba(255,255,255,0.1)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
          </Animated.View>
          <View pointerEvents="none" style={[styles.glowBorder, { borderColor: clampedProgress === 100 ? '#10b981' : '#5B5FEF' } ]} />
        </BlurView>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outerContainer: { position: 'absolute', top: 0, left: 0, zIndex: 99999, shadowColor: '#5B5FEF', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.6, shadowRadius: 16, elevation: 20 },
  blurWrapper: { flex: 1, overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)' },
  circularContent: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  centerCircle: { width: COLLAPSED_SIZE - 4, height: COLLAPSED_SIZE - 4, borderRadius: (COLLAPSED_SIZE - 4) / 2, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  expandedWrapper: { flex: 1 },
  expandedContent: { flex: 1, paddingHorizontal: 12, justifyContent: 'center' },
  expandedLayout: { flexDirection: 'row', alignItems: 'center' },
  posterContainer: { width: 50, height: 68, borderRadius: 10, marginRight: 12, overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.3)' },
  miniPoster: { width: '100%', height: '100%', borderRadius: 8 },
  infoCol: { flex: 1, paddingRight: 20 },
  downloadTitle: { color: '#fff', fontSize: 13, fontWeight: '900', marginBottom: 2 },
  downloadStatus: { color: 'rgba(255,255,255,0.7)', fontSize: 9, fontWeight: '600', marginBottom: 6 },
  progressTrack: { height: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3, marginBottom: 8 },
  progressBar: { height: '100%', borderRadius: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  primaryBtn: { backgroundColor: '#5865F2', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginRight: 8 },
  secondaryBtn: { backgroundColor: 'rgba(255,255,255,0.15)', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginRight: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  btnText: { color: '#fff', fontSize: 8, fontWeight: '900', letterSpacing: 0.2 },
  percentDetail: { color: '#fff', fontSize: 11, fontWeight: '900', opacity: 0.8 },
  progressTextSmall: { color: '#fff', fontSize: 14, fontWeight: '900' },
  shimmer: { position: 'absolute', top: 0, bottom: 0, width: 200, zIndex: 1 },
  glowBorder: { position: 'absolute', top: -1, left: -1, right: -1, bottom: -1, borderRadius: 28, borderWidth: 2, opacity: 0.5 },
  closeBtn: { position: 'absolute', top: 10, right: 10, zIndex: 100 }
});
