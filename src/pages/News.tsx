import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import type { NewsItem } from '../data/types';
import { useJson } from '../data/useJson';
import { formatDate, formatTime, timeAgo } from '../lib/format';

const TOPICS = ['הכול', 'העברות', 'פציעות', 'משחקים', 'מועדון'] as const;
const icon: Record<string, string> = { העברות: '🔁', פציעות: '🩹', משחקים: '⚽', מועדון: '🏛' };

function Story({ n }: { n: NewsItem }) {
  const [open, setOpen] = useState(false);
  return (
    <article className={`card story ${open ? 'open' : ''}`} onClick={() => setOpen(!open)}>
      <div className="small">
        {n.topic && <>{icon[n.topic]} {n.topic} · </>}
        {n.source} · {timeAgo(n.publishedAt)}
      </div>
      <h2 className="story-title">{n.title}</h2>
      {open && (
        <div onClick={(e) => e.stopPropagation()}>
          {n.summary && <p className="history-text">{n.summary}</p>}
          {n.original && <div className="small" dir="auto" style={{ marginTop: 6 }}>במקור: {n.original}</div>}
          <div className="small" style={{ marginTop: 6 }}>
            {formatDate(n.publishedAt)} · {formatTime(n.publishedAt)}
            {n.translatedBy === 'machine' && ' · תרגום מכונה'}
          </div>
          <div className="story-links">
            {(n.sources ?? [{ name: n.source, url: n.url }]).map((s) => (
              <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="chip">
                {s.name} <ExternalLink size={13} />
              </a>
            ))}
          </div>
        </div>
      )}
    </article>
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
      {list.slice(0, shown).map((n) => <Story key={n.id} n={n} />)}
      {list.length > shown && <button className="more show-all" onClick={() => setShown(shown + 15)}>טען עוד ידיעות ›</button>}
      <div className="small" style={{ textAlign: 'center' }}>ידיעות מ-48 השעות האחרונות · Mundo Deportivo ו-Google News · לחיצה על ידיעה פותחת סיכום וקישור למקור</div>
    </main>
  );
}
