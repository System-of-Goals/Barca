import { useEffect, useState } from 'react';
import type { NewsItem } from './types';

// Live check of the Telegram channel from the browser, so news don't wait for the robot.
// A web page isn't allowed to read t.me directly, so the public channel page (t.me/s/…, the same page
// the robot reads) is fetched through a free public relay that allows it. Several are tried in order;
// if none answers, the robot's news are shown as before.
const CHANNEL = 'barcamaniail';
const PAGE = `https://t.me/s/${CHANNEL}`;
// json: the relay wraps the page as { contents: "<html…>" }.
const RELAYS = [
  { url: `https://api.allorigins.win/raw?url=${encodeURIComponent(PAGE)}`, json: false },
  { url: `https://api.allorigins.win/get?url=${encodeURIComponent(PAGE)}`, json: true },
];
export let lastLiveError = '';
const EVERY = 3 * 60 * 1000; // while the page is open

const decode = (html: string) => {
  const d = document.createElement('div');
  d.innerHTML = html.replace(/<br\s*\/?>/gi, '\n');
  return (d.textContent ?? '').replace(/\u00a0/g, ' ').trim();
};

// Same reading as the robot (scripts/telegram.mjs).
function parseChannel(html: string): NewsItem[] {
  const source = decode(html.match(/<meta property="og:title" content="([^"]*)"/)?.[1] ?? 'בארסה מניה');
  const posts: NewsItem[] = [];
  for (const block of html.split('tgme_widget_message_wrap').slice(1)) {
    const post = block.match(/data-post="([^"]+)"/)?.[1];
    const time = block.match(/<time[^>]*datetime="([^"]+)"/)?.[1];
    if (!post || !time || !post.startsWith(`${CHANNEL}/`)) continue;
    const text = decode(block.match(/class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? '');
    const photo = /tgme_widget_message_photo/.test(block);
    const image = block.match(/tgme_widget_message_(?:photo_wrap|video_thumb)[^>]*background-image:url\('([^']+)'\)/)?.[1];
    const video = /tgme_widget_message_video|tgme_widget_message_roundvideo/.test(block);
    const firstLine = text.split('\n').find((l) => l.trim()) ?? '';
    posts.push({
      id: post.split('/')[1],
      post,
      title: firstLine.length > 120 ? `${firstLine.slice(0, 117)}…` : firstLine || (video ? '🎬 סרטון' : photo ? '📷 תמונה' : 'הודעה'),
      text: text.slice(0, 600),
      media: video ? 'video' : photo ? 'photo' : undefined,
      image,
      hasText: Boolean(text),
      source,
      publishedAt: new Date(time).toISOString(),
      url: `https://t.me/${post}`,
    });
  }
  return posts;
}

async function fetchLive(): Promise<NewsItem[]> {
  const errors: string[] = [];
  for (const relay of RELAYS) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    try {
      const r = await fetch(relay.url, { signal: ctrl.signal, cache: 'no-store' });
      if (!r.ok) {
        errors.push(`HTTP ${r.status}`);
        continue;
      }
      const html = relay.json ? String((await r.json()).contents ?? '') : await r.text();
      const posts = parseChannel(html);
      if (posts.length) {
        lastLiveError = '';
        return posts;
      }
      errors.push('אין פוסטים בתשובה');
    } catch (e) {
      errors.push(ctrl.signal.aborted ? 'לא ענה בזמן' : 'נחסם');
    } finally {
      clearTimeout(t);
    }
  }
  lastLiveError = errors.join(' / ');
  return [];
}

export type LiveStatus = 'checking' | 'ok' | 'off';

/** The robot's news plus any newer posts found live in the channel, and how the live check went. */
export function useLiveNewsState(base: NewsItem[] | null | undefined) {
  const [live, setLive] = useState<NewsItem[]>([]);
  const [status, setStatus] = useState<LiveStatus>('checking');
  const [checkedAt, setCheckedAt] = useState<Date>();
  useEffect(() => {
    let alive = true;
    const run = () =>
      fetchLive().then((l) => {
        if (!alive) return;
        setStatus(l.length ? 'ok' : 'off');
        if (l.length) {
          setLive(l);
          setCheckedAt(new Date());
        }
      });
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
  const list = base ?? [];
  const newest = Math.max(0, ...list.map((n) => Number(n.id)));
  const fresh = live.filter((n) => Number(n.id) > newest).sort((a, b) => Number(b.id) - Number(a.id));
  const news = base === undefined && !live.length ? base : fresh.length ? [...fresh, ...list] : base;
  return { news, status, checkedAt, fresh: fresh.length };
}

export const useLiveNews = (base: NewsItem[] | null | undefined) => useLiveNewsState(base).news;
