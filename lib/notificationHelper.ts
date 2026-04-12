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
        importance: Notifications.AndroidImportance.DEFAULT, // DEFAULT shows progress bar reliably on more devices
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        showBadge: false,
      });
    }

    // Register Notification Categories for Interactive Buttons
    await Notifications.setNotificationCategoryAsync('download_actions', [
      {
        identifier: 'pause',
        buttonTitle: 'Pause',
        options: {
          opensAppToForeground: false,
        },
      },
      {
        identifier: 'cancel',
        buttonTitle: 'Cancel',
        options: {
          isDestructive: true,
          opensAppToForeground: false,
        },
      },
    ]);
  }

  async updateProgress(id: string, title: string, progress: number, subtext: string = '', posterUrl: string = '') {
    const now = Date.now();
    const last = this.lastUpdate[id] || 0;

    // Only update the system notification every 1 second (unless it's 0 or 100)
    if (progress > 0 && progress < 100 && now - last < this.UPDATE_THROTTLE_MS) {
      return;
    }

    this.lastUpdate[id] = now;
    this.activeNotifications.add(id);

    const bodyText = subtext ? `${title} - ${progress}%\n${subtext}` : `${title} - ${progress}%`;

    const content: Notifications.NotificationContentInput = {
      title: progress === 100 ? 'Download Complete' : 'Downloading...',
      body: bodyText,
      sound: progress === 100 ? 'default' : false,
      sticky: progress < 100, 
      categoryIdentifier: progress < 100 ? 'download_actions' : undefined,
      color: progress === 100 ? '#10b981' : '#818cf8', // Turn green on completion
    };

    if (posterUrl && Platform.OS === 'ios') {
      content.attachments = [{ uri: posterUrl }];
    }

    if (Platform.OS === 'android') {
      content.android = {
        channelId: 'downloads',
        color: progress === 100 ? '#10b981' : '#818cf8',
        sticky: progress < 100,
        progressBar: {
          max: 100,
          current: progress,
          indeterminate: false,
        },
      };
    }

    await Notifications.scheduleNotificationAsync({
      identifier: `download_${id}`,
      content,
      trigger: null,
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
      trigger: null,
    });
  }
}

export const downloadNotificationManager = new DownloadNotificationManager();
