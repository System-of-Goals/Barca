import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, ExternalLink } from 'lucide-react';
import type { NewsItem } from '../data/types';
import { useJson } from '../data/useJson';

const CHANNEL_URL = 'https://t.me/barcamaniail';

// Telegram's official post widget: shows the post exactly as in Telegram (text, photos, videos).
function TelegramPost({ post }: { post: string }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.innerHTML = '';
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://telegram.org/js/telegram-widget.js?22';
    s.setAttribute('data-telegram-post', post);
    s.setAttribute('data-width', '100%');
    s.setAttribute('data-dark', '1');
    s.setAttribute('data-color', 'EDBB00');
    s.setAttribute('data-dark-color', 'EDBB00');
    el.appendChild(s);
  }, [post]);
  return <div className="tg-post" ref={box} />;
}

function ChannelHeader({ name }: { name?: string }) {
  return (
    <a className="card tg-channel" href={CHANNEL_URL} target="_blank" rel="noreferrer">
      <span className="tg-logo">✈️</span>
      <span>
        <b>{name ?? 'בארסה מניה'}</b>
        <span className="small"> · ערוץ הטלגרם · כל הידיעות באתר מגיעות ממנו</span>
      </span>
      <ExternalLink size={16} />
    </a>
  );
}

export function News() {
  const news = useJson<NewsItem[]>('news.json');
  const [shown, setShown] = useState(10);
  if (news === undefined) return <main className="page"><h1 className="page-title">חדשות</h1><div className="soon">טוען…</div></main>;
  const list = news ?? [];
  return (
    <main className="page">
      <h1 className="page-title">📰 חדשות</h1>
      <ChannelHeader name={list[0]?.source} />
      {list.length === 0 && <div className="card soon">אין הודעות להצגה כרגע</div>}
      {list.slice(0, shown).map((n) => <TelegramPost key={n.id} post={n.post} />)}
      {list.length > shown && <button className="more show-all" onClick={() => setShown(shown + 10)}>טען עוד הודעות ›</button>}
    </main>
  );
}

export function NewsArticle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const news = useJson<NewsItem[]>('news.json');
  if (news === undefined) return <main className="page"><div className="soon">טוען…</div></main>;
  const n = news?.find((x) => x.id === id);
  return (
    <main className="page">
      <button className="back" onClick={() => (history.length > 1 ? navigate(-1) : navigate('/news'))}>
        <ChevronRight size={20} /> חזרה
      </button>
      {n ? <TelegramPost post={n.post} /> : (
        <>
          <h1 className="page-title">ההודעה לא נמצאה</h1>
          <Link to="/news" className="more">לכל החדשות ›</Link>
        </>
      )}
      <ChannelHeader name={n?.source} />
    </main>
  );
}
