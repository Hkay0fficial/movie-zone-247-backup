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
        importance: Notifications.AndroidImportance.DEFAULT, 
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
    isPaused: boolean = false
  ) {
    const now = Date.now();
    const last = this.lastUpdate[id] || 0;

    // Throttle updates unless 0, 100, or a pause toggle occurred
    if (progress > 0 && progress < 100 && now - last < this.UPDATE_THROTTLE_MS) {
      // If we are just updating progress (not toggling pause), throttle it
      return;
    }

    this.lastUpdate[id] = now;
    this.activeNotifications.add(id);

    const isComplete = progress === 100;
    
    // Status text logic
    let mainTitle = 'Downloading...';
    if (isPaused) mainTitle = 'Download Paused';
    if (isComplete) mainTitle = 'Download Complete';

    const bodyText = subtext ? `${title} - ${progress}%\n${subtext}` : `${title} - ${progress}%`;

    const content: Notifications.NotificationContentInput = {
      title: mainTitle,
      body: bodyText,
      sound: isComplete ? 'default' : false,
      sticky: !isComplete, 
      categoryIdentifier: isComplete ? undefined : (isPaused ? 'download_paused' : 'download_active'),
      color: isComplete ? '#10b981' : (isPaused ? '#fcd34d' : '#818cf8'),
    };

    if (posterUrl && Platform.OS === 'ios') {
      content.attachments = [{ uri: posterUrl }];
    }

    if (Platform.OS === 'android') {
      content.android = {
        channelId: 'downloads',
        color: isComplete ? '#10b981' : (isPaused ? '#fcd34d' : '#818cf8'),
        sticky: !isComplete,
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
