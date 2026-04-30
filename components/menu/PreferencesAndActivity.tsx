import React from 'react';
import { View, Text, TouchableOpacity, Image, Alert, DeviceEventEmitter, TextInput, ScrollView, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from './menu.styles';
import { useRouter } from 'expo-router';
import { getRelativeTime } from '../../constants/utils';
import { useSubscription } from "@/app/context/SubscriptionContext";
import EmptyState from '../EmptyState';

interface Movie {
  id: string;
  title: string;
  poster: string;
  vj: string;
  year: number;
  genre: string;
  duration?: string;
  seasons?: number;
}

interface Series {
  id: string;
  title: string;
  poster: string;
  vj: string;
  year: number;
  genre: string;
  seasons: number;
  isMiniSeries?: boolean;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  unread: boolean;
  type: string;
  icon: string;
  color: string;
  createdAt?: any;
}

interface PreferencesAndActivityProps {
  selectedItem: any;
  selectedSubItem: string | null;
  setSelectedSubItem: (item: string | null) => void;
  setSavedScrollPosition: (pos: number) => void;
  currentScrollY: number;
  activeDownloads?: Record<string, any>;
  downloadedMovies: any[];
  removeDownload: (id: string) => void;
  notifications: Notification[];
  handleClearNotifications: () => void;
  handleNotificationPress: (n: Notification) => void;
  notifSettings: any;
  toggleNotifSetting: (key: any) => void;
  favorites: any[];
  toggleFavorite: (m: any) => void;
  shortenGenre: (g: string) => string;
  onCloseSettings: () => void;
  appUpdateConfig?: {
    isUpdateAvailable: boolean;
    latestVersion: string;
    updateMessage: string;
  };
  watchHistory?: any[];
  removeFromWatchHistory?: (movieId: string, episodeId?: string) => Promise<void>;
  clearWatchHistory?: () => Promise<void>;
}

export const PreferencesAndActivity: React.FC<PreferencesAndActivityProps> = ({
  selectedItem,
  selectedSubItem,
  setSelectedSubItem,
  setSavedScrollPosition,
  currentScrollY,
  activeDownloads = {},
  downloadedMovies,
  removeDownload,
  notifications,
  handleClearNotifications,
  handleNotificationPress,
  notifSettings,
  toggleNotifSetting,
  favorites,
  toggleFavorite,
  shortenGenre,
  onCloseSettings,
  appUpdateConfig,
  watchHistory = [],
  removeFromWatchHistory,
  clearWatchHistory,
}) => {
  const router = useRouter();
  const { setPlayingNow, setPlayerMode, setPlayerTitle, setSelectedVideoUrl } = useSubscription();

  const [isLoading, setIsLoading] = React.useState(true);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    // Artificial delay to show premium skeleton loader and prevent "bumping"
    const timer = setTimeout(() => {
      setIsLoading(false);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  // Combine notifications with active downloads
  const allNotifications = React.useMemo(() => {
    const dlNotifs = Object.entries(activeDownloads)
      .filter(([id, dl]) => dl && dl.item)
      .map(([id, dl]) => ({
        id: `dl_${id}`,
        title: dl.progress === 100 ? "Download Complete!" : "Downloading...",
        message: `${dl.progress === 100 ? "Finished" : "Saving"} "${dl.episodeTitle || dl.item?.title || 'Unknown'}" (${dl.progress}%)`,
        time: "ACTIVE",
        unread: true,
        type: "update",
        icon: "cloud-download",
        color: "#00ffcc",
        createdAt: { toMillis: () => Date.now() }
      }));
    return [...dlNotifs, ...notifications];
  }, [notifications, activeDownloads]);

  // Prepend update notification pin at top if update is available
  const allNotificationsWithUpdate = React.useMemo(() => {
    if (!appUpdateConfig?.isUpdateAvailable) return allNotifications;
    const updateNotif: Notification = {
      id: `sys_update_${appUpdateConfig.latestVersion}`,
      title: `Update Available — v${appUpdateConfig.latestVersion}`,
      message: appUpdateConfig.updateMessage || 'Tap to update now for the latest features and improvements.',
      time: 'Now',
      unread: true,
      type: 'update',
      icon: 'cloud-download',
      color: '#f59e0b',
      createdAt: { toMillis: () => Date.now() }
    };
    // avoid duplicating
    const filtered = allNotifications.filter(n => !n.id.startsWith('sys_update_'));
    return [updateNotif, ...filtered];
  }, [allNotifications, appUpdateConfig]);

  const [filterType, setFilterType] = React.useState<'All' | 'Movie' | 'Series' | 'Mini Series'>('All');
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [isEditMode, setIsEditMode] = React.useState(false);

  // Filter logic
  const filteredDownloads = React.useMemo(() => {
    return downloadedMovies.filter(m => {
      const typeMatch = filterType === 'All' || 
                       (filterType === 'Movie' && !("seasons" in m)) || 
                       (filterType === 'Series' && "seasons" in m && !(m as any).isMiniSeries) ||
                       (filterType === 'Mini Series' && "seasons" in m && (m as any).isMiniSeries);
      return typeMatch;
    });
  }, [downloadedMovies, filterType]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    Alert.alert(
      'Delete Selected',
      `Delete ${selectedIds.size} item${selectedIds.size === 1 ? '' : 's'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: () => {
            selectedIds.forEach(id => removeDownload(id));
            setSelectedIds(new Set());
            setIsEditMode(false);
          } 
        },
      ]
    );
  };

  // ─── Section 5: Downloads ───────────────────────────────────────────────────
  if (selectedItem?.id === '5') {
    return (
      <View style={styles.settingsContentSection}>
        {downloadedMovies.length > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
            {/* Filter Pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 10 }} style={{ flex: 1 }}>
              {(['All', 'Movie', 'Series', 'Mini Series'] as const).map(type => (
                <TouchableOpacity 
                  key={type}
                  onPress={() => setFilterType(type)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 20,
                    backgroundColor: filterType === type ? '#5B5FEF' : 'rgba(255,255,255,0.05)',
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: filterType === type ? '#5B5FEF' : 'rgba(255,255,255,0.1)'
                  }}
                >
                  <Text style={{ color: filterType === type ? '#fff' : 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '700' }}>{type}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Actions: Edit / Select All / Delete */}
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', marginLeft: 8 }}>
              {isEditMode && (
                <>
                  <TouchableOpacity onPress={() => {
                    if (selectedIds.size === filteredDownloads.length && filteredDownloads.length > 0) {
                      setSelectedIds(new Set());
                    } else {
                      setSelectedIds(new Set(filteredDownloads.map(m => (m as any).id)));
                    }
                  }}>
                    <Ionicons name={selectedIds.size === filteredDownloads.length && filteredDownloads.length > 0 ? "checkbox" : "checkbox-outline"} size={22} color="#5B5FEF" />
                  </TouchableOpacity>
                  {selectedIds.size > 0 && (
                    <TouchableOpacity onPress={handleBatchDelete}>
                      <Ionicons name="trash-outline" size={22} color="#ef4444" />
                    </TouchableOpacity>
                  )}
                </>
              )}
              <TouchableOpacity 
                onPress={() => {
                  setIsEditMode(!isEditMode);
                  setSelectedIds(new Set());
                }}
                style={{ backgroundColor: isEditMode ? 'rgba(91, 95, 239, 0.2)' : 'rgba(255,255,255,0.05)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 }}
              >
                <Text style={{ color: isEditMode ? '#818cf8' : '#fff', fontSize: 13, fontWeight: '700' }}>
                  {isEditMode ? 'Done' : 'Edit'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={{ marginTop: 8 }}>
          {isLoading ? (
            <View style={{ gap: 12 }}>
              {[1, 2, 3].map((i) => (
                <View key={`sk-${i}`} style={[styles.downloadCard, { opacity: 0.3 }]}>
                  <View style={[styles.downloadPosterContainer, { backgroundColor: 'rgba(255,255,255,0.05)' }]} />
                  <View style={styles.downloadInfo}>
                    <View style={{ height: 16, width: '60%', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4, marginBottom: 8 }} />
                    <View style={{ height: 12, width: '40%', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 4 }} />
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Animated.View style={{ opacity: fadeAnim }}>
              {filteredDownloads.length > 0 ? (
                filteredDownloads.map((m, index) => {
                  const isSelected = selectedIds.has((m as any).id);
                  return (
                    <TouchableOpacity 
                      key={(m as any).id ?? `dl-${index}`} 
                      style={[styles.downloadCard, isEditMode && { paddingLeft: 8 }]}
                      activeOpacity={isEditMode ? 0.7 : 1}
                      onPress={() => isEditMode && toggleSelect((m as any).id)}
                    >
                      {isEditMode && (
                        <View style={{ marginRight: 12, alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons 
                            name={isSelected ? "checkbox" : "square-outline"} 
                            size={22} 
                            color={isSelected ? "#5B5FEF" : "rgba(255,255,255,0.3)"} 
                          />
                        </View>
                      )}
                      <View style={styles.downloadPosterContainer}>
                        <Image source={{ uri: m.poster }} style={styles.downloadPoster} />
                        <View style={styles.vjBadgeSmall}>
                          <Text style={styles.vjBadgeTextSmall}>{m.vj}</Text>
                        </View>
                        <View style={styles.genreBadgeSmall}>
                          <Text style={styles.genreBadgeTextSmall}>
                            {("seasons" in m) ? ((m as any).isMiniSeries ? "Mini Series" : "Series") : shortenGenre(m.genre)}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.downloadInfo}>
                        <Text style={styles.downloadTitle} numberOfLines={1}>{m.title}</Text>
                        <Text style={styles.downloadMeta}>
                          {m.year} · {'duration' in m ? (m as any).duration : ('seasons' in m ? `${(m as any).seasons} Season${(m as any).seasons > 1 ? 's' : ''}` : '')}
                        </Text>
                        {!isEditMode && (
                          <View style={styles.downloadActionRow}>
                            <TouchableOpacity 
                              style={styles.downloadPlayBtn}
                              onPress={() => {
                                // Trigger global playback immediately
                                // We close the settings modal to prevent it from overlapping the player
                                setPlayerTitle(m.title);
                                setSelectedVideoUrl(m.localUri || m.videoUrl);
                                setPlayingNow(m as any);
                                setPlayerMode('full');
                                onCloseSettings();
                              }}
                            >
                              <Ionicons name="play" size={12} color="#fff" />
                              <Text style={styles.downloadPlayText}>PLAY</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                              style={styles.downloadDeleteBtn}
                              onPress={() => {
                                Alert.alert(
                                  'Remove Download',
                                  `Remove "${m.title}" from your downloads?`,
                                  [
                                    { text: 'Cancel', style: 'cancel' },
                                    { text: 'Remove', style: 'destructive', onPress: () => removeDownload((m as any).id) },
                                  ]
                                );
                              }}
                            >
                              <Ionicons name="trash-outline" size={16} color="#ef4444" />
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <EmptyState 
                  icon="cloud-download-outline"
                  title="No Downloads"
                  description="Save your favorite movies and series to watch them offline anytime, anywhere."
                  buttonText="Explore Movies"
                  onPress={onCloseSettings}
                />
              )}
            </Animated.View>
          )}
        </View>

      </View>
    );
  }

  // ─── Section 6: Notifications ──────────────────────────────────────────────
  if (selectedItem?.id === '6') {
    return (
      <View style={styles.settingsContentSection}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Text style={styles.settingsText}>Stay updated with your latest alerts and personalize your notifications.</Text>
          {notifications.length > 0 && (
            <TouchableOpacity onPress={handleClearNotifications}>
              <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '700' }}>Clear All</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ gap: 12, marginBottom: 24 }}>
          {allNotificationsWithUpdate.length > 0 ? (
            allNotificationsWithUpdate.map((n) => (
              <TouchableOpacity 
                key={n.id} 
                style={[styles.notificationCard, n.id.startsWith('sys_update_') && { borderColor: '#f59e0b33', borderWidth: 1 }]}
                onPress={() => {
                  if (n.id.startsWith('sys_update_')) {
                    const { Linking, Platform } = require('react-native');
                    const url = Platform.OS === 'android'
                      ? 'market://details?id=com.serunkumaharuna.app'
                      : 'https://play.google.com/store/apps/details?id=com.serunkumaharuna.app';
                    Linking.openURL(url).catch(() =>
                      Linking.openURL('https://play.google.com/store/apps/details?id=com.serunkumaharuna.app')
                    );
                  } else {
                    handleNotificationPress(n);
                  }
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.notificationIcon, { backgroundColor: `${n.color}15` }]}>
                  <Ionicons name={n.icon as any} size={20} color={n.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <Text style={styles.notifTitle}>{n.title}</Text>
                    <Text style={styles.notifTime}>
                      {getRelativeTime(n.createdAt)}
                    </Text>
                  </View>
                  <Text style={styles.notifMessage} numberOfLines={2}>{n.message}</Text>
                </View>
                {n.unread && <View style={styles.unreadDot} />}
              </TouchableOpacity>
            ))
          ) : (
            <EmptyState 
              icon="notifications-off-outline"
              title="Quiet in here"
              description="You'll see alerts about new releases, recommendations, and account updates here."
              buttonText="Go Home"
              onPress={onCloseSettings}
            />
          )}
        </View>

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
                  backgroundColor: notifSettings[item.key] ? '#10b981' : 'rgba(255,255,255,0.1)',
                  padding: 2,
                  justifyContent: 'center'
                }}
              >
                <View style={{ 
                  width: 20, 
                  height: 20, 
                  borderRadius: 10, 
                  backgroundColor: '#fff',
                  transform: [{ translateX: notifSettings[item.key] ? 20 : 0 }]
                }} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </View>
    );
  }

  // ─── Section 7: My List ──────────────────────────────────────────────────
  if (selectedItem?.id === '7') {
    return (
      <View style={styles.settingsContentSection}>
        <Text style={styles.settingsText}>
          {favorites.length > 0
            ? `${favorites.length} title${favorites.length === 1 ? '' : 's'} saved to your list.`
            : 'Your personally curated collection of movies and series.'}
        </Text>
        <View style={{ marginTop: 8 }}>
          {favorites.length > 0 ? (
            favorites.map((m, index) => (
                <TouchableOpacity 
                  key={(m as any).id ?? `fav-${index}`} 
                  style={styles.downloadCard}
                  activeOpacity={0.8}
                  onPress={() => {
                    setPlayerTitle(m.title);
                    setSelectedVideoUrl((m as any).localUri || (m as any).videoUrl);
                    setPlayingNow(m as any);
                    setPlayerMode('full');
                  }}
                >
                  <View style={styles.downloadPosterContainer}>
                    <Image source={{ uri: m.poster }} style={styles.downloadPoster} />
                    <View style={styles.vjBadgeSmall}>
                      <Text style={styles.vjBadgeTextSmall}>{m.vj}</Text>
                    </View>
                    <View style={styles.genreBadgeSmall}>
                      <Text style={styles.genreBadgeTextSmall}>
                        {("seasons" in m) ? ((m as any).isMiniSeries ? "Mini Series" : "Series") : shortenGenre(m.genre)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.downloadInfo}>
                    <Text style={styles.downloadTitle} numberOfLines={1}>{m.title}</Text>
                    <Text style={styles.downloadMeta}>
                      {m.year} · {("seasons" in m) ? ((m as any).isMiniSeries ? "Mini Series" : `Season ${(m as any).seasons}`) : (m as any).duration}
                    </Text>
                    <View style={styles.downloadActionRow}>

                      <TouchableOpacity 
                        style={styles.downloadDeleteBtn}
                        onPress={() => toggleFavorite(m)}
                      >
                        <Ionicons name="trash-outline" size={16} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
            ))
          ) : (
            <EmptyState 
              icon="bookmark-outline"
              title="Your List is Empty"
              description="Start adding movies and series to your watchlist so you never miss what you want to watch next."
              buttonText="Browse Content"
              onPress={onCloseSettings}
            />
          )}
        </View>
      </View>
    );
  }

  // ─── Section 10: Watch History ─────────────────────────────────────────────
  if (selectedItem?.id === '10') {
    return (
      <View style={styles.settingsContentSection}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={styles.settingsText}>
            {watchHistory.length > 0
              ? `You have ${watchHistory.length} title${watchHistory.length === 1 ? '' : 's'} in your history.`
              : 'Keep track of everything you have watched.'}
          </Text>
          {watchHistory.length > 0 && clearWatchHistory && (
            <TouchableOpacity onPress={() => {
              Alert.alert(
                'Clear History',
                'Are you sure you want to clear your entire watch history? This cannot be undone.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Clear All', style: 'destructive', onPress: () => clearWatchHistory() },
                ]
              );
            }}>
              <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '700' }}>Clear All</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ marginTop: 8 }}>
          {watchHistory.length > 0 ? (
            watchHistory.map((m, index) => (
              <TouchableOpacity 
                key={(m as any).id ?? `hist-${index}`} 
                style={styles.downloadCard}
                activeOpacity={0.8}
                onPress={() => {
                  setPlayerTitle(m.title);
                  setSelectedVideoUrl((m as any).localUri || (m as any).videoUrl);
                  setPlayingNow(m as any);
                  setPlayerMode('full');
                  onCloseSettings();
                }}
              >
                <View style={styles.downloadPosterContainer}>
                  <Image source={{ uri: m.poster }} style={styles.downloadPoster} />
                  <View style={styles.vjBadgeSmall}>
                    <Text style={styles.vjBadgeTextSmall}>{m.vj}</Text>
                  </View>
                  {m.position > 0 && (
                    <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundColor: 'rgba(255,255,255,0.2)' }}>
                      <View style={{ width: `${Math.min(100, (m.position / (m.duration || m.totalDuration || 1)) * 100)}%`, height: '100%', backgroundColor: '#5B5FEF' }} />
                    </View>
                  )}
                </View>
                <View style={styles.downloadInfo}>
                  <Text style={styles.downloadTitle} numberOfLines={1}>{m.title}</Text>
                  <Text style={styles.downloadMeta}>
                    {m.year} · {m.episodeId ? `EP ${m.episodeId}` : (m.duration || m.totalDuration || 'Movie')}
                  </Text>
                  <View style={styles.downloadActionRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.4)" />
                      <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
                        {getRelativeTime(m.timestamp)}
                      </Text>
                    </View>
                    <TouchableOpacity 
                      style={styles.downloadDeleteBtn}
                      onPress={() => {
                        if (removeFromWatchHistory) {
                          removeFromWatchHistory(m.id, m.episodeId);
                        }
                      }}
                    >
                      <Ionicons name="trash-outline" size={16} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <EmptyState 
              icon="time-outline"
              title="No Watch History"
              description="Items you watch will appear here so you can easily continue where you left off."
              buttonText="Start Watching"
              onPress={onCloseSettings}
            />
          )}
        </View>
      </View>
    );
  }

  return null;
};
