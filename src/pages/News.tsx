import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, ExternalLink } from 'lucide-react';
import type { NewsItem } from '../data/types';
import { useJson } from '../data/useJson';
import { formatDate, formatTime, timeAgo } from '../lib/format';

const TOPICS = ['הכול', 'העברות', 'פציעות', 'משחקים', 'מועדון'] as const;
const icon: Record<string, string> = { העברות: '🔁', פציעות: '🩹', משחקים: '⚽', מועדון: '🏛' };

function Meta({ n }: { n: NewsItem }) {
  return (
    <div className="small">
      {n.topic && <>{icon[n.topic]} {n.topic} · </>}
      {n.source} · {timeAgo(n.publishedAt)}
    </div>
  );
}

export function News() {
  const news = useJson<NewsItem[]>('news.json');
  const [topic, setTopic] = useState<(typeof TOPICS)[number]>('הכול');
  const [shown, setShown] = useState(15);

  if (news === undefined) return <main className="page"><h1 className="page-title">חדשות</h1><div className="soon">טוען…</div></main>;
  const list = (news ?? []).filter((n) => topic === 'הכול' || n.topic === topic);

  return (
    <main className="page">
      <h1 className="page-title">📰 חדשות</h1>
      <div className="chips">
        {TOPICS.map((t) => (
          <button key={t} className={t === topic ? 'chip active' : 'chip'} onClick={() => { setTopic(t); setShown(15); }}>
            {t === 'הכול' ? t : `${icon[t]} ${t}`}
          </button>
        ))}
      </div>
      {list.length === 0 && <div className="card soon">אין ידיעות להצגה כרגע</div>}
      {list.slice(0, shown).map((n) => (
        <Link key={n.id} to={`/news/${n.id}`} className="card card-link story">
          <Meta n={n} />
          <h2 className="story-title">{n.title}</h2>
          {(n.detail?.short ?? n.summary) && <p className="story-teaser">{n.detail?.short ?? n.summary}</p>}
          {n.detail && <span className="small gold">📖 סיכום מורחב ›</span>}
        </Link>
      ))}
      {list.length > shown && <button className="more show-all" onClick={() => setShown(shown + 15)}>טען עוד ידיעות ›</button>}
      <div className="small" style={{ textAlign: 'center' }}>ידיעות מ-48 השעות האחרונות · Mundo Deportivo ו-Google News</div>
    </main>
  );
}

export function NewsArticle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const news = useJson<NewsItem[]>('news.json');
  if (news === undefined) return <main className="page"><div className="soon">טוען…</div></main>;
  const n = news?.find((x) => x.id === id);
  if (!n) {
    return (
      <main className="page">
        <h1 className="page-title">הידיעה לא נמצאה</h1>
        <div className="small">ידיעות נשמרות באתר 48 שעות.</div>
        <Link to="/news" className="more">לכל החדשות ›</Link>
      </main>
    );
  }
  const d = n.detail;
  return (
    <main className="page">
      <button className="back" onClick={() => (history.length > 1 ? navigate(-1) : navigate('/news'))}>
        <ChevronRight size={20} /> חזרה
      </button>
      <section className="card">
        <Meta n={n} />
        <h1 className="article-title">{n.title}</h1>
        <div className="small">{formatDate(n.publishedAt)} · {formatTime(n.publishedAt)}</div>
      </section>

      {d ? (
        <>
          <section className="card">
            <h2 className="card-title">📝 בקצרה</h2>
            <p className="article-text">{d.short}</p>
          </section>
          <section className="card">
            <h2 className="card-title">📌 הנקודות העיקריות</h2>
            <ul className="article-points">{d.points.map((p, i) => <li key={i}>{p}</li>)}</ul>
          </section>
          {d.quotes.length > 0 && (
            <section className="card">
              <h2 className="card-title">💬 מה נאמר</h2>
              {d.quotes.map((q, i) => (
                <blockquote key={i} className="article-quote">
                  ״{q.text}״
                  {q.who && <footer className="small">— {q.who}</footer>}
                </blockquote>
              ))}
            </section>
          )}
          <section className="card meaning">
            <h2 className="card-title">🔵🔴 מה זה אומר לברצלונה</h2>
            <p className="article-text">{d.meaning}</p>
          </section>
          <div className="small" style={{ textAlign: 'center' }}>סיכום בעברית שנכתב על ידי בינה מלאכותית (Gemini) מתוך הכתבה המקורית</div>
        </>
      ) : (
        <section className="card">
          {n.summary && <p className="article-text">{n.summary}</p>}
          <div className="small" style={{ marginTop: 8 }}>
            {n.translatedBy === 'machine' ? 'תרגום מכונה · ' : ''}
            לידיעה הזו אין עדיין סיכום מורחב – הוא נוסף בדרך כלל תוך 15–30 דקות, אלא אם אתר המקור חוסם קריאה אוטומטית.
          </div>
        </section>
      )}

      <section className="card">
        {n.original && <div className="small" dir="auto">הכותרת במקור: {n.original}</div>}
        <div className="story-links">
          {(n.sources ?? [{ name: n.source, url: n.url }]).map((s) => (
            <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="chip">
              לכתבה ב-{s.name} <ExternalLink size={13} />
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
