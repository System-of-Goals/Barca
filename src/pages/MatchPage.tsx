import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { Lineup, Match, MatchDetail, MatchEvent, SiteData } from '../data/types';
import { asset } from '../data/useSiteData';
import { formatDate, formatTime, formatWeekday, outcome, outcomeLabel, pad2, splitCountdown } from '../lib/format';

function useDetail(id?: string) {
  const [detail, setDetail] = useState<MatchDetail | null>();
  useEffect(() => {
    if (!id) return;
    fetch(`${import.meta.env.BASE_URL}data/matches/${id}.json`, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then(setDetail)
      .catch(() => setDetail(null));
  }, [id]);
  return detail;
}

const eventIcon: Record<MatchEvent['kind'], string> = { goal: '⚽', yellow: '🟨', red: '🟥', sub: '🔁', other: '•' };

function EventRow({ e }: { e: MatchEvent }) {
  const extra =
    e.kind === 'goal' && e.extra[0] ? `בישול: ${e.extra[0]}` : e.kind === 'sub' && e.extra[0] ? `נכנס: ${e.extra[0]}` : '';
  return (
    <div className={`event-row ${e.side}`}>
      <span className="event-min">{e.minute}</span>
      <span className="event-icon">{eventIcon[e.kind]}</span>
      <span className="event-text">
        <b>{e.player ?? e.label}</b>
        {e.kind === 'goal' && e.label !== 'גול' && <span className="small"> ({e.label})</span>}
        {extra && <span className="small"> · {extra}</span>}
        {e.side === 'opp' && <span className="small"> · יריבה</span>}
      </span>
    </div>
  );
}

// Vertical pitch (fits a phone): own goal at the bottom, attack upwards.
function Pitch({ lineup }: { lineup: Lineup }) {
  const starters = lineup.players.filter((p) => p.starting && p.line !== undefined && p.side !== undefined);
  const bench = lineup.players.filter((p) => !p.starting);
  return (
    <>
      <div className="pitch">
        <div className="pitch-lines" />
        {starters.map((p) => (
          <div
            key={p.id}
            className="pitch-player"
            style={{ bottom: `${7 + (p.line! / 100) * 80}%`, left: `${10 + (p.side! / 100) * 80}%` }}
          >
            <span className="pitch-num">{p.number ?? ''}</span>
            <span className="pitch-name">{p.name}</span>
            {p.rating !== undefined && <span className={`rating ${p.rating >= 7 ? 'hi' : p.rating < 6 ? 'lo' : ''}`}>{p.rating.toFixed(1)}</span>}
          </div>
        ))}
      </div>
      {bench.length > 0 && (
        <div className="bench">
          <div className="card-title" style={{ fontSize: 14 }}>ספסל</div>
          {bench.map((p) => (
            <span key={p.id} className="bench-player">
              {p.number ?? ''} {p.name}
              {p.rating !== undefined && <span className="rating">{p.rating.toFixed(1)}</span>}
            </span>
          ))}
        </div>
      )}
    </>
  );
}

function Countdown({ kickoff }: { kickoff: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const { days, hours, minutes } = splitCountdown(new Date(kickoff).getTime() - now);
  return (
    <div className="countdown">
      <div className="cd-unit"><div className="cd-num">{pad2(days)}</div><div className="cd-label">ימים</div></div>
      <div className="cd-unit"><div className="cd-num">{pad2(hours)}</div><div className="cd-label">שעות</div></div>
      <div className="cd-unit"><div className="cd-num">{pad2(minutes)}</div><div className="cd-label">דקות</div></div>
    </div>
  );
}

function Hero({ m, crest, venue }: { m: Match; crest?: string; venue?: string }) {
  const o = outcome(m);
  const started = m.status !== 'scheduled';
  return (
    <section className="hero match-hero">
      <div className="hero-label">{m.competition}{m.round ? ` · ${m.round}` : ''}</div>
      <div className="vs">
        <div className="vs-team">
          <img src={asset(crest) ?? `${import.meta.env.BASE_URL}icons/crest.svg`} alt="" />
          <span>ברצלונה</span>
        </div>
        {started ? (
          <div className="vs-score">
            <span>{m.barcaGoals ?? 0}</span>
            <span className="score-dash">–</span>
            <span>{m.opponentGoals ?? 0}</span>
          </div>
        ) : (
          <div className="vs-time">{formatTime(m.kickoff)}</div>
        )}
        <div className="vs-team">
          {m.opponent.crest ? <img src={asset(m.opponent.crest)} alt="" /> : <span className="crest-ph" />}
          <span>{m.opponent.name}</span>
        </div>
      </div>
      <div className="hero-status">
        {m.status === 'live' && <span className="live-badge"><span className="live-dot" /> עכשיו {m.minute ? `${m.minute}׳` : ''}</span>}
        {o && <span className={`badge ${o}`}>{outcomeLabel[o]} · הסתיים</span>}
      </div>
      <div className="hero-meta" style={{ textAlign: 'center' }}>
        {venue ?? m.venue} · {formatWeekday(m.kickoff)} {formatDate(m.kickoff)} · {formatTime(m.kickoff)}
      </div>
      {!started && <Countdown kickoff={m.kickoff} />}
    </section>
  );
}

export function MatchPage({ data }: { data: SiteData }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const match = data.matches.find((m) => m.id === id);
  const detail = useDetail(match && match.status !== 'scheduled' ? id : undefined);
  const [tab, setTab] = useState<'lineups' | 'stats' | 'events'>('lineups');
  const [team, setTeam] = useState<'barca' | 'opp'>('barca');

  if (!match) {
    return (
      <main className="page">
        <h1 className="page-title">המשחק לא נמצא</h1>
        <Link to="/matches" className="more">לכל המשחקים ›</Link>
      </main>
    );
  }

  const goals = detail?.events.filter((e) => e.kind === 'goal') ?? [];
  const lineup = detail?.lineups[team];

  return (
    <main className="page">
      <button className="back" onClick={() => (history.length > 1 ? navigate(-1) : navigate('/matches'))}>
        <ChevronRight size={20} /> חזרה
      </button>

      <Hero m={match} crest={data.crest} venue={detail?.venue} />

      {goals.length > 0 && (
        <section className="card">
          <h2 className="card-title">שערים</h2>
          {goals.map((e, i) => <EventRow key={i} e={e} />)}
        </section>
      )}

      {detail && (
        <>
          <div className="tabs">
            <button className={tab === 'lineups' ? 'active' : ''} onClick={() => setTab('lineups')}>הרכבים</button>
            <button className={tab === 'stats' ? 'active' : ''} onClick={() => setTab('stats')}>סטטיסטיקה</button>
            <button className={tab === 'events' ? 'active' : ''} onClick={() => setTab('events')}>אירועים</button>
          </div>

          {tab === 'lineups' && (
            <section className="card">
              <div className="chips" style={{ marginBottom: 10 }}>
                <button className={team === 'barca' ? 'chip active' : 'chip'} onClick={() => setTeam('barca')}>ברצלונה</button>
                <button className={team === 'opp' ? 'chip active' : 'chip'} onClick={() => setTeam('opp')}>{match.opponent.name}</button>
                {lineup?.formation && <span className="small" style={{ marginInlineStart: 'auto', alignSelf: 'center' }}>מערך <bdi dir="ltr">{lineup.formation}</bdi></span>}
              </div>
              {lineup ? <Pitch lineup={lineup} /> : <div className="soon">ההרכבים עוד לא פורסמו</div>}
            </section>
          )}

          {tab === 'stats' && (
            <section className="card">
              <div className="stat-head"><span>ברצלונה</span><span>{match.opponent.name}</span></div>
              {detail.stats.length === 0 && <div className="soon">אין סטטיסטיקה למשחק הזה</div>}
              {detail.stats.map((s) => (
                <div key={s.name} className="stat-row">
                  <div className="stat-values">
                    <b>{s.barca}</b>
                    <span>{s.name}</span>
                    <b>{s.opp}</b>
                  </div>
                  <div className="stat-bar">
                    <span style={{ width: `${Math.round((s.barcaShare ?? 0.5) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </section>
          )}

          {tab === 'events' && (
            <section className="card">
              {detail.events.length === 0 && <div className="soon">אין אירועים</div>}
              {detail.events.map((e, i) => <EventRow key={i} e={e} />)}
            </section>
          )}

          {(detail.referee || detail.attendance) && (
            <div className="small" style={{ textAlign: 'center' }}>
              {detail.referee && <>שופט: {detail.referee}</>}
              {detail.referee && detail.attendance ? ' · ' : ''}
              {detail.attendance ? <>קהל: {detail.attendance.toLocaleString('he-IL')}</> : null}
            </div>
          )}
        </>
      )}
      {match.status !== 'scheduled' && detail === null && <div className="card soon">פרטי המשחק יתווספו בעדכון הבא</div>}
    </main>
  );
}
