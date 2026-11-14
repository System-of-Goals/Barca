// Salaries and market values for the whole squad, copied by hand from screenshots the site owner sent.
// Salaries: Capology, season 2026/27 (estimates, gross, in euros). Market values: Transfermarkt (millions of euros).
// Matched to 365Scores players by shirt number. Update by hand after transfers or new contracts.

export const contractSources = {
  salaries: { name: 'Capology · 2026/27', url: 'https://www.capology.com/club/barcelona/salaries/' },
  value: { name: 'Transfermarkt', url: 'https://www.transfermarkt.com/fc-barcelona/startseite/verein/131' },
  updated: '14/11/2026',
};

export interface PlayerContract {
  number: number;
  name: string; // Hebrew
  weekly: number; // fixed gross per week, €
  fixed: number; // fixed gross per year, € millions
  total: number; // gross per year including bonuses, € millions
  value: number; // market value, € millions
}

export const contracts: PlayerContract[] = [
  { number: 1, name: 'חואן גרסיה', weekly: 140192, fixed: 7.29, total: 9.48, value: 45 },
  { number: 25, name: "דומיניק ליבקוביץ'", weekly: 100192, fixed: 5.21, total: 6.77, value: 4 },
  { number: 13, name: "וויצ'ך שצ'סני", weekly: 57692, fixed: 3.0, total: 3.9, value: 0.8 },
  { number: 5, name: 'פאו קוברסי', weekly: 100192, fixed: 5.21, total: 6.77, value: 100 },
  { number: 24, name: 'אריק גרסיה', weekly: 154231, fixed: 8.02, total: 10.43, value: 45 },
  { number: 18, name: "ז'רארד מרטין", weekly: 60192, fixed: 3.13, total: 4.07, value: 40 },
  { number: 15, name: 'אנדראס כריסטנסן', weekly: 100192, fixed: 5.21, total: 9.21, value: 8 },
  { number: 3, name: 'אלחנדרו באלדה', weekly: 48077, fixed: 2.5, total: 3.25, value: 40 },
  { number: 23, name: "ז'ול קונדה", weekly: 300577, fixed: 15.63, total: 20.32, value: 55 },
  { number: 12, name: "צ'אבי אספרט", weekly: 48077, fixed: 2.5, total: 3.25, value: 25 },
  { number: 2, name: "ז'ואאו קנסלו", weekly: 180385, fixed: 9.38, total: 12.19, value: 7 },
  { number: 16, name: 'רודרי', weekly: 520769, fixed: 27.08, total: 35.21, value: 60 },
  { number: 22, name: 'מארק ברנאל', weekly: 24038, fixed: 1.25, total: 1.63, value: 40 },
  { number: 8, name: 'פדרי', weekly: 240385, fixed: 12.5, total: 16.25, value: 150 },
  { number: 6, name: 'גאבי', weekly: 180385, fixed: 9.38, total: 12.19, value: 25 },
  { number: 21, name: 'פרנקי דה יונג', weekly: 250385, fixed: 13.02, total: 18.02, value: 25 },
  { number: 4, name: 'בריאן פארינאס', weekly: 12115, fixed: 0.63, total: 0.82, value: 5 },
  { number: 7, name: 'פרמין לופס', weekly: 200385, fixed: 10.42, total: 13.55, value: 110 },
  { number: 20, name: 'דני אולמו', weekly: 300577, fixed: 15.63, total: 20.32, value: 60 },
  { number: 17, name: 'אנתוני גורדון', weekly: 232308, fixed: 12.08, total: 15.71, value: 80 },
  { number: 27, name: "ג'סי ביסיוו", weekly: 10000, fixed: 0.52, total: 0.68, value: 8 },
  { number: 10, name: 'למין ימאל', weekly: 440769, fixed: 22.92, total: 33.34, value: 220 },
  { number: 14, name: 'קארים אדיימי', weekly: 240385, fixed: 12.5, total: 16.25, value: 40 },
  { number: 19, name: "רוני בארדג'י", weekly: 30000, fixed: 1.56, total: 2.03, value: 8 },
  { number: 11, name: 'ראפיניה', weekly: 320577, fixed: 16.67, total: 21.67, value: 70 },
  { number: 9, name: "גבריאל ז'סוס", weekly: 232308, fixed: 12.08, total: 15.71, value: 17 },
  { number: 29, name: 'חמזה עבד אל-כרים', weekly: 10000, fixed: 0.52, total: 0.68, value: 8 },
];

// Club totals from the same Capology page (active and inactive players).
export const payroll = { fixed: 251.46, total: 334.01, weeklyFixed: 4835770 };

export const contractFor = (number?: number) => (number === undefined ? undefined : contracts.find((c) => c.number === number));
