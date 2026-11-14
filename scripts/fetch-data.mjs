// Collects Barcelona's data from 365Scores (in Hebrew) and writes
// public/data/site.json in the shape of src/data/types.ts.
// Runs on GitHub's servers before every build (every 15 minutes).
// If 365Scores fails, it keeps the last published data so the site never breaks.

import { appendFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';

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
    const st = await api(path).catch(() => undefined);
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
      if (Date.now() - new Date(old.updatedAt).getTime() < 24 * 60 * 60 * 1000) return old;
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
  const awards = await sparql(`SELECT ?player ?awardLabel ?when WHERE {
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

  const players = {};
  for (const p of squad) {
    const candidates = byBirth.get(p.birthdate?.slice(0, 10));
    const e = candidates && candidates.size === 1 ? [...candidates.values()][0] : undefined;
    players[p.id] = e
      ? {
          wikipedia: e.wikipedia,
          career: e.career.sort((a, b) => (a.from ?? 0) - (b.from ?? 0)),
          awards: e.awards.sort((a, b) => (b.year ?? 0) - (a.year ?? 0)),
        }
      : null;
  }
  const found = Object.values(players).filter(Boolean).length;
  console.log(`careers: found ${found}/${squad.length} players on Wikidata`);
  return { updatedAt: new Date().toISOString(), players };
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
    if (/מאמן/.test(a.position?.name ?? '')) {
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
  return { coach, players };
}

async function build() {
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

  try {
    const squad = await squadFile();
    try {
      const c = await careers(squad.players);
      await writeFile(`${OUT_DIR}/careers.json`, JSON.stringify(c));
      for (const p of squad.players) Object.assign(p, c.players[p.id] ?? {});
    } catch (e) {
      console.warn(`careers: ${e.message}`);
    }
    await writeFile(`${OUT_DIR}/players.json`, JSON.stringify(squad));
    console.log(`squad: ${squad.players.length} players, coach: ${squad.coach?.name ?? '-'}, sample: ${JSON.stringify(squad.players.find((p) => p.season))}`);
  } catch (e) {
    console.warn(`squad: ${e.message}`);
  }

  const tables = [];
  for (const [id, name] of competitions.filter(([, n]) => !isFriendly(n))) {
    try {
      tables.push(await competitionTables(id, name));
    } catch (e) {
      console.warn(`tables ${id}: ${e.message}`);
    }
  }
  await writeFile(`${OUT_DIR}/tables.json`, JSON.stringify(tables));
  console.log(`tables: ${tables.map((t) => `${t.competition} rows=${t.rows.length} rankings=${t.barcaRankings.map((r) => r.name).join('/')} | all=${t.allRankings.map((r) => r.name).join('/')}`).join(' ; ')}`);

  return {
    isSample: false,
    updatedAt: new Date().toISOString(),
    crest,
    matches,
    standings,
    topScorer: await leader(stats, 'שערים'),
    topAssister: await leader(stats, 'בישולים'),
    news: [],
  };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  let data;
  try {
    data = await build();
    console.log(`365Scores: ${data.matches.length} matches, ${data.standings.length} standings, ${saved.size} images`);
  } catch (e) {
    console.error(`365Scores failed: ${e.message}. Keeping the last published data.`);
    try {
      const r = await fetch(LIVE_URL);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      data = await r.json();
    } catch (e2) {
      console.error(`No published data to keep (${e2.message}). The site will show sample data.`);
      return;
    }
  }
  await writeFile(`${OUT_DIR}/site.json`, JSON.stringify(data));
}

await main();
