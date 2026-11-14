// Budget page content. Filled in by hand from published sources (listed with each figure).
// Amounts are in millions of euros. Update when the club publishes new accounts.

export interface Source {
  name: string;
  url: string;
}

const officialAccounts: Source = {
  name: 'FC Barcelona – אישור הדוחות באסיפה הכללית',
  url: 'https://www.fcbarcelona.com/en/club/news/4578647/assembly-approves-record-breaking-accounts-that-confirm-clubs-financial-recovery',
};
const tribuna: Source = { name: 'Tribuna', url: 'https://tribuna.com/en/news/2026-09-07-barcelona-record-106bn-revenue-but-net-debt-rises-by-138m' };
const forecast: Source = { name: 'Yahoo Sports', url: 'https://sports.yahoo.com/articles/barcelona-forecast-1-195-billion-134500047.html' };
const capSource: Source = { name: 'Barça Universal', url: 'https://barcauniversal.com/confirmed-barcelonas-salary-cap-soars-to-e582-7-million/' };
const fbref: Source = { name: 'FBref (נתוני Capology)', url: 'https://fbref.com/en/squads/206d90db/2026-2027/wages/Barcelona-Wage-Details' };
const capologyRaphinha: Source = { name: 'Capology', url: 'https://www.capology.com/player/raphinha-35413/' };
const salaryLeaks: Source = { name: 'SalaryLeaks', url: 'https://www.salaryleaks.com/football/teams/fc-barcelona' };

export const lastAccounts = {
  season: '2025/26',
  revenue: 1060, // ordinary revenue, first time above €1bn
  revenueChange: 66, // vs 2024/25
  sportingCosts: 571, // wages + amortisation, 54% of revenue
  sportingCostsShare: 54,
  ordinaryResult: 0.2,
  netResult: -18, // after extraordinary items and tax
  ebitda: 140,
  growthFrom: 'הכנסות מהאצטדיון, חסויות, ומוצרי המועדון (Barça Licensing & Merchandising)',
  sources: [officialAccounts, tribuna],
};

export const debt = {
  date: '30/06/2026',
  net: 607, // by La Liga's criteria
  gross: 910, // +43 vs previous year
  grossChange: 43,
  note: 'החוב נטו עלה – לראשונה מאז 2021/22 הוא לא ירד.',
  sources: [tribuna],
};

// Revenue by season. Only figures that were published; 2024/25 = 2025/26 minus the reported growth.
export const revenueBySeason: { season: string; revenue: number; kind: 'actual' | 'budget' }[] = [
  { season: '2024/25', revenue: 994, kind: 'actual' },
  { season: '2025/26', revenue: 1060, kind: 'actual' },
  { season: '2026/27', revenue: 1195, kind: 'budget' },
];

export const budgetNow = {
  season: '2026/27',
  revenue: 1195,
  netResult: 1,
  sources: [forecast],
};

export const salaryCap = {
  season: '2026/27',
  limit: 582.77, // La Liga squad cost limit, after the summer window
  earlier: 432.8, // earlier in the season
  wageBillEstimate: 300.8, // total wages incl. bonuses – estimate
  sources: [capSource, salaryLeaks],
};

// Salary estimates per player (gross, per year). Sources disagree; the range is shown.
export interface SalaryEstimate {
  match: RegExp; // matched against the player's name from 365Scores
  name: string;
  annual: number; // main estimate
  range?: [number, number];
  note?: string;
  source: Source;
}

export const salaries: SalaryEstimate[] = [
  { match: /יאמאל|ימאל/, name: 'למין ימאל', annual: 22.92, range: [16.7, 31.25], note: 'ההערכות שונות מאוד בין המקורות', source: fbref },
  { match: /רודרי/, name: 'רודרי', annual: 20, note: 'שכר בסיס – הגבוה בסגל לפי SalaryLeaks', source: salaryLeaks },
  { match: /ראפיניה/, name: 'ראפיניה', annual: 16.67, note: 'בסיס; עם בונוסים – כ-21.7', source: capologyRaphinha },
  { match: /פדרי/, name: 'פדרי', annual: 12.5, range: [12.5, 16], note: 'בסיס; לפי חלק מהמקורות בונוס של עד 5', source: fbref },
];

export const salariesNote =
  'ברצלונה לא מפרסמת את השכר של השחקנים. אלה הערכות של אתרים שמתמחים בזה, והן שונות זו מזו. מוצג רק לשחקנים שנמצאה עבורם הערכה.';
