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
  // Direct feeds: their links open the article itself, so it can get an extended summary.
  { name: 'MARCA', lang: 'es', url: 'https://e00-marca.uecdn.es/rss/futbol/barcelona.xml' },
  // Sites that often appear through Google News; their own feeds link straight to the article.
  { name: 'Crónica Global', lang: 'es', url: 'https://cronicaglobal.elespanol.com/rss/' },
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
const otherSection = (t) => /f[uú]tbol sala|futsal|baloncesto|basket|balonmano|handball|hockey|femen|women|wom[ae]n's|liga f\b|bar[cç]a atl[eè]tic|juvenil|el ?pozo/i.test(t);
const aboutBarca = (t) => /bar[cç]a|barcelona|blaugrana|azulgrana|culé|cule|flick|camp nou|yamal|lamine|pedri|raphinha|lewandowski|cubars|de jong|olmo|ferm[ií]n|gavi|kound/i.test(t);

// ---------- translation ----------
// One request for all new stories: the free tier allows few requests per minute.
async function geminiBatch(items) {
  const key = process.env.GEMINI_API_KEY;
  const list = items.map((it, i) => `#${i}\nכותרת: ${it.title}\nתקציר: ${it.summary || '(אין)'}`).join('\n\n');
  const prompt = `לפניך ${items.length} ידיעות שהזכירו את ברצלונה (בספרדית או באנגלית). לכל ידיעה:
1. relevant: true רק אם הידיעה עוסקת בקבוצת הכדורגל הבוגרת של הגברים של FC Barcelona (שחקנים, מאמן, משחקים, העברות, הנהלה, אצטדיון). false אם היא על קבוצות אחרות של המועדון (פוטסל, כדורסל, כדוריד, נשים, נוער, ברצלונה אתלטיק) או על קבוצה אחרת לגמרי.
2. כותרת וסיכום בעברית טבעית, במילים שלך (לא תרגום מילולי).
3. topic: העברות = רכישות, מכירות, השאלות, חוזים, וגם שמועות ועניין בשחקן ("על הרדאר", "מתעניינים"); פציעות = פציעות והיעדרויות; משחקים = משחק מסוים, תוצאה, הרכב; מועדון = כל השאר.
החזר JSON בלבד: מערך באותו סדר.

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
              relevant: { type: 'BOOLEAN' },
              title: { type: 'STRING' },
              summary: { type: 'STRING' },
              topic: { type: 'STRING', enum: ['העברות', 'פציעות', 'משחקים', 'מועדון'] },
            },
            required: ['i', 'relevant', 'title', 'summary', 'topic'],
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
    if (o && o.relevant === false) return { skip: true };
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

// ---------- extended summaries (250–350 words) from the full article ----------
// The robot says honestly that it is a bot. A site that refuses bots keeps the short summary.
const BROWSER = { ...UA, 'accept-language': 'es,en;q=0.8' };

// Downloads an article and keeps only its paragraphs. Returns '' when the site blocks us,
// the article is behind a paywall, or the link stays on Google News.
async function articleText(url) {
  const r = await fetch(url, { headers: BROWSER, redirect: 'follow', signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  if (/news\.google\.com/.test(r.url)) throw new Error('Google News link (not opened)');
  const html = (await r.text()).replace(/<(script|style|noscript|svg|figure|aside|nav|footer|header)[\s\S]*?<\/\1>/gi, ' ');
  const body = html.match(/<article[\s\S]*?<\/article>/i)?.[0] ?? html;
  const paras = [...body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => decode(m[1]))
    .filter((t) => t.length > 60 && !/cookies|suscr[ií]bete|newsletter|todos los derechos|all rights reserved/i.test(t));
  return paras.join('\n').slice(0, 7000);
}

async function geminiDetailed(items) {
  const key = process.env.GEMINI_API_KEY;
  const list = items.map((it, i) => `#${i}\nכותרת: ${it.original}\nטקסט הכתבה:\n${it.text}`).join('\n\n=====\n\n');
  const prompt = `לפניך ${items.length} כתבות על ברצלונה. לכל כתבה כתוב בעברית טבעית, במילים שלך (לא תרגום מילולי של הכתבה), סיכום מורחב של 250–350 מילים בסך הכול, לפי המבנה:
- short: "בקצרה" – 2–3 משפטים: מה קרה.
- points: "הנקודות העיקריות" – 4–7 נקודות, כל אחת משפט-שניים, עם כל העובדות החשובות מהכתבה (שמות, מספרים, תאריכים, קבוצות).
- quotes: "מה נאמר" – עד 2 ציטוטים קצרים (עד 25 מילים כל אחד) מתורגמים לעברית, עם מי אמר. אם אין ציטוטים – מערך ריק.
- meaning: "מה זה אומר לברצלונה" – 1–2 משפטים של הקשר.
כתוב רק מה שמופיע בכתבה – בלי להמציא עובדות.

${list}`;
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal: AbortSignal.timeout(120_000),
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              i: { type: 'INTEGER' },
              short: { type: 'STRING' },
              points: { type: 'ARRAY', items: { type: 'STRING' } },
              quotes: { type: 'ARRAY', items: { type: 'OBJECT', properties: { who: { type: 'STRING' }, text: { type: 'STRING' } }, required: ['text'] } },
              meaning: { type: 'STRING' },
            },
            required: ['i', 'short', 'points', 'quotes', 'meaning'],
          },
        },
      },
    }),
  });
  if (!r.ok) throw new Error(`gemini HTTP ${r.status}`);
  const out = JSON.parse((await r.json()).candidates[0].content.parts[0].text);
  return new Map(out.map((o) => [Number(o.i), o]));
}

// Adds an extended summary to up to 8 stories per run (newest first). Each story is tried
// at most twice; when the article can't be read it keeps its short summary.
async function deepen(stories) {
  if (!process.env.GEMINI_API_KEY) return;
  const opens = (s) => [...(s.sources ?? []), { url: s.url }].some((x) => !/news\.google\.com/.test(x.url));
  const todo = stories.filter((s) => !s.detail && (s.detailTries ?? 0) < 2 && opens(s)).slice(0, 8);
  const ready = [];
  let blocked = 0;
  for (const st of todo) {
    st.detailTries = (st.detailTries ?? 0) + 1;
    // Prefer a direct link to the site over a Google News link.
    const links = [...(st.sources ?? []), { url: st.url }].map((x) => x.url).sort((a, b) => /news\.google/.test(a) - /news\.google/.test(b));
    let text = '';
    for (const url of [...new Set(links)]) {
      try {
        text = await articleText(url);
        if (text.length > 400) break;
      } catch (e) {
        text = '';
      }
    }
    if (text.length > 400) ready.push({ st, original: st.original ?? st.title, text });
    else blocked++;
  }
  let done = 0;
  for (let i = 0; i < ready.length; i += 4) {
    const chunk = ready.slice(i, i + 4);
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await geminiDetailed(chunk);
        chunk.forEach((c, j) => {
          const o = res.get(j);
          if (o?.short && o.points?.length) {
            c.st.detail = { short: o.short, points: o.points, quotes: (o.quotes ?? []).filter((q) => q.text), meaning: o.meaning };
            done++;
          }
        });
        break;
      } catch (e) {
        console.warn(`news detail: ${e.message} (attempt ${attempt}/3)`);
        if (attempt < 3 && /HTTP (503|429|500)/.test(e.message)) await new Promise((ok) => setTimeout(ok, 15_000));
        else break;
      }
    }
  }
  console.log(`news detail: ${done} extended summaries written, ${blocked} articles could not be read`);
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
  const stories = [...previous.filter((p) => new Date(p.publishedAt).getTime() > cutoff && !otherSection(p.original ?? ''))];
  let fromMd = 0;
  const picked = [];
  // Mundo Deportivo first, so its version (with a summary) leads a merged story.
  const direct = (x) => (/news\.google\.com/.test(x.url) ? 1 : 0);
  fresh.sort((a, b) => direct(a) - direct(b));
  for (const it of fresh) {
    if (!it.title || isNaN(new Date(it.publishedAt)) || new Date(it.publishedAt).getTime() < cutoff) continue;
    if (!aboutBarca(`${it.title} ${it.summary}`)) continue;
    if (otherSection(`${it.title} ${it.summary}`)) continue;
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
    // Gemini's free tier is sometimes busy (503/429): try up to three times before falling back.
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        hebrew = await geminiBatch(picked.map((p) => p.it));
        break;
      } catch (e) {
        console.warn(`news: ${e.message} (attempt ${attempt}/3)`);
        if (attempt < 3 && /HTTP (503|429|500)/.test(e.message)) await new Promise((ok) => setTimeout(ok, 15_000));
        else break;
      }
    }
  }
  let byGemini = 0;
  let skipped = 0;
  for (const [i, { it, extra }] of picked.entries()) {
    let he = hebrew[i];
    if (he?.skip) {
      skipped++;
      continue;
    }
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
  try {
    await deepen(stories);
  } catch (e) {
    console.warn(`news detail: ${e.message}`);
  }
  console.log(`news: ${stories.length} stories (${translated} new: ${byGemini} by Gemini, ${translated - byGemini - skipped} by machine, ${skipped} not about the men's first team)`);
  return stories.slice(0, KEEP);
}
