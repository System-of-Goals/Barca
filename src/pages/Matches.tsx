import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Match, SiteData } from '../data/types';
import { asset } from '../data/useSiteData';
import { formatDate, formatTime, formatWeekday, outcome, outcomeLabel } from '../lib/format';

const monthName = (iso: string) =>
  new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', month: 'long', year: 'numeric' }).format(new Date(iso));

const ringLetter = { win: 'נ', draw: 'ת', loss: 'ה' } as const;

function MatchRow({ m }: { m: Match }) {
  const o = outcome(m);
  const crest = asset(m.opponent.crest);
  return (
    <Link to={`/matches/${m.id}`} className="match-row">
      {o ? (
        <span className={`ring ${o}`} aria-label={outcomeLabel[o]}>{ringLetter[o]}</span>
      ) : m.status === 'live' ? (
        <span className="live-badge"><span className="live-dot" /></span>
      ) : (
        <span className="match-time">{formatTime(m.kickoff)}</span>
      )}
      <div className="match-main">
        <div className="match-teams">
          {crest && <img className="mini-crest" src={crest} alt="" />}
          <span>{m.opponent.name}</span>
          <span className="small">({m.home ? 'ב' : 'ח'})</span>
        </div>
        <div className="small">
          {formatWeekday(m.kickoff)} {formatDate(m.kickoff)} · {m.competition}{m.round ? ` · ${m.round}` : ''}
        </div>
      </div>
      {m.barcaGoals !== undefined && (
        <span className="score match-score">
          <span>{m.barcaGoals}</span>
          <span className="score-dash">–</span>
          <span>{m.opponentGoals}</span>
        </span>
      )}
    </Link>
  );
}

export function Matches({ data }: { data: SiteData }) {
  const [tab, setTab] = useState<'results' | 'fixtures'>('results');
  const [comp, setComp] = useState<string>('הכול');

  const competitions = ['הכול', ...new Set(data.matches.map((m) => m.competition))];
  const inComp = data.matches.filter((m) => comp === 'הכול' || m.competition === comp);
  const results = inComp.filter((m) => m.status !== 'scheduled').sort((a, b) => b.kickoff.localeCompare(a.kickoff));
  const fixtures = inComp.filter((m) => m.status === 'scheduled').sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  const list = tab === 'results' ? results : fixtures;

  const finished = results.filter((m) => m.status === 'finished');
  const count = (o: string) => finished.filter((m) => outcome(m) === o).length;
  const goalsFor = finished.reduce((s, m) => s + (m.barcaGoals ?? 0), 0);
  const goalsAgainst = finished.reduce((s, m) => s + (m.opponentGoals ?? 0), 0);

  // Group by month, keeping the list order.
  const groups: { month: string; matches: Match[] }[] = [];
  for (const m of list) {
    const month = monthName(m.kickoff);
    if (groups.at(-1)?.month !== month) groups.push({ month, matches: [] });
    groups.at(-1)!.matches.push(m);
  }

  return (
    <main className="page">
      <h1 className="page-title">משחקים</h1>

      <div className="tabs">
        <button className={tab === 'results' ? 'active' : ''} onClick={() => setTab('results')}>תוצאות</button>
        <button className={tab === 'fixtures' ? 'active' : ''} onClick={() => setTab('fixtures')}>לוח משחקים</button>
      </div>

      <div className="chips">
        {competitions.map((c) => (
          <button key={c} className={c === comp ? 'chip active' : 'chip'} onClick={() => setComp(c)}>{c}</button>
        ))}
      </div>

      {tab === 'results' && finished.length > 0 && (
        <div className="card summary">
          <span>{finished.length} משחקים</span>
          <span className="win-text">נ {count('win')}</span>
          <span className="draw-text">ת {count('draw')}</span>
          <span className="loss-text">ה {count('loss')}</span>
          <span>שערים <b className="gold">{goalsFor}–{goalsAgainst}</b></span>
        </div>
      )}

      {groups.length === 0 && <div className="card soon">אין משחקים להצגה</div>}
      {groups.map((g) => (
        <section key={g.month}>
          <h2 className="month">{g.month}</h2>
          <div className="card" style={{ padding: '4px 14px' }}>
            {g.matches.map((m) => <MatchRow key={m.id} m={m} />)}
          </div>
        </section>
      ))}
    </main>
  );
}
