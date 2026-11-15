import { Link, useNavigate, useParams } from 'react-router-dom';
import { useJson } from '../data/useJson';
import { asset } from '../data/useSiteData';
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
import { legendStories, legendStoriesSource } from '../data/legendStories';
import { legendHonours, legendHonoursNote } from '../data/legendHonours';

const Paragraphs = ({ items }: { items: string[] }) => (
  <section className="card prose">{items.map((t, i) => <p key={i}>{t}</p>)}</section>
);

function Legends() {
  const photos = useJson<Record<string, { photo: string; credit: string }>>('legends.json');
  return (
    <section className="card">
      {legends.map((l, i) => {
        const ph = photos?.[i];
        return (
          <Link key={l.name} to={`/history/legends/${i + 1}`} className="legend-row legend-link">
            {ph ? (
              <span className="legend-photo"><img src={asset(ph.photo)} alt={l.name} loading="lazy" /></span>
            ) : (
              <span className="legend-num">{i + 1}</span>
            )}
            <div className="legend-body">
              <div className="spell-team">{l.name} <span className="small">· <bdi dir="ltr">{l.years}</bdi></span></div>
              <div className="history-text">{l.text}</div>
              <span className="legend-more">לסיפור המלא ›</span>
            </div>
          </Link>
        );
      })}
      <div className="small" style={{ marginTop: 8 }}>לחיצה על אגדה פותחת את הסיפור המלא. תמונות: ויקישיתוף (Wikimedia Commons).</div>
    </section>
  );
}

export function LegendPage() {
  const { n } = useParams();
  const navigate = useNavigate();
  const photos = useJson<Record<string, { photo: string; credit: string }>>('legends.json');
  const i = Number(n) - 1;
  const l = legends[i];
  const st = legendStories[i];
  if (!l || !st) return <main className="page"><h1 className="page-title">האגדה לא נמצאה</h1><Link to="/history/legends" className="more">לכל האגדות ›</Link></main>;
  const ph = photos?.[i];
  const hon = legendHonours[i];
  const prev = i > 0 ? i : undefined;
  const next = i < legends.length - 1 ? i + 2 : undefined;
  return (
    <main className="page">
      <button className="back" onClick={() => (history.length > 1 ? navigate(-1) : navigate('/history/legends'))}>
        <ChevronRight size={20} /> האגדות
      </button>

      <section className="card legend-hero">
        <div className="legend-hero-photo">{ph ? <img src={asset(ph.photo)} alt={l.name} /> : <span>{i + 1}</span>}</div>
        <h1 className="legend-hero-name">{l.name}</h1>
        <div className="legend-hero-latin" dir="ltr">{st.fullName}</div>
        <div className="legend-hero-years"><bdi dir="ltr">{l.years}</bdi></div>
        <div className="legend-tags">
          <span className="legend-tag">{st.role}</span>
          {st.nickname && <span className="legend-tag gold">הכינוי: {st.nickname}</span>}
          {st.extra && <span className="legend-tag">{st.extra}</span>}
        </div>
      </section>

      {hon && (
        <>
          <div className="legend-stats">
            <div><b>{hon.apps}</b><span className="small">הופעות רשמיות</span></div>
            <div><b>{hon.goals}</b><span className="small">שערים</span></div>
          </div>
          <div className="legend-stats three">
            <div><b>{hon.liga}</b><span className="small">אליפויות ספרד</span></div>
            <div><b>{hon.copa}</b><span className="small">גביעי המלך</span></div>
            <div><b>{hon.ucl}</b><span className="small">ליגת האלופות</span></div>
          </div>
          <section className="card">
            <h2 className="card-title">🌍 תארים עם הנבחרת</h2>
            {hon.national.map((t) => <div key={t} className="honour-item">🏆 {t}</div>)}
          </section>
          <section className="card">
            <h2 className="card-title">⭐ פרסים אישיים</h2>
            {hon.personal.map((t) => <div key={t} className="honour-item">⭐ {t}</div>)}
            {hon.note && <div className="small" style={{ marginTop: 8 }}>ⓘ {hon.note}</div>}
          </section>
        </>
      )}

      {st.sections.map((sec) => (
        <section key={sec.title} className="card story">
          <h2 className="card-title">{sec.title}</h2>
          {sec.paras.map((t, k) => <p key={k}>{t}</p>)}
        </section>
      ))}

      {st.note && <div className="card small legend-note">ⓘ {st.note}</div>}

      <div className="legend-nav">
        {prev !== undefined ? <Link to={`/history/legends/${prev}`} className="chip">› {legends[prev - 1].name}</Link> : <span />}
        {next !== undefined ? <Link to={`/history/legends/${next}`} className="chip">{legends[next - 1].name} ‹</Link> : <span />}
      </div>
      <div className="small" style={{ textAlign: 'center' }}>
        {legendHonoursNote} {legendStoriesSource}
        {ph && <> · <a href={ph.credit} target="_blank" rel="noreferrer" style={{ color: 'var(--gold)' }}>זכויות התמונה ↗</a></>}
      </div>
    </main>
  );
}

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
      return <Legends />;
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
