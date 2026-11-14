// Shape of the data the site reads. scripts/fetch-data.mjs writes it to
// public/data/site.json; the sample data is used when that file is missing.

export interface Team {
  name: string; // Hebrew display name
  crest?: string; // image URL; a placeholder is drawn when missing
}

export interface Match {
  id: string;
  competition: string; // Hebrew name, e.g. "לה ליגה"
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
  competition: string;
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
  competition?: string; // which competition the count is for
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
  crest?: string; // club crest, relative to the site root
  matches: Match[]; // the whole season, any order
  standings: StandingSummary[];
  topScorer?: Leader;
  topAssister?: Leader;
  todayInHistory?: HistoryEvent;
  news: NewsItem[];
}
