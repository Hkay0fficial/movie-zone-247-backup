/**
 * externalDownload.ts
 * Handles real MP4 downloads to the device gallery using expo-file-system and expo-media-library.
 * Supports pause and resume via DownloadResumable objects.
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';

export type DownloadProgressCallback = (progress: number) => void;

export interface DownloadResult {
  success: boolean;
  message: string;
  localUri?: string;
}

export interface ManagedDownload {
  resumable: FileSystem.DownloadResumable;
  promise: Promise<DownloadResult>;
}

/**
 * Downloads a video file to the device gallery.
 * Returns a ManagedDownload so the caller can pause/resume.
 */
export function createGalleryDownload(
  videoUrl: string,
  title: string,
  onProgress: DownloadProgressCallback
): ManagedDownload {
  const safeTitle = title.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 60);
  const fileUri = `${FileSystem.cacheDirectory}${safeTitle}_${Date.now()}.mp4`;

  let displayedPct = 0;
  let nextThreshold = 1 + Math.floor(Math.random() * 3);

  const resumable = FileSystem.createDownloadResumable(
    videoUrl,
    fileUri,
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.162 Mobile Safari/537.36',
        'Referer': 'https://themoviezone247.com/'
      }
    },
    ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
      if (totalBytesExpectedToWrite > 0) {
        const realPct = Math.floor((totalBytesWritten / totalBytesExpectedToWrite) * 100);
        if (realPct >= nextThreshold && displayedPct < 99) {
          displayedPct = Math.min(nextThreshold, 99);
          onProgress(displayedPct);
          const step = 2 + Math.floor(Math.random() * 4);
          nextThreshold = displayedPct + step;
        }
      }
    }
  );

  const promise = (async (): Promise<DownloadResult> => {
    try {
      // Check if we need media lib permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        return {
          success: false,
          message: 'Permission denied. Please allow media access in your phone settings to save downloads.',
        };
      }

      const result = await resumable.downloadAsync();
      if (!result?.uri) {
        return { success: false, message: 'Download failed. Please check your connection and try again.' };
      }

      const asset = await MediaLibrary.createAssetAsync(result.uri);
      try {
        const album = await MediaLibrary.getAlbumAsync('Movie Zone 24/7');
        if (album) {
          await MediaLibrary.addAssetsToAlbumAsync([asset], album, true);
        } else {
          await MediaLibrary.createAlbumAsync('Movie Zone 24/7', asset, true);
        }
      } catch {
        // Album optional
      }

      await FileSystem.deleteAsync(result.uri, { idempotent: true });
      onProgress(100);
      return {
        success: true,
        message: `"${title}" has been saved to your gallery in the "Movie Zone 24/7" album.`,
      };
    } catch (err: any) {
      // pauseAsync() causes downloadAsync() to throw on most platforms
      const code = err?.code || '';
      const errLower = (err?.message || '').toLowerCase();
      if (code === 'ERR_TASK_CANCELLED' || errLower.includes('cancel') || errLower.includes('pause') || errLower.includes('abort')) {
        return { success: false, message: '__PAUSED__' };
      }
      const errMsg = err?.message || 'Unknown error';
      if (errMsg.includes('Network') || errMsg.includes('network')) {
        return { success: false, message: 'Download failed: No internet connection.' };
      }
      return { success: false, message: `Download failed: ${errMsg}` };
    }
  })();

  return { resumable, promise };
}

/**
 * Downloads a video file directly to the app's isolated document directory.
 * Returns a ManagedDownload so the caller can pause/resume.
 */
export function createAppStorageDownload(
  videoUrl: string,
  title: string,
  onProgress: DownloadProgressCallback
): ManagedDownload {
  const safeTitle = title.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 60);
  const fileUri = `${FileSystem.documentDirectory}${safeTitle}_${Date.now()}.mp4`;

  let displayedPct = 0;
  let nextThreshold = 1 + Math.floor(Math.random() * 3);

  const resumable = FileSystem.createDownloadResumable(
    videoUrl,
    fileUri,
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.162 Mobile Safari/537.36',
        'Referer': 'https://themoviezone247.com/'
      }
    },
    ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
      if (totalBytesExpectedToWrite > 0) {
        const realPct = Math.floor((totalBytesWritten / totalBytesExpectedToWrite) * 100);
        if (realPct >= nextThreshold && displayedPct < 99) {
          displayedPct = Math.min(nextThreshold, 99);
          onProgress(displayedPct);
          const step = 2 + Math.floor(Math.random() * 4);
          nextThreshold = displayedPct + step;
        }
      }
    }
  );

  const promise = (async (): Promise<DownloadResult> => {
    try {
      const result = await resumable.downloadAsync();
      if (!result?.uri) {
        return { success: false, message: 'Download failed. Please check your connection and try again.' };
      }
      onProgress(100);
      return {
        success: true,
        message: `"${title}" has been saved securely to My Downloads.`,
        localUri: result.uri
      };
    } catch (err: any) {
      // pauseAsync() causes downloadAsync() to throw on most platforms
      const code = err?.code || '';
      const errLower = (err?.message || '').toLowerCase();
      if (code === 'ERR_TASK_CANCELLED' || errLower.includes('cancel') || errLower.includes('pause') || errLower.includes('abort')) {
        return { success: false, message: '__PAUSED__' };
      }
      const errMsg = err?.message || 'Unknown error';
      if (errMsg.includes('Network') || errMsg.includes('network')) {
        return { success: false, message: 'Download failed: No internet connection.' };
      }
      return { success: false, message: `Download failed: ${errMsg}` };
    }
  })();

  return { resumable, promise };
}

// ── Legacy wrappers (kept for backward compat) ──────────────────────────────

export async function downloadToGallery(
  videoUrl: string,
  title: string,
  onProgress: DownloadProgressCallback
): Promise<DownloadResult> {
  const managed = createGalleryDownload(videoUrl, title, onProgress);
  return managed.promise;
}

export async function downloadToAppIsolatedStorage(
  videoUrl: string,
  title: string,
  onProgress: DownloadProgressCallback
): Promise<DownloadResult & { localUri?: string }> {
  const managed = createAppStorageDownload(videoUrl, title, onProgress);
  return managed.promise;
}
