import { useEffect, useState } from 'react';
import type { NewsItem } from './types';

// Live check of the Telegram channel from the browser, so news don't wait for the robot.
// Telegram itself can't be read from a web page (it blocks it), so a free public service (RSSHub)
// turns the public channel into a feed. If it doesn't answer, the robot's news are shown as before.
const CHANNEL = 'barcamaniail';
const FEED = `https://rsshub.app/telegram/channel/${CHANNEL}?format=json`;
const EVERY = 3 * 60 * 1000; // while the page is open

interface FeedItem {
  url?: string;
  id?: string;
  content_html?: string;
  date_published?: string;
}

const plain = (html: string) => {
  const d = document.createElement('div');
  d.innerHTML = html.replace(/<br\s*\/?>/gi, '\n');
  d.querySelectorAll('img,video,audio,iframe,script,style').forEach((e) => e.remove());
  return (d.textContent ?? '').replace(/ /g, ' ').trim();
};

function toItem(f: FeedItem, source: string): NewsItem | undefined {
  const url = f.url ?? f.id ?? '';
  const id = url.match(new RegExp(`${CHANNEL}/(\\d+)`))?.[1];
  if (!id) return undefined;
  const html = f.content_html ?? '';
  const video = /<video/i.test(html);
  const photo = /<img/i.test(html);
  const text = plain(html);
  const firstLine = text.split('\n').map((l) => l.trim()).find(Boolean) ?? '';
  return {
    id,
    post: `${CHANNEL}/${id}`,
    title: firstLine.length > 120 ? `${firstLine.slice(0, 117)}…` : firstLine || (video ? '🎬 סרטון' : photo ? '📷 תמונה' : 'הודעה'),
    text: text.slice(0, 300),
    media: video ? 'video' : photo ? 'photo' : undefined,
    image: html.match(/<img[^>]+src="([^"]+)"/i)?.[1] ?? html.match(/<video[^>]+poster="([^"]+)"/i)?.[1],
    hasText: Boolean(text),
    source,
    publishedAt: f.date_published ?? new Date().toISOString(),
    url: `https://t.me/${CHANNEL}/${id}`,
  };
}

async function fetchLive(): Promise<NewsItem[]> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const r = await fetch(FEED, { signal: ctrl.signal, cache: 'no-store' });
    if (!r.ok) return [];
    const j = await r.json();
    const source = String(j.title ?? 'בארסה מניה').replace(/\s*-\s*Telegram.*$/i, '');
    return (j.items ?? []).map((f: FeedItem) => toItem(f, source)).filter(Boolean) as NewsItem[];
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}

/** The robot's news plus any newer posts found live in the channel. */
export function useLiveNews(base: NewsItem[] | null | undefined): NewsItem[] | null | undefined {
  const [live, setLive] = useState<NewsItem[]>([]);
  useEffect(() => {
    let alive = true;
    const run = () => fetchLive().then((l) => alive && l.length && setLive(l));
    run();
    const timer = setInterval(() => document.visibilityState === 'visible' && run(), EVERY);
    const onShow = () => document.visibilityState === 'visible' && run();
    document.addEventListener('visibilitychange', onShow);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onShow);
    };
  }, []);
  if (base === undefined && !live.length) return base;
  const list = base ?? [];
  const newest = Math.max(0, ...list.map((n) => Number(n.id)));
  const fresh = live.filter((n) => Number(n.id) > newest).sort((a, b) => Number(b.id) - Number(a.id));
  return fresh.length ? [...fresh, ...list] : base;
}
