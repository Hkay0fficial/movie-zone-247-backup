import React from 'react';
import { 
  Modal, 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  Platform,
  StyleSheet,
  Linking
} from 'react-native';
import Constants from 'expo-constants';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Application from 'expo-application';
import { styles } from './menu.styles';

interface AboutModalProps {
  visible: boolean;
  onClose: () => void;
  updateStatus: 'idle' | 'checking' | 'updated';
  handleUpdateCheck: () => void;
  insets: { top: number; bottom: number; left: number; right: number };
  currentScrollY: number;
  setCurrentScrollY: (val: number) => void;
  scrollContentHeight: number;
  setScrollContentHeight: (val: number) => void;
  scrollViewHeight: number;
  setScrollViewHeight: (val: number) => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({
  visible,
  onClose,
  updateStatus,
  handleUpdateCheck,
  insets,
  currentScrollY,
  setCurrentScrollY,
  scrollContentHeight,
  setScrollContentHeight,
  scrollViewHeight,
  setScrollViewHeight
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
              <View style={[styles.settingsIconWrap, { backgroundColor: 'rgba(91,95,239,0.15)' }]}>
                <Ionicons name="information-circle" size={26} color="#5B5FEF" />
              </View>
              <Text style={styles.settingsModalTitle}>THE MOVIE ZONE 24/7</Text>
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
              <View style={styles.aboutSection}>
                <Text style={styles.aboutLabel}>The Mission</Text>
                <Text style={styles.aboutDesc}>
                  The Movie Zone 24/7 is dedicated to bringing you the finest cinematic experiences right to your pocket. Our mission is to provide seamless, high-quality streaming for movie lovers worldwide, anytime, anywhere.
                </Text>
              </View>

              <View style={styles.aboutSection}>
                <Text style={styles.aboutLabel}>Key Features</Text>
                <View style={styles.featureRow}>
                  <Ionicons name="checkmark-circle" size={14} color="#38bdf8" />
                  <Text style={styles.featureText}>FHD / HD Streaming</Text>
                </View>
                <View style={styles.featureRow}>
                  <Ionicons name="play-circle" size={14} color="#818cf8" />
                  <Text style={styles.featureText}>Unlimited movies and series</Text>
                </View>
                <View style={styles.featureRow}>
                  <Ionicons name="shield-checkmark" size={14} color="#a78bfa" />
                  <Text style={styles.featureText}>Ad-free experience</Text>
                </View>
                <View style={styles.featureRow}>
                  <Ionicons name="cloud-download" size={14} color="#34d399" />
                  <Text style={styles.featureText}>Unlimited in-app download</Text>
                </View>
              </View>


              <View style={styles.aboutSection}>
                <Text style={styles.aboutLabel}>App Info</Text>
                <TouchableOpacity
                  style={styles.updateCheckCard}
                  activeOpacity={0.7}
                  onPress={handleUpdateCheck}
                >
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Version</Text>
                    <Text style={styles.infoValue}>{Constants.expoConfig?.version || Application.nativeApplicationVersion || '1.1.0'} (Stable)</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Build</Text>
                    <Text style={styles.infoValue}>#{Application.nativeBuildVersion}</Text>
                  </View>

                  <View style={styles.updateStatusContainer}>
                    {updateStatus === 'idle' && (
                      <View style={styles.statusRow}>
                        <Ionicons name="refresh-outline" size={14} color="#818cf8" />
                        <Text style={styles.statusText}>Tap to check for updates</Text>
                      </View>
                    )}
                    {updateStatus === 'checking' && (
                      <View style={styles.statusRow}>
                        <Ionicons name="sync" size={14} color="#34d399" />
                        <Text style={styles.statusText}>Checking for updates...</Text>
                      </View>
                    )}
                    {updateStatus === 'updated' && (
                      <View style={styles.statusRow}>
                        <Ionicons name="checkmark-circle" size={14} color="#34d399" />
                        <Text style={[styles.statusText, { color: '#34d399' }]}>App is up to date</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              </View>

              <View style={styles.aboutSection}>
                <Text style={styles.aboutLabel}>Join Our Community</Text>
                <View style={styles.socialRow}>
                  <TouchableOpacity 
                    style={styles.socialIconBtn}
                    onPress={() => Linking.openURL('https://www.tiktok.com/@the.movie.zone.247?_r=1&_t=ZS-95LfYLWo1Po')}
                  >
                    <View style={styles.pillSheen} />
                    <Ionicons name="logo-tiktok" size={20} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.socialIconBtn}
                    onPress={() => Linking.openURL('https://www.facebook.com/themoviezone247')}
                  >
                    <View style={styles.pillSheen} />
                    <Ionicons name="logo-facebook" size={20} color="#1877F2" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.socialIconBtn}
                    onPress={() => Linking.openURL('https://twitter.com/themoviezone247')}
                  >
                    <View style={styles.pillSheen} />
                    <Ionicons name="logo-twitter" size={20} color="#1DA1F2" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.socialIconBtn}
                    onPress={() => Linking.openURL('https://www.instagram.com/themoviezone247')}
                  >
                    <View style={styles.pillSheen} />
                    <Ionicons name="logo-instagram" size={20} color="#E4405F" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.socialIconBtn}
                    onPress={() => Linking.openURL('https://t.me/themoviezone247')}
                  >
                    <View style={styles.pillSheen} />
                    <Ionicons name="paper-plane" size={20} color="#0088cc" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.socialIconBtn}
                    onPress={() => Linking.openURL('https://wa.me/message/WCGGC5IB42H7M1')}
                  >
                    <View style={styles.pillSheen} />
                    <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.aboutSection}>
                <Text style={styles.aboutLabel}>Legal</Text>
                <View style={styles.legalLinks}>
                  <TouchableOpacity onPress={() => Linking.openURL('https://themoviezone247.com/privacy-policy.html')}>
                    <Text style={styles.legalLink}>Privacy Policy</Text>
                  </TouchableOpacity>
                  <View style={styles.legalDivider} />
                  <TouchableOpacity onPress={() => Linking.openURL('https://themoviezone247.com/terms.html')}>
                    <Text style={styles.legalLink}>Terms of Service</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.aboutDescSmall}>
                  © 2026 Movie Zone. All rights reserved. Cinematic content is provided under license from their respective owners.
                </Text>
                <TouchableOpacity 
                  style={styles.websiteRow}
                  onPress={() => Linking.openURL('https://themoviezone247.com/')}
                >
                  <Ionicons name="globe-outline" size={14} color="#38bdf8" />
                  <Text style={styles.websiteText}>Visit Official Website</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <View style={[styles.modalFooter, { paddingBottom: Platform.OS === 'android' ? (insets.bottom > 0 ? insets.bottom + 12 : 24) : Math.max(insets.bottom + 10, 44) }]}>
              {scrollContentHeight > scrollViewHeight && currentScrollY < scrollContentHeight - scrollViewHeight - 20 && (
                <LinearGradient
                  colors={['transparent', '#0f0f14', '#0f0f14']}
                  style={[styles.footerGradient, { height: (Platform.OS === 'ios' ? 110 : 80) + insets.bottom }]}
                  pointerEvents="none"
                />
              )}
              <TouchableOpacity onPress={onClose} style={{ width: '100%' }}>
                <View style={styles.capsuleDoneBtn}>
                  <View style={styles.pillSheen} />
                  <Text style={styles.capsuleDoneText}>Back</Text>
                </View>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </BlurView>
    </Modal>
  );
};
