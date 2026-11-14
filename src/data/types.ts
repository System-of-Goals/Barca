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

// Details of a single match: public/data/matches/<id>.json
export interface MatchEvent {
  minute: string;
  side: 'barca' | 'opp';
  kind: 'goal' | 'yellow' | 'red' | 'sub' | 'other';
  label: string; // Hebrew, from the source
  player?: string;
  extra: string[]; // assist, or the player coming on
}

export interface LineupPlayer {
  id: string;
  name: string;
  number?: number;
  starting: boolean;
  position?: string;
  line?: number; // 0 = own goal line … 100 = opponent's
  side?: number; // 0 = left touchline … 100 = right (facing the attack)
  rating?: number;
  photo?: string;
}

export interface Lineup {
  formation?: string;
  players: LineupPlayer[];
}

export interface MatchStat {
  name: string;
  barca: string;
  opp: string;
  barcaShare?: number; // 0..1
}

export interface MatchDetail {
  id: string;
  venue?: string;
  attendance?: number;
  referee?: string;
  events: MatchEvent[];
  lineups: { barca?: Lineup; opp?: Lineup };
  stats: MatchStat[];
}

// public/data/tables.json: one entry per competition Barcelona plays in.
export interface TableRow {
  position: number;
  team: string;
  crest?: string;
  barca: boolean;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  form: ('win' | 'draw' | 'loss')[];
}

export interface RankingRow {
  playerId: string;
  name: string;
  team?: string;
  barca: boolean;
  value: string;
  photo?: string;
}

export interface Ranking {
  name: string; // e.g. "שערים"
  rows: RankingRow[];
}

export interface CompetitionTables {
  competition: string;
  rows: TableRow[]; // empty for cups
  barcaRankings: Ranking[];
  allRankings: Ranking[];
}

// public/data/players.json: the squad and each player's season.
export interface SeasonStats {
  apps: number;
  starts: number;
  minutes: number;
  goals: number;
  assists: number;
  yellow: number;
  red: number;
  rating?: number; // average
}

export interface Player {
  id: string;
  name: string;
  fullName: string;
  number?: number;
  position?: string; // שוער / מגן / קשר / חלוץ
  detailedPosition?: string;
  age?: number;
  birthdate?: string;
  height?: number;
  nationality?: string;
  photo?: string;
  season?: SeasonStats;
  byCompetition?: (SeasonStats & { competition: string })[];
  // From Wikidata
  career?: CareerSpell[];
  awards?: { name?: string; year?: number }[];
  wikipedia?: string;
}

export interface CareerSpell {
  team?: string;
  from?: number;
  to?: number; // missing = still there
  apps?: number;
  goals?: number;
  loan: boolean;
  national: boolean;
}

export interface Squad {
  coach?: Player;
  players: Player[];
}
