import { resolveCDNUrl, BUNNY_CONFIG } from './bunnyConfig';
// Shared movie data for the app

export interface Movie {
  id: string;
  title: string;
  year: number;
  genre: string;
  rating: string;
  vj: string;
  poster: string;
  duration: string;
  previewDuration?: string;
  description?: string;
  videoUrl?: string;
  previewUrl?: string;
  subtitleUrl?: string; // NEW: Path to .vtt or .srt
  qualityOptions?: { label: string; url: string }[]; // NEW: Multi-quality support
  isFree?: boolean;
  isHero?: boolean;
  type?: 'Movie' | 'Series';
  coverUrl?: string;
  heroType?: 'video' | 'photo';
  heroVideoUrl?: string;
  heroPhotoUrl?: string;
  parts?: { id: string; title: string; videoUrl?: string; previewUrl?: string; duration?: string; previewDuration?: string; bunnyVideoId?: string; subtitleUrl?: string }[];
  bunnyVideoId?: string;
  bunnyLibraryId?: string;
  bunnyLibraryId2?: string;
  episodesPerPart?: number;
  country?: string;
}

export interface Series {
  id: string;
  title: string;
  genre: string;
  seasons: number;
  year: number;
  rating: string;
  vj: string;
  status: 'Ongoing' | 'Ended' | 'New';
  poster: string;
  episodes: number; // New field for number of parts/episodes
  episodeList?: { title: string; url: string; duration?: string; subtitleUrl?: string; qualityOptions?: { label: string; url: string }[] }[]; // New field for real episodes
  freeEpisodesCount?: number; // New field for how many episodes are free
  description?: string;
  videoUrl?: string;
  previewUrl?: string;
  totalDuration?: string;
  subtitleUrl?: string; // Default subtitle for first episode or series trailer
  previewDuration?: string;
  episodeDuration?: string;
  isMiniSeries?: boolean;
  isFree?: boolean;
  isHero?: boolean;
  type?: 'Movie' | 'Series';
  coverUrl?: string;
  heroType?: 'video' | 'photo';
  heroVideoUrl?: string;
  heroPhotoUrl?: string;
  bunnyVideoId?: string;
  bunnyLibraryId?: string;
  createdAt?: number;
  episodesPerPart?: number;
  country?: string;
}

export function shortenGenre(genre?: string): string {
  if (!genre) return '';
  const g = genre.split(' · ')[0].trim();
  const map: Record<string, string> = {
    'Thriller': 'Thrill',
    'Action': 'Action',
    'Sci-Fi': 'Sci-Fi',
    'Romance': 'Romance',
    'Horror': 'Horror',
    'Drama': 'Drama',
    'Mystery': 'Mys.',
    'Fantasy': 'Fant.',
    'Indian Movies': 'Ind.',
    'Comedy': 'Comed.',
    'Adventure': 'Adv.',
    'Animation': 'Anim.',
    'Crime': 'Crime',
    'War': 'War',
  };
  return map[g] ?? g.substring(0, 5);
}

// ─── Poster images (Unsplash cinematic stills) ───────────────────────────────
export const ALL_GENRES = [
  'Action', 'Comedy', 'Drama', 'Sci-Fi', 'Horror', 'Romance', 'Thriller', 'Animation',
  'Documentary', 'Indian Movies', 'Adventure', 'Fantasy', 'Crime', 'Mystery', 'Biography', 
  'Sport', 'War', 'History'
];

export const ALL_VJS = [
  'Vj Junior', 'Vj Ice P', 'Vj Kevo', 'Vj HD', 'Vj Sammy', 'Vj Emmy', 'Vj Jovan',
  'Vj Tom', 'Vj Shao Khan', 'Vj Jingo', 'Vj Kevin', 'Vj Kriss Sweet', 'Vj Dan De',
  'Vj lvo', 'Vj Fredy', 'Vj Jumpers', 'Vj Ashim', 'Vj Pauleta', 'Vj Martin K',
  'Vj Henrico', 'Vj Uncle T', 'Vj Soul', 'Vj Nelly', 'Vj Isma K', 'Vj Little T',
  'Vj Mox', 'Vj Muba', 'Vj Eddy', 'Vj Kam', 'Vj Lance', 'Vj KS', 'Vj Ulio',
  'Vj Aaron', 'Vj Cabs', 'Vj Banks', 'Vj Jimmy', 'Vj Baros', 'Vj Kimuli',
  'Vj Mk'
];

const POSTERS = {
  p1:  'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400&q=80',
  p2:  'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400&q=80',
  p3:  'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=400&q=80',
  p4:  'https://images.unsplash.com/photo-1518676590629-3dcbd9c5a5c9?w=400&q=80',
  p5:  'https://images.unsplash.com/photo-1574267432553-4b4628081c31?w=400&q=80',
  p6:  'https://images.unsplash.com/photo-1594736797933-d0501ba2fe65?w=400&q=80',
  p7:  'https://images.unsplash.com/photo-1542204165-65bf26472b9b?w=400&q=80',
  p8:  'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=400&q=80',
  p9:  'https://images.unsplash.com/photo-1524712245354-2f2bf6f4c7c6?w=400&q=80',
  p10: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=400&q=80',
  p11: 'https://images.unsplash.com/photo-1533928298208-27ff66555d8d?w=400&q=80',
  p12: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80',
  p13: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=400&q=80',
  p14: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=400&q=80',
  p15: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80',
  p16: 'https://images.unsplash.com/photo-1560472355-109703aa3edc?w=400&q=80',
  p17: 'https://images.unsplash.com/photo-1606663889134-b1dedb5ed8b7?w=400&q=80',
  p18: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=400&q=80',
  p19: 'https://images.unsplash.com/photo-1501426026826-31c667bdf23d?w=400&q=80',
  p20: 'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=400&q=80',
};

function movie(id: string, title: string, year: number, genre: string, rating: string, vj: string, poster: string, duration: string, videoUrl?: string, parts?: { id: string; title: string; videoUrl?: string }[], isFree?: boolean): Movie {
  return { id, title, year, genre, rating, vj, poster, duration, videoUrl: resolveCDNUrl(videoUrl), parts, isFree };
}

export { resolveCDNUrl };

/**
 * Resolves the correct video stream URL for a movie or series.
 */
export const getStreamUrl = (item: Movie | Series | any): string => {
  if (!item) return '';

  // 1. Bunny.net HLS Stream if ID is present
  if (item.bunnyVideoId) {
    const libraryId = item.bunnyLibraryId || BUNNY_CONFIG.LIBRARY_ID;
    const pullZone = BUNNY_CONFIG.PULL_ZONE;
    return `https://${pullZone}/${item.bunnyVideoId}/playlist.m3u8`;
  }

  // 2. Direct Video URL (resolved via CDN if origin)
  if (item.videoUrl) {
    return resolveCDNUrl(item.videoUrl);
  }

  return '';
};

/**
 * Resolves the preview clip URL for a movie or series.
 */
export function getPreviewClipUrl(item: Movie | Series): string | null {
  if (!item) return null;
  return item.previewUrl || null;
}

// ─── Per-section lists ────────────────────────────────────────────────────────
// --- Internal Raw Data (Containing both Free and Paid) ---
const _RAW_NEW_RELEASES: Movie[] = [];

const _RAW_TRENDING: Movie[] = [];

const _RAW_MOST_DOWNLOADED: Movie[] = [];

const _RAW_LATEST: Movie[] = [];

// --- Public Filtered Arrays ---
export const FREE_CONTENT: (Movie | Series)[] = [
  ..._RAW_NEW_RELEASES.filter(m => m.isFree),
  ..._RAW_TRENDING.filter(m => m.isFree),
  ..._RAW_LATEST.filter(m => m.isFree),
];

export const NEW_RELEASES = _RAW_NEW_RELEASES.filter(m => !m.isFree);
export const TRENDING = _RAW_TRENDING.filter(m => !m.isFree);
export const MOST_DOWNLOADED = _RAW_MOST_DOWNLOADED.filter(m => !m.isFree);
export const LATEST = _RAW_LATEST.filter(m => !m.isFree);


export const CONTINUE_WATCHING: Movie[] = [];

export const FAVOURITES: Movie[] = [];

export const MY_LIST: Movie[] = [];

export const WATCH_LATER: Movie[] = [];

export const YOU_MAY_ALSO_LIKE: Movie[] = [];

export const LAST_WATCHED: Movie[] = []; // Filtered by logic
export const MOST_VIEWED: Movie[] = [];


const _RAW_ACTION_MOVIES: Movie[] = [];
export const ACTION_MOVIES = _RAW_ACTION_MOVIES.filter(m => !m.isFree);

const _RAW_SCIFI_MOVIES: Movie[] = [];
export const SCIFI_MOVIES = _RAW_SCIFI_MOVIES.filter(m => !m.isFree);


export const ROMANCE_MOVIES: Movie[] = [];

export const HORROR_MOVIES: Movie[] = [];

export const DRAMA_MOVIES: Movie[] = [];

export const INDIAN_MOVIES: Movie[] = [];

// ─── Extra VJ Mock Data ───────────────────────────────────────────────────
export const VJ_COLLECTION: Movie[] = [];

// ─── Hero movies ─────────────────────────────────
export interface HeroMovie {
  title: string;
  genre: string;
  rating: string;
  vj: string;
  year: number;
  duration: string;
  director: string;
  description: string;
  poster: string;
  videoUrl: string;
  heroVideoUrl?: string;
  heroPhotoUrl?: string;
  heroType?: 'video' | 'photo';
}

export const HERO_MOVIES: HeroMovie[] = [];



const _RAW_ALL_SERIES: Series[] = [];

export const ALL_SERIES = _RAW_ALL_SERIES.filter(s => !s.isFree);


export const TRENDING_SERIES = ALL_SERIES.slice(0, 6);
export const MOST_VIEWED_SERIES = ALL_SERIES.slice(10, 16);
export const MOST_DOWNLOADED_SERIES = ALL_SERIES.slice(6, 12);
export const NEW_SERIES = ALL_SERIES.slice(12, 18);

// ─── All section rows (constant, used globally) ──────────────────────
export const ALL_ROWS: { title: string; data: (Movie | Series)[] }[] = [
  { title: 'Free Movies',        data: FREE_CONTENT      },
  { title: 'New Releases',       data: [...NEW_RELEASES, ...NEW_SERIES] },
  { title: 'Trending Now',       data: TRENDING          },
  { title: 'K-Drama',            data: TRENDING          }, // Fallback data
  { title: 'Most Viewed',        data: MOST_VIEWED       },
  { title: 'Most Downloaded',    data: MOST_DOWNLOADED   },
  { title: 'Latest',             data: LATEST            },
  { title: 'Continue Watching',  data: CONTINUE_WATCHING },
  { title: 'Favourites',         data: FAVOURITES        },
  { title: 'My List',            data: MY_LIST           },
  { title: 'Watch Later',        data: WATCH_LATER       },
  { title: 'You May Also Like',  data: YOU_MAY_ALSO_LIKE },
  { title: 'Last Watched',       data: LAST_WATCHED      },
  { title: 'Action',             data: ACTION_MOVIES     },
  { title: 'Sci-Fi',             data: SCIFI_MOVIES      },
  { title: 'Romance',            data: ROMANCE_MOVIES    },
  { title: 'Horror',             data: HORROR_MOVIES     },
  { title: 'Drama',              data: DRAMA_MOVIES      },
  { title: 'Indian Movies',      data: INDIAN_MOVIES     },
  { title: 'VJ Collection',      data: VJ_COLLECTION     },
];

