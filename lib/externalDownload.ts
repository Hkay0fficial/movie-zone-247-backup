/**
 * externalDownload.ts
 * Handles real MP4 downloads to the device gallery using expo-file-system and expo-media-library.
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { Alert } from 'react-native';

export type DownloadProgressCallback = (progress: number) => void;

export interface DownloadResult {
  success: boolean;
  message: string;
}

/**
 * Downloads a video file to the device gallery.
 * Shows a permission prompt if needed.
 * Calls onProgress with 0-100 as download proceeds.
 */
export async function downloadToGallery(
  videoUrl: string,
  title: string,
  onProgress: DownloadProgressCallback
): Promise<DownloadResult> {
  if (!videoUrl) {
    return { success: false, message: 'No download URL available for this title.' };
  }

  // 1. Request media library permission
  try {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      return {
        success: false,
        message: 'Permission denied. Please allow media access in your phone settings to save downloads.',
      };
    }
  } catch (err: any) {
    console.error('Permission error:', err);
    return {
      success: false,
      message: 'Failed to request gallery permissions. Please rebuild the app or allow access in your phone settings.',
    };
  }

  // 2. Build a safe filename
  const safeTitle = title.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 60);
  const fileUri = `${FileSystem.cacheDirectory}${safeTitle}_${Date.now()}.mp4`;

  try {
    // 3. Create a resumable download with progress tracking
    // Natural variable step sizes so progress feels organic (e.g. 1→3→7→11→13...)
    let displayedPct = 0;
    // Next threshold at which we'll report a progress update (start at a random small offset)
    let nextThreshold = 1 + Math.floor(Math.random() * 3); // first jump: 1, 2, or 3

    const downloadResumable = FileSystem.createDownloadResumable(
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
          // Only update UI when the real progress has reached the next threshold
          if (realPct >= nextThreshold && displayedPct < 99) {
            displayedPct = Math.min(nextThreshold, 99);
            onProgress(displayedPct);
            // Pick a random step size between 2 and 5 for the next jump
            const step = 2 + Math.floor(Math.random() * 4);
            nextThreshold = displayedPct + step;
          }
        }
      }
    );

    const result = await downloadResumable.downloadAsync();
    if (!result?.uri) {
      return { success: false, message: 'Download failed. Please check your connection and try again.' };
    }

    // 4. Save to the device gallery/media library
    const asset = await MediaLibrary.createAssetAsync(result.uri);

    // Optionally move to a named album
    try {
      const album = await MediaLibrary.getAlbumAsync('Movie Zone 24/7');
      if (album) {
        // Setting copyAsset to true helps avoid the "Modify" prompt on Android 11+
        // by creating a new entry instead of moving the existing one.
        await MediaLibrary.addAssetsToAlbumAsync([asset], album, true);
      } else {
        await MediaLibrary.createAlbumAsync('Movie Zone 24/7', asset, true);
      }
    } catch {
      // Album creation is optional — asset is already saved
    }

    // 5. Clean up the cache file
    await FileSystem.deleteAsync(result.uri, { idempotent: true });

    onProgress(100);
    return {
      success: true,
      message: `"${title}" has been saved to your gallery in the "Movie Zone 24/7" album.`,
    };
  } catch (err: any) {
    const msg = err?.message || 'Unknown error';
    if (msg.includes('Network') || msg.includes('network')) {
      return { success: false, message: 'Download failed: No internet connection.' };
    }
    return { success: false, message: `Download failed: ${msg}` };
  }
}

/**
 * Downloads a video file directly to the app's isolated document directory.
 * Does NOT require media library permissions and is NOT visible in the gallery.
 * Returns the local file:// URI on success.
 */
export async function downloadToAppIsolatedStorage(
  videoUrl: string,
  title: string,
  onProgress: DownloadProgressCallback
): Promise<DownloadResult & { localUri?: string }> {
  if (!videoUrl) {
    return { success: false, message: 'No download URL available for this title.' };
  }

  // Build a safe filename inside documentDirectory so it persists
  const safeTitle = title.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 60);
  const fileUri = `${FileSystem.documentDirectory}${safeTitle}_${Date.now()}.mp4`;

  try {
    let displayedPct = 0;
    let nextThreshold = 1 + Math.floor(Math.random() * 3);

    const downloadResumable = FileSystem.createDownloadResumable(
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

    const result = await downloadResumable.downloadAsync();
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
    const msg = err?.message || 'Unknown error';
    if (msg.includes('Network') || msg.includes('network')) {
      return { success: false, message: 'Download failed: No internet connection.' };
    }
    return { success: false, message: `Download failed: ${msg}` };
  }
}
