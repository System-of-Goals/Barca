// News robot: collects Barcelona news from Mundo Deportivo and Google News (RSS),
// keeps only recent items, merges the same story from several sites, and translates
// it to Hebrew. Translation: Gemini when GEMINI_API_KEY is set (free tier), otherwise
// the free MyMemory service (titles and short summaries only).

const UA = { 'user-agent': 'Mozilla/5.0 (personal non-commercial fan site)' };
const LIVE_NEWS = 'https://system-of-goals.github.io/Barca/data/news.json';
const MAX_AGE_H = 48;
const KEEP = 60;

const FEEDS = [
  { name: 'Mundo Deportivo', lang: 'es', url: 'https://www.mundodeportivo.com/rss/futbol/fc-barcelona.xml' },
  { name: 'Google News', lang: 'es', url: 'https://news.google.com/rss/search?q=%22FC+Barcelona%22+OR+Bar%C3%A7a+when:2d&hl=es&gl=ES&ceid=ES:es' },
  { name: 'Google News', lang: 'en', url: 'https://news.google.com/rss/search?q=%22FC+Barcelona%22+when:2d&hl=en-GB&gl=GB&ceid=GB:en' },
];

const decode = (s = '') =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;|&#160;|\u00a0/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();
const tag = (xml, name) => xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1];

async function readFeed(feed) {
  const r = await fetch(feed.url, { headers: UA });
  if (!r.ok) throw new Error(`${feed.url}: HTTP ${r.status}`);
  const xml = await r.text();
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, item]) => {
    let title = decode(tag(item, 'title'));
    let source = feed.name;
    // Google News titles end with " - Site name".
    if (feed.name === 'Google News') {
      const src = decode(tag(item, 'source'));
      if (src) {
        source = src;
        title = title.replace(new RegExp(`\\s+-\\s+${src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), '');
      }
    }
    return {
      title,
      summary: feed.name === 'Google News' ? '' : decode(tag(item, 'description')).slice(0, 400),
      url: decode(tag(item, 'link')),
      publishedAt: new Date(decode(tag(item, 'pubDate'))).toISOString(),
      source,
      lang: feed.lang,
    };
  });
}

// Same story on several sites: compare the words of the titles.
const words = (t) => new Set(t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').match(/[a-z0-9]{4,}/g) ?? []);
function similar(a, b) {
  const A = words(a);
  const B = words(b);
  if (!A.size || !B.size) return false;
  let same = 0;
  for (const w of A) if (B.has(w)) same++;
  return same / Math.min(A.size, B.size) >= 0.6;
}

const TOPICS = [
  { topic: 'העברות', re: /fich(ar|aj|a |[oó])|traspaso|mercado|transfer|signing|\bsign\b|renovaci|renueva|contrato|contract|cesi[oó]n|\bloan\b|oferta|cl[aá]usula|release clause|bid\b/i },
  { topic: 'פציעות', re: /lesi[oó]n|lesionad|injur|parte m[eé]dico|rotura|esguince|hamstring|knee|muscle|sidelined|baja para|ser[aá] baja/i },
  { topic: 'משחקים', re: /\bpartido|previa|cr[oó]nica|alineaci|\bgol(es)?\b|\bgoals?\b|\bmatch|victoria|derrota|empate|\bwin\b|\bdraw\b|lineup|cl[aá]sico|expuls|red card|jornada|vs\.?\s/i },
];
const topicOf = (t) => TOPICS.find((x) => x.re.test(t))?.topic ?? 'מועדון';
const aboutBarca = (t) => /bar[cç]a|barcelona|blaugrana|azulgrana|culé|cule|flick|camp nou|yamal|lamine|pedri|raphinha|lewandowski|cubars|de jong|olmo|ferm[ií]n|gavi|kound/i.test(t);

// ---------- translation ----------
// One request for all new stories: the free tier allows few requests per minute.
async function geminiBatch(items) {
  const key = process.env.GEMINI_API_KEY;
  const list = items.map((it, i) => `#${i}\nכותרת: ${it.title}\nתקציר: ${it.summary || '(אין)'}`).join('\n\n');
  const prompt = `לפניך ${items.length} ידיעות על ברצלונה (בספרדית או באנגלית). לכל ידיעה כתוב כותרת וסיכום בעברית טבעית, במילים שלך (לא תרגום מילולי), ובחר נושא.
החזר JSON בלבד: מערך באותו סדר, כל איבר: {"i": מספר, "title": "כותרת עד 12 מילים", "summary": "2-3 משפטים", "topic": "העברות" | "פציעות" | "משחקים" | "מועדון"}.
העברות = רכישות, מכירות, השאלות, חוזים; פציעות = פציעות והיעדרויות; משחקים = משחק מסוים, תוצאה, הרכב; מועדון = כל השאר.

${list}`;
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal: AbortSignal.timeout(90_000),
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        // A fixed shape makes Gemini escape quotes inside the Hebrew text correctly.
        responseSchema: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              i: { type: 'INTEGER' },
              title: { type: 'STRING' },
              summary: { type: 'STRING' },
              topic: { type: 'STRING', enum: ['העברות', 'פציעות', 'משחקים', 'מועדון'] },
            },
            required: ['i', 'title', 'summary', 'topic'],
          },
        },
      },
    }),
  });
  if (!r.ok) throw new Error(`gemini HTTP ${r.status}`);
  const out = JSON.parse((await r.json()).candidates[0].content.parts[0].text);
  const topics = ['העברות', 'פציעות', 'משחקים', 'מועדון'];
  const byIndex = new Map(out.map((o) => [Number(o.i), o]));
  return items.map((_, i) => {
    const o = byIndex.get(i);
    return o?.title ? { title: o.title, summary: o.summary, topic: topics.includes(o.topic) ? o.topic : undefined, by: 'gemini' } : undefined;
  });
}

async function myMemory(text, lang) {
  if (!text) return '';
  const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 450))}&langpair=${lang}|he`, { headers: UA });
  const j = await r.json();
  if (j.responseStatus !== 200 && j.responseStatus !== '200') throw new Error(`mymemory: ${j.responseDetails ?? j.responseStatus}`);
  return decode(j.responseData.translatedText);
}

async function machineHebrew(item) {
  return { title: await myMemory(item.title, item.lang), summary: await myMemory(item.summary, item.lang), by: 'machine' };
}

// ---------- main ----------
export async function collectNews() {
  // Items already translated last time are reused, so each story is translated once.
  let previous = [];
  try {
    const r = await fetch(LIVE_NEWS);
    if (r.ok) previous = await r.json();
  } catch {
    // first run
  }

  const fresh = [];
  for (const feed of FEEDS) {
    try {
      const items = await readFeed(feed);
      console.log(`news feed ${feed.name} (${feed.lang}): ${items.length} items`);
      fresh.push(...items);
    } catch (e) {
      console.warn(`news feed ${feed.name}: ${e.message}`);
    }
  }

  const cutoff = Date.now() - MAX_AGE_H * 3600 * 1000;
  const stories = [...previous.filter((p) => new Date(p.publishedAt).getTime() > cutoff)];
  let fromMd = 0;
  const picked = [];
  // Mundo Deportivo first, so its version (with a summary) leads a merged story.
  fresh.sort((a, b) => (a.source === 'Mundo Deportivo' ? -1 : 0) - (b.source === 'Mundo Deportivo' ? -1 : 0));
  for (const it of fresh) {
    if (!it.title || isNaN(new Date(it.publishedAt)) || new Date(it.publishedAt).getTime() < cutoff) continue;
    if (!aboutBarca(`${it.title} ${it.summary}`)) continue;
    const same = stories.find((s) => similar(s.original, it.title)) ?? picked.find((p) => similar(p.it.title, it.title));
    if (same) {
      if (same.sources && !same.sources.some((s) => s.name === it.source)) same.sources.push({ name: it.source, url: it.url });
      if (same.it && !same.extra.some((s) => s.name === it.source) && same.it.source !== it.source) same.extra.push({ name: it.source, url: it.url });
      continue;
    }
    // Stay inside the free limits, and leave room for sites other than Mundo Deportivo.
    if (picked.length >= 25) continue;
    const md = it.source === 'Mundo Deportivo';
    if (md && fromMd >= 12) continue;
    if (!md && picked.length - fromMd >= 13) continue;
    if (md) fromMd++;
    picked.push({ it, extra: [] });
  }

  let hebrew = picked.map(() => undefined);
  if (process.env.GEMINI_API_KEY && picked.length) {
    try {
      hebrew = await geminiBatch(picked.map((p) => p.it));
    } catch (e) {
      console.warn(`news: ${e.message} – using machine translation`);
    }
  }
  let byGemini = 0;
  for (const [i, { it, extra }] of picked.entries()) {
    let he = hebrew[i];
    if (he) byGemini++;
    else {
      try {
        he = await machineHebrew(it);
        await new Promise((ok) => setTimeout(ok, 300));
      } catch (e) {
        console.warn(`news translate: ${e.message}`);
        continue;
      }
    }
    stories.push({
      id: Buffer.from(it.url).toString('base64url').slice(-16),
      title: he.title || it.title,
      summary: he.summary,
      translatedBy: he.by,
      original: it.title,
      topic: he.topic ?? topicOf(`${it.title} ${it.summary}`),
      topicBy: he.topic ? 'gemini' : 'words',
      publishedAt: it.publishedAt,
      source: it.source,
      url: it.url,
      sources: [{ name: it.source, url: it.url }, ...extra],
    });
  }
  const translated = picked.length;
  for (const st of stories) if (st.topicBy !== 'gemini') st.topic = topicOf(st.original ?? '');
  stories.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  console.log(`news: ${stories.length} stories (${translated} new: ${byGemini} by Gemini, ${translated - byGemini} by machine)`);
  return stories.slice(0, KEEP);
}
