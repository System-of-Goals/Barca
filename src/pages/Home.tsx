import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Crown, Target, Newspaper, Trophy, User } from 'lucide-react';
import type { Match, SiteData } from '../data/types';
import { Header } from '../components/Header';
import {
  competitionName,
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
          <>המשחק הקרוב · {competitionName[match.competition]} · {match.round}</>
        )}
      </div>
      <div className="hero-teams">ברצלונה נגד {match.opponent.name}</div>
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
        <span className="score-team opp">{match.opponent.name}</span>
      </div>
      <div className="small" style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
        {o && <span className={`badge ${o}`}>{outcomeLabel[o]}</span>}
        {competitionName[match.competition]} · {formatDate(match.kickoff)}
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

export function Home({ data }: { data: SiteData }) {
  const sorted = [...data.matches].sort(byKickoff);
  const next = sorted.find((m) => m.status !== 'finished');
  const played = sorted.filter((m) => m.status === 'finished').reverse();
  const last = played[0];

  return (
    <>
      <Header updatedAt={data.updatedAt} />
      {data.isSample && <div className="sample-banner">⚠️ נתוני דוגמה – הנתונים האמיתיים יחוברו בהמשך</div>}
      <main className="page" style={{ marginTop: 12 }}>
        {next && <NextMatch match={next} />}
        {last && <LastMatch match={last} />}
        {played.length > 0 && <LastFive matches={played.slice(0, 5)} />}

        <section className="card">
          <h2 className="card-title"><Trophy size={18} /> המקום שלנו</h2>
          {data.standings.map((s) => (
            <div key={s.competition} className="stand-row">
              <span className="stand-comp">{competitionName[s.competition]}</span>
              <span>מקום <span className="gold">{s.position}</span></span>
              <span>· <span className="gold">{s.points}</span> נק׳</span>
            </div>
          ))}
          {data.standings[0]?.note && <div className="small">{data.standings[0].note}</div>}
          <Link to="/tables" className="more">לטבלאות ›</Link>
        </section>

        <div className="leaders">
          <Link to={`/players/${data.topScorer.playerId}`} className="leader card-link">
            <div className="leader-photo"><User size={40} /></div>
            <div style={{ marginRight: 4, position: 'relative' }}>
              <div className="leader-title"><Crown size={14} /> מלך השערים</div>
              <div className="leader-name">{data.topScorer.name}</div>
              <div className="leader-value"><b>{data.topScorer.value}</b> שערים</div>
            </div>
          </Link>
          <Link to={`/players/${data.topAssister.playerId}`} className="leader card-link">
            <div className="leader-photo"><User size={40} /></div>
            <div style={{ position: 'relative' }}>
              <div className="leader-title"><Target size={14} /> מלך הבישולים</div>
              <div className="leader-name">{data.topAssister.name}</div>
              <div className="leader-value"><b>{data.topAssister.value}</b> בישולים</div>
            </div>
          </Link>
        </div>

        {data.todayInHistory && (
          <Link to="/history" className="card card-link">
            <h2 className="card-title"><CalendarDays size={18} /> היום בהיסטוריה</h2>
            <div><span className="gold">{data.todayInHistory.year}</span> · {data.todayInHistory.text}</div>
          </Link>
        )}

        <section className="card">
          <h2 className="card-title"><Newspaper size={18} /> חדשות אחרונות</h2>
          {data.news.slice(0, 3).map((n) => (
            <a key={n.id} href={n.url} className="news-item">
              <div className="news-thumb" />
              <div>
                <div className="news-title">{n.title}</div>
                <div className="small">{n.source} · {timeAgo(n.publishedAt)}</div>
              </div>
            </a>
          ))}
          <Link to="/news" className="more">לכל החדשות ›</Link>
        </section>

        <div className="footer-note">אתר מעריצים אישי ולא רשמי · אין קשר ל-FC Barcelona</div>
      </main>
    </>
  );
}
