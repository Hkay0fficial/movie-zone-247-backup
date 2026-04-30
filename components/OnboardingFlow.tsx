import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  FlatList,
  Image,
  Animated as RNAnimated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { 
  FadeIn, 
  FadeInDown, 
  FadeInRight,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

const { width, height } = Dimensions.get('window');

const ONBOARDING_DATA = [
  {
    id: '1',
    title: 'THE MOVIE ZONE',
    subtitle: 'EXPERIENCE CINEMA RE-IMAGINED',
    description: 'The world\'s first platform dedicated to Ugandan VJ-interpreted movies. Experience the magic of translation and interpretation like never before.',
    icon: 'film-outline',
    colors: ['#6366f1', '#4f46e5'],
  },
  {
    id: '2',
    title: 'SMART CASTING',
    subtitle: 'BIG SCREEN COMFORT',
    description: 'Effortlessly cast your favorite interpreted movies to any smart TV or Google Cast device. Turn your living room into a theater.',
    icon: 'tv-outline',
    colors: ['#ec4899', '#db2777'],
  },
  {
    id: '3',
    title: 'OFFLINE MODE',
    subtitle: 'WATCH ANYWHERE, ANYTIME',
    description: 'Download movies in high definition and watch them without an internet connection. Perfect for travels or remote areas.',
    icon: 'download-outline',
    colors: ['#06b6d4', '#0891b2'],
  },
];

interface OnboardingFlowProps {
  onComplete: () => void;
}

export default function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new RNAnimated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null);

  const handleNext = () => {
    if (currentIndex < ONBOARDING_DATA.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onComplete();
    }
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onComplete();
  };

  const renderItem = ({ item, index }: { item: typeof ONBOARDING_DATA[0]; index: number }) => {
    return (
      <View style={styles.slide}>
        <View style={styles.iconContainer}>
          <Animated.View 
            entering={FadeInDown.delay(200).duration(800).springify()}
            style={[styles.iconCircle, { borderColor: item.colors[0] }]}
          >
            <LinearGradient
              colors={[item.colors[0] + '33', 'transparent']}
              style={StyleSheet.absoluteFill}
            />
            <Ionicons name={item.icon as any} size={80} color={item.colors[0]} />
          </Animated.View>
        </View>

        <View style={styles.content}>
          <Animated.Text 
            entering={FadeInDown.delay(400).duration(800)}
            style={styles.subtitle}
          >
            {item.subtitle}
          </Animated.Text>
          <Animated.Text 
            entering={FadeInDown.delay(500).duration(800)}
            style={styles.title}
          >
            {item.title}
          </Animated.Text>
          <Animated.Text 
            entering={FadeInDown.delay(600).duration(800)}
            style={styles.description}
          >
            {item.description}
          </Animated.Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0a0a0f', '#1a1a2e', '#0a0a0f']}
        style={StyleSheet.absoluteFill}
      />

      <FlatList
        ref={flatListRef}
        data={ONBOARDING_DATA}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={RNAnimated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / width);
          setCurrentIndex(index);
        }}
        keyExtractor={(item) => item.id}
      />

      <View style={styles.footer}>
        {/* Pagination */}
        <View style={styles.pagination}>
          {ONBOARDING_DATA.map((_, i) => {
            const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
            const dotWidth = scrollX.interpolate({
              inputRange,
              outputRange: [8, 24, 8],
              extrapolate: 'clamp',
            });
            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.3, 1, 0.3],
              extrapolate: 'clamp',
            });
            return (
              <RNAnimated.View
                key={i}
                style={[
                  styles.dot,
                  { width: dotWidth, opacity, backgroundColor: ONBOARDING_DATA[currentIndex].colors[0] },
                ]}
              />
            );
          })}
        </View>

        {/* Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleNext} style={styles.nextButton}>
            <LinearGradient
              colors={ONBOARDING_DATA[currentIndex].colors}
              style={styles.nextGradient}
            >
              <Text style={styles.nextText}>
                {currentIndex === ONBOARDING_DATA.length - 1 ? 'Get Started' : 'Continue'}
              </Text>
              <Ionicons 
                name={currentIndex === ONBOARDING_DATA.length - 1 ? 'rocket' : 'arrow-forward'} 
                size={20} 
                color="#fff" 
                style={{ marginLeft: 8 }}
              />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  slide: {
    width,
    height: height * 0.8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  iconContainer: {
    height: height * 0.4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  content: {
    alignItems: 'center',
    marginTop: 20,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 10,
    textAlign: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: 1,
  },
  description: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '500',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    height: height * 0.25,
    paddingHorizontal: 40,
    justifyContent: 'space-between',
    paddingBottom: 50,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skipButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  skipText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 16,
    fontWeight: '700',
  },
  nextButton: {
    flex: 1,
    marginLeft: 20,
    borderRadius: 30,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  nextGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  nextText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
