// Prints the shape of the 365Scores responses the site will use, so the data
// script can be written against real structures. Runs on GitHub's servers.

const H = { 'user-agent': 'Mozilla/5.0 (personal fan site)' };
const B = 'https://webws.365scores.com/web';
const Q = 'appTypeId=5&langId=2&timezoneName=Asia/Jerusalem';
const T = 132; // FC Barcelona

async function get(path) {
  try {
    const r = await fetch(`${B}/${path}`, { headers: H });
    return { status: r.status, body: await r.json().catch(() => null) };
  } catch (e) { return { status: 'ERR ' + e.message, body: null }; }
}
const show = (label, v, n = 2500) => console.log(`\n### ${label}\n` + JSON.stringify(v).slice(0, n));
const keys = (o) => (o && typeof o === 'object' ? Object.keys(o).join(',') : String(o));

const fx = await get(`games/fixtures/?${Q}&competitors=${T}`);
console.log('fixtures', fx.status, 'top keys:', keys(fx.body));
const g0 = fx.body?.games?.[0];
show('fixture game[0]', g0, 3000);
const comps = fx.body?.competitions ?? [];
show('fixtures competitions', comps.map((c) => ({ id: c.id, name: c.name, seasonNum: c.currentSeasonNum, img: c.imageVersion })));

const rs = await get(`games/results/?${Q}&competitors=${T}`);
const rg = rs.body?.games ?? [];
console.log('\nresults', rs.status, 'count', rg.length, 'first', rg[0]?.startTime, 'last', rg.at(-1)?.startTime);
const latest = [...rg].sort((a, b) => new Date(b.startTime) - new Date(a.startTime))[0];
show('latest result (summary)', latest, 2000);

if (latest) {
  const gm = await get(`game/?${Q}&gameId=${latest.id}`);
  const g = gm.body?.game ?? {};
  console.log('\ngame keys:', keys(g));
  console.log('homeCompetitor keys:', keys(g.homeCompetitor));
  show('lineup member[0]', g.homeCompetitor?.lineups?.members?.[0], 800);
  show('members (players) [0..1]', gm.body?.game?.members?.slice(0, 2), 800);
  show('events[0..2]', g.events?.slice(0, 3), 1200);
  show('statistics', g.statistics?.slice?.(0, 6) ?? g.statistics, 1500);
  console.log('game top-level keys:', keys(gm.body));
}

for (const c of comps.slice(0, 4)) {
  const st = await get(`standings/?${Q}&competitions=${c.id}`);
  const s = st.body?.standings?.[0];
  console.log(`\nstandings comp ${c.id} (${c.name})`, st.status, 'keys', keys(st.body), 'rows', s?.rows?.length);
  show(`standings ${c.id} row[0]`, s?.rows?.[0], 900);
}

for (const p of [`stats/?${Q}&competitors=${T}`, `stats/?${Q}&competitions=${comps[0]?.id}&competitors=${T}`, `squads/?${Q}&competitors=${T}`]) {
  const r = await get(p);
  console.log(`\n${p.split('?')[0]}`, r.status, 'keys', keys(r.body));
  show(`${p}`, r.body, 2500);
}
