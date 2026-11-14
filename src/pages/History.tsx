import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  chapters,
  clasico,
  coaches,
  founding,
  greatSeasons,
  legends,
  masia,
  masiaGraduates,
  stadium,
  timeline,
  titles,
  titlesAsOf,
  todayInHistory,
} from '../data/history';

const Paragraphs = ({ items }: { items: string[] }) => (
  <section className="card prose">{items.map((t, i) => <p key={i}>{t}</p>)}</section>
);

function ChapterBody({ id }: { id: string }) {
  switch (id) {
    case 'founding':
      return <Paragraphs items={founding} />;
    case 'timeline':
      return (
        <section className="card">
          <div className="timeline big">
            {timeline.map((t) => (
              <div key={t.years} className="spell">
                <span className="spell-dot" />
                <div className="spell-main">
                  <div className="small gold">{t.years}</div>
                  <div className="spell-team">{t.title}</div>
                  <div className="history-text">{t.text}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      );
    case 'titles':
      return (
        <>
          {(['ספרד', 'אירופה', 'עולם'] as const).map((g) => (
            <section key={g} className="card">
              <h2 className="card-title">{g}</h2>
              {titles.filter((t) => t.group === g).map((t) => (
                <div key={t.name} className="title-row">
                  <span className="title-count">{t.count}</span>
                  <div>
                    <div className="spell-team">{t.name}</div>
                    {t.note && <div className="small">{t.note}</div>}
                  </div>
                </div>
              ))}
            </section>
          ))}
          <div className="small" style={{ textAlign: 'center' }}>{titlesAsOf} · לא מתעדכן אוטומטית</div>
          <h2 className="month">העונות הגדולות</h2>
          {greatSeasons.map((s) => (
            <section key={s.season} className="card">
              <div className="small gold">{s.season}</div>
              <div className="spell-team">{s.title}</div>
              <div className="history-text">{s.text}</div>
            </section>
          ))}
        </>
      );
    case 'legends':
      return (
        <section className="card">
          {legends.map((l, i) => (
            <div key={l.name} className="legend-row">
              <span className="legend-num">{i + 1}</span>
              <div>
                <div className="spell-team">{l.name} <span className="small">· {l.years}</span></div>
                <div className="history-text">{l.text}</div>
              </div>
            </div>
          ))}
        </section>
      );
    case 'coaches':
      return (
        <section className="card">
          {coaches.map((c) => (
            <div key={c.name} className="legend-row">
              <div>
                <div className="spell-team">{c.name} <span className="small">· {c.years}</span></div>
                <div className="history-text">{c.text}</div>
              </div>
            </div>
          ))}
          <div className="small" style={{ marginTop: 8 }}>המאמנים הבולטים בלבד – לא הרשימה המלאה.</div>
        </section>
      );
    case 'stadium':
      return <Paragraphs items={stadium} />;
    case 'clasico':
      return (
        <>
          <Paragraphs items={clasico.intro} />
          <h2 className="month">משחקים בלתי נשכחים</h2>
          <section className="card">
            {clasico.games.map((g) => (
              <div key={g.date} className="legend-row">
                <div>
                  <div className="small gold">{g.date}</div>
                  <div className="spell-team">{g.score}</div>
                  <div className="history-text">{g.text}</div>
                </div>
              </div>
            ))}
          </section>
        </>
      );
    case 'masia':
      return (
        <>
          <Paragraphs items={masia} />
          <section className="card">
            {masiaGraduates.map((g) => (
              <div key={g.era} className="legend-row">
                <div>
                  <div className="spell-team">{g.era}</div>
                  <div className="history-text">{g.names}</div>
                </div>
              </div>
            ))}
          </section>
        </>
      );
    default:
      return null;
  }
}

export function History() {
  const today = todayInHistory();
  return (
    <main className="page">
      <h1 className="page-title">ההיסטוריה של ברצלונה</h1>
      <div className="small" style={{ margin: '-6px 4px 0' }}>"יותר ממועדון" · נוסד ב-1899</div>
      <div className="chapter-grid">
        {chapters.map((c) => (
          <Link key={c.id} to={`/history/${c.id}`} className="chapter-card">
            <span className="chapter-icon">{c.icon}</span>
            <span className="chapter-title">{c.title}</span>
            <span className="small">{c.summary}</span>
          </Link>
        ))}
      </div>
      {today && (
        <section className="card">
          <h2 className="card-title">📅 {today.today ? 'היום בהיסטוריה' : 'בקרוב בהיסטוריה'}</h2>
          <div><span className="gold">{today.date}/{today.year}</span> · {today.text}</div>
        </section>
      )}
    </main>
  );
}

export function HistoryChapter() {
  const { chapter } = useParams();
  const navigate = useNavigate();
  const i = chapters.findIndex((c) => c.id === chapter);
  const c = chapters[i];
  if (!c) return <main className="page"><h1 className="page-title">הפרק לא נמצא</h1><Link to="/history" className="more">להיסטוריה ›</Link></main>;
  const next = chapters[(i + 1) % chapters.length];
  return (
    <main className="page">
      <button className="back" onClick={() => navigate('/history')}><ChevronRight size={20} /> היסטוריה</button>
      <h1 className="page-title">{c.icon} {c.title}</h1>
      <ChapterBody id={c.id} />
      <Link to={`/history/${next.id}`} className="card card-link next-chapter">
        <span className="small">הפרק הבא</span>
        <span className="spell-team">{next.icon} {next.title}</span>
        <ChevronLeft size={20} />
      </Link>
    </main>
  );
}
