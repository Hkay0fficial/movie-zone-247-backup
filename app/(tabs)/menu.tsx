import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Image,
  TouchableOpacity,
  Platform,
  StatusBar,
  Linking,
  TextInput,
  Animated,
  Easing,
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  Dimensions,
  KeyboardAvoidingView,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { INDIAN_MOVIES, ALL_ROWS, MOST_DOWNLOADED, FAVOURITES, PROFILE_IMAGE_URI, shortenGenre, Series, Movie } from '@/constants/movieData';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { auth, db } from '../../constants/firebaseConfig';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Modal } from 'react-native';
import { useSubscription } from '../context/SubscriptionContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';


type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const TOP = Platform.OS === 'ios' ? 54 : (StatusBar.currentHeight ?? 0) + 10;

// ─── Menu items ────────────────────────────────────────────────────────────────
interface MenuItem {
  id: string;
  title: string;
  subtitle: string;
  icon: IoniconsName;
  color: string;
}

const MENU_ITEMS: MenuItem[] = [
  { id: '1', title: 'My Account', subtitle: 'Manage your profile & security', icon: 'person-outline', color: '#818cf8' },
  { id: 'admin', title: 'Admin Panel', subtitle: 'Content management dashboard', icon: 'shield-checkmark-outline', color: '#ef4444' },
  { id: '2', title: 'My Subscription', subtitle: 'Plan, billing, renewal', icon: 'diamond-outline', color: '#f59e0b' },
  { id: '3', title: 'Choose Your Plan', subtitle: 'Explore our membership tiers', icon: 'options-outline', color: '#8b5cf6' },
  { id: '4', title: 'Preferences', subtitle: 'Interface appearance', icon: 'settings-outline', color: '#38bdf8' },
  { id: '5', title: 'Downloads', subtitle: 'Offline movies & series', icon: 'cloud-download-outline', color: '#34d399' },
  { id: '6', title: 'Notifications', subtitle: 'Alerts & recommendations', icon: 'notifications-outline', color: '#f59e0b' },
   { id: '7', title: 'My List', subtitle: 'Your saved movies & series', icon: 'bookmark-outline', color: '#f472b6' },
  { id: '8', title: 'Help & Support', subtitle: 'FAQs, feedback, contact us', icon: 'help-circle-outline', color: '#a78bfa' },
  { id: '9', title: 'About', subtitle: 'Version, licenses, legal', icon: 'information-circle-outline', color: '#94a3b8' },
];

// ─── Menu Screen ──────────────────────────────────────────────────────────────
export default function MenuScreen() {
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
  const aboutScrollRef = React.useRef<ScrollView>(null);
  const [selectedItem, setSelectedItem] = React.useState<MenuItem | null>(null);
  const [selectedSubItem, setSelectedSubItem] = React.useState<string | null>(null);
  
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
  const [updateStatus, setUpdateStatus] = React.useState<'idle' | 'checking' | 'updated'>('idle');
  const [cameFromSubscription, setCameFromSubscription] = React.useState(false);
  const [fromNotification, setFromNotification] = React.useState(false);
  const router = useRouter();

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
  const [notifications, setNotifications] = React.useState([
    { id: '1', title: 'New Arrival', message: 'Interstellar 2 is now streaming! Watch it in 4K.', time: '2h ago', icon: 'film-outline', color: '#6366f1', unread: true, type: 'content' },
    { id: '2', title: 'Subscription Renewed', message: 'Your Premium plan was successfully renewed. Enjoy!', time: '1d ago', icon: 'refresh-outline', color: '#10b981', unread: false, type: 'subscription' },
    { id: '3', title: 'Series Update', message: 'New episodes of "The Last of Us" are available now.', time: '2d ago', icon: 'tv-outline', color: '#f59e0b', unread: false, type: 'content' },
    { id: '4', title: 'Account Security', message: 'New sign-in detected on your account from Lagos, NG.', time: '3d ago', icon: 'shield-checkmark-outline', color: '#ef4444', unread: false, type: 'security' },
  ]);

  const [notifSettings, setNotifSettings] = React.useState({
    newReleases: true,
    myListUpdates: true,
    recommendations: false,
    billingAccount: true,
  });

  const handleClearNotifications = () => setNotifications([]);

  const handleNotificationPress = (notif: any) => {
    // Mark as read
    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, unread: false } : n));
    
    if (notif.type === 'subscription') {
      const subItem = MENU_ITEMS.find(i => i.id === '2');
      if (subItem) setSelectedItem(subItem);
    } else if (notif.type === 'security') {
      const accItem = MENU_ITEMS.find(i => i.id === '1');
      if (accItem) {
        setSelectedItem(accItem);
        setSelectedSubItem('Password & Security');
      }
    } else if (notif.type === 'content') {
      Alert.alert(notif.title, notif.message, [
        { text: 'Watch Now', onPress: () => toggleSettingsModal(null) },
        { text: 'Close', style: 'cancel' }
      ]);
    }
  };

  const toggleNotifSetting = async (key: keyof typeof notifSettings) => {
    const newValue = !notifSettings[key];
    setNotifSettings(prev => ({ ...prev, [key]: newValue }));
    
    const user = auth.currentUser;
    if (user) {
      try {
        await setDoc(doc(db, "users", user.uid), {
          notificationPrefs: { ...notifSettings, [key]: newValue }
        }, { merge: true });
      } catch (err) {
        console.error("Error saving notification settings:", err);
      }
    }
  };

  const [scrollViewHeight, setScrollViewHeight] = React.useState(0);

  // Profile State
  const [userName, setUserName] = React.useState('Loading...');
  const [userEmail, setUserEmail] = React.useState('');
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [phoneNumber, setPhoneNumber] = React.useState('');

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserEmail(user.email || '');
        
        // Fetch additional details from Firestore
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUserName(data.fullName || user.displayName || 'User');
            if (data.notificationPrefs) {
              setNotifSettings(data.notificationPrefs);
            }

            // Split name for convenience
            const nameToSplit = data.fullName || user.displayName || '';
            const parts = nameToSplit.split(' ');
            setFirstName(parts[0] || '');
            setLastName(parts.slice(1).join(' ') || '');
            if (data.is2FAEnabled !== undefined) {
              setIs2FAEnabled(data.is2FAEnabled);
            }
          } else {
            setUserName(user.displayName || 'User');
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
          setUserName(user.displayName || 'User');
        }
      } else {
        // Not logged in, redirect or show guest
        setUserName('Guest User');
        setUserEmail('');
      }
    });
    return () => unsubscribe();
  }, []);

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
    downloadsUsedToday, getExternalDownloadLimit, getRemainingDownloads,
    recordExternalDownload, recordInAppDownload
  } = useSubscription();

  const [isSubscribed, setIsSubscribed] = React.useState(true); // Default to true for Haruna
  const [subscriptionBonus, setSubscriptionBonus] = React.useState('+2 days bonus');
  const [remainingDays, setRemainingDays] = React.useState(16);
  const [subscriptionPrice, setSubscriptionPrice] = React.useState('5,000 Ugx');
  const [renewalDate, setRenewalDate] = React.useState('March 27, 2026');
  const [paymentMethod, setPaymentMethod] = React.useState('MTN Money • 077 121 2121');
  const [subscriptionSpecs, setSubscriptionSpecs] = React.useState<string[]>(['2k Quality', 'Watch unlimited movies', 'Ad-free experience', 'Access to all content', 'Unlimited in-app download', '5 external downloads', '1 device']);
  const [upcomingMembership, setUpcomingMembership] = React.useState<any>(null);
  const [billingHistory, setBillingHistory] = React.useState<any[]>([
    { id: 'TX-12903', date: 'Mar 11, 2026', plan: '2 week', amount: '5,000 Ugx', method: 'MTN Money • 078 600 0000' }
  ]);
  const [showBillingHistory, setShowBillingHistory] = React.useState(false);
  const [paymentMethods, setPaymentMethods] = React.useState<any[]>([
    { id: '1', type: 'mtn', label: 'MTN Money • 077 121 2121', icon: 'phone-portrait-outline', color: '#ffcc00', isDefault: true }
  ]);
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
  const [paymentSuccess, setPaymentSuccess] = React.useState(false);
  const [savePaymentMethod, setSavePaymentMethod] = React.useState(true);

  const handleProceedPayment = () => {
    setPaymentProcessing(true);
    setTimeout(() => {
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
        setIsSubscribed(true);
        // Derive clean label and days from selected plan
        const planName = selectedPlanForPayment?.name || '';
        const label = planName.split(' [')[0]; // e.g. '1 week', '2 week', '1 Month', '2 months'
        const daysMap: Record<string, number> = {
          '1 week': 8,   // 7 + 1 bonus
          '2 week': 16,  // 14 + 2 bonus
          '1 Month': 34,  // 30 + 4 bonus
          '2 months': 67,  // 60 + 7 bonus
        };
        const priceMap: Record<string, string> = {
          '1 week': '2,500 Ugx',
          '2 week': '5,000 Ugx',
          '1 Month': '10,000 Ugx',
          '2 months': '20,000 Ugx',
        };
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

        if (isSubscribed) {
          // Add to Queue
          // Parse current renewal date carefully (it's in "Month Day, Year" format)
          const parts = renewalDate.replace(',', '').split(' '); // ["March", "27", "2026"]
          const monthMap: Record<string, number> = {
            'January': 0, 'February': 1, 'March': 2, 'April': 3, 'May': 4, 'June': 5,
            'July': 6, 'August': 7, 'September': 8, 'October': 9, 'November': 10, 'December': 11
          };
          const currentExpiry = new Date(parseInt(parts[2]), monthMap[parts[0]], parseInt(parts[1]));

          const newExpiry = new Date(currentExpiry);
          newExpiry.setDate(newExpiry.getDate() + daysCount);
          const options: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' };

          setUpcomingMembership({
            bundle: label,
            bonus: bonusPart,
            price: price,
            days: daysCount,
            startDate: renewalDate,
            expiryDate: newExpiry.toLocaleDateString('en-US', options),
            paymentUsed: formattedPayment,
            specs: selectedPlanForPayment?.specs || []
          });
        } else {
          // Set as Active
          setSubscriptionBundle(label || 'Premium');
          setSubscriptionBonus(bonusPart);
          setRemainingDays(daysCount);
          setSubscriptionPrice(price);
          setSubscriptionSpecs(selectedPlanForPayment?.specs || []);

          const expiry = new Date();
          expiry.setDate(expiry.getDate() + daysCount);
          const options: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' };
          setRenewalDate(expiry.toLocaleDateString('en-US', options));
          setIsSubscribed(true);
        }

        const newTx = {
          id: `TX-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
          date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          plan: label,
          amount: price,
          method: formattedPayment
        };
        setBillingHistory(prev => [newTx, ...prev]);

        if (savePaymentMethod) {
          const newPayment = {
            id: Math.random().toString(36).substr(2, 9),
            type: selectedPaymentMethod?.id,
            label: formattedPayment,
            icon: selectedPaymentMethod?.icon,
            isDefault: paymentMethods.length === 0,
            color: selectedPaymentMethod?.color
          };
          setPaymentMethods(prev => [...prev, newPayment]);
        }

        setPaymentMethod(formattedPayment);

        if (isManageBillingFlow) {
          setIsManageBillingFlow(false);
          // Redirect to Choose Your Plan
          toggleSettingsModal(MENU_ITEMS.find(m => m.id === '3') || null);
        }
      }, 1800);
    }, 2000);
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

  const [activeDevices, setActiveDevices] = React.useState([
    { id: '1', device: 'MacBook Pro 16"', location: 'Singapore', time: 'Active Now', current: true },
    { id: '2', device: 'iPhone 15 Pro', location: 'Singapore', time: '2 hours ago', current: false },
  ]);

  const getDeviceLimit = () => {
    if (!isSubscribed) return 1;
    const b = subscriptionBundle.toLowerCase();
    if (b.includes('month')) return b.includes('2') ? 3 : 2;
    return 1; // 1 week or 2 week
  };

  const handleKickDevice = (deviceId: string) => {
    setActiveDevices(prev => prev.filter(d => d.id !== deviceId));
    alert('Device has been logged out successfully.');
  };

  // Simulate Option B: Session Takeover
  const simulateNewDeviceLogin = () => {
    const limit = getDeviceLimit();
    const newDevice = {
      id: Math.random().toString(36).substr(2, 9),
      device: 'New Phone Logged In',
      location: 'Current Location',
      time: 'Just Now',
      current: false
    };

    setActiveDevices(prev => {
      let updated = [newDevice, ...prev];
      if (updated.length > limit) {
        // Kick out the oldest session
        const kicked = updated.pop();
        alert(`Device Limit Reached (${limit}). Oldest session (${kicked?.device}) was automatically logged out.`);
      }
      return updated;
    });
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
      setSelectedItem(MENU_ITEMS.find(m => m.id === '3') || null);
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
        setUpdateStatus('idle');
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

  const handleUpdatePassword = () => {
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

    // Simulate update
    setPasswordError('');
    setPassUpdateSuccess(true);
    setTimeout(() => {
      setPassUpdateSuccess(false);
      setSelectedSecurityItem(null);
      setCurrentPass('');
      setNewPass('');
      setConfirmPass('');
    }, 2000);
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

  const handleSaveSecurityQuestion = () => {
    if (!userSecurityQuestion || !userSecurityAnswer) {
      setSecurityError('Please select a question and provide an answer');
      return;
    }
    setSecurityError('');
    setSecuritySaveSuccess(true);
    setIsQuestionSaved(true);
    setTimeout(() => {
      setSecuritySaveSuccess(false);
      setSelectedSecurityItem('Password Recovery');
    }, 2000);
  };

  const handleLinkAccount = (provider: 'google' | 'facebook' | 'apple') => {
    setLinkingProvider(provider);
    setTimeout(() => {
      setLinkedAccounts(prev => ({ ...prev, [provider]: !prev[provider] }));
      setLinkingProvider(null);
    }, 1500);
  };

  const handleEditProfile = () => {
    setSelectedItem(MENU_ITEMS[0]); // Open Account
    setSelectedSubItem('Personal Info');
  };

  const handleChangePhoto = () => {
    alert('Photo Library access simulation: Select a new profile picture.');
  };

   const startEditing = () => {
    setTempEmail(userEmail);
    setTempFirstName(firstName);
    setTempLastName(lastName);
    setTempUsername(username);
    setTempPhoneNumber(phoneNumber);
    setIsEditingProfile(true);
  };

  const saveProfile = () => {
    const newFullName = `${tempFirstName} ${tempLastName}`.trim() || 'User';
    setUserName(newFullName);
    setUserEmail(tempEmail);
    setFirstName(tempFirstName);
    setLastName(tempLastName);
    setUsername(tempUsername);
    setPhoneNumber(tempPhoneNumber);
    setIsEditingProfile(false);
  };


  const cancelEditing = () => {
    setIsEditingProfile(false);
  };

  const handleUpdateCheck = () => {
    if (updateStatus !== 'idle') return;
    setUpdateStatus('checking');
    setTimeout(() => {
      setUpdateStatus('updated');
    }, 2000);
  };

  const pickMedia = async (type: 'image' | 'video') => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need camera roll permissions to attach media.');
      return;
    }

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
      <Modal 
        visible={aboutVisible} 
        transparent 
        animationType="fade" 
        onRequestClose={toggleAbout}
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
                <TouchableOpacity style={styles.fullScreenCloseBtn} onPress={toggleAbout}>
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
                    <Text style={styles.featureText}>FULL HD</Text>
                  </View>
                  <View style={styles.featureRow}>
                    <Ionicons name="videocam" size={14} color="#38bdf8" />
                    <Text style={styles.featureText}>Ultra HD 2K Streaming</Text>
                  </View>
                  <View style={styles.featureRow}>
                    <Ionicons name="download" size={14} color="#34d399" />
                    <Text style={styles.featureText}>Unlimited Offline in app Downloads</Text>
                  </View>
                  <View style={styles.featureRow}>
                    <Ionicons name="infinite" size={14} color="#a78bfa" />
                    <Text style={styles.featureText}>Ad-Free Experience (Premium)</Text>
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
                      <Text style={styles.infoValue}>2.4.1 (Stable)</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Build</Text>
                      <Text style={styles.infoValue}>#102938</Text>
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
                  <Text style={styles.aboutLabel}>Legal</Text>
                  <View style={styles.legalLinks}>
                    <TouchableOpacity><Text style={styles.legalLink}>Privacy Policy</Text></TouchableOpacity>
                    <View style={styles.legalDivider} />
                    <TouchableOpacity><Text style={styles.legalLink}>Terms of Service</Text></TouchableOpacity>
                  </View>
                  <Text style={styles.aboutDescSmall}>
                    © 2026 Movie Zone. All rights reserved. Cinematic content is provided under license from their respective owners.
                  </Text>
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
                <TouchableOpacity onPress={toggleAbout} style={{ width: '100%' }}>
                  <LinearGradient
                    colors={['#5B5FEF', '#3d44ff']}
                    style={styles.fullScreenActionBtn}
                  >
                    <Text style={styles.editActionText}>Close</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>

            </View>
          </View>
        </BlurView>
      </Modal>
      <Modal 
        visible={!!selectedItem} 
        transparent 
        animationType="fade" 
        onRequestClose={handleSettingsDone}
        statusBarTranslucent={true}
      >
        <BlurView intensity={99} tint="dark" style={StyleSheet.absoluteFill}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(15,15,25,0.98)' }]} />

          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
            style={{ flex: 1 }}
          >
            <View style={styles.settingsModalContainer}>
              <View style={styles.settingsModalContent}>
                <View style={styles.settingsHeader}>
                  <View style={styles.headerLeadingWrap}>
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
                  <Text style={styles.settingsModalTitle}>
                    {selectedSecurityItem || selectedSubItem || selectedItem?.title}
                  </Text>
                </View>
                <TouchableOpacity 
                  style={styles.circularCloseBtn} 
                  onPress={() => toggleSettingsModal(null)}
                >
                  <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
                  <Ionicons name="close" size={20} color="#fff" />
                </TouchableOpacity>
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

                {selectedItem?.id === '1' && !selectedSubItem && ( // Account List
                  <View style={styles.settingsContentSection}>
                    <Text style={styles.settingsText}>Update your basic personal details and profile information.</Text>
                    <View style={{ width: '100%', marginTop: 20, marginBottom: 20 }}>
                      {/* White Background Glow */}
                      <View style={{
                        position: 'absolute',
                        top: 15,
                        left: 15,
                        right: 15,
                        bottom: 15,
                        backgroundColor: '#ffffff',
                        borderRadius: 32,
                        opacity: 0.15,
                        zIndex: 0,
                        shadowColor: '#ffffff',
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: 1,
                        shadowRadius: 25,
                      }} />
                      <View style={[styles.settingsList, {
                        backgroundColor: 'rgba(30, 30, 45, 0.98)',
                        borderRadius: 32,
                        borderWidth: 1.5,
                        borderColor: 'rgba(255, 255, 255, 0.15)',
                        shadowColor: '#000000',
                        shadowOffset: { width: 0, height: 8 },
                        shadowOpacity: 0.4,
                        shadowRadius: 20,
                        elevation: 12,
                        overflow: 'hidden',
                        paddingVertical: 10
                      }]}>
                      {[
                        { label: 'Personal Info', icon: 'person-outline' },
                        { label: 'Password & Security', icon: 'lock-closed-outline' },
                      ].map((item, index, l) => (
                        <TouchableOpacity 
                          key={item.label} 
                          style={[
                            styles.settingsRow, 
                            index === l.length - 1 && { borderBottomWidth: 0 }
                          ]} 
                          onPress={() => { setSavedScrollPosition(currentScrollY); setSelectedSubItem(item.label); }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                            <Ionicons name={item.icon as any} size={20} color="#818cf8" />
                            <Text style={styles.settingsRowText}>{item.label}</Text>
                          </View>
                          <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.2)" />
                        </TouchableOpacity>
                      ))}
                      <View style={{ height: 1.5, backgroundColor: 'rgba(255,255,255,0.03)', marginHorizontal: 16 }} />
                      <TouchableOpacity
                        style={[styles.settingsRow, { borderBottomWidth: 0, paddingTop: 20 }]}
                        onPress={() => { setSavedScrollPosition(currentScrollY); setSelectedSubItem('Delete Account'); }}
                      >
                        <Text style={[styles.settingsRowText, { color: '#ef4444' }]}>Delete Account</Text>
                        <Ionicons name="trash-outline" size={18} color="#ef4444" />
                      </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                )}

                {selectedItem?.id === '1' && selectedSubItem === 'Personal Info' && (
                  <View style={styles.settingsContentSection}>
                    {/* Integrated Profile Header */}
                    <View style={styles.compactProfileHeader}>
                      <TouchableOpacity style={styles.compactAvatarWrapper} activeOpacity={0.7} onPress={handleChangePhoto}>
                        <Image source={{ uri: PROFILE_IMAGE_URI }} style={styles.compactAvatar} />
                        <LinearGradient
                          colors={['#5B5FEF', '#3d44ff']}
                          style={styles.avatarMiniBadge}
                        >
                          <Ionicons name="camera" size={10} color="#fff" />
                        </LinearGradient>
                      </TouchableOpacity>
                      <View style={styles.headerInfo}>
                        <Text style={styles.headerDisplayName}>{userName}</Text>
                        <Text style={styles.headerEmail}>{userEmail}</Text>
                      </View>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
                      {/* Section 1: Identity */}
                      <View style={styles.piInfoCardGroup}>
                        <Text style={styles.piInfoGroupTitle}>Identity</Text>
                        <BlurView intensity={20} tint="dark" style={styles.piInfoCard}>
                          {[
                            { label: 'Username', value: `@${username}`, temp: tempUsername, set: setTempUsername, icon: 'at-outline' },
                          ].map((field, idx) => (
                            <View key={field.label} style={[styles.piInfoRow, styles.piNoBorder]}>

                              <Ionicons name={field.icon as any} size={18} color="#818cf8" style={styles.piInfoIcon} />
                              <View style={{ flex: 1 }}>
                                <Text style={styles.piInfoLabel}>{field.label}</Text>
                                {isEditingProfile ? (
                                  <TextInput
                                    style={styles.piInfoInput}
                                    value={field.temp}
                                    onChangeText={field.set}
                                    placeholder={field.label}
                                    placeholderTextColor="rgba(255,255,255,0.2)"
                                    autoCapitalize="none"
                                  />
                                ) : (
                                  <Text style={styles.piInfoValue}>{field.value}</Text>
                                )}
                              </View>
                            </View>
                          ))}
                          
                          <View style={styles.piNameGrid}>
                            {[
                              { label: 'First Name', value: firstName, temp: tempFirstName, set: setTempFirstName },
                              { label: 'Last Name', value: lastName, temp: tempLastName, set: setTempLastName },
                            ].map((field) => (
                              <View key={field.label} style={styles.piGridItem}>
                                <Text style={styles.piInfoLabel}>{field.label}</Text>
                                {isEditingProfile ? (
                                  <TextInput
                                    style={styles.piInfoInput}
                                    value={field.temp}
                                    onChangeText={field.set}
                                    placeholder={field.label}
                                    placeholderTextColor="rgba(255,255,255,0.2)"
                                  />
                                ) : (
                                  <Text style={styles.piInfoValue}>{field.value}</Text>
                                )}
                              </View>
                            ))}
                          </View>
                        </BlurView>
                      </View>

                      {/* Section 2: Contact */}
                      <View style={styles.piInfoCardGroup}>
                        <Text style={styles.piInfoGroupTitle}>Contact Details</Text>
                        <BlurView intensity={20} tint="dark" style={styles.piInfoCard}>
                          <View style={styles.piInfoRow}>
                            <Ionicons name="mail-outline" size={18} color="#818cf8" style={styles.piInfoIcon} />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.piInfoLabel}>Email Address</Text>
                              {isEditingProfile ? (
                                <TextInput
                                  style={styles.piInfoInput}
                                  value={tempEmail}
                                  onChangeText={setTempEmail}
                                  placeholder="Email"
                                  keyboardType="email-address"
                                  autoCapitalize="none"
                                />
                              ) : (
                                <Text style={styles.piInfoValue}>{userEmail}</Text>
                              )}
                            </View>
                          </View>
                          <View style={[styles.piInfoRow, styles.piNoBorder]}>
                            <Ionicons name="call-outline" size={18} color="#818cf8" style={styles.piInfoIcon} />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.piInfoLabel}>Phone Number</Text>
                              {isEditingProfile ? (
                                <TextInput
                                  style={styles.piInfoInput}
                                  value={tempPhoneNumber}
                                  onChangeText={setTempPhoneNumber}
                                  placeholder="Phone"
                                  keyboardType="phone-pad"
                                />
                              ) : (
                                <Text style={styles.piInfoValue}>{phoneNumber || 'Link your phone'}</Text>
                              )}
                            </View>
                          </View>
                        </BlurView>
                      </View>

                      {/* Section 3: Actions Row */}
                      {!isEditingProfile ? (
                        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
                           <BlurView intensity={10} tint="dark" style={[styles.piMetadataPill, { flex: 1, marginBottom: 0 }]}>
                             <Ionicons name="calendar-outline" size={14} color="rgba(255,255,255,0.4)" />
                             <Text style={styles.piMetadataText}>Member Since: March 2024</Text>
                           </BlurView>

                          <TouchableOpacity 
                            style={[styles.piMainEditBtnWrapper, { flex: 1, marginTop: 0, marginBottom: 0 }]} 
                            onPress={startEditing}
                            activeOpacity={0.7}
                          >
                            <BlurView intensity={65} tint="dark" style={[styles.piMainEditBtn, { height: 44 }]}>
                              <Ionicons name="create-outline" size={16} color="#fff" />
                              <Text style={styles.piMainEditBtnText}>Edit Profile</Text>
                            </BlurView>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View style={styles.piEditActionsRow}>
                          <TouchableOpacity style={styles.piCancelBtn} onPress={cancelEditing}>
                            <Text style={styles.piCancelBtnText}>Cancel</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.piSaveBtnWrapper} onPress={saveProfile}>
                            <LinearGradient colors={['#5B5FEF', '#4A4ED1']} style={styles.piSaveBtn}>
                              <Text style={styles.piSaveBtnText}>Save Changes</Text>
                            </LinearGradient>
                          </TouchableOpacity>
                        </View>
                      )}

                    </ScrollView>

                    {/* Footer padding */}
                    <View style={{ height: 20 }} />
                  </View>
                )}

                {selectedItem?.id === '1' && selectedSubItem === 'Password & Security' && (
                  <View style={styles.settingsContentSection}>


                    {!selectedSecurityItem && <Text style={styles.settingsText}>Manage your password, security settings, and login protection.</Text>}

                    {!selectedSecurityItem ? (
                      <View style={{ width: '100%', marginBottom: 20, marginTop: 10 }}>
                        <View style={{ position: 'absolute', top: 15, left: 15, right: 15, bottom: 15, backgroundColor: '#ffffff', borderRadius: 32, opacity: 0.15, shadowColor: '#ffffff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 25 }} />
                        <View style={[styles.settingsList, { backgroundColor: 'rgba(30, 30, 45, 0.98)', borderRadius: 32, borderWidth: 1.5, borderColor: 'rgba(255, 255, 255, 0.15)', shadowColor: '#000000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 12, overflow: 'hidden', paddingVertical: 10 }]}>
                          <TouchableOpacity style={styles.settingsRow} onPress={() => { setSavedScrollPosition(currentScrollY); setSelectedSecurityItem('Change Password'); }}>
                            <Text style={styles.settingsRowText}>Change Password</Text>
                            <Ionicons name="lock-closed" size={14} color="#475569" />
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.settingsRow} onPress={() => { setSavedScrollPosition(currentScrollY); setSelectedSecurityItem('Two-Factor Authentication'); }}>
                            <Text style={styles.settingsRowText}>Two-Factor Authentication</Text>
                            <Ionicons name="shield-checkmark" size={14} color="#ef4444" />
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.settingsRow} onPress={() => { setSavedScrollPosition(currentScrollY); setSelectedSecurityItem('Login Activity'); }}>
                            <Text style={styles.settingsRowText}>Login Activity</Text>
                            <Ionicons name="time" size={14} color="#475569" />
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.settingsRow} onPress={() => { setSavedScrollPosition(currentScrollY); setSelectedSecurityItem('Password Recovery'); }}>
                            <Text style={styles.settingsRowText}>Password Recovery</Text>
                            <Ionicons name="key-outline" size={14} color="#818cf8" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : selectedSecurityItem === 'Change Password' ? (
                      <View style={{ width: '100%', marginBottom: 20 }}>
                        <View style={{ position: 'absolute', top: 15, left: 15, right: 15, bottom: 15, backgroundColor: '#ffffff', borderRadius: 24, opacity: 0.15, shadowColor: '#ffffff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 25 }} />
                        <View style={[styles.securityCard, { backgroundColor: 'rgba(30, 30, 45, 0.98)', borderWidth: 1.5, borderColor: 'rgba(255, 255, 255, 0.15)', shadowColor: '#000000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 12 }]}>
                        {passUpdateSuccess && (
                          <View style={styles.successBanner}>
                            <Ionicons name="checkmark-circle" size={20} color="#34d399" />
                            <Text style={styles.successText}>Password updated successfully!</Text>
                          </View>
                        )}
                        <Text style={styles.securityTitle}>Change Password</Text>
                        <Text style={styles.securityDesc}>Ensure your new password is at least 8 characters long and includes a mix of letters and numbers.</Text>

                        <View style={styles.detailCard}>
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Current Password</Text>
                            <TextInput
                              style={styles.editInput}
                              value={currentPass}
                              onChangeText={setCurrentPass}
                              placeholder="••••••••"
                              placeholderTextColor="#64748b"
                              secureTextEntry
                            />
                          </View>
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>New Password</Text>
                            <TextInput
                              style={styles.editInput}
                              value={newPass}
                              onChangeText={setNewPass}
                              placeholder="••••••••"
                              placeholderTextColor="#64748b"
                              secureTextEntry
                            />
                          </View>
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Confirm New Password</Text>
                            <TextInput
                              style={styles.editInput}
                              value={confirmPass}
                              onChangeText={setConfirmPass}
                              placeholder="••••••••"
                              placeholderTextColor="#64748b"
                              secureTextEntry
                            />
                          </View>
                          {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
                        </View>

                        <TouchableOpacity style={[styles.requestCodeBtn, { marginTop: 24 }]} onPress={handleUpdatePassword}>
                          <Text style={styles.requestCodeText}>Update Password</Text>
                        </TouchableOpacity>
                        </View>
                      </View>
                    ) : selectedSecurityItem === 'Two-Factor Authentication' ? (
                      <View style={{ width: '100%', marginBottom: 20 }}>
                        <View style={{ position: 'absolute', top: 15, left: 15, right: 15, bottom: 15, backgroundColor: '#ffffff', borderRadius: 24, opacity: 0.15, shadowColor: '#ffffff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 25 }} />
                        <View style={[styles.securityCard, { backgroundColor: 'rgba(30, 30, 45, 0.98)', borderWidth: 1.5, borderColor: 'rgba(255, 255, 255, 0.15)', shadowColor: '#000000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 12 }]}>
                        <Text style={styles.securityTitle}>Two-Factor Authentication</Text>
                        <Text style={styles.securityDesc}>Add an extra layer of security to your account by requiring a code from your phone in addition to your password.</Text>

                        <TouchableOpacity
                          style={styles.tfaToggleBox}
                          activeOpacity={0.8}
                          onPress={handleToggle2FA}
                          disabled={is2FALoading}
                        >
                          <Text style={styles.tfaLabel}>2FA Status</Text>
                          {is2FALoading ? (
                            <View style={{ width: 100, height: 20, justifyContent: 'center', alignItems: 'center' }}>
                              <Text style={{ color: '#64748b', fontSize: 10 }}>UPDATING...</Text>
                            </View>
                          ) : (
                            <Text style={[styles.tfaStatus, is2FAEnabled && { color: '#34d399' }]}>
                              {is2FAEnabled ? 'ENABLED' : 'DISABLED'}
                            </Text>
                          )}
                        </TouchableOpacity>

                        <View style={styles.deletionWarningBox}>
                          <Text style={[styles.deletionDesc, { marginBottom: 0 }]}>
                            We highly recommend enabling 2FA to protect your account from unauthorized access.
                          </Text>
                        </View>
                        </View>
                      </View>
                    ) : selectedSecurityItem === 'Login Activity' ? (
                      <View style={{ width: '100%', marginBottom: 20 }}>
                        <View style={{ position: 'absolute', top: 15, left: 15, right: 15, bottom: 15, backgroundColor: '#ffffff', borderRadius: 24, opacity: 0.15, shadowColor: '#ffffff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 25 }} />
                        <View style={[styles.securityCard, { backgroundColor: 'rgba(30, 30, 45, 0.98)', borderWidth: 1.5, borderColor: 'rgba(255, 255, 255, 0.15)', shadowColor: '#000000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 12 }]}>
                        <Text style={styles.securityTitle}>Recent Login Activity</Text>
                        <Text style={styles.securityDesc}>Check the devices where you're currently logged in or have recently accessed your account.</Text>

                        <View style={{ gap: 8 }}>
                          {activeDevices.map((session) => (
                            <View key={session.id} style={styles.sessionItem}>
                              <View style={styles.sessionIcon}>
                                <Ionicons
                                  name={session.device.includes('iPhone') || session.device.includes('Phone') ? 'phone-portrait-outline' : session.device.includes('Mac') || session.device.includes('desktop') ? 'desktop-outline' : 'laptop-outline'}
                                  size={24}
                                  color={session.current ? "#10b981" : "#818cf8"}
                                />
                              </View>
                              <View style={styles.sessionInfo}>
                                <Text style={styles.sessionDevice}>{session.device}</Text>
                                <Text style={styles.sessionDetails}>{session.location} • {session.time}</Text>
                              </View>
                              {session.current ? (
                                <Text style={styles.currentStatus}>Active</Text>
                              ) : (
                                <TouchableOpacity onPress={() => handleKickDevice(session.id)}>
                                  <Ionicons name="log-out-outline" size={18} color="#ef4444" />
                                </TouchableOpacity>
                              )}
                            </View>
                          ))}
                        </View>
                        </View>
                      </View>
                    ) : selectedSecurityItem === 'Password Recovery' ? (
                      <View style={styles.settingsContentSection}>
                        <Text style={styles.settingsText}>Select a registered method to recover your password access.</Text>

                        <View style={{ width: '100%', marginBottom: 20, marginTop: 10 }}>
                          <View style={{ position: 'absolute', top: 15, left: 15, right: 15, bottom: 15, backgroundColor: '#ffffff', borderRadius: 32, opacity: 0.15, shadowColor: '#ffffff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 25 }} />
                          <View style={[styles.settingsList, { backgroundColor: 'rgba(30, 30, 45, 0.98)', borderRadius: 32, borderWidth: 1.5, borderColor: 'rgba(255, 255, 255, 0.15)', shadowColor: '#000000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 12, overflow: 'hidden', paddingVertical: 10 }]}>
                          {[
                            { id: 'google', label: 'Registered Google', icon: 'logo-google', color: '#ea4335', detail: linkedAccounts.google ? 'Account Linked - Ready for Recovery' : 'Recovery via linked Google Account' },
                            { id: 'phone', label: 'Phone Numbers', icon: 'phone-portrait-outline', color: '#34d399', detail: 'Recovery via SMS verification' },
                            { id: 'facebook', label: 'Facebook', icon: 'logo-facebook', color: '#1877f2', detail: linkedAccounts.facebook ? 'Account Linked - Ready for Recovery' : 'Recovery via Facebook Auth' },
                            { id: 'apple', label: 'Apple ID', icon: 'logo-apple', color: '#fff', detail: linkedAccounts.apple ? 'Account Linked - Ready for Recovery' : 'Recovery via Apple Secure Link' },
                            { id: 'security', label: 'Security Questions', icon: 'help-buoy-outline', color: '#818cf8', detail: isQuestionSaved ? 'Questions Set - Ready for Recovery' : 'Recovery via personal questions' },
                          ].map((method) => (
                            <TouchableOpacity
                              key={method.label}
                              style={styles.settingsRow}
                              onPress={() => {
                                if (method.label === 'Security Questions') {
                                  setSavedScrollPosition(currentScrollY);
                                  setSelectedSecurityItem('Security Questions');
                                } else {
                                  alert(`Password recovery link sent to your registered ${method.label}`);
                                }
                              }}
                            >
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                                <View style={[styles.menuIcon, { backgroundColor: method.color + '18', width: 32, height: 32 }]}>
                                  <Ionicons name={method.icon as any} size={16} color={method.color} />
                                </View>
                                <View>
                                  <Text style={styles.settingsRowText}>{method.label}</Text>
                                  <Text style={{ color: '#64748b', fontSize: 11 }}>{method.detail}</Text>
                                </View>
                              </View>
                              <Ionicons name="chevron-forward" size={14} color="#475569" />
                            </TouchableOpacity>
                          ))}

                          <View style={{ marginTop: 20, paddingHorizontal: 4 }}>
                            <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '900', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 }}>Linked Social Login</Text>
                            <View style={{ gap: 8 }}>
                              {[
                                { id: 'google', label: 'Google', icon: 'logo-google', color: '#ea4335' },
                                { id: 'facebook', label: 'Facebook', icon: 'logo-facebook', color: '#1877f2' },
                                { id: 'apple', label: 'Apple ID', icon: 'logo-apple', color: '#fff' },
                              ].map((social) => (
                                <TouchableOpacity 
                                  key={social.label} 
                                  style={styles.socialLinkBtn}
                                  onPress={() => handleLinkAccount(social.id as any)}
                                  disabled={linkingProvider !== null}
                                >
                                  {linkingProvider === social.id ? (
                                    <ActivityIndicator size="small" color="#818cf8" style={{ marginRight: 10 }} />
                                  ) : (
                                    <Ionicons name={social.icon as any} size={18} color={social.color} />
                                  )}
                                  <Text style={[styles.socialLinkText, linkedAccounts[social.id as keyof typeof linkedAccounts] && { color: '#f1f5f9' }]}>
                                    {linkingProvider === social.id ? 'Connecting...' : linkedAccounts[social.id as keyof typeof linkedAccounts] ? `Unlink ${social.label}` : `Link with ${social.label}`}
                                  </Text>
                                  <Text style={[styles.linkStatus, { color: linkedAccounts[social.id as keyof typeof linkedAccounts] ? '#10b981' : '#475569' }]}>
                                    {linkedAccounts[social.id as keyof typeof linkedAccounts] ? 'LINKED' : 'NOT LINKED'}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </View>
                          </View>
                        </View>
                      </View>
                    ) : selectedSecurityItem === 'Security Questions' ? (
                      <View style={{ width: '100%', marginBottom: 20 }}>
                        <View style={{ position: 'absolute', top: 15, left: 15, right: 15, bottom: 15, backgroundColor: '#ffffff', borderRadius: 24, opacity: 0.15, shadowColor: '#ffffff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 25 }} />
                        <View style={[styles.securityCard, { backgroundColor: 'rgba(30, 30, 45, 0.98)', borderWidth: 1.5, borderColor: 'rgba(255, 255, 255, 0.15)', shadowColor: '#000000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 12 }]}>
                          {securitySaveSuccess && (
                            <View style={styles.successBanner}>
                              <Ionicons name="checkmark-circle" size={20} color="#34d399" />
                              <Text style={styles.successText}>Security question saved successfully!</Text>
                            </View>
                          )}
                          <Text style={styles.securityTitle}>Security Questions</Text>
                          <Text style={styles.securityDesc}>Set a security question to help recover your account if you forget your password.</Text>

                          {isQuestionSaved && !securitySaveSuccess ? (
                            <View style={styles.detailCard}>
                              <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Current Question</Text>
                                <Text style={[styles.detailValue, { color: '#f1f5f9', fontSize: 13, fontWeight: '700' }]}>{userSecurityQuestion}</Text>
                              </View>
                              <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Answer</Text>
                                <Text style={[styles.detailValue, { color: '#64748b', fontSize: 13 }]}>••••••••</Text>
                              </View>
                              <TouchableOpacity 
                                style={[styles.requestCodeBtn, { marginTop: 24, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }]} 
                                onPress={() => setIsQuestionSaved(false)}
                              >
                                <Text style={[styles.requestCodeText, { color: '#94a3b8' }]}>Change Security Question</Text>
                              </TouchableOpacity>
                            </View>
                          ) : (
                            <View style={styles.detailCard}>
                              <Text style={[styles.detailLabel, { marginBottom: 12 }]}>Choose a question:</Text>
                              <View style={{ gap: 10, marginBottom: 24 }}>
                                {SECURITY_QUESTIONS.map((q) => (
                                  <TouchableOpacity
                                    key={q}
                                    style={{
                                      padding: 14,
                                      borderRadius: 16,
                                      backgroundColor: userSecurityQuestion === q ? 'rgba(129,140,248,0.15)' : 'rgba(255,255,255,0.03)',
                                      borderWidth: 1,
                                      borderColor: userSecurityQuestion === q ? '#818cf8' : 'rgba(255,255,255,0.05)',
                                    }}
                                    onPress={() => setUserSecurityQuestion(q)}
                                  >
                                    <Text style={{ color: userSecurityQuestion === q ? '#818cf8' : '#94a3b8', fontSize: 13, fontWeight: '600' }}>{q}</Text>
                                  </TouchableOpacity>
                                ))}
                              </View>

                              <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Your Answer</Text>
                                <TextInput
                                  style={styles.editInput}
                                  value={userSecurityAnswer}
                                  onChangeText={setUserSecurityAnswer}
                                  placeholder="Type your answer here..."
                                  placeholderTextColor="#64748b"
                                />
                              </View>
                              {securityError ? <Text style={styles.errorText}>{securityError}</Text> : null}

                              <TouchableOpacity style={[styles.requestCodeBtn, { marginTop: 24 }]} onPress={handleSaveSecurityQuestion}>
                                <Text style={styles.requestCodeText}>Save Security Question</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      </View>
                    ) : null}

                  </View>
                )}

                {selectedItem?.id === '1' && selectedSubItem === 'Delete Account' && (
                  <View style={styles.settingsContentSection}>


                    <View style={styles.deletionWarningBox}>
                      <Ionicons name="warning" size={32} color="#f59e0b" style={{ marginBottom: 12 }} />
                      <Text style={styles.deletionTitle}>Important: Account Deletion</Text>
                      <Text style={styles.deletionDesc}>
                        Permanently delete your account and all associated data. This action cannot be undone. You will lose access to:
                      </Text>
                      <View style={styles.consequenceList}>
                        {[
                          'Permanently remove account',
                          'Delete all personal data'
                        ].map((c, i) => (
                          <View key={i} style={styles.consequenceItem}>
                            <Ionicons name="close-circle" size={14} color="#ef4444" />
                            <Text style={styles.consequenceText}>{c}</Text>
                          </View>
                        ))}
                      </View>
                    </View>

                    <TouchableOpacity
                      style={styles.confirmToggle}
                      activeOpacity={0.8}
                      onPress={() => setConfirmDelete(!confirmDelete)}
                    >
                      <View style={[styles.checkbox, confirmDelete && styles.checkboxActive]}>
                        {confirmDelete && <Ionicons name="checkmark" size={12} color="#fff" />}
                      </View>
                      <Text style={styles.confirmText}>I understand the consequences and wish to proceed</Text>
                    </TouchableOpacity>

                    {confirmDelete && (
                      <View style={styles.emailConfirmSection}>
                        <Text style={styles.emailConfirmLabel}>
                          To proceed, enter your registered email address:
                        </Text>
                        <TextInput
                          style={[
                            styles.editInput,
                            (deletionEmail.length > 0 && !userEmail.toLowerCase().startsWith(deletionEmail.toLowerCase())) && { borderColor: '#ef4444' },
                            (deletionEmail.length > 0 && deletionEmail.toLowerCase() === userEmail.toLowerCase()) && { borderColor: '#34d399' }
                          ]}
                          value={deletionEmail}
                          onChangeText={(txt) => {
                            setDeletionEmail(txt);
                            if (sentCode) setSentCode('');
                          }}
                          placeholder="your@email.com"
                          placeholderTextColor="rgba(255,255,255,0.2)"
                          autoCapitalize="none"
                          keyboardType="email-address"
                          editable={!sendingCode && !sentCode}
                        />
                        {deletionEmail.length > 0 && !userEmail.toLowerCase().startsWith(deletionEmail.toLowerCase()) && (
                          <Text style={styles.errorText}>Wrong email address</Text>
                        )}
                        {deletionEmail.length > 50 && (
                          <Text style={styles.errorText}>Email address is too long</Text>
                        )}

                        {deletionEmail.toLowerCase() === userEmail.toLowerCase() && !sentCode && (
                          <TouchableOpacity
                            style={[styles.requestCodeBtn, sendingCode && { opacity: 0.7 }]}
                            onPress={handleSendDeletionCode}
                            disabled={sendingCode}
                          >
                            <Ionicons name={sendingCode ? "sync" : "mail-unread"} size={18} color="#fff" />
                            <Text style={styles.requestCodeText}>
                              {sendingCode ? "Sending Code..." : "Send Verification Code"}
                            </Text>
                          </TouchableOpacity>
                        )}

                        {sentCode !== '' && (
                          <View style={{ marginTop: 20 }}>
                            <Text style={styles.emailConfirmLabel}>
                              Enter the 6-digit code sent to your email:
                            </Text>
                            <TextInput
                              style={[
                                styles.editInput,
                                { textAlign: 'center', fontSize: 24, letterSpacing: 8, color: '#818cf8' },
                                inputCode.length === 6 && {
                                  borderColor: inputCode === sentCode ? '#34d399' : '#ef4444'
                                }
                              ]}
                              value={inputCode}
                              onChangeText={setInputCode}
                              placeholder="000000"
                              placeholderTextColor="rgba(255,255,255,0.1)"
                              keyboardType="number-pad"
                              maxLength={6}
                            />
                            {inputCode.length === 6 && inputCode !== sentCode && (
                              <Text style={styles.errorText}>Invalid verification code</Text>
                            )}
                          </View>
                        )}
                      </View>
                    )}

                    <TouchableOpacity
                      style={[styles.finalDeleteBtn, !isDeleteButtonEnabled && styles.deleteBtnDisabled]}
                      disabled={!isDeleteButtonEnabled}
                    >
                      <Text style={styles.finalDeleteText}>Permanently Delete My Account</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {selectedItem?.id === '2' && ( // Subscription
                  <View style={styles.settingsContentSection}>
                    {showBillingHistory ? (
                      <View style={{ flex: 1 }}>


                        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900', marginBottom: 20 }}>Billing History</Text>

                        {billingHistory.length === 0 ? (
                          <View style={{ alignItems: 'center', marginTop: 60 }}>
                            <Ionicons name="receipt-outline" size={48} color="rgba(255,255,255,0.05)" />
                            <Text style={{ color: '#475569', fontSize: 14, marginTop: 12 }}>No transactions yet</Text>
                          </View>
                        ) : (
                          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
                            {billingHistory.map((item) => (
                              <View key={item.id} style={[styles.historyCard, { borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1 }]}>
                                <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                                <View style={{ padding: 20 }}>
                                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>{item.plan} Plan</Text>
                                    <Text style={{ color: '#f59e0b', fontSize: 16, fontWeight: '900' }}>{item.amount}</Text>
                                  </View>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                    <Ionicons name="calendar-outline" size={12} color="#94a3b8" />
                                    <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '600' }}>{item.date}</Text>
                                  </View>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Ionicons name={item.method?.includes('Card') ? "card-outline" : "phone-portrait-outline"} size={12} color="#cbd5e1" />
                                    <Text style={{ color: '#cbd5e1', fontSize: 12, fontWeight: '500' }}>{item.method}</Text>
                                  </View>
                                  <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, position: 'absolute', bottom: 8, right: 12, fontWeight: '800' }}>{item.id}</Text>
                                </View>
                              </View>
                            ))}
                          </ScrollView>
                        )}
                      </View>
                    ) : (
                      <>
                        <Text style={styles.settingsText}>Manage your premium subscription, billing history, and payment methods.</Text>

                        {!isSubscribed ? (
                          <View style={{ alignItems: 'center', paddingVertical: 40, gap: 16 }}>
                            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.03)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
                              <Ionicons name="diamond-outline" size={40} color="#475569" />
                            </View>
                            <Text style={{ color: '#94a3b8', fontSize: 16, fontWeight: '700', textAlign: 'center' }}>No Active Subscription</Text>
                            <TouchableOpacity
                              style={{ backgroundColor: '#f59e0b', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
                              onPress={() => toggleSettingsModal(MENU_ITEMS.find(m => m.id === '3') || null)}
                            >
                              <Text style={{ color: '#fff', fontWeight: '900' }}>CHOOSE A PLAN</Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <>
                            <View style={styles.coverageBlur}>
                              <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                              <View style={styles.coverageContent}>
                                <View>
                                  <Text style={styles.coverageLabel}>Total Premium Coverage</Text>
                                  <Text style={styles.coverageValue}>{remainingDays + (upcomingMembership?.days || 0)} Days</Text>
                                </View>
                                <Ionicons name="shield-checkmark" size={28} color="#10b981" />
                              </View>
                            </View>

                            <View style={styles.glassSubscriptionCard}>
                              <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                              <View style={{ padding: 24 }}>
                                <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '900', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 16 }}>Active Membership</Text>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                  <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Plan</Text>
                                    <View>
                                      <Text style={[styles.detailValue, { color: '#f59e0b', fontSize: 18, fontWeight: '800' }]}>{subscriptionBundle}</Text>
                                      {subscriptionBonus ? (
                                        <Text style={{ color: '#f59e0b', fontSize: 11, fontWeight: '700', marginTop: 2 }}>{subscriptionBonus}</Text>
                                      ) : null}
                                    </View>
                                  </View>
                                  <View style={[styles.profileBadge, { marginTop: 0, backgroundColor: 'rgba(245, 158, 11, 0.15)', borderWidth: 0 }]}>
                                    <Ionicons name="flash" size={12} color="#f59e0b" />
                                    <Text style={[styles.profileBadgeText, { color: '#f59e0b' }]}>ACTIVE</Text>
                                  </View>
                                </View>

                                <View style={styles.cardDivider} />

                                <View style={styles.detailRow}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                    <Ionicons name="folder-outline" size={14} color="#818cf8" />
                                    <Text style={styles.detailLabel}>External Downloads (Daily limit)</Text>
                                  </View>
                                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                                    <Text style={[styles.detailValue, { color: getRemainingDownloads() > 0 ? '#10b981' : '#f43f5e', fontSize: 24, fontWeight: '800' }]}>
                                      {downloadsUsedToday} / {getExternalDownloadLimit()}
                                    </Text>
                                    <Text style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>
                                      {getRemainingDownloads() > 0 ? `${getRemainingDownloads()} Remaining` : 'Limit Reached'}
                                    </Text>
                                  </View>
                                </View>

                                <View style={styles.cardDivider} />

                                <View style={styles.detailRow}>
                                  <Text style={styles.detailLabel}>Plan Duration</Text>
                                  <Text style={[styles.detailValue, { fontSize: 16 }]}>Ends on {renewalDate}</Text>
                                </View>

                                <View style={styles.cardDivider} />

                                <View style={styles.detailRow}>
                                  <Text style={styles.detailLabel}>Payment Details</Text>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                                    <Ionicons name={paymentMethod.includes('Card') ? "card-outline" : "phone-portrait-outline"} size={16} color="rgba(255,255,255,0.4)" />
                                    <Text style={[styles.detailValue, { fontSize: 16 }]}>{paymentMethod}</Text>
                                  </View>
                                </View>

                                <View style={styles.cardDivider} />

                                {/* Active Devices Management */}
                                <View style={{ marginTop: 12 }}>
                                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                    <Text style={styles.detailLabel}>Active Devices ({activeDevices.length}/{getDeviceLimit()})</Text>
                                    <TouchableOpacity onPress={simulateNewDeviceLogin}>
                                      <Text style={{ color: '#818cf8', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }}>Simulate Login</Text>
                                    </TouchableOpacity>
                                  </View>
                                  <View style={{ gap: 8 }}>
                                    {activeDevices.map((device) => (
                                      <View key={device.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                          <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: device.current ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' }}>
                                            <Ionicons name={device.device.includes('iPhone') || device.device.includes('Phone') ? "phone-portrait-outline" : "desktop-outline"} size={14} color={device.current ? '#10b981' : 'rgba(255,255,255,0.4)'} />
                                          </View>
                                          <View>
                                            <Text style={{ color: '#f1f5f9', fontSize: 12, fontWeight: '700' }}>{device.device}</Text>
                                            <Text style={{ color: '#64748b', fontSize: 10 }}>{device.location} • {device.time}</Text>
                                          </View>
                                        </View>
                                        {!device.current && (
                                          <TouchableOpacity onPress={() => handleKickDevice(device.id)} style={{ padding: 4 }}>
                                            <Ionicons name="log-out-outline" size={16} color="#ef4444" />
                                          </TouchableOpacity>
                                        )}
                                      </View>
                                    ))}
                                  </View>
                                </View>

                                {upcomingMembership && (
                                  <>
                                    <View style={[styles.cardDivider, { marginVertical: 24, backgroundColor: 'rgba(255,255,255,0.06)' }]} />
                                    <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '900', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 16 }}>Upcoming Membership</Text>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                      <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>Next Plan</Text>
                                        <View>
                                          <Text style={[styles.detailValue, { color: '#818cf8', fontSize: 18, fontWeight: '800' }]}>{upcomingMembership.bundle}</Text>
                                          {upcomingMembership.bonus ? (
                                            <Text style={{ color: '#818cf8', fontSize: 11, fontWeight: '700', marginTop: 2 }}>{upcomingMembership.bonus}</Text>
                                          ) : null}
                                        </View>
                                      </View>
                                      <View style={[styles.profileBadge, { marginTop: 0, backgroundColor: 'rgba(129, 140, 248, 0.15)', borderColor: '#818cf8', borderWidth: 0 }]}>
                                        <Ionicons name="time" size={12} color="#818cf8" />
                                        <Text style={[styles.profileBadgeText, { color: '#818cf8' }]}>QUEUED</Text>
                                      </View>
                                    </View>
                                  </>
                                )}

                                  {/* Plan Benefits Summary */}
                                  <View style={{ marginTop: 24, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.05)', paddingTop: 20 }}>
                                    <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 16 }}>Your Benefits</Text>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                                      {(upcomingMembership ? upcomingMembership.specs : subscriptionSpecs).map((spec: string, idx: number) => {
                                        let bColor = '#6366f1'; // Default Indigo
                                        let bIcon = 'checkmark-circle';
                                        
                                        const s = spec.toLowerCase();
                                        if (s.includes('quality') || s.includes('2k') || s.includes('fhd')) { bColor = '#0ea5e9'; bIcon = 'videocam'; }
                                        else if (s.includes('movies') || s.includes('content') || s.includes('unlimited')) { bColor = '#8b5cf6'; bIcon = 'play-circle'; }
                                        else if (s.includes('ad-free')) { bColor = '#ec4899'; bIcon = 'shield-checkmark'; }
                                        else if (s.includes('download')) { bColor = '#f59e0b'; bIcon = 'cloud-download'; }
                                        else if (s.includes('device')) { bColor = '#10b981'; bIcon = 'phone-portrait'; }
                                        else if (s.includes('access')) { bColor = '#06b6d4'; bIcon = 'layers'; }

                                        return (
                                          <View 
                                            key={idx} 
                                            style={[
                                              styles.benefitTag, 
                                              { 
                                                backgroundColor: bColor + '15', 
                                                borderColor: bColor + '30',
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                gap: 6,
                                                paddingVertical: 6,
                                                paddingHorizontal: 12,
                                                borderRadius: 12
                                              }
                                            ]}
                                          >
                                            <Ionicons name={bIcon as any} size={14} color={bColor} />
                                            <Text style={[styles.benefitTagText, { color: bColor, fontSize: 11, fontWeight: '700' }]}>{spec}</Text>
                                          </View>
                                        );
                                      })}
                                    </View>
                                  </View>
                            </View>

                              <View style={[styles.settingsList, { backgroundColor: 'rgba(255,255,255,0.02)', padding: 8, borderRadius: 20, marginTop: 12 }]}>
                                {[
                                  { label: 'Billing History', icon: 'receipt-outline', color: '#818cf8', action: () => { setSavedScrollPosition(currentScrollY); setShowBillingHistory(true); } },
                                  { label: 'Upgrade Plan', icon: 'options-outline', color: '#f59e0b', action: () => { setSavedScrollPosition(currentScrollY); setCameFromSubscription(true); setSelectedItem(MENU_ITEMS.find(m => m.id === '3') || null); } },
                                  { label: 'Update Payment Method', icon: 'card-outline', color: '#10b981', action: () => { setSavedScrollPosition(currentScrollY); handleShowPaymentModal(true); toggleSettingsModal(null); } }
                                ].map((item, index, l) => (
                                  <TouchableOpacity
                                    key={item.label}
                                    style={[
                                      styles.settingsRow, 
                                      index === l.length - 1 && { borderBottomWidth: 0 },
                                      { height: 56, paddingHorizontal: 16 }
                                    ]}
                                    onPress={item.action}
                                  >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                                      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: item.color + '15', alignItems: 'center', justifyContent: 'center' }}>
                                        <Ionicons name={item.icon as any} size={20} color={item.color} />
                                      </View>
                                      <Text style={[styles.settingsRowText, { color: '#f1f5f9', fontWeight: '700' }]}>{item.label}</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
                                  </TouchableOpacity>
                                ))}
                              </View>
                            </View>
                          </>
                        )}
                      </>
                    )}
                  </View>
                )}
                {selectedItem?.id === '3' && ( // Choose Your Plan
                  <View style={styles.settingsContentSection}>
                    <Text style={styles.settingsText}>Select the best plan for you and your family to enjoy unlimited movies.</Text>
                    <View
                      style={{ paddingHorizontal: 20, paddingBottom: 40 }}
                    >
                      {[
                        {
                          name: '1 week [+1 day bonus]',
                          price: '2,500',
                          currency: 'Ugx',
                          tag: null,
                          color: '#6366f1',
                          glowColor: 'rgba(99, 102, 241, 0.4)',
                          ctaSuffix: 'AS LOW AS 357 Ugx A DAY',
                          specs: ['FHD / 2k Quality', 'Unlimited movies and series', 'Ad-free experience', 'Access to all content', 'Unlimited in-app download', '3 external downloads', '1 device']
                        },
                        {
                          name: '2 week [+2 days bonus]',
                          price: '5,000',
                          currency: 'Ugx',
                          tag: 'MOST POPULAR',
                          color: '#8338ec',
                          glowColor: 'rgba(131, 56, 236, 0.5)',
                          ctaSuffix: 'AS LOW AS 357 Ugx A DAY',
                          specs: ['FHD / 2k Quality', 'Unlimited movies and series', 'Ad-free experience', 'Access to all content', 'Unlimited in-app download', '5 external downloads', '1 device']
                        },
                        {
                          name: '1 Month [+4 day bonus]',
                          price: '10,000',
                          currency: 'Ugx',
                          tag: 'BEST VALUE',
                          color: '#ff006e',
                          glowColor: 'rgba(255, 0, 110, 0.5)',
                          ctaSuffix: 'AS LOW AS 333 Ugx A DAY',
                          specs: ['FHD / 2k Quality', 'Unlimited movies and series', 'Ad-free', 'Access all content', 'Unlimited in-app download', '10 external downloads', '2 devices']
                        },
                        {
                          name: '2 months [+1 week bonus]',
                          price: '20,000',
                          currency: 'Ugx',
                          tag: 'EXCLUSIVE',
                          color: '#fb5607',
                          glowColor: 'rgba(251, 86, 7, 0.5)',
                          ctaSuffix: 'AS LOW AS 333 A DAY',
                          specs: ['FHD / 2k Quality', 'Unlimited movies and series', 'Ad-free', 'Access all content', 'Unlimited in-app download', '20 external downloads', '3 devices']
                        }
                      ].map((p, index) => {
                        const planLabel = p.name.split(' [')[0];
                        const isActivePlan = isSubscribed && subscriptionBundle === planLabel;
                        const isQueuedPlan = upcomingMembership && upcomingMembership.bundle === planLabel;

                        return (
                          <View key={p.name} style={{ width: '100%', marginBottom: 20 }}>
                            {/* Premium Background Glow */}
                            <View style={{
                              position: 'absolute',
                              top: 20,
                              left: 20,
                              right: 20,
                              bottom: 20,
                              backgroundColor: isActivePlan ? p.color : isQueuedPlan ? '#818cf8' : p.glowColor,
                              borderRadius: 100,
                              opacity: (isActivePlan || isQueuedPlan) ? 0.18 : 0.4,
                              zIndex: 0,
                              shadowColor: isQueuedPlan ? '#818cf8' : p.color,
                              shadowOffset: { width: 0, height: 0 },
                              shadowOpacity: 1,
                              shadowRadius: (isActivePlan || isQueuedPlan) ? 40 : 30,
                            }} />

                            <View
                              style={[
                                {
                                  flexDirection: 'column',
                                  alignItems: 'center', // Centered focus
                                  padding: 24,
                                  paddingTop: 48,
                                  gap: 24,
                                  backgroundColor: isActivePlan ? 'rgba(30, 30, 48, 0.98)' : isQueuedPlan ? 'rgba(30, 32, 55, 0.98)' : 'rgba(30, 30, 45, 0.95)',
                                  borderRadius: 32,
                                  borderWidth: (isActivePlan || isQueuedPlan) ? 1.5 : 1,
                                  borderColor: isActivePlan ? p.color : isQueuedPlan ? '#818cf8' : 'rgba(255, 255, 255, 0.1)',
                                  shadowColor: isActivePlan ? p.color : isQueuedPlan ? '#818cf8' : '#000',
                                  shadowOffset: { width: 0, height: 10 },
                                  shadowOpacity: (isActivePlan || isQueuedPlan) ? 0.4 : 0.3,
                                  shadowRadius: (isActivePlan || isQueuedPlan) ? 30 : 20,
                                  elevation: 12,
                                  overflow: 'hidden'
                                }
                              ]}
                            >
                              {/* Background Watermark Price */}
                              <View style={{ position: 'absolute', top: -20, left: -20, opacity: 0.03 }}>
                                <Text style={{ fontSize: 180, fontWeight: '900', color: p.color }}>
                                  {p.price.replace(',', '')}
                                </Text>
                              </View>

                              {/* Floating Bonus Pill (Top Right) */}
                              {p.name.includes('[') && (
                                <View style={{ 
                                  position: 'absolute', 
                                  top: 20, 
                                  right: 20, 
                                  backgroundColor: p.color, 
                                  paddingHorizontal: 10, 
                                  paddingVertical: 5, 
                                  borderRadius: 20,
                                  shadowColor: p.color,
                                  shadowOffset: { width: 0, height: 4 },
                                  shadowOpacity: 0.5,
                                  shadowRadius: 8,
                                  zIndex: 10
                                }}>
                                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' }}>
                                    {p.name.split('[')[1].replace(' bonus]', '').trim()} EXTRA
                                  </Text>
                                </View>
                              )}

                              {/* Centered Title & Price Stack */}
                              <View style={{ alignItems: 'center', width: '100%', marginBottom: 10 }}>
                                <Text style={{ color: p.color, fontSize: 14, fontWeight: '800', letterSpacing: 4, textTransform: 'uppercase', marginBottom: 8 }}>{p.name.split(' [')[0]}</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                                  <Text style={{ color: '#fff', fontSize: 52, fontWeight: '900', letterSpacing: -2 }}>{p.price}</Text>
                                  <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 18, fontWeight: '700' }}>{p.currency}</Text>
                                </View>
                                {isActivePlan && (
                                  <View style={{ marginTop: 12, backgroundColor: 'rgba(16, 185, 129, 0.15)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                                    <Text style={{ color: '#10b981', fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>CURRENT MEMBERSHIP</Text>
                                  </View>
                                )}
                              </View>

                              {/* Divider */}
                              <View style={{ width: '60%', height: 1, backgroundColor: 'rgba(255,255,255,0.05)' }} />

                              {/* Varied Benefit Icons */}
                              <View style={{ width: '100%', gap: 12 }}>
                                {p.specs.map((spec, sIdx) => {
                                  let iconName = "checkmark-circle";
                                  if (spec.toLowerCase().includes('quality')) iconName = "videocam";
                                  if (spec.toLowerCase().includes('movies')) iconName = "play-circle";
                                  if (spec.toLowerCase().includes('ad-free')) iconName = "shield-checkmark";
                                  if (spec.toLowerCase().includes('content')) iconName = "layers";
                                  if (spec.toLowerCase().includes('download')) iconName = "cloud-download";
                                  if (spec.toLowerCase().includes('device')) iconName = "phone-portrait";

                                  return (
                                    <View key={sIdx} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                      <View style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: 6, borderRadius: 8 }}>
                                        <Ionicons name={iconName as any} size={16} color={p.color} />
                                      </View>
                                      <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '500' }}>{spec}</Text>
                                    </View>
                                  );
                                })}
                              </View>

                              <View style={{ width: '100%', marginTop: 8 }}>
                                <TouchableOpacity
                                  style={{
                                    backgroundColor: isQueuedPlan ? 'rgba(255,255,255,0.03)' : p.color,
                                    paddingVertical: 16,
                                    borderRadius: 20,
                                    alignItems: 'center',
                                    borderWidth: isQueuedPlan ? 1.5 : 0,
                                    borderColor: isQueuedPlan ? 'rgba(255,255,255,0.1)' : 'transparent',
                                    shadowColor: isQueuedPlan ? 'transparent' : p.color,
                                    shadowOffset: { width: 0, height: 8 },
                                    shadowOpacity: 0.4,
                                    shadowRadius: 12,
                                    elevation: isQueuedPlan ? 0 : 8
                                  }}
                                  onPress={() => {
                                    if (!isQueuedPlan) {
                                      setSelectedPlanForPayment(p);
                                      handleShowPaymentModal(true);
                                    }
                                  }}
                                  disabled={isQueuedPlan}
                                >
                                  {isActivePlan ? (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                      <Ionicons name="flash" size={16} color="#fff" />
                                      <Text style={{ color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 1 }}>EXTEND ACCESS</Text>
                                    </View>
                                  ) : isQueuedPlan ? (
                                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 15, fontWeight: '900' }}>QUEUED</Text>
                                  ) : (
                                    <View style={{ alignItems: 'center' }}>
                                      <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 }}>GET STARTED</Text>
                                      {p.ctaSuffix && (
                                        <Text style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 10, fontWeight: '600', marginTop: 2 }}>{p.ctaSuffix}</Text>
                                      )}
                                    </View>
                                  )}
                                </TouchableOpacity>
                              </View>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}

                {selectedItem?.id === '4' && !selectedSubItem && ( // Preferences
                  <View style={styles.settingsContentSection}>
                    <Text style={styles.settingsText}>Customize the application's appearance and theme.</Text>
                    <View style={styles.settingsList}>
                      {[
                        { label: 'Theme (Dark/Light)', subtitle: 'Customize the appearance of your app', icon: 'color-palette-outline' },
                      ].map((item, index, l) => (
                        <TouchableOpacity 
                          key={item.label} 
                          style={[
                            styles.settingsRow, 
                            index === l.length - 1 && { borderBottomWidth: 0 }
                          ]} 
                          activeOpacity={0.7}
                          onPress={() => { setSavedScrollPosition(currentScrollY); setSelectedSubItem(item.label); }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                            <View style={[styles.menuIcon, { backgroundColor: '#38bdf8' + '15' }]}>
                              <Ionicons name={item.icon as any} size={20} color="#38bdf8" />
                            </View>
                            <View style={styles.menuTextWrap}>
                              <Text style={styles.settingsRowText}>{item.label}</Text>
                              <Text style={styles.menuSub}>{item.subtitle}</Text>
                            </View>
                          </View>
                          <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.2)" />
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
                {selectedItem?.id === '5' && ( // Downloads
                  <View style={styles.settingsContentSection}>
                    <Text style={styles.settingsText}>View and manage your offline content. Storage used: 4.2GB / 128GB.</Text>
                    <View style={{ marginTop: 24 }}>
                      {MOST_DOWNLOADED.map((m) => (
                        <View key={m.id} style={styles.downloadCard}>
                          <View style={styles.downloadPosterContainer}>
                            <Image source={{ uri: m.poster }} style={styles.downloadPoster} />
                            <View style={styles.vjBadgeSmall}>
                              <Text style={styles.vjBadgeTextSmall}>{m.vj}</Text>
                            </View>
                          </View>
                          <View style={styles.downloadInfo}>
                            <Text style={styles.downloadTitle} numberOfLines={1}>{m.title}</Text>
                            <Text style={styles.downloadMeta}>{m.year} • {m.duration}</Text>
                            <View style={styles.downloadActionRow}>
                              <TouchableOpacity 
                                style={styles.downloadPlayBtn}
                                onPress={() => {
                                  // Simulate playing
                                  Alert.alert('Play Download', `Now playing ${m.title} offline.`);
                                }}
                              >
                                <Ionicons name="play" size={12} color="#fff" />
                                <Text style={styles.downloadPlayText}>PLAY</Text>
                              </TouchableOpacity>
                              <TouchableOpacity 
                                style={styles.downloadDeleteBtn}
                                onPress={() => {
                                  // Simulate deletion
                                  Alert.alert('Delete Download', `Are you sure you want to delete ${m.title}?`, [
                                    { text: 'Cancel', style: 'cancel' },
                                    { text: 'Delete', style: 'destructive' }
                                  ]);
                                }}
                              >
                                <Ionicons name="trash-outline" size={16} color="#ef4444" />
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
                {selectedItem?.id === '6' && ( // Notifications
                  <View style={styles.settingsContentSection}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Text style={styles.settingsText}>Stay updated with your latest alerts and personalize your notifications.</Text>
                      {notifications.length > 0 && (
                        <TouchableOpacity onPress={handleClearNotifications}>
                          <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '700' }}>Clear All</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Alerts List */}
                    <View style={{ gap: 12, marginBottom: 24 }}>
                      {notifications.length > 0 ? (
                        notifications.map((n) => (
                          <TouchableOpacity 
                            key={n.id} 
                            style={styles.notificationCard}
                            onPress={() => handleNotificationPress(n)}
                            activeOpacity={0.7}
                          >
                            <View style={[styles.notificationIcon, { backgroundColor: `${n.color}15` }]}>
                              <Ionicons name={n.icon as any} size={20} color={n.color} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                <Text style={styles.notifTitle}>{n.title}</Text>
                                <Text style={styles.notifTime}>{n.time}</Text>
                              </View>
                              <Text style={styles.notifMessage} numberOfLines={2}>{n.message}</Text>
                            </View>
                            {n.unread && <View style={styles.unreadDot} />}
                          </TouchableOpacity>
                        ))
                      ) : (
                        <View style={{ padding: 40, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 20 }}>
                          <Ionicons name="notifications-off-outline" size={48} color="rgba(255,255,255,0.1)" />
                          <Text style={{ color: 'rgba(255,255,255,0.3)', marginTop: 12, fontSize: 14 }}>No new notifications</Text>
                        </View>
                      )}
                    </View>

                    {/* Notification Settings */}
                    <Text style={[styles.aboutLabel, { paddingHorizontal: 0, marginBottom: 12 }]}>Notification Preferences</Text>
                    <View style={styles.settingsList}>
                      {[
                        { key: 'newReleases', label: 'New Releases', icon: 'film-outline' },
                        { key: 'myListUpdates', label: 'My List Updates', icon: 'bookmark-outline' },
                        { key: 'recommendations', label: 'Recommendations', icon: 'sparkles-outline' },
                        { key: 'billingAccount', label: 'Billing & Account', icon: 'card-outline' },
                      ].map((item, idx, arr) => (
                        <View key={item.key} style={[styles.settingsRow, idx === arr.length - 1 && { borderBottomWidth: 0 }]}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <Ionicons name={item.icon as any} size={20} color="rgba(255,255,255,0.4)" />
                            <Text style={styles.settingsRowText}>{item.label}</Text>
                          </View>
                          <TouchableOpacity 
                            onPress={() => toggleNotifSetting(item.key as any)}
                            activeOpacity={0.7}
                            style={{ 
                              width: 44, 
                              height: 24, 
                              borderRadius: 12, 
                              backgroundColor: notifSettings[item.key as keyof typeof notifSettings] ? '#10b981' : 'rgba(255,255,255,0.1)',
                              padding: 2,
                              justifyContent: 'center'
                            }}
                          >
                            <View style={{ 
                              width: 20, 
                              height: 20, 
                              borderRadius: 10, 
                              backgroundColor: '#fff',
                              transform: [{ translateX: notifSettings[item.key as keyof typeof notifSettings] ? 20 : 0 }]
                            }} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {selectedItem?.id === '7' && ( // My List
                  <View style={styles.settingsContentSection}>
                    <Text style={styles.settingsText}>Your personally curated collection of movies and series.</Text>
                    <View style={styles.watchlistGrid}>
                      {FAVOURITES.map((m) => (
                        <TouchableOpacity key={m.id} style={styles.gridCard} activeOpacity={0.8}>
                          <View>
                            <Image source={{ uri: m.poster }} style={styles.gridPoster} />
                            <View style={styles.vjBadgeSmall}>
                              <Text style={styles.vjBadgeTextSmall}>{m.vj}</Text>
                            </View>
                            <View style={styles.genreBadgeSmall}>
                              <Text style={styles.genreBadgeTextSmall}>
                                {("seasons" in m) ? ((m as unknown as Series).isMiniSeries ? "Mini Series" : "Series") : shortenGenre(m.genre)}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.gridInfo}>
                            <Text style={styles.gridTitle} numberOfLines={1}>{m.title}</Text>
                            <Text style={styles.gridMeta} numberOfLines={1}>
                              {m.year} · {("seasons" in m) ? ((m as unknown as Series).isMiniSeries ? "Mini Series" : `Season ${m.seasons}`) : m.duration}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
                {selectedItem?.id === '8' && ( // Help & Support
                  <View style={styles.settingsContentSection}>
                    <Text style={styles.settingsText}>Get help with your account, billing, or technical issues.</Text>


                    {/* Help & Support Content Re-ordered: Feedback -> Contact -> FAQ */}
                    <View style={{ width: '100%', marginBottom: 20 }}>
                      <View style={{ position: 'absolute', top: 15, left: 15, right: 15, bottom: 15, backgroundColor: '#10b981', borderRadius: 28, opacity: 0.08, shadowColor: '#10b981', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 20 }} />
                      <View style={[styles.settingsList, { backgroundColor: 'rgba(30,30,45,0.98)', borderRadius: 28, borderWidth: 1.5, borderColor: 'rgba(16,185,129,0.18)', overflow: 'hidden', paddingVertical: 16, paddingHorizontal: 20 }]}>
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
                                borderWidth: 1,
                                borderColor: 'rgba(255,255,255,0.08)'
                              }}
                              placeholder="Type your feedback here..."
                              placeholderTextColor="rgba(255,255,255,0.3)"
                              multiline
                              value={feedback}
                              onChangeText={setFeedback}
                            />
                            <TouchableOpacity 
                              style={{
                                marginTop: 16,
                                backgroundColor: feedback.trim() ? '#10b981' : 'rgba(16,185,129,0.2)',
                                borderRadius: 12,
                                paddingVertical: 12,
                                alignItems: 'center',
                                flexDirection: 'row',
                                justifyContent: 'center',
                                gap: 8
                              }}
                              disabled={!feedback.trim() || isSendingFeedback}
                                onPress={() => {
                                  setIsSendingFeedback(true);
                                  setTimeout(() => {
                                    setIsSendingFeedback(false);
                                    setFeedbackSent(true);
                                    
                                    // Generate and open WhatsApp message URL
                                    let mediaNote = '';
                                    if (attachedMedia.length > 0) {
                                      mediaNote = `\n\n📎 I have attached ${attachedMedia.length} screenshot(s)/recording(s) for your review.`;
                                    }
                                    
                                    const encodedFeedback = encodeURIComponent(`APP FEEDBACK [${userName}]:\n\n${feedback}${mediaNote}`);
                                    const whatsappUrl = `https://wa.me/256786966792?text=${encodedFeedback}`;
                                    
                                    if (attachedMedia.length > 0) {
                                      Alert.alert(
                                        "Attach Media in WhatsApp",
                                        "WhatsApp doesn't allow auto-attaching files. Please manually select the files in WhatsApp after it opens.",
                                        [{ text: "OK", onPress: () => Linking.openURL(whatsappUrl) }]
                                      );
                                    } else {
                                      Linking.openURL(whatsappUrl);
                                    }
                                    
                                    setFeedback('');
                                    setAttachedMedia([]);
                                    setTimeout(() => setFeedbackSent(false), 3000);
                                  }, 1500);
                                }}
                            >
                              {isSendingFeedback ? (
                                <Ionicons name="sync" size={18} color="#fff" />
                              ) : (
                                <Ionicons name="send" size={16} color="#fff" />
                              )}
                              <Text style={{ color: '#fff', fontWeight: '700' }}>
                                {isSendingFeedback ? 'Sending...' : 'Submit Feedback'}
                              </Text>
                            </TouchableOpacity>
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

                    <View style={{ width: '100%', marginTop: 0, marginBottom: 20 }}>
                      {/* Section Header */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15, paddingHorizontal: 5 }}>
                        <View style={{ width: 4, height: 18, backgroundColor: '#818cf8', borderRadius: 2 }} />
                        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900', marginLeft: 10, letterSpacing: 1.2, textTransform: 'uppercase', opacity: 0.8 }}>
                          {showRatingPreview ? 'Rate Your Experience' : 'Connect With Us'}
                        </Text>
                      </View>

                      {showRatingPreview ? (
                        /* Local Rating Preview UI */
                        <View style={{ backgroundColor: 'rgba(30,30,45,0.7)', borderRadius: 28, borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)', padding: 24, alignItems: 'center', overflow: 'hidden' }}>
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
                                style={{ transform: [{ scale: star === localRating ? 1.15 : 1 }] }}
                              >
                                <Ionicons
                                  name={star <= localRating ? "star" : "star-outline"}
                                  size={36}
                                  color="#f59e0b"
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
                                  await Promise.all([
                                    AsyncStorage.setItem('localRating', localRating.toString()),
                                    AsyncStorage.setItem('isLocalRatingSubmitted', 'true')
                                  ]);
                                } catch (e) {
                                  console.error('Failed to save rating', e);
                                }
                                DeviceEventEmitter.emit("ratingDonePermanent");
                                setTimeout(() => {
                                  Linking.openURL("https://play.google.com/store/apps/details?id=com.themoviezone247").catch(() => {
                                    Linking.openURL("https://play.google.com/store/apps/details?id=com.themoviezone247");
                                  });
                                  // Don't close or reset, let them see the "Thank you" and "Say something" logic
                                }, 1200);
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
                                        Linking.openURL("https://play.google.com/store/apps/details?id=com.themoviezone247");
                                      }}
                                    >
                                      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Write Review</Text>
                                    </TouchableOpacity>
                                  </View>
                                </View>
                              )}
                            </View>
                          )}
                          
                          <TouchableOpacity 
                            style={{ marginTop: 24, padding: 8 }}
                            onPress={() => setShowRatingPreview(false)}
                          >
                            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: '600' }}>
                              {isLocalRatingSubmitted ? 'Close' : 'Maybe later'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        /* Tile Grid */
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' }}>
                          {/* Email Tile */}
                          <TouchableOpacity 
                            style={{ width: '48%', height: 110, backgroundColor: 'rgba(30,30,45,0.7)', borderRadius: 28, borderWidth: 1, borderColor: 'rgba(129,140,248,0.2)', padding: 16, justifyContent: 'space-between' }}
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
                            style={{ width: '48%', height: 110, backgroundColor: 'rgba(30,30,45,0.7)', borderRadius: 28, borderWidth: 1, borderColor: 'rgba(37,211,102,0.2)', padding: 16, justifyContent: 'space-between' }}
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
                            style={{ width: '48%', height: 110, backgroundColor: 'rgba(30,30,45,0.7)', borderRadius: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', padding: 16, justifyContent: 'space-between' }}
                            activeOpacity={0.7}
                            onPress={() => Linking.openURL('https://www.themoviezone24/7.app')}
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
                            style={{ width: '48%', height: 110, backgroundColor: 'rgba(30,30,45,0.7)', borderRadius: 28, borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)', padding: 16, justifyContent: 'space-between' }}
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
                      )}
                    </View>

                    <View style={{ width: '100%', marginBottom: 20 }}>
                      <View style={{ position: 'absolute', top: 15, left: 15, right: 15, bottom: 15, backgroundColor: '#818cf8', borderRadius: 28, opacity: 0.08, shadowColor: '#818cf8', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 20 }} />
                      <View style={[styles.settingsList, { backgroundColor: 'rgba(30,30,45,0.98)', borderRadius: 28, borderWidth: 1.5, borderColor: 'rgba(129,140,248,0.18)', overflow: 'hidden', paddingVertical: 8 }]}>
                        <TouchableOpacity 
                          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}
                          activeOpacity={0.7}
                          onPress={() => setIsFaqSectionCollapsed(!isFaqSectionCollapsed)}
                        >
                          <Text style={[styles.aboutLabel, { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 }]}>Frequently Asked Questions</Text>
                          <Ionicons name={isFaqSectionCollapsed ? 'chevron-down' : 'chevron-up'} size={20} color="rgba(255,255,255,0.4)" />
                        </TouchableOpacity>

                        {!isFaqSectionCollapsed && [
                          { q: 'How do I download movies for offline viewing?', a: 'Tap the download icon on any movie or series. Downloads are available for Premium subscribers. Find your downloads in the "My Downloads" section under your profile.' },
                          { q: 'Why is my video buffering or lagging?', a: 'Check your internet connection first. We recommend at least 5 Mbps for HD streaming.' },
                          { q: 'Can I watch on multiple devices?', a: 'Premium plans allow up to 3 simultaneous streams. Basic plans allow 1 device at a time. You can manage active sessions under Account → Password & Security → Login Activity.' },
                          { q: 'A movie or series is missing — how do I report it?', a: 'Contact us via WhatsApp or email below. Include the exact title and we will work to add it or check licensing availability.' },
                          { q: 'How do I change my VJ preference?', a: 'Each movie card shows the VJ name. Use the search filters (By VJ) to find content from your preferred VJ, or use the Category tab to browse by VJ.' },
                          { q: 'Is my payment information secure?', a: 'Yes. We do not store card details on our servers. All payments are processed through secure, encrypted payment gateways (MTN, Airtel, Card).' },
                          { q: 'How do I update my email or password?', a: 'Go to Profile → Account → Personal Info to update your email. For password changes go to Account → Password & Security → Change Password.' },
                        ].map((faq, i, arr) => {
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
                )}
                {selectedItem?.id === '9' && ( // About
                  <View style={styles.settingsContentSection}>
                    <Text style={styles.settingsText}>Information about the app and legal notices.</Text>
                  </View>
                )}
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
      </Modal>


      {/* ── Payment Method Selection Modal ── */}
      <Modal
        visible={showPaymentModal}
        transparent
        animationType="slide"
        onRequestClose={() => handleShowPaymentModal(false)}
        statusBarTranslucent={true}
      >
        <BlurView intensity={80} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.85)' }]}>
          <LinearGradient
            colors={['rgba(15,15,20,0.95)', 'rgba(20,20,28,0.95)', 'rgba(15,15,20,0.95)']}
            style={StyleSheet.absoluteFill}
          />
          <TouchableOpacity
            style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}
            activeOpacity={1}
            onPress={() => handleShowPaymentModal(false)}
          >
            <TouchableOpacity
              activeOpacity={1}
              style={{
                backgroundColor: '#1e1e2d',
                borderTopLeftRadius: 32,
                borderTopRightRadius: 32,
                marginTop: TOP,
                padding: 24,
                paddingTop: 16,
                paddingBottom: 40,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.1)'
              }}
            >
              <View style={{ width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <View>
                  <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>Manage Billing</Text>
                  <Text style={{ color: '#94a3b8', fontSize: 13 }}>Control your payments and renewals</Text>
                </View>
                <TouchableOpacity
                  style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' }}
                  onPress={() => handleShowPaymentModal(false)}
                >
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>

              <View style={{ height: 20 }} />

              {/* Saved Methods List */}
              {paymentMethods.length > 0 && (
                <View style={{ marginBottom: 24 }}>
                  <Text style={{ color: '#64748b', fontSize: 11, fontWeight: '900', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12, marginLeft: 4 }}>Saved Methods</Text>
                  <View style={{ gap: 12 }}>
                    {paymentMethods.map((pm) => (
                      <View 
                        key={pm.id} 
                        style={{ 
                          borderRadius: 20, 
                          padding: 16, 
                          borderWidth: 1, 
                          borderColor: pm.isDefault ? 'rgba(129, 140, 248, 0.3)' : 'rgba(255,255,255,0.05)',
                          backgroundColor: pm.isDefault ? 'rgba(129, 140, 248, 0.03)' : 'rgba(255,255,255,0.03)'
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                          <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: pm.color + '15', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                            <Ionicons name={pm.icon as any} size={22} color={pm.color} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{pm.label}</Text>
                              {pm.isDefault && (
                                <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: 'rgba(129, 140, 248, 0.2)' }}>
                                  <Text style={{ color: '#818cf8', fontSize: 9, fontWeight: '800' }}>DEFAULT</Text>
                                </View>
                              )}
                            </View>
                            <Text style={{ color: '#64748b', fontSize: 12 }}>Used for your {subscriptionBundle} plan</Text>
                          </View>
                        </View>
                        
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                          {!pm.isDefault && (
                            <TouchableOpacity 
                              onPress={() => {
                                setPaymentMethods(prev => prev.map(p => ({ ...p, isDefault: p.id === pm.id })));
                                setPaymentMethod(pm.label);
                              }}
                              style={{ flex: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}
                            >
                              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Set Default</Text>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity 
                            onPress={() => {
                              setPaymentMethods(prev => prev.filter(p => p.id !== pm.id));
                            }}
                            style={{ flex: 1, height: 36, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Text style={{ color: '#ef4444', fontSize: 13, fontWeight: '700' }}>Remove</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <Text style={{ color: '#64748b', fontSize: 11, fontWeight: '900', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12, marginLeft: 4 }}>Add New Method</Text>

              <View style={{ gap: 12 }}>
                {[
                  { id: 'mtn', label: 'MTN Mobile Money Uganda', icon: 'phone-portrait-outline', color: '#ffcc00' },
                  { id: 'airtel', label: 'Airtel Money Uganda', icon: 'phone-portrait-outline', color: '#e11900' },
                  { id: 'card', label: 'Credit card or Debit card', icon: 'card-outline', color: '#6366f1' }
                ].map((method) => (
                  <TouchableOpacity
                    key={method.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      padding: 16,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.08)'
                    }}
                    onPress={() => {
                      setSelectedPaymentMethod(method);
                      setShowPaymentDetailsModal(true);
                    }}
                  >
                    <View style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      backgroundColor: `${method.color}20`,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 16
                    }}>
                      <Ionicons name={method.icon as any} size={24} color={method.color} />
                    </View>
                    <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600', flex: 1 }}>{method.label}</Text>
                    <Ionicons name="add" size={20} color="rgba(255,255,255,0.3)" />
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={{
                  marginTop: 24,
                  padding: 16,
                  alignItems: 'center',
                  borderRadius: 16,
                  backgroundColor: 'rgba(255,255,255,0.05)'
                }}
                onPress={() => handleShowPaymentModal(false)}
              >
                <Text style={{ color: '#94a3b8', fontSize: 15, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </BlurView>
      </Modal>

      {/* ── Payment Details Modal ── */}
      <Modal
        visible={showPaymentDetailsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPaymentDetailsModal(false)}
        statusBarTranslucent={true}
      >
        <BlurView intensity={80} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.85)' }]}>
          <LinearGradient
            colors={['rgba(15,15,20,0.95)', 'rgba(20,20,28,0.95)', 'rgba(15,15,20,0.95)']}
            style={StyleSheet.absoluteFill}
          />
          <TouchableOpacity
            style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}
            activeOpacity={1}
            onPress={() => !paymentProcessing && setShowPaymentDetailsModal(false)}
          >
            <TouchableOpacity
              activeOpacity={1}
              style={{
                backgroundColor: '#13131f',
                borderTopLeftRadius: 36,
                borderTopRightRadius: 36,
                marginTop: TOP,
                padding: 24,
                paddingTop: 16,
                paddingBottom: 48,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.1)'
              }}
            >
              {/* Drag Handle */}
              <View style={{ width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, alignSelf: 'center', marginBottom: 24 }} />

              {paymentSuccess ? (
                /* Success State */
                <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                  <View style={{
                    width: 80, height: 80, borderRadius: 40,
                    backgroundColor: 'rgba(52,211,153,0.15)',
                    alignItems: 'center', justifyContent: 'center', marginBottom: 16
                  }}>
                    <Ionicons name="checkmark-circle" size={52} color="#34d399" />
                  </View>
                  <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900', marginBottom: 8 }}>Payment Successful!</Text>
                  <Text style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center' }}>
                    Your {selectedPlanForPayment?.name?.split(' [')[0]} plan is now active.
                  </Text>
                </View>
              ) : (
                <>
                  {/* Back button + title */}
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 }}
                    onPress={() => setShowPaymentDetailsModal(false)}
                  >
                    <Ionicons name="arrow-back" size={20} color="#94a3b8" />
                    <Text style={{ color: '#94a3b8', fontSize: 14, fontWeight: '600' }}>Back to Methods</Text>
                  </TouchableOpacity>

                  {/* Method badge */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                    <View style={{
                      width: 48, height: 48, borderRadius: 14,
                      backgroundColor: `${selectedPaymentMethod?.color}20`,
                      alignItems: 'center', justifyContent: 'center'
                    }}>
                      <Ionicons name={selectedPaymentMethod?.icon as any} size={26} color={selectedPaymentMethod?.color} />
                    </View>
                    <View>
                      <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800' }}>{selectedPaymentMethod?.label}</Text>
                      <Text style={{ color: '#64748b', fontSize: 12 }}>
                        Paying for: {selectedPlanForPayment?.name?.split(' [')[0]} — {selectedPlanForPayment?.price} {selectedPlanForPayment?.currency}
                      </Text>
                    </View>
                  </View>

                  {/* -- MOBILE MONEY FIELDS -- */}
                  {(selectedPaymentMethod?.id === 'mtn' || selectedPaymentMethod?.id === 'airtel') && (
                    <View style={{ gap: 14 }}>
                      <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 }}>
                        {selectedPaymentMethod?.id === 'mtn' ? 'MTN Mobile Money' : 'Airtel Money'} Number
                      </Text>
                      {/* prefix hint chips */}
                      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 4 }}>
                        {(selectedPaymentMethod?.id === 'mtn' ? ['077', '078', '076'] : ['070', '074', '075']).map(p => (
                          <View key={p} style={{
                            paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
                            backgroundColor: paymentPhone.replace(/\D/g, '').startsWith(p)
                              ? `${selectedPaymentMethod?.color}30`
                              : 'rgba(255,255,255,0.05)',
                            borderWidth: 1,
                            borderColor: paymentPhone.replace(/\D/g, '').startsWith(p)
                              ? selectedPaymentMethod?.color
                              : 'rgba(255,255,255,0.08)'
                          }}>
                            <Text style={{
                              color: paymentPhone.replace(/\D/g, '').startsWith(p)
                                ? selectedPaymentMethod?.color
                                : '#475569',
                              fontSize: 12, fontWeight: '700'
                            }}>{p}</Text>
                          </View>
                        ))}
                      </View>

                      <View style={{
                        flexDirection: 'row', alignItems: 'center',
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        borderRadius: 16, borderWidth: 1,
                        borderColor: paymentPhone.replace(/\D/g, '').length >= 10 && (selectedPaymentMethod?.id === 'mtn' ? ['077', '078', '076'] : ['070', '074', '075']).some(p => paymentPhone.replace(/\D/g, '').startsWith(p))
                          ? selectedPaymentMethod?.color
                          : paymentPhone.replace(/\D/g, '').length >= 3 && !(selectedPaymentMethod?.id === 'mtn' ? ['077', '078', '076'] : ['070', '074', '075']).some(p => paymentPhone.replace(/\D/g, '').startsWith(p))
                            ? '#ef4444'
                            : 'rgba(255,255,255,0.1)',
                        paddingHorizontal: 16, paddingVertical: 14, gap: 12
                      }}>
                        <Ionicons name="phone-portrait-outline" size={20} color={selectedPaymentMethod?.color} />
                        <TextInput
                          style={{ flex: 1, color: '#fff', fontSize: 18, fontWeight: '700', letterSpacing: 1 }}
                          value={paymentPhone}
                          onChangeText={setPaymentPhone}
                          placeholder={selectedPaymentMethod?.id === 'mtn' ? '077 / 078 / 076 XXXXXXX' : '070 / 074 / 075 XXXXXXX'}
                          placeholderTextColor="rgba(255,255,255,0.2)"
                          keyboardType="phone-pad"
                          maxLength={13}
                        />
                      </View>

                      {/* wrong prefix error */}
                      {paymentPhone.replace(/\D/g, '').length >= 3 && !(selectedPaymentMethod?.id === 'mtn' ? ['077', '078', '076'] : ['070', '074', '075']).some(p => paymentPhone.replace(/\D/g, '').startsWith(p)) && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name="alert-circle" size={14} color="#ef4444" />
                          <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '600' }}>
                            {selectedPaymentMethod?.id === 'mtn'
                              ? 'MTN numbers start with 077, 078 or 076'
                              : 'Airtel numbers start with 070, 074 or 075'}
                          </Text>
                        </View>
                      )}

                      <Text style={{ color: '#475569', fontSize: 12 }}>
                        You will receive a prompt on your {selectedPaymentMethod?.id === 'mtn' ? 'MTN' : 'Airtel'} number to confirm the payment of {selectedPlanForPayment?.price} {selectedPlanForPayment?.currency}.
                      </Text>
                    </View>
                  )}

                  {/* -- CARD FIELDS -- */}
                  {selectedPaymentMethod?.id === 'card' && (
                    <View style={{ gap: 14 }}>
                      {/* Card Number */}
                      <View>
                        <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Card Number</Text>
                        <View style={{
                          flexDirection: 'row', alignItems: 'center',
                          backgroundColor: 'rgba(255,255,255,0.05)',
                          borderRadius: 14, borderWidth: 1,
                          borderColor: cardNumber.replace(/\s/g, '').length === 16 ? '#6366f1' : 'rgba(255,255,255,0.1)',
                          paddingHorizontal: 16, paddingVertical: 14, gap: 12
                        }}>
                          <Ionicons name="card-outline" size={20} color="#6366f1" />
                          <TextInput
                            style={{ flex: 1, color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 2 }}
                            value={cardNumber}
                            onChangeText={(t) => setCardNumber(formatCardNumber(t))}
                            placeholder="1234 5678 9012 3456"
                            placeholderTextColor="rgba(255,255,255,0.2)"
                            keyboardType="number-pad"
                            maxLength={19}
                          />
                        </View>
                      </View>

                      {/* Expiry + CVV */}
                      <View style={{ flexDirection: 'row', gap: 12 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Expiry Date</Text>
                          <View style={{
                            flexDirection: 'row', alignItems: 'center',
                            backgroundColor: 'rgba(255,255,255,0.05)',
                            borderRadius: 14, borderWidth: 1,
                            borderColor: cardExpiry.length === 5 ? '#6366f1' : 'rgba(255,255,255,0.1)',
                            paddingHorizontal: 14, paddingVertical: 14, gap: 10
                          }}>
                            <Ionicons name="calendar-outline" size={18} color="#6366f1" />
                            <TextInput
                              style={{ flex: 1, color: '#fff', fontSize: 16, fontWeight: '700' }}
                              value={cardExpiry}
                              onChangeText={(t) => setCardExpiry(formatExpiry(t))}
                              placeholder="MM/YY"
                              placeholderTextColor="rgba(255,255,255,0.2)"
                              keyboardType="number-pad"
                              maxLength={5}
                            />
                          </View>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>CVV</Text>
                          <View style={{
                            flexDirection: 'row', alignItems: 'center',
                            backgroundColor: 'rgba(255,255,255,0.05)',
                            borderRadius: 14, borderWidth: 1,
                            borderColor: cardCVV.length === 3 ? '#6366f1' : 'rgba(255,255,255,0.1)',
                            paddingHorizontal: 14, paddingVertical: 14, gap: 10
                          }}>
                            <Ionicons name="lock-closed-outline" size={18} color="#6366f1" />
                            <TextInput
                              style={{ flex: 1, color: '#fff', fontSize: 16, fontWeight: '700' }}
                              value={cardCVV}
                              onChangeText={setCardCVV}
                              placeholder="123"
                              placeholderTextColor="rgba(255,255,255,0.2)"
                              keyboardType="number-pad"
                              maxLength={3}
                              secureTextEntry
                            />
                          </View>
                        </View>
                      </View>

                      {/* Cardholder Name */}
                      <View>
                        <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Cardholder Name</Text>
                        <View style={{
                          flexDirection: 'row', alignItems: 'center',
                          backgroundColor: 'rgba(255,255,255,0.05)',
                          borderRadius: 14, borderWidth: 1,
                          borderColor: cardName.length > 2 ? '#6366f1' : 'rgba(255,255,255,0.1)',
                          paddingHorizontal: 16, paddingVertical: 14, gap: 12
                        }}>
                          <Ionicons name="person-outline" size={20} color="#6366f1" />
                          <TextInput
                            style={{ flex: 1, color: '#fff', fontSize: 15, fontWeight: '600' }}
                            value={cardName}
                            onChangeText={setCardName}
                            placeholder="John Doe"
                            placeholderTextColor="rgba(255,255,255,0.2)"
                            autoCapitalize="words"
                          />
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Pay Now Button */}
                  {(() => {
                    const isMobile = selectedPaymentMethod?.id === 'mtn' || selectedPaymentMethod?.id === 'airtel';
                    const mtnPrefixes = ['077', '078', '076'];
                    const airtelPrefixes = ['070', '074', '075'];
                    const rawPhone = paymentPhone.replace(/\D/g, '');
                    const phonePrefix = rawPhone.slice(0, 3);
                    const validMtnPrefix = mtnPrefixes.some(p => rawPhone.startsWith(p));
                    const validAirtelPrefix = airtelPrefixes.some(p => rawPhone.startsWith(p));
                    const validPrefix = selectedPaymentMethod?.id === 'mtn' ? validMtnPrefix : validAirtelPrefix;
                    const wrongPrefix = rawPhone.length >= 3 && !validPrefix;
                    const isPayReady = isMobile
                      ? rawPhone.length >= 10 && validPrefix
                      : cardNumber.replace(/\s/g, '').length === 16 && cardExpiry.length === 5 && cardCVV.length === 3 && cardName.trim().length > 1;
                    return (
                      <View>
                        {/* Save Payment Method Checkbox */}
                        <TouchableOpacity
                          style={{ flexDirection: 'row', alignItems: 'center', marginTop: 24, paddingHorizontal: 4 }}
                          onPress={() => setSavePaymentMethod(!savePaymentMethod)}
                          activeOpacity={0.7}
                        >
                          <View style={{
                            width: 20, height: 20, borderRadius: 6,
                            borderWidth: 2, borderColor: savePaymentMethod ? selectedPaymentMethod?.color : '#64748b',
                            backgroundColor: savePaymentMethod ? selectedPaymentMethod?.color : 'transparent',
                            alignItems: 'center', justifyContent: 'center', marginRight: 12
                          }}>
                            {savePaymentMethod && <Ionicons name="checkmark" size={14} color="#fff" />}
                          </View>
                          <Text style={{ color: '#cbd5e1', fontSize: 13, fontWeight: '500' }}>Save the number for the next payment</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[{
                            marginTop: 16,
                            paddingVertical: 17,
                            borderRadius: 18,
                            alignItems: 'center',
                            backgroundColor: selectedPaymentMethod?.color || '#6366f1',
                            shadowColor: selectedPaymentMethod?.color || '#6366f1',
                            shadowOffset: { width: 0, height: 6 },
                            shadowOpacity: isPayReady ? 0.45 : 0,
                            shadowRadius: 14,
                            elevation: isPayReady ? 8 : 0,
                            opacity: isPayReady ? 1 : 0.35,
                          }, paymentProcessing && { opacity: 0.7 }]}
                          onPress={handleProceedPayment}
                          disabled={paymentProcessing || !isPayReady}
                        >
                          {paymentProcessing ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                              <Ionicons name="sync" size={18} color="#fff" />
                              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>Processing...</Text>
                            </View>
                          ) : (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                              <Ionicons name="lock-closed" size={18} color="#fff" />
                              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 }}>
                                Pay {selectedPlanForPayment?.price} {selectedPlanForPayment?.currency}
                              </Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      </View>
                    );
                  })()}

                  <Text style={{ color: '#334155', fontSize: 11, textAlign: 'center', marginTop: 12 }}>
                    🔒 Secured & encrypted payment
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </TouchableOpacity>
        </BlurView>
      </Modal>

      {/* ── Stats Modal ── */}
      <Modal 
        visible={!!selectedStat} 
        transparent 
        animationType="fade" 
        onRequestClose={() => toggleStatsModal(null)}
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
                <TouchableOpacity style={styles.fullScreenCloseBtn} onPress={() => toggleStatsModal(null)}>
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
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <Ionicons name={g.icon as any} size={16} color={g.color} />
                              <Text style={styles.genreName}>{g.genre}</Text>
                            </View>
                            <Text style={styles.genreValue}>{g.hours}</Text>
                          </View>
                          <View style={styles.progressBg}>
                            <LinearGradient
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 0 }}
                              colors={[`${g.color}40`, g.color]}
                              style={[styles.progressFill, { width: `${g.percent * 100}%` }]}
                            />
                          </View>
                        </View>
                      ))}
                    </View>

                    <TouchableOpacity 
                      style={styles.pillBack} 
                      onPress={() => setSelectedStat(null)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.pillSheen} />
                      <Ionicons name="chevron-back" size={14} color="#fff" />
                      <Text style={styles.pillLabel}>BACK</Text>
                    </TouchableOpacity>
                  </View>
                )}


                {selectedStat?.label === 'Downloads' && (
                  <View style={styles.settingsContentSection}>
                    <View style={styles.storageCard}>
                      <View style={styles.storageInfo}>
                        <Text style={styles.storageLabel}>Total Storage Used</Text>
                        <Text style={styles.storageValue}>12.4 GB / 50 GB</Text>
                      </View>
                      <View style={styles.progressBg}>
                        <View style={[styles.progressFill, { width: '25%', backgroundColor: '#10b981' }]} />
                      </View>
                    </View>

                    <Text style={styles.sectionLabel}>Files ({selectedStat.value})</Text>
                    {[
                      { title: 'Interstellar', size: '2.4 GB', quality: '4K', img: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400' },
                      { title: 'The Dark Knight', size: '1.8 GB', quality: '1080p', img: 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=400' },
                      { title: 'Inception', size: '2.1 GB', quality: '4K', img: 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=400' },
                      { title: 'Dunkirk', size: '1.5 GB', quality: '1080p', img: 'https://images.unsplash.com/photo-1509248961158-e54f6934749c?w=400' }
                    ].map((m) => (
                      <View key={m.title} style={styles.downloadCard}>
                        <View style={styles.downloadPosterContainer}>
                          <Image source={{ uri: m.img }} style={styles.downloadPoster} />
                        </View>
                        <View style={styles.downloadInfo}>
                          <Text style={styles.downloadTitle}>{m.title}</Text>
                          <Text style={styles.downloadMeta}>{m.quality} • {m.size}</Text>
                        </View>
                        <TouchableOpacity style={[styles.downloadDeleteBtn, { marginRight: 12, alignSelf: 'center' }]}>
                          <Ionicons name="trash-outline" size={20} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                {selectedStat?.label === 'My List' && (
                  <View style={styles.settingsContentSection}>
                    <Text style={styles.settingsText}>You have {selectedStat.value} items saved in your watchlist.</Text>
                    <View style={styles.watchlistGrid}>
                      {[
                        'https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?w=400',
                        'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400',
                        'https://images.unsplash.com/photo-1542204172-3f2415d831d4?w=400',
                        'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400',
                        'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=400',
                        'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400'
                      ].map((img, i) => (
                        <View key={i} style={styles.gridCard}>
                          <Image source={{ uri: img }} style={styles.gridPoster} />
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </ScrollView>

              <View style={[styles.modalFooter, { paddingBottom: Platform.OS === 'android' ? (insets.bottom > 0 ? insets.bottom + 12 : 24) : Math.max(insets.bottom + 10, 44) }]}>
                {scrollContentHeight > scrollViewHeight && currentScrollY < scrollContentHeight - scrollViewHeight - 20 && (
                  <LinearGradient
                    colors={['transparent', '#0f0f14', '#0f0f14']}
                    style={[styles.footerGradient, { height: (Platform.OS === 'ios' ? 110 : 80) + insets.bottom }]}
                    pointerEvents="none"
                  />
                )}
                <TouchableOpacity onPress={handleSettingsDone} style={{ width: '100%' }}>
                  <View style={styles.fullScreenActionBtn}>
                    <BlurView tint="dark" intensity={99} style={StyleSheet.absoluteFill} />
                    <BlurView tint="dark" intensity={99} style={StyleSheet.absoluteFill} />
                    <BlurView tint="dark" intensity={99} style={StyleSheet.absoluteFill} />
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(91,95,239,0.65)', borderRadius: 24 }]} />
                    <View style={styles.pillSheen} />
                    <Text style={styles.editActionText}>Back</Text>
                  </View>
                </TouchableOpacity>
            </View>
          </View>

        </View>
        </BlurView>
      </Modal>







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
        {/* ── Profile card ── */}
        <View style={{ width: '100%', marginBottom: 20 }}>
          {/* White Background Glow */}
          <View style={{
            position: 'absolute', top: 15, left: 15, right: 15, bottom: 15,
            backgroundColor: '#ffffff', borderRadius: 24, opacity: 0.15,
            shadowColor: '#ffffff', shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 1, shadowRadius: 25,
          }} />
          <View style={[styles.profileCard, { 
            marginBottom: 0, 
            backgroundColor: 'rgba(30, 30, 45, 0.98)', 
            borderWidth: 1.5,
            borderColor: 'rgba(255, 255, 255, 0.15)',
            shadowColor: '#000000', shadowOffset: { width: 0, height: 8 }, 
            shadowOpacity: 0.4, shadowRadius: 20, elevation: 12
          }]}>
          <View style={styles.profileCardInner}>
            <LinearGradient
              colors={['rgba(91,95,239,0.2)', 'rgba(91,95,239,0)']}
              style={styles.profileGradient}
            />
            <TouchableOpacity style={styles.avatarRing} activeOpacity={0.9} onPress={handleEditProfile}>
              <Image
                source={{ uri: PROFILE_IMAGE_URI }}
                style={styles.avatar}
              />
              <View style={styles.avatarCameraOverlay}>
                <Ionicons name="camera" size={12} color="#fff" />
              </View>
            </TouchableOpacity>
            
            {/* Subscription Color Logic */}
            {(() => {
              const durations: Record<string, number> = { '1 week': 8, '2 week': 16, '1 Month': 34, '2 months': 67 };
              const total = durations[subscriptionBundle] || 16;
              const percent = (remainingDays / total) * 100;
              const sCol = !isSubscribed || percent < 15 ? '#ef4444' : percent < 50 ? '#f59e0b' : '#10b981';
              const sBg = !isSubscribed || percent < 15 ? 'rgba(239,68,68,0.1)' : percent < 50 ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.08)';
              const sBor = !isSubscribed || percent < 15 ? 'rgba(239,68,68,0.2)' : percent < 50 ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)';

              return (
                <View style={styles.profileInfo}>
                  <View style={{ marginLeft: 80 }}>
                    <Text style={styles.profileName}>{userName}</Text>
                    <Text style={styles.profileEmail}>{userEmail}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 24 }}>
                    <TouchableOpacity
                      style={[
                        styles.profileBadge,
                        { backgroundColor: sBg, borderColor: sBor, marginTop: 0 }
                      ]}
                      activeOpacity={0.7}
                      onPress={() => toggleSettingsModal(MENU_ITEMS.find(m => m.id === '3') ?? null)}
                    >
                      <Ionicons
                        name={isSubscribed ? "diamond" : "star-outline"}
                        size={11}
                        color={sCol}
                      />
                      <Text style={[styles.profileBadgeText, { color: sCol }]}>
                        {!isSubscribed 
                          ? "No Active Subscription • Upgrade to Premium"
                          : remainingDays <= 5
                            ? `Ending Soon: ${subscriptionBundle}${subscriptionBundle.toLowerCase().includes('week') && !subscriptionBundle.toLowerCase().includes('weeks') ? 's' : ''} Plan • ${remainingDays} Days Left`
                            : `${subscriptionBundle}${subscriptionBundle.toLowerCase().includes('week') && !subscriptionBundle.toLowerCase().includes('weeks') ? 's' : ''} Plan Active • ${remainingDays} Days Left`
                        }
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })()}
            <TouchableOpacity style={styles.editBtn} activeOpacity={0.75} onPress={handleEditProfile}>
              <BlurView intensity={65} tint="dark" style={StyleSheet.absoluteFill} />
              <Ionicons name="create-outline" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
          </View>
        </View>


        <View style={{ width: '100%', marginTop: 0, marginBottom: 20 }}>
          {/* White Background Glow */}
          <View style={{
            position: 'absolute',
            top: 15,
            left: 15,
            right: 15,
            bottom: 15,
            backgroundColor: '#ffffff',
            borderRadius: 32,
            opacity: 0.15,
            zIndex: 0,
            shadowColor: '#ffffff',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 1,
            shadowRadius: 25,
          }} />
          <View style={[styles.settingsList, {
            backgroundColor: 'rgba(30, 30, 45, 0.98)',
            borderRadius: 32,
            borderWidth: 1.5,
            borderColor: 'rgba(255, 255, 255, 0.15)',
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.4,
            shadowRadius: 20,
            elevation: 12,
            overflow: 'hidden',
            paddingVertical: 10
          }]}>
          {MENU_ITEMS.filter(item => item.id !== 'admin' || userEmail?.toLowerCase() === 'sserunkumaharuna01@gmail.com').map((item, i, filteredArray) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.settingsRow,
                i === filteredArray.length - 1 && { borderBottomWidth: 0 },
              ]}
              activeOpacity={0.65}
              onPress={() => {
                if (item.id === 'admin') {
                  router.push('/admin');
                } else if (item.title === 'About') {
                  setAboutVisible(true);
                } else {
                  setSelectedItem(item);
                }
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <View style={[styles.menuIcon, { backgroundColor: item.color + '15' }]}>
                  <Ionicons name={item.icon as any} size={20} color={item.color} />
                </View>
                <View style={styles.menuTextWrap}>
                  <Text style={styles.settingsRowText}>{item.title}</Text>
                  <Text style={styles.menuSub}>{item.subtitle}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.2)" />
            </TouchableOpacity>
          ))}
          </View>
        </View>

        {/* ── Logout ── */}
        <TouchableOpacity 
          style={styles.logoutBtn} 
          activeOpacity={0.75}
          onPress={async () => {
            try {
              await signOut(auth);
              await AsyncStorage.removeItem('userToken');
              router.replace('/login');
            } catch (e) {
              console.error('Failed to logout:', e);
            }
          }}
        >
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        {/* ── Footer ── */}
        <Text style={styles.versionText}>THE MOVIE ZONE 24/7 v2.4.1</Text>
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
      <Modal
        visible={show2FAVerifyModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShow2FAVerifyModal(false)}
      >
        <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.verifyModalContainer}
          >
            <View style={styles.verifyModalContent}>
              <View style={styles.verifyIconWrap}>
                <Ionicons name="shield-checkmark" size={32} color="#34d399" />
              </View>
              <Text style={styles.verifyTitle}>Verify Identity</Text>
              <Text style={styles.verifyDesc}>
                Enter the 6-digit code sent to your registered device to confirm this change.
              </Text>

              <TextInput
                style={styles.verifyInput}
                value={tfaVerificationCode}
                onChangeText={setTfaVerificationCode}
                placeholder="000000"
                placeholderTextColor="rgba(255,255,255,0.3)"
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />

              <View style={styles.verifyActions}>
                <TouchableOpacity 
                  style={styles.verifyCancelBtn} 
                  onPress={() => {
                    setShow2FAVerifyModal(false);
                    setTfaVerificationCode('');
                  }}
                >
                  <Text style={styles.verifyCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.verifyConfirmBtn, tfaVerificationCode.length < 6 && { opacity: 0.5 }]} 
                  onPress={handleVerify2FA}
                  disabled={tfaVerificationCode.length < 6 || is2FALoading}
                >
                  {is2FALoading ? (
                    <Text style={styles.verifyConfirmText}>Verifying...</Text>
                  ) : (
                    <Text style={styles.verifyConfirmText}>Confirm</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </BlurView>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#13131f' },
  verifyModalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  verifyModalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#1a1a2e',
    borderRadius: 32,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  verifyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  verifyTitle: { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 12 },
  verifyDesc: { color: '#94a3b8', fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 30 },
  verifyInput: {
    width: '100%',
    height: 60,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 8,
    marginBottom: 30,
  },
  verifyActions: { flexDirection: 'row', gap: 12, width: '100%' },
  verifyCancelBtn: { flex: 1, height: 50, justifyContent: 'center', alignItems: 'center', borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)' },
  verifyCancelText: { color: '#94a3b8', fontWeight: '700' },
  verifyConfirmBtn: { flex: 2, height: 50, justifyContent: 'center', alignItems: 'center', borderRadius: 16, backgroundColor: '#34d399' },
  verifyConfirmText: { color: '#000', fontWeight: '800' },

  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },

  scroll: {
    paddingTop: Platform.OS === 'ios' ? 100 : 90, // Push content below the global top bar logo
    paddingHorizontal: 16,
    paddingBottom: 160, // Standardize bottom padding to allow content to enter navigation area
  },

  // ── Profile card
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    marginBottom: 20,
    overflow: 'hidden',
  },
  profileCardInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 20,
    minHeight: 120,
  },
  profileGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
  },
  avatarRing: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 64, height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    padding: 3,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
  },
  profileInfo: { flex: 1, gap: 2 },
  profileName: { color: '#fff', fontSize: 18, fontWeight: '800' },
  profileEmail: { color: '#cbd5e1', fontSize: 13 },
  profileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'center',
    borderWidth: 1.5,
  },
  profileBadgeText: { 
    color: '#f59e0b', 
    fontSize: 11.5, 
    fontWeight: '800', 
    letterSpacing: 0.3,
    textTransform: 'uppercase'
  },
  editBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    zIndex: 10,
  },

  // ── Stats
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    overflow: 'hidden',
  },
  statCardInner: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 18,
    gap: 4,
  },
  statValue: { color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  statLabel: { color: '#94a3b8', fontSize: 11, fontWeight: '700', marginTop: 2 },

  // ── Menu section
  sectionLabel: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 4,
  },
  menuSection: {
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    marginBottom: 24,
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  menuIcon: {
    width: 38, height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTextWrap: { flex: 1, gap: 1 },
  menuTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  menuSub: { color: '#cbd5e1', fontSize: 11 },

  // ── Logout
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    width: '60%',
    alignSelf: 'center',
    borderRadius: 25,
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    marginBottom: 40,
    overflow: 'hidden',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  logoutText: { color: '#ef4444', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },

  // ── Footer
  versionText: {
    textAlign: 'center',
    color: '#cbd5e1',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.5,
  },
  // ── About Modal Styles (now using settings modal styles)
  settingsModalContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  settingsModalContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
  },
  settingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    marginBottom: 16,
  },
  settingsModalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    flex: 1,
    marginLeft: 12,
  },
  aboutSection: {
    marginBottom: 16,
  },
  aboutLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  aboutValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  aboutDesc: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 4,
  },
  aboutDescSmall: {
    color: '#94a3b8',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 8,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  featureText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '500',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 10,
    borderRadius: 10,
    marginBottom: 6,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  infoLabel: {
    color: '#94a3b8',
    fontSize: 13,
  },
  infoValue: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  legalLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  legalLink: {
    color: '#818cf8',
    fontSize: 12,
    fontWeight: '600',
  },
  legalDivider: {
    width: 1,
    height: 12,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  updateCheckCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  updateStatusContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
  },
  statusText: {
    color: '#818cf8',
    fontSize: 12,
    fontWeight: '600',
  },
  // ── Full-Screen Modal Styles (now using settings modal styles)
  fullScreenCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  settingsIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsScroll: {
    flex: 1,
  },
  settingsContentSection: {
    gap: 16,
  },
  settingsText: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 22,
  },
  settingsList: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 22,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  settingsRowText: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '600',
  },
  // ── Notification Styles
  notificationCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  notifTime: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
  },
  notifMessage: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6366f1',
    marginLeft: 4,
  },

  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
    backgroundColor: 'rgba(129,140,248,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  backBtnText: {
    color: '#818cf8',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pillBack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 50,
    overflow: 'hidden',
    backgroundColor: '#5B5FEF',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    shadowColor: '#5B5FEF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  pillLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  pillSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 50,
  },
  // ── Glass Subscription Styles
  coverageBlur: {
    marginBottom: 20,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  coverageGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  coverageContent: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  coverageLabel: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  coverageValue: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
  },
  glassSubscriptionCard: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  cardDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    marginVertical: 12,
  },
  benefitTag: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  benefitTagText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
  },
  detailCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 20,
    padding: 16,
    gap: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  detailRow: {
    gap: 4,
  },
  detailLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  detailValue: {
    color: '#f1f5f9',
    fontSize: 16,
    fontWeight: '600',
  },
  editInput: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginTop: 4,
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  editActionBtn: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtn: {
    backgroundColor: '#5B5FEF',
  },
  cancelBtn: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  mainEditBtn: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  editActionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  // ── Analytics Styles
  analyticsMain: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: 'rgba(129,140,248,0.08)',
    borderRadius: 32,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  analyticsTotal: {
    color: '#fff',
    fontSize: 56,
    fontWeight: '900',
    letterSpacing: -1,
  },
  analyticsSub: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: 4,
  },

  genreRow: {
    marginBottom: 20,
  },
  genreInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  genreName: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '600',
  },
  genreValue: {
    color: '#818cf8',
    fontSize: 14,
    fontWeight: '700',
  },
  progressBg: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#5B5FEF',
    borderRadius: 4,
  },
  // ── Usage Analytics
  usageRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  usageCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  usageLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  usageValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
  },

  activityChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 140,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
  },
  chartCol: {
    alignItems: 'center',
    flex: 1,
  },
  barBg: {
    width: 6,
    height: 80,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 3,
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  barFill: {
    width: '100%',
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'flex-start',
  },
  barSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
  },
  chartDay: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 10,
  },
  // ── Storage Card
  storageCard: {
    backgroundColor: 'rgba(16,185,129,0.08)',
    borderRadius: 24,
    padding: 20,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.1)',
  },
  storageInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  storageLabel: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '700',
  },
  storageValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // ── Download Items
  downloadCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  downloadPosterContainer: {
    width: 100,
    height: 140,
  },
  downloadPoster: {
    width: '100%',
    height: '100%',
  },
  downloadInfo: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  downloadTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  downloadMeta: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 12,
  },
  downloadActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  downloadPlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#5B5FEF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  downloadPlayText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  downloadDeleteBtn: {
    padding: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
  },
  // ── Grid Card (My List)
  gridCard: {
    width: (SCREEN_W - 44) / 3,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  gridPoster: {
    width: '100%',
    height: 150,
    resizeMode: 'cover',
  },
  gridInfo: {
    padding: 6,
    alignItems: 'center',
  },
  gridTitle: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 2,
  },
  gridMeta: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
  },
  // ── Badges Small
  vjBadgeSmall: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  vjBadgeTextSmall: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '800',
  },
  genreBadgeSmall: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(91, 95, 239, 0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  genreBadgeTextSmall: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '800',
  },
  // ── Watchlist Grid
  watchlistGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'flex-start',
    marginTop: 16,
    paddingHorizontal: 0,
  },
  // ── Deletion Styles
  deletionWarningBox: {
    backgroundColor: 'rgba(245,158,11,0.05)',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.15)',
    marginBottom: 20,
  },
  deletionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  deletionDesc: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  consequenceList: {
    gap: 12,
  },
  consequenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  consequenceText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '500',
  },
  confirmToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    marginBottom: 24,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  confirmText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  finalDeleteBtn: {
    height: 56,
    borderRadius: 18,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  deleteBtnDisabled: {
    backgroundColor: 'rgba(239,68,68,0.2)',
    opacity: 0.5,
  },
  finalDeleteText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  emailConfirmSection: {
    marginBottom: 24,
    gap: 8,
  },
  emailConfirmLabel: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  requestCodeBtn: {
    backgroundColor: '#5B5FEF',
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  requestCodeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  // ── Security Sub-section Styles
  fullScreenActionBtn: {
    backgroundColor: 'transparent',
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    width: '100%',
    overflow: 'hidden',
  },
  fullScreenActionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  securityCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 24,
    padding: 24,
    marginTop: 16,
  },
  securityTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  securityDesc: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  sessionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionDevice: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  sessionDetails: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 4,
    fontWeight: '500',
  },
  currentStatus: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tfaToggleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: 'rgba(129,140,248,0.1)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.2)',
    marginBottom: 24,
  },
  tfaLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  tfaStatus: {
    color: '#818cf8',
    fontSize: 14,
    fontWeight: '800',
  },
  successBanner: {
    backgroundColor: 'rgba(52,211,153,0.1)',
    padding: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.2)',
  },
  successText: {
    color: '#34d399',
    fontSize: 14,
    fontWeight: '700',
  },
  // ── Profile Photo Edit Styles
  changePhotoSection: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  editAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: 'rgba(129,140,248,0.3)',
  },
  changePhotoBadge: {
    position: 'absolute',
    bottom: -8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 24,
    alignSelf: 'center',
    borderWidth: 2,
    borderColor: '#0a0a0f',
    shadowColor: '#3d44ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
  },
  changePhotoText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  avatarCameraOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#5B5FEF',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#111827',
  },
  socialLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 12,
  },
  socialLinkText: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  linkStatus: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  // ── Glass Redesign Styles
  glassCardWrap: {
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  glassCard: {
    padding: 24,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  glassAvatarRing: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    borderColor: 'rgba(129,140,248,0.5)',
    padding: 4,
    alignSelf: 'center',
    marginBottom: 20,
  },
  detailsListGlass: {
    gap: 16,
  },
  glassDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  glassDetailIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassDetailLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  glassDetailValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  glassEditInput: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    padding: 0,
    height: 24,
  },
  glassMainEditBtn: {
    height: 52,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
    // Removed heavy indigo shadow to match hero button's more subtle look
  },
  glassSaveBtn: {
    height: 52,
    backgroundColor: '#5B5FEF', // Standardized Design 2
    borderRadius: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    shadowColor: '#5B5FEF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
    overflow: 'hidden',
  },
  glassCancelBtn: {
    height: 52,
    backgroundColor: 'rgba(255, 255, 255, 0.05)', // Design 3
    borderRadius: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  glassActionText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    marginBottom: 20,
    gap: 8,
  },
  sectionHeaderBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 50,
    overflow: 'hidden',
    backgroundColor: '#5B5FEF',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    shadowColor: '#5B5FEF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  rowTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  headerSub: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 4,
  },
  headerLeadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  headerLeadingIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  circularCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  capsuleDoneBtn: {
    backgroundColor: 'rgba(91, 95, 239, 0.25)',
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#5B5FEF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
    width: '100%',
    overflow: 'hidden',
  },
  modalFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 44 : 24,
    paddingTop: 60,
  },
  footerGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: Platform.OS === 'ios' ? 110 : 90,
  },
  capsuleDoneText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  menuSectionHeader: {
    marginBottom: 12,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  historyCard: {
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  // ── Redesigned Personal Info Styles
  compactProfileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 20,
  },
  compactAvatarWrapper: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: '#818cf8',
    padding: 2,
  },
  compactAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
  },
  avatarMiniBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#5B5FEF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0f0f14',
  },
  headerInfo: {
    flex: 1,
  },
  headerDisplayName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
  },
  headerEmail: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '600',
  },
  piInfoCardGroup: {
    marginBottom: 20,
  },
  piInfoGroupTitle: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 10,
    marginLeft: 4,
  },
  piInfoCard: {
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  piInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  piNoBorder: {
    borderTopWidth: 0,
  },
  piInfoIcon: {
    width: 24,
    marginRight: 12,
  },
  piInfoLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  piInfoValue: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  piInfoInput: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    padding: 0,
    height: 20,
  },
  piNameGrid: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  piGridItem: {
    flex: 1,
    padding: 16,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: 'rgba(255,255,255,0.1)',
  },
  piMetadataPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    height: 44,
  },
  piMetadataText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '700',
  },
  piMainEditBtnWrapper: {
    alignSelf: 'stretch',
  },

  piMainEditBtn: {
    height: 44,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  piMainEditBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  piEditActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 20,
    paddingHorizontal: 20,
  },
  piCancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  piCancelBtnText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '700',
  },
  piSaveBtnWrapper: {
    flex: 1,
    maxWidth: 200,
  },
  piSaveBtn: {
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  piSaveBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
});
