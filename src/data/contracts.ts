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
  joined: string; // dd/mm/yyyy (Transfermarkt)
  from: string; // previous club
  until: string; // contract end, dd/mm/yyyy (Transfermarkt)
}

export const contracts: PlayerContract[] = [
  { number: 1, name: 'חואן גרסיה', weekly: 140192, fixed: 7.29, total: 9.48, value: 45 , joined: '01/07/2025', from: 'אספניול', until: '30/06/2031' },
  { number: 25, name: "דומיניק ליבקוביץ'", weekly: 100192, fixed: 5.21, total: 6.77, value: 4 , joined: '27/08/2026', from: 'פנרבחצ\'ה', until: '30/06/2030' },
  { number: 13, name: "וויצ'ך שצ'סני", weekly: 57692, fixed: 3.0, total: 3.9, value: 0.8 , joined: '02/10/2024', from: 'ללא קבוצה', until: '30/06/2027' },
  { number: 5, name: 'פאו קוברסי', weekly: 100192, fixed: 5.21, total: 6.77, value: 100 , joined: '01/01/2024', from: 'האקדמיה', until: '30/06/2029' },
  { number: 24, name: 'אריק גרסיה', weekly: 154231, fixed: 8.02, total: 10.43, value: 45 , joined: '01/07/2021', from: 'מנצ\'סטר סיטי', until: '30/06/2031' },
  { number: 18, name: "ז'רארד מרטין", weekly: 60192, fixed: 3.13, total: 4.07, value: 40 , joined: '01/07/2024', from: 'האקדמיה', until: '30/06/2028' },
  { number: 15, name: 'אנדראס כריסטנסן', weekly: 100192, fixed: 5.21, total: 9.21, value: 8 , joined: '04/07/2022', from: 'צ\'לסי', until: '30/06/2028' },
  { number: 3, name: 'אלחנדרו באלדה', weekly: 48077, fixed: 2.5, total: 3.25, value: 40 , joined: '01/07/2022', from: 'האקדמיה', until: '30/06/2028' },
  { number: 23, name: "ז'ול קונדה", weekly: 300577, fixed: 15.63, total: 20.32, value: 55 , joined: '28/07/2022', from: 'סביליה', until: '30/06/2030' },
  { number: 12, name: "צ'אבי אספרט", weekly: 48077, fixed: 2.5, total: 3.25, value: 25 , joined: '01/07/2026', from: 'האקדמיה', until: '30/06/2030' },
  { number: 2, name: "ז'ואאו קנסלו", weekly: 180385, fixed: 9.38, total: 12.19, value: 7 , joined: '20/08/2026', from: 'אל-הילאל', until: '30/06/2029' },
  { number: 16, name: 'רודרי', weekly: 520769, fixed: 27.08, total: 35.21, value: 60 , joined: '18/08/2026', from: 'מנצ\'סטר סיטי', until: '30/06/2030' },
  { number: 22, name: 'מארק ברנאל', weekly: 24038, fixed: 1.25, total: 1.63, value: 40 , joined: '01/07/2024', from: 'האקדמיה', until: '30/06/2029' },
  { number: 8, name: 'פדרי', weekly: 240385, fixed: 12.5, total: 16.25, value: 150 , joined: '02/09/2019', from: 'לאס פאלמאס', until: '30/06/2030' },
  { number: 6, name: 'גאבי', weekly: 180385, fixed: 9.38, total: 12.19, value: 25 , joined: '01/07/2021', from: 'האקדמיה', until: '30/06/2030' },
  { number: 21, name: 'פרנקי דה יונג', weekly: 250385, fixed: 13.02, total: 18.02, value: 25 , joined: '01/07/2019', from: 'אייאקס', until: '30/06/2029' },
  { number: 4, name: 'בריאן פארינאס', weekly: 12115, fixed: 0.63, total: 0.82, value: 5 , joined: '01/07/2026', from: 'האקדמיה', until: '30/06/2028' },
  { number: 7, name: 'פרמין לופס', weekly: 200385, fixed: 10.42, total: 13.55, value: 110 , joined: '01/07/2023', from: 'האקדמיה', until: '30/06/2031' },
  { number: 20, name: 'דני אולמו', weekly: 300577, fixed: 15.63, total: 20.32, value: 60 , joined: '09/08/2024', from: 'לייפציג', until: '30/06/2030' },
  { number: 17, name: 'אנתוני גורדון', weekly: 232308, fixed: 12.08, total: 15.71, value: 80 , joined: '01/07/2026', from: 'ניוקאסל', until: '30/06/2031' },
  { number: 27, name: "ג'סי ביסיוו", weekly: 10000, fixed: 0.52, total: 0.68, value: 8 , joined: '31/07/2026', from: 'קלוב ברוז\' (קבוצת המשנה)', until: '30/06/2031' },
  { number: 10, name: 'למין ימאל', weekly: 440769, fixed: 22.92, total: 33.34, value: 220 , joined: '01/07/2023', from: 'האקדמיה', until: '30/06/2031' },
  { number: 14, name: 'קארים אדיימי', weekly: 240385, fixed: 12.5, total: 16.25, value: 40 , joined: '23/07/2026', from: 'בורוסיה דורטמונד', until: '30/06/2031' },
  { number: 19, name: "רוני בארדג'י", weekly: 30000, fixed: 1.56, total: 2.03, value: 8 , joined: '14/07/2025', from: 'קופנהגן', until: '30/06/2029' },
  { number: 11, name: 'ראפיניה', weekly: 320577, fixed: 16.67, total: 21.67, value: 70 , joined: '13/07/2022', from: 'לידס', until: '30/06/2030' },
  { number: 9, name: "גבריאל ז'סוס", weekly: 232308, fixed: 12.08, total: 15.71, value: 17 , joined: '01/09/2026', from: 'ארסנל', until: '30/06/2029' },
  { number: 29, name: 'חמזה עבד אל-כרים', weekly: 10000, fixed: 0.52, total: 0.68, value: 8 , joined: '01/07/2026', from: 'אל-אהלי', until: '30/06/2030' },
];

// Club totals from the same Capology page (active and inactive players).
export const payroll = { fixed: 251.46, total: 334.01, weeklyFixed: 4835770 };

export const contractFor = (number?: number) => (number === undefined ? undefined : contracts.find((c) => c.number === number));
