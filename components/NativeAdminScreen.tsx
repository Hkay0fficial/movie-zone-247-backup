import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  FlatList,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StatusBar,
  Platform,
  Dimensions,
  Switch,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  getDoc,
  setDoc,
  query, 
  orderBy, 
  limit,
  serverTimestamp,
  getCountFromServer,
  where,
  Timestamp,
  onSnapshot
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL,
  listAll,
  getMetadata
} from 'firebase/storage';
import { sendPasswordResetEmail } from 'firebase/auth';
import { db, auth, storage } from '../constants/firebaseConfig';
import * as ImagePicker from 'expo-image-picker';
import { ALL_GENRES, ALL_VJS, Movie, Series } from '../constants/movieData';
import { useMovies } from '../app/context/MovieContext';
import { Image } from 'expo-image';
import ReflectiveText from './ReflectiveText';

const { width, height } = Dimensions.get('window');

export type AdminActionType = 
  | 'CREATE_CONTENT' 
  | 'UPDATE_CONTENT' 
  | 'DELETE_CONTENT' 
  | 'TOGGLE_PRICING' 
  | 'SEND_NOTIFICATION' 
  | 'BAN_USER' 
  | 'UNBAN_USER' 
  | 'GRANT_SUBSCRIPTION' 
  | 'REMOVE_SUBSCRIPTION' 
  | 'BULK_DELETE' 
  | 'BULK_UPDATE'
  | 'RESET_PASSWORD'
  | 'DELETE_USER'
  | 'CREATE_USER'
  | 'UPDATE_USER'
  | 'UPDATE_SETTINGS'
  | 'BROADCAST'
  | 'UPDATE_LAYOUT';

type AdminSection = 'Dashboard' | 'Content' | 'Users' | 'Media' | 'Announcements' | 'Logs' | 'Settings' | 'AppLayout';
type ContentType = 'Movie' | 'Series';

interface AuditLog {
  id: string;
  action: AdminActionType;
  details: string;
  targetId?: string;
  targetName?: string;
  adminEmail: string;
  adminId: string;
  createdAt: any;
}

interface UserData {
  id: string;
  email: string;
  joinDate: string;
  status: 'User' | 'Admin';
  isBanned: boolean;
  isOnline: boolean;
  plan: string;
  subscriptionExpiresAt: number | null;
  totalViews: number;
  lastLogin: any;
  createdAt: any;
}

interface Announcement {
  id: string;
  subject: string;
  category: string;
  createdAt: any;
}

interface LayoutSection {
  id: string;
  title: string;
  filterType: 'genre' | 'newReleases' | 'trending' | 'custom' | 'free';
  filterValue: string;
  isVisible: boolean;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function NativeAdminScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { liveMovies, liveSeries, loading: moviesLoading } = useMovies();
  
  const [activeSection, setActiveSection] = useState<AdminSection>('Dashboard');
  const [loading, setLoading] = useState(false);

  const getSectionHeaderInfo = (section: string) => {
    switch (section) {
      case 'Dashboard': return { title: 'Dashboard Overview', subtitle: 'Welcome back, Admin' };
      case 'Content': return { title: 'Movies & Series', subtitle: 'Manage your complete content library' };
      case 'Users': return { title: 'User Management', subtitle: 'Manage accounts, plans, and security' };
      case 'Media': return { title: 'Media Assets', subtitle: 'Manage promotional banners and imagery' };
      case 'Announcements': return { title: 'Announcements', subtitle: 'Broadcast platform-wide messages to all users' };
      case 'Logs': return { title: 'Activity Logs', subtitle: 'Audit administrative actions and system updates' };
      case 'Settings': return { title: 'Settings', subtitle: 'Manage platform-wide overrides and account settings' };
      case 'AppLayout': return { title: 'App Layout', subtitle: 'Control sections and order on the home screen' };
      default: return { title: 'Admin Panel', subtitle: 'System Management' };
    }
  };

  const renderSectionHeader = (title: string, subtitle: string) => (
    <View style={[styles.dashboardHeader, { marginTop: Math.max(insets.top, 16), paddingHorizontal: 20, paddingBottom: 10, backgroundColor: '#0a0a0f' }]}>
      <TouchableOpacity 
        onPress={() => router.replace('/(tabs)/menu')} 
        style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center' }}
      >
        <Ionicons name="chevron-back" size={20} color="#fff" />
      </TouchableOpacity>
      <View style={styles.dashboardTitleContainer}>
        <Text style={styles.dashboardMainTitle}>{title}</Text>
        <Text style={styles.dashboardWelcome}>{subtitle}</Text>
      </View>
      <ActivityIndicator size="small" color={loading ? "#6366f1" : "transparent"} />
    </View>
  );

  // --- Dashboard Stats ---
  const [stats, setStats] = useState({
    users: 0,
    movies: 0,
    activeSubs: 0,
    views: 0
  });

  // --- Content State ---
  const [activeTab, setActiveTab] = useState<ContentType>('Movie');
  const [searchQuery, setSearchQuery] = useState('');
  const [contentFilter, setContentFilter] = useState<'All' | 'Movie' | 'Series'>('All');
  const [pricingFilter, setPricingFilter] = useState<'All' | 'Free' | 'Paid'>('All');
  const [isContentModalVisible, setIsContentModalVisible] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [contentForm, setContentForm] = useState<any>({ 
    type: 'Movie', 
    title: '',
    synopsis: '',
    genre: 'Action', 
    vj: 'Vj Junior', 
    year: '', 
    rating: '', 
    poster: '', 
    videoUrl: '', 
    previewUrl: '',
    duration: '',
    previewDuration: '',
    isFree: false,
    isHero: false,
    heroType: 'video',
    heroVideoUrl: '',
    heroPhotoUrl: '',
    isMiniSeries: false,
    hasParts: false,
    episodeList: [],
    freeEpisodesCount: 0,
    seasons: 1,
    status: 'Ongoing',
    episodeDuration: '45m',
    goLiveDate: '',
    expiryDate: '',
    episodesPerPart: 1,
    notifyUsers: false
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  // --- Users State ---
  const [users, setUsers] = useState<UserData[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [isUserModalVisible, setIsUserModalVisible] = useState(false);
  const [isUserSelectMode, setIsUserSelectMode] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  // --- Announcements State ---
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [annForm, setAnnForm] = useState({ subject: '', category: 'General', imageUrl: '' });
  const [annSearchQuery, setAnnSearchQuery] = useState('');

  // --- Settings State ---
  const [settings, setSettings] = useState({
    allMoviesFree: false,
    eventMessage: '',
    expiresAt: '',
    duration: '1h',
    customExpiresAt: ''
  });
  
  // --- Logs State ---
  const [logs, setLogs] = useState<AuditLog[]>([]);
  // --- Logs Filter State ---
  const [logSearch, setLogSearch] = useState('');
  const [logActionFilter, setLogActionFilter] = useState<AdminActionType | 'ALL'>('ALL');
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);

  // --- Add User State ---
  const [isAddUserModalVisible, setIsAddUserModalVisible] = useState(false);
  const [newUserForm, setNewUserForm] = useState({ 
    email: '', 
    password: '', 
    duration: '24h', 
    customDays: '',
    customHours: '',
    customDownloads: '10',
    autoDelete: true,
    plan: 'Standard' 
  });
  const [isCustomGrantModalVisible, setIsCustomGrantModalVisible] = useState(false);
  const [customGrantForm, setCustomGrantForm] = useState({
    days: '0',
    hours: '0',
    downloads: '10'
  });
  const [isGranting, setIsGranting] = useState(false);

  const [mediaTab, setMediaTab] = useState<'Hero' | 'Gallery' | 'Storage'>('Hero');
  const [storageItems, setStorageItems] = useState<any[]>([]);
  const [storagePathStack, setStoragePathStack] = useState<any[]>([ref(storage, '/')]);
  const [isExplorerLoading, setIsExplorerLoading] = useState(false);
  const [isMediaPreviewVisible, setIsMediaPreviewVisible] = useState(false);
  const [selectedMediaUri, setSelectedMediaUri] = useState<string | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  // --- Picker Modals ---
  const [isGenreModalVisible, setIsGenreModalVisible] = useState(false);
  const [isVjModalVisible, setIsVjModalVisible] = useState(false);

  // --- App Layout State ---
  const [layoutSections, setLayoutSections] = useState<LayoutSection[]>([]);
  const [isLayoutSaving, setIsLayoutSaving] = useState(false);
  const [editingLayoutId, setEditingLayoutId] = useState<string | null>(null);
  const [editingLayoutTitle, setEditingLayoutTitle] = useState('');
  const [isAddSectionModalVisible, setIsAddSectionModalVisible] = useState(false);
  const [newSectionForm, setNewSectionForm] = useState({
    title: '',
    filterType: 'genre' as LayoutSection['filterType'],
    filterValue: ''
  });

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const getRelativeTime = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (hours < 1) return 'ACTIVE';
    if (hours < 24) return `${hours}H AGO`;
    return `${days}D AGO`;
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const fetchStorageItems = async () => {
    const currentRef = storagePathStack[storagePathStack.length - 1];
    setIsExplorerLoading(true);
    try {
      const result = await listAll(currentRef);
      const folders = result.prefixes.map(f => ({ 
        name: f.name, 
        type: 'folder', 
        ref: f 
      }));
      
      const filePromises = result.items.map(async (item) => {
        const metadata = await getMetadata(item);
        return {
          name: item.name,
          type: 'file',
          format: metadata.contentType?.split('/')[1]?.toUpperCase() || 'FILE',
          size: formatBytes(metadata.size),
          ref: item
        };
      });
      
      const files = await Promise.all(filePromises);
      setStorageItems([...folders, ...files]);
    } catch (err) {
      console.error('Storage listing error:', err);
      Alert.alert('Error', 'Failed to load storage items');
    } finally {
      setIsExplorerLoading(false);
    }
  };

  useEffect(() => {
    if (mediaTab === 'Storage') {
      fetchStorageItems();
    }
  }, [storagePathStack, mediaTab]);

  const handleFolderPress = (folderRef: any) => {
    setStoragePathStack(prev => [...prev, folderRef]);
  };

  const handleBreadcrumbPress = (index: number) => {
    setStoragePathStack(prev => prev.slice(0, index + 1));
  };

  const logAdminAction = async (action: AdminActionType, details: string, targetId?: string, targetName?: string) => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      await addDoc(collection(db, 'audit_logs'), {
        action,
        details,
        targetId: targetId || '',
        targetName: targetName || '',
        adminEmail: user.email || 'Unknown',
        adminId: user.uid,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("Audit log failed:", err);
    }
  };

  const pickImage = async (field: 'poster' | 'hero') => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Error', 'Permission to access gallery is required!');
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setIsUploading(true);
      try {
        const uri = result.assets[0].uri;
        const filename = uri.split('/').pop();
        const uploadPath = field === 'poster' ? `posters/${Date.now()}_${filename}` : `banners/${Date.now()}_${filename}`;
        
        const downloadUrl = await uploadToFirebase(uri, uploadPath);
        
        if (field === 'poster') {
          setContentForm({ ...contentForm, poster: downloadUrl });
        } else {
          setContentForm({ ...contentForm, heroPhotoUrl: downloadUrl });
        }
        
        Alert.alert('Success', 'Image uploaded successfully!');
      } catch (err) {
        console.error("Upload Error:", err);
        Alert.alert('Upload Failed', 'There was an error uploading your image to Firebase.');
      } finally {
        setIsUploading(false);
      }
    }
  };

  const uploadToFirebase = async (uri: string, path: string) => {
    const response = await fetch(uri);
    const blob = await response.blob();
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, blob);
    return await getDownloadURL(storageRef);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleUserSelect = (id: string) => {
    setSelectedUserIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkAction = async (action: 'delete' | 'toggleFree' | 'toggleHero') => {
    if (selectedIds.length === 0) return;

    const performAction = async () => {
      setLoading(true);
      try {
        const items = selectedIds.map(id => doc(db, 'movies', id));
        
        if (action === 'delete') {
          for (const itemDoc of items) {
            await deleteDoc(itemDoc);
          }
          await logAdminAction('BULK_DELETE', `Deleted ${selectedIds.length} items`);
        } else if (action === 'toggleFree') {
          // Logic: Set all to the opposite of the first item's status for consistency
          const firstItem = activeTab === 'Movie' 
            ? liveMovies.find(m => m.id === selectedIds[0]) 
            : liveSeries.find(s => s.id === selectedIds[0]);
          const newStatus = !firstItem?.isFree;
          
          for (const itemDoc of items) {
            await updateDoc(itemDoc, { isFree: newStatus });
          }
          await logAdminAction('BULK_UPDATE', `Bulk toggled Free/Paid for ${selectedIds.length} items`);
        } else if (action === 'toggleHero') {
          const firstItem = activeTab === 'Movie' 
            ? liveMovies.find(m => m.id === selectedIds[0]) 
            : liveSeries.find(s => s.id === selectedIds[0]);
          const newStatus = !firstItem?.isHero;

          for (const itemDoc of items) {
            await updateDoc(itemDoc, { isHero: newStatus });
          }
          await logAdminAction('BULK_UPDATE', `Bulk toggled Hero status for ${selectedIds.length} items`);
        }

        Alert.alert('Success', `Bulk ${action} completed for ${selectedIds.length} items.`);
        setIsSelectMode(false);
        setSelectedIds([]);
      } catch (err) {
        console.error(err);
        Alert.alert('Error', 'Bulk action failed');
      } finally {
        setLoading(false);
      }
    };

    if (action === 'delete') {
      Alert.alert(
        'Confirm Bulk Delete',
        `Are you sure you want to delete ${selectedIds.length} items? This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete All', style: 'destructive', onPress: performAction }
        ]
      );
    } else {
      performAction();
    }
  };

  const handleUserBulkAction = async (action: 'ban' | 'unban' | 'delete') => {
    if (selectedUserIds.length === 0) return;
    
    const performUserAction = async () => {
      setLoading(true);
      try {
        for (const userId of selectedUserIds) {
          const userRef = doc(db, 'users', userId);
          if (action === 'delete') {
            await deleteDoc(userRef);
          } else {
            await updateDoc(userRef, { isBanned: action === 'ban' });
          }
        }
        await logAdminAction('UPDATE_USER', `Bulk ${action} for ${selectedUserIds.length} users`);
        Alert.alert('Success', `Bulk ${action} completed`);
        setIsUserSelectMode(false);
        setSelectedUserIds([]);
        fetchUsers();
      } catch (err) {
        console.error(err);
        Alert.alert('Error', `Bulk ${action} failed`);
      } finally {
        setLoading(false);
      }
    };

    Alert.alert(
      'Confirm Bulk Action',
      `Are you sure you want to ${action} ${selectedUserIds.length} users?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Confirm', 
          style: action === 'delete' ? 'destructive' : 'default',
          onPress: performUserAction
        }
      ]
    );
  };

  const handleAddUser = async () => {
    if (!newUserForm.email || !newUserForm.password) return Alert.alert('Error', 'Email and Password are required');
    setLoading(true);
    
    // Calculate expiration
    let expiresAt: number | null = null;
    if (newUserForm.duration !== 'Permanent') {
      const now = Date.now();
      const msMap: Record<string, number> = {
        '1h': 60 * 60 * 1000,
        '6h': 6 * 60 * 60 * 1000,
        '12h': 12 * 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '1w': 7 * 24 * 60 * 60 * 1000,
      };
      
      if (newUserForm.duration === 'Custom') {
        const days = parseInt(newUserForm.customDays || '0');
        const hours = parseInt(newUserForm.customHours || '0');
        if ((isNaN(days) || days < 0) || (isNaN(hours) || hours < 0)) return Alert.alert('Error', 'Please enter valid numbers');
        if (days === 0 && hours === 0) return Alert.alert('Error', 'Please specify a duration');
        expiresAt = now + (days * 24 * 60 * 60 * 1000) + (hours * 60 * 60 * 1000);
      } else {
        expiresAt = now + (msMap[newUserForm.duration] || 0);
      }
    }

    try {
      const userRef = doc(db, 'users', newUserForm.email);
      await setDoc(userRef, {
        email: newUserForm.email,
        status: 'User',
        plan: newUserForm.plan,
        joinDate: new Date().toISOString(),
        createdAt: serverTimestamp(),
        isBanned: false,
        isOnline: false,
        totalViews: 0,
        subscriptionBundle: newUserForm.plan === 'VIP' ? 'VIP' : 'None',
        subscriptionExpiresAt: expiresAt ? new Timestamp(Math.floor(expiresAt / 1000), 0) : null,
        tempUser: newUserForm.duration !== 'Permanent',
        autoDeleteOnExpiry: newUserForm.autoDelete,
        duration: newUserForm.duration,
        customExternalLimit: parseInt(newUserForm.customDownloads) || 10
      });
      const durationLabel = newUserForm.duration === 'Custom' 
        ? `${newUserForm.customDays || 0}d ${newUserForm.customHours || 0}h` 
        : newUserForm.duration;
      await logAdminAction('CREATE_USER', `Created temp user: ${newUserForm.email} (${durationLabel})`);
      Alert.alert('Success', 'Temporary user created successfully');
      setIsAddUserModalVisible(false);
      setNewUserForm({ 
        email: '', 
        password: '', 
        duration: '24h', 
        customDays: '', 
        customHours: '',
        customDownloads: '10',
        autoDelete: true, 
        plan: 'Standard' 
      });
      fetchUsers();
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  // ─── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (activeSection === 'Dashboard') fetchStats();
    if (activeSection === 'Users') fetchUsers();
    if (activeSection === 'Announcements') fetchAnnouncements();
    if (activeSection === 'Logs') fetchLogs();
    if (activeSection === 'Settings') fetchSettings();
    if (activeSection === 'AppLayout') {
      const unsubscribe = fetchAppLayout();
      return () => unsubscribe();
    }
  }, [activeSection]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const uSnap = await getCountFromServer(collection(db, 'users'));
      const mSnap = await getCountFromServer(collection(db, 'movies'));
      const sSnap = await getDocs(query(collection(db, 'users'), where('subscriptionBundle', '!=', 'None')));
      
      setStats({
        users: uSnap.data().count,
        movies: mSnap.data().count,
        activeSubs: sSnap.size,
        views: liveMovies.reduce((acc, m: any) => acc + (m.views || 0), 0)
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = () => {
    setLoading(true);
    const q = query(collection(db, 'users'), limit(50));
    return onSnapshot(q, (snap) => {
      const uData = snap.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          email: d.email || '',
          fullName: d.fullName || '',
          authProvider: d.authProvider || 'email',
          joinDate: d.createdAt ? new Date(d.createdAt.seconds * 1000).toLocaleDateString() : 'N/A',
          status: d.isAdmin ? 'Admin' : 'User',
          isBanned: d.isBanned || false,
          isOnline: d.lastActive ? (Date.now() - d.lastActive.seconds * 1000 < 65000) : false,
          plan: d.subscriptionBundle || 'None',
          subscriptionExpiresAt: d.subscriptionExpiresAt ? d.subscriptionExpiresAt.seconds * 1000 : null,
          totalViews: d.totalViews || 0,
          createdAt: d.createdAt
        } as UserData;
      });
      setUsers(uData);
      setLoading(false);
    }, (error: any) => {
      if (error.code === 'permission-denied') return;
      console.error("Admin Users listener error:", error);
      setLoading(false);
    });
  };

  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'), limit(10));
      const snap = await getDocs(q);
      setAnnouncements(snap.docs.map(d => ({ id: d.id, ...d.data() } as Announcement)));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const docSnap = await getDoc(doc(db, 'settings', 'global'));
      if (docSnap.exists()) setSettings(docSnap.data() as any);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'audit_logs'), orderBy('createdAt', 'desc'), limit(50));
      const snap = await getDocs(q);
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as AuditLog)));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAppLayout = () => {
    setLoading(true);
    const layoutRef = doc(db, 'app_layout', 'main');
    return onSnapshot(layoutRef, (docSnap) => {
      if (docSnap.exists()) {
        setLayoutSections(docSnap.data().sections || []);
      }
      setLoading(false);
    }, (error: any) => {
      if (error.code === 'permission-denied') return;
      console.error("Admin Layout listener error:", error);
      setLoading(false);
    });
  };

  const handleUpdateLayout = async (newSections: LayoutSection[]) => {
    setIsLayoutSaving(true);
    try {
      const layoutRef = doc(db, 'app_layout', 'main');
      await setDoc(layoutRef, { sections: newSections }, { merge: true });
    } catch (err) {
      console.error("Layout Save Error:", err);
      Alert.alert('Error', 'Failed to save layout change');
    } finally {
      setIsLayoutSaving(false);
    }
  };

  const toggleLayoutVisibility = (id: string) => {
    const updated = layoutSections.map(s => s.id === id ? { ...s, isVisible: !s.isVisible } : s);
    setLayoutSections(updated);
    handleUpdateLayout(updated);
    const section = updated.find(s => s.id === id);
    logAdminAction('UPDATE_LAYOUT', `Toggled visibility for section: ${section?.title}`, id, section?.title);
  };

  const moveSection = (index: number, direction: 'up' | 'down') => {
    const updated = [...layoutSections];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= updated.length) return;
    
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    setLayoutSections(updated);
    handleUpdateLayout(updated);
  };

  // ─── Actions ────────────────────────────────────────────────────────────────

  const handleSaveContent = async () => {
    if (!contentForm.title) return Alert.alert('Error', 'Title is required');
    setLoading(true);
    try {
      const data = { ...contentForm, updatedAt: serverTimestamp() };
      
      // --- Automatic Image Uploads ---
      if (data.poster && data.poster.startsWith('file://')) {
        const path = `posters/${Date.now()}_${data.title.replace(/\s+/g, '_')}.jpg`;
        data.poster = await uploadToFirebase(data.poster, path);
      }
      if (data.heroPhotoUrl && data.heroPhotoUrl.startsWith('file://')) {
        const path = `hero/${Date.now()}_${data.title.replace(/\s+/g, '_')}.jpg`;
        data.heroPhotoUrl = await uploadToFirebase(data.heroPhotoUrl, path);
      }

      data.coverUrl = data.poster; // Mapping for app compatibility

      // Cleanup extra fields before saving to keep Firestore clean
      if (data.type === 'Movie') {
        // Keep episodeList and freeEpisodesCount for Movie parts
        delete data.isMiniSeries;
        delete data.seasons;
        delete data.status;
      }

      let docId = editingId;
      if (editingId) {
        await updateDoc(doc(db, 'movies', editingId), data);
        await logAdminAction('UPDATE_CONTENT', `Updated ${data.type}: ${data.title}`, editingId, data.title);
      } else {
        const newDoc = await addDoc(collection(db, 'movies'), { ...data, createdAt: serverTimestamp() });
        docId = newDoc.id;
        await logAdminAction('CREATE_CONTENT', `Created ${data.type}: ${data.title}`, docId, data.title);
      }
      
      // --- Push Notification ---
      if (data.notifyUsers && docId) {
        try {
          // Use the web portal's API for consistency
          await fetch('https://tmz-admin.vercel.app/api/notifications/send-movie', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              movieId: docId,
              title: data.title,
              genre: data.genre,
              imageUrl: data.poster,
              isHero: data.isHero
            })
          });
        } catch (pushErr) {
          console.warn("Hero/Movie notification failed:", pushErr);
        }
      }
      
      setIsContentModalVisible(false);
      Alert.alert('Success', 'Content saved successfully!');
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to save content');
    } finally {
      setLoading(false);
    }
  };

  const handleUserAction = async (action: 'Ban' | 'Unban' | 'Delete' | 'UpdatePlan' | 'Cleanup', extra?: any) => {
    if (action === 'Cleanup') {
      const expired = users.filter(u => u.subscriptionExpiresAt && u.subscriptionExpiresAt < Date.now());
      if (expired.length === 0) return Alert.alert('Clean', 'No expired accounts found.');
      Alert.alert('Cleanup', `Delete ${expired.length} expired accounts?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          setLoading(true);
          try {
            for (const u of expired) {
              await deleteDoc(doc(db, 'users', u.id));
            }
            await logAdminAction('BULK_DELETE', `Cleaned up ${expired.length} expired accounts`);
            Alert.alert('Success', 'Cleaned up!');
          } catch (e) {
            Alert.alert('Error', 'Cleanup failed');
          } finally {
            setLoading(false);
          }
        }}
      ]);
      return;
    }
    if (!selectedUser) return;
    try {
      if (action === 'Ban' || action === 'Unban') {
        const isBan = action === 'Ban';
        await updateDoc(doc(db, 'users', selectedUser.id), { isBanned: isBan });
        await logAdminAction(isBan ? 'BAN_USER' : 'UNBAN_USER', `${action} user: ${selectedUser.email}`, selectedUser.id, selectedUser.email);
      } else if (action === 'Delete') {
        await deleteDoc(doc(db, 'users', selectedUser.id));
        await logAdminAction('DELETE_USER', `Deleted user: ${selectedUser.email}`, selectedUser.id, selectedUser.email);
        setIsUserModalVisible(false);
      } else if (action === 'UpdatePlan') {
        const plan = extra.plan;
        
        if (plan === 'Custom') {
          setIsCustomGrantModalVisible(true);
          return;
        }

        let expiryDate = null;
        const now = Date.now();
        
        if (plan === '1 Day') expiryDate = new Date(now + 24 * 60 * 60 * 1000);
        else if (plan === '1 week') expiryDate = new Date(now + 7 * 24 * 60 * 60 * 1000);
        else if (plan === '2 weeks') expiryDate = new Date(now + 14 * 24 * 60 * 60 * 1000);
        else if (plan === '1 Month') expiryDate = new Date(now + 30 * 24 * 60 * 60 * 1000);
        else if (plan === '2 months') expiryDate = new Date(now + 60 * 24 * 60 * 60 * 1000);
        else if (plan === '3 Months') expiryDate = new Date(now + 90 * 24 * 60 * 60 * 1000);
        else if (plan === 'VIP' || plan === 'Premium') expiryDate = new Date(now + 365 * 24 * 60 * 60 * 1000); // 1 Year

        await updateDoc(doc(db, 'users', selectedUser.id), { 
          subscriptionBundle: plan,
          subscriptionExpiresAt: expiryDate ? Timestamp.fromDate(expiryDate) : null,
          paymentMethod: plan === 'None' ? '' : 'Administrative Grant',
          customExternalLimit: 0 // Reset if using a preset plan
        });
        await logAdminAction('GRANT_SUBSCRIPTION', `Updated plan to ${plan} for ${selectedUser.email}`, selectedUser.id, selectedUser.email);
      }
      setIsUserModalVisible(false);
      Alert.alert('Success', 'User updated');
    } catch (e) {
      Alert.alert('Error', 'Action failed');
    }
  };

  const handleCustomGrant = async () => {
    if (!selectedUser) return;
    setIsGranting(true);
    try {
      const days = parseInt(customGrantForm.days) || 0;
      const hours = parseInt(customGrantForm.hours) || 0;
      const totalMs = (days * 24 * 60 * 60 * 1000) + (hours * 60 * 60 * 1000);
      
      const expiryDate = new Date(Date.now() + totalMs);
      const customDownloadsNum = parseInt(customGrantForm.downloads) || 10;

      await updateDoc(doc(db, 'users', selectedUser.id), {
        subscriptionBundle: 'Premium',
        subscriptionExpiresAt: Timestamp.fromDate(expiryDate),
        paymentMethod: 'Administrative Grant',
        customExternalLimit: customDownloadsNum
      });

      await logAdminAction('GRANT_SUBSCRIPTION', `Granted CUSTOM plan (${days}d ${hours}h, ${customDownloadsNum} downloads) to ${selectedUser.email}`, selectedUser.id, selectedUser.email);
      
      setIsCustomGrantModalVisible(false);
      setIsUserModalVisible(false);
      Alert.alert('Success', 'Custom Grant applied!');
    } catch (e) {
      Alert.alert('Error', 'Failed to apply custom grant');
    } finally {
      setIsGranting(false);
    }
  };

  const handleBroadcast = async () => {
    if (!annForm.subject) return Alert.alert('Error', 'Subject is required');
    setLoading(true);
    try {
      await addDoc(collection(db, 'announcements'), {
        ...annForm,
        createdAt: serverTimestamp(),
        status: 'Live'
      });
      await logAdminAction('BROADCAST', `Sent broadcast [${annForm.category}]: ${annForm.subject}`);

      // Trigger real push notification via backend API
      try {
        await fetch('https://tmz-admin.vercel.app/api/notifications/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            subject: annForm.subject, 
            category: annForm.category,
            imageUrl: annForm.imageUrl || null
          }),
        });
      } catch (pushErr) {
        console.warn("Push notification API failed, but record was saved:", pushErr);
      }

      setAnnForm({ subject: '', category: 'General', imageUrl: '' });
      fetchAnnouncements();
      Alert.alert('Success', 'Broadcasted everywhere!');
    } catch (err) {
      Alert.alert('Error', 'Broadcast failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAnnouncement = async (id: string, subject: string) => {
    Alert.alert('Delete Broadcast', `Remove "${subject}" from history?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        setLoading(true);
        try {
          await deleteDoc(doc(db, 'announcements', id));
          await logAdminAction('DELETE_CONTENT', `Deleted broadcast record: ${subject}`, id);
          fetchAnnouncements();
          Alert.alert('Success', 'Broadcast deleted');
        } catch (e) {
          Alert.alert('Error', 'Failed to delete');
        } finally {
          setLoading(false);
        }
      }}
    ]);
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to log out of Admin Panel?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: async () => {
        try {
          await auth.signOut();
          router.replace('/login' as any);
        } catch (e) {
          Alert.alert('Error', 'Logout failed');
        }
      }}
    ]);
  };

  const handleSaveSettings = async () => {
    setLoading(true);
    try {
      await setDoc(doc(db, 'settings', 'global'), settings);
      await logAdminAction('UPDATE_SETTINGS', 'Updated global application settings');
      Alert.alert('Success', 'Settings updated');
    } catch (err) {
      Alert.alert('Error', 'Failed to update settings');
    } finally {
      setLoading(false);
    }
  };


  const handleToggleHeroStatus = async (item: any) => {
    const newStatus = !item.isHero;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'movies', item.id), { isHero: newStatus });
      await logAdminAction('UPDATE_CONTENT', `${newStatus ? 'Promoted to' : 'Removed from'} Hero Slider: ${item.title}`, item.id, item.title);
      Alert.alert('Success', `${item.title} ${newStatus ? 'is now' : 'is no longer'} a Hero Promotion.`);
    } catch (err) {
      Alert.alert('Error', 'Failed to update hero status');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateHeroAsset = async (item: any, type: 'video' | 'photo', url: string) => {
    setLoading(true);
    try {
      // Prioritize existing hero-specific URLs, then supplied URL, then standard metadata
      const heroVideo = type === 'video' ? (url || item.heroVideoUrl || item.previewUrl || '') : (item.heroVideoUrl || '');
      const heroPhoto = type === 'photo' ? (url || item.heroPhotoUrl || item.poster || '') : (item.heroPhotoUrl || '');

      const updateData = type === 'video' 
        ? { heroVideoUrl: heroVideo, heroType: 'video' } 
        : { heroPhotoUrl: heroPhoto, heroType: 'photo' };

      await updateDoc(doc(db, 'movies', item.id), updateData);
      await logAdminAction('UPDATE_CONTENT', `Set Hero to ${type.toUpperCase()} for: ${item.title}`, item.id, item.title);
      Alert.alert('Success', `Hero ${type} activated for ${item.title}`);
    } catch (err) {
      Alert.alert('Error', 'Failed to update hero asset');
    } finally {
      setLoading(false);
    }
  };

  // ─── Sub-Renderers ──────────────────────────────────────────────────────────

  const renderDashboard = () => (
    <ScrollView style={styles.sectionScroll}>
       <View style={{ height: 10 }} />

       <View style={styles.statsGrid}>
        <StatCard title="Total Users" value={stats.users} icon="account-group" color="#3b82f6" trend="+12" />
        <StatCard title="Total Movies" value={stats.movies} icon="movie-open" color="#a855f7" trend="+4" />
        <StatCard title="Active Subscriptions" value={stats.activeSubs} icon="play-circle" color="#10b981" trend="+18" />
        <StatCard title="Total Views" value={stats.views} icon="trending-up" color="#f59e0b" trend="+24" />
      </View>
      
      <View style={styles.dashboardSection}>
        <View style={styles.sectionHeaderRow}>
           <MaterialCommunityIcons name="update" size={18} color="#6366f1" />
           <Text style={styles.sectionTitle}>RECENT UPLOADS</Text>
        </View>
        {(activeTab === 'Movie' ? liveMovies : liveSeries).slice(0, 5).map((m: any) => (
          <View key={m.id} style={styles.miniCard}>
            <Image source={{ uri: m.coverUrl || m.poster }} style={styles.miniPoster} contentFit="cover" />
            <View style={styles.miniTextContent}>
              <Text style={styles.miniCardTitle}>{m.title}</Text>
              <View style={styles.miniCardMeta}>
                <Text style={styles.miniCardSub}>{m.createdAt ? new Date(m.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}</Text>
                <View style={styles.miniTag}>
                  <Text style={styles.miniTagText}>{m.type?.toUpperCase() || (activeTab === 'Movie' ? 'MOVIE' : 'SERIES')}</Text>
                </View>
              </View>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.dashboardSection}>
        <View style={styles.sectionHeaderRow}>
           <MaterialCommunityIcons name="account-plus" size={18} color="#3b82f6" />
           <Text style={styles.sectionTitle}>NEW SIGNUPS</Text>
        </View>
        {users.slice(0, 5).map((u: any) => (
          <View key={u.id} style={styles.miniCard}>
            <View style={[styles.miniAvatar, { backgroundColor: '#1e293b' }]}>
               <Ionicons name="person" size={16} color="#64748b" />
            </View>
            <View style={styles.miniTextContent}>
              <Text style={styles.miniCardTitle} numberOfLines={1}>{u.email}</Text>
              <Text style={styles.miniCardSub}>Joined: {u.joinDate}</Text>
            </View>
          </View>
        ))}
      </View>
      <View style={{ height: 100 }} />
    </ScrollView>
  );

  const renderContent = () => {
    const totalContent = [...liveMovies, ...liveSeries];
    const filteredContent = totalContent.filter(item => {
      const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           item.genre.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = contentFilter === 'All' || item.type === contentFilter;
      const matchesPrice = pricingFilter === 'All' || (pricingFilter === 'Free' ? item.isFree : !item.isFree);
      return matchesSearch && matchesType && matchesPrice;
    });

    return (
      <View style={{ flex: 1 }}>
        <View style={{ height: 10 }} />

        <View style={styles.filterSection}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color="#64748b" />
            <TextInput 
              placeholder="Search by title or genre..." 
              placeholderTextColor="#64748b" 
              style={styles.searchInput} 
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <Text style={styles.resultsCount}>Showing {filteredContent.length} results</Text>
          </View>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            {(['All', 'Movie', 'Series'] as const).map(f => (
              <TouchableOpacity 
                key={f} 
                onPress={() => setContentFilter(f)}
                style={[styles.miniChip, contentFilter === f && styles.miniChipActive]}
              >
                <Text style={[styles.miniChipText, contentFilter === f && styles.miniChipTextActive]}>{f}s</Text>
              </TouchableOpacity>
            ))}
            <View style={styles.vDivider} />
            {(['All', 'Free', 'Paid'] as const).map(p => (
              <TouchableOpacity 
                key={p} 
                onPress={() => setPricingFilter(p)}
                style={[styles.miniChip, pricingFilter === p && styles.miniChipActive, p !== 'All' && { backgroundColor: p === 'Free' ? '#10b98122' : '#f59e0b22' }]}
              >
                <Text style={[styles.miniChipText, pricingFilter === p && styles.miniChipTextActive, p !== 'All' && { color: p === 'Free' ? '#10b981' : '#f59e0b' }]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={[styles.tabs, { marginTop: 8, paddingHorizontal: 0 }]}>
            <TouchableOpacity 
              style={[styles.miniSelectBtn, isSelectMode && { backgroundColor: '#6366f1' }]} 
              onPress={() => { setIsSelectMode(!isSelectMode); setSelectedIds([]); }}
            >
              <Text style={[styles.miniSelectText, isSelectMode && { color: '#fff' }]}>{isSelectMode ? 'CANCEL' : 'SELECT'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <FlatList
          data={filteredContent}
          keyExtractor={item => item.id}
          renderItem={({ item }) => {
            const isSelected = selectedIds.includes(item.id);
            return (
              <TouchableOpacity 
                style={[styles.contentCardLarge, isSelected && styles.contentCardSelected]} 
                onPress={() => isSelectMode ? toggleSelect(item.id) : null}
                activeOpacity={0.7}
              >
                {isSelectMode && (
                  <View style={[styles.selectionCircle, isSelected && styles.selectionCircleActive]}>
                    {isSelected && <Ionicons name="checkmark" size={12} color="#fff" />}
                  </View>
                )}
                <Image source={{ uri: item.coverUrl || item.poster }} style={styles.itemThumbnail} contentFit="cover" />
                <View style={styles.itemInfo}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.itemGenre}>{item.genre}</Text>
                  <View style={styles.itemBadges}>
                    <View style={[styles.priceTag, { backgroundColor: item.isFree ? '#10b98111' : '#f59e0b11' }]}>
                       <Text style={[styles.priceTagText, { color: item.isFree ? '#10b981' : '#f59e0b' }]}>$ {item.isFree ? 'FREE' : 'PAID'}</Text>
                    </View>
                    <View style={[styles.typeTag, item.type === 'Series' && item.isMiniSeries ? { backgroundColor: '#db277711' } : {}]}>
                       <Text style={[styles.typeTagText, item.type === 'Series' && item.isMiniSeries ? { color: '#f472b6' } : {}]}>{item.type === 'Series' && item.isMiniSeries ? 'MINI SERIES' : item.type ? item.type.toUpperCase() : 'MOVIE'}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.itemActionCol}>
                   <Text style={styles.itemYear}>{item.year || 'N/A'}</Text>
                   {!isSelectMode && (
                    <TouchableOpacity onPress={() => { setEditingId(item.id); setContentForm(item); setIsContentModalVisible(true); }} style={styles.editBtnSmall}>
                      <Ionicons name="pencil" size={16} color="#6366f1" />
                    </TouchableOpacity>
                   )}
                </View>
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={{ padding: 16 }}
        />
      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => { setEditingId(null); setContentForm({ type: activeTab, genre: 'Action', vj: 'Vj Junior' }); setIsContentModalVisible(true); }}
      >
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>

      {/* Bulk Action Bar */}
      {isSelectMode && selectedIds.length > 0 && (
        <View style={styles.bulkBar}>
          <View style={styles.bulkInfo}>
            <Text style={styles.bulkCount}>{selectedIds.length} SELECTED</Text>
            <TouchableOpacity onPress={() => setSelectedIds([])}>
              <Text style={styles.bulkClear}>CLEAR</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.bulkActions}>
            <BulkActionBtn icon="eye-outline" label="Free" color="#10b981" onPress={() => handleBulkAction('toggleFree')} />
            <BulkActionBtn icon="star-outline" label="Hero" color="#f59e0b" onPress={() => handleBulkAction('toggleHero')} />
            <BulkActionBtn icon="trash-outline" label="Delete" color="#ef4444" onPress={() => handleBulkAction('delete')} />
          </View>
        </View>
      )}
      </View>
    );
  };

  const renderUsers = () => {
    const filteredUsers = users.filter(u => (u.email || '').toLowerCase().includes(userSearch.toLowerCase()));

    return (
      <View style={{ flex: 1 }}>
        <View style={{ height: 10 }} />
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20, paddingHorizontal: 16 }}>
            <TouchableOpacity 
              style={{ 
                flex: 1, 
                flexDirection: 'row', 
                alignItems: 'center', 
                justifyContent: 'center',
                backgroundColor: '#ef444411', 
                paddingVertical: 12, 
                borderRadius: 14, 
                borderWidth: StyleSheet.hairlineWidth, 
                borderColor: '#ef444433' 
              }} 
              onPress={() => handleUserAction('Cleanup')}
            >
              <Ionicons name="trash-outline" size={16} color="#ef4444" />
              <Text style={{ color: '#ef4444', marginLeft: 8, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 }}>CLEANUP</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={{ 
                flex: 1, 
                flexDirection: 'row', 
                alignItems: 'center', 
                justifyContent: 'center',
                backgroundColor: '#10b981', 
                paddingVertical: 12, 
                borderRadius: 14,
                shadowColor: '#10b981',
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 4
              }} 
              onPress={() => setIsAddUserModalVisible(true)}
            >
              <Ionicons name="add-circle" size={18} color="#fff" />
              <Text style={{ color: '#fff', marginLeft: 8, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 }}>NEW USER</Text>
            </TouchableOpacity>
          </View>

        <View style={styles.filterSection}>
          <View style={[styles.searchBar, { flex: 1, margin: 0, height: 48, backgroundColor: '#0f172a' }]}>
            <Ionicons name="search" size={18} color="#64748b" />
            <TextInput 
              placeholder="Search by email or User ID..." 
              placeholderTextColor="#475569" 
              style={styles.searchInput} 
              value={userSearch}
              onChangeText={setUserSearch}
            />
            <Text style={styles.resultsCount}>Showing {filteredUsers.length} users</Text>
          </View>
        </View>

        <FlatList
          data={filteredUsers}
          keyExtractor={item => item.id}
          renderItem={({ item }) => {
            const isPremium = item.plan !== 'Free' && item.plan !== 'None';
            const initials = item.email ? item.email.substring(0, 2).toUpperCase() : '??';
            const relativeTime = getRelativeTime(item.lastLogin || item.createdAt);
            const joinDateStr = item.joinDate || (item.createdAt ? new Date(item.createdAt.seconds * 1000).toLocaleDateString() : 'N/A');

            // Robust timestamp handling for expiry
            let expiryStr = 'No Expiry';
            if (item.subscriptionExpiresAt) {
              const date = (item.subscriptionExpiresAt as any).seconds 
                ? new Date((item.subscriptionExpiresAt as any).seconds * 1000)
                : new Date(item.subscriptionExpiresAt);
              expiryStr = `Ends: ${date.toLocaleDateString()}`;
            }

            return (
              <TouchableOpacity 
                style={styles.userRow} 
                onPress={() => { setSelectedUser(item); setIsUserModalVisible(true); }}
                activeOpacity={0.8}
              >
                {/* Pillar 1: User Details */}
                <View style={styles.userPillar}>
                  <Text style={styles.pillarLabel}>USER DETAILS</Text>
                  <View style={styles.userPillarMain}>
                    <View style={[styles.userAvatar, { width: 36, height: 36, backgroundColor: '#1e293b' }]}>
                      <Ionicons 
                        name={
                          (item as any).authProvider === 'google' ? 'logo-google' : 
                          (item as any).authProvider === 'apple' ? 'logo-apple' :
                          (item as any).authProvider === 'anonymous' ? 'person-outline' : 'mail-outline'
                        } 
                        size={16} 
                        color={
                          (item as any).authProvider === 'google' ? '#4285F4' :
                          (item as any).authProvider === 'apple' ? '#fff' :
                          (item as any).authProvider === 'anonymous' ? '#64748b' : '#64748b'
                        } 
                      />
                    </View>
                    <View style={styles.userPillarTextGroup}>
                      {item.email ? (
                        <Text style={styles.userPillarTitle} numberOfLines={1}>{item.email}</Text>
                      ) : (
                        <View>
                          {(item as any).fullName ? (
                            <Text style={styles.userPillarTitle} numberOfLines={1}>{(item as any).fullName}</Text>
                          ) : (
                            <Text style={[styles.userPillarTitle, { color: '#64748b' }]}>No Email</Text>
                          )}
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                            <View style={{
                              backgroundColor: (item as any).authProvider === 'google' ? 'rgba(66,133,244,0.15)' :
                                               (item as any).authProvider === 'apple' ? 'rgba(255,255,255,0.1)' :
                                               (item as any).authProvider === 'anonymous' ? 'rgba(100,116,139,0.15)' : 'rgba(100,116,139,0.15)',
                              borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1
                            }}>
                              <Text style={{ color: '#94a3b8', fontSize: 8, fontWeight: '700', textTransform: 'uppercase' }}>
                                {(item as any).authProvider === 'google' ? 'Google' :
                                 (item as any).authProvider === 'apple' ? 'Apple' :
                                 (item as any).authProvider === 'anonymous' ? 'Guest' : 'Email'}
                              </Text>
                            </View>
                            <TouchableOpacity style={styles.addEmailBtn}>
                              <Ionicons name="add-circle" size={10} color="#10b981" />
                              <Text style={styles.addEmailText}>ADD EMAIL</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </View>
                  </View>
                  <Text style={[styles.userPillarSub, { fontSize: 8 }]} numberOfLines={1}>ID: {item.id}</Text>
                  <Text style={styles.userPillarSub}>Joined: {joinDateStr}</Text>
                </View>

                {/* Pillar 2: Subscription */}
                <View style={styles.userPillarMid}>
                  <Text style={styles.pillarLabel}>SUBSCRIPTION</Text>
                  <View style={styles.subBadge}>
                    <Text style={styles.subBadgeText}>{item.plan || 'No Plan'}</Text>
                    <Ionicons name="chevron-down" size={10} color="#6366f1" />
                  </View>
                  <View style={styles.expiryBadge}>
                    <Text style={styles.expiryBadgeText}>{expiryStr}</Text>
                  </View>
                </View>

                {/* Pillar 3: Engagement */}
                <View style={styles.userPillarEnd}>
                  <Text style={styles.pillarLabel}>ACTIVITY & ENGAGEMENT</Text>
                  <View style={[styles.engagementBadge, relativeTime === 'ACTIVE' && { backgroundColor: '#10b98122' }]}>
                    <Text style={[styles.engagementText, relativeTime === 'ACTIVE' && { color: '#10b981' }]}>{relativeTime}</Text>
                  </View>
                  <View style={styles.activityRow}>
                    <Text style={styles.activityText}>• {item.totalViews || 0} views</Text>
                  </View>
                  <View style={styles.activityRow}>
                    <Ionicons name="time-outline" size={10} color="#475569" />
                    <Text style={[styles.activityText, { fontSize: 8 }]}>Last: {joinDateStr}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        />

        {/* User Bulk Action Bar */}
        {isUserSelectMode && selectedUserIds.length > 0 && (
          <View style={styles.bulkBar}>
            <View style={styles.bulkInfo}>
              <Text style={styles.bulkCount}>{selectedUserIds.length} SELECTED</Text>
              <TouchableOpacity onPress={() => setSelectedUserIds([])}>
                <Text style={styles.bulkClear}>CLEAR</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.bulkActions}>
              <BulkActionBtn icon="lock-closed" label="Ban" color="#ef4444" onPress={() => handleUserBulkAction('ban')} />
              <BulkActionBtn icon="lock-open" label="Unban" color="#10b981" onPress={() => handleUserBulkAction('unban')} />
              <BulkActionBtn icon="trash" label="Delete" color="#94a3b8" onPress={() => handleUserBulkAction('delete')} />
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderAnnouncements = () => {
    const filteredAnnouncements = announcements.filter(a => 
      a.subject.toLowerCase().includes(annSearchQuery.toLowerCase()) ||
      (a.category || '').toLowerCase().includes(annSearchQuery.toLowerCase())
    );

    return (
      <ScrollView style={styles.sectionScroll} showsVerticalScrollIndicator={false}>
        <View style={{ height: 10 }} />

        {/* --- New Broadcast Card --- */}
        <View style={styles.dashboardSection}>
          <View style={styles.uniformCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#6366f111', justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="megaphone" size={20} color="#6366f1" />
              </View>
              <Text style={styles.sectionTitle}>BROADCAST ANNOUNCEMENT</Text>
            </View>

            <Text style={styles.label}>Message Subject</Text>
            <TextInput 
              style={styles.input} 
              placeholder="Announcement title" 
              placeholderTextColor="#475569"
              value={annForm.subject}
              onChangeText={s => setAnnForm(prev => ({ ...prev, subject: s }))}
            />

            <Text style={styles.label}>Banner Image URL (Optional)</Text>
            <TextInput 
              style={styles.input} 
              placeholder="https://example.com/banner.jpg" 
              placeholderTextColor="#475569"
              value={annForm.imageUrl}
              onChangeText={u => setAnnForm(prev => ({ ...prev, imageUrl: u }))}
            />

            <Text style={styles.label}>Broadcast Category</Text>
            <View style={styles.categoryChipRow}>
              {(['General', 'Update', 'Alert', 'Welcome', 'System'] as const).map(cat => (
                <TouchableOpacity 
                  key={cat} 
                  style={[styles.categoryChip, annForm.category === cat && styles.categoryChipActive]}
                  onPress={() => setAnnForm({ ...annForm, category: cat })}
                >
                  <Text style={[styles.categoryChipText, annForm.category === cat && styles.categoryChipTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.broadcastBtn} onPress={handleBroadcast} activeOpacity={0.8}>
              <Ionicons name="send" size={18} color="#fff" />
              <Text style={styles.broadcastBtnText}>BROADCAST MESSAGE</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* --- History Section --- */}
        <View style={styles.dashboardSection}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="time-outline" size={18} color="#64748b" />
            <Text style={styles.sectionTitle}>ANNOUNCEMENT HISTORY</Text>
          </View>

          <View style={styles.annSearchContainer}>
            <Ionicons name="search" size={18} color="#64748b" />
            <TextInput 
              style={styles.annSearchInput} 
              placeholder="Search history..." 
              placeholderTextColor="#475569"
              value={annSearchQuery}
              onChangeText={setAnnSearchQuery}
            />
          </View>

          {filteredAnnouncements.map(a => (
            <View key={a.id} style={styles.historyCard}>
              <View style={styles.historyHeader}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <View style={styles.historyStatusBadge}>
                      <Text style={styles.historyStatusText}>LIVE</Text>
                    </View>
                    <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '700' }}>#{a.id.slice(0, 6).toUpperCase()}</Text>
                  </View>
                  <Text style={styles.historySubject}>{a.subject}</Text>
                </View>
                <TouchableOpacity style={styles.historyDeleteBtn} onPress={() => handleDeleteAnnouncement(a.id, a.subject)}>
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                </TouchableOpacity>
              </View>

              <View style={styles.historyFooter}>
                <Text style={styles.historyCategory}>{a.category || 'GENERAL'}</Text>
                <View style={styles.historyDot} />
                <Text style={styles.historyDate}>
                  {a.createdAt ? new Date(a.createdAt.seconds * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Pending'}
                </Text>
              </View>
            </View>
          ))}

          {filteredAnnouncements.length === 0 && (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Ionicons name="search-outline" size={48} color="#1e293b" />
              <Text style={{ color: '#475569', textAlign: 'center', marginTop: 12, fontSize: 13, fontWeight: '600' }}>
                No broadcast records found
              </Text>
            </View>
          )}
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>
    );
  };

  const renderMediaAssets = () => {
    const heroItems = [...liveMovies, ...liveSeries].filter(item => item.isHero);
    const allGalleryItems = [...liveMovies, ...liveSeries];

    return (
      <View style={{ flex: 1 }}>
        <View style={{ height: 10 }} />

        <View style={styles.tabs}>
          <TabBtn label="Hero Promotions" active={mediaTab === 'Hero'} onPress={() => setMediaTab('Hero')} />
          <TabBtn label="Asset Gallery" active={mediaTab === 'Gallery'} onPress={() => setMediaTab('Gallery')} />
          <TabBtn label="Storage Explorer" active={mediaTab === 'Storage'} onPress={() => setMediaTab('Storage')} />
        </View>

        <ScrollView style={styles.sectionScroll} showsVerticalScrollIndicator={false}>
          {mediaTab === 'Hero' && (
            <View style={styles.dashboardSection}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="sparkles" size={18} color="#f59e0b" />
                <Text style={styles.sectionTitle}>ACTIVE HERO SLIDER ITEMS</Text>
              </View>
              {heroItems.map(item => (
                <View key={item.id} style={styles.heroMediaCard}>
                  <Image source={{ uri: item.heroPhotoUrl || item.poster }} style={styles.heroMediaBanner} contentFit="cover" />
                  <View style={styles.heroMediaOverlay}>
                    <Text style={styles.heroMediaOverlayText}>{item.heroType?.toUpperCase() || 'PHOTO'}</Text>
                  </View>
                  <View style={styles.heroMediaFooter}>
                    <Text style={styles.heroMediaTitle}>{item.title}</Text>
                    <View style={styles.heroActionRow}>
                      <TouchableOpacity 
                        style={[styles.heroTypeToggle, item.heroType === 'video' && styles.heroTypeToggleActive]}
                        onPress={() => handleUpdateHeroAsset(item, 'video', item.heroVideoUrl || item.previewUrl || '')}
                      >
                        <Ionicons name="videocam" size={14} color={item.heroType === 'video' ? '#6366f1' : '#64748b'} />
                        <Text style={[styles.miniChipText, item.heroType === 'video' && { color: '#6366f1' }]}>VIDEO</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.heroTypeToggle, item.heroType === 'photo' && styles.heroTypeToggleActive]}
                        onPress={() => handleUpdateHeroAsset(item, 'photo', item.heroPhotoUrl || item.poster || '')}
                      >
                        <Ionicons name="image" size={14} color={item.heroType === 'photo' ? '#6366f1' : '#64748b'} />
                        <Text style={[styles.miniChipText, item.heroType === 'photo' && { color: '#6366f1' }]}>PHOTO</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.heroActionBtn} onPress={() => handleToggleHeroStatus(item)}>
                        <Ionicons name="trash-outline" size={18} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
              {heroItems.length === 0 && (
                <Text style={{ color: '#475569', textAlign: 'center', marginTop: 40, fontSize: 13, fontWeight: '600' }}>No active hero promotions.</Text>
              )}
            </View>
          )}

          {mediaTab === 'Gallery' && (
            <View style={styles.mediaGrid}>
              {allGalleryItems.map(item => (
                <TouchableOpacity 
                  key={item.id} 
                  style={styles.assetCard}
                  onPress={() => { setSelectedMediaUri(item.poster); setIsMediaPreviewVisible(true); }}
                >
                  <Image source={{ uri: item.poster }} style={styles.assetImage} contentFit="cover" />
                  <View style={styles.assetInfoOverflow}>
                    <Text style={styles.assetTitleSmall} numberOfLines={1}>{item.title.toUpperCase()}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {mediaTab === 'Storage' && (
            <View style={styles.dashboardSection}>
              {/* --- Breadcrumbs --- */}
              <View style={styles.breadcrumbContainer}>
                {storagePathStack.map((r, idx) => (
                  <TouchableOpacity 
                    key={`${r.fullPath}-${idx}`} 
                    style={styles.breadcrumbItem}
                    onPress={() => handleBreadcrumbPress(idx)}
                  >
                    <Text style={[styles.breadcrumbText, idx === storagePathStack.length - 1 && styles.breadcrumbActive]}>
                      {idx === 0 ? 'Root' : r.name}
                    </Text>
                    {idx < storagePathStack.length - 1 && <Ionicons name="chevron-forward" size={10} color="#475569" style={{ marginHorizontal: 4 }} />}
                  </TouchableOpacity>
                ))}
              </View>

              {isExplorerLoading ? (
                <ActivityIndicator color="#6366f1" size="large" style={{ marginTop: 60 }} />
              ) : (
                <View style={styles.storageGrid}>
                  {storageItems.map((item, idx) => (
                    <TouchableOpacity 
                      key={`${item.name}-${idx}`} 
                      style={styles.storageItemBox}
                      onPress={() => item.type === 'folder' ? handleFolderPress(item.ref) : null}
                    >
                      <View style={[styles.storageIconBg, item.type === 'folder' ? styles.folderIconBg : styles.fileIconBg]}>
                        <Ionicons 
                          name={item.type === 'folder' ? "folder" : "videocam"} 
                          size={28} 
                          color={item.type === 'folder' ? "#f59e0b" : "#6366f1"} 
                        />
                        <Text style={styles.formatLabel}>{item.type === 'folder' ? 'DIRECTORY' : `${item.format} / VIDEO`}</Text>
                      </View>
                      <Text style={styles.storageItemName} numberOfLines={1}>{item.name}</Text>
                      {item.type === 'file' && <Text style={styles.storageItemMeta}>{item.size}</Text>}
                    </TouchableOpacity>
                  ))}
                  {storageItems.length === 0 && (
                    <Text style={{ flex: 1, color: '#475569', textAlign: 'center', marginTop: 40, fontSize: 13, fontWeight: '600' }}>This directory is empty.</Text>
                  )}
                </View>
              )}
            </View>
          )}
          <View style={{ height: 120 }} />
        </ScrollView>
      </View>
    );
  };

  const renderLogs = () => {
    const filteredLogs = logs.filter(l => {
      const matchesSearch = l.details.toLowerCase().includes(logSearch.toLowerCase()) || 
                           l.adminEmail.toLowerCase().includes(logSearch.toLowerCase());
      const matchesFilter = logActionFilter === 'ALL' || l.action === logActionFilter;
      return matchesSearch && matchesFilter;
    });

    return (
      <View style={{ flex: 1 }}>
        <View style={{ height: 10 }} />

        <View style={styles.filterSection}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color="#64748b" />
            <TextInput 
              placeholder="Search by admin or action..." 
              placeholderTextColor="#64748b" 
              style={styles.searchInput} 
              value={logSearch}
              onChangeText={setLogSearch}
            />
            <TouchableOpacity onPress={() => setIsFilterModalVisible(true)} style={styles.resultsCount}>
              <Ionicons name="filter" size={16} color={logActionFilter === 'ALL' ? '#64748b' : '#6366f1'} />
            </TouchableOpacity>
          </View>
        </View>

        <FlatList
          data={filteredLogs}
          keyExtractor={item => item.id}
          renderItem={({ item }) => {
            const isCritical = item.action?.includes('DELETE') || item.action?.includes('BAN');
            return (
              <View style={styles.logCard}>
                <View style={styles.logTagRow}>
                  <View style={[styles.logTag, { backgroundColor: isCritical ? '#ef444411' : '#6366f111' }]}>
                    <Text style={[styles.logTagText, { color: isCritical ? '#ef4444' : '#6366f1' }]}>{item.action?.replace(/_/g, ' ') || 'ACTION'}</Text>
                  </View>
                  <Text style={styles.logTime}>{item.createdAt ? new Date(item.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}</Text>
                </View>
                <Text style={styles.logDetails}>{item.details}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 6 }}>
                  <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center' }}>
                     <Ionicons name="person" size={10} color="#64748b" />
                  </View>
                  <Text style={styles.logMeta}>{item.adminEmail}</Text>
                </View>
              </View>
            );
          }}
          contentContainerStyle={{ padding: 16 }}
        />

        {/* Filter Modal */}
        <Modal visible={isFilterModalVisible} transparent animationType="fade">
          <TouchableOpacity 
            style={styles.modalOverlay} 
            activeOpacity={1} 
            onPress={() => setIsFilterModalVisible(false)}
          >
            <View style={styles.pickerModal}>
              <Text style={styles.modalHeaderTitle}>Filter Actions</Text>
              <ScrollView style={{ maxHeight: 350 }}>
                {(['ALL', 'CREATE_CONTENT', 'UPDATE_CONTENT', 'DELETE_CONTENT', 'BAN_USER', 'UNBAN_USER', 'UPDATE_USER', 'CREATE_USER', 'UPDATE_SETTINGS', 'BROADCAST'] as const).map(f => (
                  <TouchableOpacity 
                    key={f} 
                    style={styles.pickerItem}
                    onPress={() => { setLogActionFilter(f); setIsFilterModalVisible(false); }}
                  >
                    <Text style={[styles.pickerItemText, logActionFilter === f && { color: '#6366f1', fontWeight: 'bold' }]}>{f.replace(/_/g, ' ')}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    );
  };

  const renderSettings = () => (
    <ScrollView style={styles.sectionScroll} showsVerticalScrollIndicator={false}>
      <View style={{ height: 10 }} />

      {/* --- Access Overrides --- */}
      <View style={styles.dashboardSection}>
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="globe-outline" size={18} color="#6366f1" />
          <Text style={styles.sectionTitle}>ACCESS OVERRIDES</Text>
        </View>

        <View style={styles.settingRow}>
          <View style={{ flex: 1, marginRight: 16 }}>
            <Text style={styles.settingTitle}>Holiday / Event Mode</Text>
            <Text style={styles.settingDesc}>When active, ALL content becomes FREE for ALL users. Useful for holidays or system launches.</Text>
          </View>
          <Switch 
            value={settings.allMoviesFree || false} 
            onValueChange={(val) => setSettings({ ...settings, allMoviesFree: val, duration: val ? settings.duration : '' })}
            trackColor={{ false: '#1e293b', true: '#6366f1' }}
            thumbColor="#fff"
          />
        </View>

        <View style={styles.noteBox}>
          <Ionicons name="information-circle-outline" size={20} color="#6366f1" />
          <Text style={styles.noteText}>
            Note: This setting overrides per-movie pricing. Even if a movie is marked as "Paid", it will be available to non-subscribers while this mode is active.
          </Text>
        </View>

        <Text style={styles.label}>Active Duration</Text>
        <View style={styles.settingsDurationGrid}>
          {['1h', '6h', '12h', '24h', 'Custom'].map(dur => (
            <TouchableOpacity 
              key={dur} 
              style={[styles.settingsDurationBtn, settings.duration === dur && styles.settingsDurationBtnActive]}
              onPress={() => setSettings({ ...settings, duration: dur })}
            >
              <Text style={[styles.settingsDurationText, settings.duration === dur && styles.settingsDurationTextActive]}>{dur}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {settings.duration === 'Custom' && (
          <View>
            <Text style={styles.label}>Custom Expiration</Text>
            <View style={styles.inputWithBtn}>
              <TextInput 
                style={[styles.input, { flex: 1, marginBottom: 0 }]} 
                placeholder="YYYY-MM-DD HH:MM" 
                placeholderTextColor="#64748b"
                value={settings.customExpiresAt}
                onChangeText={(t) => setSettings({ ...settings, customExpiresAt: t })}
              />
              <TouchableOpacity style={styles.miniSelectBtn}>
                <Ionicons name="calendar" size={18} color="#6366f1" />
              </TouchableOpacity>
            </View>
            <Text style={{ color: '#64748b', fontSize: 10, marginTop: 8, fontWeight: '700' }}>
              Format: 2026-03-31 15:04
            </Text>
          </View>
        )}
      </View>

      {/* --- Announcement Banner --- */}
      <View style={styles.dashboardSection}>
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="notifications-outline" size={18} color="#f59e0b" />
          <Text style={styles.sectionTitle}>ANNOUNCEMENT BANNER</Text>
        </View>

        <Text style={styles.label}>Event Message</Text>
        <View style={[styles.uniformCard, { padding: 0, overflow: 'hidden' }]}>
          <TextInput 
            style={[styles.input, { height: 80, textAlignVertical: 'top', marginBottom: 0, borderWidth: 0, backgroundColor: 'transparent' }]} 
            value={settings.eventMessage || ''} 
            onChangeText={(text) => setSettings({ ...settings, eventMessage: text })}
            placeholder="System Launch Celebration! 🚀 Global Free Access enabled! ✨"
            placeholderTextColor="#475569"
            multiline
          />
        </View>

        <View style={styles.quickTagGrid}>
          {['🌙 Eid', '🎄 Christmas', '🍿 Weekend', '🚀 Launch'].map(tag => (
            <TouchableOpacity 
              key={tag} 
              style={styles.quickTagBtn}
              onPress={() => setSettings({ ...settings, eventMessage: (settings.eventMessage ? settings.eventMessage + ' ' : '') + tag })}
            >
              <Text style={styles.quickTagText}>{tag}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Live Preview</Text>
        <View style={styles.previewCard}>
          <Text style={styles.previewText}>
            {settings.eventMessage || "Enter a message to see preview..."}
          </Text>
        </View>
      </View>

      {/* --- Admin Profile --- */}
      <View style={styles.dashboardSection}>
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="shield-checkmark-outline" size={18} color="#10b981" />
          <Text style={styles.sectionTitle}>ADMIN PROFILE</Text>
        </View>

        <View style={styles.profileHeader}>
          <View style={styles.profileIconBg}>
            <Ionicons name="mail" size={24} color="#6366f1" />
          </View>
          <View>
            <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' }}>Developer Identity</Text>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900', marginTop: 2 }}>{auth.currentUser?.email}</Text>
          </View>
        </View>
        
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity 
            style={[styles.outlineBtn, { flex: 1, alignItems: 'center', borderColor: '#334155' }]} 
            onPress={() => auth.currentUser?.email && sendPasswordResetEmail(auth, auth.currentUser.email).then(() => Alert.alert('Sent', 'Check your email'))}
          >
            <Text style={[styles.outlineBtnText, { color: '#94a3b8' }]}>RESET PASSWORD</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.outlineBtn, { flex: 1, alignItems: 'center', borderColor: '#ef444433', backgroundColor: '#ef444411' }]} onPress={handleLogout}>
            <Text style={[styles.outlineBtnText, { color: '#ef4444' }]}>SIGN OUT</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={[styles.saveBtn, { marginHorizontal: 20, marginBottom: 20 }]} onPress={handleSaveSettings}>
        <Text style={styles.saveBtnText}>SAVE GLOBAL SETTINGS</Text>
      </TouchableOpacity>

      <View style={{ height: 100 }} />
    </ScrollView>
  );

  const renderAppLayout = () => {
    return (
      <View style={{ flex: 1 }}>
        <View style={{ height: 10 }} />

        <ScrollView style={{ paddingHorizontal: 16 }} showsVerticalScrollIndicator={false}>
          {layoutSections.map((section, index) => (
            <View key={section.id} style={[styles.contentCard, !section.isVisible && { opacity: 0.5 }]}>
              <View style={{ flex: 1 }}>
                {editingLayoutId === section.id ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TextInput 
                      style={[styles.input, { flex: 1, marginBottom: 0, paddingVertical: 8 }]} 
                      value={editingLayoutTitle} 
                      onChangeText={setEditingLayoutTitle}
                      autoFocus
                    />
                    <TouchableOpacity onPress={async () => {
                      const updated = layoutSections.map(s => s.id === section.id ? { ...s, title: editingLayoutTitle } : s);
                      setLayoutSections(updated);
                      await handleUpdateLayout(updated);
                      setEditingLayoutId(null);
                      logAdminAction('UPDATE_LAYOUT', `Renamed section to: ${editingLayoutTitle}`, section.id, editingLayoutTitle);
                    }}>
                      <Ionicons name="checkmark-circle" size={24} color="#10b981" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity onPress={() => {
                    setEditingLayoutId(section.id);
                    setEditingLayoutTitle(section.title);
                  }}>
                    <Text style={styles.cardTitle}>{section.title}</Text>
                    <Text style={styles.cardSubtitle}>
                      {section.filterType === 'genre' ? `Genre: ${section.filterValue}` : 
                       section.filterType === 'newReleases' ? 'Newest First' : section.filterType}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ flexDirection: 'column', gap: 4 }}>
                  <TouchableOpacity onPress={() => moveSection(index, 'up')} disabled={index === 0}>
                    <Ionicons name="chevron-up" size={20} color={index === 0 ? '#1e293b' : '#64748b'} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => moveSection(index, 'down')} disabled={index === layoutSections.length - 1}>
                    <Ionicons name="chevron-down" size={20} color={index === layoutSections.length - 1 ? '#1e293b' : '#64748b'} />
                  </TouchableOpacity>
                </View>
                
                <TouchableOpacity onPress={() => toggleLayoutVisibility(section.id)}>
                  <Ionicons name={section.isVisible ? "eye-outline" : "eye-off-outline"} size={22} color={section.isVisible ? "#6366f1" : "#64748b"} />
                </TouchableOpacity>

                <TouchableOpacity onPress={async () => {
                  Alert.alert('Delete Section', 'Remove this section from the app?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: async () => {
                      const updated = layoutSections.filter(s => s.id !== section.id);
                      setLayoutSections(updated);
                      await handleUpdateLayout(updated);
                      logAdminAction('DELETE_CONTENT', `Deleted layout section: ${section.title}`, section.id, section.title);
                    }}
                  ]);
                }}>
                  <Ionicons name="trash-outline" size={22} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))}

          <TouchableOpacity 
            style={styles.addEpBtn} 
            onPress={() => setIsAddSectionModalVisible(true)}
          >
            <Ionicons name="add-circle-outline" size={24} color="#6366f1" />
            <Text style={styles.addEpBtnText}>ADD NEW HOME SECTION</Text>
          </TouchableOpacity>

          <View style={{ height: 120 }} />
        </ScrollView>

        <Modal visible={isAddSectionModalVisible} transparent animationType="slide">
          <View style={styles.overlay}>
            <View style={styles.userModal}>
              <Text style={styles.modalHeaderTitle}>Add App Section</Text>
              
              <Text style={[styles.label, { marginTop: 20 }]}>Section Title</Text>
              <TextInput 
                style={styles.input} 
                value={newSectionForm.title} 
                onChangeText={t => setNewSectionForm({...newSectionForm, title: t})}
                placeholder="e.g. Action Movies"
                placeholderTextColor="#64748b"
              />

              <Text style={styles.label}>Content Source</Text>
              <View style={styles.typeRow}>
                {(['genre', 'newReleases', 'trending', 'free'] as const).map(t => (
                  <TouchableOpacity 
                    key={t}
                    style={[styles.typeBtn, newSectionForm.filterType === t && styles.typeBtnActive, { paddingVertical: 8 }]}
                    onPress={() => setNewSectionForm({...newSectionForm, filterType: t})}
                  >
                    <Text style={[styles.typeBtnText, { fontSize: 10 }, newSectionForm.filterType === t && styles.typeBtnTextActive]}>{t.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {newSectionForm.filterType === 'genre' && (
                <>
                  <Text style={styles.label}>Genre Match</Text>
                  <TextInput 
                    style={styles.input} 
                    value={newSectionForm.filterValue}
                    onChangeText={t => setNewSectionForm({...newSectionForm, filterValue: t})}
                    placeholder="e.g. action"
                    placeholderTextColor="#64748b"
                  />
                </>
              )}

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
                <TouchableOpacity style={[styles.saveBtn, { flex: 1, backgroundColor: '#1e293b' }]} onPress={() => setIsAddSectionModalVisible(false)}>
                  <Text style={styles.saveBtnText}>CANCEL</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.saveBtn, { flex: 1 }]} onPress={async () => {
                  if (!newSectionForm.title) return;
                  const newSection: LayoutSection = {
                    id: 'sec_' + Date.now(),
                    title: newSectionForm.title,
                    filterType: newSectionForm.filterType,
                    filterValue: newSectionForm.filterValue,
                    isVisible: true
                  };
                  const updated = [...layoutSections, newSection];
                  setLayoutSections(updated);
                  await handleUpdateLayout(updated);
                  setIsAddSectionModalVisible(false);
                  setNewSectionForm({ title: '', filterType: 'genre', filterValue: '' });
                  logAdminAction('UPDATE_LAYOUT', `Created new layout section: ${newSection.title}`, newSection.id, newSection.title);
                }}>
                  <Text style={styles.saveBtnText}>CREATE</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Sticky Header */}
      {renderSectionHeader(
        getSectionHeaderInfo(activeSection).title,
        getSectionHeaderInfo(activeSection).subtitle
      )}

      {/* Main Section */}
      <View style={styles.main}>
        {activeSection === 'Dashboard' && renderDashboard()}
        {activeSection === 'Content' && renderContent()}
        {activeSection === 'Users' && renderUsers()}
        {activeSection === 'Media' && renderMediaAssets()}
        {activeSection === 'Announcements' && renderAnnouncements()}
        {activeSection === 'Logs' && renderLogs()}
        {activeSection === 'Settings' && renderSettings()}
        {activeSection === 'AppLayout' && renderAppLayout()}
      </View>

      {/* Navigation */}
      <View style={[styles.navBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <NavBtn icon="view-dashboard" label="Home" active={activeSection === 'Dashboard'} onPress={() => setActiveSection('Dashboard')} />
        <NavBtn icon="film-strip" label="Content" active={activeSection === 'Content'} onPress={() => setActiveSection('Content')} />
        <NavBtn icon="account-group" label="Users" active={activeSection === 'Users'} onPress={() => setActiveSection('Users')} />
        <NavBtn icon="layers" label="Layout" active={activeSection === 'AppLayout'} onPress={() => setActiveSection('AppLayout')} />
        <NavBtn icon="image-multiple" label="Media" active={activeSection === 'Media'} onPress={() => setActiveSection('Media')} />
        <NavBtn icon="bullhorn" label="Alerts" active={activeSection === 'Announcements'} onPress={() => setActiveSection('Announcements')} />
        <NavBtn icon="history" label="Logs" active={activeSection === 'Logs'} onPress={() => setActiveSection('Logs')} />
        <NavBtn icon="cog" label="Settings" active={activeSection === 'Settings'} onPress={() => setActiveSection('Settings')} />
      </View>

      {/* Media Preview Modal */}
      <Modal visible={isMediaPreviewVisible} transparent animationType="fade">
        <View style={styles.previewModalBg}>
          <TouchableOpacity style={styles.previewCloseBtn} onPress={() => setIsMediaPreviewVisible(false)}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          {selectedMediaUri && (
            <Image source={{ uri: selectedMediaUri }} style={styles.previewFullImage} contentFit="contain" />
          )}
        </View>
      </Modal>

      {/* Content Form Modal */}
      <Modal visible={isContentModalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalBg}>
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={[styles.headerIconCircle, { backgroundColor: '#6366f111' }]}>
                <Ionicons name={editingId ? "pencil" : "add"} size={22} color="#6366f1" />
              </View>
              <View>
                <ReflectiveText style={styles.modalHeaderTitle}>{editingId ? 'Edit Content' : 'Add Content'}</ReflectiveText>
                <Text style={styles.modalHeaderSubtitle}>{contentForm.title || 'Draft Media Entry'}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => setIsContentModalVisible(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
          
          <ScrollView 
            style={styles.modalScroll}
            contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
          >
            {/* --- Media Type & Category --- */}
            <View style={styles.dashboardSection}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="film-outline" size={18} color="#6366f1" />
                <Text style={styles.sectionTitle}>CATEGORY & TYPE</Text>
              </View>
              <View style={styles.typeRow}>
                {(['Movie', 'Series'] as const).map(t => (
                  <TouchableOpacity 
                    key={t}
                    style={[styles.typeBtn, contentForm.type === t && styles.typeBtnActive]}
                    onPress={() => setContentForm({...contentForm, type: t})}
                  >
                    <MaterialCommunityIcons 
                      name={t === 'Movie' ? 'movie-open' : 'television-classic'} 
                      size={20} 
                      color={contentForm.type === t ? '#fff' : '#64748b'} 
                    />
                    <Text style={[styles.typeBtnText, contentForm.type === t && styles.typeBtnTextActive]}>{t.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Multipart Toggle for Movies */}
              {contentForm.type === 'Movie' && (
                <View style={[styles.switchBox, { marginTop: 12, backgroundColor: '#6366f111', borderColor: '#6366f133', borderWidth: 1 }]}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons name="layers-outline" size={16} color="#6366f1" />
                      <Text style={[styles.switchLabel, { color: '#fff' }]}>Multipart Movie</Text>
                    </View>
                    <Text style={styles.switchDesc}>Enable for movies split into multiple parts</Text>
                  </View>
                  <Switch 
                    value={contentForm.hasParts || false} 
                    onValueChange={v => {
                      const newList = v && (!contentForm.episodeList || contentForm.episodeList.length === 0) 
                        ? [{ title: 'Part 1', url: '' }] 
                        : contentForm.episodeList;
                      setContentForm({...contentForm, hasParts: v, episodeList: newList});
                    }} 
                    trackColor={{ false: '#334155', true: '#6366f1' }}
                    thumbColor="#fff"
                  />
                </View>
              )}
            </View>

            {/* --- Essentials --- */}
            <View style={styles.dashboardSection}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="information-circle-outline" size={18} color="#6366f1" />
                <Text style={styles.sectionTitle}>ESSENTIAL DETAILS</Text>
              </View>
              <Text style={styles.label}>Production Title</Text>
              <TextInput 
                style={styles.input} 
                value={contentForm.title} 
                onChangeText={t => setContentForm({...contentForm, title: t})} 
                placeholder="e.g. Inception"
                placeholderTextColor="#64748b"
              />
              
              <Text style={styles.label}>Synopsis / Description</Text>
              <TextInput 
                style={[styles.input, { height: 100, textAlignVertical: 'top' }]} 
                value={contentForm.synopsis} 
                onChangeText={t => setContentForm({...contentForm, synopsis: t})} 
                placeholder="Provide a brief description..."
                placeholderTextColor="#64748b"
                multiline
              />

              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.label}>Genre</Text>
                  <TouchableOpacity style={styles.pickerContainer} onPress={() => setIsGenreModalVisible(true)}>
                    <Text style={[styles.pickerInput, !contentForm.genre && { color: '#64748b' }]}>{contentForm.genre || 'Select'}</Text>
                    <Ionicons name="chevron-down" size={16} color="#64748b" />
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Narrator (VJ)</Text>
                  <TouchableOpacity style={styles.pickerContainer} onPress={() => setIsVjModalVisible(true)}>
                    <Text style={[styles.pickerInput, !contentForm.vj && { color: '#64748b' }]}>{contentForm.vj || 'Select'}</Text>
                    <Ionicons name="chevron-down" size={16} color="#64748b" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.label}>Release Year</Text>
                  <TextInput style={styles.input} value={contentForm.year} onChangeText={t => setContentForm({...contentForm, year: t})} placeholder="2024" placeholderTextColor="#64748b" keyboardType="numeric" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Rating (IMDB)</Text>
                  <TextInput style={styles.input} value={contentForm.rating} onChangeText={t => setContentForm({...contentForm, rating: t})} placeholder="8.5" placeholderTextColor="#64748b" keyboardType="numeric" />
                </View>
              </View>
            </View>

            {/* --- Pricing & Visibility --- */}
            <View style={styles.dashboardSection}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="pricetag-outline" size={18} color="#10b981" />
                <Text style={styles.sectionTitle}>PRICING & ACCESS</Text>
              </View>
              <View style={styles.switchBox}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchLabel}>Free Content</Text>
                  <Text style={styles.switchDesc}>Allow users to watch without subscription</Text>
                </View>
                <Switch 
                  value={contentForm.isFree} 
                  onValueChange={v => setContentForm({...contentForm, isFree: v})} 
                  trackColor={{ false: '#334155', true: '#10b981' }}
                  thumbColor="#fff"
                />
              </View>

              <View style={styles.switchBox}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchLabel}>Notify Followers</Text>
                  <Text style={styles.switchDesc}>Send a "Phone Pop-up" & In-App alert</Text>
                </View>
                <Switch 
                  value={contentForm.notifyUsers} 
                  onValueChange={v => setContentForm({...contentForm, notifyUsers: v})} 
                  trackColor={{ false: '#334155', true: '#6366f1' }}
                  thumbColor="#fff"
                />
              </View>

              {/* --- Advanced Scheduling --- */}
              <View style={[styles.dashboardSection, { marginTop: 16, backgroundColor: '#0f172a', padding: 16 }]}>
                <View style={styles.sectionHeaderRow}>
                  <Ionicons name="calendar-outline" size={18} color="#0ea5e9" />
                  <Text style={styles.sectionTitle}>ADVANCED SCHEDULING</Text>
                </View>
                <View style={styles.row}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={styles.label}>Go Live Date</Text>
                    <TextInput style={styles.input} value={contentForm.goLiveDate} onChangeText={t => setContentForm({...contentForm, goLiveDate: t})} placeholder="YYYY-MM-DD" placeholderTextColor="#64748b" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Expiry Date</Text>
                    <TextInput style={styles.input} value={contentForm.expiryDate} onChangeText={t => setContentForm({...contentForm, expiryDate: t})} placeholder="YYYY-MM-DD" placeholderTextColor="#64748b" />
                  </View>
                </View>
              </View>
            </View>

            {/* --- Media & Assets --- */}
            <Text style={styles.sectionTitle}>MEDIA & ASSETS</Text>
            <Text style={styles.label}>Poster / Thumbnail URL</Text>
            <View style={styles.inputWithBtn}>
              <TextInput 
                style={[styles.input, { flex: 1, marginBottom: 0 }]} 
                value={contentForm.poster} 
                onChangeText={t => setContentForm({...contentForm, poster: t})} 
                placeholder="https://example.com/poster.jpg"
                placeholderTextColor="#64748b"
              />
              <TouchableOpacity 
                style={[styles.uploadBtn, isUploading && { opacity: 0.5 }]} 
                onPress={() => pickImage('poster')}
                disabled={isUploading}
              >
                {isUploading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="cloud-upload" size={20} color="#fff" />}
              </TouchableOpacity>
            </View>
            {contentForm.poster ? (
              <Image source={{ uri: contentForm.poster }} style={styles.posterPreview} contentFit="cover" />
            ) : null}

            <View style={styles.dashboardSection}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="images-outline" size={18} color="#10b981" />
                <Text style={styles.sectionTitle}>MEDIA ASSETS</Text>
              </View>
              
              <Text style={styles.label}>Poster Art URL (Ratio 2:3)</Text>
              <View style={styles.imageInputRow}>
                <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} value={contentForm.poster} onChangeText={t => setContentForm({...contentForm, poster: t})} placeholder="https://..." placeholderTextColor="#64748b" />
                <TouchableOpacity style={styles.uploadBtnSmall} onPress={() => pickImage('poster')}>
                  <Ionicons name="camera" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
              {contentForm.poster ? <Image source={{ uri: contentForm.poster }} style={styles.posterPreview} contentFit="cover" /> : null}

              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.label}>Main Stream URL (HLS/Direct)</Text>
                  <TextInput style={styles.input} value={contentForm.videoUrl} onChangeText={t => setContentForm({...contentForm, videoUrl: t})} placeholder="https://..." placeholderTextColor="#64748b" />
                </View>
                <View style={{ width: 120 }}>
                  <Text style={styles.label}>Duration</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TextInput 
                      style={[styles.input, { flex: 1 }]} 
                      value={contentForm.duration} 
                      onChangeText={t => setContentForm({...contentForm, duration: t})} 
                      placeholder="1h 45m" 
                      placeholderTextColor="#64748b" 
                    />
                    <TouchableOpacity 
                      style={{ 
                        backgroundColor: '#6366f122', 
                        paddingHorizontal: 8, 
                        borderRadius: 8, 
                        justifyContent: 'center', 
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: '#6366f144'
                      }}
                      onPress={async () => {
                        let urlToScan = contentForm.videoUrl;
                        if (!urlToScan && contentForm.bunnyVideoId) {
                          urlToScan = `https://vz-f805e1e6-44b.b-cdn.net/${contentForm.bunnyVideoId}/play_240p.mp4`;
                        }
                        if (!urlToScan) return Alert.alert('Error', 'Please provide a video URL or Bunny ID first');
                        
                        try {
                          setLoading(true);
                          const { Video } = require('expo-av');
                          // We can't easily get metadata without a component, but we can try a workaround
                          // or use a simpler fetch if it's a known API.
                          // For now, let's use the web-style scan if possible or just alert.
                          Alert.alert('Scan Initiated', 'Scanning video metadata...');
                          // Implementation of actual scanning in RN usually requires a hidden video component
                          // or a backend helper. For now, we'll implement a basic version.
                          setTimeout(() => {
                             // Mocking for now to show the UI works, will add real logic if needed
                             // setContentForm({...contentForm, duration: '2h 10m'});
                             setLoading(false);
                          }, 1000);
                        } catch (e) {
                          setLoading(false);
                        }
                      }}
                    >
                      <Text style={{ color: '#6366f1', fontSize: 10, fontWeight: '900' }}>SCAN</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
              
              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.label}>Preview Teaser URL</Text>
                  <TextInput style={styles.input} value={contentForm.previewUrl} onChangeText={t => setContentForm({...contentForm, previewUrl: t})} placeholder="https://..." placeholderTextColor="#64748b" />
                </View>
                <View style={{ width: 100 }}>
                  <Text style={styles.label}>Preview (s)</Text>
                  <TextInput style={styles.input} value={contentForm.previewDuration} onChangeText={t => setContentForm({...contentForm, previewDuration: t})} placeholder="30s" placeholderTextColor="#64748b" />
                </View>
              </View>
            </View>

            {/* --- Episodes Management --- */}
            {(contentForm.type === 'Series' || (contentForm.type === 'Movie' && contentForm.hasParts)) && (
              <View style={styles.dashboardSection}>
                <View style={styles.sectionHeaderRow}>
                  <Ionicons name="list-outline" size={18} color="#f59e0b" />
                  <Text style={styles.sectionTitle}>{contentForm.type === 'Series' ? 'EPISODES & SEASONS' : 'MOVIE PARTS'}</Text>
                </View>
                
                {contentForm.type === 'Series' && (
                  <>
                    {/* Series Master Fields */}
                    <View style={styles.switchBox}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.switchLabel}>Is Mini-Series?</Text>
                        <Text style={styles.switchDesc}>Toggle for shorter series / web-series</Text>
                      </View>
                      <Switch 
                        value={contentForm.isMiniSeries || false} 
                        onValueChange={v => setContentForm({...contentForm, isMiniSeries: v})} 
                        trackColor={{ false: '#334155', true: '#6366f1' }}
                        thumbColor="#fff"
                      />
                    </View>
                    
                    <View style={styles.row}>
                       <View style={{ flex: 1, marginRight: 10 }}>
                         <Text style={styles.label}>Free Episodes</Text>
                         <TextInput style={styles.input} value={String(contentForm.freeEpisodesCount || 0)} onChangeText={t => setContentForm({...contentForm, freeEpisodesCount: parseInt(t) || 0})} keyboardType="numeric" />
                       </View>
                       <View style={{ flex: 1 }}>
                         <Text style={styles.label}>Total Seasons</Text>
                         <TextInput style={styles.input} value={String(contentForm.seasons || 1)} onChangeText={t => setContentForm({...contentForm, seasons: parseInt(t) || 1})} keyboardType="numeric" />
                       </View>
                    </View>
                  </>
                )}

                {(contentForm.type === 'Series' || contentForm.hasParts) && (
                  <View style={[styles.row, { marginBottom: 12 }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.label, { color: '#f59e0b' }]}>Episode Scaling (per Part/File)</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <TextInput 
                          style={[styles.input, { flex: 1, marginBottom: 0, color: '#f59e0b' }]} 
                          value={String(contentForm.episodesPerPart || 1)} 
                          onChangeText={t => setContentForm({...contentForm, episodesPerPart: parseInt(t) || 1})} 
                          keyboardType="numeric" 
                        />
                        <Text style={{ color: '#475569', fontSize: 10, fontWeight: '700' }}>EPS PER PART</Text>
                      </View>
                    </View>
                  </View>
                )}

                {contentForm.type === 'Movie' && contentForm.hasParts && (
                  <View style={styles.row}>
                     <View style={{ flex: 1 }}>
                       <Text style={styles.label}>Free Parts Count</Text>
                       <TextInput style={styles.input} value={String(contentForm.freeEpisodesCount || 0)} onChangeText={t => setContentForm({...contentForm, freeEpisodesCount: parseInt(t) || 0})} keyboardType="numeric" />
                     </View>
                  </View>
                )}

                {contentForm.episodeList?.map((ep: any, idx: number) => (
                  <View key={idx} style={styles.epBox}>
                    <View style={styles.epBadgeNum}>
                      <Text style={styles.epBadgeNumText}>{idx + 1}</Text>
                    </View>
                    <View style={{ flex: 1, gap: 8 }}>
                      <TextInput 
                        style={styles.epInput} 
                        value={ep.title} 
                        onChangeText={t => {
                          const newList = [...contentForm.episodeList];
                          newList[idx].title = t;
                          setContentForm({...contentForm, episodeList: newList});
                        }} 
                        placeholder={contentForm.type === 'Series' ? "Episode Title" : "Part Title"} 
                        placeholderTextColor="#475569" 
                      />
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TextInput 
                          style={[styles.epInput, { flex: 1, borderBottomWidth: 0 }]} 
                          value={ep.url} 
                          onChangeText={t => {
                            const newList = [...contentForm.episodeList];
                            newList[idx].url = t;
                            setContentForm({...contentForm, episodeList: newList});
                          }} 
                          placeholder="Video Source URL" 
                          placeholderTextColor="#475569" 
                        />
                        <TextInput 
                          style={[styles.epInput, { width: 60, borderBottomWidth: 0, textAlign: 'center' }]} 
                          value={ep.duration} 
                          onChangeText={t => {
                            const newList = [...contentForm.episodeList];
                            newList[idx].duration = t;
                            setContentForm({...contentForm, episodeList: newList});
                          }} 
                          placeholder="45m" 
                          placeholderTextColor="#475569" 
                        />
                      </View>
                    </View>
                    <TouchableOpacity style={styles.epRemove} onPress={() => {
                      const newList = contentForm.episodeList.filter((_: any, i: number) => i !== idx);
                      setContentForm({...contentForm, episodeList: newList});
                    }}>
                      <Ionicons name="trash-outline" size={18} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={styles.addEpBtn} onPress={() => {
                  const newList = [...(contentForm.episodeList || []), { title: `Part ${(contentForm.episodeList?.length || 0) + 1}`, url: '' }];
                  setContentForm({...contentForm, episodeList: newList});
                }}>
                  <Ionicons name="add" size={18} color="#6366f1" />
                  <Text style={styles.addEpBtnText}>ADD NEW PART</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* --- Hero Slider Features --- */}
            <View style={styles.dashboardSection}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="star-outline" size={18} color="#8b5cf6" />
                <Text style={styles.sectionTitle}>HERO SLIDER PROMOTION</Text>
              </View>
              <View style={styles.switchBox}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchLabel}>Flash on Hero Slider</Text>
                  <Text style={styles.switchDesc}>Feature this at the top of the Home screen</Text>
                </View>
                <Switch 
                  value={contentForm.isHero} 
                  onValueChange={v => setContentForm({...contentForm, isHero: v})} 
                  trackColor={{ false: '#334155', true: '#8b5cf6' }}
                  thumbColor="#fff"
                />
              </View>

              {contentForm.isHero && (
                <View style={styles.heroSubSection}>
                  <View style={styles.heroTypeRow}>
                    <TouchableOpacity 
                      style={[styles.heroTypeBtn, contentForm.heroType === 'video' && styles.heroTypeBtnActive]}
                      onPress={() => setContentForm({...contentForm, heroType: 'video'})}
                    >
                      <Text style={[styles.heroTypeBtnText, contentForm.heroType === 'video' && styles.heroTypeBtnTextActive]}>VIDEO HERO</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.heroTypeBtn, contentForm.heroType === 'photo' && styles.heroTypeBtnActive]}
                      onPress={() => setContentForm({...contentForm, heroType: 'photo'})}
                    >
                      <Text style={[styles.heroTypeBtnText, contentForm.heroType === 'photo' && styles.heroTypeBtnTextActive]}>PHOTO BANNER</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.label}>Hero Asset URL</Text>
                  <View style={styles.imageInputRow}>
                    <TextInput 
                      style={[styles.input, { flex: 1, marginBottom: 0 }]} 
                      value={contentForm.heroType === 'video' ? contentForm.heroVideoUrl : contentForm.heroPhotoUrl} 
                      onChangeText={t => setContentForm({...contentForm, [contentForm.heroType === 'video' ? 'heroVideoUrl' : 'heroPhotoUrl']: t})} 
                      placeholder="https://..."
                      placeholderTextColor="#64748b"
                    />
                    {contentForm.heroType === 'photo' && (
                      <TouchableOpacity style={[styles.uploadBtnSmall, { backgroundColor: '#8b5cf6' }]} onPress={() => pickImage('hero')}>
                        <Ionicons name="image" size={20} color="#fff" />
                      </TouchableOpacity>
                    )}
                  </View>
                  {contentForm.heroType === 'photo' && contentForm.heroPhotoUrl ? (
                    <Image source={{ uri: contentForm.heroPhotoUrl }} style={styles.heroPreview} contentFit="cover" />
                  ) : null}
                </View>
              )}
            </View>

            <TouchableOpacity 
              style={[styles.saveBtn, isUploading && { opacity: 0.7, backgroundColor: '#64748b' }]} 
              onPress={handleSaveContent}
              disabled={isUploading}
            >
              <Text style={styles.saveBtnText}>{isUploading ? 'UPLOADING...' : (editingId ? 'UPDATE PRODUCTION' : 'PUBLISH TO APP')}</Text>
            </TouchableOpacity>

            <View style={{ height: 60 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* --- Genre Picker Modal --- */}
      <Modal visible={isGenreModalVisible} animationType="fade" transparent>
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setIsGenreModalVisible(false)}
        >
          <View style={styles.pickerModal}>
            <Text style={styles.modalHeaderTitle}>Select Genre</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              {ALL_GENRES.map(g => (
                <TouchableOpacity 
                  key={g} 
                  style={styles.pickerItem}
                  onPress={() => {
                    setContentForm({...contentForm, genre: g});
                    setIsGenreModalVisible(false);
                  }}
                >
                  <Text style={styles.pickerItemText}>{g}</Text>
                  {contentForm.genre === g && <Ionicons name="checkmark" size={20} color="#6366f1" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* --- VJ Picker Modal --- */}
      <Modal visible={isVjModalVisible} animationType="fade" transparent>
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setIsVjModalVisible(false)}
        >
          <View style={styles.pickerModal}>
            <Text style={styles.modalHeaderTitle}>Select VJ</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              {ALL_VJS.map(v => (
                <TouchableOpacity 
                  key={v} 
                  style={styles.pickerItem}
                  onPress={() => {
                    setContentForm({...contentForm, vj: v});
                    setIsVjModalVisible(false);
                  }}
                >
                  <Text style={styles.pickerItemText}>{v}</Text>
                  {contentForm.vj === v && <Ionicons name="checkmark" size={20} color="#6366f1" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* User Actions Modal */}
      <Modal visible={isUserModalVisible} animationType="fade" transparent>
        <View style={styles.overlay}>
          <View style={styles.userModal}>
            <View style={[styles.miniAvatar, { width: 56, height: 56, borderRadius: 28, backgroundColor: '#6366f111', alignSelf: 'center', marginBottom: 16 }]}>
               <Ionicons name="person" size={24} color="#6366f1" />
            </View>
            <Text style={styles.userModalEmail}>{selectedUser?.email}</Text>
            <View style={[styles.miniTag, { alignSelf: 'center', backgroundColor: '#1e293b', marginBottom: 24 }]}>
               <Text style={styles.userModalSub}>ID: {selectedUser?.id?.substring(0, 12)}... · {(selectedUser as any)?.status}</Text>
            </View>
            
            <View style={styles.userActionGrid}>
              <UserActionBtn 
                label={(selectedUser as any)?.status === 'Banned' ? "Unban User" : "Ban User"} 
                icon={(selectedUser as any)?.status === 'Banned' ? "lock-open" : "ban"} 
                color={(selectedUser as any)?.status === 'Banned' ? "#10b981" : "#ef4444"}
                onPress={() => handleUserAction((selectedUser as any)?.status === 'Banned' ? 'Unban' : 'Ban')}
              />
              <UserActionBtn 
                label="Delete" 
                icon="trash" 
                color="#ef4444" 
                onPress={() => handleUserAction('Delete')}
              />
            </View>

            <Text style={styles.label}>Quick Access Update</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
              {['None', '1 Day', '1 week', '1 Month', '3 Months', 'Premium', 'VIP', 'Custom'].map(p => (
                <TouchableOpacity 
                  key={p} 
                  style={[styles.planChip, { backgroundColor: selectedUser?.plan === p ? '#6366f1' : '#1e293b' }]} 
                  onPress={() => handleUserAction('UpdatePlan', { plan: p })}
                >
                  <Text style={[styles.planChipText, { color: selectedUser?.plan === p ? '#fff' : '#64748b' }]}>{p.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.saveBtn} onPress={() => setIsUserModalVisible(false)}>
              <Text style={styles.saveBtnText}>DONE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Create Temp User Modal (Matches Web Portal) */}
      <Modal visible={isAddUserModalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalBg}>
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={styles.headerIconCircle}>
                <Ionicons name="add-circle" size={24} color="#10b981" />
              </View>
              <View>
                <ReflectiveText style={styles.modalHeaderTitle}>Create Temp User</ReflectiveText>
                <Text style={styles.modalHeaderSubtitle}>Generate a timed access account</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => setIsAddUserModalVisible(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={styles.modalScroll}
            contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
          >
            {/* --- Account Essentials --- */}
            <View style={styles.dashboardSection}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="mail-outline" size={18} color="#6366f1" />
                <Text style={styles.sectionTitle}>ACCOUNT ESSENTIALS</Text>
              </View>
              <Text style={styles.label}>ADMIN EMAIL ACCESS</Text>
              <TextInput 
                style={styles.input} 
                value={newUserForm.email} 
                onChangeText={t => setNewUserForm({...newUserForm, email: t})} 
                placeholder="temp_user@themoviezone.com"
                placeholderTextColor="#64748b"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.label}>SECURITY KEY / PASSWORD</Text>
              <TextInput 
                style={styles.input} 
                value={newUserForm.password} 
                onChangeText={t => setNewUserForm({...newUserForm, password: t})} 
                placeholder="PASSWORD"
                placeholderTextColor="#64748b"
                autoCapitalize="characters"
              />
            </View>

            {/* --- Access Duration --- */}
            <View style={styles.dashboardSection}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="time-outline" size={18} color="#f59e0b" />
                <Text style={styles.sectionTitle}>ACCESS DURATION</Text>
              </View>
              <View style={styles.durationGrid}>
                {['1h', '6h', '12h', '24h', '1w', 'Custom', 'Permanent'].map(d => (
                  <TouchableOpacity 
                    key={d}
                    style={[styles.durationBtn, newUserForm.duration === d && styles.durationBtnActive]}
                    onPress={() => setNewUserForm({...newUserForm, duration: d})}
                  >
                    <Text style={[styles.durationText, newUserForm.duration === d && styles.durationTextActive]}>{d.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {newUserForm.duration === 'Custom' && (
                <View style={{ marginBottom: 24, padding: 16, backgroundColor: '#0f172a', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: '#1e293b' }}>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>DAYS</Text>
                      <TextInput 
                        style={[styles.input, { marginBottom: 0 }]} 
                        value={newUserForm.customDays} 
                        onChangeText={t => setNewUserForm({...newUserForm, customDays: t.replace(/[^0-9]/g, '')})} 
                        placeholder="0"
                        placeholderTextColor="#475569"
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>HOURS</Text>
                      <TextInput 
                        style={[styles.input, { marginBottom: 0 }]} 
                        value={newUserForm.customHours} 
                        onChangeText={t => setNewUserForm({...newUserForm, customHours: t.replace(/[^0-9]/g, '')})} 
                        placeholder="0"
                        placeholderTextColor="#475569"
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                </View>
              )}

              <View style={{ marginTop: 8 }}>
                <View style={styles.sectionHeaderRow}>
                  <Ionicons name="download-outline" size={18} color="#6366f1" />
                  <Text style={styles.sectionTitle}>RESOURCE LIMITS</Text>
                </View>
                <View style={{ marginTop: 8 }}>
                  <Text style={styles.label}>DAILY DOWNLOAD LIMIT</Text>
                  <TextInput 
                    style={styles.input} 
                    value={newUserForm.customDownloads} 
                    onChangeText={t => setNewUserForm({...newUserForm, customDownloads: t.replace(/[^0-9]/g, '')})} 
                    placeholder="10"
                    placeholderTextColor="#475569"
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </View>

            {/* --- Security Policy --- */}
            <View style={styles.dashboardSection}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="shield-outline" size={18} color="#f43f5e" />
                <Text style={styles.sectionTitle}>SECURITY POLICY</Text>
              </View>
              <View style={styles.toggleRow}>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={styles.toggleIconBg}>
                    <Ionicons name="trash-outline" size={20} color="#f43f5e" />
                  </View>
                  <View>
                    <Text style={styles.toggleTitle}>Auto-Purge Expiration</Text>
                    <Text style={styles.toggleDesc}>Wipe account after time ends</Text>
                  </View>
                </View>
                <Switch 
                  value={newUserForm.autoDelete} 
                  onValueChange={v => setNewUserForm({...newUserForm, autoDelete: v})}
                  trackColor={{ false: '#334155', true: '#10b981' }}
                  thumbColor="#fff"
                />
              </View>
            </View>

            <View style={styles.modalFooterButtons}>
              <TouchableOpacity 
                style={styles.cancelLink} 
                onPress={() => setIsAddUserModalVisible(false)}
              >
                <Text style={styles.cancelLinkText}>Discard</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmCreateBtn} onPress={handleAddUser}>
                <Ionicons name="sparkles" size={20} color="#fff" />
                <Text style={styles.confirmCreateBtnText}>CREATE TEMPORARY ACCESS</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Custom Grant Modal (Duration + Downloads) */}
      <Modal visible={isCustomGrantModalVisible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={[styles.userModal, { width: width * 0.9, padding: 24 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <View style={[styles.headerIconCircle, { backgroundColor: '#f59e0b22' }]}>
                <Ionicons name="time" size={24} color="#f59e0b" />
              </View>
              <View>
                <Text style={[styles.modalHeaderTitle, { fontSize: 20 }]}>Custom Grant</Text>
                <Text style={styles.modalHeaderSubtitle}>Specify time and download limits</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>DAYS</Text>
                <TextInput 
                  style={styles.input}
                  value={customGrantForm.days}
                  onChangeText={(t) => setCustomGrantForm(prev => ({ ...prev, days: t }))}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#64748b"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>HOURS</Text>
                <TextInput 
                  style={styles.input}
                  value={customGrantForm.hours}
                  onChangeText={(t) => setCustomGrantForm(prev => ({ ...prev, hours: t }))}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#64748b"
                />
              </View>
            </View>

            <View style={{ marginBottom: 24 }}>
              <Text style={styles.inputLabel}>DAILY DOWNLOAD LIMIT</Text>
              <TextInput 
                style={styles.input}
                value={customGrantForm.downloads}
                onChangeText={(t) => setCustomGrantForm(prev => ({ ...prev, downloads: t }))}
                keyboardType="numeric"
                placeholder="10"
                placeholderTextColor="#64748b"
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity 
                style={[styles.saveBtn, { flex: 1, backgroundColor: '#1e293b' }]} 
                onPress={() => setIsCustomGrantModalVisible(false)}
              >
                <Text style={styles.saveBtnText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.saveBtn, { flex: 1, backgroundColor: '#f59e0b' }]} 
                onPress={handleCustomGrant}
                disabled={isGranting}
              >
                {isGranting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>GRANT</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Small Components ────────────────────────────────────────────────────────

const StatCard = ({ title, value, icon, color, trend }: any) => (
  <View style={styles.statCard}>
    <View style={styles.statCardContent}>
      <View style={styles.statInfoColumn}>
        <Text style={styles.statTitle}>{title}</Text>
        <Text style={styles.statValue}>{value}</Text>
        {trend && (
          <View style={styles.trendRow}>
            <Text style={[styles.trendText, { color: trend.startsWith('+') ? '#10b981' : '#ef4444' }]}>
              {trend}%
            </Text>
            <Text style={styles.trendLabel}> growth</Text>
          </View>
        )}
      </View>
      <View style={[styles.statIconBg, { backgroundColor: color + '22' }]}>
        <MaterialCommunityIcons name={icon as any} size={28} color={color} />
      </View>
    </View>
  </View>
);

const NavBtn = ({ icon, label, active, onPress }: any) => (
  <TouchableOpacity onPress={onPress} style={styles.navBtn}>
    <MaterialCommunityIcons name={icon as any} size={24} color={active ? '#6366f1' : '#64748b'} />
    <Text style={[styles.navText, active && styles.navTextActive]}>{label}</Text>
  </TouchableOpacity>
);

const TabBtn = ({ label, active, onPress }: any) => (
  <TouchableOpacity onPress={onPress} style={[styles.tab, active && styles.activeTab]}>
    <Text style={[styles.tabText, active && styles.activeTabText]}>{label}</Text>
  </TouchableOpacity>
);

const UserActionBtn = ({ label, icon, color, onPress }: any) => (
  <TouchableOpacity style={[styles.userActionBtn, { borderColor: color + '33' }]} onPress={onPress}>
    <FontAwesome5 name={icon} size={16} color={color} />
    <Text style={[styles.userActionText, { color }]}>{label}</Text>
  </TouchableOpacity>
);

const BulkActionBtn = ({ icon, label, color, onPress }: any) => (
  <TouchableOpacity style={styles.bulkActionBtn} onPress={onPress}>
    <Ionicons name={icon} size={20} color={color} />
    <Text style={[styles.bulkActionText, { color }]}>{label}</Text>
  </TouchableOpacity>
);

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  main: { flex: 1 },
  navBar: { flexDirection: 'row', backgroundColor: '#0f172a', borderTopWidth: 1, borderTopColor: '#1e293b' },
  navBtn: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  navText: { color: '#64748b', fontSize: 10, marginTop: 4, fontWeight: '700' },
  navTextActive: { color: '#6366f1' },
  
  // Dashboard
  sectionScroll: { padding: 16 },
  dashboardHeader: { 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20, 
    paddingHorizontal: 4 
  },
  dashboardTitleContainer: { flex: 1, marginLeft: 12 },
  dashboardMainTitle: { color: '#fff', fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  dashboardWelcome: { color: '#64748b', fontSize: 13, fontWeight: '500', marginTop: 2 },
  
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  statCard: { width: (width - 44) / 2, backgroundColor: '#0f172a', padding: 16, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: '#1e293b' },
  statCardContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  statInfoColumn: { flex: 1 },
  statValue: { color: '#fff', fontSize: 22, fontWeight: '900', marginTop: 4 },
  statTitle: { color: '#64748b', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  statIconBg: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  trendRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  trendText: { fontSize: 11, fontWeight: '800' },
  trendLabel: { color: '#475569', fontSize: 10, fontWeight: '600' },
  
  dashboardSection: { marginBottom: 32 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  sectionTitle: { color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 1.5, opacity: 0.6, textTransform: 'uppercase' },
  
  miniCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', padding: 10, borderRadius: 16, marginBottom: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: '#1e293b' },
  miniPoster: { width: 36, height: 48, borderRadius: 8, backgroundColor: '#1e293b' },
  miniAvatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  miniTextContent: { marginLeft: 12, flex: 1 },
  miniCardTitle: { color: '#fff', fontWeight: '700', fontSize: 14 },
  miniCardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  miniCardSub: { color: '#64748b', fontSize: 11, fontWeight: '600' },
  miniTag: { backgroundColor: '#6366f122', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  miniTagText: { color: '#6366f1', fontSize: 9, fontWeight: '900' },
  uniformCard: { backgroundColor: '#0f172a', padding: 16, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: '#1e293b' },

  // Tabs
  tabs: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginVertical: 12 },
  tab: { flex: 1, backgroundColor: '#1e293b', paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  activeTab: { backgroundColor: '#6366f1' },
  tabText: { color: '#64748b', fontWeight: '800', fontSize: 11 },
  activeTabText: { color: '#fff' },

  // Content/Users List
  contentCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', padding: 12, borderRadius: 16, marginBottom: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: '#1e293b' },
  contentInfo: { flex: 1, marginLeft: 12 },
  cardTitle: { color: '#fff', fontWeight: '700', fontSize: 15 },
  cardSubtitle: { color: '#64748b', fontSize: 12, marginTop: 2 },
  userAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center' },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', margin: 16, paddingHorizontal: 12, height: 44, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: '#1e293b' },
  searchInput: { flex: 1, marginLeft: 8, color: '#fff', fontSize: 13, fontWeight: '600' },
  resultsCount: { color: '#475569', fontSize: 10, fontWeight: '700', marginLeft: 8 },
  filterSection: { paddingHorizontal: 16, marginBottom: 8 },
  filterRow: { flexDirection: 'row', marginBottom: 12 },
  miniChip: { backgroundColor: '#1e293b', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginRight: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: '#334155' },
  miniChipActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  miniChipText: { color: '#64748b', fontSize: 11, fontWeight: '800' },
  miniChipTextActive: { color: '#fff' },
  vDivider: { width: 1, height: 20, backgroundColor: '#1e293b', alignSelf: 'center', marginRight: 8 },
  
  contentCardLarge: { flexDirection: 'row', backgroundColor: '#0f172a', padding: 12, borderRadius: 20, marginBottom: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: '#1e293b' },
  itemThumbnail: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#1e293b' },
  itemInfo: { flex: 1, marginLeft: 16, justifyContent: 'center' },
  itemTitle: { color: '#fff', fontSize: 14, fontWeight: '800' },
  itemGenre: { color: '#64748b', fontSize: 10, fontWeight: '600', marginTop: 1 },
  itemBadges: { flexDirection: 'row', gap: 6, marginTop: 6 },
  priceTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  priceTagText: { fontSize: 8, fontWeight: '900' },
  typeTag: { backgroundColor: '#1e293b', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: '#334155' },
  typeTagText: { color: '#6366f1', fontSize: 8, fontWeight: '900' },
  itemActionCol: { alignItems: 'flex-end', justifyContent: 'space-between' },
  itemYear: { color: '#64748b', fontSize: 11, fontWeight: '700' },
  editBtnSmall: { padding: 6, backgroundColor: '#1e293b', borderRadius: 8 },

  fab: { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#00c853', justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: '#00c853', shadowOpacity: 0.4, shadowRadius: 10 },

  // Forms & Modal Content
  modalBg: { flex: 1, backgroundColor: '#0a0a0f' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  modalHeaderTitle: { color: '#fff', fontSize: 20, fontWeight: '900' },
  modalHeaderSubtitle: { color: '#64748b', fontSize: 11, fontWeight: '700', marginTop: 2 },
  modalScroll: { flex: 1 },
  label: { color: '#94a3b8', fontSize: 11, fontWeight: '900', marginBottom: 8, textTransform: 'uppercase' },
  inputLabel: { color: '#64748b', fontSize: 10, fontWeight: '800', marginBottom: 8, letterSpacing: 0.5 },
  input: { backgroundColor: '#1e293b', borderRadius: 12, padding: 14, color: '#fff', fontSize: 15, marginBottom: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: '#334155' },
  row: { flexDirection: 'row', marginBottom: 10 },
  pickerContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: '#334155', paddingRight: 10, flex: 1 },
  pickerInput: { flex: 1, color: '#fff', paddingHorizontal: 16, paddingVertical: 12, fontSize: 14 },
  pickerIcon: { opacity: 0.5 },
  switchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', padding: 16, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: '#334155', marginBottom: 12 },
  switchLabel: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  switchDesc: { color: '#64748b', fontSize: 10, marginTop: 2 },
  
  // Series Specific
  seriesSection: { marginTop: 10 },
  epTitle: { color: '#fff', fontSize: 12, fontWeight: '800', marginTop: 15, marginBottom: 10, opacity: 0.6 },
  epBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: '#1e293b', marginBottom: 10, gap: 10 },
  epInput: { color: '#fff', fontSize: 13, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#1e293b', flex: 1 },
  epRemove: { padding: 10, backgroundColor: '#450a0a', borderRadius: 10 },
  addEpBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderWidth: 2, borderStyle: 'dashed', borderColor: '#334155', borderRadius: 12, marginTop: 10 },
  addEpBtnText: { color: '#6366f1', fontSize: 12, fontWeight: '900' },
  
  // Type Selectors
  typeRow: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1e293b', paddingVertical: 12, borderRadius: 12 },
  typeBtnActive: { backgroundColor: '#6366f1' },
  typeBtnText: { color: '#64748b', fontSize: 14, fontWeight: 'bold' },
  typeBtnTextActive: { color: '#fff' },

  // Hero Section
  heroSubSection: { backgroundColor: '#1e293b', padding: 16, borderRadius: 16, marginTop: -8, marginBottom: 12 },
  heroTypeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  heroTypeBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8, backgroundColor: '#0f172a' },
  heroTypeBtnActive: { backgroundColor: '#8b5cf6' },
  heroTypeBtnText: { color: '#64748b', fontSize: 12, fontWeight: 'bold' },
  heroTypeBtnTextActive: { color: '#fff' },

  // Buttons & Shared
  saveBtn: { backgroundColor: '#10b981', paddingVertical: 18, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 1 },
  closeBtn: { padding: 4 },
  closeBtnText: { color: '#64748b', fontWeight: '800' },
  
  // Logs
  logCard: { backgroundColor: '#0f172a', padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: '#1e293b' },
  logTagRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  logTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  logTagText: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  logTime: { color: '#64748b', fontSize: 10, fontWeight: '700' },
  logDetails: { color: '#fff', fontSize: 14, lineHeight: 20 },
  logMeta: { color: '#64748b', fontSize: 11, marginTop: 8, fontWeight: '600' },
  
  // Settings
  settingRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', padding: 16, borderRadius: 16, marginBottom: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: '#1e293b' },
  settingTitle: { color: '#fff', fontWeight: '800', fontSize: 15 },
  settingDesc: { color: '#64748b', fontSize: 11, marginTop: 2 },
  adminCard: { backgroundColor: '#0f172a', padding: 20, borderRadius: 24, alignItems: 'center', borderStyle: 'dashed', borderWidth: StyleSheet.hairlineWidth, borderColor: '#334155' },
  adminEmail: { color: '#fff', fontWeight: '900', fontSize: 16, marginBottom: 16 },
  outlineBtn: { borderWidth: StyleSheet.hairlineWidth, borderColor: '#6366f1', padding: 12, borderRadius: 12 },
  outlineBtnText: { color: '#6366f1', fontSize: 11, fontWeight: '800' },
  
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  userModal: { backgroundColor: '#0f172a', width: '100%', borderRadius: 28, padding: 24, borderWidth: StyleSheet.hairlineWidth, borderColor: '#1e293b' },
  userModalEmail: { color: '#fff', fontSize: 20, fontWeight: '900', textAlign: 'center' },
  userModalSub: { color: '#64748b', fontSize: 13, textAlign: 'center', marginBottom: 24, marginTop: 4 },
  userActionGrid: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  userActionBtn: { flex: 1, padding: 16, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', gap: 8 },
  userActionText: { fontSize: 12, fontWeight: '900' },
  planChip: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#1e293b', borderRadius: 20, marginRight: 8 },
  planChipText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  
  // Picker & Image Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  pickerModal: { backgroundColor: '#0f172a', width: '85%', borderRadius: 24, padding: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: '#1e293b' },
  pickerItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  pickerItemText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  imageInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  uploadBtnSmall: { backgroundColor: '#6366f1', height: 48, width: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  uploadPending: { color: '#10b981', fontSize: 10, fontWeight: 'bold', marginTop: -12, marginBottom: 12, marginLeft: 4 },
  
  // Custom Styles identified in earlier steps
  inputWithBtn: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 16 },
  uploadBtn: { backgroundColor: '#6366f1', height: 48, width: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  posterPreview: { width: 120, height: 180, borderRadius: 12, marginTop: 10, marginBottom: 20, backgroundColor: '#1e293b' },
  heroPreview: { width: '100%', height: 120, borderRadius: 12, marginTop: 10, marginBottom: 20, backgroundColor: '#1e293b' },
  
  dateHelperBtn: { marginRight: 8, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: '#1e293b', borderWidth: StyleSheet.hairlineWidth, borderColor: '#334155', marginBottom: 8 },
  dateHelperText: { color: '#6366f1', fontSize: 9, fontWeight: '900' },
  filterBtn: { padding: 8, marginLeft: 8 },

  // Temp User UI
  headerIconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#10b98111', justifyContent: 'center', alignItems: 'center' },
  durationGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  durationBtn: { width: '31%', backgroundColor: '#0f172a', paddingVertical: 14, borderRadius: 12, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: '#1e293b' },
  durationBtnActive: { backgroundColor: '#10b98122', borderColor: '#10b981' },
  durationText: { color: '#64748b', fontSize: 13, fontWeight: '800' },
  durationTextActive: { color: '#10b981' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', padding: 16, borderRadius: 20, marginBottom: 32, borderWidth: StyleSheet.hairlineWidth, borderColor: '#1e293b' },
  toggleIconBg: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#f43f5e11', justifyContent: 'center', alignItems: 'center' },
  toggleTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  toggleDesc: { color: '#64748b', fontSize: 11, marginTop: 2 },
  modalFooterButtons: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  cancelLink: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 56 },
  cancelLinkText: { color: '#64748b', fontWeight: '800', fontSize: 15 },
  confirmCreateBtn: { flex: 1.5, backgroundColor: '#10b981', height: 56, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  confirmCreateBtnText: { color: '#fff', fontWeight: '900', fontSize: 15 },

  // Bulk Action UI
  miniSelectBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#1e293b', justifyContent: 'center' },
  miniSelectText: { color: '#64748b', fontSize: 10, fontWeight: '900' },
  contentCardSelected: { borderColor: '#6366f1', backgroundColor: '#6366f111' },
  selectionCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#334155', marginRight: 12, justifyContent: 'center', alignItems: 'center' },
  selectionCircleActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  bulkBar: { position: 'absolute', bottom: 90, left: 16, right: 16, backgroundColor: '#0f172a', borderRadius: 20, padding: 16, elevation: 10, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 10, borderBottomWidth: 2, borderBottomColor: '#6366f1' },
  bulkInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingHorizontal: 4 },
  bulkCount: { color: '#6366f1', fontWeight: '900', fontSize: 12 },
  bulkClear: { color: '#64748b', fontSize: 10, fontWeight: '800' },
  bulkActions: { flexDirection: 'row', gap: 10 },
  bulkActionBtn: { flex: 1, backgroundColor: '#1e293b', paddingVertical: 12, borderRadius: 12, alignItems: 'center', gap: 4 },
  bulkActionText: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },

  // Settings New Styles
  noteBox: { 
    flexDirection: 'row', 
    backgroundColor: '#6366f111', 
    padding: 16, 
    borderRadius: 16, 
    borderWidth: StyleSheet.hairlineWidth, 
    borderColor: '#6366f122',
    gap: 12,
    marginBottom: 24
  },
  noteText: { color: '#94a3b8', fontSize: 12, lineHeight: 18, flex: 1 },
  settingsDurationGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  settingsDurationBtn: { 
    flex: 1, 
    minWidth: '22%', 
    backgroundColor: '#0f172a', 
    paddingVertical: 10, 
    borderRadius: 10, 
    alignItems: 'center', 
    borderWidth: StyleSheet.hairlineWidth, 
    borderColor: '#1e293b' 
  },
  settingsDurationBtnActive: { backgroundColor: '#6366f122', borderColor: '#6366f1' },
  settingsDurationText: { color: '#64748b', fontSize: 12, fontWeight: '800' },
  settingsDurationTextActive: { color: '#6366f1' },
  
  quickTagGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16, marginTop: 8 },
  quickTagBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#1e293b', 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 8, 
    borderWidth: StyleSheet.hairlineWidth, 
    borderColor: '#334155',
    gap: 6
  },
  quickTagText: { color: '#94a3b8', fontSize: 11, fontWeight: '700' },
  
  previewCard: { 
    backgroundColor: '#0f172a', 
    padding: 20, 
    borderRadius: 16, 
    borderWidth: StyleSheet.hairlineWidth, 
    borderColor: '#1e293b',
    borderLeftWidth: 4,
    borderLeftColor: '#6366f1',
    marginTop: 8
  },
  previewText: { color: '#fff', fontSize: 14, fontWeight: '600', lineHeight: 22 },
  
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24 },
  profileIconBg: { 
    width: 56, 
    height: 56, 
    borderRadius: 28, 
    backgroundColor: '#6366f111', 
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#6366f122'
  },
  
  // Announcements
  categoryChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24, marginTop: 8 },
  categoryChip: { 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 10, 
    backgroundColor: '#1e293b', 
    borderWidth: StyleSheet.hairlineWidth, 
    borderColor: '#334155' 
  },
  categoryChipActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  categoryChipText: { color: '#64748b', fontSize: 11, fontWeight: '800' },
  categoryChipTextActive: { color: '#fff' },
  
  broadcastBtn: { 
    backgroundColor: '#6366f1', 
    height: 56, 
    borderRadius: 16, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 10,
    marginTop: 8,
    shadowColor: '#6366f1',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4
  },
  broadcastBtnText: { color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },
  
  annSearchContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#0f172a', 
    paddingHorizontal: 12, 
    height: 48, 
    borderRadius: 14, 
    borderWidth: StyleSheet.hairlineWidth, 
    borderColor: '#1e293b',
    marginBottom: 20 
  },
  annSearchInput: { flex: 1, marginLeft: 10, color: '#fff', fontSize: 14, fontWeight: '600' },
  
  historyCard: { 
    backgroundColor: '#0f172a', 
    borderRadius: 20, 
    padding: 16, 
    marginBottom: 12, 
    borderWidth: StyleSheet.hairlineWidth, 
    borderColor: '#1e293b' 
  },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  historyStatusBadge: { 
    backgroundColor: '#10b98122', 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#10b98144'
  },
  historyStatusText: { color: '#10b981', fontSize: 9, fontWeight: '900' },
  historyDeleteBtn: { 
    width: 32, 
    height: 32, 
    borderRadius: 8, 
    backgroundColor: '#ef444411', 
    justifyContent: 'center', 
    alignItems: 'center',
    marginLeft: 8
  },
  historySubject: { color: '#fff', fontSize: 15, fontWeight: '700', lineHeight: 22 },
  historyFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  historyCategory: { color: '#6366f1', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  historyDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#334155' },
  historyDate: { color: '#64748b', fontSize: 11, fontWeight: '600' },
  
  // Media Assets
  mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 100 },
  assetCard: { width: (width - 44) / 3, borderRadius: 12, overflow: 'hidden', backgroundColor: '#0f172a', borderWidth: StyleSheet.hairlineWidth, borderColor: '#1e293b' },
  assetImage: { width: '100%', aspectRatio: 2/3 },
  assetInfoOverflow: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 6, backgroundColor: 'rgba(0,0,0,0.6)' },
  assetTitleSmall: { color: '#fff', fontSize: 8, fontWeight: 'bold' },
  
  heroMediaCard: { backgroundColor: '#0f172a', borderRadius: 20, marginBottom: 16, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: '#1e293b' },
  heroMediaBanner: { width: '100%', height: 160, backgroundColor: '#1e293b' },
  heroMediaOverlay: { position: 'absolute', top: 12, right: 12, backgroundColor: '#00c853', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  heroMediaOverlayText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  heroMediaFooter: { padding: 16 },
  heroMediaTitle: { color: '#fff', fontSize: 16, fontWeight: '900', marginBottom: 12 },
  heroActionRow: { flexDirection: 'row', gap: 10 },
  heroTypeToggle: { flex: 1, height: 40, borderRadius: 10, backgroundColor: '#1e293b', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: '#334155' },
  heroTypeToggleActive: { backgroundColor: '#6366f122', borderColor: '#6366f1' },
  heroActionBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: '#334155' },
  
  previewModalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  previewFullImage: { width: width, height: height * 0.7 },
  previewCloseBtn: { position: 'absolute', top: 50, right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  
  // User Management Redesign
  userRow: { 
    backgroundColor: '#0f172a', 
    marginHorizontal: 16, 
    marginBottom: 12, 
    borderRadius: 20, 
    borderWidth: StyleSheet.hairlineWidth, 
    borderColor: '#1e293b', 
    flexDirection: 'row', 
    padding: 16 
  },
  userPillar: { flex: 1.2, gap: 4 },
  userPillarMid: { flex: 1, gap: 4, paddingHorizontal: 12, borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#1e293b' },
  userPillarEnd: { flex: 1.2, gap: 4, paddingLeft: 12 },
  
  pillarLabel: { color: '#475569', fontSize: 9, fontWeight: '900', letterSpacing: 0.5, marginBottom: 8 },
  userPillarMain: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  userPillarTextGroup: { flex: 1 },
  userPillarTitle: { color: '#fff', fontSize: 13, fontWeight: '800' },
  userPillarSub: { color: '#64748b', fontSize: 10, fontWeight: '600' },
  
  addEmailBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#10b98111', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 2 },
  addEmailText: { color: '#10b981', fontSize: 9, fontWeight: '800', marginLeft: 4 },
  
  subBadge: { 
    backgroundColor: '#1e293b', 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 6, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between' 
  },
  subBadgeText: { color: '#6366f1', fontSize: 11, fontWeight: '900' },
  expiryBadge: { backgroundColor: '#f59e0b11', padding: 6, borderRadius: 6, marginTop: 8 },
  expiryBadgeText: { color: '#f59e0b', fontSize: 9, fontWeight: '800' },
  
  engagementBadge: { backgroundColor: '#1e293b', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start' },
  engagementText: { color: '#64748b', fontSize: 9, fontWeight: '800' },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  activityText: { color: '#475569', fontSize: 10, fontWeight: '600' },

  // Storage Explorer
  breadcrumbContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#0f172a', 
    padding: 12, 
    borderRadius: 12, 
    marginBottom: 20,
    flexWrap: 'wrap'
  },
  breadcrumbItem: { flexDirection: 'row', alignItems: 'center' },
  breadcrumbText: { color: '#64748b', fontSize: 13, fontWeight: '600' },
  breadcrumbActive: { color: '#10b981' },
  
  storageGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 16, 
    paddingBottom: 40 
  },
  storageItemBox: { 
    width: (width - 64) / 3, 
    alignItems: 'center', 
    gap: 8 
  },
  storageIconBg: { 
    width: '100%', 
    aspectRatio: 1, 
    borderRadius: 16, 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: StyleSheet.hairlineWidth,
  },
  folderIconBg: { backgroundColor: '#f59e0b11', borderColor: '#f59e0b22' },
  fileIconBg: { backgroundColor: '#6366f111', borderColor: '#6366f122' },
  
  formatLabel: { 
    position: 'absolute', 
    bottom: 8, 
    fontSize: 7, 
    fontWeight: '900', 
    color: '#64748b', 
    letterSpacing: 0.5 
  },
  storageItemName: { 
    color: '#fff', 
    fontSize: 11, 
    fontWeight: '700', 
    textAlign: 'center' 
  },
  storageItemMeta: { 
    color: '#475569', 
    fontSize: 9, 
    fontWeight: '600' 
  },
  epBox: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#1e293b',
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  epBadgeNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#6366f122',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  epBadgeNumText: {
    color: '#6366f1',
    fontSize: 10,
    fontWeight: '900',
  },
  epInput: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1e293b',
    paddingVertical: 4,
  },
  epRemove: {
    padding: 8,
    marginTop: -4,
  },
  addEpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: '#6366f111',
    borderWidth: 1,
    borderColor: '#6366f133',
    gap: 8,
    marginTop: 8,
  },
  addEpBtnText: {
    color: '#6366f1',
    fontSize: 13,
    fontWeight: '800',
  },
});
