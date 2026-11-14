import type { SiteData } from '../data/types';
import { formatDate, formatTime } from '../lib/format';

const sources = [
  { what: 'משחקים, תוצאות, טבלאות, הרכבים, סטטיסטיקה, סגל ותמונות', name: '365Scores', url: 'https://www.365scores.com/he' },
  { what: 'חדשות', name: 'בארסה מניה (טלגרם)', url: 'https://t.me/barcamaniail' },
  { what: 'קריירה, תארים ופרסים של שחקנים', name: 'ויקיפדיה (Wikidata)', url: 'https://www.wikidata.org' },
  { what: 'תמונות האגדות', name: 'ויקישיתוף', url: 'https://commons.wikimedia.org' },
  { what: 'דוחות כספיים', name: 'FC Barcelona', url: 'https://www.fcbarcelona.com' },
  { what: 'הערכות שכר', name: 'Capology / FBref / SalaryLeaks', url: 'https://www.capology.com' },
  { what: 'שער האירו', name: 'ExchangeRate-API', url: 'https://www.exchangerate-api.com' },
];

export function About({ data }: { data: SiteData }) {
  return (
    <main className="page">
      <h1 className="page-title">ℹ️ אודות</h1>
      <section className="card prose">
        <p><b>אתר מעריצים אישי ולא רשמי.</b> אין לו קשר ל-FC Barcelona. הסמל והשמות שייכים למועדון.</p>
        <p>הנתונים מתעדכנים אוטומטית בערך כל 15 דקות. בזמן משחק התוצאה עשויה לאחר בכמה דקות.</p>
      </section>
      <section className="card">
        <h2 className="card-title">עדכון אחרון</h2>
        <div>משחקים וטבלאות: <b className="gold">{formatDate(data.updatedAt)} · {formatTime(data.updatedAt)}</b></div>
        <div className="small" style={{ marginTop: 6 }}>קריירה ותארים – פעם ביום · היסטוריה ותקציב – מתעדכנים ידנית</div>
      </section>
      <section className="card">
        <h2 className="card-title">מקורות</h2>
        {sources.map((s) => (
          <div key={s.name} className="stand-row">
            <span className="stand-comp small" style={{ color: 'var(--text)' }}>{s.what}</span>
            <a href={s.url} target="_blank" rel="noreferrer" className="gold">{s.name} ↗</a>
          </div>
        ))}
      </section>
    </main>
  );
}
