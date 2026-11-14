import { contracts, contractSources, payroll } from '../data/contracts';
import { Link } from 'react-router-dom';
import type { SiteData, Squad } from '../data/types';
import { useJson } from '../data/useJson';
import {
  budgetNow,
  debt,
  lastAccounts,
  revenueBySeason,
  salariesNote,
  salaryCap,
  type Source,
} from '../data/budget';

// "€1,060 מ׳" and, when the rate is known, "כ-₪3.9 מיליארד".
export function Money({ m, rate, big }: { m: number; rate?: number; big?: boolean }) {
  const eur = m >= 1000 ? `€${(m / 1000).toLocaleString('he-IL', { maximumFractionDigits: 2 })} מיליארד` : `€${m.toLocaleString('he-IL', { maximumFractionDigits: 2 })} מיליון`;
  const ilsM = rate ? m * rate : undefined;
  const ils = ilsM === undefined ? '' : ilsM >= 1000 ? `כ-₪${(ilsM / 1000).toLocaleString('he-IL', { maximumFractionDigits: 1 })} מיליארד` : `כ-₪${Math.round(ilsM).toLocaleString('he-IL')} מיליון`;
  return (
    <span className="money">
      <b className={big ? 'money-big' : ''}>{eur}</b>
      {ils && <span className="small"> · {ils}</span>}
    </span>
  );
}

const Sources = ({ list }: { list: Source[] }) => (
  <div className="small sources">
    מקור:{' '}
    {list.map((s, i) => (
      <span key={s.url}>
        {i > 0 && ' · '}
        <a href={s.url} target="_blank" rel="noreferrer">{s.name} ↗</a>
      </span>
    ))}
  </div>
);

export function Budget({ data }: { data: SiteData }) {
  const rate = data.eurIls;
  const squad = useJson<Squad>('players.json');
  const max = Math.max(...revenueBySeason.map((r) => r.revenue));
  const capUse = Math.round((salaryCap.wageBillEstimate / salaryCap.limit) * 100);
  const rows = [...contracts].sort((a, b) => b.fixed - a.fixed);

  return (
    <main className="page">
      <h1 className="page-title">💰 תקציב המועדון</h1>

      <section className="card">
        <h2 className="card-title">הדוח השנתי · עונת {lastAccounts.season}</h2>
        <div className="budget-row"><span>הכנסות</span><Money m={lastAccounts.revenue} rate={rate} big /></div>
        <div className="small">+€{lastAccounts.revenueChange} מיליון לעומת העונה הקודמת · לראשונה מעל מיליארד</div>
        <div className="budget-row"><span>עלויות הספורט (שכר + רכישות)</span><Money m={lastAccounts.sportingCosts} rate={rate} /></div>
        <div className="small">{lastAccounts.sportingCostsShare}% מההכנסות</div>
        <div className="budget-row"><span>EBITDA</span><Money m={lastAccounts.ebitda} rate={rate} /></div>
        <div className="budget-row">
          <span>תוצאה נטו</span>
          <span className={lastAccounts.netResult < 0 ? 'loss-text' : 'win-text'}><b>{lastAccounts.netResult < 0 ? '🔴 הפסד' : '🟢 רווח'} €{Math.abs(lastAccounts.netResult)} מיליון</b></span>
        </div>
        <div className="small">התוצאה השוטפת: רווח של €{lastAccounts.ordinaryResult} מיליון; ההפסד נובע מסעיפים חד-פעמיים ומס.</div>
        <div className="small" style={{ marginTop: 6 }}>הצמיחה הגיעה בעיקר מ: {lastAccounts.growthFrom}.</div>
        <Sources list={lastAccounts.sources} />
      </section>

      <section className="card">
        <h2 className="card-title">📊 הכנסות לפי עונה</h2>
        <div className="bars">
          {revenueBySeason.map((r) => (
            <div key={r.season} className="bar-col">
              <span className="bar-value">€{r.revenue.toLocaleString('he-IL')}</span>
              <div className={`bar ${r.kind}`} style={{ height: `${(r.revenue / max) * 130}px` }} />
              <span className="small">{r.season}{r.kind === 'budget' ? ' (תקציב)' : ''}</span>
            </div>
          ))}
        </div>
        <div className="small">במיליוני אירו. מוצגות רק עונות שהנתונים שלהן פורסמו.</div>
      </section>

      <section className="card">
        <h2 className="card-title">🏦 חוב · נכון ל-{debt.date}</h2>
        <div className="budget-row"><span>חוב נטו (לפי לה ליגה)</span><Money m={debt.net} rate={rate} /></div>
        <div className="budget-row"><span>חוב ברוטו</span><Money m={debt.gross} rate={rate} /></div>
        <div className="small">{debt.note} החוב ברוטו עלה ב-€{debt.grossChange} מיליון.</div>
        <Sources list={debt.sources} />
      </section>

      <section className="card">
        <h2 className="card-title">⚖️ תקרת השכר של לה ליגה · {salaryCap.season}</h2>
        <div className="budget-row"><span>התקרה שמותרת לברצלונה</span><Money m={salaryCap.limit} rate={rate} /></div>
        <div className="small">עלתה מ-€{salaryCap.earlier} מיליון בתחילת העונה.</div>
        <div className="budget-row"><span>שכר הסגל (הערכה, כולל בונוסים)</span><Money m={salaryCap.wageBillEstimate} rate={rate} /></div>
        <div className="cap-bar"><span style={{ width: `${capUse}%` }} /></div>
        <div className="small">התקרה כוללת גם עלויות נוספות מלבד שכר השחקנים, ולכן ההשוואה היא בקירוב.</div>
        <Sources list={salaryCap.sources} />
      </section>

      <section className="card">
        <h2 className="card-title">📅 התקציב לעונה הנוכחית · {budgetNow.season}</h2>
        <div className="budget-row"><span>הכנסות מתוכננות</span><Money m={budgetNow.revenue} rate={rate} /></div>
        <div className="budget-row"><span>רווח נטו מתוכנן</span><span className="win-text"><b>€{budgetNow.netResult} מיליון</b></span></div>
        <Sources list={budgetNow.sources} />
      </section>

      <section className="card">
        <h2 className="card-title">💶 שכר שחקנים (הערכה, ברוטו לשנה)</h2>
        <div className="budget-row"><span>כל הסגל – שכר קבוע</span><Money m={payroll.fixed} rate={rate} /></div>
        <div className="budget-row"><span>כל הסגל – כולל בונוסים</span><Money m={payroll.total} rate={rate} /></div>
        {rows.map((c) => {
          const p = squad?.players.find((x) => x.number === c.number);
          const line = (
            <>
              <div className="budget-row">
                <span className="spell-team">{c.name}</span>
                <Money m={c.fixed} rate={rate} />
              </div>
              <div className="small">כולל בונוסים: €{c.total} מיליון · שווי שוק: €{c.value} מיליון</div>
            </>
          );
          return p ? (
            <Link key={c.number} to={`/players/${p.id}`} className="salary-row">{line}</Link>
          ) : (
            <div key={c.number} className="salary-row">{line}</div>
          );
        })}
        <div className="small" style={{ marginTop: 8 }}>
          {salariesNote} מקורות: <a href={contractSources.salaries.url} target="_blank" rel="noreferrer">{contractSources.salaries.name} ↗</a> · <a href={contractSources.value.url} target="_blank" rel="noreferrer">{contractSources.value.name} ↗</a>
        </div>
      </section>

      <section className="card soon">
        🔁 מאזן ההעברות של העונה – עדיין לא נמצא לו מקור מסודר. יתווסף בהמשך.
      </section>

      {rate && <div className="small" style={{ textAlign: 'center' }}>שער: €1 = ₪{rate.toFixed(2)} (מתעדכן כל יום)</div>}
    </main>
  );
}
