import React from 'react';
import { View, Text, TouchableOpacity, Image, Alert, DeviceEventEmitter } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from './menu.styles';
import { useRouter } from 'expo-router';
import { getRelativeTime } from '../../constants/utils';

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
}) => {
  const router = useRouter();

  // Combine notifications with active downloads
  const allNotifications = React.useMemo(() => {
    const dlNotifs = Object.entries(activeDownloads).map(([id, dl]) => ({
      id: `dl_${id}`,
      title: dl.progress === 100 ? "Download Complete!" : "Downloading...",
      message: `${dl.progress === 100 ? "Finished" : "Saving"} "${dl.episodeTitle || dl.item.title}" (${dl.progress}%)`,
      time: "ACTIVE",
      unread: true,
      type: "update",
      icon: "cloud-download",
      color: "#00ffcc",
      createdAt: { toMillis: () => Date.now() }
    }));
    return [...dlNotifs, ...notifications];
  }, [notifications, activeDownloads]);

  const [searchQuery, setSearchQuery] = React.useState('');
  const [filterType, setFilterType] = React.useState<'All' | 'Movie' | 'Series'>('All');
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [isEditMode, setIsEditMode] = React.useState(false);

  // Filter logic
  const filteredDownloads = React.useMemo(() => {
    return downloadedMovies.filter(m => {
      const matchesSearch = m.title.toLowerCase().includes(searchQuery.toLowerCase());
      const typeMatch = filterType === 'All' || 
                       (filterType === 'Movie' && !("seasons" in m)) || 
                       (filterType === 'Series' && "seasons" in m);
      return matchesSearch && typeMatch;
    });
  }, [downloadedMovies, searchQuery, filterType]);

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
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Text style={styles.settingsText}>
            {downloadedMovies.length > 0
              ? `${downloadedMovies.length} title${downloadedMovies.length === 1 ? '' : 's'} saved.`
              : 'No offline content yet.'}
          </Text>
          {downloadedMovies.length > 0 && (
            <TouchableOpacity 
              onPress={() => {
                setIsEditMode(!isEditMode);
                setSelectedIds(new Set());
              }}
              style={{ backgroundColor: isEditMode ? 'rgba(91, 95, 239, 0.2)' : 'rgba(255,255,255,0.05)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 }}
            >
              <Text style={{ color: isEditMode ? '#818cf8' : '#fff', fontSize: 13, fontWeight: '700' }}>
                {isEditMode ? 'Cancel' : 'Edit'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {downloadedMovies.length > 0 && (
          <>
            {/* Search Bar */}
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              backgroundColor: 'rgba(255,255,255,0.05)', 
              borderRadius: 15, 
              paddingHorizontal: 12, 
              height: 44,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.1)'
            }}>
              <Ionicons name="search" size={18} color="rgba(255,255,255,0.4)" />
              <TextInput
                style={{ flex: 1, color: '#fff', fontSize: 14, marginLeft: 8 }}
                placeholder="Search downloaded titles..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>
              )}
            </View>

            {/* Filter Pills */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
              {(['All', 'Movie', 'Series'] as const).map(type => (
                <TouchableOpacity 
                  key={type}
                  onPress={() => setFilterType(type)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 20,
                    backgroundColor: filterType === type ? '#5B5FEF' : 'rgba(255,255,255,0.05)',
                    borderWidth: 1,
                    borderColor: filterType === type ? '#5B5FEF' : 'rgba(255,255,255,0.1)'
                  }}
                >
                  <Text style={{ color: filterType === type ? '#fff' : 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '700' }}>{type}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <View style={{ marginTop: 8 }}>
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
                            onCloseSettings();
                            DeviceEventEmitter.emit('movieSelected', { ...m, autoPlay: true });
                            if ('seasons' in m) {
                              router.push('/(tabs)/saved');
                            } else {
                              router.push('/(tabs)');
                            }
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
            <View style={{ padding: 40, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 20 }}>
              <Ionicons name={searchQuery ? "search-outline" : "cloud-download-outline"} size={48} color="rgba(255,255,255,0.1)" />
              <Text style={{ color: 'rgba(255,255,255,0.3)', marginTop: 12, fontSize: 14, textAlign: 'center' }}>
                {searchQuery ? `No results for "${searchQuery}"` : 'No downloads yet. Save movies or series for offline viewing.'}
              </Text>
            </View>
          )}
        </View>

        {isEditMode && selectedIds.size > 0 && (
          <TouchableOpacity 
            onPress={handleBatchDelete}
            style={{
              position: 'absolute',
              bottom: 20,
              left: 20,
              right: 20,
              backgroundColor: '#ef4444',
              height: 56,
              borderRadius: 28,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.3,
              shadowRadius: 15,
              elevation: 8,
            }}
          >
            <Ionicons name="trash" size={20} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>DELETE {selectedIds.size} ITEMS</Text>
          </TouchableOpacity>
        )}
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
          {allNotifications.length > 0 ? (
            allNotifications.map((n) => (
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
            <View style={{ padding: 40, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 20 }}>
              <Ionicons name="notifications-off-outline" size={48} color="rgba(255,255,255,0.1)" />
              <Text style={{ color: 'rgba(255,255,255,0.3)', marginTop: 12, fontSize: 14 }}>No new notifications</Text>
            </View>
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
        <View style={styles.watchlistGrid}>
          {favorites.length > 0 ? (
            favorites.map((m, index) => (
              <View
                key={(m as any).id ?? `fav-${index}`}
                style={[styles.gridCard, { position: 'relative' }]}
              >
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    if ("seasons" in m) {
                      router.push({ pathname: "/(tabs)/saved", params: { seriesId: (m as any).id } });
                    } else {
                      router.push({ pathname: "/(tabs)/saved", params: { movieId: (m as any).id } });
                    }
                  }}
                >
                  <View>
                    <Image source={{ uri: m.poster }} style={styles.gridPoster} />
                    <View style={styles.vjBadgeSmall}>
                      <Text style={styles.vjBadgeTextSmall}>{m.vj}</Text>
                    </View>
                    <View style={styles.genreBadgeSmall}>
                      <Text style={styles.genreBadgeTextSmall}>
                        {("seasons" in m) ? ((m as any).isMiniSeries ? "Mini Series" : "Series") : shortenGenre(m.genre)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.gridInfo}>
                    <Text style={styles.gridTitle} numberOfLines={1}>{m.title}</Text>
                    <Text style={styles.gridMeta} numberOfLines={1}>
                      {m.year} · {("seasons" in m) ? ((m as any).isMiniSeries ? "Mini Series" : `Season ${(m as any).seasons}`) : (m as any).duration}
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onPress={() => toggleFavorite(m)}
                >
                  <Ionicons name="close" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <View style={{ width: '100%', padding: 40, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 20 }}>
              <Ionicons name="bookmark-outline" size={48} color="rgba(255,255,255,0.1)" />
              <Text style={{ color: 'rgba(255,255,255,0.3)', marginTop: 12, fontSize: 14 }}>Watchlist is empty</Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  return null;
};
