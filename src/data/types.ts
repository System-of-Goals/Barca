// Shape of the data the site reads. Today it is filled with sample data;
// later a scheduled job writes the same shape from the real data sources.

export type Competition = 'laliga' | 'ucl' | 'copa' | 'supercopa';

export interface Team {
  name: string; // Hebrew display name
  crest?: string; // image URL; a placeholder is drawn when missing
}

export interface Match {
  id: string;
  competition: Competition;
  round: string; // e.g. "מחזור 14"
  kickoff: string; // ISO time (UTC); shown in Israel time
  venue: string;
  home: boolean; // true when Barcelona plays at home
  opponent: Team;
  status: 'scheduled' | 'live' | 'finished';
  barcaGoals?: number;
  opponentGoals?: number;
  minute?: number; // while live
}

export interface StandingSummary {
  competition: Competition;
  position: number;
  points: number;
  played: number;
  note?: string; // e.g. "2 נק׳ לפני ריאל מדריד"
}

export interface Leader {
  playerId: string;
  name: string;
  photo?: string;
  value: number;
}

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  publishedAt: string; // ISO
  image?: string;
  url: string;
}

export interface HistoryEvent {
  year: number;
  text: string;
}

export interface SiteData {
  isSample: boolean;
  updatedAt: string; // ISO
  matches: Match[]; // the whole season, any order
  standings: StandingSummary[];
  topScorer: Leader;
  topAssister: Leader;
  todayInHistory?: HistoryEvent;
  news: NewsItem[];
}
