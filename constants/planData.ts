export interface Plan {
  id: string;
  name: string;
  price: string;
  currency: string;
  tag: string | null;
  color: string;
  glowColor: string;
  ctaSuffix: string;
  specs: string[];
  bonusDays: number | string;
  deviceLimit: number;
  downloadLimit: number;
  durationDays: number;
}

export const PLANS: Plan[] = [
  {
    id: 'week_1',
    name: '1 week',
    price: '2,500',
    currency: 'Ugx',
    tag: null,
    color: '#6366f1',
    glowColor: 'rgba(99, 102, 241, 0.4)',
    ctaSuffix: 'AS LOW AS 357 Ugx A DAY',
    specs: ['FHD / HD Streaming', 'Unlimited movies and series', 'Ad-free experience', 'Access to all content', 'Unlimited in-app download', '1 external download', '1 device'],
    bonusDays: '+1 DAY EXTRA',
    deviceLimit: 1,
    downloadLimit: 1,
    durationDays: 8,
  },
  {
    id: 'weeks_2',
    name: '2 weeks',
    price: '5,000',
    currency: 'Ugx',
    tag: 'MOST POPULAR',
    color: '#8338ec',
    glowColor: 'rgba(131, 56, 236, 0.5)',
    ctaSuffix: 'AS LOW AS 357 Ugx A DAY',
    specs: ['FHD / HD Streaming', 'Unlimited movies and series', 'Ad-free experience', 'Access to all content', 'Unlimited in-app download', '2 external downloads', '1 device'],
    bonusDays: '+2 DAYS EXTRA',
    deviceLimit: 1,
    downloadLimit: 2,
    durationDays: 16,
  },
  {
    id: 'month_1',
    name: '1 Month',
    price: '10,000',
    currency: 'Ugx',
    tag: 'BEST VALUE',
    color: '#ff006e',
    glowColor: 'rgba(255, 0, 110, 0.5)',
    ctaSuffix: 'AS LOW AS 333 Ugx A DAY',
    specs: ['FHD / HD Streaming', 'Unlimited movies and series', 'Ad-free', 'Access all content', 'Unlimited in-app download', '3 external downloads', '2 devices'],
    bonusDays: '+4 DAYS EXTRA',
    deviceLimit: 2,
    downloadLimit: 3,
    durationDays: 34,
  },
  {
    id: 'months_2',
    name: '2 months',
    price: '20,000',
    currency: 'Ugx',
    tag: 'EXCLUSIVE',
    color: '#fb5607',
    glowColor: 'rgba(251, 86, 7, 0.5)',
    ctaSuffix: 'AS LOW AS 333 A DAY',
    specs: ['FHD / HD Streaming', 'Unlimited movies and series', 'Ad-free', 'Access all content', 'Unlimited in-app download', '5 external downloads', '3 devices'],
    bonusDays: '+1 WEEK EXTRA',
    deviceLimit: 3,
    downloadLimit: 5,
    durationDays: 67,
  }
];
