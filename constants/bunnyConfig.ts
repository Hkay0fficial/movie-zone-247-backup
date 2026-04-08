export const BUNNY_CONFIG = {
  LIBRARY_ID: '631781',
  PULL_ZONE: 'themoviezone247.b-cdn.net',
};

/**
 * Resolves a URL through the Bunny CDN if it belongs to the origin domain.
 */
export const resolveCDNUrl = (url: string | undefined): string => {
  if (!url) return '';
  
  const origin = 'https://themoviezone247.com';
  const cdnBase = `https://${BUNNY_CONFIG.PULL_ZONE}`;
  
  if (url.startsWith(origin)) {
    return url.replace(origin, cdnBase);
  }
  
  return url;
};
