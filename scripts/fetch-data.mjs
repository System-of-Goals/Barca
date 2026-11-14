// Collects Barcelona's data from 365Scores (in Hebrew) and writes
// public/data/site.json in the shape of src/data/types.ts.
// Runs on GitHub's servers before every build (every 15 minutes).
// If 365Scores fails, it keeps the last published data so the site never breaks.

import { appendFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { collectTelegram } from './telegram.mjs';
import { fromEspn } from './espn.mjs';

// No request may hang the robot: every fetch gives up after 25 seconds.
const plainFetch = globalThis.fetch;
globalThis.fetch = (url, options = {}) => plainFetch(url, { signal: AbortSignal.timeout(25_000), ...options });

// Everything the robot reports also goes to robot.log, printed at the end of the workflow.
for (const level of ['log', 'warn', 'error']) {
  const original = console[level].bind(console);
  console[level] = (...args) => {
    original(...args);
    appendFileSync('robot.log', `${level === 'log' ? '' : level.toUpperCase() + ': '}${args.join(' ')}\n`);
  };
}

const OUT_DIR = 'public/data';
const IMG_DIR = 'public/img';
const LIVE_URL = 'https://system-of-goals.github.io/Barca/data/site.json';

const API = 'https://webws.365scores.com/web';
const Q = 'appTypeId=5&langId=2&timezoneName=Asia/Jerusalem';
const BARCA = 132;
const HEADERS = { 'user-agent': 'Mozilla/5.0 (personal non-commercial fan site)' };
const IMG = 'https://imagecache.365scores.com/image/upload/f_png,w_160,h_160,c_limit,q_auto:eco,dpr_2';

async function api(path) {
  const r = await fetch(`${API}/${path}${path.includes('?') ? '&' : '?'}${Q}`, { headers: HEADERS });
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  return r.json();
}

// Images are copied into the site, so the browser never loads them from 365Scores.
const saved = new Map();
async function saveImage(kind, id, version) {
  const file = `${kind.toLowerCase()}-${id}.png`;
  if (saved.has(file)) return saved.get(file);
  const url = `${IMG},d_${kind}:default1.png/v${version ?? 1}/${kind}/${id}`;
  try {
    const r = await fetch(url, { headers: HEADERS });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    await writeFile(`${IMG_DIR}/${file}`, Buffer.from(await r.arrayBuffer()));
    saved.set(file, `img/${file}`);
  } catch (e) {
    console.warn(`image ${kind}/${id}: ${e.message}`);
    saved.set(file, undefined);
  }
  return saved.get(file);
}

// The season starts in July.
function seasonStart(now = new Date()) {
  const y = now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return new Date(Date.UTC(y, 6, 1));
}

const STATUS = { 2: 'scheduled', 3: 'live', 4: 'finished' };

// Injured / suspended players: 365Scores lists them in a match's lineup with status 3 ("Missing").
const unavailableFrom = { next: undefined, last: undefined };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_HE = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
function returnInHebrew(text) {
  if (!text) return undefined;
  const m = text.match(/^(Early|Mid|Late)?\s*([A-Za-z]+)\s+(\d{4})$/);
  if (!m || !MONTHS.includes(m[2])) return text;
  const part = { Early: 'תחילת ', Mid: 'אמצע ', Late: 'סוף ' }[m[1]] ?? '';
  return `${part}${MONTHS_HE[MONTHS.indexOf(m[2])]} ${m[3]}`;
}
function missingPlayers(game, side = 'barca') {
  if (!game) return [];
  const barcaHome = game.homeCompetitor?.id === BARCA;
  const us = (side === 'barca') === barcaHome ? game.homeCompetitor : game.awayCompetitor;
  const people = new Map((game.members ?? []).map((m) => [m.id, m]));
  return (us?.lineups?.members ?? [])
    .filter((m) => m.status === 3)
    .map((m) => {
      const reason = m.injury?.reason ?? m.suspension?.reason ?? m.reason;
      const suspended = Boolean(m.suspension) || /השעי|כרטיס|הרחק/.test(reason ?? '') || (m.injury?.categoryId ?? 1) !== 1;
      return {
        playerId: String(people.get(m.id)?.athleteId ?? m.id),
        name: people.get(m.id)?.shortName ?? people.get(m.id)?.name,
        kind: suspended ? 'suspension' : 'injury',
        reason,
        expectedReturn: returnInHebrew(m.injury?.expectedReturn),
      };
    });
}

function splitCompetition(name = '') {
  const i = name.indexOf(' - ');
  return i < 0 ? [name, ''] : [name.slice(0, i), name.slice(i + 3)];
}

// Friendlies get no table or rankings page.
const isFriendly = (name) => /ידידות|גאמפר/.test(name);

// Rankings in the order the spec asks for; any others follow.
const RANKING_ORDER = ['שערים', 'בישולים', 'כרטיסים צהובים', 'כרטיסים אדומים', 'רשת נקייה', '365 מצטיינים'];
const rankOrder = (n) => (RANKING_ORDER.includes(n) ? RANKING_ORDER.indexOf(n) : RANKING_ORDER.length);

async function toMatch(g) {
  const home = g.homeCompetitor.id === BARCA;
  const us = home ? g.homeCompetitor : g.awayCompetitor;
  const them = home ? g.awayCompetitor : g.homeCompetitor;
  const status = STATUS[g.statusGroup] ?? 'scheduled';
  // "סופר קאפ - חצי גמר" → competition "סופר קאפ", round "חצי גמר".
  const [competition, stage] = splitCompetition(g.competitionDisplayName);
  const round = g.roundNum && g.roundName === 'מחזור' ? `מחזור ${g.roundNum}` : stage || g.stageName || g.roundName || '';
  return {
    id: String(g.id),
    competition,
    round,
    kickoff: new Date(g.startTime).toISOString(),
    venue: home ? 'בית' : 'חוץ',
    home,
    opponent: { name: them.name, crest: await saveImage('Competitors', them.id, them.imageVersion) },
    status,
    ...(status !== 'scheduled' && us.score >= 0 ? { barcaGoals: us.score, opponentGoals: them.score } : {}),
    ...(status === 'live' && g.gameTime > 0 ? { minute: Math.floor(g.gameTime) } : {}),
  };
}

async function leader(stats, tableName) {
  const table = stats?.stats?.athletesStats?.tables?.find((t) => t.name === tableName);
  const row = table?.rows?.[0];
  if (!row) return undefined;
  const competition = stats.competitions?.find((c) => c.id === table.competitionId)?.name;
  return {
    playerId: String(row.entity.id),
    name: row.entity.shortName || row.entity.name,
    photo: await saveImage('Athletes', row.entity.id, row.entity.imageVersion),
    value: Number(row.stats?.[0]?.value ?? 0),
    competition,
  };
}


// Each Barcelona player's season, added up from the match details.
const season = new Map(); // athleteId -> totals
function totals(athleteId, competition) {
  if (!season.has(athleteId)) season.set(athleteId, { all: blank(), byCompetition: {} });
  const t = season.get(athleteId);
  t.byCompetition[competition] ??= blank();
  return [t.all, t.byCompetition[competition]];
}
function blank() {
  return { apps: 0, starts: 0, minutes: 0, goals: 0, assists: 0, yellow: 0, red: 0, ratingSum: 0, ratings: 0 };
}

// Full details of one played (or live) match: events, lineups, statistics.
// Written to public/data/matches/<id>.json, read by the match page.
async function matchDetail(gameId, competition, finished) {
  const [{ game: g }, statsRes] = await Promise.all([
    api(`game/?gameId=${gameId}`),
    api(`game/stats/?games=${gameId}`).catch(() => ({})),
  ]);
  if (finished && (!unavailableFrom.last || g.startTime > unavailableFrom.last.startTime)) unavailableFrom.last = g;
  const barcaHome = g.homeCompetitor.id === BARCA;

  const usC = barcaHome ? g.homeCompetitor : g.awayCompetitor;
  const themC = barcaHome ? g.awayCompetitor : g.homeCompetitor;
  const people = new Map((g.members ?? []).map((m) => [m.id, m]));
  const nameOf = (id) => {
    const m = people.get(id);
    return m ? m.shortName || m.name : undefined;
  };

  const kindOf = (t) => {
    if (t.id === 1) return 'goal';
    if (/חילוף/.test(t.name)) return 'sub';
    if (/צהוב/.test(t.name) || /צהוב/.test(t.subTypeName ?? '')) return 'yellow';
    if (/אדום/.test(t.name) || /אדום/.test(t.subTypeName ?? '')) return 'red';
    return 'other';
  };
  const events = (g.events ?? [])
    .filter((e) => e.isMajor || kindOf(e.eventType) !== 'other')
    .map((e) => ({
      minute: e.gameTimeDisplay || `${e.gameTime}'`,
      side: e.competitorId === BARCA ? 'barca' : 'opp',
      kind: kindOf(e.eventType),
      label: e.eventType.subTypeName && e.eventType.id === 1 && e.eventType.subTypeName !== 'שער שדה' ? e.eventType.subTypeName : e.eventType.name,
      player: nameOf(e.playerId),
      extra: (e.extraPlayers ?? []).map(nameOf).filter(Boolean),
    }));

  if (finished) {
    for (const e of g.events ?? []) {
      if (e.competitorId !== BARCA) continue;
      const kind = kindOf(e.eventType);
      const who = people.get(e.playerId)?.athleteId;
      if (kind === 'goal' && who && !/עצמי/.test(e.eventType.subTypeName ?? '')) {
        totals(who, competition).forEach((t) => t.goals++);
        const helper = people.get(e.extraPlayers?.[0])?.athleteId;
        if (helper) totals(helper, competition).forEach((t) => t.assists++);
      }
      if ((kind === 'yellow' || kind === 'red') && who) totals(who, competition).forEach((t) => t[kind]++);
    }
  }

  async function lineup(c, withPhotos) {
    const lu = c.lineups;
    if (!lu?.members?.length) return undefined;
    const players = [];
    for (const m of lu.members) {
      const id = m.id ?? m.playerId ?? m.athleteId;
      const p = people.get(id) ?? {};
      if (finished && c.id === BARCA && p.athleteId) {
        const minutes = parseInt(m.stats?.find((x) => x.type === 30)?.value ?? '0', 10) || 0;
        if (m.status === 1 || minutes > 0) {
          for (const t of totals(p.athleteId, competition)) {
            t.apps++;
            if (m.status === 1) t.starts++;
            t.minutes += minutes;
            if (typeof m.ranking === 'number' && m.ranking > 0) {
              t.ratingSum += m.ranking;
              t.ratings++;
            }
          }
        }
      }
      players.push({
        id: String(p.athleteId ?? id),
        name: p.shortName || p.name || '',
        number: p.jerseyNumber,
        starting: m.status === 1,
        position: m.position?.name,
        line: m.yardFormation?.fieldLine,
        side: m.yardFormation?.fieldSide,
        rating: typeof m.ranking === 'number' ? m.ranking : undefined,
        photo: withPhotos && p.athleteId ? await saveImage('Athletes', p.athleteId, p.imageVersion) : undefined,
      });
    }
    return { formation: lu.formation, players };
  }

  const all = statsRes.statistics ?? [];
  const stats = [];
  for (const st of all.filter((x) => x.competitorId === usC.id)) {
    const other = all.find((x) => x.id === st.id && x.competitorId === themC.id);
    if (!other) continue;
    stats.push({ name: st.name, barca: st.value, opp: other.value, barcaShare: st.valuePercentage });
  }

  return {
    id: String(g.id),
    venue: g.venue?.name,
    attendance: g.venue?.attendance,
    referee: g.officials?.[0]?.name,
    events,
    lineups: { barca: await lineup(usC, true), opp: await lineup(themC, false) },
    stats,
  };
}

// Full tables and player rankings for one competition (public/data/tables.json).
async function competitionTables(id, name) {
  const s = await api(`standings/?competitions=${id}`).catch(() => ({}));
  const rows = [];
  for (const r of s.standings?.[0]?.rows ?? []) {
    const form = (r.detailedRecentForm ?? []).slice(-5).map((g) => {
      const mine = g.homeCompetitor.id === r.competitor.id ? g.homeCompetitor : g.awayCompetitor;
      const other = mine === g.homeCompetitor ? g.awayCompetitor : g.homeCompetitor;
      return mine.score > other.score ? 'win' : mine.score < other.score ? 'loss' : 'draw';
    });
    rows.push({
      position: r.position,
      team: r.competitor.name,
      crest: await saveImage('Competitors', r.competitor.id, r.competitor.imageVersion),
      barca: r.competitor.id === BARCA,
      played: r.gamePlayed,
      won: r.gamesWon,
      drawn: r.gamesEven,
      lost: r.gamesLost,
      goalsFor: r.for,
      goalsAgainst: r.against,
      points: r.points,
      form,
    });
  }

  const rankings = async (path, withPhotos) => {
    let st = await api(path).catch(() => undefined);
    if (!st?.stats?.athletesStats?.tables?.length) {
      await new Promise((r) => setTimeout(r, 2000));
      st = await api(path).catch(() => undefined);
    }
    const out = [];
    for (const t of st?.stats?.athletesStats?.tables ?? []) {
      const list = [];
      for (const row of (t.rows ?? []).slice(0, 10)) {
        const team = st.competitors?.find((c) => c.id === row.entity.competitorId);
        list.push({
          playerId: String(row.entity.id),
          name: row.entity.shortName || row.entity.name,
          team: team?.name,
          barca: row.entity.competitorId === BARCA,
          value: row.stats?.[0]?.value ?? '',
          photo: withPhotos && row.entity.competitorId === BARCA ? await saveImage('Athletes', row.entity.id, row.entity.imageVersion) : undefined,
        });
      }
      if (list.length) out.push({ name: t.name, rows: list });
    }
    return out.sort((a, b) => rankOrder(a.name) - rankOrder(b.name));
  };

  return {
    competition: name,
    rows,
    barcaRankings: await rankings(`stats/?competitions=${id}&competitors=${BARCA}`, true),
    allRankings: await rankings(`stats/?competitions=${id}`, true),
  };
}

// ---------- Career and awards from Wikidata (refreshed once a day) ----------
// Two SPARQL queries cover the whole squad, so Wikidata isn't asked once per player.
const SPARQL = 'https://query.wikidata.org/sparql';
const WD_HEADERS = { 'user-agent': 'personal-fan-site-bot/1.0 (non-commercial; one query a day)', accept: 'application/sparql-results+json' };
const CAREER_URL = 'https://system-of-goals.github.io/Barca/data/careers.json';
const CAREER_VERSION = 6; // bump to refresh before the daily update

async function sparql(query) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(`${SPARQL}?query=${encodeURIComponent(query)}`, { headers: WD_HEADERS });
    if (r.status === 429 || r.status >= 500) {
      const wait = Number(r.headers.get('retry-after')) || 10;
      await new Promise((ok) => setTimeout(ok, Math.min(wait, 30) * 1000));
      continue;
    }
    if (!r.ok) throw new Error(`wikidata HTTP ${r.status}`);
    return (await r.json()).results.bindings;
  }
  throw new Error('wikidata busy');
}

// Everyone who joined Barcelona's first team since 2015 and hasn't left.
const CURRENT = `?player p:P54 ?now. ?now ps:P54 wd:Q7156; pq:P580 ?since. FILTER NOT EXISTS { ?now pq:P582 ?left } FILTER(YEAR(?since) >= 2015)
  ?player wdt:P569 ?birth.`;

const v = (b, k) => b[k]?.value;
const yearOf = (t) => (t ? Number(t.slice(0, 4)) : undefined);
const numOf = (t) => (t !== undefined ? Number(t) : undefined);

// Returns { updatedAt, players: { [365 athlete id]: { career, awards, wikipedia } } }.
async function careers(squad) {
  try {
    const r = await fetch(CAREER_URL);
    if (r.ok) {
      const old = await r.json();
      if (old.version === CAREER_VERSION && Date.now() - new Date(old.updatedAt).getTime() < 24 * 60 * 60 * 1000) return old;
    }
  } catch {
    // no published copy yet
  }

  const spells = await sparql(`SELECT ?player ?birth ?teamLabel ?start ?end ?apps ?goals ?loan ?article WHERE {
  ${CURRENT}
  ?player p:P54 ?s. ?s ps:P54 ?team.
  OPTIONAL { ?s pq:P580 ?start } OPTIONAL { ?s pq:P582 ?end }
  OPTIONAL { ?s pq:P1350 ?apps } OPTIONAL { ?s pq:P1351 ?goals } OPTIONAL { ?s pq:P1642 ?loan }
  OPTIONAL { ?article schema:about ?player; schema:isPartOf <https://he.wikipedia.org/> }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "he,en". }
}`);
  const awards = await sparql(`SELECT ?player ?birth ?awardLabel ?when WHERE {
  ${CURRENT}
  ?player p:P166 ?a. ?a ps:P166 ?award. OPTIONAL { ?a pq:P585 ?when }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "he,en". }
}`);

  // Group by player; key = birth date, which is how we match 365Scores' squad.
  const byBirth = new Map();
  const entry = (b) => {
    const key = v(b, 'birth')?.slice(0, 10);
    if (!byBirth.has(key)) byBirth.set(key, new Map());
    const m = byBirth.get(key);
    const id = v(b, 'player');
    if (!m.has(id)) m.set(id, { career: [], awards: [], seen: new Set() });
    return m.get(id);
  };
  for (const b of spells) {
    const e = entry(b);
    if (v(b, 'article')) e.wikipedia = v(b, 'article');
    const spell = {
      team: v(b, 'teamLabel'),
      from: yearOf(v(b, 'start')),
      to: yearOf(v(b, 'end')),
      apps: numOf(v(b, 'apps')),
      goals: numOf(v(b, 'goals')),
      loan: Boolean(v(b, 'loan')),
    };
    const key = `${spell.team}|${spell.from}`;
    if (e.seen.has(key)) continue;
    e.seen.add(key);
    e.career.push({ ...spell, national: /נבחרת|national/i.test(spell.team ?? '') });
  }
  const awardKeys = new Set();
  for (const b of awards) {
    const e = entry(b);
    const award = { name: v(b, 'awardLabel'), year: yearOf(v(b, 'when')) };
    const key = `${v(b, 'player')}|${award.name}|${award.year}`;
    if (awardKeys.has(key)) continue;
    awardKeys.add(key);
    e.awards.push(award);
  }

  // Every competition season Barcelona won. On Wikidata the winner is sometimes set on the
  // season item and sometimes only on the final (which is "part of" the season), so ask for both.
  const won = await sparql(`SELECT DISTINCT ?compLabel ?start ?end ?time WHERE {
  ?item wdt:P1346 wd:Q7156.
  OPTIONAL { ?item wdt:P3450 ?c1 }
  # Only a final counts as winning the edition it belongs to – not any match Barcelona won.
  OPTIONAL { ?item wdt:P361 ?edition. ?edition wdt:P3450 ?c2.
             ?item rdfs:label ?en. FILTER(LANG(?en) = "en" && REGEX(?en, "(^|[^-])[Ff]inal") && !REGEX(?en, "[Ss]emi|[Qq]uarter"))
             OPTIONAL { ?edition wdt:P580 ?es } OPTIONAL { ?edition wdt:P582 ?ee } }
  BIND(COALESCE(?c1, ?c2) AS ?comp)
  FILTER(BOUND(?comp))
  OPTIONAL { ?item wdt:P580 ?s } OPTIONAL { ?item wdt:P582 ?e } OPTIONAL { ?item wdt:P585 ?time }
  BIND(COALESCE(?s, ?es) AS ?start) BIND(COALESCE(?e, ?ee) AS ?end)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "he,en". }
}`);

  // Football seasons run from summer to summer: 2024/25 is August 2024 – May 2025.
  // A one-off event (a Super Cup in January 2025) belongs to the season it falls in.
  const seasonOf = (start, end, time) => {
    const sy = yearOf(start);
    const ey = yearOf(end);
    let first;
    if (sy && ey && ey > sy) first = sy;
    else {
      const d = time ?? end ?? start;
      if (!d) return undefined;
      const y = Number(d.slice(0, 4));
      const month = Number(d.slice(5, 7)) || 6;
      first = month >= 7 ? y : y - 1;
    }
    return { label: `${first}/${String(first + 1).slice(2)}`, endYear: first + 1 };
  };

  const seen = new Set();
  // Titles missing on Wikidata, added by hand (checked): Super Cup final, 12 January 2025, 5–2 v Real Madrid.
  const barcaTitles = [{ competition: 'הסופר קאפ הספרדי', label: '2024/25', endYear: 2025 }];
  seen.add('הסופר קאפ הספרדי|2024/25');
  for (const b of won) {
    const competition = v(b, 'compLabel');
    const season = seasonOf(v(b, 'start'), v(b, 'end'), v(b, 'time'));
    if (!competition || !season || /גמפר|Gamper/i.test(competition)) continue;
    const key = `${competition}|${season.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    barcaTitles.push({ competition, ...season });
  }
  const recent = barcaTitles.filter((t) => t.endYear >= 2023).map((t) => `${t.competition} ${t.label}`).sort();
  console.log(`barca titles on Wikidata: ${barcaTitles.length}; since 2022/23: ${recent.join(', ')}`);

  // A player shares a title if he was at Barcelona during that season:
  // he joined before the season ended, and hadn't left before it ended.
  const titlesFor = (career) => {
    const spells = career.filter((c) => !c.national && /^ברצלונה$|^FC Barcelona$/.test(c.team ?? ''));
    const byComp = new Map();
    for (const t of barcaTitles) {
      if (!spells.some((c) => (c.from ?? 9999) < t.endYear && t.endYear <= (c.to ?? 9999))) continue;
      if (!byComp.has(t.competition)) byComp.set(t.competition, []);
      byComp.get(t.competition).push(t);
    }
    return [...byComp]
      .map(([competition, list]) => ({ competition, seasons: list.sort((x, y) => x.endYear - y.endYear).map((t) => t.label) }))
      .sort((a, b) => b.seasons.length - a.seasons.length);
  };

  const players = {};
  for (const p of squad) {
    const candidates = byBirth.get(p.birthdate?.slice(0, 10));
    const e = candidates && candidates.size === 1 ? [...candidates.values()][0] : undefined;
    players[p.id] = e
      ? {
          wikipedia: e.wikipedia,
          career: e.career.sort((a, b) => (a.from ?? 0) - (b.from ?? 0)),
          awards: e.awards.sort((a, b) => (b.year ?? 0) - (a.year ?? 0)),
          titles: titlesFor(e.career),
        }
      : null;
  }
  const sample = squad.find((p) => /קובארסי/.test(p.name));
  if (sample) console.log(`titles check – ${sample.name}: ${JSON.stringify(players[sample.id]?.titles)}`);
  const found = Object.values(players).filter(Boolean).length;
  const withAwards = Object.values(players).filter((x) => x?.awards.length).length;
  console.log(`careers: found ${found}/${squad.length} players on Wikidata, ${withAwards} with awards`);
  return { version: CAREER_VERSION, updatedAt: new Date().toISOString(), players };
}

// ---------- Photos of the club legends (Wikimedia Commons, free licences) ----------
// English Wikidata labels of the 20 legends, in the order of src/data/history.ts.
const LEGENDS = [
  'Paulino Alcántara', 'Josep Samitier', 'László Kubala', 'Luis Suárez Miramontes', 'Johan Cruyff',
  'Carles Rexach', 'Diego Maradona', 'Ronald Koeman', 'Michael Laudrup', 'Hristo Stoichkov',
  'Rivaldo', 'Ronaldinho', "Samuel Eto'o", 'Carles Puyol', 'Xavi',
  'Andrés Iniesta', 'Lionel Messi', 'Gerard Piqué', 'Sergio Busquets', 'Luis Suárez',
];
const LIVE_IMG = 'https://system-of-goals.github.io/Barca/';

async function legendPhotos() {
  const values = LEGENDS.map((n) => `"${n.replace(/"/g, '\\"')}"@en`).join(' ');
  const rows = await sparql(`SELECT ?name ?image WHERE {
  VALUES ?name { ${values} }
  ?p rdfs:label ?name; wdt:P54 wd:Q7156; wdt:P18 ?image.
}`);
  const out = {};
  for (const [i, name] of LEGENDS.entries()) {
    const image = rows.find((r) => v(r, 'name') === name)?.image?.value;
    if (!image) continue;
    const file = decodeURIComponent(image.split('/Special:FilePath/')[1] ?? '');
    const path = `img/legend-${i}.jpg`;
    // Reuse the copy already on our site; only go to Commons the first time.
    let r = await fetch(LIVE_IMG + path).catch(() => undefined);
    if (!r?.ok) {
      r = await fetch(`https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=320`, { headers: WD_HEADERS }).catch(() => undefined);
      await new Promise((ok) => setTimeout(ok, 1000));
    }
    if (!r?.ok) continue;
    await writeFile(`public/${path}`, Buffer.from(await r.arrayBuffer()));
    out[i] = { photo: path, credit: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replace(/ /g, '_'))}` };
  }
  console.log(`legend photos: ${Object.keys(out).length}/${LEGENDS.length}`);
  return out;
}

// The squad, with each player's season (public/data/players.json).
async function squadFile() {
  const res = await api(`squads/?competitors=${BARCA}`);
  const countries = new Map((res.countries ?? []).map((c) => [c.id, c.name]));
  const finish = (t) => {
    const { ratingSum, ratings, ...rest } = t;
    return { ...rest, rating: ratings ? Math.round((ratingSum / ratings) * 100) / 100 : undefined };
  };
  const players = [];
  let coach;
  for (const a of res.squads?.[0]?.athletes ?? []) {
    const base = {
      id: String(a.id),
      name: a.shortName || a.name,
      fullName: a.name,
      number: a.jerseyNum,
      position: a.position?.name,
      detailedPosition: a.formationPosition?.name,
      positionOrder: a.formationPosition?.order ?? 99,
      age: a.age,
      birthdate: a.birthdate,
      height: a.height,
      nationality: countries.get(a.nationalityId),
      photo: await saveImage('Athletes', a.id, a.imageVersion),
    };
    const roleText = `${a.position?.name ?? ''} ${a.formationPosition?.name ?? ''}`;
    const isPlayerRole = /שוער|מגן|קשר|חלוץ/.test(a.position?.name ?? '');
    if (!isPlayerRole) console.log(`staff: ${a.name} · position=${a.position?.name}/${a.position?.id} formation=${a.formationPosition?.name}`);
    // The head coach: by role name, or else the first staff member listed (365 lists the head coach first).
    if (!coach && !isPlayerRole && (/מאמן|coach|manager/i.test(roleText) || !players.some((x) => !/שוער|מגן|קשר|חלוץ/.test(x.position ?? '')))) {
      coach = base;
      continue;
    }
    const t = season.get(a.id);
    players.push({
      ...base,
      season: t ? finish(t.all) : undefined,
      byCompetition: t ? Object.entries(t.byCompetition).map(([competition, v]) => ({ competition, ...finish(v) })) : [],
    });
  }
  players.sort((x, y) => x.positionOrder - y.positionOrder || (x.number ?? 99) - (y.number ?? 99));

  const nextList = missingPlayers(unavailableFrom.next);
  const fromGame = nextList.length ? unavailableFrom.next : unavailableFrom.last;
  const missing = nextList.length ? nextList : missingPlayers(unavailableFrom.last);
  for (const m of missing) {
    const p = players.find((x) => x.id === m.playerId);
    if (p) p.unavailable = { kind: m.kind, reason: m.reason, expectedReturn: m.expectedReturn };
  }
  const opp = fromGame && (fromGame.homeCompetitor.id === BARCA ? fromGame.awayCompetitor : fromGame.homeCompetitor);
  const unavailableSource = fromGame ? { opponent: opp?.name, date: new Date(fromGame.startTime).toISOString(), upcoming: Boolean(nextList.length) } : undefined;
  console.log(`unavailable: ${missing.length} players (from the ${nextList.length ? 'next' : 'last'} match${opp ? ` v ${opp.name}` : ''})`);
  return { coach, players, unavailableSource };
}

// ---------- before a match: form, missing players, previous meetings ----------
function outcomeFor(g, teamId) {
  const mine = g.homeCompetitor?.id === teamId ? g.homeCompetitor : g.awayCompetitor;
  const other = mine === g.homeCompetitor ? g.awayCompetitor : g.homeCompetitor;
  if (!mine || !other || mine.score < 0 || other.score < 0) return undefined;
  return {
    date: new Date(g.startTime).toISOString(),
    opponent: other.name,
    home: mine === g.homeCompetitor,
    for: mine.score,
    against: other.score,
    result: mine.score > other.score ? 'win' : mine.score < other.score ? 'loss' : 'draw',
    competition: splitCompetition(g.competitionDisplayName)[0],
  };
}

async function lastFive(teamId) {
  const res = await api(`games/results/?competitors=${teamId}`);
  return (res.games ?? [])
    .filter((g) => g.statusGroup === 4)
    .sort((a, b) => b.startTime.localeCompare(a.startTime))
    .slice(0, 5)
    .map((g) => outcomeFor(g, teamId))
    .filter(Boolean);
}

async function matchPreview(gameId) {
  const { game: g } = await api(`game/?gameId=${gameId}`);
  const barcaHome = g.homeCompetitor.id === BARCA;
  const them = barcaHome ? g.awayCompetitor : g.homeCompetitor;
  const preview = {
    form: { barca: await lastFive(BARCA).catch(() => []), opp: await lastFive(them.id).catch(() => []) },
    missing: { barca: missingPlayers(g, 'barca'), opp: missingPlayers(g, 'opp') },
    h2h: [],
  };
  // Previous meetings between the two teams.
  try {
    const h = await api(`games/h2h/?gameId=${gameId}`);
    const games = h.game?.h2hGames ?? h.h2hGames ?? h.games ?? g.h2hGames ?? [];
    preview.h2h = games
      .filter((x) => x.id !== g.id && x.statusGroup === 4)
      .sort((a, b) => b.startTime.localeCompare(a.startTime))
      .slice(0, 5)
      .map((x) => outcomeFor(x, BARCA))
      .filter(Boolean);
    if (!globalThis.loggedH2h) {
      globalThis.loggedH2h = true;
      console.log(`h2h ${gameId}: game keys=${Object.keys(h.game ?? {}).filter((k) => /h2h|game/i.test(k)).join(',')} games=${games.length}`);
    }
  } catch (e) {
    console.warn(`h2h ${gameId}: ${e.message}`);
  }
  return {
    id: String(g.id),
    venue: g.venue?.name,
    events: [],
    lineups: {},
    stats: [],
    preview,
  };
}

async function build() {
  if (process.env.FORCE_BACKUP) throw new Error('backup test (FORCE_BACKUP)');
  await mkdir(IMG_DIR, { recursive: true });
  const crest = await saveImage('Competitors', BARCA, 9);

  const [fixtures, results] = await Promise.all([
    api(`games/fixtures/?competitors=${BARCA}`),
    api(`games/results/?competitors=${BARCA}`),
  ]);
  const start = seasonStart();
  const games = [...(results.games ?? []), ...(fixtures.games ?? [])].filter((g) => new Date(g.startTime) >= start);
  const unique = [...new Map(games.map((g) => [g.id, g])).values()];
  const matches = [];
  for (const g of unique) matches.push(await toMatch(g));
  if (!matches.length) throw new Error('no matches this season');

  // Venue name for the next match.
  const next = matches.filter((m) => m.status !== 'finished').sort((a, b) => a.kickoff.localeCompare(b.kickoff))[0];
  if (next) {
    try {
      const detail = await api(`game/?gameId=${next.id}`);
      if (detail.game?.venue?.name) next.venue = detail.game.venue.name;
      unavailableFrom.next = detail.game;
    } catch (e) {
      console.warn(`venue: ${e.message}`);
    }
  }

  // Our place in every competition that has a table.
  // One entry per competition (a cup's stages share one competition id).
  const competitions = [...new Map(unique.map((g) => [g.competitionId, splitCompetition(g.competitionDisplayName)[0]])).entries()];
  const standings = [];
  for (const [id, name] of competitions) {
    try {
      const s = await api(`standings/?competitions=${id}`);
      const rows = s.standings?.[0]?.rows ?? [];
      const i = rows.findIndex((r) => r.competitor.id === BARCA);
      if (i < 0) continue;
      const row = rows[i];
      let note;
      if (i === 0 && rows[1]) note = `${row.points - rows[1].points} נק׳ לפני ${rows[1].competitor.name}`;
      else if (i > 0) note = `${rows[0].points - row.points} נק׳ אחרי ${rows[0].competitor.name}`;
      standings.push({ competition: name, position: row.position, points: row.points, played: row.gamePlayed, note });
    } catch (e) {
      console.warn(`standings ${id}: ${e.message}`);
    }
  }

  const stats = await api(`stats/?competitors=${BARCA}`).catch(() => undefined);

  // Details of every match that has started.
  await mkdir(`${OUT_DIR}/matches`, { recursive: true });
  let details = 0;
  for (const m of matches.filter((x) => x.status !== 'scheduled')) {
    try {
      const d = await matchDetail(m.id, m.competition, m.status === 'finished' && !isFriendly(m.competition));
      if (m.venue === 'בית' || m.venue === 'חוץ') m.venue = d.venue ?? m.venue;
      await writeFile(`${OUT_DIR}/matches/${m.id}.json`, JSON.stringify(d));
      if (!details) console.log(`sample detail ${m.id}: ${d.events.length} events, ${d.stats.length} stats, lineup ${JSON.stringify(d.lineups.barca?.players?.slice(0, 2))}`);
      details++;
    } catch (e) {
      console.warn(`match ${m.id}: ${e.message}`);
    }
  }
  console.log(`match details: ${details}`);

  // Preview pages for the next two matches.
  for (const m of matches.filter((x) => x.status === 'scheduled').sort((a, b) => a.kickoff.localeCompare(b.kickoff)).slice(0, 2)) {
    try {
      const p = await matchPreview(m.id);
      await writeFile(`${OUT_DIR}/matches/${m.id}.json`, JSON.stringify(p));
      console.log(`preview ${m.id}: form ${p.preview.form.barca.length}/${p.preview.form.opp.length}, missing ${p.preview.missing.barca.length}/${p.preview.missing.opp.length}, h2h ${p.preview.h2h.length}`);
    } catch (e) {
      console.warn(`preview ${m.id}: ${e.message}`);
    }
  }

  try {
    const squad = await squadFile();
    globalThis.lastSquad = squad;
    try {
      const c = await careers(squad.players);
      await writeFile(`${OUT_DIR}/careers.json`, JSON.stringify(c));
      for (const p of squad.players) Object.assign(p, c.players[p.id] ?? {});
    } catch (e) {
      console.warn(`careers: ${e.message}`);
    }
    await writeFile(`${OUT_DIR}/players.json`, JSON.stringify(squad));
    console.log(`no career: ${squad.players.filter((p) => !p.career?.length).map((p) => `${p.number ?? '-'} ${p.fullName}`).join(' | ') || 'none'}`);
    console.log(`squad: ${squad.players.length} players, coach: ${squad.coach?.name ?? '-'}, sample: ${JSON.stringify(squad.players.find((p) => p.season))}`);
  } catch (e) {
    console.warn(`squad: ${e.message}`);
  }

  try {
    await writeFile(`${OUT_DIR}/legends.json`, JSON.stringify(await legendPhotos()));
  } catch (e) {
    console.warn(`legend photos: ${e.message}`);
  }

  const tables = [];
  for (const [id, name] of competitions.filter(([, n]) => !isFriendly(n))) {
    try {
      tables.push(await competitionTables(id, name));
    } catch (e) {
      console.warn(`tables ${id}: ${e.message}`);
    }
  }
  // 365Scores sometimes returns no Barcelona rankings for a competition: build them from our own season totals.
  for (const t of tables) {
    if (t.barcaRankings.length || !globalThis.lastSquad) continue;
    const by = (key, name, digits = 0) => {
      const rows = globalThis.lastSquad.players
        .map((p) => ({ p, c: p.byCompetition?.find((x) => x.competition === t.competition) }))
        .filter(({ c }) => c && c[key])
        .sort((a, b) => b.c[key] - a.c[key])
        .slice(0, 10)
        .map(({ p, c }) => ({ playerId: p.id, name: p.name, barca: true, value: digits ? c[key].toFixed(digits) : c[key], photo: p.photo }));
      return rows.length ? { name, rows } : undefined;
    };
    t.barcaRankings = [by('goals', 'שערים'), by('assists', 'בישולים'), by('rating', '365 מצטיינים', 2), by('yellow', 'כרטיסים צהובים'), by('minutes', 'דקות משחק')].filter(Boolean);
    if (t.barcaRankings.length) console.warn(`tables ${t.competition}: built Barcelona rankings from season totals`);
  }
  // Still nothing: keep the last published ones.
  if (tables.some((t) => !t.barcaRankings.length)) {
    const prev = await fetch(LIVE_SITE + 'data/tables.json').then((r) => (r.ok ? r.json() : [])).catch(() => []);
    for (const t of tables) {
      const old = prev.find?.((x) => x.competition === t.competition);
      if (!t.barcaRankings.length && old?.barcaRankings?.length) {
        t.barcaRankings = old.barcaRankings;
        console.warn(`tables ${t.competition}: no Barcelona rankings from 365Scores, kept the published ones`);
      }
    }
  }
  await writeFile(`${OUT_DIR}/tables.json`, JSON.stringify(tables));
  console.log(`tables: ${tables.map((t) => `${t.competition} rows=${t.rows.length} rankings=${t.barcaRankings.map((r) => r.name).join('/')} | all=${t.allRankings.map((r) => r.name).join('/')}`).join(' ; ')}`);

  // Euro → shekel rate for the budget page (free, no key).
  let eurIls;
  try {
    const fx = await fetch('https://open.er-api.com/v6/latest/EUR').then((r) => r.json());
    eurIls = fx?.rates?.ILS;
    console.log(`EUR→ILS: ${eurIls}`);
  } catch (e) {
    console.warn(`exchange rate: ${e.message}`);
  }

  return {
    isSample: false,
    updatedAt: new Date().toISOString(),
    eurIls,
    crest,
    matches,
    standings,
    topScorer: await leader(stats, 'שערים'),
    topAssister: await leader(stats, 'בישולים'),
    news: await (async () => {
      try {
        const n = await collectTelegram();
        // Check that the live feed the site reads in the browser answers and allows web pages to read it.
        await fetch('https://rsshub.app/telegram/channel/barcamaniail?format=json', { headers: { origin: 'https://system-of-goals.github.io' } })
          .then(async (r) => {
            const j = r.ok ? await r.json().catch(() => ({})) : {};
            console.log(`live feed: HTTP ${r.status}, cors=${r.headers.get('access-control-allow-origin') ?? '-'}, items=${j.items?.length ?? 0}, first=${j.items?.[0]?.url ?? '-'}`);
          })
          .catch((e) => console.warn(`live feed: ${e.message}`));
        await writeFile(`${OUT_DIR}/news.json`, JSON.stringify(n));
        // Home page: the latest posts that have text (photo-only posts are on the news page).
        return n.filter((p) => p.hasText ?? Boolean(p.text)).slice(0, 3);
      } catch (e) {
        console.warn(`news: ${e.message}`);
        return [];
      }
    })(),
  };
}

// Files on the published site that the robot rebuilds each run. When 365Scores fails they
// are copied from the published site, so no page breaks.
const LIVE_SITE = 'https://system-of-goals.github.io/Barca/';
async function keepPublished(path) {
  try {
    const r = await fetch(LIVE_SITE + path);
    if (!r.ok) return false;
    await mkdir(`public/${path.split('/').slice(0, -1).join('/')}`, { recursive: true });
    await writeFile(`public/${path}`, Buffer.from(await r.arrayBuffer()));
    return true;
  } catch {
    return false;
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  let data;
  try {
    data = await build();
    console.log(`365Scores: ${data.matches.length} matches, ${data.standings.length} standings, ${saved.size} images`);
  } catch (e) {
    console.error(`365Scores failed: ${e.message}. Using the backup.`);
    let previous;
    try {
      const r = await fetch(LIVE_URL);
      if (r.ok) previous = await r.json();
    } catch {
      // nothing published yet
    }
    // Keep every other published file, and the images and match pages it uses.
    for (const f of ['tables.json', 'players.json', 'careers.json', 'legends.json', 'news.json']) await keepPublished(`data/${f}`);
    for (const m of previous?.matches ?? []) if (m.status !== 'scheduled') await keepPublished(`data/matches/${m.id}.json`);
    const images = new Set(JSON.stringify(previous ?? {}).match(/img\/[\w.-]+\.(?:png|jpg)/g) ?? []);
    for (const img of images) await keepPublished(img);

    // Fresh results and fixtures from ESPN; everything else from the last published data.
    try {
      const espn = await fromEspn(seasonStart());
      data = { ...(previous ?? { isSample: false, news: [] }), ...espn, updatedAt: new Date().toISOString(), backup: 'ESPN' };
      // Matches 365Scores already had keep their Hebrew names and crests.
      if (previous) {
        data.matches = espn.matches.map((m) => {
          const old = previous.matches.find((p) => Math.abs(new Date(p.kickoff) - new Date(m.kickoff)) < 3 * 3600 * 1000);
          return old ? { ...old, status: m.status, barcaGoals: m.barcaGoals ?? old.barcaGoals, opponentGoals: m.opponentGoals ?? old.opponentGoals } : m;
        });
        if (!espn.standings.length) data.standings = previous.standings;
      }
      console.log(`ESPN backup: ${data.matches.length} matches, ${espn.standings.length} standings`);
    } catch (e2) {
      console.error(`ESPN failed too: ${e2.message}. Keeping the last published data.`);
      if (!previous) return console.error('No published data to keep. The site will show sample data.');
      data = previous;
    }
  }
  await writeFile(`${OUT_DIR}/site.json`, JSON.stringify(data));
}

await main();
