// Collects Barcelona's data from 365Scores (in Hebrew) and writes
// public/data/site.json in the shape of src/data/types.ts.
// Runs on GitHub's servers before every build (every 15 minutes).
// If 365Scores fails, it keeps the last published data so the site never breaks.

import { mkdir, writeFile } from 'node:fs/promises';

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

async function toMatch(g) {
  const home = g.homeCompetitor.id === BARCA;
  const us = home ? g.homeCompetitor : g.awayCompetitor;
  const them = home ? g.awayCompetitor : g.homeCompetitor;
  const status = STATUS[g.statusGroup] ?? 'scheduled';
  const round = g.roundNum && g.roundName === 'מחזור' ? `מחזור ${g.roundNum}` : g.stageName || g.roundName || '';
  return {
    id: String(g.id),
    competition: g.competitionDisplayName,
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
  const competitions = [...new Map(unique.map((g) => [g.competitionId, g.competitionDisplayName])).entries()];
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
