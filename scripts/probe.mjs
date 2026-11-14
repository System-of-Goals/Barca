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
const show = (label, v, n = 2500) => console.log(`\n### ${label}\n` + String(JSON.stringify(v)).slice(0, n));
const keys = (o) => (o && typeof o === 'object' ? Object.keys(o).join(',') : String(o));

const fx = await get(`games/fixtures/?${Q}&competitors=${T}`);
const comps = fx.body?.competitions ?? [];
const rs = await get(`games/results/?${Q}&competitors=${T}`);
const latest = rs.body?.games?.[0];
console.log('latest', latest?.id, latest?.startTime);
const gs = await get(`game/stats/?${Q}&games=${latest?.id}`);
console.log('game/stats', gs.status, 'keys', keys(gs.body));
show('game/stats statistics[0..5]', gs.body?.statistics?.slice?.(0, 6), 1500);
const gm = await get(`game/?${Q}&gameId=${latest?.id}`);
const g = gm.body?.game ?? {};
show('venue', g.venue, 300);
show('topPerformers', g.topPerformers, 600);
const goals = (g.events ?? []).filter((e) => e.eventType?.id === 1);
show('goal events', goals, 1200);
const members = g.members ?? [];
console.log('member count', members.length, 'sample athleteIds', members.slice(0, 3).map((m) => m.athleteId).join(','));

for (const u of [
  `https://imagecache.365scores.com/image/upload/f_png,w_68,h_68,c_limit,q_auto:eco,dpr_2,d_Competitors:default1.png/v9/Competitors/132`,
  `https://imagecache.365scores.com/image/upload/f_png,w_100,h_100,c_limit,q_auto:eco,dpr_2,d_Athletes:default.png/v${members[0]?.imageVersion ?? 1}/Athletes/${members[0]?.athleteId}`,
  `https://imagecache.365scores.com/image/upload/f_png,w_68,h_68,c_limit,q_auto:eco,dpr_2,d_Competitions:default1.png/v7/Competitions/11`,
]) {
  try { const r = await fetch(u, { headers: H }); console.log('img', r.status, r.headers.get('content-type'), r.headers.get('content-length'), u.split('/').slice(-2).join('/')); } catch (e) { console.log('img ERR', e.message); }
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
