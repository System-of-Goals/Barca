import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Crown, Target, Newspaper, Trophy, User } from 'lucide-react';
import type { Leader, Match, SiteData } from '../data/types';
import { asset } from '../data/useSiteData';
import { todayInHistory } from '../data/history';
import { Header } from '../components/Header';
import {
  formatDate,
  formatTime,
  formatWeekday,
  outcome,
  outcomeLabel,
  pad2,
  splitCountdown,
  timeAgo,
} from '../lib/format';

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

const byKickoff = (a: Match, b: Match) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime();

function NextMatch({ match }: { match: Match }) {
  const now = useNow(1000);
  const { days, hours, minutes } = splitCountdown(new Date(match.kickoff).getTime() - now);
  const live = match.status === 'live';
  return (
    <Link to={`/matches/${match.id}`} className="hero card-link">
      <div className="hero-label">
        {live ? (
          <span className="live-badge"><span className="live-dot" /> עכשיו {match.minute ? `${match.minute}׳` : ''}</span>
        ) : (
          <>המשחק הקרוב · {match.competition} · {match.round}</>
        )}
      </div>
      <div className="hero-teams">
        ברצלונה נגד {match.opponent.name}
        {match.opponent.crest && <img className="hero-crest" src={asset(match.opponent.crest)} alt="" />}
      </div>
      <div className="hero-meta">
        {formatWeekday(match.kickoff)} {formatDate(match.kickoff)} · {formatTime(match.kickoff)} · {match.venue}
      </div>
      {live ? (
        <div className="score-row" style={{ marginTop: 12 }}>
          <span className="score-team">ברצלונה</span>
          <span className="score">
            <span>{match.barcaGoals ?? 0}</span>
            <span className="score-dash">–</span>
            <span>{match.opponentGoals ?? 0}</span>
          </span>
          <span className="score-team opp">{match.opponent.name}</span>
        </div>
      ) : (
        <div className="countdown" aria-label="ספירה לאחור">
          <div className="cd-unit"><div className="cd-num">{pad2(days)}</div><div className="cd-label">ימים</div></div>
          <div className="cd-unit"><div className="cd-num">{pad2(hours)}</div><div className="cd-label">שעות</div></div>
          <div className="cd-unit"><div className="cd-num">{pad2(minutes)}</div><div className="cd-label">דקות</div></div>
        </div>
      )}
    </Link>
  );
}

function LastMatch({ match }: { match: Match }) {
  const o = outcome(match);
  return (
    <Link to={`/matches/${match.id}`} className="card card-link">
      <h2 className="card-title">המשחק האחרון</h2>
      <div className="score-row">
        <span className="score-team">ברצלונה</span>
        <span className="score">
          <span>{match.barcaGoals}</span>
          <span className="score-dash">–</span>
          <span>{match.opponentGoals}</span>
        </span>
        <span className="score-team opp">
          {match.opponent.crest && <img className="mini-crest" src={asset(match.opponent.crest)} alt="" />} {match.opponent.name}
        </span>
      </div>
      <div className="small" style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
        {o && <span className={`badge ${o}`}>{outcomeLabel[o]}</span>}
        {match.competition} · {formatDate(match.kickoff)}
      </div>
    </Link>
  );
}

const ringLetter = { win: 'נ', draw: 'ת', loss: 'ה' } as const;

function LastFive({ matches }: { matches: Match[] }) {
  return (
    <section className="card">
      <h2 className="card-title">5 המשחקים האחרונים</h2>
      <div className="form-list">
        {matches.map((m) => {
          const o = outcome(m)!;
          return (
            <Link key={m.id} to={`/matches/${m.id}`} className="form-item">
              <span className={`ring ${o}`} aria-label={outcomeLabel[o]}>{ringLetter[o]}</span>
              <span className="form-score">{m.barcaGoals}–{m.opponentGoals}</span>
              <span className="form-opp">{m.opponent.name} <span className="small">({m.home ? 'ב' : 'ח'})</span></span>
              <span className="small">{formatDate(m.kickoff)}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function LeaderCard({ leader, title, unit, icon }: { leader: Leader; title: string; unit: string; icon: React.ReactNode }) {
  const photo = asset(leader.photo);
  return (
    <Link to={`/players/${leader.playerId}`} className="leader card-link">
      <div className="leader-photo">{photo ? <img src={photo} alt={leader.name} /> : <User size={40} />}</div>
      <div style={{ position: 'relative' }}>
        <div className="leader-title">{icon} {title}</div>
        <div className="leader-name">{leader.name}</div>
        <div className="leader-value"><b>{leader.value}</b> {unit}</div>
        {leader.competition && <div className="small" style={{ color: '#fff', opacity: 0.8 }}>{leader.competition}</div>}
      </div>
    </Link>
  );
}

export function Home({ data }: { data: SiteData }) {
  const sorted = [...data.matches].sort(byKickoff);
  const next = sorted.find((m) => m.status !== 'finished');
  const played = sorted.filter((m) => m.status === 'finished').reverse();
  const last = played[0];

  return (
    <>
      <Header updatedAt={data.updatedAt} crest={data.crest} />
      {data.isSample && <div className="sample-banner">⚠️ נתוני דוגמה – הנתונים האמיתיים יחוברו בהמשך</div>}
      <main className="page" style={{ marginTop: 12 }}>
        {next && <NextMatch match={next} />}
        {last && <LastMatch match={last} />}
        {played.length > 0 && <LastFive matches={played.slice(0, 5)} />}

        {data.standings.length > 0 && (
        <section className="card">
          <h2 className="card-title"><Trophy size={18} /> המקום שלנו</h2>
          {data.standings.map((s) => (
            <div key={s.competition} className="stand-row">
              <span className="stand-comp">{s.competition}</span>
              <span>מקום <span className="gold">{s.position}</span></span>
              <span>· <span className="gold">{s.points}</span> נק׳</span>
            </div>
          ))}
          {data.standings[0]?.note && <div className="small">{data.standings[0].note}</div>}
          <Link to="/tables" className="more">לטבלאות ›</Link>
        </section>
        )}

        {(data.topScorer || data.topAssister) && (
          <div className="leaders">
            {data.topScorer && <LeaderCard leader={data.topScorer} title="מלך השערים" unit="שערים" icon={<Crown size={14} />} />}
            {data.topAssister && <LeaderCard leader={data.topAssister} title="מלך הבישולים" unit="בישולים" icon={<Target size={14} />} />}
          </div>
        )}

        {(() => {
          const h = todayInHistory();
          return h ? (
            <Link to="/history" className="card card-link">
              <h2 className="card-title"><CalendarDays size={18} /> {h.today ? 'היום בהיסטוריה' : 'בקרוב בהיסטוריה'}</h2>
              <div><span className="gold">{h.date}/{h.year}</span> · {h.text}</div>
            </Link>
          ) : null;
        })()}

        {data.news.length > 0 && (
        <section className="card">
          <h2 className="card-title"><Newspaper size={18} /> חדשות אחרונות</h2>
          {data.news.slice(0, 3).map((n) => (
            <Link key={n.id} to="/news" className="news-item">
              <div className="news-thumb" />
              <div>
                <div className="news-title">{n.title}</div>
                <div className="small">{n.source} · {timeAgo(n.publishedAt)}</div>
              </div>
            </Link>
          ))}
          <Link to="/news" className="more">לכל החדשות ›</Link>
        </section>
        )}

        <div className="footer-note">אתר מעריצים אישי ולא רשמי · אין קשר ל-FC Barcelona</div>
      </main>
    </>
  );
}
