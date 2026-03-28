// Shared movie data for the app
export const PROFILE_IMAGE_URI = 'file:///Users/hkfiles/.gemini/antigravity/brain/5158953f-ec3f-48ca-b11f-a59e93c7d094/haruna_profile_pic_1773179555861.png';

export interface Movie {
  id: string;
  title: string;
  year: number;
  genre: string;
  rating: string;
  vj: string;
  poster: string;
  duration: string;
  videoUrl?: string;
  parts?: { id: string; title: string; videoUrl?: string }[];
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
  totalDuration?: string;
  episodeDuration?: string;
  isMiniSeries?: boolean; // New field for mini-series
  videoUrl?: string;
}

export function shortenGenre(genre: string): string {
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

function movie(id: string, title: string, year: number, genre: string, rating: string, vj: string, poster: string, duration: string, videoUrl?: string, parts?: { id: string; title: string; videoUrl?: string }[]): Movie {
  return { id, title, year, genre, rating, vj, poster, duration, videoUrl, parts };
}

// ─── Per-section lists ────────────────────────────────────────────────────────
export const NEW_RELEASES: Movie[] = [
  movie('hr1', 'Heroes Part 1',   2023, 'Action',  '8.5', 'VJ Junior', POSTERS.p7,  '2h 00m', undefined, [
    { id: 'hr1-p1', title: 'Part 1: The Beginning', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4' },
    { id: 'hr1-p2', title: 'Part 2: The Rising', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4' },
    { id: 'hr1-p3', title: 'Part 3: The End', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4' },
  ]),
  movie('hr2', 'Heroes Part 2',   2026, 'Action',  '8.8', 'VJ Junior', POSTERS.p8,  '2h 10m'),
  movie('nr1', 'Neon Horizon',    2025, 'Sci-Fi',  '8.1', 'VJ Junior', POSTERS.p1,  '2h 14m'),
  movie('nr2', 'Dark Tide',       2025, 'Thriller','7.6', 'VJ Emmy',   POSTERS.p2,  '1h 58m'),
  movie('nr3', 'Solar Wind',      2025, 'Action',  '8.4', 'VJ Mark',   POSTERS.p3,  '2h 02m'),
  movie('nr4', 'After Hours',     2025, 'Drama',   '7.9', 'VJ Junior', POSTERS.p4,  '1h 45m'),
  movie('nr5', 'Ice Fortress',    2025, 'Action',  '7.3', 'VJ Emmy',   POSTERS.p5,  '2h 08m'),
  movie('nr6', 'The Quiet Room',  2025, 'Drama',   '8.2', 'VJ Mark',   POSTERS.p6,  '1h 52m'),
];

export const TRENDING: Movie[] = [
  movie('tr1', 'Orbital',         2024, 'Sci-Fi',  '9.0', 'VJ Mark',   POSTERS.p7,  '2h 22m'),
  movie('tr2', 'Wildfire',        2024, 'Action',  '8.3', 'VJ Junior', POSTERS.p8,  '2h 01m'),
  movie('tr3', 'Love & Static',   2024, 'Romance', '7.8', 'VJ Emmy',   POSTERS.p9,  '1h 48m'),
  movie('tr4', 'The Reckoning',   2024, 'Thriller','8.5', 'VJ Mark',   POSTERS.p10, '2h 15m'),
  movie('tr5', 'Phantom Signal',  2024, 'Mystery', '7.6', 'VJ Junior', POSTERS.p11, '1h 59m'),
  movie('tr6', 'Depths',          2024, 'Horror',  '8.0', 'VJ Emmy',   POSTERS.p12, '1h 37m'),
];

export const MOST_DOWNLOADED: Movie[] = [
  movie('md1', 'Inception 2',     2024, 'Sci-Fi',  '8.7', 'VJ Mark',   POSTERS.p13, '2h 30m'),
  movie('md2', 'The Final Hour',  2024, 'Action',  '8.1', 'VJ Junior', POSTERS.p14, '2h 05m'),
  movie('md3', 'Moonlighter',     2024, 'Romance', '7.5', 'VJ Emmy',   POSTERS.p15, '1h 44m'),
  movie('md4', 'Red Protocol',    2024, 'Thriller','8.3', 'VJ Mark',   POSTERS.p16, '1h 57m'),
  movie('md5', 'Ember',           2024, 'Drama',   '7.9', 'VJ Junior', POSTERS.p17, '2h 10m'),
  movie('md6', 'Silent Shore',    2024, 'Horror',  '7.4', 'VJ Emmy',   POSTERS.p18, '1h 41m'),
];

export const LATEST: Movie[] = [
  movie('lt1', 'Override',        2025, 'Sci-Fi',  '7.8', 'VJ Junior', POSTERS.p19, '1h 55m'),
  movie('lt2', 'Cascade Point',   2025, 'Action',  '8.0', 'VJ Emmy',   POSTERS.p20, '2h 09m'),
  movie('lt3', 'Velvet Noir',     2025, 'Mystery', '8.2', 'VJ Mark',   POSTERS.p1,  '1h 50m'),
  movie('lt4', 'Fractured Sky',   2025, 'Drama',   '7.6', 'VJ Junior', POSTERS.p2,  '2h 00m'),
  movie('lt5', 'The Undercroft',  2025, 'Horror',  '8.4', 'VJ Emmy',   POSTERS.p3,  '1h 38m'),
  movie('lt6', 'Parallel Lines',  2025, 'Romance', '7.7', 'VJ Mark',   POSTERS.p4,  '1h 47m'),
];

export const CONTINUE_WATCHING: Movie[] = [
  movie('cw1', 'Orbital',         2024, 'Sci-Fi',  '9.0', 'VJ Mark',   POSTERS.p7,  '2h 22m'),
  movie('cw2', 'Dark Tide',       2025, 'Thriller','7.6', 'VJ Emmy',   POSTERS.p2,  '1h 58m'),
  movie('cw3', 'Solar Wind',      2025, 'Action',  '8.4', 'VJ Mark',   POSTERS.p3,  '2h 02m'),
  movie('cw4', 'Velvet Noir',     2025, 'Mystery', '8.2', 'VJ Junior', POSTERS.p1,  '1h 50m'),
];

export const FAVOURITES: Movie[] = [
  movie('fv1', 'Wildfire',        2024, 'Action',  '8.3', 'VJ Junior', POSTERS.p8,  '2h 01m'),
  movie('fv2', 'The Reckoning',   2024, 'Thriller','8.5', 'VJ Mark',   POSTERS.p10, '2h 15m'),
  movie('fv3', 'Inception 2',     2024, 'Sci-Fi',  '8.7', 'VJ Mark',   POSTERS.p13, '2h 30m'),
  movie('fv4', 'After Hours',     2025, 'Drama',   '7.9', 'VJ Junior', POSTERS.p4,  '1h 45m'),
  movie('fv5', 'Ember',           2024, 'Drama',   '7.9', 'VJ Emmy',   POSTERS.p17, '2h 10m'),
];

export const MY_LIST: Movie[] = [
  movie('ml1', 'Neon Horizon',    2025, 'Sci-Fi',  '8.1', 'VJ Junior', POSTERS.p1,  '2h 14m'),
  movie('ml2', 'Love & Static',   2024, 'Romance', '7.8', 'VJ Emmy',   POSTERS.p9,  '1h 48m'),
  movie('ml3', 'Override',        2025, 'Sci-Fi',  '7.8', 'VJ Junior', POSTERS.p19, '1h 55m'),
  movie('ml4', 'Red Protocol',    2024, 'Thriller','8.3', 'VJ Mark',   POSTERS.p16, '1h 57m'),
  movie('ml5', 'Ice Fortress',    2025, 'Action',  '7.3', 'VJ Emmy',   POSTERS.p5,  '2h 08m'),
];

export const WATCH_LATER: Movie[] = [
  movie('wl1', 'Phantom Signal',  2024, 'Mystery', '7.6', 'VJ Mark',   POSTERS.p11, '1h 59m'),
  movie('wl2', 'Parallel Lines',  2025, 'Romance', '7.7', 'VJ Emmy',   POSTERS.p4,  '1h 47m'),
  movie('wl3', 'The Undercroft',  2025, 'Horror',  '8.4', 'VJ Mark',   POSTERS.p3,  '1h 38m'),
  movie('wl4', 'Silent Shore',    2024, 'Horror',  '7.4', 'VJ Junior', POSTERS.p18, '1h 41m'),
  movie('wl5', 'Cascade Point',   2025, 'Action',  '8.0', 'VJ Emmy',   POSTERS.p20, '2h 09m'),
];

export const YOU_MAY_ALSO_LIKE: Movie[] = [
  movie('ym1', 'Fractured Sky',   2025, 'Drama',   '7.6', 'VJ Junior', POSTERS.p2,  '2h 00m'),
  movie('ym2', 'Depths',          2024, 'Horror',  '8.0', 'VJ Emmy',   POSTERS.p12, '1h 37m'),
  movie('ym3', 'The Final Hour',  2024, 'Action',  '8.1', 'VJ Mark',   POSTERS.p14, '2h 05m'),
  movie('ym4', 'Moonlighter',     2024, 'Romance', '7.5', 'VJ Junior', POSTERS.p15, '1h 44m'),
  movie('ym5', 'The Quiet Room',  2025, 'Drama',   '8.2', 'VJ Emmy',   POSTERS.p6,  '1h 52m'),
  movie('ym6', 'Neon Horizon',    2025, 'Sci-Fi',  '8.1', 'VJ Mark',   POSTERS.p1,  '2h 14m'),
];

export const LAST_WATCHED: Movie[] = [
  movie('lw4', 'Orbital',         2024, 'Sci-Fi',  '9.0', 'VJ Mark',   POSTERS.p7,  '2h 22m'),
];

export const MOST_VIEWED: Movie[] = [
  movie('mv1', 'Neon Horizon',    2025, 'Sci-Fi',  '8.1', 'VJ Junior', POSTERS.p1,  '2h 14m'),
  movie('mv2', 'Wildfire',        2024, 'Action',  '8.3', 'VJ Mark',   POSTERS.p8,  '2h 01m'),
  movie('mv3', 'The Reckoning',   2024, 'Thriller','8.5', 'VJ Emmy',   POSTERS.p10, '2h 15m'),
  movie('mv4', 'Orbital',         2024, 'Sci-Fi',  '9.0', 'VJ Mark',   POSTERS.p7,  '2h 22m'),
  movie('mv5', 'Inception 2',     2024, 'Sci-Fi',  '8.7', 'VJ Junior', POSTERS.p13, '2h 30m'),
  movie('mv6', 'After Hours',     2025, 'Drama',   '7.9', 'VJ Emmy',   POSTERS.p4,  '1h 45m'),
];

export const ACTION_MOVIES: Movie[] = [
  movie('ac1', 'Solar Wind',      2025, 'Action',  '8.4', 'VJ Mark',   POSTERS.p3,  '2h 02m'),
  movie('ac2', 'Wildfire',        2024, 'Action',  '8.3', 'VJ Junior', POSTERS.p8,  '2h 01m'),
  movie('ac3', 'Ice Fortress',    2025, 'Action',  '7.3', 'VJ Emmy',   POSTERS.p5,  '2h 08m'),
  movie('ac4', 'The Final Hour',  2024, 'Action',  '8.1', 'VJ Mark',   POSTERS.p14, '2h 05m'),
  movie('ac5', 'Cascade Point',   2025, 'Action',  '8.0', 'VJ Junior', POSTERS.p20, '2h 09m'),
  movie('ac6', 'Override',        2025, 'Sci-Fi',  '7.8', 'VJ Emmy',   POSTERS.p19, '1h 55m'),
];

export const SCIFI_MOVIES: Movie[] = [
  movie('sf1', 'Neon Horizon',    2025, 'Sci-Fi',  '8.1', 'VJ Junior', POSTERS.p1,  '2h 14m'),
  movie('sf2', 'Orbital',         2024, 'Sci-Fi',  '9.0', 'VJ Mark',   POSTERS.p7,  '2h 22m'),
  movie('sf3', 'Inception 2',     2024, 'Sci-Fi',  '8.7', 'VJ Mark',   POSTERS.p13, '2h 30m'),
  movie('sf4', 'Override',        2025, 'Sci-Fi',  '7.8', 'VJ Junior', POSTERS.p19, '1h 55m'),
  movie('sf5', 'Phantom Signal',  2024, 'Mystery', '7.6', 'VJ Emmy',   POSTERS.p11, '1h 59m'),
  movie('sf6', 'Fractured Sky',   2025, 'Drama',   '7.6', 'VJ Emmy',   POSTERS.p2,  '2h 00m'),
];

export const ROMANCE_MOVIES: Movie[] = [
  movie('ro1', 'Love & Static',   2024, 'Romance', '7.8', 'VJ Emmy',   POSTERS.p9,  '1h 48m'),
  movie('ro2', 'Parallel Lines',  2025, 'Romance', '7.7', 'VJ Mark',   POSTERS.p4,  '1h 47m'),
  movie('ro3', 'Moonlighter',     2024, 'Romance', '7.5', 'VJ Junior', POSTERS.p15, '1h 44m'),
  movie('ro4', 'The Quiet Room',  2025, 'Drama',   '8.2', 'VJ Emmy',   POSTERS.p6,  '1h 52m'),
  movie('ro5', 'Velvet Noir',     2025, 'Mystery', '8.2', 'VJ Mark',   POSTERS.p1,  '1h 50m'),
  movie('ro6', 'Ember',           2024, 'Drama',   '7.9', 'VJ Emmy',   POSTERS.p17, '2h 10m'),
];

export const HORROR_MOVIES: Movie[] = [
  movie('ho1', 'Depths',          2024, 'Horror',  '8.0', 'VJ Emmy',   POSTERS.p12, '1h 37m'),
  movie('ho2', 'Silent Shore',    2024, 'Horror',  '7.4', 'VJ Junior', POSTERS.p18, '1h 41m'),
  movie('ho3', 'The Undercroft',  2025, 'Horror',  '8.4', 'VJ Mark',   POSTERS.p3,  '1h 38m'),
  movie('ho4', 'Dark Tide',       2025, 'Thriller','7.6', 'VJ Emmy',   POSTERS.p2,  '1h 58m'),
  movie('ho5', 'The Reckoning',   2024, 'Thriller','8.5', 'VJ Mark',   POSTERS.p10, '2h 15m'),
  movie('ho6', 'Red Protocol',    2024, 'Thriller','8.3', 'VJ Mark',   POSTERS.p16, '1h 57m'),
];

export const DRAMA_MOVIES: Movie[] = [
  movie('dr1', 'After Hours',     2025, 'Drama',   '7.9', 'VJ Junior', POSTERS.p4,  '1h 45m'),
  movie('dr2', 'The Quiet Room',  2025, 'Drama',   '8.2', 'VJ Emmy',   POSTERS.p6,  '1h 52m'),
  movie('dr3', 'Ember',           2024, 'Drama',   '7.9', 'VJ Emmy',   POSTERS.p17, '2h 10m'),
  movie('dr4', 'Fractured Sky',   2025, 'Drama',   '7.6', 'VJ Junior', POSTERS.p2,  '2h 00m'),
  movie('dr5', 'The Final Hour',  2024, 'Action',  '8.1', 'VJ Mark',   POSTERS.p14, '2h 05m'),
  movie('dr6', 'Velvet Noir',     2025, 'Mystery', '8.2', 'VJ Mark',   POSTERS.p1,  '1h 50m'),
];

export const INDIAN_MOVIES: Movie[] = [
  movie('in1', 'Dil Se Dil Tak',    2024, 'Romance', '8.0', 'VJ Junior', POSTERS.p10, '2h 35m'),
  movie('in2', 'Rang De Basanti 2', 2024, 'Drama',   '8.5', 'VJ Emmy',   POSTERS.p8,  '2h 48m'),
  movie('in3', 'Pushpa 3',          2025, 'Action',  '8.2', 'VJ Mark',   POSTERS.p11, '2h 52m'),
  movie('in4', 'RRR 2',             2025, 'Action',  '8.8', 'VJ Junior', POSTERS.p7,  '3h 05m'),
  movie('in5', 'Brahmastra 2',      2025, 'Fantasy', '7.9', 'VJ Emmy',   POSTERS.p13, '2h 40m'),
  movie('in6', 'Kalki Returns',     2025, 'Sci-Fi',  '8.6', 'VJ Mark',   POSTERS.p19, '2h 30m'),
];

// ─── Extra VJ Mock Data ───────────────────────────────────────────────────
export const VJ_COLLECTION: Movie[] = [
  // Vj Ice P
  movie('ice1', 'Frostbite', 2025, 'Action', '8.4', 'Vj Ice P', POSTERS.p1, '2h 05m'),
  movie('ice2', 'Glacier Run', 2025, 'Thriller', '7.9', 'Vj Ice P', POSTERS.p2, '1h 55m'),
  movie('ice3', 'Cold Case', 2024, 'Mystery', '8.1', 'Vj Ice P', POSTERS.p3, '2h 10m'),
  movie('ice4', 'Zero Degrees', 2024, 'Drama', '7.5', 'Vj Ice P', POSTERS.p4, '1h 48m'),
  movie('ice5', 'Winter Soldier', 2024, 'Action', '8.9', 'Vj Ice P', POSTERS.p5, '2h 15m'),
  movie('ice6', 'Frozen Hearts', 2024, 'Romance', '7.2', 'Vj Ice P', POSTERS.p6, '1h 59m'),
  movie('ice7', 'Snowbound', 2023, 'Horror', '7.0', 'Vj Ice P', POSTERS.p7, '1h 35m'),
  movie('ice8', 'Arctic Hunt', 2023, 'Adventure', '7.8', 'Vj Ice P', POSTERS.p8, '2h 02m'),
  movie('ice9', 'North Star', 2023, 'Sci-Fi', '8.3', 'Vj Ice P', POSTERS.p9, '2h 20m'),
  movie('ice10', 'Ice Age X', 2022, 'Animation', '8.0', 'Vj Ice P', POSTERS.p10, '1h 40m'),

  // Vj Kevo
  movie('kev1', 'Key Point', 2025, 'Thriller', '8.2', 'Vj Kevo', POSTERS.p11, '2h 00m'),
  movie('kev2', 'Kingdom Come', 2025, 'Action', '7.7', 'Vj Kevo', POSTERS.p12, '2h 12m'),
  movie('kev3', 'Knowledge', 2024, 'Documentary', '9.1', 'Vj Kevo', POSTERS.p13, '1h 50m'),
  movie('kev4', 'Karma', 2024, 'Drama', '8.4', 'Vj Kevo', POSTERS.p14, '2h 05m'),
  movie('kev5', 'Knight Fall', 2024, 'Action', '7.8', 'Vj Kevo', POSTERS.p15, '2h 18m'),
  movie('kev6', 'K-Pop Star', 2024, 'Romance', '7.5', 'Vj Kevo', POSTERS.p16, '1h 55m'),
  movie('kev7', 'Kickboxer', 2023, 'Action', '7.6', 'Vj Kevo', POSTERS.p17, '1h 45m'),
  movie('kev8', 'Kindred', 2023, 'Horror', '8.0', 'Vj Kevo', POSTERS.p18, '1h 52m'),
  movie('kev9', 'Kinetic', 2023, 'Sci-Fi', '8.5', 'Vj Kevo', POSTERS.p19, '2h 08m'),
  movie('kev10', 'Kingsman 3', 2022, 'Action', '8.1', 'Vj Kevo', POSTERS.p20, '2h 25m'),

  // Vj Jingo
  movie('jin1', 'Jungle War', 2025, 'Action', '8.5', 'Vj Jingo', POSTERS.p1, '2h 10m'),
  movie('jin2', 'Justice', 2025, 'Drama', '8.0', 'Vj Jingo', POSTERS.p2, '1h 58m'),
  movie('jin3', 'Jester', 2024, 'Comedy', '7.4', 'Vj Jingo', POSTERS.p3, '1h 45m'),
  movie('jin4', 'Journey', 2024, 'Adventure', '8.2', 'Vj Jingo', POSTERS.p4, '2h 20m'),
  movie('jin5', 'Jigsaw', 2024, 'Horror', '7.9', 'Vj Jingo', POSTERS.p5, '1h 40m'),
  movie('jin6', 'Joker 2', 2024, 'Thriller', '8.8', 'Vj Jingo', POSTERS.p6, '2h 05m'),
  movie('jin7', 'Jupiter', 2023, 'Sci-Fi', '7.6', 'Vj Jingo', POSTERS.p7, '2h 15m'),
  movie('jin8', 'Judgment', 2023, 'Crime', '8.1', 'Vj Jingo', POSTERS.p8, '2h 00m'),
  movie('jin9', 'Jinx', 2023, 'Mystery', '7.3', 'Vj Jingo', POSTERS.p9, '1h 52m'),
  movie('jin10', 'Junkyard', 2022, 'Action', '7.0', 'Vj Jingo', POSTERS.p10, '1h 55m'),

  // Vj Ulio
  movie('uli1', 'Ultimate', 2025, 'Action', '8.6', 'Vj Ulio', POSTERS.p11, '2h 15m'),
  movie('uli2', 'Underworld', 2025, 'Fantasy', '7.8', 'Vj Ulio', POSTERS.p12, '2h 08m'),
  movie('uli3', 'Utopia', 2024, 'Sci-Fi', '8.2', 'Vj Ulio', POSTERS.p13, '1h 55m'),
  movie('uli4', 'Unit', 2024, 'Drama', '7.5', 'Vj Ulio', POSTERS.p14, '2h 00m'),
  movie('uli5', 'Unveiled', 2024, 'Documentary', '8.9', 'Vj Ulio', POSTERS.p15, '1h 48m'),
  movie('uli6', 'Uproar', 2024, 'Comedy', '7.1', 'Vj Ulio', POSTERS.p16, '1h 42m'),
  movie('uli7', 'Urban', 2023, 'Crime', '8.3', 'Vj Ulio', POSTERS.p17, '1h 57m'),
  movie('uli8', 'Urgent', 2023, 'Thriller', '7.9', 'Vj Ulio', POSTERS.p18, '1h 50m'),
  movie('uli9', 'Universe', 2023, 'Sci-Fi', '8.5', 'Vj Ulio', POSTERS.p19, '2h 20m'),
  movie('uli10', 'Us', 2022, 'Horror', '8.0', 'Vj Ulio', POSTERS.p20, '1h 55m'),

  // Vj HD
  movie('hd1', 'High Definition', 2025, 'Action', '8.8', 'Vj HD', POSTERS.p1, '2h 10m'),
  movie('hd2', 'Hard Drive', 2025, 'Sci-Fi', '8.1', 'Vj HD', POSTERS.p2, '2h 00m'),
  movie('hd3', 'Heart Beat', 2024, 'Romance', '7.9', 'Vj HD', POSTERS.p3, '1h 52m'),
  movie('hd4', 'Hidden', 2024, 'Mystery', '8.3', 'Vj HD', POSTERS.p4, '2h 05m'),
  movie('hd5', 'Horizon', 2024, 'Adventure', '7.6', 'Vj HD', POSTERS.p5, '2h 12m'),
  movie('hd6', 'Humanity', 2024, 'Drama', '8.5', 'Vj HD', POSTERS.p6, '2h 15m'),
  movie('hd7', 'Hostile', 2023, 'Thriller', '8.0', 'Vj HD', POSTERS.p7, '1h 58m'),
  movie('hd8', 'Hunter', 2023, 'Action', '7.5', 'Vj HD', POSTERS.p8, '2h 02m'),
  movie('hd9', 'Hybrid', 2023, 'Sci-Fi', '8.2', 'Vj HD', POSTERS.p9, '2h 08m'),
  movie('hd10', 'Hype', 2022, 'Comedy', '7.2', 'Vj HD', POSTERS.p10, '1h 45m'),

  // Vj Mk
  movie('mk1', 'Mark One', 2025, 'Action', '8.4', 'Vj Mk', POSTERS.p11, '2h 10m'),
  movie('mk2', 'Master Key', 2025, 'Thriller', '7.9', 'Vj Mk', POSTERS.p12, '1h 55m'),
  movie('mk3', 'Mind Map', 2024, 'Sci-Fi', '8.1', 'Vj Mk', POSTERS.p13, '2h 05m'),
  movie('mk4', 'Metropolis', 2024, 'Drama', '8.7', 'Vj Mk', POSTERS.p14, '2h 20m'),
  movie('mk5', 'Mission', 2024, 'Action', '8.0', 'Vj Mk', POSTERS.p15, '2h 15m'),
  movie('mk6', 'Moonlight', 2024, 'Romance', '7.5', 'Vj Mk', POSTERS.p16, '1h 50m'),
  movie('mk7', 'Midnight', 2023, 'Horror', '7.3', 'Vj Mk', POSTERS.p17, '1h 48m'),
  movie('mk8', 'Museum', 2023, 'Mystery', '8.2', 'Vj Mk', POSTERS.p18, '2h 00m'),
  movie('mk9', 'Matrix 5', 2023, 'Sci-Fi', '7.8', 'Vj Mk', POSTERS.p19, '2h 30m'),
  movie('mk10', 'Mercy', 2022, 'Drama', '8.1', 'Vj Mk', POSTERS.p20, '2h 05m'),

  // Vj Little T
  movie('lt10', 'Little Giant', 2025, 'Drama', '8.5', 'Vj Little T', POSTERS.p1, '2h 00m'),
  movie('lt11', 'T-Minus One', 2025, 'Thriller', '8.0', 'Vj Little T', POSTERS.p2, '1h 52m'),
  movie('lt12', 'Tiny Hero', 2024, 'Animation', '7.8', 'Vj Little T', POSTERS.p3, '1h 40m'),
  movie('lt13', 'The Trace', 2024, 'Crime', '8.2', 'Vj Little T', POSTERS.p4, '2h 05m'),
  movie('lt14', 'Time Trap', 2024, 'Sci-Fi', '7.6', 'Vj Little T', POSTERS.p5, '1h 58m'),
  movie('lt15', 'Thunder', 2024, 'Action', '8.4', 'Vj Little T', POSTERS.p6, '2h 10m'),
  movie('lt16', 'Trust', 2023, 'Drama', '8.9', 'Vj Little T', POSTERS.p7, '2h 15m'),
  movie('lt17', 'Terror', 2023, 'Horror', '7.4', 'Vj Little T', POSTERS.p8, '1h 45m'),
  movie('lt18', 'Taxi', 2023, 'Comedy', '7.1', 'Vj Little T', POSTERS.p9, '1h 50m'),
  movie('lt19', 'Tidal Wave', 2022, 'Action', '8.0', 'Vj Little T', POSTERS.p10, '2h 08m'),
];

// ─── 9 looping hero video sources ────────────────────────────────────────────
export const HERO_VIDEOS = [
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
];

// ─── Hero movies — one per HERO_VIDEOS entry ─────────────────────────────────
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
}

export const HERO_MOVIES: HeroMovie[] = [
  {
    title: 'Orbital',
    genre: 'Sci-Fi · Thriller',
    rating: '9.0',
    vj: 'VJ Mark',
    year: 2024,
    duration: '2h 22m',
    director: 'J. Tan',
    description: 'A crew of astronauts discovers an ancient signal orbiting Earth — one that rewrites everything humanity knows about its origins.',
    poster: POSTERS.p7,
    videoUrl: HERO_VIDEOS[0],
  },
  {
    title: 'Neon Horizon',
    genre: 'Action · Sci-Fi',
    rating: '8.1',
    vj: 'VJ Junior',
    year: 2025,
    duration: '2h 14m',
    director: 'K. Sato',
    description: 'In a futuristic Tokyo, a low-level data courier becomes the target of a corporate-wide manhunt after discovering a cryptic drive.',
    poster: POSTERS.p1,
    videoUrl: HERO_VIDEOS[1],
  },
  {
    title: 'The Reckoning',
    genre: 'Mystery · Thriller',
    rating: '8.5',
    vj: 'VJ Emmy',
    year: 2024,
    duration: '2h 15m',
    director: 'L. Ross',
    description: 'A former detective is pulled back into the world of crime when a series of murders mimics a case they thought was closed ten years ago.',
    poster: POSTERS.p10,
    videoUrl: HERO_VIDEOS[2],
  },
  {
    title: 'The Great Escape',
    genre: 'Drama · Adventure',
    rating: '8.5',
    vj: 'VJ Junior',
    year: 2024,
    duration: '2h 15m',
    director: 'S. Okafor',
    description: 'A daring jailbreak across three continents pushes five strangers to their limits — and forces them to trust each other or perish.',
    poster: POSTERS.p11,
    videoUrl: HERO_VIDEOS[3],
  },
  {
    title: 'Wild at Heart',
    genre: 'Comedy · Romance',
    rating: '7.4',
    vj: 'VJ Emmy',
    year: 2025,
    duration: '1h 52m',
    director: 'L. Park',
    description: 'Two opposites get stranded on a remote island after a film shoot goes sideways. Chaos, laughter, and unexpected love ensue.',
    poster: POSTERS.p9,
    videoUrl: HERO_VIDEOS[4],
  },
  {
    title: 'Joyride',
    genre: 'Action · Comedy',
    rating: '7.8',
    vj: 'VJ Mark',
    year: 2025,
    duration: '1h 58m',
    director: 'A. Torres',
    description: 'A stolen supercar, three best friends, and one very angry crime boss — buckle up for the wildest 48 hours of their lives.',
    poster: POSTERS.p14,
    videoUrl: HERO_VIDEOS[5],
  },
  {
    title: 'Meltdown',
    genre: 'Sci-Fi · Horror',
    rating: '8.3',
    vj: 'VJ Junior',
    year: 2024,
    duration: '2h 10m',
    director: 'D. Walsh',
    description: 'A reactor failure inside an undersea colony triggers a countdown. The crew must choose who survives when there isn\'t enough air for everyone.',
    poster: POSTERS.p2,
    videoUrl: HERO_VIDEOS[6],
  },
  {
    title: 'Off the Grid',
    genre: 'Adventure · Drama',
    rating: '8.0',
    vj: 'VJ Emmy',
    year: 2025,
    duration: '2h 00m',
    director: 'N. Subaru',
    description: 'A solo expedition through the wilderness turns into a survival story that questions what it means to be truly free in the modern world.',
    poster: POSTERS.p4,
    videoUrl: HERO_VIDEOS[7],
  },
  {
    title: 'Tears of Steel',
    genre: 'Sci-Fi · Action',
    rating: '8.7',
    vj: 'VJ Mark',
    year: 2024,
    duration: '2h 28m',
    director: 'I. Goralczyk',
    description: 'In a fractured future Amsterdam, warriors and scientists make a last desperate stand to reclaim humanity from robot overlords.',
    poster: POSTERS.p19,
    videoUrl: HERO_VIDEOS[8],
  },
];



export const ALL_SERIES: Series[] = [
  // Sci-Fi
  { id: 's1',  title: 'Dark Matter',       genre: 'Sci-Fi',   seasons: 2, year: 2024, rating: '8.8', vj: 'VJ Junior', status: 'Ongoing', poster: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=400&q=80', episodes: 8, totalDuration: '18h 30m', episodeDuration: '45m' },
  { id: 's2',  title: 'Severance',         genre: 'Sci-Fi',   seasons: 2, year: 2022, rating: '8.7', vj: 'VJ Emmy',   status: 'Ongoing', poster: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&q=80', episodes: 9, totalDuration: '17h 15m', episodeDuration: '50m' },
  { id: 's3',  title: 'Westworld',         genre: 'Sci-Fi',   seasons: 4, year: 2016, rating: '8.5', vj: 'VJ Mark',   status: 'Ended',   poster: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=400&q=80', episodes: 10, totalDuration: '36h 00m', episodeDuration: '60m' },
  { id: 's4',  title: 'The Expanse',       genre: 'Sci-Fi',   seasons: 6, year: 2015, rating: '8.5', vj: 'VJ Junior', status: 'Ended',   poster: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=400&q=80', episodes: 13, totalDuration: '48h 20m', episodeDuration: '45m' },
  // Thriller
  { id: 's5',  title: 'Slow Horses',       genre: 'Thriller', seasons: 4, year: 2022, rating: '8.7', vj: 'VJ Emmy',   status: 'Ongoing', poster: 'https://images.unsplash.com/photo-1509281373149-e957c6296406?w=400&q=80', episodes: 6, totalDuration: '24h 00m', episodeDuration: '42m' },
  { id: 's6',  title: 'True Detective',    genre: 'Thriller', seasons: 4, year: 2014, rating: '8.9', vj: 'VJ Mark',   status: 'Ongoing', poster: 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=400&q=80', episodes: 8, totalDuration: '32h 45m', episodeDuration: '55m' },
  { id: 's7',  title: 'The Bear',          genre: 'Thriller', seasons: 3, year: 2022, rating: '9.1', vj: 'VJ Junior', status: 'Ongoing', poster: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&q=80', episodes: 10, totalDuration: '15h 10m', episodeDuration: '30m' },
  // Drama
  { id: 's8',  title: 'Succession',        genre: 'Drama',    seasons: 4, year: 2018, rating: '8.9', vj: 'VJ Emmy',   status: 'Ended',   poster: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=400&q=80', episodes: 10, totalDuration: '39h 20m', episodeDuration: '60m' },
  { id: 's9',  title: 'The Crown',         genre: 'Drama',    seasons: 6, year: 2016, rating: '8.7', vj: 'VJ Mark',   status: 'Ended',   poster: 'https://images.unsplash.com/photo-1533929736458-ca588d08c8be?w=400&q=80', episodes: 10, totalDuration: '60h 00m', episodeDuration: '58m' },
  { id: 's10', title: 'House of the Dragon', genre: 'Drama',  seasons: 2, year: 2022, rating: '8.5', vj: 'VJ Junior', status: 'Ongoing', poster: 'https://images.unsplash.com/photo-1518676590629-3dcbd9c5a5c9?w=400&q=80', episodes: 8, totalDuration: '19h 30m', episodeDuration: '62m' },
  // Action
  { id: 's11', title: 'The Last of Us',    genre: 'Action',   seasons: 2, year: 2023, rating: '8.8', vj: 'VJ Emmy',   status: 'Ongoing', poster: 'https://images.unsplash.com/photo-1552820728-8b83bb6b773f?w=400&q=80', episodes: 9, totalDuration: '14h 25m', episodeDuration: '50m' },
  { id: 's12', title: 'Reacher',           genre: 'Action',   seasons: 3, year: 2022, rating: '8.1', vj: 'VJ Mark',   status: 'Ongoing', poster: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400&q=80', episodes: 8, totalDuration: '24h 15m', episodeDuration: '48m' },
  { id: 's13', title: 'Jack Ryan',         genre: 'Action',   seasons: 4, year: 2018, rating: '8.0', vj: 'VJ Junior', status: 'Ended',   poster: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=400&q=80', episodes: 8, totalDuration: '30h 40m', episodeDuration: '45m' },
  // Horror
  { id: 's17', title: 'Heartstopper',      genre: 'Romance',  seasons: 3, year: 2022, rating: '8.7', vj: 'VJ Junior', status: 'Ongoing', poster: 'https://images.unsplash.com/photo-1518676590629-3dcbd9c5a5c9?w=400&q=80', episodes: 8, totalDuration: '12h 00m', episodeDuration: '30m' },
  // Indian
  { id: 's18', title: 'Mirzapur',          genre: 'Indian Movies',   seasons: 3, year: 2018, rating: '8.4', vj: 'VJ Mark',   status: 'Ongoing', poster: 'https://images.unsplash.com/photo-1524712245354-2f2bf6f4c7c6?w=400&q=80', episodes: 10, totalDuration: '27h 30m', episodeDuration: '50m' },
  { id: 's19', title: 'Sacred Games',      genre: 'Indian Movies',   seasons: 2, year: 2018, rating: '8.7', vj: 'VJ Emmy',   status: 'Ended',   poster: 'https://images.unsplash.com/photo-1593347535555-fe0c7d1fa9e9?w=400&q=80', episodes: 8, totalDuration: '16h 00m', episodeDuration: '48m' },
  { id: 's20', title: 'Delhi Crime',       genre: 'Indian Movies',   seasons: 3, year: 2019, rating: '8.5', vj: 'VJ Junior', status: 'Ongoing', poster: 'https://images.unsplash.com/photo-1524492412937-b28074a47d70?w=400&q=80', episodes: 7, totalDuration: '18h 45m', episodeDuration: '50m' },
  { id: 's21', title: 'The Long Voyage',   genre: 'Adventure',       seasons: 12, year: 2020, rating: '8.2', vj: 'VJ Sammy',  status: 'Ended',   poster: 'https://images.unsplash.com/photo-1501426026826-31c667bdf23d?w=400&q=80', episodes: 12, totalDuration: '96h 00m', episodeDuration: '45m' },
  { id: 's22', title: 'Cyber City',        genre: 'Sci-Fi',          seasons: 22, year: 2018, rating: '8.9', vj: 'VJ HD',     status: 'Ongoing', poster: 'https://images.unsplash.com/photo-1533928298208-27ff66555d8d?w=400&q=80', episodes: 10, totalDuration: '180h 00m', episodeDuration: '50m' },
  { id: 's23', title: 'Eternal Flame',     genre: 'Drama',           seasons: 28, year: 2015, rating: '9.0', vj: 'VJ Junior', status: 'Ended',   poster: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=400&q=80', episodes: 12, totalDuration: '240h 00m', episodeDuration: '55m' },
  { id: 's24', title: 'Chernobyl',         genre: 'Drama',           seasons: 1,  year: 2019, rating: '9.4', vj: 'VJ Mark',   status: 'Ended',   poster: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=400&q=80', episodes: 5,  totalDuration: '5h 30m',   episodeDuration: '60m', isMiniSeries: true },
];

export const TRENDING_SERIES = ALL_SERIES.slice(0, 6);
export const MOST_VIEWED_SERIES = ALL_SERIES.slice(10, 16);
export const MOST_DOWNLOADED_SERIES = ALL_SERIES.slice(6, 12);
export const NEW_SERIES = ALL_SERIES.slice(12, 18);

// ─── All section rows (constant, used globally) ──────────────────────
export const ALL_ROWS: { title: string; data: (Movie | Series)[] }[] = [
  { title: 'New Releases',       data: [...NEW_RELEASES, ...NEW_SERIES] },
  { title: 'Trending Now',       data: TRENDING          },
  { title: 'Trending VJs',       data: TRENDING          }, // Destination for VJ notification
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

