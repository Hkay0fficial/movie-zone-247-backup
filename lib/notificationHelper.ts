import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Throttled manager to handle system-level download notifications.
 * Ensures the system tray isn't flooded with updates that could cause lag.
 */
class DownloadNotificationManager {
  private lastUpdate: Record<string, number> = {};
  private lastPausedState: Record<string, boolean> = {};
  private activeNotifications: Set<string> = new Set();
  private permissionChecked = false;
  private hasPermission = true;
  private UPDATE_THROTTLE_MS = 1000; // 1 second between system tray updates

  async initChannel() {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('downloads', {
        name: 'Downloads',
        importance: Notifications.AndroidImportance.LOW, 
        vibrationPattern: [0], // silent
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        showBadge: false,
      });
    }

    // Category 1: Active Download (Shows Pause + Cancel)
    await Notifications.setNotificationCategoryAsync('download_active', [
      {
        identifier: 'pause',
        buttonTitle: 'Pause Download',
        options: { opensAppToForeground: true },
      },
      {
        identifier: 'cancel',
        buttonTitle: 'Cancel',
        options: { isDestructive: true, opensAppToForeground: true },
      },
    ]);

    // Category 2: User Paused (Shows Resume + Cancel)
    await Notifications.setNotificationCategoryAsync('download_paused', [
      {
        identifier: 'resume',
        buttonTitle: 'Resume',
        options: { opensAppToForeground: true },
      },
      {
        identifier: 'cancel',
        buttonTitle: 'Cancel',
        options: { isDestructive: true, opensAppToForeground: true },
      },
    ]);
  }

  private async ensurePermission() {
    if (this.permissionChecked) return this.hasPermission;

    try {
      const existing = await Notifications.getPermissionsAsync();
      let status = existing.status;

      if (status !== 'granted') {
        const requested = await Notifications.requestPermissionsAsync();
        status = requested.status;
      }

      this.hasPermission = status === 'granted';
    } catch (e) {
      console.warn('[DownloadNotification] Permission check failed:', e);
      this.hasPermission = false;
    }

    this.permissionChecked = true;
    return this.hasPermission;
  }

  async updateProgress(
    id: string, 
    title: string, 
    progress: number, 
    subtext: string = '', 
    posterUrl: string = '',
    isPaused: boolean = false,
    movieId?: string,
    episodeId?: string
  ) {
    const canNotify = await this.ensurePermission();
    if (!canNotify) return;

    const now = Date.now();
    const last = this.lastUpdate[id] || 0;

    // Bypass throttle for: first update (0%), completion (100%), or pause state toggle
    const pauseStateChanged = this.lastPausedState[id] !== isPaused;
    if (progress > 0 && progress < 100 && !pauseStateChanged && now - last < this.UPDATE_THROTTLE_MS) {
      return;
    }

    this.lastUpdate[id] = now;
    this.lastPausedState[id] = isPaused;
    this.activeNotifications.add(id);

    const isComplete = progress === 100;
    
    // Status text logic
    let statusLabel = 'Downloading';
    if (isPaused) statusLabel = 'Paused';
    if (isComplete) statusLabel = 'Complete';

    // Body text combines status, percentage and additional info (speed/size)
    const bodyText = `${statusLabel} (${progress}%) ${subtext ? '• ' + subtext : ''}`;

    const content: Notifications.NotificationContentInput = {
      title: title, // Main title is the MovieName
      body: bodyText,
      data: { movieId: movieId || id, downloadId: id, episodeId, type: 'download' }, // Add data for tap support
      sound: isComplete ? 'default' : false,
      sticky: !isComplete, 
      categoryIdentifier: isComplete ? undefined : (isPaused ? 'download_paused' : 'download_active'),
      color: isComplete ? '#10b981' : (isPaused ? '#fcd34d' : '#818cf8'),
    };

    if (posterUrl) {
      if (Platform.OS === 'ios') {
        content.attachments = [{ url: posterUrl, identifier: id, type: 'image' }];
      } else {
        // @ts-ignore - 'image' is supported in SDK 50+ but may not be in all type definitions
        content.image = posterUrl;
      }
    }

    await Notifications.scheduleNotificationAsync({
      identifier: `download_${id}`,
      content,
      trigger: Platform.OS === 'android' ? { channelId: 'downloads' } : null,
    });
  }

  async dismiss(id: string) {
    this.activeNotifications.delete(id);
    delete this.lastUpdate[id];
    delete this.lastPausedState[id];
    const notificationId = `download_${id}`;
    await Promise.allSettled([
      Notifications.dismissNotificationAsync(notificationId),
      Notifications.cancelScheduledNotificationAsync(notificationId),
    ]);
  }

  async notifyError(id: string, title: string, message: string, movieId?: string, episodeId?: string) {
    const canNotify = await this.ensurePermission();
    if (!canNotify) return;

    this.activeNotifications.delete(id);
    delete this.lastUpdate[id];
    delete this.lastPausedState[id];

    await Notifications.scheduleNotificationAsync({
      identifier: `download_${id}`,
      content: {
        title: `Download Failed: ${title}`,
        body: message,
        data: { movieId: movieId || id, downloadId: id, episodeId, type: 'download_error' },
        sticky: false,
        color: '#ef4444',
      },
      trigger: Platform.OS === 'android' ? { channelId: 'downloads' } : null,
    });
  }
}

export const downloadNotificationManager = new DownloadNotificationManager();
