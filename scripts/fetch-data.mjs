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
const WD = 'https://www.wikidata.org/w/api.php';
const WD_HEADERS = { 'user-agent': 'personal-fan-site-bot/1.0 (non-commercial)' };
const CAREER_URL = 'https://system-of-goals.github.io/Barca/data/careers.json';

async function wd(params) {
  const r = await fetch(`${WD}?${new URLSearchParams({ format: 'json', ...params })}`, { headers: WD_HEADERS });
  if (!r.ok) throw new Error(`wikidata HTTP ${r.status}`);
  return r.json();
}
const year = (snak) => {
  const t = snak?.[0]?.datavalue?.value?.time;
  return t ? Number(t.slice(1, 5)) : undefined;
};
const amount = (snak) => {
  const a = snak?.[0]?.datavalue?.value?.amount;
  return a ? Number(a) : undefined;
};

// Finds the footballer's Wikidata entry by English name and birth year.
async function findPlayer(name, birthYear) {
  const res = await wd({ action: 'wbsearchentities', search: name, language: 'en', type: 'item', limit: '7' });
  const candidates = (res.search ?? []).filter((x) => /football/i.test(x.description ?? ''));
  for (const c of candidates) {
    if (!birthYear) return c.id;
    const e = await wd({ action: 'wbgetentities', ids: c.id, props: 'claims' });
    const born = year(e.entities?.[c.id]?.claims?.P569?.map((x) => x.mainsnak));
    if (!born || Math.abs(born - birthYear) <= 1) return c.id;
  }
  return undefined;
}

async function labels(ids) {
  const out = new Map();
  for (let i = 0; i < ids.length; i += 50) {
    const e = await wd({ action: 'wbgetentities', ids: ids.slice(i, i + 50).join('|'), props: 'labels', languages: 'he|en' });
    for (const [id, v] of Object.entries(e.entities ?? {})) out.set(id, v.labels?.he?.value ?? v.labels?.en?.value ?? id);
  }
  return out;
}

async function careerOf(qid) {
  const e = await wd({ action: 'wbgetentities', ids: qid, props: 'claims|sitelinks' });
  const ent = e.entities?.[qid] ?? {};
  const teams = (ent.claims?.P54 ?? []).map((c) => ({
    teamId: c.mainsnak?.datavalue?.value?.id,
    from: year(c.qualifiers?.P580),
    to: year(c.qualifiers?.P582),
    apps: amount(c.qualifiers?.P1350),
    goals: amount(c.qualifiers?.P1351),
    loan: Boolean(c.qualifiers?.P1642),
  })).filter((t) => t.teamId);
  const awards = (ent.claims?.P166 ?? []).map((c) => ({
    awardId: c.mainsnak?.datavalue?.value?.id,
    year: year(c.qualifiers?.P585),
  })).filter((a) => a.awardId);
  const site = ent.sitelinks?.hewiki?.title;
  return { teams, awards, wikipedia: site ? `https://he.wikipedia.org/wiki/${encodeURIComponent(site.replace(/ /g, '_'))}` : undefined };
}

// Returns { updatedAt, players: { [365 athlete id]: { career, awards, wikipedia } } }.
async function careers(squad) {
  try {
    const r = await fetch(CAREER_URL);
    if (r.ok) {
      const old = await r.json();
      const fresh = Date.now() - new Date(old.updatedAt).getTime() < 24 * 60 * 60 * 1000;
      const complete = squad.every((p) => old.players?.[p.id] !== undefined);
      if (fresh && complete) return old;
    }
  } catch {
    // no published copy yet
  }

  const english = await fetch(`${API}/squads/?appTypeId=5&langId=1&competitors=${BARCA}`, { headers: HEADERS }).then((r) => r.json());
  const enName = new Map((english.squads?.[0]?.athletes ?? []).map((a) => [String(a.id), a.name]));
  const raw = {};
  for (const p of squad) {
    try {
      const name = enName.get(p.id);
      const qid = name && (await findPlayer(name, p.birthdate ? new Date(p.birthdate).getFullYear() : undefined));
      raw[p.id] = qid ? await careerOf(qid) : null;
    } catch (e) {
      console.warn(`career ${p.id}: ${e.message}`);
      raw[p.id] = null;
    }
  }
  const ids = [...new Set(Object.values(raw).flatMap((c) => (c ? [...c.teams.map((t) => t.teamId), ...c.awards.map((a) => a.awardId)] : [])))];
  const names = await labels(ids);
  const isNational = (n) => /נבחרת|national/i.test(n);
  const players = {};
  for (const [id, c] of Object.entries(raw)) {
    players[id] = c && {
      wikipedia: c.wikipedia,
      career: c.teams
        .map(({ teamId, ...t }) => ({ ...t, team: names.get(teamId), national: isNational(names.get(teamId) ?? '') }))
        .sort((a, b) => (a.from ?? 0) - (b.from ?? 0)),
      awards: c.awards
        .map(({ awardId, year }) => ({ name: names.get(awardId), year }))
        .sort((a, b) => (b.year ?? 0) - (a.year ?? 0)),
    };
  }
  const found = Object.values(players).filter(Boolean).length;
  console.log(`careers: found ${found}/${squad.length} on Wikidata`);
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
