import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
  ActivityIndicator,
  Image,
  Pressable,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { auth, db, storage } from '../constants/firebaseConfig';
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, limit, getCountFromServer, deleteDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const TOP = Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight ?? 0) + 20;


type AdminTab = 'Movies' | 'Series' | 'VJs' | 'Users' | 'Announcements' | 'Settings';
const ADMIN_EMAIL = 'sserunkumaharuna01@gmail.com';

const MOCK_DATA_INITIAL: Record<AdminTab, any[]> = {
  Movies: [
    { id: '1', title: 'The Dark Knight', genre: 'Action, Drama', status: 'Live' },
    { id: '2', title: 'Inception', genre: 'Sci-Fi, Thriller', status: 'Live' },
  ],
  Series: [
    { id: '3', title: 'The Boys', genre: 'Action, Comedy', status: 'Draft' },
    { id: '4', title: 'Breaking Bad', genre: 'Drama, Crime', status: 'Live' },
  ],
  VJs: [
    { id: '5', title: 'VJ Mark', genre: 'Action, Horror', status: 'Live' },
    { id: '6', title: 'VJ Emmy', genre: 'Adventure, Sci-Fi', status: 'Live' },
  ],
  Users: [
    { id: '7', title: 'John Doe', genre: 'john@example.com', status: 'Active' },
    { id: '8', title: 'Jane Smith', genre: 'jane@example.com', status: 'Admin' },
  ],
  Announcements: [
    { id: '9', title: 'Welcome to HK App!', genre: 'General', status: 'Live' },
  ],
  Settings: [],
};

export default function AdminScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AdminTab>('Movies');
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('');
  const [announcementCategory, setAnnouncementCategory] = useState('Update');
  const [imageUri, setImageUri] = useState('');
  const [items, setItems] = useState<Record<AdminTab, any[]>>(MOCK_DATA_INITIAL);
  const [stats, setStats] = useState({
    users: 0,
    movies: 0,
    series: 0,
    vjs: 0,
  });
  
  // New States for Upgrades
  const [editingItem, setEditingItem] = useState<any>(null);
  const [showEpisodesFor, setShowEpisodesFor] = useState<any>(null);
  const [episodeTitle, setEpisodeTitle] = useState('');
  const [episodeVideoUrl, setEpisodeVideoUrl] = useState('');
  const [episodeOrder, setEpisodeOrder] = useState('1');
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [isUploadingEpisode, setIsUploadingEpisode] = useState(false);

  // Refs for focusing inputs when pressing the container
  const titleInputRef = useRef<TextInput>(null);
  const genreInputRef = useRef<TextInput>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user && user.email?.toLowerCase() === ADMIN_EMAIL) {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const fetchItems = async (tab: AdminTab, isNextPage = false) => {
    if (tab === 'Settings') return;
    try {
      const collectionPath = tab === 'Users' ? 'users' : 
                            (tab === 'Announcements' ? 'announcements' :
                            (tab === 'VJs' ? 'VJs' : tab));
      
      let q = query(
        collection(db, collectionPath),
        orderBy('createdAt', 'desc'),
        limit(20)
      );

      if (isNextPage && lastVisible) {
        const { startAfter } = await import('firebase/firestore');
        q = query(q, startAfter(lastVisible));
      }
      
      const querySnapshot = await getDocs(q);
      const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
      setLastVisible(lastDoc);
      setHasMore(querySnapshot.docs.length === 20);

      const fetchedItems = querySnapshot.docs.map(doc => {
        const data = doc.data();
        if (tab === 'Users') {
          return {
            id: doc.id,
            title: data.fullName || 'No Name',
            genre: data.email || 'No Email',
            status: data.isAdmin ? 'Admin' : 'User',
            joinedDate: data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleDateString() : 'N/A',
            ...data
          };
        }
        if (tab === 'Announcements') {
          return {
            id: doc.id,
            title: data.title || 'Untitled',
            genre: data.genre || 'General',
            status: 'Live',
            ...data
          };
        }
        return {
          id: doc.id,
          ...data,
          status: 'Live'
        };
      });
      
      if (fetchedItems.length > 0) {
        setItems(prev => ({ 
          ...prev, 
          [tab]: isNextPage ? [...(prev[tab as AdminTab] || []), ...fetchedItems] : fetchedItems 
        }));
      } else if (!isNextPage) {
        setItems(prev => ({ ...prev, [tab]: MOCK_DATA_INITIAL[tab as AdminTab] || [] }));
      }
    } catch (error) {
      console.log("Firestore empty or query failed. Showing mock data.", error);
      if (!isNextPage) {
        setItems(prev => ({ ...prev, [tab]: MOCK_DATA_INITIAL[tab as AdminTab] || [] }));
      }
    }
  };

  const fetchStats = async () => {
    try {
      const uSnap = await getCountFromServer(collection(db, 'users'));
      const mSnap = await getCountFromServer(collection(db, 'Movies'));
      const sSnap = await getCountFromServer(collection(db, 'Series'));
      const vSnap = await getCountFromServer(collection(db, 'VJs'));
      
      setStats({
        users: uSnap.data().count,
        movies: mSnap.data().count,
        series: sSnap.data().count,
        vjs: vSnap.data().count
      });
    } catch (e) {
      console.error('Stats Error:', e);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchStats();
      fetchItems(activeTab);
    }
  }, [activeTab, isAdmin]);

  const handleAddItem = async () => {
    if (!title || (!genre && activeTab !== 'Announcements')) {
      alert("Please fill in required fields");
      return;
    }
    setLoading(true);
    
    try {
      let finalImageUrl = imageUri;

      // Upload image if it's new
      if (imageUri && imageUri.startsWith('file://')) {
        const response = await fetch(imageUri);
        const blob = await response.blob();
        const filename = `${activeTab.toLowerCase()}/${Date.now()}.jpg`;
        const storageRef = ref(storage, filename);
        
        await uploadBytes(storageRef, blob);
        finalImageUrl = await getDownloadURL(storageRef);
      }

      const collectionName = activeTab === 'Announcements' ? 'announcements' : activeTab.toLowerCase();
      const payload = {
        title,
        genre: activeTab === 'Announcements' ? announcementCategory : genre,
        imageUri: finalImageUrl,
        status: 'Live',
        updatedAt: serverTimestamp(),
      };

      if (editingItem) {
        const { updateDoc } = await import('firebase/firestore');
        await updateDoc(doc(db, collectionName, editingItem.id), payload);
        alert(`${activeTab} updated!`);
      } else {
        await addDoc(collection(db, collectionName), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        alert(`${activeTab} added!`);
      }

      setEditingItem(null);
      setTitle('');
      setGenre('');
      setImageUri('');
      fetchItems(activeTab);
      fetchStats();
    } catch (error) {
      alert("Error: " + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditItem = (item: any) => {
    setEditingItem(item);
    setTitle(item.title);
    setGenre(item.genre);
    setImageUri(item.imageUri || '');
    // Scroll to form? (Form is at top)
  };

  const handleAddEpisode = async () => {
    if (!episodeTitle || !episodeVideoUrl) {
      alert("Fill in episode details");
      return;
    }
    setIsUploadingEpisode(true);
    try {
      await addDoc(collection(db, 'Series', showEpisodesFor.id, 'episodes'), {
        title: episodeTitle,
        videoUrl: episodeVideoUrl,
        order: parseInt(episodeOrder),
        createdAt: serverTimestamp(),
      });
      alert("Episode added!");
      setEpisodeTitle('');
      setEpisodeVideoUrl('');
      setEpisodeOrder((parseInt(episodeOrder) + 1).toString());
    } catch (e) {
      alert("Failed to add episode");
    } finally {
      setIsUploadingEpisode(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      const collectionPath = activeTab === 'Users' ? 'users' : 
                            (activeTab === 'Announcements' ? 'announcements' :
                            (activeTab === 'VJs' ? 'VJs' : activeTab));
      
      await deleteDoc(doc(db, collectionPath, id));
      
      setItems(prev => ({
        ...prev,
        [activeTab]: prev[activeTab].filter(i => i.id !== id)
      }));
      
      fetchStats();
      alert("Item deleted successfully!");
    } catch (error) {
      alert("Delete Error: " + (error as Error).message);
    }
  };

  const handleToggleAdmin = async (userId: string, currentStatus: boolean) => {
    try {
      const { updateDoc } = await import('firebase/firestore');
      await updateDoc(doc(db, 'users', userId), {
        isAdmin: !currentStatus
      });
      
      setItems(prev => ({
        ...prev,
        Users: prev.Users.map(u => u.id === userId ? { ...u, isAdmin: !currentStatus, status: !currentStatus ? 'Admin' : 'User' } : u)
      }));
      
      alert(currentStatus ? "Revoked admin privileges" : "Promoted to admin");
    } catch (e) {
      alert("Failed to update role");
    }
  };

  const renderTabPill = (tab: AdminTab) => {
    const isActive = activeTab === tab;
    return (
      <TouchableOpacity
        key={tab}
        onPress={() => setActiveTab(tab)}
        style={styles.tabPillContainer}
      >
        <LinearGradient
          colors={isActive ? ['rgba(91, 95, 239, 0.4)', 'rgba(91, 95, 239, 0.4)'] : ['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.05)']}
          style={styles.tabPillGradient}
        >
          {isActive && <View style={styles.pillSheen} />}
          <Text style={[styles.tabPillText, isActive && styles.tabPillTextActive]}>{tab}</Text>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  const renderStats = () => (
    <View style={styles.statsContainer}>
      <View style={styles.statsGrid}>
        {[
          { label: 'Total Users', value: stats.users, colors: ['rgba(91, 95, 239, 0.2)', 'rgba(139, 92, 246, 0.2)'] },
          { label: 'Movies', value: stats.movies, colors: ['rgba(56, 189, 248, 0.2)', 'rgba(14, 165, 233, 0.2)'] },
          { label: 'Series', value: stats.series, colors: ['rgba(139, 92, 246, 0.2)', 'rgba(216, 180, 254, 0.2)'] },
          { label: 'Total VJs', value: stats.vjs, colors: ['rgba(244, 114, 182, 0.2)', 'rgba(236, 72, 153, 0.2)'] }
        ].map((stat, idx) => (
          <View key={idx} style={styles.statCard}>
            <LinearGradient colors={stat.colors as [string, string]} style={StyleSheet.absoluteFill} />
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  if (authLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#5B5FEF" />
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#0f0f14', '#1a1a2e', '#0f0f14']} style={StyleSheet.absoluteFill} />
        <View style={styles.errorContainer}>
          <BlurView intensity={30} tint="dark" style={styles.errorCard}>
            <Ionicons name="lock-closed" size={64} color="#ff4b4b" />
            <Text style={styles.errorTitle}>Access Denied</Text>
            <Text style={styles.errorText}>This area is restricted to administrators only.</Text>
            <TouchableOpacity 
              style={styles.backBtn}
              onPress={() => router.replace('/(tabs)')}
            >
              <LinearGradient colors={['#5B5FEF', '#3B3EB0']} style={styles.backBtnGradient}>
                <Text style={styles.backBtnText}>Back to Home</Text>
              </LinearGradient>
            </TouchableOpacity>
          </BlurView>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0f0f14', '#1a1a2e', '#0f0f14']} style={StyleSheet.absoluteFill} />
      
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>ADMIN PANEL</Text>
            <Text style={styles.headerSubtitle}>Content management hub</Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={() => router.replace('/(tabs)/menu')}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {renderStats()}

        <View style={styles.tabContainer}>
          {(['Movies', 'Series', 'VJs', 'Users', 'Announcements'] as AdminTab[]).map(renderTabPill)}
        </View>

        {activeTab !== 'Users' && (
          <View style={styles.formCard}>
            <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.formHeader}>
              <Ionicons 
                name={activeTab === 'Announcements' ? "megaphone-outline" : "add-circle-outline"} 
                size={24} 
                color="#5B5FEF" 
              />
              <Text style={styles.formTitle}>
                {activeTab === 'Announcements' ? 'Broadcast Announcement' : `Add New ${activeTab}`}
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{activeTab === 'Announcements' ? 'Message Subject' : 'Title'}</Text>
              <Pressable 
                style={styles.inputWrapper}
                onPress={() => titleInputRef.current?.focus()}
              >
                <Ionicons name="text-outline" size={20} color="rgba(255,255,255,0.3)" />
                <TextInput
                  ref={titleInputRef}
                  style={styles.input}
                  placeholder={activeTab === 'Announcements' ? "Announcement title" : `Enter ${activeTab} title`}
                  placeholderTextColor="#64748b"
                  value={title}
                  onChangeText={setTitle}
                />
              </Pressable>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{activeTab === 'Announcements' ? 'Broadcast Category' : 'Genre / Category'}</Text>
              {activeTab === 'Announcements' ? (
                <View style={styles.categoryPills}>
                  {['Update', 'Alert', 'Welcome', 'System'].map((cat) => (
                    <TouchableOpacity 
                      key={cat} 
                      onPress={() => setAnnouncementCategory(cat)}
                      style={[
                        styles.catPill, 
                        announcementCategory === cat && styles.catPillActive
                      ]}
                    >
                      <Text style={[
                        styles.catPillText, 
                        announcementCategory === cat && styles.catPillTextActive
                      ]}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Pressable 
                  style={styles.inputWrapper}
                  onPress={() => genreInputRef.current?.focus()}
                >
                  <Ionicons name="pricetag-outline" size={20} color="rgba(255,255,255,0.3)" />
                  <TextInput
                    ref={genreInputRef}
                    style={styles.input}
                    placeholder="e.g. Action, Horror"
                    placeholderTextColor="#64748b"
                    value={genre}
                    onChangeText={setGenre}
                  />
                </Pressable>
              )}
            </View>

            {activeTab !== 'Announcements' && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Cover Image</Text>
                <TouchableOpacity style={styles.imagePickerBtn} onPress={pickImage}>
                  {imageUri ? (
                    <Image source={{ uri: imageUri }} style={styles.imagePreview} />
                  ) : (
                    <View style={styles.imagePlaceholder}>
                      <Ionicons name="image-outline" size={32} color="rgba(255,255,255,0.2)" />
                      <Text style={styles.imagePlaceholderText}>TAP TO SELECT COVER</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity 
              style={styles.addBtn} 
              onPress={handleAddItem}
              disabled={loading}
            >
              <LinearGradient colors={['#5B5FEF', '#4A4ED1']} style={styles.addBtnGradient}>
                <Text style={styles.addBtnText}>
                  {loading ? 'Processing...' : (editingItem ? `Update ${activeTab}` : (activeTab === 'Announcements' ? 'Broadcast Message' : `Upload ${activeTab}`))}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Recent {activeTab}</Text>
            <Text style={styles.viewAll}>{items[activeTab].filter(i => {
              const query = searchQuery.toLowerCase();
              return i.title.toLowerCase().includes(query) || i.genre.toLowerCase().includes(query);
            }).length} Items found</Text>
          </View>
          
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color="rgba(255,255,255,0.3)" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.3)" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {activeTab === 'Settings' ? (
          <View style={styles.formCard}>
            <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.formHeader}>
              <Ionicons name="settings-outline" size={24} color="#5B5FEF" />
              <Text style={styles.formTitle}>System Settings</Text>
            </View>
            
            <View style={styles.settingRow}>
              <View>
                <Text style={styles.settingLabel}>Maintenance Mode</Text>
                <Text style={styles.settingSub}>Disable app for everyone except admins</Text>
              </View>
              <TouchableOpacity 
                onPress={() => setIsMaintenanceMode(!isMaintenanceMode)}
                style={[styles.toggleBtn, isMaintenanceMode && styles.toggleBtnActive]}
              >
                <View style={[styles.toggleThumb, isMaintenanceMode && styles.toggleThumbActive]} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[styles.addBtn, { marginTop: 20 }]}>
              <LinearGradient colors={['#5B5FEF', '#4A4ED1']} style={styles.addBtnGradient}>
                <Text style={styles.addBtnText}>Save System Config</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.recentList}>
            {items[activeTab]
              .filter(item => {
                const query = searchQuery.toLowerCase();
                return item.title.toLowerCase().includes(query) || (item.genre && item.genre.toLowerCase().includes(query));
              })
              .map((item) => (
              <View key={item.id} style={styles.itemCard}>
                <View style={styles.itemIcon}>
                  <Ionicons 
                    name={
                      activeTab === 'Movies' ? "film-outline" : 
                      activeTab === 'Users' ? "person-outline" : 
                      activeTab === 'Announcements' ? "megaphone-outline" : "tv-outline"
                    } 
                    size={24} 
                    color="#818cf8" 
                  />
                </View>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.itemGenre}>{item.genre}</Text>
                  {activeTab === 'Users' && item.joinedDate && (
                    <Text style={styles.itemMeta}>Joined: {item.joinedDate}</Text>
                  )}
                </View>

                <View style={styles.itemActions}>
                  {activeTab === 'Series' && (
                    <TouchableOpacity onPress={() => setShowEpisodesFor(item)} style={styles.actionIconBtn}>
                      <Ionicons name="list" size={18} color="#818cf8" />
                    </TouchableOpacity>
                  )}

                  {activeTab !== 'Users' && activeTab !== 'Announcements' && (
                    <TouchableOpacity onPress={() => handleEditItem(item)} style={styles.actionIconBtn}>
                      <Ionicons name="create-outline" size={18} color="#818cf8" />
                    </TouchableOpacity>
                  )}

                  {activeTab === 'Users' && (
                    <TouchableOpacity 
                      onPress={() => handleToggleAdmin(item.id, item.isAdmin)}
                      style={[styles.roleBtn, { borderColor: item.isAdmin ? '#ef4444' : '#818cf8' }]}
                    >
                      <Text style={[styles.roleBtnText, { color: item.isAdmin ? '#ef4444' : '#818cf8' }]}>
                        {item.isAdmin ? 'Demote' : 'Promote'}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {item.id.length > 5 && ( 
                    <TouchableOpacity onPress={() => handleDeleteItem(item.id)} style={styles.actionIconBtn}>
                      <Ionicons name="trash-outline" size={18} color="#ff4b4b" />
                    </TouchableOpacity>
                  )}
                  
                  <View style={[
                    styles.statusBadge, 
                    { backgroundColor: (item.status === 'Live' || item.status === 'Active' || item.status === 'Admin') ? 'rgba(74, 222, 128, 0.1)' : 'rgba(255, 255, 255, 0.05)' }
                  ]}>
                    <Text style={[
                      styles.statusText, 
                      { color: (item.status === 'Live' || item.status === 'Active' || item.status === 'Admin') ? '#4ade80' : '#64748b' }
                    ]}>{item.status}</Text>
                  </View>
                </View>
              </View>
            ))}

            {hasMore && (
              <TouchableOpacity 
                style={styles.loadMoreBtn} 
                onPress={() => fetchItems(activeTab, true)}
              >
                <Text style={styles.loadMoreText}>LOAD MORE</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Episode Management Modal */}
        {showEpisodesFor && (
          <View style={styles.episodesModal}>
            <View style={styles.header}>
              <View>
                <Text style={styles.headerTitle}>EPISODES</Text>
                <Text style={styles.headerSubtitle}>{showEpisodesFor.title}</Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setShowEpisodesFor(null)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={[styles.formCard, { marginBottom: 20 }]}>
              <Text style={styles.formTitle}>Add New Episode</Text>
              <TextInput
                style={styles.input}
                placeholder="Episode Title (e.g. Ep 1: Pilot)"
                placeholderTextColor="#64748b"
                value={episodeTitle}
                onChangeText={setEpisodeTitle}
              />
              <TextInput
                style={styles.input}
                placeholder="Video URL (Firebase/HLS)"
                placeholderTextColor="#64748b"
                value={episodeVideoUrl}
                onChangeText={setEpisodeVideoUrl}
              />
              <TextInput
                style={styles.input}
                placeholder="Order (Order number)"
                placeholderTextColor="#64748b"
                keyboardType="numeric"
                value={episodeOrder}
                onChangeText={setEpisodeOrder}
              />
              <TouchableOpacity 
                style={[styles.addBtn, { marginTop: 10 }]} 
                onPress={handleAddEpisode}
                disabled={isUploadingEpisode}
              >
                 <Text style={styles.addBtnText}>{isUploadingEpisode ? 'Adding...' : 'Add Episode'}</Text>
              </TouchableOpacity>
            </View>
            
            <Text style={styles.sectionTitle}>Existing Episodes</Text>
            {/* List of episodes would go here - simplified for now */}
            <Text style={[styles.itemGenre, { marginTop: 10 }]}>Episodes are stored in Series/{showEpisodesFor.id}/episodes</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f14' },
  scrollContent: { paddingTop: TOP, paddingHorizontal: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  headerTitle: { fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: 2 },
  headerSubtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
  tabContainer: { flexDirection: 'row', gap: 10, marginBottom: 30 },
  tabPillContainer: { flex: 1, height: 44 },
  tabPillGradient: { flex: 1, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)', overflow: 'hidden' },
  tabPillText: { color: 'rgba(255,255,255,0.4)', fontSize: 14, fontWeight: '600' },
  tabPillTextActive: { color: '#fff' },
  pillSheen: { position: 'absolute', top: '50%', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255, 255, 255, 0.18)', transform: [{ scaleY: 2 }] },
  formCard: { borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)', padding: 24, backgroundColor: 'rgba(30, 30, 45, 0.4)' },
  formHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  formTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  inputGroup: { marginBottom: 20 },
  inputLabel: { fontSize: 14, color: 'rgba(255, 255, 255, 0.5)', marginBottom: 8, marginLeft: 4, fontWeight: '600' },
  inputWrapper: { height: 54, backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: 16, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)' },
  input: { flex: 1, color: '#fff', fontSize: 16, marginLeft: 12 },
  addBtn: { height: 56, marginTop: 10, borderRadius: 28, overflow: 'hidden' },
  addBtnGradient: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  addBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  imagePickerBtn: {
    height: 180,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderStyle: 'dashed',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    alignItems: 'center',
    gap: 8,
  },
  imagePlaceholderText: {
    color: 'rgba(255, 255, 255, 0.3)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 40, marginBottom: 20, paddingHorizontal: 4 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  viewAll: { color: '#818cf8', fontSize: 14, fontWeight: '600' },
  recentList: { gap: 12 },
  itemCard: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.05)' },
  itemIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(129, 140, 248, 0.1)', justifyContent: 'center', alignItems: 'center' },
  itemInfo: { flex: 1, marginLeft: 16 },
  itemTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  itemGenre: { color: '#64748b', fontSize: 13, marginTop: 2 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  statusText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  errorContainer: { flex: 1, backgroundColor: '#0a0a0f', justifyContent: 'center', padding: 24 },
  errorCard: { width: '100%', padding: 40, borderRadius: 32, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)', overflow: 'hidden' },
  errorTitle: { fontSize: 24, fontWeight: '800', color: '#fff', marginTop: 20 },
  errorText: { fontSize: 16, color: '#64748b', textAlign: 'center', marginTop: 10, lineHeight: 24 },
  backBtn: { marginTop: 30, width: '100%', height: 56 },
  backBtnGradient: { flex: 1, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  backBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  statsContainer: { paddingHorizontal: 16, marginBottom: 20 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { width: (SCREEN_W - 42) / 2, height: 90, borderRadius: 20, padding: 16, justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)' },
  statValue: { color: '#fff', fontSize: 24, fontWeight: '800' },
  statLabel: { color: 'rgba(255, 255, 255, 0.6)', fontSize: 12, marginTop: 4, fontWeight: '500' },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255, 255, 255, 0.1)', justifyContent: 'center', alignItems: 'center' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, paddingHorizontal: 12, height: 40, width: 140, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  searchInput: { flex: 1, color: '#fff', fontSize: 13, marginLeft: 8 },
  itemActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  actionIconBtn: { padding: 4 },
  roleBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  roleBtnText: { fontSize: 10, fontWeight: '700' },
  itemMeta: { fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 },
  categoryPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  catPillActive: { backgroundColor: 'rgba(91, 95, 239, 0.2)', borderColor: '#5B5FEF' },
  catPillText: { color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: '600' },
  catPillTextActive: { color: '#fff' },
  loadMoreBtn: { height: 50, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginTop: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  loadMoreText: { color: '#818cf8', fontWeight: '800', letterSpacing: 1 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  settingLabel: { color: '#fff', fontSize: 16, fontWeight: '600' },
  settingSub: { color: '#64748b', fontSize: 12, marginTop: 2 },
  toggleBtn: { width: 44, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', padding: 2 },
  toggleBtnActive: { backgroundColor: '#5B5FEF' },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  toggleThumbActive: { alignSelf: 'flex-end' },
  episodesModal: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 1000, padding: 20, paddingTop: TOP },
});
