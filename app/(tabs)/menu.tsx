import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Platform,
  StatusBar,
  Animated,
  Easing,
  Alert,
  DeviceEventEmitter,
  Dimensions,
  KeyboardAvoidingView,
  Linking,
  BackHandler,
} from 'react-native';
import * as Application from 'expo-application';
import Constants from 'expo-constants';

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { INDIAN_MOVIES, ALL_ROWS, MOST_DOWNLOADED, FAVOURITES, shortenGenre, Series, Movie } from '@/constants/movieData';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused } from '@react-navigation/native';
import { useLocalSearchParams, useRouter, usePathname } from 'expo-router';
import { auth, db } from '../../constants/firebaseConfig';
import { onAuthStateChanged, signOut, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, orderBy, onSnapshot, updateDoc, deleteDoc, writeBatch, getDocs, Timestamp, serverTimestamp, where } from 'firebase/firestore';
import { Modal } from 'react-native';
import { useSubscription } from '../context/SubscriptionContext';
import { useUser } from '../context/UserContext';
import { useMovies } from '../context/MovieContext';
import { useDownloads } from '../context/DownloadContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AboutSection } from '../../components/menu/AboutSection';
import { AnalyticsModal } from '../../components/menu/AnalyticsModal';
import { SubscriptionModals } from '../../components/menu/SubscriptionModals';
import { AccountSection } from '../../components/menu/AccountSection';
import { SubscriptionSection } from '../../components/menu/SubscriptionSection';
import { PreferencesAndActivity } from '../../components/menu/PreferencesAndActivity';
import { SupportSection } from '../../components/menu/SupportSection';
import { LogoutButton } from '../../components/menu/LogoutButton';
import { TwoFAVerificationModal } from '../../components/menu/TwoFAVerificationModal';
import { AboutModal } from '../../components/menu/AboutModal';
import { ProfileCard } from '../../components/menu/ProfileCard';
import { SettingsList } from '../../components/menu/SettingsList';
import { ChoosePlanSection } from '../../components/menu/ChoosePlanSection';
import { styles } from '../../components/menu/menu.styles';
import PremiumAccessModal from '../../components/PremiumAccessModal';
import { MoviePreviewContent, SeriesPreviewModal } from './index';
import { GridContent } from './index';


type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const TOP = Platform.OS === 'ios' ? 54 : (StatusBar.currentHeight ?? 0) + 10;
const PAYMENT_API_BASE = 'https://www.themoviezone247.com/api/payments';

// ─── Menu items ────────────────────────────────────────────────────────────────
interface MenuItem {
  id: string;
  title: string;
  subtitle: string;
  icon: IoniconsName;
  color: string;
}

const DEFAULT_MENU_ITEMS: MenuItem[] = [
  { id: '1', title: 'My Account', subtitle: 'Manage your profile & security', icon: 'person-outline', color: '#818cf8' },
  { id: 'admin', title: 'Admin Panel', subtitle: 'Content management dashboard', icon: 'shield-checkmark-outline', color: '#ef4444' },
  { id: '2', title: 'My Subscription', subtitle: 'Plan, billing, renewal', icon: 'diamond-outline', color: '#f59e0b' },
  { id: '3', title: 'Choose Your Plan', subtitle: 'Explore our membership tiers', icon: 'options-outline', color: '#8b5cf6' },
  { id: '5', title: 'Downloads', subtitle: 'Offline movies & series', icon: 'cloud-download-outline', color: '#34d399' },
  { id: '6', title: 'Notifications', subtitle: 'Alerts & recommendations', icon: 'notifications-outline', color: '#f59e0b' },
   { id: '7', title: 'My List', subtitle: 'Your saved movies & series', icon: 'bookmark-outline', color: '#f472b6' },
  { id: '8', title: 'Help & Support', subtitle: 'FAQs, feedback, contact us', icon: 'help-circle-outline', color: '#a78bfa' },
  { id: '9', title: 'About', subtitle: 'Version, licenses, legal', icon: 'information-circle-outline', color: '#94a3b8' },
];

// ─── Menu Screen ──────────────────────────────────────────────────────────────
import { GoogleSignin } from '@react-native-google-signin/google-signin';

export default function MenuScreen() {
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const [aboutVisible, setAboutVisible] = React.useState(false);
  const [expandedFaq, setExpandedFaq] = React.useState<string | null>(null);
  const [isFaqSectionCollapsed, setIsFaqSectionCollapsed] = React.useState(true);
  const [feedback, setFeedback] = React.useState('');
  const [isSendingFeedback, setIsSendingFeedback] = React.useState(false);
  const [feedbackSent, setFeedbackSent] = React.useState(false);
  const [attachedMedia, setAttachedMedia] = React.useState<ImagePicker.ImagePickerAsset[]>([]);
  const [showRatingPreview, setShowRatingPreview] = React.useState(false);
  const [localRating, setLocalRating] = React.useState(0);
  const [isLocalRatingSubmitted, setIsLocalRatingSubmitted] = React.useState(false);
  const [hasDismissedReviewReminder, setHasDismissedReviewReminder] = React.useState(false);
  const [menuItems, setMenuItems] = React.useState<MenuItem[]>(DEFAULT_MENU_ITEMS);
  const [dynamicFaqs, setDynamicFaqs] = React.useState<any[]>([]);
  const [isMenuLoading, setIsMenuLoading] = React.useState(true);

  React.useEffect(() => {
    const configRef = doc(db, "config", "app_profile");
    const unsub = onSnapshot(configRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.menuItems) {
          setMenuItems(data.menuItems.filter((item: any) => item.isVisible !== false));
        }
        if (data.faqs) {
          setDynamicFaqs(data.faqs);
        }
      }
      setIsMenuLoading(false);
    });
    return () => unsub();
  }, []);

  const aboutScrollRef = React.useRef<ScrollView>(null);
  const [selectedItem, setSelectedItem] = React.useState<MenuItem | null>(null);
  const [selectedSubItem, setSelectedSubItem] = React.useState<string | null>(null);
  const pollIntervalRef = React.useRef<any>(null);
  const [navigationStack, setNavigationStack] = React.useState<any[]>([]);

  React.useEffect(() => {
    const sub = DeviceEventEmitter.addListener("menuMovieSelected", (m: any) => {
      if ("seasons" in m) {
        setNavigationStack(prev => [...prev, { type: 'series', series: m }]);
      } else {
        setNavigationStack(prev => [...prev, { type: 'movie', movie: m }]);
      }
    });

    return () => {
      sub.remove();
    };
  }, []);

  // One Window Architecture: Global UI Visibility
  React.useEffect(() => {
    if (isFocused) {
      if (selectedItem) {
        DeviceEventEmitter.emit('setDetailStackVisible', true);
      } else {
        DeviceEventEmitter.emit('setDetailStackVisible', false);
      }
    }
  }, [selectedItem, isFocused]);

  // Handle Android Hardware Back Button
  React.useEffect(() => {
    const onBackPress = () => {
      if (selectedItem) {
        handleSettingsDone();
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [selectedItem, selectedSubItem, selectedSecurityItem, showRatingPreview, showBillingHistory]);

  // Instant restoration via URL params
  React.useEffect(() => {
    if (params.section) {
      const item = menuItems.find(i => i.id === params.section);
      if (item) {
        setSelectedItem(item);
        // Clear param after opening to avoid re-opening on every mount/update if navigated back
        router.setParams({ section: undefined });
      }
    }
  }, [params.section]);
  
  const SUB_ITEM_ICONS: Record<string, string> = {
    'Personal Info': 'person-outline',
    'Password & Security': 'lock-closed-outline',
    'Delete Account': 'trash-outline',
    'Video Quality': 'videocam-outline',
    'Theme (Dark/Light)': 'color-palette-outline',
    'Subtitles & Audio': 'text-outline',
    'Download Quality': 'download-outline',
    'Delete All Downloads': 'trash-outline',
    'Storage Location': 'folder-outline',
    'Billing History': 'receipt-outline',
    'Upgrade Plan': 'options-outline',
    'Update Payment Method': 'card-outline'
  };
  const [selectedStat, setSelectedStat] = React.useState<{ label: string, value: string, icon: IoniconsName } | null>(null);
  const [updateStatus, setUpdateStatus] = React.useState<'idle' | 'checking' | 'updated' | 'available'>('idle');
  const [cameFromSubscription, setCameFromSubscription] = React.useState(false);
  const [fromNotification, setFromNotification] = React.useState(false);
  const router = useRouter();
  const { user, profile, loading: userLoading } = useUser();
  const { appUpdateConfig } = useMovies();

  // Profile data from context
  const userName = profile.fullName;
  const userEmail = profile.email;
  const profilePhoto = profile.profilePhoto;
  const username = profile.username;
  const phoneNumber = profile.phoneNumber;

  // Split name for convenience
  const firstName = userName.split(' ')[0] || '';
  const lastName = userName.split(' ').slice(1).join(' ') || '';

  // Scroll Position State
  const scrollRef = React.useRef<ScrollView>(null);
  const [currentScrollY, setCurrentScrollY] = React.useState(0);
  const menuScrollY = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const id = menuScrollY.addListener(({ value }) => {
      DeviceEventEmitter.emit('menuHeaderScroll', value);
      setCurrentScrollY(value);
    });
    return () => menuScrollY.removeListener(id);
  }, []);
  const [savedScrollPosition, setSavedScrollPosition] = React.useState(0);
  const [scrollContentHeight, setScrollContentHeight] = React.useState(0);


  // Notification States
  const [notifications, setNotifications] = React.useState<any[]>([]);

  // Real-time Notification Listener
  React.useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const notifRef = collection(db, "users", user.uid, "notifications");
    const q = query(notifRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setNotifications(docs);
    });

    return () => unsubscribe();
  }, [auth.currentUser?.uid]);

  const [notifSettings, setNotifSettings] = React.useState({
    newReleases: true,
    myListUpdates: true,
    recommendations: false,
    billingAccount: true,
  });

  const handleClearNotifications = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const notifRef = collection(db, "users", user.uid, "notifications");
      const snapshot = await getDocs(notifRef);
      const batch = writeBatch(db);
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    } catch (err) {
      console.error("Error clearing notifications:", err);
    }
  };

  const handleNotificationPress = async (notif: any) => {
    const user = auth.currentUser;
    if (!user) return;

    // Mark as read in Firestore
    if (notif.unread) {
      try {
        const docRef = doc(db, "users", user.uid, "notifications", notif.id);
        await updateDoc(docRef, { unread: false });
      } catch (err) {
        console.error("Error marking notification as read:", err);
      }
    }
    
    if (notif.type === 'subscription') {
      const subItem = menuItems.find(i => i.id === '2');
      if (subItem) setSelectedItem(subItem);
    } else if (notif.type === 'security') {
      const accItem = menuItems.find(i => i.id === '1');
      if (accItem) {
        setSelectedItem(accItem);
        setSelectedSubItem('Password & Security');
      }
    } else if (notif.type === 'content') {
      Alert.alert(notif.title, notif.message, [
        { text: 'Watch Now', onPress: () => toggleSettingsModal(null) },
        { text: 'Close', style: 'cancel' }
      ]);
    } else if (notif.type === 'rating') {
      setSavedScrollPosition(currentScrollY);
      setShowRatingPreview(true);
    }
  };

  const toggleNotifSetting = async (key: keyof typeof notifSettings) => {
    const newValue = !notifSettings[key];
    setNotifSettings(prev => ({ ...prev, [key]: newValue }));
    
    if (user) {
      try {
        await updateDoc(doc(db, "users", user.uid), {
          notificationPrefs: { ...notifSettings, [key]: newValue }
        });
      } catch (err) {
        console.error("Error saving notification settings:", err);
      }
    }
  };

  const [scrollViewHeight, setScrollViewHeight] = React.useState(0);

  const [isEditingProfile, setIsEditingProfile] = React.useState(false);
  const [tempEmail, setTempEmail] = React.useState(userEmail);
  const [tempFirstName, setTempFirstName] = React.useState(firstName);
  const [tempLastName, setTempLastName] = React.useState(lastName);
  const [tempUsername, setTempUsername] = React.useState(username);
  const [tempPhoneNumber, setTempPhoneNumber] = React.useState(phoneNumber);


  // Deletion State
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deletionEmail, setDeletionEmail] = React.useState('');
  const [sentCode, setSentCode] = React.useState('');
  const [inputCode, setInputCode] = React.useState('');
  const [sendingCode, setSendingCode] = React.useState(false);

  // Subscription State
  const {
    subscriptionBundle, setSubscriptionBundle,
    subscriptionExpiresAt,
    isPaid,
    isGuest,
    paymentMethod: contextPaymentMethod,
    favorites,
    toggleFavorite,
    deviceId,
    activeDeviceIds,
    removeDevice,
  } = useSubscription();

  const {
    downloadsUsedToday,
    getExternalDownloadLimit,
    getRemainingDownloads,
    downloadedMovies,
    removeDownload,
    activeDownloads,
    episodeDownloads,
  } = useDownloads();

  const isSubscribed = isPaid;
  const remainingDays = isSubscribed && subscriptionExpiresAt 
    ? Math.max(0, Math.ceil((subscriptionExpiresAt - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  // Derive dynamic subscription details from the bundle
  const [subscriptionBonus, setSubscriptionBonus] = React.useState<string | null>(null);
  const [subscriptionSpecs, setSubscriptionSpecs] = React.useState<string[]>([]);
  const [subscriptionPrice, setSubscriptionPrice] = React.useState('0 Ugx');
  const [subscriptionBundleDisplay, setSubscriptionBundleDisplay] = React.useState(subscriptionBundle);

  React.useEffect(() => {
    if (subscriptionBundle === 'None') {
      setSubscriptionBonus(null);
      setSubscriptionPrice('N/A');
      setSubscriptionSpecs([]);
      setSubscriptionBundleDisplay('None');
      return;
    }

    // If the plan was granted by an admin, never show a bonus label —
    // the admin already set the exact intended duration.
    const isAdminGrant = contextPaymentMethod?.toLowerCase().includes('administrative') ||
                         contextPaymentMethod?.toLowerCase().includes('admin');

    const bundle = subscriptionBundle.toLowerCase();
    if (bundle.includes('premium')) {
      const daySuffix = remainingDays === 1 ? 'Day' : 'Days';
      setSubscriptionBundleDisplay(`${remainingDays} ${daySuffix} Plan`);
      setSubscriptionBonus(isAdminGrant ? null : `${remainingDays} ${daySuffix.toLowerCase()} left`);
      setSubscriptionPrice('Gifted');
      setSubscriptionSpecs([
        'FHD / HD Streaming', 
        'Unlimited movies and series', 
        'Ad-free experience', 
        'Access to all content', 
        'Unlimited in-app download', 
        `${getExternalDownloadLimit()} external downloads`, 
        '3 devices'
      ]);
    } else {
      setSubscriptionBundleDisplay(subscriptionBundle);
      if (bundle.includes('1 week')) {
        setSubscriptionBonus(isAdminGrant ? null : '+1 day bonus');
        setSubscriptionPrice('2,500 Ugx');
        setSubscriptionSpecs(['FHD / HD Streaming', 'Unlimited movies and series', 'Ad-free experience', 'Access to all content', 'Unlimited in-app download', '1 external download', '1 device']);
      } else if (bundle.includes('2 weeks')) {
        setSubscriptionBonus(isAdminGrant ? null : '+2 days bonus');
        setSubscriptionPrice('5,000 Ugx');
        setSubscriptionSpecs(['FHD / HD Streaming', 'Unlimited movies and series', 'Ad-free experience', 'Access to all content', 'Unlimited in-app download', '2 external downloads', '1 device']);
      } else if (bundle.includes('1 month')) {
        setSubscriptionBonus(isAdminGrant ? null : '+4 day bonus');
        setSubscriptionPrice('10,000 Ugx');
        setSubscriptionSpecs(['FHD / HD Streaming', 'Unlimited movies and series', 'Ad-free experience', 'Access to all content', 'Unlimited in-app download', '3 external downloads', '2 devices']);
      } else if (bundle.includes('2 months')) {
        setSubscriptionBonus(isAdminGrant ? null : '+1 week bonus');
        setSubscriptionPrice('20,000 Ugx');
        setSubscriptionSpecs(['FHD / HD Streaming', 'Unlimited movies and series', 'Ad-free experience', 'Access to all content', 'Unlimited in-app download', '5 external downloads', '3 devices']);
      } else if (bundle.includes('vip')) {
        setSubscriptionBonus('Elite Status');
        setSubscriptionPrice('Gifted');
        setSubscriptionSpecs(['FHD / HD Streaming', 'Unlimited movies and series', 'Ad-free experience', 'Priority Support', 'Access to all content', 'Unlimited in-app download', 'Unlimited external downloads', '5 devices']);
      }
    }
  }, [subscriptionBundle, remainingDays, contextPaymentMethod]);
  const [renewalDate, setRenewalDate] = React.useState('Loading...');
  const [paymentMethod, setPaymentMethod] = React.useState('Administrative Grant');

  // Sync dynamic data from context
  React.useEffect(() => {
    if (subscriptionExpiresAt) {
      const date = new Date(subscriptionExpiresAt);
      const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
      setRenewalDate(date.toLocaleDateString('en-US', options));
    } else if (subscriptionBundle.toLowerCase().includes('vip')) {
      setRenewalDate('Permanent Access');
    } else if (subscriptionBundle !== 'None') {
      setRenewalDate('Processing Coverage...');
    } else {
      setRenewalDate('No active subscription');
    }

    if (contextPaymentMethod) {
      setPaymentMethod(contextPaymentMethod);
    }
  }, [subscriptionExpiresAt, subscriptionBundle, contextPaymentMethod]);

  const [upcomingMembership, setUpcomingMembership] = React.useState<any>(null);
  const [billingHistory, setBillingHistory] = React.useState<any[]>([]);
  const [showBillingHistory, setShowBillingHistory] = React.useState(false);
  const [showGuestPlanModal, setShowGuestPlanModal] = React.useState(false);
  const [paymentMethods, setPaymentMethods] = React.useState<any[]>([]);

  React.useEffect(() => {
    if (auth.currentUser?.uid) {
      const q = query(
        collection(db, 'users', auth.currentUser.uid, 'transactions'),
        orderBy('createdAt', 'desc')
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const history = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setBillingHistory(history);
      });
      return () => unsubscribe();
    }
  }, [auth.currentUser?.uid]);

  React.useEffect(() => {
    if (contextPaymentMethod) {
      const type = contextPaymentMethod.toLowerCase().includes('mtn') ? 'mtn' : 'airtel';
      setPaymentMethods([{
        id: '1',
        type,
        label: contextPaymentMethod,
        icon: 'phone-portrait-outline',
        color: type === 'mtn' ? '#ffcc00' : '#ef4444',
        isDefault: true
      }]);
    } else {
      setPaymentMethods([]);
    }
  }, [contextPaymentMethod]);
  const [isManageBillingFlow, setIsManageBillingFlow] = React.useState(false);
  const [showPaymentModal, setShowPaymentModal] = React.useState(false);
  const [selectedPlanForPayment, setSelectedPlanForPayment] = React.useState<any>(null);

  // Payment Details Modal State
  const [showPaymentDetailsModal, setShowPaymentDetailsModal] = React.useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = React.useState<any>(null);
  const [paymentPhone, setPaymentPhone] = React.useState('');
  const [cardNumber, setCardNumber] = React.useState('');
  const [cardExpiry, setCardExpiry] = React.useState('');
  const [cardCVV, setCardCVV] = React.useState('');
  const [cardName, setCardName] = React.useState('');
  const [paymentProcessing, setPaymentProcessing] = React.useState(false);
  const [paymentStatusText, setPaymentStatusText] = React.useState('');
  const [errorText, setErrorText] = React.useState('');
  const [paymentSuccess, setPaymentSuccess] = React.useState(false);
  const [savePaymentMethod, setSavePaymentMethod] = React.useState(true);

  const handleProceedPayment = async () => {
    if ((selectedPaymentMethod?.id === 'mtn' || selectedPaymentMethod?.id === 'airtel') && paymentPhone.replace(/\D/g, '').length < 10) {
      setErrorText('Please enter a valid phone number');
      return;
    }

    setPaymentProcessing(true);
    setPaymentStatusText('Initiating payment request...');
    setErrorText('');

    try {
      // 1. Initiate the Charge (STK Push)
      const chargeResponse = await fetch(`${PAYMENT_API_BASE}/charge`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'bypass-tunnel-reminder': 'true'
        },
        body: JSON.stringify({
          phoneNumber: paymentPhone.replace(/\D/g, ''),
          amount: selectedPlanForPayment?.price?.replace(/\D/g, '') || 0,
          currency: 'UGX',
          email: userEmail || 'customer@themoviezone247.com',
          network: selectedPaymentMethod?.id === 'mtn' ? 'MTN' : 'AIRTEL',
          uid: auth.currentUser?.uid,
          planName: selectedPlanForPayment?.name?.split(' [')[0]
        }),
      });

      const responseText = await chargeResponse.text();
      let chargeData;
      try {
        chargeData = JSON.parse(responseText);
      } catch (e) {
        console.error('Server returned non-JSON:', responseText);
        throw new Error('Server returned invalid response. Please try again.');
      }

      if (!chargeData.success) {
        throw new Error(chargeData.error || 'Failed to initiate payment');
      }

      const tx_ref = chargeData.tx_ref;
      const redirectUrl = chargeData.redirectUrl;

      if (redirectUrl) {
        setPaymentStatusText('Opening secure checkout...');
        // Open Pesapal Checkout
        await Linking.openURL(redirectUrl);
        setPaymentStatusText('Please complete payment in the browser window...');
      } else {
        setPaymentStatusText('STK Push sent. Please enter your PIN on your phone...');
      }

      // 2. Start Polling for Verification
      let attempts = 0;
      const maxAttempts = 40; // Increased timeout for external checkout (120 seconds)
      
      pollIntervalRef.current = setInterval(async () => {
        attempts++;
        try {
          const verifyResponse = await fetch(`${PAYMENT_API_BASE}/verify?tx_ref=${tx_ref}`);
          const verifyData = await verifyResponse.json();

          if (verifyData.success && verifyData.status === 'successful') {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            finalizePayment(tx_ref);
          } else if (verifyData.status === 'failed' || attempts >= maxAttempts) {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            setPaymentProcessing(false);
            setErrorText(verifyData.message || 'Payment timeout or failed. Please try again.');
          } else {
            setPaymentStatusText(`Waiting for confirmation... (${maxAttempts - attempts})`);
          }
        } catch (pollError) {
          console.error('Polling error:', pollError);
        }
      }, 3000);

    } catch (err: any) {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      console.error('Payment Error:', err);
      setPaymentProcessing(false);
      setErrorText(err.message || 'An error occurred during payment');
    }
  };

  const handleCancelPayment = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setPaymentProcessing(false);
    setPaymentStatusText('');
  };

  const finalizePayment = (tx_ref: string) => {
    setPaymentProcessing(false);
    setPaymentSuccess(true);
    
    setTimeout(() => {
      setPaymentSuccess(false);
      setShowPaymentDetailsModal(false);
      handleShowPaymentModal(false);
      setPaymentPhone('');
      setCardNumber('');
      setCardExpiry('');
      setCardCVV('');
      setCardName('');

      const planName = selectedPlanForPayment?.name || '';
      const label = planName.split(' [')[0];
      const daysMap: Record<string, number> = { '1 week': 8, '2 weeks': 16, '1 Month': 34, '2 months': 67 };
      const priceMap: Record<string, string> = { '1 week': '2,500 Ugx', '2 weeks': '5,000 Ugx', '1 Month': '10,000 Ugx', '2 months': '20,000 Ugx' };
      
      const daysCount = daysMap[label] ?? 30;
      const price = priceMap[label] ?? '0 Ugx';
      const bonusPart = planName.includes('[') ? `[${planName.split('[')[1]}` : '';

      let formattedPayment = '';
      if (selectedPaymentMethod?.id === 'mtn' || selectedPaymentMethod?.id === 'airtel') {
        const network = selectedPaymentMethod?.id === 'mtn' ? 'MTN' : 'Airtel';
        const maskedPhone = paymentPhone.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3');
        formattedPayment = `${network} Money • ${maskedPhone}`;
      } else {
        const last4 = cardNumber.replace(/\s/g, '').slice(-4);
        formattedPayment = `Card •••• ${last4}`;
      }

      // Update Local State
      if (!isSubscribed) {
        setSubscriptionBundle(label || 'Premium');
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + daysCount);
        const options: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' };
        setRenewalDate(expiry.toLocaleDateString('en-US', options));
      }

      const newTx = {
        id: tx_ref,
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        plan: label,
        amount: price,
        method: formattedPayment,
        createdAt: serverTimestamp(),
      };
      
      if (auth.currentUser?.uid) {
        setDoc(doc(db, 'users', auth.currentUser.uid, 'transactions', tx_ref), newTx);
      }

      setPaymentMethod(formattedPayment);
    }, 1800);
  };

  const formatCardNumber = (text: string) => {
    const cleaned = text.replace(/\D/g, '').slice(0, 16);
    return cleaned.replace(/(\d{4})/g, '$1 ').trim();
  };

  const formatExpiry = (text: string) => {
    const cleaned = text.replace(/\D/g, '').slice(0, 4);
    if (cleaned.length >= 3) return `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
    return cleaned;
  };

  // Security Sub-section State
  const [selectedSecurityItem, setSelectedSecurityItem] = React.useState<string | null>(null);
  const [is2FAEnabled, setIs2FAEnabled] = React.useState(false);
  const [currentPass, setCurrentPass] = React.useState('');
  const [newPass, setNewPass] = React.useState('');
  const [confirmPass, setConfirmPass] = React.useState('');
  const [passwordError, setPasswordError] = React.useState('');
  const [is2FALoading, setIs2FALoading] = React.useState(false);
  const [show2FAVerifyModal, setShow2FAVerifyModal] = React.useState(false);
  const [tfaVerificationCode, setTfaVerificationCode] = React.useState('');
  const [tfaSentCode, setTfaSentCode] = React.useState('');
  const [passUpdateSuccess, setPassUpdateSuccess] = React.useState(false);
  const [userSecurityQuestion, setUserSecurityQuestion] = React.useState('');
  const [userSecurityAnswer, setUserSecurityAnswer] = React.useState('');
  const [isQuestionSaved, setIsQuestionSaved] = React.useState(false);
  const [securityError, setSecurityError] = React.useState('');
  const [securitySaveSuccess, setSecuritySaveSuccess] = React.useState(false);
  const [linkedAccounts, setLinkedAccounts] = React.useState({
    google: false,
    facebook: false,
    apple: false,
  });
  const [linkingProvider, setLinkingProvider] = React.useState<string | null>(null);

  const SECURITY_QUESTIONS = [
    'What was the name of your first pet?',
    'In what city were you born?',
    'What was your childhood nickname?',
    'What is your favorite book?',
    'What was the name of your first school?',
  ];

  const [activeDevices, setActiveDevices] = React.useState<any[]>([]);


  React.useEffect(() => {
    // Map the string array to device viewer objects
    if (activeDeviceIds && activeDeviceIds.length > 0) {
      const mapped = activeDeviceIds.map((id, index) => ({
        id,
        device: `Registered Device ${index + 1}`,
        location: 'Authorized',
        time: 'Active',
        current: false // We could add matching against current deviceId if exposed
      }));
      setActiveDevices(mapped);
    } else {
      setActiveDevices([]);
    }
  }, [activeDeviceIds]);

  const getDeviceLimit = () => {
    if (!isSubscribed) return 1;
    const b = subscriptionBundle.toLowerCase();
    if (b.includes('month')) return b.includes('2') ? 3 : 2;
    return 1; // 1 week or 2 weeks
  };

  const handleKickDevice = async (deviceId: string) => {
    if (removeDevice) {
      await removeDevice(deviceId);
      alert('Device has been logged out successfully.');
    }
  };

  // Animation for Get Started buttons
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    const pulse = () => {
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start(() => pulse());
    };
    pulse();
  }, [pulseAnim]);

  const isDeleteButtonEnabled = confirmDelete &&
    deletionEmail.trim().toLowerCase() === userEmail.trim().toLowerCase() &&
    sentCode !== '' &&
    inputCode === sentCode;

  const handleSendDeletionCode = () => {
    if (deletionEmail.trim().toLowerCase() !== userEmail.trim().toLowerCase()) return;

    setSendingCode(true);
    // Simulate API delay
    setTimeout(() => {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setSentCode(code);
      setSendingCode(false);
      // In a real app this would be an email. Here we show a simulated alert or notification.
      alert(`[SECURITY] Verification code sent to your email: ${code}`);
    }, 1500);
  };

  React.useEffect(() => {
    if (params.showAbout === 'true') {
      setAboutVisible(true);
      setFromNotification(true);
      // Auto-trigger update check and scroll to section when coming from notification
      setTimeout(() => {
        aboutScrollRef.current?.scrollTo({ y: 800, animated: true });
        handleUpdateCheck();
      }, 800);
    }
    if (params.upgrade === 'true') {
      setSelectedItem(menuItems.find(m => m.id === '3') || null);
    }
  }, [params.showAbout, params.upgrade]);

  // Load persistent rating data
  React.useEffect(() => {
    const loadRatingData = async () => {
      try {
        const [savedRating, savedSubmitted, savedDismissed] = await Promise.all([
          AsyncStorage.getItem('localRating'),
          AsyncStorage.getItem('isLocalRatingSubmitted'),
          AsyncStorage.getItem('hasDismissedReviewReminder')
        ]);

        if (savedRating) setLocalRating(parseInt(savedRating, 10));
        if (savedSubmitted) setIsLocalRatingSubmitted(savedSubmitted === 'true');
        if (savedDismissed) setHasDismissedReviewReminder(savedDismissed === 'true');
      } catch (e) {
        console.error('Failed to load rating data', e);
      }
    };
    loadRatingData();
  }, []);

  const toggleAbout = () => {
    if (fromNotification && aboutVisible) {
      setAboutVisible(false);
      setFromNotification(false);
      setUpdateStatus('idle');
      router.back();
    } else {
      const nextVisible = !aboutVisible;
      setAboutVisible(nextVisible);
      if (nextVisible) {
        setSelectedItem(null);
        setSelectedStat(null);
        handleShowPaymentModal(false);
        setShowPaymentDetailsModal(false);
        // Auto-show update status if one is available
        setUpdateStatus(appUpdateConfig.isUpdateAvailable ? 'available' : 'idle');
        setFromNotification(false);
      }
    }
  };

  const toggleSettingsModal = (item: MenuItem | null) => {
    if (item) {
      setAboutVisible(false);
      setSelectedStat(null);
      handleShowPaymentModal(false);
      setShowPaymentDetailsModal(false);
    }
    setSelectedItem(item);
    setSelectedSubItem(null);
    setIsEditingProfile(false);
    setConfirmDelete(false);
    setDeletionEmail('');
    setSentCode('');
    setInputCode('');
    setSelectedSecurityItem(null);
    setCurrentPass('');
    setNewPass('');
    setConfirmPass('');
    setPasswordError('');
    setPassUpdateSuccess(false);
    setCameFromSubscription(false);
    setIsFaqSectionCollapsed(true);
    setSavedScrollPosition(0);
    setShowRatingPreview(false);
    setLocalRating(0);
    setIsLocalRatingSubmitted(false);
  };
  const toggleStatsModal = (stat: { label: string, value: string, icon: IoniconsName } | null) => {
    if (stat) {
      setAboutVisible(false);
      setSelectedItem(null);
      handleShowPaymentModal(false);
      setShowPaymentDetailsModal(false);
    }
    setSelectedStat(stat);
  };
  
  const handleShowPaymentModal = (visible: boolean) => {
    if (visible) {
      setAboutVisible(false);
      setSelectedItem(null);
      setSelectedStat(null);
    }
    setShowPaymentModal(visible);
  };

  const restoreScrollPosition = () => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: savedScrollPosition, animated: false });
    }, 50);
  };

  const handleUpdatePassword = async () => {
    if (!currentPass || !newPass || !confirmPass) {
      setPasswordError('Please fill in all fields');
      return;
    }
    if (newPass !== confirmPass) {
      setPasswordError('New passwords do not match');
      return;
    }
    if (newPass.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }

    const user = auth.currentUser;
    if (!user || !user.email) {
      setPasswordError('You must be signed in with an email to change password.');
      return;
    }

    if (user.providerData.some(provider => provider.providerId === 'google.com')) {
      setPasswordError('Your password is managed by your Google Account.');
      return;
    }

    try {
      const credential = EmailAuthProvider.credential(user.email, currentPass);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPass);

      setPasswordError('');
      setPassUpdateSuccess(true);
      setTimeout(() => {
        setPassUpdateSuccess(false);
        setSelectedSecurityItem(null);
        setCurrentPass('');
        setNewPass('');
        setConfirmPass('');
      }, 2000);
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
        setPasswordError('Current password is incorrect.');
      } else {
        setPasswordError(error.message || 'Failed to update password.');
      }
    }
  };

  const handleToggle2FA = () => {
    // Generate a random 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setTfaSentCode(code);
    setShow2FAVerifyModal(true);
    // In a real app, send via SMS/Email. Here we simulate with alert.
    alert(`[SECURITY] Your 2FA verification code is: ${code}`);
  };

  const handleVerify2FA = async () => {
    if (tfaVerificationCode !== tfaSentCode) {
      alert('Invalid verification code. Please try again.');
      return;
    }

    setIs2FALoading(true);
    const user = auth.currentUser;
    if (user) {
      try {
        const newValue = !is2FAEnabled;
        await setDoc(doc(db, "users", user.uid), {
          is2FAEnabled: newValue
        }, { merge: true });
        
        setIs2FAEnabled(newValue);
        setShow2FAVerifyModal(false);
        setTfaVerificationCode('');
        alert(`Two-Factor Authentication has been ${newValue ? 'enabled' : 'disabled'} successfully.`);
      } catch (err) {
        console.error("Error updating 2FA:", err);
        alert('Failed to update 2FA. Please try again.');
      } finally {
        setIs2FALoading(false);
      }
    }
  };

  const handleSaveSecurityQuestion = async () => {
    if (!userSecurityQuestion || !userSecurityAnswer) {
      setSecurityError('Please select a question and provide an answer');
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      setSecurityError('You must be signed in to save a security question.');
      return;
    }

    try {
      await setDoc(doc(db, "users", user.uid), {
        securityQuestion: userSecurityQuestion,
        securityAnswer: userSecurityAnswer.toLowerCase().trim()
      }, { merge: true });

      setSecurityError('');
      setSecuritySaveSuccess(true);
      setIsQuestionSaved(true);
      setTimeout(() => {
        setSecuritySaveSuccess(false);
        setSelectedSecurityItem('Password Recovery');
      }, 2000);
    } catch (error: any) {
      console.error(error);
      setSecurityError('Failed to save security question. Please try again.');
    }
  };

  const handleLinkAccount = (provider: 'google' | 'facebook' | 'apple') => {
    setLinkingProvider(provider);
    setTimeout(() => {
      setLinkedAccounts(prev => ({ ...prev, [provider]: !prev[provider] }));
      setLinkingProvider(null);
    }, 1500);
  };

  const handleEditProfile = () => {
    if (isGuest) {
      setShowGuestPlanModal(true);
    } else {
      setSelectedItem(MENU_ITEMS[0]); // Open Account
      setSelectedSubItem('Personal Info');
    }
  };

  const handleChangePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'We need permissions to your photo library to change the profile picture.');
        return;
      }

      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        if (user) {
          try {
            await updateDoc(doc(db, "users", user.uid), {
              profilePhoto: uri
            });
            // The UserContext listener will catch this and update the global state
          } catch (err) {
            console.error("Failed to update profile photo in Firestore:", err);
            Alert.alert('Error', 'Failed to save profile photo.');
          }
        }
      }
    } catch (e) {
      console.error('Failed to pick profile image:', e);
      Alert.alert('Error', 'Failed to pick image.');
    }
  };

   const startEditing = () => {
    setTempEmail(userEmail);
    setTempFirstName(firstName);
    setTempLastName(lastName);
    setTempUsername(username);
    setTempPhoneNumber(phoneNumber);
    setIsEditingProfile(true);
  };

  const saveProfile = async () => {
    if (!user) return;

    // Normalize phone number (digits only)
    const normalizedPhone = tempPhoneNumber.replace(/\D/g, '');
    const newFullName = `${tempFirstName} ${tempLastName}`.trim() || 'User';

    try {
      // 1. Check if username is already taken (if changed)
      if (tempUsername && tempUsername !== username) {
        const q = query(collection(db, "users"), where("username", "==", tempUsername));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          Alert.alert('Username Taken', 'This username is already associated with another account.');
          return;
        }
      }

      // 2. Check if phone number is already taken (if changed)
      if (normalizedPhone && normalizedPhone !== (phoneNumber || '').replace(/\D/g, '')) {
        const q = query(collection(db, "users"), where("phoneNumber", "==", normalizedPhone));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          Alert.alert('Phone Number Taken', 'This phone number is already associated with another account.');
          return;
        }
      }

      // 3. Save to Firestore
      await updateDoc(doc(db, "users", user.uid), {
        fullName: newFullName,
        username: tempUsername,
        phoneNumber: normalizedPhone // Save normalized version
      });
      
      setIsEditingProfile(false);
      // The UserContext listener will trigger a re-render with new values
    } catch (err: any) {
      console.error("Failed to save profile on firebase:", err);
      Alert.alert('Error', err.message || 'Failed to save changes.');
    }
  };


  const cancelEditing = () => {
    setIsEditingProfile(false);
  };

  const handleUpdateCheck = () => {
    if (updateStatus !== 'idle') return;
    setUpdateStatus('checking');
    setTimeout(() => {
      if (appUpdateConfig.isUpdateAvailable) {
        setUpdateStatus('available');
      } else {
        setUpdateStatus('updated');
      }
    }, 1500);
  };

  const pickMedia = async (type: 'image' | 'video') => {
    // Note: launchImageLibraryAsync on modern Android uses the System Photo Picker 
    // which does not require applications to request broad READ_MEDIA permissions.
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: type === 'image' ? ['images'] : ['videos'],
      allowsMultipleSelection: true,
      quality: 1,
    });

    if (!result.canceled) {
      setAttachedMedia(prev => [...prev, ...result.assets]);
    }
  };

  const removeMedia = (uri: string) => {
    setAttachedMedia(prev => prev.filter(m => m.uri !== uri));
  };

  const handleSettingsDone = () => {
    if (showRatingPreview) {
      setShowRatingPreview(false);
      // We no longer reset localRating and isLocalRatingSubmitted here to allow persistence
      restoreScrollPosition();
      return;
    }
    if (selectedSecurityItem) {
      setSelectedSecurityItem(null);
      setPasswordError('');
      setPassUpdateSuccess(false);
      restoreScrollPosition();
    } else if (selectedSubItem) {
      setSelectedSubItem(null);
      setIsEditingProfile(false);
      restoreScrollPosition();
    } else if (showBillingHistory) {
      setShowBillingHistory(false);
      restoreScrollPosition();
    } else if (selectedItem?.id === '3') {
      if (cameFromSubscription) {
        setSelectedItem(MENU_ITEMS.find(m => m.id === '2') || null);
        setCameFromSubscription(false);
        restoreScrollPosition();
      } else {
        // On Choose Your Plan — Done keeps user here, × closes
        toggleSettingsModal(null);
      }
    } else {
      toggleSettingsModal(null);
    }
  };

  const handleStatsDone = () => {
    toggleStatsModal(null);
  };

  return (
    <View style={styles.container}>
      {/* ── Uniform Deep Dark Background ── */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0f0f14' }]}>
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
      </View>
      
      {/* ── About Modal ── */}
      <AboutModal
        visible={aboutVisible}
        onClose={toggleAbout}
        updateStatus={updateStatus}
        handleUpdateCheck={handleUpdateCheck}
        latestVersion={appUpdateConfig.latestVersion}
        updateMessage={appUpdateConfig.updateMessage}
        insets={insets}
        currentScrollY={currentScrollY}
        setCurrentScrollY={setCurrentScrollY}
        scrollContentHeight={scrollContentHeight}
        setScrollContentHeight={setScrollContentHeight}
        scrollViewHeight={scrollViewHeight}
        setScrollViewHeight={setScrollViewHeight}
      />
      {selectedItem && (
        <View 
          style={[
            StyleSheet.absoluteFill, 
            { 
              zIndex: 1000, 
              backgroundColor: '#0f0f14',
              marginTop: Platform.OS === 'android' ? 0 : 0 // Ensure full coverage
            }
          ]}
        >
          <BlurView intensity={99} tint="dark" style={StyleSheet.absoluteFill}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(15,15,25,0.98)' }]} />

          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
            style={{ flex: 1 }}
          >
            <View style={styles.settingsModalContainer}>
              <View style={styles.settingsModalContent}>
                <View style={[styles.settingsHeader, { justifyContent: 'flex-start', gap: 16 }]}>
                  <View style={[styles.headerLeadingIcon, { alignItems: 'center', justifyContent: 'center' }]}>
                    <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                    {selectedItem && (
                      <Ionicons 
                        name={(selectedSubItem && SUB_ITEM_ICONS[selectedSubItem] ? SUB_ITEM_ICONS[selectedSubItem] : (showBillingHistory ? 'receipt-outline' : selectedItem.icon)) as any} 
                        size={24} 
                        color={selectedItem.color} 
                      />
                    )}
                  </View>
                  <Text style={[styles.settingsModalTitle, { flex: 0, marginLeft: 0 }]}>
                    {selectedSecurityItem || selectedSubItem || selectedItem?.title}
                  </Text>
                </View>

              
              <ScrollView
                ref={scrollRef}
                style={styles.settingsScroll}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                automaticallyAdjustKeyboardInsets={true}
                onScroll={(e) => setCurrentScrollY(e.nativeEvent.contentOffset.y)}
                scrollEventThrottle={16}
                onContentSizeChange={(_, h) => setScrollContentHeight(h)}
                onLayout={(e) => setScrollViewHeight(e.nativeEvent.layout.height)}
                contentContainerStyle={{ paddingBottom: 160 }}
              >
                {selectedItem?.id === '1' && (
                  <AccountSection
                    scrollRef={scrollRef}
                    selectedSubItem={selectedSubItem}
                    setSelectedSubItem={setSelectedSubItem}
                    selectedSecurityItem={selectedSecurityItem}
                    setSelectedSecurityItem={setSelectedSecurityItem}
                    savedScrollPosition={savedScrollPosition}
                    setSavedScrollPosition={setSavedScrollPosition}
                    currentScrollY={currentScrollY}
                    userName={userName}
                    userEmail={userEmail}
                    firstName={firstName}
                    lastName={lastName}
                    username={username}
                    phoneNumber={phoneNumber}
                    profilePhoto={profilePhoto}
                    isEditingProfile={isEditingProfile}
                    startEditing={startEditing}
                    saveProfile={saveProfile}
                    cancelEditing={cancelEditing}
                    tempFirstName={tempFirstName}
                    setTempFirstName={setTempFirstName}
                    tempLastName={tempLastName}
                    setTempLastName={setTempLastName}
                    tempUsername={tempUsername}
                    setTempUsername={setTempUsername}
                    tempPhoneNumber={tempPhoneNumber}
                    setTempPhoneNumber={setTempPhoneNumber}
                    tempEmail={tempEmail}
                    setTempEmail={setTempEmail}
                    handleChangePhoto={handleChangePhoto}
                    currentPass={currentPass}
                    setCurrentPass={setCurrentPass}
                    newPass={newPass}
                    setNewPass={setNewPass}
                    confirmPass={confirmPass}
                    setConfirmPass={setConfirmPass}
                    passwordError={passwordError}
                    passUpdateSuccess={passUpdateSuccess}
                    handleUpdatePassword={handleUpdatePassword}
                    is2FAEnabled={is2FAEnabled}
                    is2FALoading={is2FALoading}
                    handleToggle2FA={handleToggle2FA}
                    activeDevices={activeDevices}
                    handleKickDevice={handleKickDevice}
                    linkedAccounts={linkedAccounts}
                    linkingProvider={linkingProvider}
                    handleLinkAccount={handleLinkAccount}
                    userSecurityQuestion={userSecurityQuestion}
                    setUserSecurityQuestion={setUserSecurityQuestion}
                    userSecurityAnswer={userSecurityAnswer}
                    setUserSecurityAnswer={setUserSecurityAnswer}
                    isQuestionSaved={isQuestionSaved}
                    securityError={securityError}
                    securitySaveSuccess={securitySaveSuccess}
                    handleSaveSecurityQuestion={handleSaveSecurityQuestion}
                    SECURITY_QUESTIONS={SECURITY_QUESTIONS}
                    SUB_ITEM_ICONS={SUB_ITEM_ICONS}
                  />
                )}

                {selectedItem?.id === '2' && ( // Subscription
                  <SubscriptionSection
                    showBillingHistory={showBillingHistory}
                    setShowBillingHistory={setShowBillingHistory}
                    isSubscribed={isSubscribed}
                    subscriptionBundle={subscriptionBundleDisplay}
                    subscriptionSpecs={subscriptionSpecs}
                    subscriptionBonus={subscriptionBonus}
                    remainingDays={remainingDays}
                    downloadsUsedToday={downloadsUsedToday}
                    getExternalDownloadLimit={getExternalDownloadLimit}
                    getRemainingDownloads={getRemainingDownloads}
                    renewalDate={renewalDate}
                    paymentMethod={paymentMethod}
                    activeDevices={activeDevices}
                    getDeviceLimit={getDeviceLimit}
                    handleKickDevice={handleKickDevice}
                    billingHistory={billingHistory}
                    upcomingMembership={upcomingMembership}
                    currentScrollY={currentScrollY}
                    setSavedScrollPosition={setSavedScrollPosition}
                    setCameFromSubscription={setCameFromSubscription}
                    setSelectedItem={setSelectedItem}
                    handleShowPaymentModal={handleShowPaymentModal}
                    toggleSettingsModal={toggleSettingsModal}
                    MENU_ITEMS={MENU_ITEMS}
                  />
                )}
                {selectedItem?.id === '3' && ( // Choose Your Plan
                  <ChoosePlanSection
                    isGuest={isGuest}
                    onGuestPlanSelect={() => setShowGuestPlanModal(true)}
                    isSubscribed={isSubscribed}
                    subscriptionBundle={subscriptionBundle}
                    upcomingMembership={upcomingMembership}
                    setSelectedPlanForPayment={setSelectedPlanForPayment}
                    handleShowPaymentModal={handleShowPaymentModal}
                  />
                )}

                <PreferencesAndActivity
                  selectedItem={selectedItem}
                  selectedSubItem={selectedSubItem}
                  setSelectedSubItem={setSelectedSubItem}
                  setSavedScrollPosition={setSavedScrollPosition}
                  currentScrollY={currentScrollY}
                  activeDownloads={activeDownloads}
                  downloadedMovies={downloadedMovies}
                  removeDownload={removeDownload}
                  notifications={notifications}
                  handleClearNotifications={handleClearNotifications}
                  handleNotificationPress={handleNotificationPress}
                  notifSettings={notifSettings}
                  toggleNotifSetting={toggleNotifSetting}
                  favorites={favorites}
                  toggleFavorite={toggleFavorite}
                  shortenGenre={shortenGenre}
                  onCloseSettings={() => setSelectedItem(null)}
                  appUpdateConfig={appUpdateConfig}
                />
                {selectedItem?.id === '8' && ( // Support
                  <SupportSection
                    showRatingPreview={showRatingPreview}
                    setShowRatingPreview={setShowRatingPreview}
                    localRating={localRating}
                    setLocalRating={setLocalRating}
                    isLocalRatingSubmitted={isLocalRatingSubmitted}
                    setIsLocalRatingSubmitted={setIsLocalRatingSubmitted}
                    hasDismissedReviewReminder={hasDismissedReviewReminder}
                    setHasDismissedReviewReminder={setHasDismissedReviewReminder}
                    currentScrollY={currentScrollY}
                    setSavedScrollPosition={setSavedScrollPosition}
                    isFaqSectionCollapsed={isFaqSectionCollapsed}
                    setIsFaqSectionCollapsed={setIsFaqSectionCollapsed}
                    expandedFaq={expandedFaq}
                    setExpandedFaq={setExpandedFaq}
                    feedback={feedback}
                    setFeedback={setFeedback}
                    isSendingFeedback={isSendingFeedback}
                    setIsSendingFeedback={setIsSendingFeedback}
                    feedbackSent={feedbackSent}
                    setFeedbackSent={setFeedbackSent}
                    attachedMedia={attachedMedia}
                    setAttachedMedia={setAttachedMedia}
                    pickMedia={pickMedia}
                    removeMedia={removeMedia}
                    userName={userName}
                    dynamicFaqs={dynamicFaqs}
                  />
                )}
                <AboutSection selectedItem={selectedItem} />
              </ScrollView>

              {(selectedItem?.id !== '3' || cameFromSubscription) && (
                <View style={[styles.modalFooter, { paddingBottom: Platform.OS === 'android' ? (insets.bottom > 0 ? insets.bottom + 12 : 24) : Math.max(insets.bottom + 10, 44) }]}>
                  {scrollContentHeight > scrollViewHeight && currentScrollY < scrollContentHeight - scrollViewHeight - 20 && (
                    <LinearGradient
                      colors={['transparent', '#0f0f14', '#0f0f14']}
                      style={[styles.footerGradient, { height: (Platform.OS === 'ios' ? 110 : 80) + insets.bottom }]}
                      pointerEvents="none"
                    />
                  )}
                  <TouchableOpacity style={styles.capsuleDoneBtn} onPress={handleSettingsDone}>
                    <View style={styles.pillSheen} />
                    <Text style={styles.capsuleDoneText}>
                      {showRatingPreview ? 'Back to Support' :
                       selectedSecurityItem ? 'Back to Security' : 
                       showBillingHistory ? 'Back to Subscription' :
                       selectedSubItem ? `Back to ${selectedItem?.title}` : 'Back'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
          </KeyboardAvoidingView>

          </BlurView>
        </View>
      )}


      <SubscriptionModals
        showPaymentModal={showPaymentModal}
        handleShowPaymentModal={handleShowPaymentModal}
        paymentMethods={paymentMethods}
        setPaymentMethods={setPaymentMethods}
        setPaymentMethod={setPaymentMethod}
        subscriptionBundle={subscriptionBundle}
        TOP={TOP}
        showPaymentDetailsModal={showPaymentDetailsModal}
        setShowPaymentDetailsModal={setShowPaymentDetailsModal}
        selectedPaymentMethod={selectedPaymentMethod}
        setSelectedPaymentMethod={setSelectedPaymentMethod}
        selectedPlanForPayment={selectedPlanForPayment}
        paymentPhone={paymentPhone}
        setPaymentPhone={setPaymentPhone}
        cardNumber={cardNumber}
        setCardNumber={setCardNumber}
        cardExpiry={cardExpiry}
        setCardExpiry={setCardExpiry}
        cardCVV={cardCVV}
        setCardCVV={setCardCVV}
        isProcessingPayment={paymentProcessing}
        setIsProcessingPayment={setPaymentProcessing}
        paymentStatusText={paymentStatusText}
        setPaymentStatusText={setPaymentStatusText}
        errorText={errorText}
        setErrorText={setErrorText}
        paymentSuccess={paymentSuccess}
        setPaymentSuccess={setPaymentSuccess}
        formatCardNumber={formatCardNumber}
        formatExpiry={formatExpiry}
        showBillingHistory={showBillingHistory}
        setShowBillingHistory={setShowBillingHistory}
        billingHistory={billingHistory}
        insets={insets}
        uid={auth.currentUser?.uid || ''}
        userEmail={userEmail}
        onPay={handleProceedPayment}
        onCancel={handleCancelPayment}
      />

      {/* Local Preview Stack for My List */}
      <Modal visible={navigationStack.length > 0} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          {navigationStack.map((item, index) => {
            const isFocused = index === navigationStack.length - 1;
            const onClose = () => {
              setNavigationStack((prev) => prev.slice(0, prev.length - 1));
            };

            if (item.type === 'grid') {
              return (
                <GridContent
                  key={`grid-${index}`}
                  title={item.title}
                  data={item.data}
                  onClose={onClose}
                  onSelect={(m: any) => {
                    if ("seasons" in m) {
                      setNavigationStack((prev) => [...prev, { type: 'series', series: m }]);
                    } else {
                      setNavigationStack((prev) => [...prev, { type: 'movie', movie: m }]);
                    }
                  }}
                />
              );
            }

            if (item.type === 'series') {
              return (
                <SeriesPreviewModal
                  key={`series-${index}`}
                  movie={item.series}
                  onClose={onClose}
                  onSwitch={(m: any) => {
                    if ("seasons" in m) {
                      setNavigationStack((prev) => [...prev, { type: 'series', series: m }]);
                    } else {
                      setNavigationStack((prev) => [...prev, { type: 'movie', movie: m }]);
                    }
                  }}
                  onSeeAll={(title: string, data: any[]) => setNavigationStack((prev) => [...prev, { type: 'grid', title, data }])}
                  playingNow={playingNow}
                  setPlayingNow={setPlayingNow}
                  setPlayerMode={setPlayerMode}
                  setPlayerTitle={setPlayerTitle}
                  setSelectedVideoUrl={setSelectedVideoUrl}
                  playerMode={playerMode}
                  playerTitle={playerTitle}
                  selectedVideoUrl={selectedVideoUrl}
                  isMuted={index !== navigationStack.length - 1 || !isFocused}
                  onShowPremium={() => setShowPremiumModal(true)}
                  onUpgrade={() => setShowPlanModal(true)}
                />
              );
            }

            return (
              <MoviePreviewContent
                key={`movie-${index}`}
                movie={item.movie}
                onClose={onClose}
                onSwitch={(m: any) => {
                  if ("seasons" in m) {
                    setNavigationStack((prev) => [...prev, { type: 'series', series: m }]);
                  } else {
                    setNavigationStack((prev) => [...prev, { type: 'movie', movie: m }]);
                  }
                }}
                onSeeAll={(title: string, data: any[]) => setNavigationStack((prev) => [...prev, { type: 'grid', title, data }])}
                playingNow={playingNow}
                setPlayingNow={setPlayingNow}
                setPlayerMode={setPlayerMode}
                setPlayerTitle={setPlayerTitle}
                setSelectedVideoUrl={setSelectedVideoUrl}
                playerMode={playerMode}
                playerTitle={playerTitle}
                selectedVideoUrl={selectedVideoUrl}
                isMuted={index !== navigationStack.length - 1 || !isFocused}
                onShowPremium={() => setShowPremiumModal(true)}
                onUpgrade={() => setShowPlanModal(true)}
              />
            );
          })}
        </View>
      </Modal>

      <PremiumAccessModal
        visible={showGuestPlanModal}
        isGuest={true}
        onClose={() => setShowGuestPlanModal(false)}
        onLogin={() => {
          setShowGuestPlanModal(false);
          router.replace('/login');
        }}
        onSignUp={() => {
          setShowGuestPlanModal(false);
          router.replace('/login?mode=signup');
        }}
        onUpgrade={() => {
          setShowGuestPlanModal(false);
          router.replace('/login');
        }}
        onSocialLogin={(provider) => {
          setShowGuestPlanModal(false);
          router.replace('/login');
        }}
        guestMessage="You need an account to purchase a premium plan. Sign up now to unlock unlimited access and sync your progress."
      />

      {/* ── Stats Modal ── */}
      <AnalyticsModal
        visible={!!selectedStat}
        onClose={() => toggleStatsModal(null)}
        selectedStat={selectedStat}
        setCurrentScrollY={setCurrentScrollY}
        setScrollContentHeight={setScrollContentHeight}
        setScrollViewHeight={setScrollViewHeight}
        currentScrollY={currentScrollY}
      />







      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />


      <Animated.ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: menuScrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        {/* ── Profile card ── */}
        <ProfileCard
          userName={userName}
          userEmail={userEmail}
          profileImageUri={profilePhoto}
          isSubscribed={isSubscribed}
          subscriptionBundle={subscriptionBundle}
          remainingDays={remainingDays}
          isGuest={isGuest}
          onEditProfile={handleEditProfile}
          paymentMethod={paymentMethod}
          onUpgrade={() => {
            if (isGuest) {
              setShowGuestPlanModal(true);
            } else if (isSubscribed) {
              // If already subscribed, show subscription details
              setSelectedItem(menuItems.find(m => m.id === '2') || null);
            } else {
              // If not subscribed, show plans
              setSelectedItem(menuItems.find(m => m.id === '3') || null);
            }
          }}
        />

        {/* ── Settings List ── */}
        <SettingsList
          menuItems={menuItems}
          userEmail={userEmail}
          onItemPress={(item) => {
            if (isGuest && (item.id === '1' || item.id === '2')) {
              setShowGuestPlanModal(true);
            } else {
              setSelectedItem(item);
            }
          }}
          onAdminPress={() => router.push('/admin')}
          onAboutPress={() => setAboutVisible(true)}
        />

        {/* ── Logout ── */}
        <LogoutButton
          onPress={async () => {
            try {
              // 1. Clear device footprint before signing out
              if (deviceId) {
                try {
                  await removeDevice(deviceId);
                } catch (e) {
                  console.error('Failed to remove device on logout:', e);
                }
              }

              // 2. Perform standard sign-outs
              try {
                await GoogleSignin.signOut();
              } catch (e) {}
              await signOut(auth);
              router.replace('/login');
            } catch (e) {
              console.error('Failed to logout:', e);
            }
          }}
        />

        {/* ── Footer ── */}
        <Text style={styles.versionText}>THE MOVIE ZONE 24 / 7 v{Constants.expoConfig?.version || Application.nativeApplicationVersion || '1.1.0'} ({Application.nativeBuildVersion})</Text>
      </Animated.ScrollView>

      {/* Bottom Fade Effect */}
      <LinearGradient
        colors={['transparent', '#13131f']}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 120, // Height of the fade effect
        }}
        pointerEvents="none"
      />
      {/* ── 2FA Verification Modal ── */}
      <TwoFAVerificationModal
        visible={show2FAVerifyModal}
        onClose={() => {
          setShow2FAVerifyModal(false);
          setTfaVerificationCode('');
        }}
        onConfirm={handleVerify2FA}
        verificationCode={tfaVerificationCode}
        setVerificationCode={setTfaVerificationCode}
        isLoading={is2FALoading}
      />
    </View>
  );
}


// End of Menu component. Styles migrated to components/menu/menu.styles.ts
