import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Throttled manager to handle system-level download notifications.
 * Ensures the system tray isn't flooded with updates that could cause lag.
 */
class DownloadNotificationManager {
  private lastUpdate: Record<string, number> = {};
  private activeNotifications: Set<string> = new Set();
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
        options: { opensAppToForeground: false },
      },
      {
        identifier: 'cancel',
        buttonTitle: 'Cancel',
        options: { isDestructive: true, opensAppToForeground: false },
      },
    ]);

    // Category 2: User Paused (Shows Resume + Cancel)
    await Notifications.setNotificationCategoryAsync('download_paused', [
      {
        identifier: 'resume',
        buttonTitle: 'Resume',
        options: { opensAppToForeground: false },
      },
      {
        identifier: 'cancel',
        buttonTitle: 'Cancel',
        options: { isDestructive: true, opensAppToForeground: false },
      },
    ]);
  }

  async updateProgress(
    id: string, 
    title: string, 
    progress: number, 
    subtext: string = '', 
    posterUrl: string = '',
    isPaused: boolean = false,
    movieId?: string 
  ) {
    const now = Date.now();
    const last = this.lastUpdate[id] || 0;

    // Throttle updates unless 0, 100, or a pause toggle occurred
    if (progress > 0 && progress < 100 && now - last < this.UPDATE_THROTTLE_MS) {
      return;
    }

    this.lastUpdate[id] = now;
    this.activeNotifications.add(id);

    const isComplete = progress === 100;
    
    // Status text logic
    let statusLabel = 'Downloading';
    if (isPaused) statusLabel = 'Paused';
    if (isComplete) statusLabel = 'Complete';

    // Body text combines status and subtext
    const bodyText = `${statusLabel} (${progress}%) ${subtext ? '• ' + (subtext.includes('•') ? subtext.split('•')[1].trim() : subtext) : ''}`;

    const content: Notifications.NotificationContentInput = {
      title: title, // Main title is the MovieName
      body: bodyText,
      data: { movieId: movieId || id, type: 'download' }, // Add data for tap support
      sound: isComplete ? 'default' : false,
      sticky: !isComplete, 
      categoryIdentifier: isComplete ? undefined : (isPaused ? 'download_paused' : 'download_active'),
      color: isComplete ? '#10b981' : (isPaused ? '#fcd34d' : '#818cf8'),
    };

    if (posterUrl && Platform.OS === 'ios') {
      content.attachments = [{ url: posterUrl, identifier: id, type: 'image' }];
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
    await Notifications.dismissNotificationAsync(`download_${id}`);
  }

  async notifyError(title: string, message: string) {
     await Notifications.scheduleNotificationAsync({
      content: {
        title: `Download Failed: ${title}`,
        body: message,
        color: '#ef4444',
      },
      trigger: Platform.OS === 'android' ? { channelId: 'downloads' } : null,
    });
  }
}

export const downloadNotificationManager = new DownloadNotificationManager();
