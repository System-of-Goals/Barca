import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { User } from 'lucide-react';
import type { CompetitionTables, Ranking, SiteData } from '../data/types';
import { asset } from '../data/useSiteData';
import { formatDate, outcome } from '../lib/format';

function useTables() {
  const [tables, setTables] = useState<CompetitionTables[] | null>();
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/tables.json`, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then(setTables)
      .catch(() => setTables(null));
  }, []);
  return tables;
}

const ringLetter = { win: 'נ', draw: 'ת', loss: 'ה' } as const;

function Standings({ t }: { t: CompetitionTables }) {
  const [open, setOpen] = useState<number>();
  return (
    <div className="card table-card">
      <div className="t-row t-head">
        <span className="t-pos">#</span>
        <span className="t-team">קבוצה</span>
        <span className="t-num">מש׳</span>
        <span className="t-num">הפרש</span>
        <span className="t-num">נק׳</span>
      </div>
      {t.rows.map((r) => (
        <Fragment key={r.position}>
          <button className={`t-row ${r.barca ? 'barca' : ''}`} onClick={() => setOpen(open === r.position ? undefined : r.position)}>
            <span className="t-pos">{r.position}</span>
            <span className="t-team">
              {r.crest && <img className="mini-crest" src={asset(r.crest)} alt="" />}
              <span>{r.team}</span>
            </span>
            <span className="t-num">{r.played}</span>
            <span className="t-num" dir="ltr">{r.goalsFor - r.goalsAgainst > 0 ? '+' : ''}{r.goalsFor - r.goalsAgainst}</span>
            <span className="t-num t-pts">{r.points}</span>
          </button>
          {open === r.position && (
            <div className="t-more">
              <span>נ {r.won} · ת {r.drawn} · ה {r.lost}</span>
              <span>שערים <bdi dir="ltr">{r.goalsFor}:{r.goalsAgainst}</bdi></span>
              <span className="t-form">
                {r.form.map((f, i) => <span key={i} className={`ring tiny ${f}`}>{ringLetter[f]}</span>)}
              </span>
            </div>
          )}
        </Fragment>
      ))}
    </div>
  );
}

function RankingList({ ranking, title }: { ranking?: Ranking; title: string }) {
  if (!ranking) return null;
  return (
    <section className="card">
      <h2 className="card-title">{title}</h2>
      {ranking.rows.map((r, i) => {
        const photo = asset(r.photo);
        const row = (
          <>
            <span className="t-pos">{i + 1}</span>
            <span className="rank-photo">{photo ? <img src={photo} alt="" /> : <User size={18} />}</span>
            <span className="rank-name">
              <b>{r.name}</b>
              {r.team && !r.barca && <span className="small"> · {r.team}</span>}
            </span>
            <span className="rank-value">{r.value}</span>
          </>
        );
        return r.barca ? (
          <Link key={r.playerId} to={`/players/${r.playerId}`} className="rank-row barca">{row}</Link>
        ) : (
          <div key={r.playerId} className="rank-row">{row}</div>
        );
      })}
    </section>
  );
}

export function Tables({ data }: { data: SiteData }) {
  const tables = useTables();
  const [comp, setComp] = useState(0);
  const [view, setView] = useState<'table' | 'rankings'>('table');
  const [rank, setRank] = useState(0);

  if (tables === undefined) return <main className="page"><h1 className="page-title">טבלאות</h1><div className="soon">טוען…</div></main>;
  if (!tables?.length) return <main className="page"><h1 className="page-title">טבלאות</h1><div className="card soon">הטבלאות יופיעו בעדכון הבא</div></main>;

  const t = tables[Math.min(comp, tables.length - 1)];
  // Same order as the robot (spec order first), across both lists.
  const order = ['שערים', 'בישולים', 'כרטיסים צהובים', 'כרטיסים אדומים', 'רשת נקייה', '365 מצטיינים'];
  const rankOf = (n: string) => (order.includes(n) ? order.indexOf(n) : order.length);
  const names = [...new Set([...t.barcaRankings, ...t.allRankings].map((r) => r.name))].sort((a, b) => rankOf(a) - rankOf(b));
  const rankName = names[Math.min(rank, names.length - 1)];
  // A cup has no table: show Barcelona's path through it instead.
  const path = data.matches.filter((m) => m.competition === t.competition).sort((a, b) => a.kickoff.localeCompare(b.kickoff));

  return (
    <main className="page">
      <h1 className="page-title">טבלאות</h1>
      <div className="chips">
        {tables.map((x, i) => (
          <button key={x.competition} className={i === comp ? 'chip active' : 'chip'} onClick={() => { setComp(i); setRank(0); }}>{x.competition}</button>
        ))}
      </div>
      <div className="tabs">
        <button className={view === 'table' ? 'active' : ''} onClick={() => setView('table')}>{t.rows.length ? 'טבלה' : 'הדרך שלנו'}</button>
        <button className={view === 'rankings' ? 'active' : ''} onClick={() => setView('rankings')}>דירוגים</button>
      </div>

      {view === 'table' && (t.rows.length ? (
        <>
          <Standings t={t} />
          <div className="small" style={{ textAlign: 'center' }}>לחיצה על קבוצה מציגה עוד פרטים</div>
        </>
      ) : (
        <section className="card" style={{ padding: '4px 14px' }}>
          {path.length === 0 && <div className="soon">עוד אין משחקים בטורניר הזה</div>}
          {path.map((m) => {
            const o = outcome(m);
            return (
              <Link key={m.id} to={`/matches/${m.id}`} className="match-row">
                {o ? <span className={`ring ${o}`}>{ringLetter[o]}</span> : <span className="match-time">{formatDate(m.kickoff)}</span>}
                <div className="match-main">
                  <div className="match-teams">{m.round || m.competition}</div>
                  <div className="small">{m.opponent.name} · {formatDate(m.kickoff)}</div>
                </div>
                {m.barcaGoals !== undefined && (
                  <span className="score match-score"><span>{m.barcaGoals}</span><span className="score-dash">–</span><span>{m.opponentGoals}</span></span>
                )}
              </Link>
            );
          })}
        </section>
      ))}

      {view === 'rankings' && (
        <>
          <div className="chips">
            {names.map((n, i) => (
              <button key={n} className={n === rankName ? 'chip active' : 'chip'} onClick={() => setRank(i)}>{n}</button>
            ))}
          </div>
          {names.length === 0 && <div className="card soon">אין דירוגים לטורניר הזה</div>}
          <RankingList ranking={t.barcaRankings.find((r) => r.name === rankName)} title={`${rankName} · ברצלונה`} />
          <RankingList ranking={t.allRankings.find((r) => r.name === rankName)} title={`${rankName} · כל ${t.competition}`} />
        </>
      )}
    </main>
  );
}
