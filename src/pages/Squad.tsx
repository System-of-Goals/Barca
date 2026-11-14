import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, Star, User } from 'lucide-react';
import type { Player, Squad } from '../data/types';
import { asset } from '../data/useSiteData';
import { useJson } from '../data/useJson';

const GROUPS = [
  { key: 'שוער', title: '🧤 שוערים' },
  { key: 'מגן', title: '🛡 הגנה' },
  { key: 'קשר', title: '⚙️ קישור' },
  { key: 'חלוץ', title: '⚡ התקפה' },
];

function Photo({ p, className }: { p: Player; className: string }) {
  const src = asset(p.photo);
  return <div className={className}>{src ? <img src={src} alt={p.name} /> : <User size={32} />}</div>;
}

export function SquadPage() {
  const squad = useJson<Squad>('players.json');
  const [filter, setFilter] = useState('הכול');

  if (squad === undefined) return <main className="page"><h1 className="page-title">הסגל</h1><div className="soon">טוען…</div></main>;
  if (!squad) return <main className="page"><h1 className="page-title">הסגל</h1><div className="card soon">הסגל יופיע בעדכון הבא</div></main>;

  const groups = GROUPS.filter((g) => filter === 'הכול' || g.key === filter);
  const others = squad.players.filter((p) => !GROUPS.some((g) => g.key === p.position));

  return (
    <main className="page">
      <h1 className="page-title">הסגל</h1>
      <div className="chips">
        {['הכול', ...GROUPS.map((g) => g.key)].map((c) => (
          <button key={c} className={c === filter ? 'chip active' : 'chip'} onClick={() => setFilter(c)}>
            {c === 'הכול' ? c : GROUPS.find((g) => g.key === c)!.title.split(' ')[1]}
          </button>
        ))}
      </div>

      {squad.coach && filter === 'הכול' && (
        <section className="card coach">
          <Photo p={squad.coach} className="coach-photo" />
          <div>
            <div className="small">המאמן</div>
            <div className="leader-name">{squad.coach.fullName}</div>
            {squad.coach.nationality && <div className="small">{squad.coach.nationality}</div>}
          </div>
        </section>
      )}

      {groups.map((g) => {
        const list = squad.players.filter((p) => p.position === g.key);
        if (!list.length) return null;
        return (
          <section key={g.key}>
            <h2 className="month">{g.title}</h2>
            <div className="squad-grid">
              {list.map((p) => (
                <Link key={p.id} to={`/players/${p.id}`} className="player-card">
                  <Photo p={p} className="player-photo" />
                  <span className="player-num">{p.number ?? ''}</span>
                  <span className="player-name">{p.name}</span>
                  {p.season && p.season.apps > 0 && (
                    <span className="small">{p.season.apps} מש׳ · {p.season.goals} ש׳</span>
                  )}
                </Link>
              ))}
            </div>
          </section>
        );
      })}
      {filter === 'הכול' && others.length > 0 && (
        <section>
          <h2 className="month">🧑‍💼 צוות מקצועי</h2>
          <div className="squad-grid">
            {others.map((p) => (
              <Link key={p.id} to={`/players/${p.id}`} className="player-card">
                <Photo p={p} className="player-photo" />
                <span className="player-num">{p.number ?? ''}</span>
                <span className="player-name">{p.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function StatTile({ value, label, star }: { value: string | number; label: string; star?: boolean }) {
  return (
    <div className="stat-tile">
      <div className="stat-tile-num">{value}{star && <Star size={14} fill="currentColor" />}</div>
      <div className="stat-tile-label">{label}</div>
    </div>
  );
}

export function PlayerPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const squad = useJson<Squad>('players.json');
  const [tab, setTab] = useState<'season' | 'career' | 'titles' | 'contract'>('season');

  if (squad === undefined) return <main className="page"><div className="soon">טוען…</div></main>;
  const p = squad?.players.find((x) => x.id === id) ?? (squad?.coach?.id === id ? squad?.coach : undefined);
  if (!p) {
    return (
      <main className="page">
        <h1 className="page-title">השחקן לא נמצא</h1>
        <Link to="/squad" className="more">לסגל ›</Link>
      </main>
    );
  }
  const s = p.season;

  return (
    <main className="page player-page">
      <button className="back" onClick={() => (history.length > 1 ? navigate(-1) : navigate('/squad'))}>
        <ChevronRight size={20} /> חזרה
      </button>

      <section className="player-hero">
        <div className="player-hero-top">
          <Photo p={p} className="player-hero-photo" />
          <div className="player-hero-num">{p.number ?? ''}</div>
        </div>
        <div className="player-hero-text">
          <h1>{p.fullName}</h1>
          <div>{[p.detailedPosition ?? p.position, p.age ? `גיל ${p.age}` : '', p.nationality].filter(Boolean).join(' · ')}</div>
          {p.height ? <div className="small" style={{ color: '#fff', opacity: 0.8 }}>גובה {p.height} ס״מ</div> : null}
        </div>
      </section>

      <div className="stat-tiles">
        <StatTile value={s?.apps ?? 0} label="משחקים" />
        <StatTile value={s?.goals ?? 0} label="שערים" />
        <StatTile value={s?.assists ?? 0} label="בישולים" />
        <StatTile value={s?.rating ? s.rating.toFixed(1) : '–'} label="ציון ממוצע" star />
      </div>

      <div className="tabs">
        <button className={tab === 'season' ? 'active' : ''} onClick={() => setTab('season')}>העונה</button>
        <button className={tab === 'career' ? 'active' : ''} onClick={() => setTab('career')}>קריירה</button>
        <button className={tab === 'titles' ? 'active' : ''} onClick={() => setTab('titles')}>תארים</button>
        <button className={tab === 'contract' ? 'active' : ''} onClick={() => setTab('contract')}>חוזה</button>
      </div>

      {tab === 'season' && (
        <section className="card">
          <h2 className="card-title">כל הטורנירים</h2>
          {s ? (
            <div className="season-grid">
              <span>הרכב פותח</span><b>{s.starts}</b>
              <span>דקות</span><b>{s.minutes.toLocaleString('he-IL')}</b>
              <span>🟨 צהובים</span><b>{s.yellow}</b>
              <span>🟥 אדומים</span><b>{s.red}</b>
            </div>
          ) : (
            <div className="soon">עוד לא שיחק העונה</div>
          )}
          {(p.byCompetition ?? []).length > 0 && (
            <>
              <h2 className="card-title" style={{ marginTop: 14 }}>לפי טורניר</h2>
              {p.byCompetition!.map((c) => (
                <div key={c.competition} className="stand-row">
                  <span className="stand-comp">{c.competition}</span>
                  <span className="small">{c.apps} מש׳ · {c.goals} ש׳ · {c.assists} ב׳{c.rating ? ` · ⭐ ${c.rating.toFixed(1)}` : ''}</span>
                </div>
              ))}
            </>
          )}
        </section>
      )}
      {tab !== 'season' && (
        <section className="card soon">
          {tab === 'career' && 'הקריירה לפי שנים תתווסף בשלב הבא (מוויקיפדיה).'}
          {tab === 'titles' && 'התארים של השחקן יתווספו בשלב הבא (מוויקיפדיה).'}
          {tab === 'contract' && 'החוזה והשכר (הערכה) יתווספו עם דף התקציב.'}
        </section>
      )}
    </main>
  );
}
