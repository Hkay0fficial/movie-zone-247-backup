export const BUNNY_CONFIG = {
  LIBRARY_ID: '631781',
  PULL_ZONE: 'vz-f805e1e6-44b.b-cdn.net',
};

/**
 * Resolves a URL through the Bunny CDN if it belongs to the origin domain.
 * @param url The original URL.
 * @param forceHLS If true (default), converts MP4 to HLS for better mobile playback.
 */
export const resolveCDNUrl = (url: string | undefined, forceHLS: boolean = true): string => {
  if (!url) return '';
  
  const origin = 'https://themoviezone247.com';
  const cdnBase = `https://${BUNNY_CONFIG.PULL_ZONE}`;
  
  if (url.startsWith(origin)) {
    url = url.replace(origin, cdnBase);
  }

  // Auto-correct old, incorrect Pull Zone hostnames
  const oldCdnBase = 'themoviezone247.b-cdn.net';
  if (url.includes(oldCdnBase)) {
    url = url.replace(oldCdnBase, BUNNY_CONFIG.PULL_ZONE);
  }
  
  // Auto-convert old Bunny MP4 links to HLS (playlist.m3u8) for mobile reliability
  // ONLY if forceHLS is true (we need MP4 for downloads)
  if (forceHLS && url.includes('b-cdn.net') && (url.endsWith('.mp4') || url.includes('play_720p.mp4'))) {
    return url.replace(/play_\d+p\.mp4/, 'playlist.m3u8').replace(/\.mp4$/, '/playlist.m3u8');
  }

  // Safety Fallback: If downloading (forceHLS=false) but we only have an HLS link,
  // try to "un-convert" it back to MP4 for the gallery downloader.
  if (!forceHLS && url.includes('b-cdn.net') && url.includes('playlist.m3u8')) {
    // Bunny Stream typically has a play_720p.mp4 or similar. 
    // If we don't know the resolution, 720p is the most common default, 
    // but we can also try the base URL which sometimes works for direct delivery.
    return url.replace('playlist.m3u8', 'play_720p.mp4');
  }

  return url;
};
