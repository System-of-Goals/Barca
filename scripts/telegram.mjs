// News comes only from the public Telegram channel "Barca Mania" (t.me/barcamaniail).
// The robot reads the channel's open web preview (t.me/s/<channel>) for the latest posts
// and keeps a rolling list; the site shows each post with Telegram's official embed widget,
// so text, photos and videos stay hosted by Telegram and the channel is credited.

const CHANNEL = 'barcamaniail';
const KEEP = 100; // posts kept on the site
const PAGES = 8; // the web preview shows ~10–20 posts per page; older pages via ?before=<id>
const LIVE_NEWS = 'https://system-of-goals.github.io/Barca/data/news.json';
const UA = { 'user-agent': 'Mozilla/5.0 (personal non-commercial fan site)' };

const decode = (s = '') =>
  s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/[ \t]+/g, ' ')
    .trim();

async function readChannel(before) {
  const r = await fetch(`https://t.me/s/${CHANNEL}${before ? `?before=${before}` : ''}`, { headers: UA });
  if (!r.ok) throw new Error(`t.me/s/${CHANNEL}: HTTP ${r.status}`);
  const html = await r.text();
  const channel = decode(html.match(/<meta property="og:title" content="([^"]*)"/)?.[1] ?? CHANNEL);
  const posts = [];
  for (const block of html.split('tgme_widget_message_wrap').slice(1)) {
    const post = block.match(/data-post="([^"]+)"/)?.[1];
    const time = block.match(/<time[^>]*datetime="([^"]+)"/)?.[1];
    if (!post || !time) continue;
    const text = decode(block.match(/class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? '');
    const photo = /tgme_widget_message_photo/.test(block);
    // Photo or video thumbnail, served by Telegram's own image server (not copied to our site).
    const image = block.match(/tgme_widget_message_(?:photo_wrap|video_thumb)[^>]*background-image:url\('([^']+)'\)/)?.[1];
    const video = /tgme_widget_message_video|tgme_widget_message_roundvideo/.test(block);
    const firstLine = text.split('\n').find((l) => l.trim()) ?? '';
    posts.push({
      id: post.split('/')[1],
      post, // "barcamaniail/1234" – what the embed widget needs
      title: firstLine.length > 120 ? `${firstLine.slice(0, 117)}…` : firstLine || (video ? '🎬 סרטון' : photo ? '📷 תמונה' : 'הודעה'),
      text: text.slice(0, 600), // preview only; the full post is shown by the widget
      media: video ? 'video' : photo ? 'photo' : undefined,
      image,
      hasText: Boolean(text),
      source: channel,
      publishedAt: new Date(time).toISOString(),
      url: `https://t.me/${post}`,
    });
  }
  return posts;
}

export async function collectTelegram() {
  let previous = [];
  try {
    const r = await fetch(LIVE_NEWS);
    if (r.ok) previous = (await r.json()).filter((p) => p.post); // older non-Telegram items are dropped
  } catch {
    // first run
  }
  // Read page after page back in time, until we have enough posts or reach ones we already have.
  const latest = [];
  let before;
  const known = new Set(previous.map((p) => p.id));
  for (let page = 0; page < PAGES && latest.length < KEEP; page++) {
    const posts = await readChannel(before);
    if (!posts.length) break;
    latest.push(...posts);
    before = Math.min(...posts.map((p) => Number(p.id)));
    if (posts.every((p) => known.has(p.id)) && previous.length >= KEEP) break;
    await new Promise((ok) => setTimeout(ok, 1000)); // be gentle with Telegram
  }
  const byId = new Map([...previous, ...latest].map((p) => [p.id, p]));
  // Fresh copies replace older ones (image links can change).
  for (const p of latest) byId.set(p.id, p);
  const all = [...byId.values()].sort((a, b) => Number(b.id) - Number(a.id)).slice(0, KEEP);
  console.log(`telegram ${CHANNEL}: ${latest.length} latest posts (${latest.filter((p) => p.media).length} with photo/video, ${latest.filter((p) => p.image).length} with a thumbnail), ${all.length} kept`);
  return all;
}
