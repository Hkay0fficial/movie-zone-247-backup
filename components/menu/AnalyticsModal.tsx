import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { styles } from './menu.styles';

interface AnalyticsModalProps {
  visible: boolean;
  onClose: () => void;
  selectedStat: { label: string; value: string; icon: any } | null;
  setCurrentScrollY: (y: number) => void;
  setScrollContentHeight: (h: number) => void;
  setScrollViewHeight: (h: number) => void;
  currentScrollY: number;
}

export const AnalyticsModal: React.FC<AnalyticsModalProps> = ({
  visible,
  onClose,
  selectedStat,
  setCurrentScrollY,
  setScrollContentHeight,
  setScrollViewHeight,
  currentScrollY,
}) => {
  return (
    <Modal 
      visible={visible} 
      transparent 
      animationType="fade" 
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <BlurView intensity={80} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.85)' }]}>
        <LinearGradient
          colors={['rgba(15,15,20,0.95)', 'rgba(20,20,28,0.95)', 'rgba(15,15,20,0.95)']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.settingsModalContainer}>
          <View style={styles.settingsModalContent}>
            <View style={styles.settingsHeader}>
              <View style={[styles.settingsIconWrap, { backgroundColor: '#5B5FEF20' }]}>
                <Ionicons name={selectedStat?.icon || 'stats-chart'} size={24} color="#5B5FEF" />
              </View>
              <Text style={styles.settingsModalTitle}>{selectedStat?.label} Analysis</Text>
              <TouchableOpacity style={styles.fullScreenCloseBtn} onPress={onClose}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.settingsScroll} 
              showsVerticalScrollIndicator={false}
              onScroll={(e) => setCurrentScrollY(e.nativeEvent.contentOffset.y)}
              scrollEventThrottle={16}
              onContentSizeChange={(_, h) => setScrollContentHeight(h)}
              onLayout={(e) => setScrollViewHeight(e.nativeEvent.layout.height)}
              contentContainerStyle={{ paddingBottom: 160 }}
            >
              {selectedStat?.label === 'Watch Time' && (
                <View style={styles.settingsContentSection}>
                  <View style={styles.analyticsMain}>
                    <Text style={styles.analyticsTotal}>{selectedStat.value}</Text>
                    <Text style={styles.analyticsSub}>Total Watch Time</Text>
                  </View>

                  <View style={styles.usageRow}>
                    <View style={styles.usageCard}>
                      <Text style={styles.usageLabel}>Daily Avg</Text>
                      <Text style={styles.usageValue}>4.2h</Text>
                    </View>
                    <View style={styles.usageCard}>
                      <Text style={styles.usageLabel}>Total App Time</Text>
                      <Text style={styles.usageValue}>162h</Text>
                    </View>
                  </View>

                  <Text style={[styles.aboutLabel, { paddingHorizontal: 0, marginBottom: 12 }]}>Weekly Activity</Text>
                  <View style={styles.activityChart}>
                    {[
                      { day: 'Mon', val: 0.6 },
                      { day: 'Tue', val: 0.8 },
                      { day: 'Wed', val: 0.4 },
                      { day: 'Thu', val: 0.9 },
                      { day: 'Fri', val: 0.7 },
                      { day: 'Sat', val: 1.0 },
                      { day: 'Sun', val: 0.85 }
                    ].map((d) => (
                      <View key={d.day} style={styles.chartCol}>
                        <View style={styles.barBg}>
                          <LinearGradient
                            colors={['#818cf8', '#5B5FEF']}
                            style={[styles.barFill, { height: `${d.val * 100}%` }]}
                          >
                            <View style={styles.barSheen} />
                          </LinearGradient>
                        </View>
                        <Text style={styles.chartDay}>{d.day}</Text>
                      </View>
                    ))}
                  </View>

                  <Text style={[styles.aboutLabel, { paddingHorizontal: 0, marginBottom: 12 }]}>Genre Breakdown</Text>
                  <View style={{ gap: 16, marginBottom: 24 }}>
                    {[
                      { genre: 'Action', hours: '42h', percent: 0.8, icon: 'flash-outline', color: '#f59e0b' },
                      { genre: 'Sci-Fi', hours: '38h', percent: 0.72, icon: 'planet-outline', color: '#818cf8' },
                      { genre: 'Drama', hours: '32h', percent: 0.6, icon: 'happy-outline', color: '#f472b6' },
                      { genre: 'Comedy', hours: '20h', percent: 0.38, icon: 'sunny-outline', color: '#34d399' },
                      { genre: 'Horror', hours: '16h', percent: 0.3, icon: 'skull-outline', color: '#ef4444' }
                    ].map((g) => (
                      <View key={g.genre} style={styles.genreRow}>
                        <View style={styles.genreInfo}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <Ionicons name={g.icon as any} size={18} color={g.color} />
                            <Text style={styles.genreName}>{g.genre}</Text>
                          </View>
                          <Text style={styles.genreValue}>{g.hours}</Text>
                        </View>
                        <View style={styles.progressBg}>
                          <View style={[styles.progressFill, { width: `${g.percent * 100}%`, backgroundColor: g.color }]} />
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </BlurView>
    </Modal>
  );
};
