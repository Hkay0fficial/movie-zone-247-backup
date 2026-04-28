import React from 'react';
import { View, Text, TouchableOpacity, Linking, DeviceEventEmitter, Alert, TextInput, Image, ScrollView, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { styles } from './menu.styles';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { auth, db } from '../../constants/firebaseConfig';
import { collection, addDoc, serverTimestamp, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';

interface SupportSectionProps {
  showRatingPreview: boolean;
  setShowRatingPreview: (show: boolean) => void;
  localRating: number;
  setLocalRating: (rating: number) => void;
  isLocalRatingSubmitted: boolean;
  setIsLocalRatingSubmitted: (submitted: boolean) => void;
  hasDismissedReviewReminder: boolean;
  setHasDismissedReviewReminder: (dismissed: boolean) => void;
  currentScrollY: number;
  setSavedScrollPosition: (pos: number) => void;
  isFaqSectionCollapsed: boolean;
  setIsFaqSectionCollapsed: (collapsed: boolean) => void;
  expandedFaq: string | null;
  setExpandedFaq: (faq: string | null) => void;
  // Feedback Props
  feedback: string;
  setFeedback: (f: string) => void;
  isSendingFeedback: boolean;
  setIsSendingFeedback: (s: boolean) => void;
  feedbackSent: boolean;
  setFeedbackSent: (s: boolean) => void;
  attachedMedia: ImagePicker.ImagePickerAsset[];
  setAttachedMedia: (assets: ImagePicker.ImagePickerAsset[]) => void;
  pickMedia: (type: 'image' | 'video') => Promise<void>;
  removeMedia: (uri: string) => void;
  userName: string;
  dynamicFaqs: any[];
}

export const SupportSection: React.FC<SupportSectionProps> = ({
  showRatingPreview,
  setShowRatingPreview,
  localRating,
  setLocalRating,
  isLocalRatingSubmitted,
  setIsLocalRatingSubmitted,
  hasDismissedReviewReminder,
  setHasDismissedReviewReminder,
  currentScrollY,
  setSavedScrollPosition,
  isFaqSectionCollapsed,
  setIsFaqSectionCollapsed,
  expandedFaq,
  setExpandedFaq,
  feedback,
  setFeedback,
  isSendingFeedback,
  setIsSendingFeedback,
  feedbackSent,
  setFeedbackSent,
  attachedMedia,
  setAttachedMedia,
  pickMedia,
  removeMedia,
  userName,
  dynamicFaqs,
}) => {
  if (showRatingPreview) {
    return (
      <View style={{ backgroundColor: 'rgba(30,30,45,0.7)', borderRadius: 28, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(245,158,11,0.3)', padding: 24, alignItems: 'center', overflow: 'hidden' }}>
        <LinearGradient
          colors={["rgba(245, 158, 11, 0.05)", "transparent"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={{ width: 50, height: 50, borderRadius: 20, backgroundColor: 'rgba(245, 158, 11, 0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <Ionicons name="star" size={28} color="#f59e0b" />
        </View>
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800', marginBottom: 8 }}>Enjoying THE MOVIE ZONE?</Text>
        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center', marginBottom: 24, lineHeight: 18, paddingHorizontal: 10 }}>
          Tap a star to give your feedback and support our work! Your rating helps us grow.
        </Text>
        
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 28 }}>
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity
              key={star}
              onPress={() => setLocalRating(star)}
              activeOpacity={0.6}
              disabled={isLocalRatingSubmitted}
              style={{ transform: [{ scale: star === localRating ? 1.15 : 1 }] }}
            >
              <Ionicons
                name={star <= localRating ? "star" : "star-outline"}
                size={36}
                color="#f59e0b"
                style={{ opacity: isLocalRatingSubmitted && star > localRating ? 0.4 : 1 }}
              />
            </TouchableOpacity>
          ))}
        </View>

        {localRating > 0 && !isLocalRatingSubmitted && (
          <TouchableOpacity 
            style={{ width: '100%', backgroundColor: '#f59e0b', borderRadius: 18, paddingVertical: 15, alignItems: 'center', shadowColor: '#f59e0b', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
            onPress={async () => {
              setIsLocalRatingSubmitted(true);
              try {
                // 1. Mark as locally submitted
                await Promise.all([
                  AsyncStorage.setItem('localRating', localRating.toString()),
                  AsyncStorage.setItem('isLocalRatingSubmitted', 'true')
                ]);

                // 2. Automated Notification Cleanup
                const user = auth.currentUser;
                if (user) {
                  const notifRef = collection(db, "users", user.uid, "notifications");
                  const q = query(notifRef, where("type", "==", "rating"));
                  const snapshot = await getDocs(q);
                  snapshot.forEach(async (d) => {
                    await deleteDoc(doc(db, "users", user.uid, "notifications", d.id));
                  });
                }

                // 3. Redirection logic
                DeviceEventEmitter.emit("ratingDonePermanent");
                setTimeout(() => {
                  Linking.openURL("https://play.google.com/store/apps/details?id=com.themoviezone247.official").catch(() => {
                    Linking.openURL("https://play.google.com/store/apps/details?id=com.themoviezone247.official");
                  });
                }, 1200);
              } catch (e) {
                console.error('Rating submission failed', e);
              }
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15, letterSpacing: 0.5 }}>SUBMIT RATING</Text>
          </TouchableOpacity>
        )}

        {isLocalRatingSubmitted && (
          <View style={{ width: '100%', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Ionicons name="checkmark-circle" size={18} color="#10b981" />
              <Text style={{ color: '#10b981', fontWeight: '800', fontSize: 15 }}>Thank you for your rating!</Text>
            </View>
            
            {!hasDismissedReviewReminder && (
              <View style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, padding: 16, marginTop: 4 }}>
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600', textAlign: 'center', marginBottom: 12 }}>
                  Since you enjoyed the app, would you mind sharing your experience in a review? It really helps us!
                </Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity 
                    style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, paddingVertical: 10, alignItems: 'center' }}
                    onPress={async () => {
                      setHasDismissedReviewReminder(true);
                      try {
                        await AsyncStorage.setItem('hasDismissedReviewReminder', 'true');
                      } catch (e) {}
                    }}
                  >
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '700' }}>Maybe later</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={{ flex: 1, backgroundColor: '#5B5FEF', borderRadius: 12, paddingVertical: 10, alignItems: 'center' }}
                    onPress={() => {
                      Linking.openURL("https://play.google.com/store/apps/details?id=com.themoviezone247.official");
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Write Review</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}
        
        <View style={{ width: '100%', marginTop: 24 }}>
          <TouchableOpacity onPress={() => setShowRatingPreview(false)} style={{ width: '100%' }}>
            <View style={styles.capsuleDoneBtn}>
              <View style={styles.pillSheen} />
              <Text style={styles.capsuleDoneText}>
                {isLocalRatingSubmitted ? 'Back' : 'Maybe later'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const defaultFaqs = [
    { q: 'How do I download movies for offline viewing?', a: 'Tap the download icon on any movie or series. Downloads are available for Premium subscribers. Find your downloads in the "My Downloads" section under your profile.' },
    { q: 'Why is my video buffering or lagging?', a: 'Check your internet connection first. We recommend at least 5 Mbps for HD streaming.' },
    { q: 'Can I watch on multiple devices?', a: 'Premium plans allow up to 3 simultaneous streams. Basic plans allow 1 device at a time. You can manage active sessions under Account → Password & Security → Login Activity.' },
    { q: 'A movie or series is missing — how do I report it?', a: 'Contact us via WhatsApp or email below. Include the exact title and we will work to add it or check licensing availability.' },
    { q: 'How do I change my VJ preference?', a: 'Each movie card shows the VJ name. Use the search filters (By VJ) to find content from your preferred VJ, or use the Category tab to browse by VJ.' },
    { q: 'Is my payment information secure?', a: 'Yes. We do not store card details on our servers. All payments are processed through secure, encrypted payment gateways (MTN, Airtel, Card).' },
    { q: 'How do I update my email or password?', a: 'Go to Profile → Account → Personal Info to update your email. For password changes go to Account → Password & Security → Change Password.' },
  ];

  const faqs = dynamicFaqs && dynamicFaqs.length > 0 ? dynamicFaqs : defaultFaqs;

  return (
    <View style={styles.settingsContentSection}>
      <Text style={styles.settingsText}>Get help with your account, billing, or technical issues.</Text>
      
      {/* Send Feedback Section */}
      <View style={{ width: '100%', marginBottom: 20 }}>
        <View style={{ position: 'absolute', top: 15, left: 15, right: 15, bottom: 15, backgroundColor: '#10b981', borderRadius: 28, opacity: 0.08, shadowColor: '#10b981', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 20 }} />
        <View style={[styles.settingsList, { backgroundColor: 'rgba(30,30,45,0.98)', borderRadius: 28, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(16,185,129,0.3)', overflow: 'hidden', paddingVertical: 16, paddingHorizontal: 20 }]}>
          <Text style={[styles.aboutLabel, { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 8 }]}>Send Feedback</Text>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 16 }}>
            Have a suggestion or found a bug? Tell us about it!
          </Text>
          
          {!feedbackSent ? (
            <>
              <TextInput
                style={{
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  borderRadius: 16,
                  padding: 16,
                  color: '#fff',
                  fontSize: 14,
                  minHeight: 100,
                  textAlignVertical: 'top',
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: 'rgba(255,255,255,0.22)'
                }}
                placeholder="Type your feedback here..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                multiline
                value={feedback}
                onChangeText={setFeedback}
              />

              {/* Media Attachments */}
              {attachedMedia.length > 0 && (
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 10, paddingVertical: 12 }}
                >
                  {attachedMedia.map((media, idx) => (
                    <View key={media.uri} style={{ width: 60, height: 60, borderRadius: 12, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.05)' }}>
                      <Image source={{ uri: media.uri }} style={{ width: '100%', height: '100%' }} />
                      <TouchableOpacity 
                        style={{ position: 'absolute', top: 2, right: 2, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}
                        onPress={() => removeMedia(media.uri)}
                      >
                        <Ionicons name="close" size={12} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TouchableOpacity 
                  style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, paddingVertical: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                  onPress={() => pickMedia('image')}
                >
                  <Ionicons name="image-outline" size={16} color="rgba(255,255,255,0.6)" />
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontWeight: '600', fontSize: 13 }}>Add Media</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={{
                    flex: 2,
                    backgroundColor: feedback.trim() ? '#10b981' : 'rgba(16,185,129,0.2)',
                    borderRadius: 12,
                    paddingVertical: 12,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 8
                  }}
                  disabled={!feedback.trim() || isSendingFeedback}
                  onPress={async () => {
                    if (!feedback.trim()) return;
                    setIsSendingFeedback(true);
                    
                    try {
                      // 1. Save to Firestore for record keeping
                      const user = auth.currentUser;
                      await addDoc(collection(db, "feedback"), {
                        userId: user?.uid || 'guest',
                        userName: userName || 'Anonymous',
                        message: feedback.trim(),
                        mediaCount: attachedMedia.length,
                        device: Platform.OS,
                        version: '2.4.1',
                        status: 'new',
                        createdAt: serverTimestamp(),
                      });

                      // 2. Prepare WhatsApp Redirection
                      let mediaNote = '';
                      if (attachedMedia.length > 0) {
                        mediaNote = `\n\n📎 [SYSTEM NOTE]: User has attached ${attachedMedia.length} media file(s). Please ask them to share these below.`;
                      }
                      
                      const prefilledText = `*FEEDBACK FROM ${userName.toUpperCase()}*\n\n"${feedback.trim()}"${mediaNote}`;
                      const whatsappUrl = `https://wa.me/256786966792?text=${encodeURIComponent(prefilledText)}`;
                      
                      // 3. UI Success state
                      setFeedbackSent(true);
                      setFeedback('');
                      setAttachedMedia([]);
                      
                      // 4. Open WhatsApp
                      if (attachedMedia.length > 0) {
                        Alert.alert(
                          "Media Ready",
                          "Your feedback is saved! Since WhatsApp doesn't allow auto-attaching files, please manually select the media files in WhatsApp after it opens.",
                          [{ text: "Continue to WhatsApp", onPress: () => Linking.openURL(whatsappUrl) }]
                        );
                      } else {
                        Linking.openURL(whatsappUrl);
                      }

                      // Auto-hide success message after 3 seconds
                      setTimeout(() => setFeedbackSent(false), 3000);
                    } catch (error) {
                      console.error("Feedback error:", error);
                      Alert.alert("Submission Error", "We couldn't save your feedback. Please try again or contact us directly via WhatsApp.");
                    } finally {
                      setIsSendingFeedback(false);
                    }
                  }}
                >
                  {isSendingFeedback ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="send" size={16} color="#fff" />
                  )}
                  <Text style={{ color: '#fff', fontWeight: '700' }}>
                    {isSendingFeedback ? 'Submitting...' : 'Submit Feedback'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: 20 }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(16,185,129,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <Ionicons name="checkmark-circle" size={32} color="#10b981" />
              </View>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Thank You!</Text>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center', marginTop: 4 }}>
                Your feedback has been sent successfully.
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Connect With Us Section */}
      <View style={{ width: '100%', marginTop: 0, marginBottom: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15, paddingHorizontal: 5 }}>
          <View style={{ width: 4, height: 18, backgroundColor: '#818cf8', borderRadius: 2 }} />
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900', marginLeft: 10, letterSpacing: 1.2, textTransform: 'uppercase', opacity: 0.8 }}>
            Connect With Us
          </Text>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' }}>
          {/* Email Tile */}
          <TouchableOpacity 
            style={{ width: '48%', height: 110, backgroundColor: 'rgba(30,30,45,0.7)', borderRadius: 28, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(129,140,248,0.3)', padding: 16, justifyContent: 'space-between' }}
            activeOpacity={0.7}
            onPress={() => Linking.openURL('mailto:Sserunkumaharuna01@gmail.com')}
          >
            <View style={{ width: 38, height: 38, borderRadius: 14, backgroundColor: 'rgba(129,140,248,0.12)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="mail" size={20} color="#818cf8" />
            </View>
            <View>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Email Us</Text>
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 2 }} numberOfLines={1}>Direct Inquiry</Text>
            </View>
          </TouchableOpacity>

          {/* WhatsApp Tile */}
          <TouchableOpacity 
            style={{ width: '48%', height: 110, backgroundColor: 'rgba(30,30,45,0.7)', borderRadius: 28, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(37,211,102,0.3)', padding: 16, justifyContent: 'space-between' }}
            activeOpacity={0.7}
            onPress={() => Linking.openURL('https://wa.me/256786966792')}
          >
            <View style={{ width: 38, height: 38, borderRadius: 14, backgroundColor: 'rgba(37,211,102,0.12)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
            </View>
            <View>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>WhatsApp</Text>
              <Text style={{ color: 'rgba(37,211,102,0.6)', fontSize: 10, marginTop: 2 }}>Live Support</Text>
            </View>
          </TouchableOpacity>

          {/* Website Tile */}
          <TouchableOpacity 
            style={{ width: '48%', height: 110, backgroundColor: 'rgba(30,30,45,0.7)', borderRadius: 28, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.22)', padding: 16, justifyContent: 'space-between' }}
            activeOpacity={0.7}
            onPress={() => Linking.openURL('https://themoviezone247.com')}
          >
            <View style={{ width: 38, height: 38, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="globe" size={20} color="#fff" />
            </View>
            <View>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Website</Text>
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 2 }}>Official Site</Text>
            </View>
          </TouchableOpacity>

          {/* Rate Tile */}
          <TouchableOpacity 
            style={{ width: '48%', height: 110, backgroundColor: 'rgba(30,30,45,0.7)', borderRadius: 28, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(245,158,11,0.3)', padding: 16, justifyContent: 'space-between' }}
            activeOpacity={0.7}
            onPress={() => {
              setSavedScrollPosition(currentScrollY);
              setShowRatingPreview(true);
            }}
          >
            <View style={{ width: 38, height: 38, borderRadius: 14, backgroundColor: 'rgba(245,158,11,0.12)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="star" size={20} color="#f59e0b" />
            </View>
            <View>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Rate Us</Text>
              <Text style={{ color: 'rgba(245,158,11,0.6)', fontSize: 10, marginTop: 2 }}>Play Store</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* FAQ Section */}
      <View style={{ width: '100%', marginTop: 24, marginBottom: 20 }}>
        <View style={{ position: 'absolute', top: 15, left: 15, right: 15, bottom: 15, backgroundColor: '#818cf8', borderRadius: 28, opacity: 0.08, shadowColor: '#818cf8', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 20 }} />
        <View style={[styles.settingsList, { backgroundColor: 'rgba(30,30,45,0.98)', borderRadius: 28, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(129,140,248,0.3)', overflow: 'hidden', paddingVertical: 8 }]}>
          <TouchableOpacity 
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}
            activeOpacity={0.7}
            onPress={() => setIsFaqSectionCollapsed(!isFaqSectionCollapsed)}
          >
            <Text style={[styles.aboutLabel, { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 }]}>Frequently Asked Questions</Text>
            <Ionicons name={isFaqSectionCollapsed ? 'chevron-down' : 'chevron-up'} size={20} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>

          {!isFaqSectionCollapsed && faqs.map((faq, i, arr) => {
            const isOpen = expandedFaq === faq.q;
            return (
              <View key={i}>
                <TouchableOpacity
                  style={[styles.settingsRow, i === arr.length - 1 && !isOpen && { borderBottomWidth: 0 }, { paddingVertical: 14 }]}
                  activeOpacity={0.7}
                  onPress={() => setExpandedFaq(isOpen ? null : faq.q)}
                >
                  <Text style={[styles.settingsRowText, { flex: 1, flexWrap: 'wrap', fontSize: 13.5 }]}>{faq.q}</Text>
                  <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={15} color="#818cf8" style={{ marginLeft: 8 }} />
                </TouchableOpacity>
                {isOpen && (
                  <View style={{ paddingHorizontal: 20, paddingBottom: 14, marginTop: -4 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 19 }}>{faq.a}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
};
