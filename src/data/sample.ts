import type { Match, SiteData } from './types';

// Sample data so the design can be seen before the real sources are connected.
// Dates are relative to "now" so the countdown always has something to count.

const DAY = 24 * 60 * 60 * 1000;
const at = (daysFromNow: number, hourUtc: number) => {
  const d = new Date(Date.now() + daysFromNow * DAY);
  d.setUTCHours(hourUtc, 0, 0, 0);
  return d.toISOString();
};

const finished = (
  id: string,
  days: number,
  competition: Match['competition'],
  round: string,
  home: boolean,
  opponent: string,
  barcaGoals: number,
  opponentGoals: number,
): Match => ({
  id,
  competition,
  round,
  kickoff: at(days, 20),
  venue: home ? 'קאמפ נואו' : 'חוץ',
  home,
  opponent: { name: opponent },
  status: 'finished',
  barcaGoals,
  opponentGoals,
});

export const sampleData: SiteData = {
  isSample: true,
  updatedAt: new Date().toISOString(),
  matches: [
    finished('m1', -5, 'laliga', 'מחזור 13', true, 'ריאל סוסיאדד', 3, 1),
    finished('m2', -9, 'ucl', 'שלב הליגה · מחזור 4', false, 'אינטר', 2, 0),
    finished('m3', -13, 'laliga', 'מחזור 12', false, 'אתלטיקו מדריד', 1, 1),
    finished('m4', -19, 'laliga', 'מחזור 11', true, 'חירונה', 4, 0),
    finished('m5', -23, 'laliga', 'מחזור 10', false, 'ריאל מדריד', 1, 2),
    {
      id: 'm6',
      competition: 'laliga',
      round: 'מחזור 14',
      kickoff: at(7, 20),
      venue: 'קאמפ נואו',
      home: true,
      opponent: { name: 'סביליה' },
      status: 'scheduled',
    },
    {
      id: 'm7',
      competition: 'ucl',
      round: 'שלב הליגה · מחזור 5',
      kickoff: at(11, 20),
      venue: 'חוץ',
      home: false,
      opponent: { name: 'באיירן מינכן' },
      status: 'scheduled',
    },
  ],
  standings: [
    { competition: 'laliga', position: 1, points: 34, played: 13, note: '2 נק׳ לפני ריאל מדריד' },
    { competition: 'ucl', position: 4, points: 12, played: 4 },
  ],
  topScorer: { playerId: 'lewandowski', name: 'לבנדובסקי', value: 12 },
  topAssister: { playerId: 'yamal', name: 'ימאל', value: 8 },
  todayInHistory: { year: 1899, text: 'דוגמה: אירוע מההיסטוריה של המועדון שקרה בתאריך הזה.' },
  news: [
    { id: 'n1', title: 'דוגמה: כותרת ידיעה ראשונה בעברית', source: 'Mundo Deportivo', publishedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), url: '#' },
    { id: 'n2', title: 'דוגמה: כותרת ידיעה שנייה בעברית', source: 'Sport', publishedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), url: '#' },
    { id: 'n3', title: 'דוגמה: כותרת ידיעה שלישית בעברית', source: 'ESPN', publishedAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(), url: '#' },
  ],
};
